import express from 'express';
import 'express-async-errors';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { taskQueue } from './workers/taskWorker.js';
import {
  CreateTaskInputSchema,
  TaskOutputSchema,
  TasksResponseSchema,
  IntegrationsResponseSchema
} from './schemas.js';

// Setup Prisma
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

export const app = express();
app.use(express.json({ limit: '100kb' }));

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Auth middleware
export const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', details: 'Missing or invalid Authorization header' });
    return;
  }

  const userId = authHeader.split(' ')[1];

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', details: 'Missing userId in token' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', details: 'Invalid user' });
      return;
    }

    // Attach user to request for downstream handlers
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Fetch historical agent tasks
app.get('/api/tasks', requireAuth, async (req, res) => {
  const authUserId = (req as any).user.id;
  const tasks = await prisma.agentTask.findMany({
    where: { userId: authUserId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  const validated = TasksResponseSchema.parse(tasks);
  res.json(validated);
});

// Trigger a new analysis job
app.post('/api/tasks', requireAuth, async (req, res) => {
  const input = CreateTaskInputSchema.parse(req.body);

  const authUserId = (req as any).user.id;
  if (input.userId !== authUserId) {
    res.status(403).json({ error: 'Forbidden', details: 'Cannot create a task for another user' });
    return;
  }

  const newTask = await prisma.agentTask.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      userId: input.userId,
      status: 'PENDING',
    }
  });

  await taskQueue.add('analyze-task', { taskId: newTask.id });

  const validated = TaskOutputSchema.parse(newTask);
  res.status(201).json(validated);
});

// Get the status of external integrations
app.get('/api/integrations', requireAuth, async (req, res) => {
  const authUserId = (req as any).user.id;
  const integrations = await prisma.externalIntegration.findMany({
    where: { userId: authUserId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  const validated = IntegrationsResponseSchema.parse(integrations);
  res.json(validated);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation Error', details: err.issues });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

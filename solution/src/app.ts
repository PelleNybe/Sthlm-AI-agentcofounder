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
app.use(express.json());

// Fetch historical agent tasks
app.get('/api/tasks', async (req, res) => {
  const tasks = await prisma.agentTask.findMany({
    orderBy: { createdAt: 'desc' }
  });
  const validated = TasksResponseSchema.parse(tasks);
  res.json(validated);
});

// Trigger a new analysis job
app.post('/api/tasks', async (req, res) => {
  const input = CreateTaskInputSchema.parse(req.body);

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
app.get('/api/integrations', async (req, res) => {
  const integrations = await prisma.externalIntegration.findMany({
    orderBy: { createdAt: 'desc' }
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

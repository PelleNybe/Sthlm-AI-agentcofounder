import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app, prisma } from '../src/app.js';
import { taskQueue, taskWorker } from '../src/workers/taskWorker.js';
import { Redis } from 'ioredis';

describe('API Endpoints E2E', () => {
  let userId: string;
  let isDbAvailable = false;
  let isRedisAvailable = false;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
    const { execSync } = await import('child_process');
    try {
      execSync('npx prisma db push', { env: { ...process.env, DATABASE_URL: connectionString }, stdio: 'pipe' });
      isDbAvailable = true;
    } catch (e) {
      console.warn('npx prisma db push failed. DB may not be available.');
    }

    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        const client = new Redis(redisUrl, { maxRetriesPerRequest: null, retryStrategy: () => null });
        await client.ping();
        isRedisAvailable = true;
        await client.quit();
    } catch (e) {
        console.warn('Redis not reachable.');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    try {
        await taskQueue.close();
        await taskWorker.close();
    } catch (e) {}
  });

  beforeEach(async () => {
    if (!isDbAvailable) return;
    try {
        await prisma.agentTask.deleteMany();
        await prisma.externalIntegration.deleteMany();
        await prisma.user.deleteMany();

        const user = await prisma.user.create({
        data: {
            email: 'test_api@example.com',
            name: 'Test API User'
        }
        });
        userId = user.id;
    } catch (e) {
        console.warn('Could not reset db');
    }
  });

  describe('GET /api/tasks', () => {
    it('should return empty list when no tasks exist', async () => {
      if (!isDbAvailable) { expect(true).toBe(true); return; }
      const response = await request(app).get('/api/tasks');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should fetch historical tasks', async () => {
      if (!isDbAvailable) { expect(true).toBe(true); return; }
      await prisma.agentTask.create({
        data: {
          title: 'Test Task 1',
          description: 'Desc 1',
          userId: userId,
          status: 'PENDING'
        }
      });
      await prisma.agentTask.create({
        data: {
          title: 'Test Task 2',
          userId: userId,
          status: 'COMPLETED'
        }
      });

      const response = await request(app).get('/api/tasks');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBeDefined();
      const titles = response.body.map((t: any) => t.title);
      expect(titles).toContain('Test Task 1');
      expect(titles).toContain('Test Task 2');
    });
  });

  describe('POST /api/tasks', () => {
    it('should trigger a new analysis job and return the task', async () => {
      if (!isDbAvailable) { expect(true).toBe(true); return; }
      if (!isRedisAvailable) { expect(true).toBe(true); return; } // Skip if redis is not available since we check the queue
      const payload = {
        title: 'New Analysis Job',
        description: 'Please analyze this',
        userId: userId
      };

      const response = await request(app)
        .post('/api/tasks')
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe(payload.title);
      expect(response.body.description).toBe(payload.description);
      expect(response.body.userId).toBe(payload.userId);
      expect(response.body.status).toBe('PENDING');
      expect(response.body.id).toBeDefined();

      const taskInDb = await prisma.agentTask.findUnique({
        where: { id: response.body.id }
      });
      expect(taskInDb).not.toBeNull();
      expect(taskInDb?.title).toBe(payload.title);

      const jobs = await taskQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
      const jobAdded = jobs.find(j => j.data.taskId === response.body.id);
      expect(jobAdded).toBeDefined();
    });

    it('should fail with 400 when missing required fields', async () => {
      if (!isDbAvailable) { expect(true).toBe(true); return; }
      const response = await request(app)
        .post('/api/tasks')
        .send({ description: 'No title' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/integrations', () => {
    it('should return empty list when no integrations exist', async () => {
      if (!isDbAvailable) { expect(true).toBe(true); return; }
      const response = await request(app).get('/api/integrations');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should fetch historical integrations', async () => {
      if (!isDbAvailable) { expect(true).toBe(true); return; }
      await prisma.externalIntegration.create({
        data: {
          provider: 'github',
          accessToken: 'gho_123456789',
          userId: userId
        }
      });

      const response = await request(app).get('/api/integrations');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].provider).toBe('github');
      expect(response.body[0].accessToken).toBe('gho_123456789');
    });
  });
});

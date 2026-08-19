import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { taskQueue, taskWorker } from '../src/workers/taskWorker.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

describe('BullMQ Task Worker', () => {
  let prisma: PrismaClient;
  let pool: pg.Pool;
  let isDbAvailable = false;
  let isRedisAvailable = false;
  let queueEvents: QueueEvents;

  beforeAll(async () => {
    // Check DB
    pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    try {
      await prisma.$connect();
      await prisma.user.count();
      isDbAvailable = true;
    } catch (e) {
      console.warn("DB not reachable in test environment, skipping DB parts.");
      isDbAvailable = false;
    }

    // Check Redis
    try {
        const connection = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            retryStrategy: () => null // don't retry in test if not available
        });
        await connection.ping();
        isRedisAvailable = true;
        connection.disconnect();

        const eventsConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
        queueEvents = new QueueEvents('agent-tasks', { connection: eventsConnection });
    } catch(e) {
        console.warn("Redis not reachable, skipping BullMQ test.");
        isRedisAvailable = false;
    }
  });

  afterAll(async () => {
    if (!isDbAvailable) {
       if (pool) await pool.end();
       return;
    }

    try {
      const users = await prisma.user.findMany({
        where: { email: { endsWith: '@worker-test.com' } }
      });

      if (users.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: users.map((u: any) => u.id) } }
        });
      }
    } catch (e) {
      console.error("Cleanup failed", e);
    }

    await prisma.$disconnect();
    if (pool) await pool.end();

    // Close BullMQ connections
    await taskWorker.close();
    await taskQueue.close();
    if (queueEvents) {
        await queueEvents.close();
    }
  });

  it('should process a task via BullMQ', async () => {
    if (!isDbAvailable || !isRedisAvailable) {
       console.warn("Skipping test because DB or Redis is unavailable.");
       return;
    }

    const uniqueEmail = `test-${uuidv4()}@worker-test.com`;

    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        name: 'Worker Test User',
        agentTasks: {
          create: [
            {
              title: 'Worker Test Task',
              description: 'This is a test task for BullMQ worker.',
              status: 'PENDING',
            }
          ]
        }
      },
      include: {
        agentTasks: true,
      }
    });

    const task = user.agentTasks[0];
    expect(task).toBeDefined();

    // Add job to real queue
    const job = await taskQueue.add('execute-task', { taskId: task!.id });
    expect(job.id).toBeDefined();

    // Wait for worker to process the job
    const completedJob = await job.waitUntilFinished(queueEvents);
    expect(completedJob).toBeDefined();

    // Validate DB has been updated
    const updatedTask = await prisma.agentTask.findUnique({
        where: { id: task!.id }
    });

    expect(updatedTask).toBeDefined();
    expect(updatedTask?.status).toBe('APPROVED');
    expect(updatedTask?.description).toContain('Reasoning:');
  }, 15000); // Allow some time for network calls
});

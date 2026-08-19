import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { AgentCofounderOrchestrator } from '../orchestration/agentBrain.js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Setup Prisma
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Setup Redis connection for BullMQ
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    // Only retry in non-test environments
    if (process.env.NODE_ENV === 'test') {
      return null;
    }
    return Math.min(times * 50, 2000);
  }
});

const queueName = 'agent-tasks';

// Create the Queue
export const taskQueue = new Queue(queueName, { connection });

// Initialize the orchestrator
const orchestrator = new AgentCofounderOrchestrator(prisma);

// Create the Worker
export const taskWorker = new Worker(
  queueName,
  async (job) => {
    console.log(`Processing job ${job.id} for task ${job.data.taskId}`);
    try {
      const result = await orchestrator.executeTask(job.data.taskId);
      console.log(`Successfully processed job ${job.id}`);
      return result;
    } catch (error: any) {
      console.error(`Failed to process job ${job.id}: ${error.message}`);
      throw error;
    }
  },
  { connection }
);

taskWorker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed!`);
});

taskWorker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} has failed with ${err.message}`);
});

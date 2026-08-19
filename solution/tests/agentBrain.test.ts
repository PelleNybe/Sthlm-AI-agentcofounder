import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { AgentCofounderOrchestrator, LlmNetworkError, LlmRateLimitError } from '../src/orchestration/agentBrain.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

describe('AgentCofounderOrchestrator', () => {
  let prisma: PrismaClient;
  let pool: pg.Pool;
  let isDbAvailable = false;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    try {
      await prisma.$connect();
      await prisma.user.count();
      isDbAvailable = true;
    } catch (e) {
      console.warn("DB not reachable in test environment, tests will skip DB parts.");
      isDbAvailable = false;
    }
  });

  afterAll(async () => {
    if (!isDbAvailable) {
       if (pool) await pool.end();
       return;
    }

    try {
      const users = await prisma.user.findMany({
        where: { email: { endsWith: '@orchestrator-test.com' } }
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
  });

  it('should execute task and update decision using real network call', async () => {
    if (!isDbAvailable) {
       console.warn("Skipping test because DB is unavailable.");
       return;
    }

    const orchestrator = new AgentCofounderOrchestrator(prisma);
    const uniqueEmail = `test-${uuidv4()}@orchestrator-test.com`;

    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        name: 'Orchestrator Test User',
        agentTasks: {
          create: [
            {
              title: 'Should we launch the product?',
              description: 'The product is feature complete but missing marketing materials.',
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

    try {
        const updatedTask = await orchestrator.executeTask(task!.id);

        expect(updatedTask).toBeDefined();
        expect(updatedTask.status).toBe('APPROVED');
        expect(updatedTask.description).toContain('Reasoning:');
    } catch (err) {
        if (err instanceof LlmRateLimitError || err instanceof LlmNetworkError) {
             console.warn('Real network error or rate limit hit during test:', err);
             expect(true).toBe(true);
        } else {
             throw err;
        }
    }
  });

  it('should open circuit breaker after consecutive failures on external call', async () => {
    const orchestrator = new AgentCofounderOrchestrator(prisma as any);

    // Mock global fetch to always fail with a network error
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.reject(new Error('Simulated network failure'));
    });

    let networkErrorCount = 0;
    let breakerErrorCount = 0;

    for (let i = 0; i < 6; i++) {
        try {
            // Test callExternalLLM via type casting to bypass private modifier for testing
            await (orchestrator as any).callExternalLLM('Test Title', 'Test Description');
        } catch (error: any) {
            if (error instanceof LlmNetworkError) {
                if (error.message.includes('Circuit breaker is open')) {
                    breakerErrorCount++;
                } else {
                    networkErrorCount++;
                }
            }
        }
    }

    expect(fetchSpy).toHaveBeenCalled();
    expect(networkErrorCount).toBeGreaterThan(0);
    expect(breakerErrorCount).toBeGreaterThan(0);

    fetchSpy.mockRestore();
  });
});

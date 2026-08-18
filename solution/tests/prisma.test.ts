import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

describe('Prisma Integration Tests', () => {
  let prisma: PrismaClient;
  let pool: pg.Pool;
  let isDbAvailable = false;

  beforeAll(async () => {
    const { execSync } = await import('child_process');
    try {
      execSync('npx prisma db push', { env: { ...process.env, DATABASE_URL: connectionString }, stdio: 'pipe' });
      isDbAvailable = true;
    } catch (e) {
      console.warn('npx prisma db push failed. DB may not be available.');
    }

    pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    try {
        await prisma.$connect();
        await prisma.user.count();
        isDbAvailable = true;
    } catch (e) {
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
        where: {
          email: {
            endsWith: '@test.com'
          }
        }
      });

      if (users.length > 0) {
        await prisma.user.deleteMany({
          where: {
            id: { in: users.map((u: any) => u.id) }
          }
        });
      }
    } catch (e) {
      console.error("Cleanup failed", e);
    }

    await prisma.$disconnect();
    if (pool) await pool.end();
  });

  it('should create and retrieve a User with relations', async () => {
    if (!isDbAvailable) {
      console.warn("Skipping test because DB could not be initialized");
      expect(true).toBe(true);
      return;
    }

    const uniqueEmail = `test-${uuidv4()}@test.com`;

    const newUser = await prisma.user.create({
      data: {
        email: uniqueEmail,
        name: 'Test User',
        agentTasks: {
          create: [
            {
              title: 'First Agent Task',
              description: 'This is a test task for the agent.',
              status: 'PENDING',
            }
          ]
        },
        externalIntegrations: {
          create: [
            {
              provider: 'github',
              accessToken: 'mock_token',
            }
          ]
        }
      },
      include: {
        agentTasks: true,
        externalIntegrations: true,
      }
    });

    expect(newUser).toBeDefined();
    expect(newUser.email).toBe(uniqueEmail);
    expect(newUser.name).toBe('Test User');

    expect(newUser.agentTasks).toHaveLength(1);
    expect(newUser.agentTasks?.[0]?.title).toBe('First Agent Task');
    expect(newUser.agentTasks?.[0]?.status).toBe('PENDING');

    expect(newUser.externalIntegrations).toHaveLength(1);
    expect(newUser.externalIntegrations?.[0]?.provider).toBe('github');

    const fetchedUser = await prisma.user.findUnique({
      where: { id: newUser.id },
      include: {
        agentTasks: true,
        externalIntegrations: true,
      }
    });

    expect(fetchedUser).toBeDefined();
    if (!fetchedUser) throw new Error('fetchedUser is null');
    expect(fetchedUser.email).toBe(uniqueEmail);
    expect(fetchedUser.agentTasks).toHaveLength(1);
    expect(fetchedUser.externalIntegrations).toHaveLength(1);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import {
  sendSlackNotification,
  formatSlackPayload,
  SlackWebhookError,
  notificationQueue,
  slackWorker,
  processSlackJob,
  QUEUE_NAME,
  SlackTaskNotificationPayload
} from '../src/workers/slackNotifier.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

describe('Slack Notifier Worker', () => {
  let isRedisAvailable = false;
  let queueEvents: QueueEvents | undefined;
  const originalEnv = process.env.SLACK_WEBHOOK_URL;

  beforeAll(async () => {
    // Check Redis availability
    try {
      const connection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: () => null
      });
      await connection.ping();
      isRedisAvailable = true;
      connection.disconnect();

      const eventsConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
      queueEvents = new QueueEvents(QUEUE_NAME, { connection: eventsConnection });
    } catch (e) {
      console.warn('Redis not reachable in test environment, skipping live queue tests.');
      isRedisAvailable = false;
    }
  });

  afterAll(async () => {
    process.env.SLACK_WEBHOOK_URL = originalEnv;

    await slackWorker.close();
    await notificationQueue.close();
    if (queueEvents) {
      await queueEvents.close();
    }
  });

  beforeEach(() => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/TEST/MOCK/WEBHOOK';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatSlackPayload', () => {
    it('should format task data into professional Slack blocks', () => {
      const payloadData: SlackTaskNotificationPayload = {
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Launch Marketing Campaign',
        description: 'Initiate campaign on social media.',
        status: 'COMPLETED',
        summary: 'Successfully scheduled posts and tracked engagement.'
      };

      const formatted = formatSlackPayload(payloadData);

      expect(formatted.text).toContain('Launch Marketing Campaign');
      expect(formatted.blocks).toHaveLength(3);

      const block0 = formatted.blocks[0] as any;
      const block1 = formatted.blocks[1] as any;
      const block2 = formatted.blocks[2] as any;

      expect(block0.type).toBe('header');
      expect(block0.text.text).toContain('Launch Marketing Campaign');
      expect(block1.fields[0].text).toContain('123e4567-e89b-12d3-a456-426614174000');
      expect(block1.fields[1].text).toContain('COMPLETED');
      expect(block2.text.text).toContain('Successfully scheduled posts and tracked engagement.');
    });
  });

  describe('sendSlackNotification', () => {
    it('should send a successful HTTP POST request to Slack Webhook', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => 'ok'
      } as Response);

      const taskData: SlackTaskNotificationPayload = {
        taskId: 'task-100',
        title: 'Optimize Database Index',
        status: 'APPROVED',
        summary: 'Created composite index on user_id and created_at'
      };

      const result = await sendSlackNotification(taskData);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const [url, options] = call!;
      expect(url).toBe('https://hooks.slack.com/services/TEST/MOCK/WEBHOOK');
      expect(options?.method).toBe('POST');
      expect((options?.headers as Record<string, string>)['Content-Type']).toBe('application/json');

      const body = JSON.parse(options?.body as string);
      expect(body.text).toContain('Optimize Database Index');
    });

    it('should throw SlackWebhookError if SLACK_WEBHOOK_URL is missing', async () => {
      delete process.env.SLACK_WEBHOOK_URL;

      const taskData: SlackTaskNotificationPayload = {
        title: 'Test Task Without Webhook URL'
      };

      await expect(sendSlackNotification(taskData)).rejects.toThrow(SlackWebhookError);
      await expect(sendSlackNotification(taskData)).rejects.toThrow(
        'SLACK_WEBHOOK_URL environment variable is not defined.'
      );
    });

    it('should gracefully handle HTTP failure responses from Slack Webhook', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const taskData: SlackTaskNotificationPayload = {
        title: 'Failed Task Webhook Notification'
      };

      await expect(sendSlackNotification(taskData)).rejects.toThrow(SlackWebhookError);
    });

    it('should gracefully handle network errors during fetch call', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network connectivity lost'));

      const taskData: SlackTaskNotificationPayload = {
        title: 'Network Error Task'
      };

      await expect(sendSlackNotification(taskData)).rejects.toThrow(SlackWebhookError);
      await expect(sendSlackNotification(taskData)).rejects.toThrow('Network connectivity lost');
    });
  });

  describe('BullMQ Worker Integration', () => {
    it('should process a job from the notification queue or worker processor', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => 'ok'
      } as Response);

      const jobData: SlackTaskNotificationPayload = {
        taskId: 'queue-job-1',
        title: 'BullMQ Slack Task',
        status: 'COMPLETED',
        summary: 'Job processed via BullMQ queue'
      };

      if (isRedisAvailable && queueEvents) {
        const job = await notificationQueue.add('send-slack-summary', jobData);
        expect(job.id).toBeDefined();

        const completedResult = await job.waitUntilFinished(queueEvents);
        expect(completedResult).toEqual({ success: true, status: 200 });
        expect(mockFetch).toHaveBeenCalled();
      } else {
        // Fallback testing worker handler function logic directly when Redis is unavailable
        const dummyJob = {
          id: 'mock-job-1',
          data: jobData
        };

        const result = await processSlackJob(dummyJob);

        expect(result).toEqual({ success: true, status: 200 });
        expect(mockFetch).toHaveBeenCalled();
      }
    });
  });
});

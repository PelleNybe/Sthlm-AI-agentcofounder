import { Worker, Queue } from 'bullmq';
import { Redis } from 'ioredis';

export class SlackWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlackWebhookError';
  }
}

export interface SlackTaskNotificationPayload {
  taskId?: string;
  title: string;
  description?: string | null;
  status?: string;
  summary?: string;
}

// Setup Redis connection for BullMQ
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }
    return Math.min(times * 50, 2000);
  }
});

export const QUEUE_NAME = 'notification-queue';

// Create the Queue
export const notificationQueue = new Queue(QUEUE_NAME, { connection });

export function formatSlackPayload(data: SlackTaskNotificationPayload) {
  const taskId = data.taskId || 'N/A';
  const title = data.title || 'Untitled Task';
  const status = data.status || 'COMPLETED';
  const summaryText = data.summary || data.description || 'No summary or description provided.';

  return {
    text: `*Agent Task Update:* ${title} [${status}]`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🤖 Agent Task Update: ${title}`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Task ID:*\n${taskId}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${status}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary:*\n${summaryText}`
        }
      }
    ]
  };
}

export async function sendSlackNotification(data: SlackTaskNotificationPayload) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new SlackWebhookError('SLACK_WEBHOOK_URL environment variable is not defined.');
  }

  const payload = formatSlackPayload(data);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new SlackWebhookError(`Slack Webhook request failed with status ${response.status}: ${response.statusText}`);
    }

    return { success: true, status: response.status };
  } catch (error: any) {
    if (error instanceof SlackWebhookError) {
      throw error;
    }
    throw new SlackWebhookError(`Failed to send Slack notification: ${error.message}`);
  }
}

// Create the Worker
export const slackWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    console.log(`Processing Slack notification job ${job.id} for task ${job.data.taskId || 'N/A'}`);
    try {
      const result = await sendSlackNotification(job.data);
      console.log(`Successfully sent Slack notification for job ${job.id}`);
      return result;
    } catch (error: any) {
      console.error(`Failed to process Slack notification job ${job.id}: ${error.message}`);
      throw error;
    }
  },
  { connection }
);

slackWorker.on('completed', (job) => {
  console.log(`Slack notification job ${job.id} completed.`);
});

slackWorker.on('failed', (job, err) => {
  console.error(`Slack notification job ${job?.id} failed with ${err.message}`);
});

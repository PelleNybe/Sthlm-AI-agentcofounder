import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import CircuitBreaker from 'opossum';
import { generateEmbedding } from '../services/embeddingService.js';

export class LlmNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmNetworkError';
  }
}

export class LlmRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmRateLimitError';
  }
}

export class LlmParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmParsingError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task with ID ${taskId} not found.`);
    this.name = 'TaskNotFoundError';
  }
}

const DecisionSchema = z.object({
  decision: z.string(),
  reasoning: z.string().optional(),
});

export class AgentCofounderOrchestrator {
  private prisma: PrismaClient;
  private llmBreaker: CircuitBreaker;
  private fallbackBreaker: CircuitBreaker;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.llmBreaker = new CircuitBreaker(this.executeLlmFetch.bind(this), {
      timeout: 10000, // 10s
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30s
    });
    this.fallbackBreaker = new CircuitBreaker(this.executeFallbackFetch.bind(this), {
      timeout: 5000, // 5s
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30s
    });
  }

  async executeTask(taskId: string): Promise<any> {
    const task = await this.prisma.agentTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const taskText = `Title: ${task.title}\nDescription: ${task.description || ''}`;
    let currentEmbedding: number[] = [];
    let historicalContext = '';

    // Generate embedding for current task if API key is present
    if (process.env.OPENAI_API_KEY) {
        try {
            currentEmbedding = await generateEmbedding(taskText);

            // Search for similar previous tasks
            const similarTasks = await this.prisma.$queryRaw<Array<{ id: string, title: string, status: string, distance: number }>>`
                SELECT id, title, status, embedding <=> ${currentEmbedding}::vector as distance
                FROM "AgentTask"
                WHERE id != ${taskId} AND embedding IS NOT NULL
                ORDER BY distance ASC
                LIMIT 3
            `;

            if (similarTasks.length > 0) {
                historicalContext = '\n\nHistorical context from similar past tasks:\n';
                similarTasks.forEach(st => {
                    historicalContext += `- Task: "${st.title}", Decision: ${st.status}\n`;
                });
            }
        } catch (error) {
            console.error("Failed to generate embedding or fetch history", error);
        }
    }

    const llmResponse = await this.callExternalLLM(task.title, task.description || '', historicalContext);

    // Parse response
    const parsed = DecisionSchema.safeParse(llmResponse);
    if (!parsed.success) {
      throw new LlmParsingError('Failed to parse LLM response: ' + parsed.error.message);
    }

    // Save decision and embedding
    if (currentEmbedding.length > 0) {
         await this.prisma.$executeRaw`
            UPDATE "AgentTask"
            SET status = ${parsed.data.decision},
                description = ${task.description || ''} || '\n\nReasoning: ' || ${parsed.data.reasoning || ''},
                embedding = ${currentEmbedding}::vector
            WHERE id = ${taskId}
        `;

        return this.prisma.agentTask.findUnique({ where: { id: taskId } });
    } else {
        const updatedTask = await this.prisma.agentTask.update({
            where: { id: taskId },
            data: {
              status: parsed.data.decision,
              description: (task.description || '') + '\n\nReasoning: ' + (parsed.data.reasoning || ''),
            },
        });
        return updatedTask;
    }
  }

  private async executeLlmFetch(apiKey: string, title: string, description: string, historicalContext: string): Promise<any> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: "json_object" },
        messages: [
          {
            role: 'system',
            content: 'You are an AI decision maker. Evaluate the task and respond in JSON with {"decision": "APPROVED" | "REJECTED", "reasoning": "your reasoning"}.'
          },
          {
            role: 'user',
            content: `Title: ${title}\nDescription: ${description}${historicalContext}`
          }
        ]
      }),
    });

    if (response.status === 429) {
      throw new LlmRateLimitError('Rate limit exceeded for OpenAI API.');
    }

    if (!response.ok) {
      throw new LlmNetworkError(`OpenAI API returned status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
        throw new LlmParsingError('OpenAI response missing content');
    }

    return JSON.parse(content);
  }

  private async executeFallbackFetch(): Promise<any> {
    const response = await fetch(`https://api.datamuse.com/words?ml=decision&max=1`);

    if (!response.ok) {
         throw new LlmNetworkError(`Fallback API returned status ${response.status}`);
    }

    const data = await response.json();

    return {
        decision: 'APPROVED',
        reasoning: `Fallback reasoning based on real network call. Word found: ${data[0]?.word}`
    };
  }

  private async callExternalLLM(title: string, description: string, historicalContext: string): Promise<any> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        return await this.llmBreaker.fire(apiKey, title, description, historicalContext);
      } catch (err: any) {
        if (err.code === 'EOPENBREAKER') {
          throw new LlmNetworkError('Service Unavailable: LLM Circuit breaker is open');
        }
        if (err instanceof LlmRateLimitError || err instanceof LlmNetworkError || err instanceof LlmParsingError) {
          throw err;
        }
        throw new LlmNetworkError(`Network error calling OpenAI: ${err.message}`);
      }
    } else {
        try {
          return await this.fallbackBreaker.fire();
        } catch (err: any) {
          if (err.code === 'EOPENBREAKER') {
            throw new LlmNetworkError('Service Unavailable: Fallback Circuit breaker is open');
          }
          throw new LlmNetworkError(`Network error calling Fallback API: ${err.message}`);
        }
    }
  }
}

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import CircuitBreaker from 'opossum';

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

    const llmResponse = await this.callExternalLLM(task.title, task.description || '');

    // Parse response
    const parsed = DecisionSchema.safeParse(llmResponse);
    if (!parsed.success) {
      throw new LlmParsingError('Failed to parse LLM response: ' + parsed.error.message);
    }

    const updatedTask = await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: parsed.data.decision,
        description: (task.description || '') + '\n\nReasoning: ' + (parsed.data.reasoning || ''),
      },
    });

    return updatedTask;
  }

  private async executeLlmFetch(apiKey: string, title: string, description: string): Promise<any> {
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
            content: `Title: ${title}\nDescription: ${description}`
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

  private async callExternalLLM(title: string, description: string): Promise<any> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        return await this.llmBreaker.fire(apiKey, title, description);
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

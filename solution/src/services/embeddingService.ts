import { z } from 'zod';
import { LlmNetworkError, LlmRateLimitError } from '../orchestration/agentBrain.js';

const EmbeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
    })
  ),
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to generate embeddings.');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small',
    }),
  });

  if (response.status === 429) {
    throw new LlmRateLimitError('Rate limit exceeded for OpenAI Embeddings API.');
  }

  if (!response.ok) {
    throw new LlmNetworkError(`OpenAI Embeddings API returned status ${response.status}`);
  }

  const data = await response.json();

  const parsed = EmbeddingResponseSchema.safeParse(data);
  if (!parsed.success) {
      throw new Error(`Failed to parse embedding response: ${parsed.error.message}`);
  }

  if (!parsed.data.data[0]?.embedding) {
      throw new Error('Embedding not found in response');
  }

  return parsed.data.data[0].embedding;
}

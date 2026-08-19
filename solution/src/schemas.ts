import { z } from 'zod';

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  userId: z.string().uuid("Invalid userId"),
});

export const TaskOutputSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().uuid(),
});

export const TasksResponseSchema = z.array(TaskOutputSchema);

export const IntegrationOutputSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().uuid(),
});

export const IntegrationsResponseSchema = z.array(IntegrationOutputSchema);

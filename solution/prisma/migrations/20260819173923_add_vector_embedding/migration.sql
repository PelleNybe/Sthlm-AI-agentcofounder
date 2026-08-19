-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "AgentTask" ADD COLUMN "embedding" vector(1536);

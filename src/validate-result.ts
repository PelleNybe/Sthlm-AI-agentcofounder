import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv, type ErrorObject } from "ajv";
import type { RunResult } from "./types.js";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");
const schema = JSON.parse(
  readFileSync(path.join(REPOSITORY_ROOT, "contract-public", "result.schema.json"), "utf8"),
) as object;
const ajv = new Ajv({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);

function sameNumber(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 1e-9;
}

export async function validateResultObject(value: unknown): Promise<string[]> {
  if (!validateSchema(value)) {
    return (validateSchema.errors ?? []).map(
      (error: ErrorObject) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
    );
  }

  const result = value as RunResult;
  const errors: string[] = [];
  if (result.status !== "failed" && result.model_calls === 0) {
    errors.push("non-failed result must include at least one model call");
  }
  const totals = result.call_log.reduce(
    (sum, call) => ({
      input: sum.input + call.input_tokens,
      output: sum.output + call.output_tokens,
      cacheRead: sum.cacheRead + call.cache_read_tokens,
      cacheWrite: sum.cacheWrite + call.cache_write_tokens,
      total: sum.total + call.total_tokens,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  );

  if (result.model_calls !== result.call_log.length) errors.push("model_calls does not match call_log length");
  if (result.input_tokens !== totals.input) errors.push("input_tokens does not reconcile with call_log");
  if (result.output_tokens !== totals.output) errors.push("output_tokens does not reconcile with call_log");
  if (result.cache_read_tokens !== totals.cacheRead) errors.push("cache_read_tokens does not reconcile with call_log");
  if (result.cache_write_tokens !== totals.cacheWrite) errors.push("cache_write_tokens does not reconcile with call_log");
  if (result.total_tokens !== totals.total) errors.push("total_tokens does not reconcile with call_log");
  if (!sameNumber(result.cost_total, result.call_log.reduce((sum, call) => sum + (call.cost_total ?? 0), 0))) {
    errors.push("cost_total does not reconcile with call_log");
  }
  if (result.call_log.some((call, index) => call.index !== index + 1)) {
    errors.push("call_log indexes must be contiguous and start at 1");
  }
  return errors;
}

async function main(): Promise<void> {
  const target = process.argv[2] ?? path.join(REPOSITORY_ROOT, "output", "app", "result.json");
  const parsed: unknown = JSON.parse(await readFile(path.resolve(target), "utf8"));
  const errors = await validateResultObject(parsed);
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Valid result: ${path.resolve(target)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

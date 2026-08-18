import type { CallLogEntry, PiUsage, UsageSummary } from "./types.js";

const ZERO_USAGE: UsageSummary = {
  model_calls: 0,
  input_tokens: 0,
  output_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  total_tokens: 0,
  reasoning_tokens: 0,
  cost_total: 0,
  call_log: [],
};

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isUsage(value: unknown): value is PiUsage {
  if (typeof value !== "object" || value === null) return false;
  const usage = value as Record<string, unknown>;
  return (
    finiteNonNegative(usage.input) &&
    finiteNonNegative(usage.output) &&
    finiteNonNegative(usage.cacheRead) &&
    finiteNonNegative(usage.cacheWrite) &&
    finiteNonNegative(usage.totalTokens)
  );
}

function usageCall(usage: PiUsage, model: string, index: number): CallLogEntry {
  const call: CallLogEntry = {
    index,
    model,
    input_tokens: usage.input,
    output_tokens: usage.output,
    cache_read_tokens: usage.cacheRead,
    cache_write_tokens: usage.cacheWrite,
    total_tokens: usage.totalTokens,
  };

  if (finiteNonNegative(usage.reasoning)) call.reasoning_tokens = usage.reasoning;
  if (finiteNonNegative(usage.cost?.total)) call.cost_total = usage.cost.total;
  return call;
}

function callFromEvent(event: unknown, index: number): CallLogEntry | undefined {
  if (typeof event !== "object" || event === null) return undefined;
  const record = event as Record<string, unknown>;

  if (record.type === "compaction_end") {
    const result = record.result;
    if (typeof result !== "object" || result === null) return undefined;
    const usage = (result as Record<string, unknown>).usage;
    return isUsage(usage) ? usageCall(usage, "pi-compaction", index) : undefined;
  }

  if (record.type !== "message_end") return undefined;

  const message = record.message;
  if (typeof message !== "object" || message === null) return undefined;
  const completed = message as Record<string, unknown>;
  if (!isUsage(completed.usage)) return undefined;

  if (completed.role === "assistant") {
    const provider = typeof completed.provider === "string" ? `${completed.provider}/` : "";
    const rawModel = completed.responseModel ?? completed.model;
    const model = typeof rawModel === "string" ? `${provider}${rawModel}` : `${provider}unknown`;
    return usageCall(completed.usage, model, index);
  }

  if (completed.role === "toolResult") {
    const toolName = completed.toolName ?? completed.name;
    return usageCall(
      completed.usage,
      typeof toolName === "string" ? `tool:${toolName}` : "tool:unknown",
      index,
    );
  }

  return undefined;
}

export function collectUsageFromJsonLines(content: string): UsageSummary {
  const calls: CallLogEntry[] = [];

  for (const line of content.split(/\r?\n/u)) {
    if (line.trim() === "") continue;
    try {
      const call = callFromEvent(JSON.parse(line), calls.length + 1);
      if (call) calls.push(call);
    } catch {
      // Pi writes JSONL to stdout. A malformed line is retained in the raw audit
      // artifact and ignored here; the independent judge can reject it.
    }
  }

  if (calls.length === 0) return { ...ZERO_USAGE, call_log: [] };

  return calls.reduce<UsageSummary>(
    (summary, call) => ({
      model_calls: summary.model_calls + 1,
      input_tokens: summary.input_tokens + call.input_tokens,
      output_tokens: summary.output_tokens + call.output_tokens,
      cache_read_tokens: summary.cache_read_tokens + call.cache_read_tokens,
      cache_write_tokens: summary.cache_write_tokens + call.cache_write_tokens,
      total_tokens: summary.total_tokens + call.total_tokens,
      reasoning_tokens: summary.reasoning_tokens + (call.reasoning_tokens ?? 0),
      cost_total: summary.cost_total + (call.cost_total ?? 0),
      call_log: [...summary.call_log, call],
    }),
    { ...ZERO_USAGE, call_log: [] },
  );
}

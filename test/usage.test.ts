import { describe, expect, it } from "vitest";
import { collectUsageFromJsonLines } from "../src/usage.js";

describe("collectUsageFromJsonLines", () => {
  it("aggregates completed assistant messages without counting other events", () => {
    const content = [
      JSON.stringify({ type: "agent_start" }),
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          model: "frontier-model",
          usage: {
            input: 100,
            output: 20,
            cacheRead: 50,
            cacheWrite: 5,
            reasoning: 7,
            totalTokens: 175,
            cost: { total: 0.012 },
          },
        },
      }),
      "not-json",
      JSON.stringify({ type: "tool_execution_end", toolName: "bash" }),
      JSON.stringify({
        type: "message_end",
        message: {
          role: "toolResult",
          toolName: "custom-reviewer",
          usage: {
            input: 30,
            output: 4,
            cacheRead: 10,
            cacheWrite: 0,
            totalTokens: 44,
            cost: { total: 0.003 },
          },
        },
      }),
      JSON.stringify({
        type: "compaction_end",
        result: {
          usage: {
            input: 40,
            output: 8,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 48,
            cost: { total: 0.004 },
          },
        },
      }),
      JSON.stringify({
        type: "message_end",
        message: {
          role: "assistant",
          model: "frontier-model",
          usage: {
            input: 80,
            output: 10,
            cacheRead: 20,
            cacheWrite: 0,
            totalTokens: 110,
            cost: { total: 0.006 },
          },
        },
      }),
    ].join("\n");

    expect(collectUsageFromJsonLines(content)).toEqual({
      model_calls: 4,
      input_tokens: 250,
      output_tokens: 42,
      cache_read_tokens: 80,
      cache_write_tokens: 5,
      total_tokens: 377,
      reasoning_tokens: 7,
      cost_total: 0.025,
      call_log: [
        {
          index: 1,
          model: "frontier-model",
          input_tokens: 100,
          output_tokens: 20,
          cache_read_tokens: 50,
          cache_write_tokens: 5,
          total_tokens: 175,
          reasoning_tokens: 7,
          cost_total: 0.012,
        },
        {
          index: 2,
          model: "tool:custom-reviewer",
          input_tokens: 30,
          output_tokens: 4,
          cache_read_tokens: 10,
          cache_write_tokens: 0,
          total_tokens: 44,
          cost_total: 0.003,
        },
        {
          index: 3,
          model: "pi-compaction",
          input_tokens: 40,
          output_tokens: 8,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 48,
          cost_total: 0.004,
        },
        {
          index: 4,
          model: "frontier-model",
          input_tokens: 80,
          output_tokens: 10,
          cache_read_tokens: 20,
          cache_write_tokens: 0,
          total_tokens: 110,
          cost_total: 0.006,
        },
      ],
    });
  });

  it("returns zero totals when there are no completed model messages", () => {
    expect(collectUsageFromJsonLines("{\"type\":\"agent_start\"}\n")).toMatchObject({
      model_calls: 0,
      total_tokens: 0,
      call_log: [],
    });
  });
});

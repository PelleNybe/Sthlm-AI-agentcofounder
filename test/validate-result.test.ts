import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { validateResultObject } from "../src/validate-result.js";
import type { RunResult } from "../src/types.js";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const VALID_RUN_RESULT: RunResult = {
  status: "success",
  app_url: "http://localhost:3000",
  start_command: "npm run dev",
  summary: "A valid test run",
  implemented_features: ["feature A"],
  assumptions: ["None"],
  tests_run: [{ command: "npm test", journey: "Test 1", result: "passed" }],
  model_calls: 1,
  input_tokens: 10,
  output_tokens: 5,
  cache_read_tokens: 2,
  cache_write_tokens: 1,
  total_tokens: 18,
  reasoning_tokens: 0,
  cost_total: 0.01,
  call_log: [
    {
      index: 1,
      model: "test-model",
      input_tokens: 10,
      output_tokens: 5,
      cache_read_tokens: 2,
      cache_write_tokens: 1,
      total_tokens: 18,
      cost_total: 0.01,
    },
  ],
  harness_checks: [{ command: "npm test", journey: "Harness Test 1", result: "passed" }],
  pi_exit_code: 0,
  telemetry_source: "pi-json-event-stream",
  port_reclamation: {
    preexisting_listener: false,
    listener_after_pi: false,
    attempted: false,
    reclaimed: false,
    process_ids: [],
    diagnostic: "None",
  },
};

describe("validateResultObject", () => {
  it("returns no errors for a valid result", async () => {
    const errors = await validateResultObject(VALID_RUN_RESULT);
    expect(errors).toEqual([]);
  });

  it("returns schema validation errors for missing required fields", async () => {
    const invalidResult = { ...VALID_RUN_RESULT };
    // @ts-expect-error Intentionally delete a required field
    delete invalidResult.status;
    const errors = await validateResultObject(invalidResult);
    expect(errors).toContain("/ must have required property 'status'");
  });

  it("returns an error if a non-failed result has 0 model calls", async () => {
    const invalidResult: RunResult = {
      ...VALID_RUN_RESULT,
      status: "success",
      model_calls: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      total_tokens: 0,
      cost_total: 0,
      call_log: [],
    };
    const errors = await validateResultObject(invalidResult);
    expect(errors).toContain("non-failed result must include at least one model call");
  });

  it("returns an error if model_calls does not match call_log length", async () => {
    const invalidResult: RunResult = {
      ...VALID_RUN_RESULT,
      model_calls: 2, // Doesn't match length 1
    };
    const errors = await validateResultObject(invalidResult);
    expect(errors).toContain("model_calls does not match call_log length");
  });

  it("returns an error if token totals do not reconcile with call_log", async () => {
    const testCases = [
      { field: "input_tokens", error: "input_tokens does not reconcile with call_log" },
      { field: "output_tokens", error: "output_tokens does not reconcile with call_log" },
      { field: "cache_read_tokens", error: "cache_read_tokens does not reconcile with call_log" },
      { field: "cache_write_tokens", error: "cache_write_tokens does not reconcile with call_log" },
      { field: "total_tokens", error: "total_tokens does not reconcile with call_log" },
    ];

    for (const { field, error } of testCases) {
      const invalidResult = {
        ...VALID_RUN_RESULT,
        [field]: 9999,
      };
      const errors = await validateResultObject(invalidResult);
      expect(errors).toContain(error);
    }
  });

  it("returns an error if cost_total does not reconcile with call_log", async () => {
    const invalidResult: RunResult = {
      ...VALID_RUN_RESULT,
      cost_total: 99.99,
    };
    const errors = await validateResultObject(invalidResult);
    expect(errors).toContain("cost_total does not reconcile with call_log");
  });

  it("tolerates small floating point differences in cost_total", async () => {
    const resultWithSmallDiff: RunResult = {
      ...VALID_RUN_RESULT,
      cost_total: 0.0100000001,
      call_log: [
        {
          index: 1,
          model: "test-model",
          input_tokens: 10,
          output_tokens: 5,
          cache_read_tokens: 2,
          cache_write_tokens: 1,
          total_tokens: 18,
          cost_total: 0.01,
        },
      ],
    };
    const errors = await validateResultObject(resultWithSmallDiff);
    expect(errors).toEqual([]);
  });

  it("returns an error if call_log indices are not contiguous starting at 1", async () => {
    const invalidResult: RunResult = {
      ...VALID_RUN_RESULT,
      model_calls: 2,
      input_tokens: 20,
      output_tokens: 10,
      cache_read_tokens: 4,
      cache_write_tokens: 2,
      total_tokens: 36,
      cost_total: 0.02,
      call_log: [
        {
          index: 1,
          model: "test-model",
          input_tokens: 10,
          output_tokens: 5,
          cache_read_tokens: 2,
          cache_write_tokens: 1,
          total_tokens: 18,
          cost_total: 0.01,
        },
        {
          index: 3, // Should be 2
          model: "test-model",
          input_tokens: 10,
          output_tokens: 5,
          cache_read_tokens: 2,
          cache_write_tokens: 1,
          total_tokens: 18,
          cost_total: 0.01,
        },
      ],
    };
    const errors = await validateResultObject(invalidResult);
    expect(errors).toContain("call_log indexes must be contiguous and start at 1");
  });
});

describe("CLI main function", () => {
  const VALID_TEMP_FILE = path.resolve(__dirname, "valid_temp.json");
  const INVALID_TEMP_FILE = path.resolve(__dirname, "invalid_temp.json");

  beforeEach(() => {
    writeFileSync(VALID_TEMP_FILE, JSON.stringify(VALID_RUN_RESULT));
    writeFileSync(INVALID_TEMP_FILE, JSON.stringify({ status: "success" }));
  });

  afterEach(() => {
    try { unlinkSync(VALID_TEMP_FILE); } catch (e) {}
    try { unlinkSync(INVALID_TEMP_FILE); } catch (e) {}
  });

  it("exits with code 0 and logs success for valid JSON", () => {
    const output = execFileSync("node", ["--import", "tsx", "src/validate-result.ts", VALID_TEMP_FILE], { encoding: "utf8" });
    expect(output).toContain("Valid result:");
  });

  it("exits with code 1 and logs errors for invalid JSON", () => {
    try {
      execFileSync("node", ["--import", "tsx", "src/validate-result.ts", INVALID_TEMP_FILE], { encoding: "utf8" });
      expect.fail("Should have thrown error");
    } catch (e: any) {
      expect(e.status).toBe(1);
      expect(e.stderr).toContain("must have required property");
    }
  });
});

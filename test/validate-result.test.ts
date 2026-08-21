import { describe, expect, it } from "vitest";
import { validateResultObject } from "../src/validate-result.js";
import type { RunResult } from "../src/types.js";

const createValidResult = (): RunResult => ({
  status: "success",
  app_url: "http://localhost:3000",
  start_command: "npm run dev",
  summary: "A good run",
  implemented_features: ["feature 1"],
  assumptions: ["assume 1"],
  tests_run: [{ command: "test", journey: "happy path", result: "passed" }],
  harness_checks: [{ command: "check", journey: "check 1", result: "passed" }],
  model_calls: 1,
  input_tokens: 10,
  output_tokens: 20,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  total_tokens: 30,
  reasoning_tokens: 0,
  cost_total: 0.05,
  call_log: [
    {
      index: 1,
      model: "gpt-4",
      input_tokens: 10,
      output_tokens: 20,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      total_tokens: 30,
      cost_total: 0.05,
    },
  ],
  pi_exit_code: 0,
  telemetry_source: "pi-json-event-stream",
  port_reclamation: {
    preexisting_listener: false,
    listener_after_pi: false,
    attempted: false,
    reclaimed: false,
    process_ids: [],
    diagnostic: "none",
  },
});

describe("validateResultObject", () => {
  it("should return no errors for a valid result", async () => {
    const result = createValidResult();
    const errors = await validateResultObject(result);
    expect(errors).toEqual([]);
  });

  it("should return errors for missing required fields", async () => {
    const result = createValidResult();
    // @ts-expect-error deliberately removing a required field
    delete result.status;
    const errors = await validateResultObject(result);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes("status") || e.includes("must have required property"))).toBe(true);
  });

  it("should return error if model_calls does not match call_log length", async () => {
    const result = createValidResult();
    result.model_calls = 2; // length is 1
    const errors = await validateResultObject(result);
    expect(errors).toContain("model_calls does not match call_log length");
  });

  it("should return error if input_tokens does not reconcile with call_log", async () => {
    const result = createValidResult();
    result.input_tokens = 99;
    const errors = await validateResultObject(result);
    expect(errors).toContain("input_tokens does not reconcile with call_log");
  });

  it("should return error if call_log indexes are not contiguous starting at 1", async () => {
    const result = createValidResult();
    result.model_calls = 2;
    result.input_tokens = 20;
    result.output_tokens = 40;
    result.total_tokens = 60;
    result.cost_total = 0.10;
    result.call_log.push({
      index: 3, // Should be 2
      model: "gpt-4",
      input_tokens: 10,
      output_tokens: 20,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      total_tokens: 30,
      cost_total: 0.05,
    });
    const errors = await validateResultObject(result);
    expect(errors).toContain("call_log indexes must be contiguous and start at 1");
  });

  it("should return error if status is success but no tests were run", async () => {
    const result = createValidResult();
    result.status = "success";
    result.tests_run = []; // Schema requires minItems: 1 if success
    const errors = await validateResultObject(result);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("must NOT have fewer than 1 items") || e.includes("must match \"then\" schema"))).toBe(true);
  });

  it("should return error if non-failed result has 0 model calls", async () => {
    const result = createValidResult();
    result.status = "success";
    result.model_calls = 0;
    result.input_tokens = 0;
    result.output_tokens = 0;
    result.total_tokens = 0;
    result.cost_total = 0;
    result.call_log = [];
    const errors = await validateResultObject(result);
    expect(errors).toContain("non-failed result must include at least one model call");
  });
});

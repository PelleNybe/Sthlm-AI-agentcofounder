import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  composeResult,
  missingRequiredResultPaths,
  normalizePartialResult,
  readPartialResult,
  rootStartCommand,
  writeResult,
} from "../src/result.js";
import type {
  AppVerification,
  PartialRunResult,
  PortReclamationAudit,
  UsageSummary,
} from "../src/types.js";
import { validateResultObject } from "../src/validate-result.js";

const partial: PartialRunResult = {
  status: "success",
  app_url: "http://localhost:3000",
  start_command: "npm run dev",
  summary: "A useful app",
  implemented_features: ["Create records"],
  assumptions: ["Used a fixed category set"],
  tests_run: [{ command: "npm test", journey: "Create a record", result: "passed" }],
};

const ROOT_START_COMMAND = "npm --prefix 'output/app' run dev";

const usage: UsageSummary = {
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
};

const verification: AppVerification = {
  passed: true,
  checks: [
    { command: "npm test", journey: "Automated tests", result: "passed" },
    { command: "npm run build", journey: "Production build", result: "passed" },
    { command: "npm run dev", journey: "HTTP startup probe", result: "passed" },
  ],
};

const portReclamation: PortReclamationAudit = {
  preexisting_listener: false,
  listener_after_pi: false,
  attempted: false,
  reclaimed: false,
  process_ids: [],
  diagnostic: "Port 3000 remained free after Pi",
};

describe("result contract", () => {
  it("accepts a reconciled result", async () => {
    const result = composeResult(partial, usage, 0, verification, portReclamation, ROOT_START_COMMAND);
    expect(await validateResultObject(result)).toEqual([]);
    expect(result.port_reclamation).toMatchObject({ attempted: false, process_ids: [] });
  });

  it("overrides success when Pi exits unsuccessfully", () => {
    expect(composeResult(partial, usage, 124, verification, portReclamation, ROOT_START_COMMAND).status).toBe(
      "failed",
    );
  });

  it("overrides success when telemetry contains no model calls", async () => {
    const zeroUsage: UsageSummary = {
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
    const result = composeResult(partial, zeroUsage, 0, verification, portReclamation, ROOT_START_COMMAND);
    expect(result.status).toBe("failed");
    expect(await validateResultObject({ ...result, status: "success" })).toContain(
      "non-failed result must include at least one model call",
    );
  });

  it("degrades a completed run to partial when an independent app check fails", () => {
    expect(
      composeResult(
        partial,
        usage,
        0,
        { ...verification, passed: false },
        portReclamation,
        ROOT_START_COMMAND,
      ).status,
    ).toBe("partial");
  });

  it("degrades success when no product journey was reported", async () => {
    const result = composeResult(
      { ...partial, tests_run: [] },
      usage,
      0,
      verification,
      portReclamation,
      ROOT_START_COMMAND,
    );

    expect(result.status).toBe("partial");
    expect(await validateResultObject({ ...result, status: "success" })).toContain(
      "/tests_run must NOT have fewer than 1 items",
    );
  });

  it("degrades success when a product journey failed", async () => {
    const result = composeResult(
      { ...partial, tests_run: [{ command: "npm test", journey: "Create a record", result: "failed" }] },
      usage,
      0,
      verification,
      portReclamation,
      ROOT_START_COMMAND,
    );

    expect(result.status).toBe("partial");
    expect(await validateResultObject({ ...result, status: "success" })).toContain(
      "/tests_run/0/result must be equal to constant",
    );
  });

  it("uses a root-runnable launch command and preserves product journeys in tests_run", () => {
    const normalized = normalizePartialResult({
      ...partial,
      app_url: "http://127.0.0.1:3000/",
      start_command: "npm start",
      ignored: "extra",
      tests_run: [{ ...partial.tests_run[0], notes: "chatty model output" }],
    });
    expect(normalized?.tests_run).toEqual(partial.tests_run);
    const result = composeResult(
      normalized ?? partial,
      usage,
      0,
      verification,
      portReclamation,
      ROOT_START_COMMAND,
    );
    expect(result).toMatchObject({
      app_url: "http://localhost:3000",
      start_command: ROOT_START_COMMAND,
      tests_run: partial.tests_run,
      harness_checks: verification.checks,
    });
  });

  it("salvages valid report fields instead of collapsing on one malformed field", () => {
    const normalized = normalizePartialResult({
      status: "pass",
      app_url: ["ignored"],
      start_command: ["ignored"],
      summary: "Kept summary",
      implemented_features: ["Feature one", 2, "Feature two"],
      tests_run: [
        { command: "npm test", journey: "Kept journey", result: "passed" },
        { command: ["npm run build"], journey: "Dropped journey", result: "passed" },
      ],
    });

    expect(normalized).toEqual({
      status: "partial",
      app_url: "http://localhost:3000",
      start_command: "npm run dev",
      summary: "Kept summary",
      implemented_features: ["Feature one", "Feature two"],
      assumptions: [],
      tests_run: [{ command: "npm test", journey: "Kept journey", result: "passed" }],
    });
    expect(composeResult(normalized!, usage, 0, verification, portReclamation, ROOT_START_COMMAND).status).toBe(
      "partial",
    );
  });

  it("reserves the failed fallback for a missing or unparseable report", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-partial-"));
    try {
      await writeFile(path.join(directory, "report.partial.json"), "not json", "utf8");
      expect((await readPartialResult(directory)).status).toBe("failed");
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("rejects telemetry totals that do not reconcile", async () => {
    const result = composeResult(partial, usage, 0, verification, portReclamation, ROOT_START_COMMAND);
    result.input_tokens += 1;
    expect(await validateResultObject(result)).toContain("input_tokens does not reconcile with call_log");
  });

  it("requires every documented harness audit field", async () => {
    const result = composeResult(partial, usage, 0, verification, portReclamation, ROOT_START_COMMAND);
    const auditFields = [
      "harness_checks",
      "reasoning_tokens",
      "cost_total",
      "pi_exit_code",
      "telemetry_source",
      "port_reclamation",
    ];

    for (const field of auditFields) {
      const incomplete = structuredClone(result) as unknown as Record<string, unknown>;
      delete incomplete[field];
      expect(await validateResultObject(incomplete)).toEqual([expect.stringContaining(`'${field}'`)]);
    }
  });

  it("keeps the app-root result when an optional mirror cannot be written", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-result-"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const result = composeResult(partial, usage, 0, verification, portReclamation, ROOT_START_COMMAND);
      const paths = await writeResult(directory, result, [path.join(directory, "missing", "result.json")]);
      expect(paths).toEqual([path.join(directory, "result.json")]);
      expect(warning).toHaveBeenCalledWith(expect.stringContaining("Unable to write result destination"));
    } finally {
      warning.mockRestore();
      await rm(directory, { recursive: true });
    }
  });

  it("writes a start command that works from each result location", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-result-locations-"));
    const appDirectory = path.join(repositoryRoot, "output", "app");
    const rootResultPath = path.join(repositoryRoot, "result.json");
    await mkdir(appDirectory, { recursive: true });
    try {
      const result = composeResult(
        partial,
        usage,
        0,
        verification,
        portReclamation,
        rootStartCommand(repositoryRoot, appDirectory),
      );
      await writeResult(appDirectory, result, [rootResultPath]);
      const [appResult, rootResult] = await Promise.all([
        readFile(path.join(appDirectory, "result.json"), "utf8").then(JSON.parse),
        readFile(rootResultPath, "utf8").then(JSON.parse),
      ]);

      expect(appResult.start_command).toBe("npm run dev");
      expect(rootResult.start_command).toBe(ROOT_START_COMMAND);
      expect({ ...appResult, start_command: ROOT_START_COMMAND }).toEqual(rootResult);
    } finally {
      await rm(repositoryRoot, { recursive: true });
    }
  });

  it("shell-quotes special characters in a custom output directory", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-start-command-"));
    const appDirectory = path.join(repositoryRoot, "output", "my$app");
    await mkdir(appDirectory, { recursive: true });
    await writeFile(
      path.join(appDirectory, "package.json"),
      JSON.stringify({ private: true, scripts: { dev: 'node -e "process.stdout.write(process.cwd())"' } }),
      "utf8",
    );
    try {
      const command = rootStartCommand(repositoryRoot, appDirectory);
      const execution = spawnSync("sh", ["-c", command], {
        cwd: repositoryRoot,
        encoding: "utf8",
      });

      expect(command).toBe("npm --prefix 'output/my$app' run dev");
      expect(execution.status, execution.stderr).toBe(0);
      expect(execution.stdout).toContain(appDirectory);
    } finally {
      await rm(repositoryRoot, { recursive: true });
    }
  });

  it("identifies either required result destination when it was not written", () => {
    expect(
      missingRequiredResultPaths(
        ["/challenge/result.json"],
        ["/challenge/output/app/result.json", "/challenge/result.json"],
      ),
    ).toEqual(["/challenge/output/app/result.json"]);
  });
});

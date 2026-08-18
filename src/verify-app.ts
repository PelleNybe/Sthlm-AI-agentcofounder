import { spawn, type ChildProcess } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { signalProcessTree, usesDetachedProcessGroup } from "./process-tree.js";
import type { AppVerification, TestRun } from "./types.js";

const MAX_LOG_BYTES = 5 * 1024 * 1024;

interface CommandOutcome {
  exitCode: number;
  timedOut: boolean;
}

interface VitestReport {
  numTotalTests?: unknown;
  numPassedTests?: unknown;
  numFailedTests?: unknown;
  numPendingTests?: unknown;
  numTodoTests?: unknown;
  success?: unknown;
}

export interface VerificationOptions {
  commandTimeoutMs?: number;
  displayRoot?: string;
  serverTimeoutMs?: number;
  npmCommand?: string;
  vitestCommand?: string;
  port?: number;
}

interface CapturedOutput {
  chunks: Buffer[];
  length: number;
  truncated: boolean;
}

function commandName(name: string): string {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function captureOutput(captured: CapturedOutput, chunk: Buffer): void {
  const remaining = MAX_LOG_BYTES - captured.length;
  if (remaining <= 0) {
    captured.truncated = true;
    return;
  }

  const kept = chunk.length <= remaining ? chunk : chunk.subarray(0, remaining);
  captured.chunks.push(kept);
  captured.length += kept.length;
  if (kept.length !== chunk.length) captured.truncated = true;
}

function renderOutput(captured: CapturedOutput): string {
  const content = Buffer.concat(captured.chunks).toString("utf8");
  return captured.truncated ? `${content}\n[log truncated at ${MAX_LOG_BYTES} bytes]\n` : content;
}

async function safeWriteLog(logPath: string, content: string): Promise<boolean> {
  try {
    await writeFile(logPath, content, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    console.warn(`Unable to write verification log ${logPath}: ${String(error)}`);
    return false;
  }
}

function safeSignalProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    signalProcessTree(child, signal);
  } catch {
    // Verification must degrade to a failed check instead of aborting result assembly.
  }
}

async function runLoggedCommand(
  command: string,
  args: string[],
  cwd: string,
  logPath: string,
  timeoutMs: number,
): Promise<CommandOutcome> {
  const captured: CapturedOutput = { chunks: [], length: 0, truncated: false };

  const outcome = await new Promise<CommandOutcome>((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        cwd,
        detached: usesDetachedProcessGroup(),
        env: process.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      captureOutput(captured, Buffer.from(`${String(error)}\n`));
      resolve({ exitCode: 1, timedOut: false });
      return;
    }

    let settled = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;
    let hardStopTimer: NodeJS.Timeout | undefined;
    const finish = (exitCode: number): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      if (hardStopTimer) clearTimeout(hardStopTimer);
      resolve({ exitCode, timedOut });
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      safeSignalProcessTree(child, "SIGTERM");
      killTimer = setTimeout(() => {
        safeSignalProcessTree(child, "SIGKILL");
        hardStopTimer = setTimeout(() => finish(124), 1_000);
      }, 5_000);
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      captureOutput(captured, chunk);
      process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      captureOutput(captured, chunk);
      process.stderr.write(chunk);
    });
    child.once("error", (error) => {
      captureOutput(captured, Buffer.from(`${String(error)}\n`));
      finish(1);
    });
    child.once("close", (code) => finish(timedOut ? 124 : (code ?? 1)));
  });

  await safeWriteLog(logPath, renderOutput(captured));
  return outcome;
}

async function hostHasListener(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (listening: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(listening);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(timeoutMs, () => finish(false));
  });
}

export async function portHasListener(port: number, timeoutMs = 500): Promise<boolean> {
  const listeners = await Promise.all([
    hostHasListener("127.0.0.1", port, timeoutMs),
    hostHasListener("::1", port, timeoutMs),
  ]);
  return listeners.some(Boolean);
}

async function waitForHttp(
  url: string,
  timeoutMs: number,
  childIsRunning: () => boolean,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && childIsRunning()) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      await response.text();
      if (response.ok) {
        await delay(300);
        return childIsRunning();
      }
    } catch {
      // The development server may still be starting.
    }
    await delay(200);
  }
  return false;
}

async function waitForPortToClose(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await portHasListener(port))) return true;
    await delay(100);
  }
  return false;
}

async function verifyDevelopmentServer(
  appDirectory: string,
  logPath: string,
  timeoutMs: number,
  npmCommand: string,
  port: number,
): Promise<boolean> {
  if (await portHasListener(port)) {
    await safeWriteLog(logPath, `Port ${port} already had a listener before app verification.\n`);
    return false;
  }

  const captured: CapturedOutput = { chunks: [], length: 0, truncated: false };
  let child: ChildProcess;
  try {
    const args = ["run", "dev"];
    if (port !== 3000) args.push("--", "--port", String(port));
    child = spawn(npmCommand, args, {
      cwd: appDirectory,
      detached: usesDetachedProcessGroup(),
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    await safeWriteLog(logPath, `${String(error)}\n`);
    return false;
  }

  child.stdout?.on("data", (chunk: Buffer) => {
    captureOutput(captured, chunk);
    process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    captureOutput(captured, chunk);
    process.stderr.write(chunk);
  });

  let childClosed = false;
  const closed = new Promise<number>((resolve) => {
    child.once("close", (code) => {
      childClosed = true;
      resolve(code ?? 1);
    });
  });
  const failed = new Promise<{ kind: "error" }>((resolve) => {
    child.once("error", (error) => {
      captureOutput(captured, Buffer.from(`${String(error)}\n`));
      resolve({ kind: "error" });
    });
  });
  const childIsRunning = (): boolean => !childClosed && child.exitCode === null;

  let served = false;
  try {
    const startup = await Promise.race([
      waitForHttp(`http://localhost:${port}`, timeoutMs, childIsRunning).then((ready) => ({
        kind: "probe" as const,
        ready,
      })),
      closed.then((exitCode) => ({ kind: "exit" as const, exitCode })),
      failed,
    ]);
    served = startup.kind === "probe" && startup.ready && childIsRunning();
  } catch (error) {
    captureOutput(captured, Buffer.from(`${String(error)}\n`));
  } finally {
    safeSignalProcessTree(child, "SIGTERM");
    const exitedAfterTerm = await Promise.race([
      closed.then(() => true),
      delay(5_000).then(() => false),
    ]);
    if (!exitedAfterTerm) {
      safeSignalProcessTree(child, "SIGKILL");
      await Promise.race([closed, delay(2_000)]);
    }
  }

  const portClosed = await waitForPortToClose(port, 2_000);
  await safeWriteLog(logPath, renderOutput(captured));
  return served && childClosed && portClosed;
}

function testRun(command: string, journey: string, result: TestRun["result"]): TestRun {
  return { command, journey, result };
}

function boundedDisplayPath(displayRoot: string, target: string): string {
  const relative = path.relative(displayRoot, target);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return path.basename(target);
  }
  return relative;
}

function verificationCommands(
  appDirectory: string,
  artifactDirectory: string,
  displayRoot: string,
  npmCommand: string,
  vitestCommand: string,
  port: number,
): { test: { args: string[]; display: string }; build: string; dev: string } {
  const reportPath = path.join(artifactDirectory, "app-test-results.json");
  const testArgs = [
    "run",
    "--reporter=json",
    `--outputFile=${reportPath}`,
    "--passWithNoTests=false",
  ];
  const displayedReportPath = boundedDisplayPath(displayRoot, reportPath);
  const displayedArgs = [
    "run",
    "--reporter=json",
    `--outputFile=${displayedReportPath}`,
    "--passWithNoTests=false",
  ];
  const displayedVitest = path.isAbsolute(vitestCommand)
    ? boundedDisplayPath(displayRoot, vitestCommand)
    : vitestCommand;
  return {
    test: { args: testArgs, display: [displayedVitest, ...displayedArgs].join(" ") },
    build: `${npmCommand} run build`,
    dev: port === 3000 ? `${npmCommand} run dev` : `${npmCommand} run dev -- --port ${port}`,
  };
}

async function hasPassingVitestReport(reportPath: string): Promise<boolean> {
  try {
    const report = JSON.parse(await readFile(reportPath, "utf8")) as VitestReport;
    return (
      report.success === true &&
      typeof report.numTotalTests === "number" &&
      report.numTotalTests > 0 &&
      report.numPassedTests === report.numTotalTests &&
      report.numFailedTests === 0 &&
      report.numPendingTests === 0 &&
      report.numTodoTests === 0
    );
  } catch {
    return false;
  }
}

export function unavailableAppVerification(reason: string): AppVerification {
  return {
    passed: false,
    checks: [
      testRun("vitest run", `App tests were not run: ${reason}`, "failed"),
      testRun("npm run build", `Production build was not run: ${reason}`, "failed"),
      testRun("npm run dev", `HTTP startup probe was not run: ${reason}`, "failed"),
    ],
  };
}

export async function verifyGeneratedApp(
  appDirectory: string,
  artifactDirectory: string,
  options: VerificationOptions = {},
): Promise<AppVerification> {
  const commandTimeoutMs = options.commandTimeoutMs ?? 120_000;
  const displayRoot = options.displayRoot ?? process.cwd();
  const serverTimeoutMs = options.serverTimeoutMs ?? 20_000;
  const npmCommand = options.npmCommand ?? commandName("npm");
  const port = options.port ?? 3000;
  const vitestCommand =
    options.vitestCommand ??
    path.join(appDirectory, "node_modules", ".bin", process.platform === "win32" ? "vitest.cmd" : "vitest");
  const commands = verificationCommands(appDirectory, artifactDirectory, displayRoot, npmCommand, vitestCommand, port);
  const testReportPath = path.join(artifactDirectory, "app-test-results.json");

  try {
    const test = await runLoggedCommand(
      vitestCommand,
      commands.test.args,
      appDirectory,
      path.join(artifactDirectory, "app-test.log"),
      commandTimeoutMs,
    );
    const testsPassed = test.exitCode === 0 && (await hasPassingVitestReport(testReportPath));
    const build = await runLoggedCommand(
      npmCommand,
      ["run", "build"],
      appDirectory,
      path.join(artifactDirectory, "app-build.log"),
      commandTimeoutMs,
    );
    const serverPassed = await verifyDevelopmentServer(
      appDirectory,
      path.join(artifactDirectory, "app-dev.log"),
      serverTimeoutMs,
      npmCommand,
      port,
    );

    const checks = [
      testRun(
        commands.test.display,
        "The generated app's Vitest report contained at least one completed test and no failed, skipped, or todo tests",
        testsPassed ? "passed" : "failed",
      ),
      testRun(
        commands.build,
        "The generated app completed a production build",
        build.exitCode === 0 ? "passed" : "failed",
      ),
      testRun(
        commands.dev,
        `The generated app started its own HTTP server on port ${port} and shut down cleanly`,
        serverPassed ? "passed" : "failed",
      ),
    ];

    return { passed: checks.every((entry) => entry.result === "passed"), checks };
  } catch (error) {
    await safeWriteLog(path.join(artifactDirectory, "app-verification-error.log"), `${String(error)}\n`);
    return {
      passed: false,
      checks: [
        testRun(commands.test.display, "App verification encountered an internal error", "failed"),
        testRun(commands.build, "Production build could not be verified", "failed"),
        testRun(commands.dev, "HTTP startup could not be verified", "failed"),
      ],
    };
  }
}

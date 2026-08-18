import { spawn } from "node:child_process";
import { readdir, readFile, readlink, realpath } from "node:fs/promises";
import path from "node:path";
import { signalProcessTree, usesDetachedProcessGroup } from "./process-tree.js";
import type { PortReclamationAudit } from "./types.js";
import { portHasListener } from "./verify-app.js";

const LSOF_TIMEOUT_MS = 2_000;

interface ProcessDiscovery {
  processIds: number[];
  diagnostic?: string;
}

export interface PortReclamation {
  attempted: boolean;
  reclaimed: boolean;
  processIds: number[];
  diagnostic: string;
}

export interface CapturedCommand {
  exitCode: number;
  stdout: string;
  timedOut: boolean;
}

function isInsideOrEqual(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

async function listeningSocketInodes(port: number): Promise<Set<string>> {
  const inodes = new Set<string>();
  for (const table of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let content: string;
    try {
      content = await readFile(table, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split("\n").slice(1)) {
      const columns = line.trim().split(/\s+/u);
      const localAddress = columns[1];
      if (!localAddress || columns[3] !== "0A" || !columns[9]) continue;
      const separator = localAddress.lastIndexOf(":");
      if (separator === -1) continue;
      if (Number.parseInt(localAddress.slice(separator + 1), 16) === port) inodes.add(columns[9]);
    }
  }
  return inodes;
}

async function processUid(processId: number): Promise<number | undefined> {
  try {
    const status = await readFile(`/proc/${processId}/status`, "utf8");
    const match = /^Uid:\s+(\d+)/mu.exec(status);
    return match ? Number(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

async function processIdsFromProc(port: number, appDirectory: string): Promise<number[]> {
  const inodes = await listeningSocketInodes(port);
  if (inodes.size === 0) return [];
  const expectedUid = process.getuid?.();
  const appRoot = await realpath(appDirectory);
  const entries = await readdir("/proc", { withFileTypes: true });
  const processIds: number[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/u.test(entry.name)) continue;
    const processId = Number(entry.name);
    if (processId === process.pid) continue;
    if (expectedUid !== undefined && (await processUid(processId)) !== expectedUid) continue;

    let ownsSocket = false;
    try {
      const descriptors = await readdir(`/proc/${processId}/fd`);
      for (const descriptor of descriptors) {
        try {
          const target = await readlink(`/proc/${processId}/fd/${descriptor}`);
          const match = /^socket:\[(\d+)\]$/u.exec(target);
          const inode = match?.[1];
          if (inode && inodes.has(inode)) {
            ownsSocket = true;
            break;
          }
        } catch {
          // Processes and descriptors can disappear while /proc is scanned.
        }
      }
    } catch {
      continue;
    }
    if (!ownsSocket) continue;

    try {
      const cwd = await realpath(`/proc/${processId}/cwd`);
      if (isInsideOrEqual(appRoot, cwd)) processIds.push(processId);
    } catch {
      // A process may exit between socket discovery and cwd inspection.
    }
  }

  return processIds;
}

export async function captureCommand(
  command: string,
  args: string[],
  timeoutMs = LSOF_TIMEOUT_MS,
): Promise<CapturedCommand> {
  return await new Promise((resolve) => {
    let stdout = "";
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    const child = spawn(command, args, {
      detached: usesDetachedProcessGroup(),
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const finish = (exitCode: number, timedOut: boolean): void => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      resolve({ exitCode, stdout, timedOut });
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.once("error", () => finish(127, false));
    child.once("close", (code) => finish(code ?? 1, false));
    timeout = setTimeout(() => {
      try {
        signalProcessTree(child, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
      finish(124, true);
    }, timeoutMs);
  });
}

async function cwdFromLsof(processId: number): Promise<string | undefined> {
  const result = await captureCommand("lsof", ["-b", "-a", "-p", String(processId), "-d", "cwd", "-Fn"]);
  if (result.exitCode !== 0) return undefined;
  return result.stdout.split(/\r?\n/u).find((line) => line.startsWith("n"))?.slice(1);
}

async function processIdsFromLsof(port: number, appDirectory: string): Promise<ProcessDiscovery> {
  const result = await captureCommand("lsof", [
    "-b",
    "-nP",
    "-a",
    `-iTCP:${port}`,
    "-sTCP:LISTEN",
    "-Fpu",
  ]);
  if (result.exitCode === 127) {
    return { processIds: [], diagnostic: "lsof is unavailable for port-owner discovery" };
  }
  if (result.timedOut) {
    return { processIds: [], diagnostic: `lsof exceeded its ${LSOF_TIMEOUT_MS}ms discovery timeout` };
  }
  if (result.exitCode !== 0) return { processIds: [] };

  const expectedUid = process.getuid?.();
  const candidates = new Map<number, number | undefined>();
  let currentProcessId: number | undefined;
  for (const line of result.stdout.split(/\r?\n/u)) {
    if (line.startsWith("p")) {
      const parsedProcessId = Number(line.slice(1));
      currentProcessId = Number.isSafeInteger(parsedProcessId) ? parsedProcessId : undefined;
      if (currentProcessId !== undefined) candidates.set(currentProcessId, undefined);
    } else if (line.startsWith("u") && currentProcessId !== undefined) {
      candidates.set(currentProcessId, Number(line.slice(1)));
    }
  }

  const appRoot = await realpath(appDirectory);
  const inspectedProcessIds = await Promise.all(
    [...candidates].map(async ([processId, uid]) => {
      if (processId === process.pid || (expectedUid !== undefined && uid !== expectedUid)) return undefined;
      const cwd = await cwdFromLsof(processId);
      return cwd && isInsideOrEqual(appRoot, cwd) ? processId : undefined;
    }),
  );
  const processIds = inspectedProcessIds.filter((processId): processId is number => processId !== undefined);
  return { processIds };
}

async function discoverAppOwnedListeners(port: number, appDirectory: string): Promise<ProcessDiscovery> {
  if (process.platform === "linux") {
    try {
      return { processIds: await processIdsFromProc(port, appDirectory) };
    } catch (error) {
      const fallback = await processIdsFromLsof(port, appDirectory);
      return fallback.processIds.length > 0
        ? fallback
        : { ...fallback, diagnostic: fallback.diagnostic ?? `Unable to inspect /proc: ${String(error)}` };
    }
  }
  if (process.platform === "darwin") return await processIdsFromLsof(port, appDirectory);
  return { processIds: [], diagnostic: `Port-owner discovery is unsupported on ${process.platform}` };
}

async function waitForPortToClose(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await portHasListener(port))) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

function signalProcesses(processIds: number[], signal: NodeJS.Signals): void {
  for (const processId of processIds) {
    try {
      process.kill(processId, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        console.warn(`Unable to signal app-owned listener ${processId}: ${String(error)}`);
      }
    }
  }
}

export async function reclaimAppOwnedPort(
  port: number,
  appDirectory: string,
  gracePeriodMs = 1_000,
): Promise<PortReclamation> {
  if (!(await portHasListener(port))) {
    return { attempted: false, reclaimed: true, processIds: [], diagnostic: `Port ${port} was already free` };
  }

  const discovery = await discoverAppOwnedListeners(port, appDirectory);
  if (discovery.processIds.length === 0) {
    return {
      attempted: false,
      reclaimed: false,
      processIds: [],
      diagnostic: discovery.diagnostic ?? `No same-user listener rooted in ${appDirectory} owned port ${port}`,
    };
  }

  signalProcesses(discovery.processIds, "SIGTERM");
  if (await waitForPortToClose(port, gracePeriodMs)) {
    return {
      attempted: true,
      reclaimed: true,
      processIds: discovery.processIds,
      diagnostic: `Reclaimed port ${port} after SIGTERM`,
    };
  }

  const remaining = await discoverAppOwnedListeners(port, appDirectory);
  signalProcesses(remaining.processIds, "SIGKILL");
  const reclaimed = await waitForPortToClose(port, gracePeriodMs);
  return {
    attempted: true,
    reclaimed,
    processIds: discovery.processIds,
    diagnostic: reclaimed
      ? `Reclaimed port ${port} after SIGKILL`
      : `App-owned listener still held port ${port} after cleanup`,
  };
}

export async function auditAppPortAfterPi(
  port: number,
  appDirectory: string,
  preexistingListener: boolean,
): Promise<PortReclamationAudit> {
  const listenerAfterPi = await portHasListener(port);
  if (preexistingListener) {
    return {
      preexisting_listener: true,
      listener_after_pi: listenerAfterPi,
      attempted: false,
      reclaimed: false,
      process_ids: [],
      diagnostic: `Port ${port} was occupied before Pi; reclamation was skipped`,
    };
  }
  if (!listenerAfterPi) {
    return {
      preexisting_listener: false,
      listener_after_pi: false,
      attempted: false,
      reclaimed: false,
      process_ids: [],
      diagnostic: `Port ${port} remained free after Pi`,
    };
  }

  const reclamation = await reclaimAppOwnedPort(port, appDirectory);
  return {
    preexisting_listener: false,
    listener_after_pi: true,
    attempted: reclamation.attempted,
    reclaimed: reclamation.reclaimed,
    process_ids: reclamation.processIds,
    diagnostic: reclamation.diagnostic,
  };
}

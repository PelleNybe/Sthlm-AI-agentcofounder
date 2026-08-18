import type { ChildProcess } from "node:child_process";

export function usesDetachedProcessGroup(): boolean {
  return process.platform !== "win32";
}

export function signalProcessTree(child: ChildProcess, signal: NodeJS.Signals): boolean {
  if (child.pid === undefined) return false;

  if (usesDetachedProcessGroup()) {
    try {
      process.kill(-child.pid, signal);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }

  try {
    return child.kill(signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    return false;
  }
}

export async function terminateProcessTree(child: ChildProcess, gracePeriodMs = 500): Promise<void> {
  if (!signalProcessTree(child, "SIGTERM")) return;
  await new Promise((resolve) => setTimeout(resolve, gracePeriodMs));
  signalProcessTree(child, "SIGKILL");
}

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditAppPortAfterPi, captureCommand, reclaimAppOwnedPort } from "../src/port-owner.js";
import { signalProcessTree, terminateProcessTree, usesDetachedProcessGroup } from "../src/process-tree.js";
import { portHasListener } from "../src/verify-app.js";

const temporaryDirectories: string[] = [];

async function waitForListener(port: number, expected: boolean): Promise<boolean> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    if ((await portHasListener(port)) === expected) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function getFreePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Expected a TCP address");
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("process-tree cleanup", () => {
  const processGroupTest = usesDetachedProcessGroup() ? it : it.skip;

  it("bounds an unresponsive port-owner discovery command", async () => {
    const startedAt = Date.now();
    const result = await captureCommand(
      process.execPath,
      [
        "-e",
        'const { spawn } = require("node:child_process"); spawn(process.execPath, ["-e", "setTimeout(() => {}, 10_000)"], { stdio: "inherit" }); setTimeout(() => {}, 10_000);',
      ],
      100,
    );

    expect(result).toMatchObject({ exitCode: 124, timedOut: true });
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });

  processGroupTest("reclaims a listener orphaned through Pi's double-detach topology", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-process-tree-"));
    temporaryDirectories.push(directory);
    const listenerPath = path.join(directory, "listener.cjs");
    const shellPath = path.join(directory, "shell.cjs");
    const piPath = path.join(directory, "pi.cjs");
    const listenerPidPath = path.join(directory, "listener.pid");
    const port = await getFreePort();
    await writeFile(
      listenerPath,
      'require("node:fs").writeFileSync(process.argv[3], String(process.pid)); require("node:net").createServer().listen(Number(process.argv[2]), "127.0.0.1");\n',
      "utf8",
    );
    await writeFile(
      shellPath,
      'const { spawn } = require("node:child_process"); const child = spawn(process.execPath, [process.argv[2], process.argv[3], process.argv[4]], { stdio: "ignore" }); child.unref();\n',
      "utf8",
    );
    await writeFile(
      piPath,
      'const { spawn } = require("node:child_process"); const child = spawn(process.execPath, [process.argv[2], process.argv[3], process.argv[4], process.argv[5]], { detached: true, stdio: "ignore" }); child.once("close", (code) => process.exit(code ?? 1));\n',
      "utf8",
    );

    const launcher = spawn(
      process.execPath,
      [piPath, shellPath, listenerPath, String(port), listenerPidPath],
      {
        cwd: directory,
        detached: true,
        stdio: "ignore",
      },
    );
    await new Promise<void>((resolve, reject) => {
      launcher.once("error", reject);
      launcher.once("close", (code) => (code === 0 ? resolve() : reject(new Error(`Launcher exited ${code}`))));
    });

    try {
      expect(await waitForListener(port, true)).toBe(true);
      await terminateProcessTree(launcher, 100);
      expect(await portHasListener(port)).toBe(true);

      const audit = await auditAppPortAfterPi(port, directory, false);
      expect(audit).toMatchObject({ attempted: true, reclaimed: true });
      expect(audit.process_ids).not.toHaveLength(0);
      expect(await waitForListener(port, false)).toBe(true);
    } finally {
      signalProcessTree(launcher, "SIGKILL");
      try {
        process.kill(Number(await readFile(listenerPidPath, "utf8")), "SIGKILL");
      } catch (error) {
        if (!["ENOENT", "ESRCH"].includes(String((error as NodeJS.ErrnoException).code))) throw error;
      }
    }
  });

  processGroupTest("does not reclaim a listener outside the generated app", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-port-owner-"));
    temporaryDirectories.push(directory);
    const appDirectory = path.join(directory, "app");
    const otherDirectory = path.join(directory, "other");
    await Promise.all([mkdir(appDirectory), mkdir(otherDirectory)]);
    const port = await getFreePort();
    const listener = spawn(
      process.execPath,
      ["-e", `require("node:net").createServer().listen(${port}, "127.0.0.1")`],
      { cwd: otherDirectory, detached: true, stdio: "ignore" },
    );

    try {
      expect(await waitForListener(port, true)).toBe(true);
      const reclamation = await reclaimAppOwnedPort(port, appDirectory, 100);
      expect(reclamation).toMatchObject({ attempted: false, reclaimed: false, processIds: [] });
      expect(await portHasListener(port)).toBe(true);
    } finally {
      if (listener.pid !== undefined) {
        try {
          process.kill(listener.pid, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
      }
      await waitForListener(port, false);
    }
  });

  processGroupTest("does not reclaim an app-owned listener that predates Pi", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-preexisting-listener-"));
    temporaryDirectories.push(directory);
    const port = await getFreePort();
    const listener = spawn(
      process.execPath,
      ["-e", `require("node:net").createServer().listen(${port}, "127.0.0.1")`],
      { cwd: directory, detached: true, stdio: "ignore" },
    );

    try {
      expect(await waitForListener(port, true)).toBe(true);
      const audit = await auditAppPortAfterPi(port, directory, true);
      expect(audit).toMatchObject({
        preexisting_listener: true,
        listener_after_pi: true,
        attempted: false,
        reclaimed: false,
        process_ids: [],
      });
      expect(await portHasListener(port)).toBe(true);
    } finally {
      if (listener.pid !== undefined) {
        try {
          process.kill(listener.pid, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
      }
      await waitForListener(port, false);
    }
  });
});

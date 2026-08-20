import { describe, expect, it } from "vitest";
import { auditAppPortAfterPi, captureCommand, reclaimAppOwnedPort } from "../src/port-owner.js";
import { portHasListener } from "../src/verify-app.js";
import net from "node:net";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

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

describe("port-owner", () => {
  describe("captureCommand", () => {
    it("captures stdout and returns success exit code", async () => {
      const result = await captureCommand(process.execPath, ["-e", "console.log('hello')"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("hello\n");
      expect(result.timedOut).toBe(false);
    });

    it("returns correct exit code for failing commands", async () => {
      const result = await captureCommand(process.execPath, ["-e", "process.exit(42)"]);
      expect(result.exitCode).toBe(42);
      expect(result.timedOut).toBe(false);
    });

    it("times out and kills the process if it exceeds the timeout", async () => {
      const startedAt = Date.now();
      const result = await captureCommand(
        process.execPath,
        ["-e", "setTimeout(() => {}, 10000)"],
        100
      );
      expect(result.exitCode).toBe(124);
      expect(result.timedOut).toBe(true);
      expect(Date.now() - startedAt).toBeLessThan(2000);
    });

    it("handles non-existent commands gracefully", async () => {
      const result = await captureCommand("this-command-does-not-exist-12345", []);
      expect(result.exitCode).toBe(127);
      expect(result.timedOut).toBe(false);
    });
  });

  describe("reclaimAppOwnedPort", () => {
    it("returns immediately if the port has no listener", async () => {
      const port = await getFreePort();
      const result = await reclaimAppOwnedPort(port, "/non/existent/path");
      expect(result).toMatchObject({
        attempted: false,
        reclaimed: true,
        processIds: [],
        diagnostic: `Port ${port} was already free`,
      });
    });

    it("does not reclaim if the listener is outside the app directory", async () => {
      const port = await getFreePort();
      const server = net.createServer();
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen({ host: "127.0.0.1", port }, resolve);
      });
      const otherDirectory = await mkdtemp(path.join(os.tmpdir(), "port-owner-test-outside-"));
      try {
        const result = await reclaimAppOwnedPort(port, otherDirectory);
        expect(result.attempted).toBe(false);
        expect(result.reclaimed).toBe(false);
        expect(result.processIds).toHaveLength(0);
        expect(result.diagnostic).toMatch(/No same-user listener rooted in/);
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
        await rm(otherDirectory, { recursive: true, force: true });
      }
    });

    it("reclaims the port if a child process listening on the port is spawned in the app directory", async () => {
      const port = await getFreePort();
      const appDirectory = await mkdtemp(path.join(os.tmpdir(), "port-owner-test-"));

      const child = spawn(
        process.execPath,
        ["-e", `const net = require('net'); const server = net.createServer(); server.listen({ host: '127.0.0.1', port: ${port} }, () => { console.log('ready'); }); setTimeout(() => {}, 10000);`],
        { cwd: appDirectory, stdio: ["ignore", "pipe", "ignore"] }
      );

      await new Promise<void>((resolve) => {
        child.stdout.once("data", () => resolve());
      });

      try {
        const hasListener = await portHasListener(port);
        expect(hasListener).toBe(true);

        const result = await reclaimAppOwnedPort(port, appDirectory, 1000);
        expect(result.attempted).toBe(true);
        expect(result.reclaimed).toBe(true);
        expect(result.processIds).toContain(child.pid);
        expect(result.diagnostic).toMatch(/Reclaimed port/);
      } finally {
        try {
          process.kill(child.pid as number, 0);
          child.kill("SIGKILL");
        } catch {}
        await rm(appDirectory, { recursive: true, force: true });
      }
    });

    it("tries SIGKILL if SIGTERM fails to close the port", async () => {
      const port = await getFreePort();
      const appDirectory = await mkdtemp(path.join(os.tmpdir(), "port-owner-test-"));

      const child = spawn(
        process.execPath,
        ["-e", `const net = require('net'); process.on('SIGTERM', () => { /* Ignore SIGTERM */ }); const server = net.createServer(); server.listen({ host: '127.0.0.1', port: ${port} }, () => { console.log('ready'); }); setTimeout(() => {}, 10000);`],
        { cwd: appDirectory, stdio: ["ignore", "pipe", "ignore"] }
      );

      await new Promise<void>((resolve) => {
        child.stdout.once("data", () => resolve());
      });

      try {
        const hasListener = await portHasListener(port);
        expect(hasListener).toBe(true);

        const result = await reclaimAppOwnedPort(port, appDirectory, 500); // Wait 500ms for SIGTERM to fail
        expect(result.attempted).toBe(true);
        // It should be reclaimed by SIGKILL eventually
        expect(result.reclaimed).toBe(true);
        expect(result.processIds).toContain(child.pid);
        expect(result.diagnostic).toMatch(/Reclaimed port .* after SIGKILL/);
      } finally {
        try {
          process.kill(child.pid as number, 0);
          child.kill("SIGKILL");
        } catch {}
        await rm(appDirectory, { recursive: true, force: true });
      }
    });
  });

  describe("auditAppPortAfterPi", () => {
    it("returns preexisting_listener early if preexistingListener is true", async () => {
      const port = await getFreePort();
      const server = net.createServer();
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen({ host: "127.0.0.1", port }, resolve);
      });

      try {
        const result = await auditAppPortAfterPi(port, "/some/path", true);
        expect(result).toMatchObject({
          preexisting_listener: true,
          listener_after_pi: true,
          attempted: false,
          reclaimed: false,
          process_ids: [],
        });
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("returns free early if preexistingListener is false and no listener is present", async () => {
      const port = await getFreePort();
      const result = await auditAppPortAfterPi(port, "/some/path", false);
      expect(result).toMatchObject({
        preexisting_listener: false,
        listener_after_pi: false,
        attempted: false,
        reclaimed: false,
        process_ids: [],
      });
    });

    it("reclaims port and returns appropriate audit object when a listener is present and preexistingListener is false", async () => {
      const port = await getFreePort();
      const appDirectory = await mkdtemp(path.join(os.tmpdir(), "port-owner-test-"));

      const child = spawn(
        process.execPath,
        ["-e", `const net = require('net'); const server = net.createServer(); server.listen({ host: '127.0.0.1', port: ${port} }, () => { console.log('ready'); }); setTimeout(() => {}, 10000);`],
        { cwd: appDirectory, stdio: ["ignore", "pipe", "ignore"] }
      );

      await new Promise<void>((resolve) => {
        child.stdout.once("data", () => resolve());
      });

      try {
        const result = await auditAppPortAfterPi(port, appDirectory, false);
        expect(result.preexisting_listener).toBe(false);
        expect(result.listener_after_pi).toBe(true);
        expect(result.attempted).toBe(true);
        expect(result.reclaimed).toBe(true);
        expect(result.process_ids).toContain(child.pid);
      } finally {
        try {
          process.kill(child.pid as number, 0);
          child.kill("SIGKILL");
        } catch {}
        await rm(appDirectory, { recursive: true, force: true });
      }
    });
  });
});

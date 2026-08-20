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
  });
});

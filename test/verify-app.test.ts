import { cp, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { portHasListener, verifyGeneratedApp } from "../src/verify-app.js";

const temporaryDirectories: string[] = [];
const defaultPortOccupied = await portHasListener(3000);
if (defaultPortOccupied) {
  console.warn("Skipping the bare production dev-command test because port 3000 already has a listener.");
}
const defaultPortTest = defaultPortOccupied ? it.skip : it;

async function hasIpv6Loopback(): Promise<boolean> {
  const server = net.createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen({ host: "::1", port: 0, ipv6Only: true }, resolve);
    });
    return true;
  } catch {
    return false;
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
}

const ipv6LoopbackAvailable = await hasIpv6Loopback();
if (!ipv6LoopbackAvailable) console.warn("Skipping IPv6-only port ownership test: ::1 is unavailable.");
const ipv6Test = ipv6LoopbackAvailable ? it : it.skip;

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

async function createTestApp(testSource?: string): Promise<{ appDirectory: string; artifactDirectory: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-passing-app-"));
  temporaryDirectories.push(root);
  const appDirectory = path.join(root, "app");
  const seedDirectory = path.resolve("app-template");
  await cp(seedDirectory, appDirectory, {
    recursive: true,
    filter: (source) => !source.split(path.sep).includes("node_modules") && !source.endsWith(`${path.sep}dist`),
  });
  await symlink(path.join(seedDirectory, "node_modules"), path.join(appDirectory, "node_modules"), "dir");
  await writeFile(
    path.join(appDirectory, "src", "generated.test.tsx"),
    testSource ?? [
      'import { useState } from "react";',
      'import { render, screen } from "@testing-library/react";',
      'import userEvent from "@testing-library/user-event";',
      'import { describe, expect, it } from "vitest";',
      "",
      "function Smoke() {",
      "  const [count, setCount] = useState(0);",
      '  return <button type="button" onClick={() => setCount((value) => value + 1)}>Count {count}</button>;',
      "}",
      "",
      'describe("generated journey", () => {',
      '  it("uses the configured DOM and matcher setup", async () => {',
      "    const user = userEvent.setup();",
      "    render(<Smoke />);",
      '    await user.click(screen.getByRole("button", { name: "Count 0" }));',
      '    expect(screen.getByRole("button", { name: "Count 1" })).toHaveTextContent("Count 1");',
      "  });",
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  const artifactDirectory = path.join(root, "artifacts");
  await mkdir(artifactDirectory);
  return { appDirectory, artifactDirectory };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("app verification", () => {
  it("detects a listener bound to the wildcard address", async () => {
    const server = net.createServer((socket) => socket.end());
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen({ host: "0.0.0.0", port: 0 }, resolve);
    });
    try {
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("Expected a TCP address");
      expect(await portHasListener(address.port)).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("returns failed checks instead of throwing when commands and logs cannot be created", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-verification-"));
    temporaryDirectories.push(root);
    const appDirectory = path.join(root, "app");
    await mkdir(appDirectory);

    const result = await verifyGeneratedApp(appDirectory, path.join(root, "missing", "artifacts"), {
      commandTimeoutMs: 1_000,
      serverTimeoutMs: 1_000,
      npmCommand: "missing-agent-cofounder-npm",
      vitestCommand: "missing-agent-cofounder-vitest",
      port: await getFreePort(),
    });

    expect(result.passed).toBe(false);
    expect(result.checks).toHaveLength(3);
    expect(result.checks.every((entry) => entry.result !== "passed")).toBe(true);
  });

  it("rejects the untouched zero-test seed while confirming that it builds and serves", async () => {
    const artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-seed-check-"));
    temporaryDirectories.push(artifactDirectory);

    const result = await verifyGeneratedApp(path.resolve("app-template"), artifactDirectory, {
      commandTimeoutMs: 30_000,
      serverTimeoutMs: 10_000,
      port: await getFreePort(),
    });

    expect(result.passed).toBe(false);
    expect(result.checks.map((entry) => entry.result)).toEqual(["failed", "passed", "passed"]);
  }, 45_000);

  it("never accepts HTTP from a server that already owned the configured port", async () => {
    let requests = 0;
    const squatter = http.createServer((_request, response) => {
      requests += 1;
      response.end("not the generated app");
    });
    await new Promise<void>((resolve, reject) => {
      squatter.once("error", reject);
      squatter.listen({ host: "0.0.0.0", port: 0 }, resolve);
    });
    const address = squatter.address();
    if (address === null || typeof address === "string") throw new Error("Expected a TCP address");

    const artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-port-check-"));
    temporaryDirectories.push(artifactDirectory);
    try {
      const result = await verifyGeneratedApp(path.resolve("app-template"), artifactDirectory, {
        commandTimeoutMs: 30_000,
        serverTimeoutMs: 2_000,
        port: address.port,
      });

      expect(result.checks[2]?.result).toBe("failed");
      expect(requests).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        squatter.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }, 45_000);

  ipv6Test("never accepts HTTP from an IPv6-only server that already owned the configured port", async () => {
    let requests = 0;
    const squatter = http.createServer((_request, response) => {
      requests += 1;
      response.end("not the generated app");
    });
    await new Promise<void>((resolve, reject) => {
      squatter.once("error", reject);
      squatter.listen({ host: "::1", port: 0, ipv6Only: true }, resolve);
    });
    const address = squatter.address();
    if (address === null || typeof address === "string") throw new Error("Expected a TCP address");

    const artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "agent-cofounder-ipv6-port-check-"));
    temporaryDirectories.push(artifactDirectory);
    try {
      expect(await portHasListener(address.port)).toBe(true);
      const result = await verifyGeneratedApp(path.resolve("app-template"), artifactDirectory, {
        commandTimeoutMs: 30_000,
        serverTimeoutMs: 2_000,
        port: address.port,
      });

      expect(result.checks[2]?.result).toBe("failed");
      expect(requests).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        squatter.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }, 45_000);

  it("passes a generated app with participant-authored tests, a build, and its own server", async () => {
    const { appDirectory, artifactDirectory } = await createTestApp();
    const port = await getFreePort();

    const result = await verifyGeneratedApp(appDirectory, artifactDirectory, {
      commandTimeoutMs: 30_000,
      displayRoot: path.dirname(appDirectory),
      serverTimeoutMs: 10_000,
      port,
    });

    expect(result.passed).toBe(true);
    expect(result.checks.map((entry) => entry.result)).toEqual(["passed", "passed", "passed"]);
    expect(result.checks[0]?.command).toContain("--outputFile=");
    expect(result.checks[0]?.command).toContain(path.join("app", "node_modules", ".bin", "vitest"));
    const displayedReportPath = result.checks[0]?.command.split("--outputFile=")[1]?.split(" ")[0];
    expect(displayedReportPath).toBe(path.join("artifacts", "app-test-results.json"));
  }, 45_000);

  it("rejects a Vitest report containing only todo tests", async () => {
    const { appDirectory, artifactDirectory } = await createTestApp(
      ['import { it } from "vitest";', '', 'it.todo("implements a user journey");', ''].join("\n"),
    );

    const result = await verifyGeneratedApp(appDirectory, artifactDirectory, {
      commandTimeoutMs: 30_000,
      serverTimeoutMs: 10_000,
      port: await getFreePort(),
    });

    expect(result.passed).toBe(false);
    expect(result.checks.map((entry) => entry.result)).toEqual(["failed", "passed", "passed"]);
  }, 45_000);

  defaultPortTest("exercises the bare production dev command on port 3000", async () => {
    const { appDirectory, artifactDirectory } = await createTestApp();
    const result = await verifyGeneratedApp(appDirectory, artifactDirectory, {
      commandTimeoutMs: 30_000,
      serverTimeoutMs: 10_000,
    });

    expect(result.passed).toBe(true);
    expect(result.checks[2]).toMatchObject({ command: "npm run dev", result: "passed" });
  }, 45_000);

  it("keeps verification verdicts independent from audit-log writes", async () => {
    const { appDirectory, artifactDirectory } = await createTestApp();
    await Promise.all([
      writeFile(path.join(artifactDirectory, "app-test.log"), "existing\n", "utf8"),
      writeFile(path.join(artifactDirectory, "app-build.log"), "existing\n", "utf8"),
      writeFile(path.join(artifactDirectory, "app-dev.log"), "existing\n", "utf8"),
    ]);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const result = await verifyGeneratedApp(appDirectory, artifactDirectory, {
        commandTimeoutMs: 30_000,
        serverTimeoutMs: 10_000,
        port: await getFreePort(),
      });

      expect(result.passed).toBe(true);
      expect(result.checks.map((entry) => entry.result)).toEqual(["passed", "passed", "passed"]);
      expect(result.checks[0]?.command).toContain("--outputFile=app-test-results.json");
      expect(warning).toHaveBeenCalledTimes(3);
    } finally {
      warning.mockRestore();
    }
  }, 45_000);
});

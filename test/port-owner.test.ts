import { describe, expect, it, vi, afterEach } from "vitest";
import { captureCommand, auditAppPortAfterPi, reclaimAppOwnedPort } from "../src/port-owner.js";
import * as verifyApp from "../src/verify-app.js";

vi.mock("../src/verify-app.js", () => ({
  portHasListener: vi.fn(),
  waitForPortListener: vi.fn(),
}));

describe("port-owner", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("captureCommand", () => {
    it("should capture basic command execution", async () => {
      const result = await captureCommand("echo", ["hello"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("hello");
      expect(result.timedOut).toBe(false);
    });

    it("should handle command timeout", async () => {
      const result = await captureCommand("sleep", ["2"], 100);
      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
    });

    it("should handle non-existent commands", async () => {
      const result = await captureCommand("this-command-does-not-exist-12345", []);
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe("auditAppPortAfterPi", () => {
    it("should return early if there was a preexisting listener", async () => {
      vi.mocked(verifyApp.portHasListener).mockResolvedValue(true);

      const result = await auditAppPortAfterPi(3000, "/tmp/app", true);

      expect(result.preexisting_listener).toBe(true);
      expect(result.listener_after_pi).toBe(true);
      expect(result.attempted).toBe(false);
      expect(result.reclaimed).toBe(false);
      expect(result.process_ids).toEqual([]);
      expect(result.diagnostic).toContain("occupied before Pi");
    });

    it("should return early if there is no listener after Pi", async () => {
      vi.mocked(verifyApp.portHasListener).mockResolvedValue(false);

      const result = await auditAppPortAfterPi(3000, "/tmp/app", false);

      expect(result.preexisting_listener).toBe(false);
      expect(result.listener_after_pi).toBe(false);
      expect(result.attempted).toBe(false);
      expect(result.reclaimed).toBe(false);
      expect(result.process_ids).toEqual([]);
      expect(result.diagnostic).toContain("remained free");
    });

    it("should attempt reclamation if listener appeared after Pi", async () => {
      vi.mocked(verifyApp.portHasListener).mockResolvedValue(true);
      const result = await auditAppPortAfterPi(3000, "/tmp/app", false);

      expect(result.preexisting_listener).toBe(false);
      expect(result.listener_after_pi).toBe(true);

      expect(result.process_ids).toEqual([]);
      expect(result.attempted).toBe(false);
      expect(result.reclaimed).toBe(false);
      expect(result.diagnostic).toContain("No same-user listener");
    });
  });

  describe("reclaimAppOwnedPort", () => {
    it("should return early if the port has no listener", async () => {
      vi.mocked(verifyApp.portHasListener).mockResolvedValue(false);

      const result = await reclaimAppOwnedPort(3000, "/tmp/app");

      expect(result.attempted).toBe(false);
      expect(result.reclaimed).toBe(true);
      expect(result.processIds).toEqual([]);
      expect(result.diagnostic).toContain("already free");
    });

    it("should fail to reclaim if no matching processes are found", async () => {
      vi.mocked(verifyApp.portHasListener).mockResolvedValue(true);

      const result = await reclaimAppOwnedPort(3000, "/tmp/app");

      expect(result.attempted).toBe(false);
      expect(result.reclaimed).toBe(false);
      expect(result.processIds).toEqual([]);
      expect(result.diagnostic).toContain("No same-user listener");
    });
  });
});

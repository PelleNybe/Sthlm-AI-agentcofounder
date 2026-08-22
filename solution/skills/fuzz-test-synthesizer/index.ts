import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs/promises";
import path from "node:path";

export default function fuzzTestSkill(pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    try {
      const workspaceDir = process.cwd();
      const testDir = path.join(workspaceDir, "src", "test-utils");

      await fs.mkdir(testDir, { recursive: true });

      const fuzzContent = `export function generateRandomString(length: number): string {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function corruptLocalStorage(key: string): void {
  localStorage.setItem(key, '{ invalid json: "data" }');
}

export function generateBoundaryNumbers(): number[] {
  return [0, -1, 1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, NaN, Infinity, -Infinity];
}
`;
      await fs.writeFile(path.join(testDir, "fuzz.ts"), fuzzContent, "utf8");
    } catch (e) {
      console.error("Failed to scaffold fuzz test utils:", e);
    }
  });
}

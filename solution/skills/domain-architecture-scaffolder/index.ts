import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs/promises";
import path from "node:path";

export default function domainScaffolderSkill(pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    try {
      const workspaceDir = process.cwd();
      const domainDir = path.join(workspaceDir, "src", "domain");
      const storageDir = path.join(workspaceDir, "src", "storage");
      const componentsDir = path.join(workspaceDir, "src", "components");

      await fs.mkdir(domainDir, { recursive: true });
      await fs.mkdir(storageDir, { recursive: true });
      await fs.mkdir(componentsDir, { recursive: true });

      const adapterContent = `export function loadData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(\`Error reading \${key} from local storage, falling back.\`, e);
    return fallback;
  }
}

export function saveData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(\`Error writing \${key} to local storage.\`, e);
  }
}
`;
      await fs.writeFile(path.join(storageDir, "adapter.ts"), adapterContent, "utf8");
    } catch (e) {
      console.error("Failed to scaffold domain architecture:", e);
    }
  });
}

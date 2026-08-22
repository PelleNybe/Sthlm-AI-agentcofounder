import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function executeSelfRepairLoop(workspaceDir: string): Promise<{ passed: boolean; output: string }> {
  try {
    const { stdout: testOut, stderr: testErr } = await execAsync("npm run test", { cwd: workspaceDir });
    const { stdout: buildOut, stderr: buildErr } = await execAsync("npm run build", { cwd: workspaceDir });
    return { passed: true, output: "Tests and build passed successfully." };
  } catch (error: any) {
    return { passed: false, output: (error.stdout || "") + "\n" + (error.stderr || "") };
  }
}

export default function selfRepairSkill(pi: ExtensionAPI) {
  let retryCount = 0;
  const MAX_RETRIES = 3;

  pi.on("tool_call", async (event, context) => {
    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = String((event.input as Record<string, unknown>).path ?? "");
      if (filePath.endsWith("report.partial.json")) {
        // Agent is attempting to complete the task
        const workspaceDir = process.cwd();
        const { passed, output } = await executeSelfRepairLoop(workspaceDir);

        if (!passed) {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            if (context.hasUI) {
              context.ui.notify(`Self-repair loop triggered (Attempt ${retryCount}/${MAX_RETRIES})`, "warning");
            }
            return {
              block: true,
              reason: `Self-repair loop activated because tests or build failed.\n\nError Output:\n${output}\n\nPlease fix the code so tests and build pass before writing report.partial.json.`
            };
          } else {
            if (context.hasUI) {
              context.ui.notify("Self-repair loop max retries reached.", "error");
            }
            // Allow it to write and fail the evaluation
          }
        }
      }
    }
  });
}

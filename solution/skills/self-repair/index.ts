import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function executeSelfRepairLoop(workspaceDir: string): Promise<{ passed: boolean; output: string }> {
  try {
    let output = "";

    // Check tests
    try {
      const { stdout: testOut, stderr: testErr } = await execAsync("npm run test", { cwd: workspaceDir });
      output += testOut + "\n" + testErr + "\n";
    } catch (e: any) {
      const errOut = (e.stdout || "") + "\n" + (e.stderr || "") + "\n" + (e.message || "");
      // Prune long stack traces slightly to fit context limits nicely, but preserve vitest error lines
      const cleanErr = errOut.length > 3000 ? errOut.slice(errOut.length - 3000) : errOut;
      return { passed: false, output: `Test failed:\n${cleanErr}` };
    }

    // Check build
    try {
      const { stdout: buildOut, stderr: buildErr } = await execAsync("npm run build", { cwd: workspaceDir });
      output += buildOut + "\n" + buildErr + "\n";
    } catch (e: any) {
      const errOut = (e.stdout || "") + "\n" + (e.stderr || "") + "\n" + (e.message || "");
      const cleanErr = errOut.length > 3000 ? errOut.slice(errOut.length - 3000) : errOut;
      return { passed: false, output: `Build failed (TypeScript/Vite compilation errors):\n${cleanErr}` };
    }

    return { passed: true, output: "Tests and build passed successfully." };
  } catch (error: any) {
    const errOut = (error.stdout || "") + "\n" + (error.stderr || "") + "\n" + (error.message || "");
    return { passed: false, output: `Unexpected verification loop error:\n${errOut}` };
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
              reason: `Self-repair loop activated because the application's tests or build verification failed.\n\nError Output:\n${output}\n\nDo not write \`report.partial.json\` yet. You must first fix the code causing these errors so \`npm run test\` and \`npm run build\` pass.`
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

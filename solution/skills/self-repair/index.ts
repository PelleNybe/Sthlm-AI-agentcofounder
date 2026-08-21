import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Executes a targeted self-repair loop by running tests and build.
 * Not meant to be directly called by the LLM as a tool but this sets the stage
 * for future integration if direct programmatic hooks are needed by the PI framework.
 */
export async function executeSelfRepairLoop(workspaceDir: string) {
  let testsPass = false;
  let buildPass = false;
  let attempts = 0;
  const maxAttempts = 3;

  while ((!testsPass || !buildPass) && attempts < maxAttempts) {
    attempts++;
    console.log(`[Self-Repair] Attempt ${attempts}...`);
    try {
      await execAsync("npm test", { cwd: workspaceDir });
      testsPass = true;
    } catch (testError) {
      console.error("[Self-Repair] Tests failed:", testError);
      // In a fully programmatic setup, we'd feed this back to the LLM agent here.
      // Currently, the prompt instructions handle the loop.
      throw testError;
    }

    try {
      await execAsync("npm run build", { cwd: workspaceDir });
      buildPass = true;
    } catch (buildError) {
      console.error("[Self-Repair] Build failed:", buildError);
      throw buildError;
    }
  }
}

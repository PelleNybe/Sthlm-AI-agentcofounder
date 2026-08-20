import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");

async function main(): Promise<void> {
  console.log("\n========================================================");
  console.log(" 🚀 AgentCofounder Hackathon Benchmark & Trace Dashboard");
  console.log("========================================================\n");

  const resultPath = path.join(REPOSITORY_ROOT, "result.json");
  const tracePath = path.join(REPOSITORY_ROOT, "trace.jsonl");

  try {
    const resultData = JSON.parse(await readFile(resultPath, "utf8"));
    console.log("📊 RESULT METRICS:");
    console.log(` - Status:             ${resultData.status?.toUpperCase()}`);
    console.log(` - App URL:            ${resultData.app_url}`);
    console.log(` - Model Calls:        ${resultData.model_calls}`);
    console.log(` - Input Tokens:       ${resultData.input_tokens}`);
    console.log(` - Output Tokens:      ${resultData.output_tokens} (3x penalty weight)`);
    console.log(` - Cache Read Tokens:  ${resultData.cache_read_tokens} (0.1x weight)`);

    const efficiencyScore =
      (resultData.input_tokens || 0) +
      (resultData.output_tokens || 0) * 3 +
      (resultData.cache_read_tokens || 0) * 0.1;
    console.log(` - Calculated Cost Score: ${efficiencyScore.toFixed(1)}`);
  } catch {
    console.log("⚠️ No result.json found. Run `npm run challenge` first.");
  }

  try {
    const traceLines = (await readFile(tracePath, "utf8")).trim().split("\n");
    console.log("\n🔍 EXECUTION TRACE LOG (trace.jsonl):");
    for (const line of traceLines) {
      if (line) {
        const step = JSON.parse(line);
        console.log(` [Step ${step.step}] Agent: ${step.agent.padEnd(8)} | Action: ${step.action.padEnd(25)} | Status: ${step.status}`);
      }
    }
  } catch {
    console.log("⚠️ No trace.jsonl found.");
  }

  console.log("\n========================================================\n");
}

main().catch(console.error);

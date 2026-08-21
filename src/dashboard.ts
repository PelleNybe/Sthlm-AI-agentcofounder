import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");

async function main(): Promise<void> {
  console.log("\x1b[36m\n========================================================");
  console.log(" 🚀 AgentCofounder Hackathon Benchmark & Trace Dashboard");
  console.log("========================================================\x1b[0m\n");

  const resultPath = path.join(REPOSITORY_ROOT, "result.json");
  const tracePath = path.join(REPOSITORY_ROOT, "trace.jsonl");

  try {
    const resultData = JSON.parse(await readFile(resultPath, "utf8"));
    console.log("\x1b[32m📊 RESULT METRICS:\x1b[0m");
    console.log(` - \x1b[1mStatus:\x1b[0m             ${resultData.status?.toUpperCase() === 'SUCCESS' ? '\x1b[32m' + resultData.status?.toUpperCase() + '\x1b[0m' : '\x1b[31m' + resultData.status?.toUpperCase() + '\x1b[0m'}`);
    console.log(` - \x1b[1mApp URL:\x1b[0m            ${resultData.app_url}`);
    console.log(` - \x1b[1mModel Calls:\x1b[0m        ${resultData.model_calls}`);
    console.log(` - \x1b[1mInput Tokens:\x1b[0m       ${resultData.input_tokens}`);
    console.log(` - \x1b[1mOutput Tokens:\x1b[0m      ${resultData.output_tokens} (3x penalty weight)`);
    console.log(` - \x1b[1mCache Read Tokens:\x1b[0m  ${resultData.cache_read_tokens} (0.1x weight)`);

    const efficiencyScore =
      (resultData.input_tokens || 0) +
      (resultData.output_tokens || 0) * 3 +
      (resultData.cache_read_tokens || 0) * 0.1;
    console.log(` - \x1b[1mCalculated Cost Score:\x1b[0m \x1b[33m${efficiencyScore.toFixed(1)}\x1b[0m`);

    if (resultData.port_reclamation && resultData.port_reclamation.listener_after_pi) {
      console.log(`\n\x1b[33m⚠️ PORT RECLAMATION INFO:\x1b[0m`);
      console.log(` - Diagnostic: ${resultData.port_reclamation.diagnostic}`);
    }

  } catch {
    console.log("\x1b[31m⚠️ No result.json found. Run `npm run challenge` first.\x1b[0m");
  }

  try {
    const traceLines = (await readFile(tracePath, "utf8")).trim().split("\n");
    console.log("\n\x1b[32m🔍 EXECUTION TRACE LOG (trace.jsonl):\x1b[0m");
    for (const line of traceLines) {
      if (line) {
        const step = JSON.parse(line);
        const statusColor = step.status === 'SUCCESS' ? '\x1b[32m' : '\x1b[31m';
        console.log(` [Step ${String(step.step).padStart(2, '0')}] Agent: \x1b[36m${step.agent.padEnd(8)}\x1b[0m | Action: ${step.action.padEnd(25)} | Status: ${statusColor}${step.status}\x1b[0m`);
      }
    }
  } catch {
    console.log("\x1b[31m⚠️ No trace.jsonl found.\x1b[0m");
  }

  console.log("\x1b[36m\n========================================================\x1b[0m\n");
}

main().catch(console.error);

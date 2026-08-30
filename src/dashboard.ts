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
    console.log(` - \x1b[1mApp URL:\x1b[0m            ${resultData.app_url || 'N/A'}`);
    console.log(` - \x1b[1mModel Calls:\x1b[0m        ${resultData.model_calls || 0}`);
    console.log(` - \x1b[1mInput Tokens:\x1b[0m       ${(resultData.input_tokens || 0).toLocaleString()}`);
    console.log(` - \x1b[1mOutput Tokens:\x1b[0m      ${(resultData.output_tokens || 0).toLocaleString()} \x1b[90m(3x penalty weight)\x1b[0m`);
    console.log(` - \x1b[1mCache Read Tokens:\x1b[0m  ${(resultData.cache_read_tokens || 0).toLocaleString()} \x1b[90m(0.1x weight)\x1b[0m`);

    const efficiencyScore =
      (resultData.input_tokens || 0) +
      (resultData.output_tokens || 0) * 3 +
      (resultData.cache_read_tokens || 0) * 0.1;
    console.log(` - \x1b[1mCalculated Cost Score:\x1b[0m \x1b[33m${efficiencyScore.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\x1b[0m`);

    console.log(`\n\x1b[35m🛠️  HARNESS CHECKS:\x1b[0m`);
    if (resultData.harness_checks) {
      console.log(` - Vitest Complete:    ${resultData.harness_checks.vitest_complete ? '✅' : '❌'}`);
      console.log(` - All Tests Passing:  ${resultData.harness_checks.all_tests_passing ? '✅' : '❌'}`);
      console.log(` - No Todo/Skipped:    ${resultData.harness_checks.no_todo_skipped_tests ? '✅' : '❌'}`);
      console.log(` - Build Complete:     ${resultData.harness_checks.build_complete ? '✅' : '❌'}`);
      console.log(` - Start Complete:     ${resultData.harness_checks.start_complete ? '✅' : '❌'}`);
      console.log(` - Verified Alive:     ${resultData.harness_checks.verified_alive ? '✅' : '❌'}`);
    } else {
      console.log(` - No harness checks available.`);
    }

    if (resultData.port_reclamation && resultData.port_reclamation.listener_after_pi) {
      console.log(`\n\x1b[33m⚠️ PORT RECLAMATION INFO:\x1b[0m`);
      console.log(` - Diagnostic: ${resultData.port_reclamation.diagnostic}`);
    }

  } catch {
    console.log("\x1b[31m⚠️ No result.json found. Run `npm run challenge` first.\x1b[0m");
  }

  try {
    const traceContent = await readFile(tracePath, "utf8");
    const traceLines = traceContent.trim().split("\n");
    console.log("\n\x1b[32m🔍 EXECUTION TRACE LOG (trace.jsonl):\x1b[0m");
    for (const line of traceLines) {
      if (line) {
        try {
          const step = JSON.parse(line);
          const statusColor = step.status === 'SUCCESS' ? '\x1b[32m' : '\x1b[31m';
          const fileInfo = step.files ? ` \x1b[90m[Files Mod: ${step.files}]\x1b[0m` : '';
          console.log(` [Step ${String(step.step).padStart(2, '0')}] Agent: \x1b[36m${(step.agent || 'unknown').padEnd(8)}\x1b[0m | Action: ${(step.action || 'unknown').padEnd(25)} | Status: ${statusColor}${(step.status || 'UNKNOWN')}\x1b[0m${fileInfo}`);
        } catch {
          // ignore malformed trace lines
        }
      }
    }
  } catch {
    console.log("\x1b[31m⚠️ No trace.jsonl found.\x1b[0m");
  }

  console.log("\x1b[36m\n========================================================\x1b[0m\n");
}

main().catch(console.error);

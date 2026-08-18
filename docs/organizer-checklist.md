# Organizer checklist

## Before publishing

- Create a private project for each team from this template; avoid a public fork network.
- Remove every hidden prompt, journey, selector, threshold, screenshot, and expected answer from participant-visible material.
- Replace `contract-public/development-idea.txt` with the finalized public prompt; do not distribute the committed development placeholder to participants.
- Publish the exact runtime image digest, Node version, Pi version, model identifier, thinking level, timeout, and network policy.
- Decide and publish the cache-write token weight.
- Decide whether ranking uses the custom weighted-token formula or Pi's provider cost. Do not describe both as authoritative.
- Define `total_tokens` as Pi's `usage.totalTokens`, which includes fresh input, output, cache reads, and cache writes.
- Require the Pi session JSONL and raw JSON event stream as audit artifacts.

## Freeze procedure

1. Record the participant commit SHA at the deadline.
2. Build it in the organizer-controlled runtime using `npm ci --ignore-scripts`.
3. Verify the installed Pi package reports `0.84.1`.
4. Confirm the pinned organizer provider/model appears in Pi's offline model catalogue before the timed run.
5. Run one credentialed submission against the finalized public prompt committed at `contract-public/development-idea.txt` through the complete success path.
   - Confirm `pi_exit_code` is `0`, `status` is `success`, and `model_calls` is greater than zero.
   - Inspect `port_reclamation` and investigate any run where cleanup was attempted or a listener predated Pi.
   - Validate both `output/app/result.json` and the repository-root `result.json`; confirm only their location-aware `start_command` values differ, and execute each command from its result directory.
   - Recompute every headline token and cost total from `call_log` and confirm it reconciles.
   - Confirm a non-empty Pi session JSONL and raw event stream land under the run artifact directory.
6. Run the unchanged commit against the hidden prompt in a new isolated environment.

## Judge boundary

- Pass the hidden idea as the `--idea-file` input; do not mount hidden test sources into the participant workspace.
- Provide a short-lived model credential scoped to the designated gateway and model.
- Block instance metadata, internal networks, and unrelated outbound network access.
- Enforce wall-clock and process-tree termination outside the participant process.
- Mount the harness, public contract, validator, and result schema read-only. Give the process write access only to the generated app, artifact directory, and a dedicated repository-root `result.json` target; both result destinations are required.
- Run hidden browser tests from a separate process or container.
- When the browser judge is outside the app container, publish port 3000 (for example, `-p 3000:3000`) or attach both processes to the same isolated container network.
- Recompute telemetry from the captured Pi session and gateway records.
- Treat disagreement between participant telemetry, Pi session telemetry, and gateway telemetry as a failed audit.
- Preserve stdout, stderr, sessions, result, app source, test results, runtime image digest, and commit SHA.

## Publication warning

The working challenge specification must be split into a public participant document and a private judge document. The draft specification includes the supposedly hidden idea and its eight hidden journeys and must not be distributed unchanged.

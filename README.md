# AgentCofounder starter

A forkable baseline for the AgentCofounder challenge. It gives every team the same pinned Pi runtime, neutral web application seed, execution command, telemetry collector, and public contract while leaving the actual agent strategy participant-owned.

This repository installs Pi as a local dependency at exactly `@earendil-works/pi-coding-agent@0.84.1`. Do not use the floating shell installer and do not run `pi update` during the challenge.

## Repository boundary

- `solution/` is the main participant surface: change the prompt, extension, skill, or replace the runner strategy.
- `app-template/` is the neutral application seed copied into a fresh generated workspace for every run.
- `contract-public/` contains the replaceable public idea, domain-neutral journey guidance, and the result schema.
- `src/` is the baseline runner and auditable result assembly.
- `output/app/` is disposable generated application code and is reset before every run.
- `artifacts/runs/` contains Pi JSON events, session JSONL files, stderr, and the run input.

Official hidden prompts, hidden tests, model credentials, and final scoring code must remain outside participant repositories.

> **Organizer release requirement:** `contract-public/development-idea.txt` is a development placeholder. Replace it with the finalized public prompt before sharing this repository with participants. Never place hidden judging material in this file.

## Prerequisites

- Node.js 22.19.x. The repository deliberately rejects other major versions.
- npm 10.9.3, matching the committed lockfiles and container image.
- Provider authentication supported by Pi, or organizer-provided provider/model environment variables.

## Setup

```bash
npm ci --ignore-scripts
npm --prefix app-template ci --ignore-scripts
npm run check
```

Provider-specific credentials are read by Pi. The optional challenge variables select the organizer's runtime configuration:

```bash
export CHALLENGE_PROVIDER="provider-name"
export CHALLENGE_MODEL="model-id"
export CHALLENGE_THINKING="off"
```

Never commit credentials. `.env.example` documents variable names, but the runner intentionally does not load `.env` files.

The default thinking level is `off` to avoid multiplying output-token cost in the efficiency ranking. Raise it only when measurements show the extra reasoning improves completion quality.

The strict Node engine is intentional. `npm ci` fails on Node 23+ (including Node 26); use `.nvmrc` or the provided container rather than regenerating the lockfile with a newer runtime.

The Docker build runs the full check suite, including short-lived Vite servers over the builder's loopback interface. The image declares port 3000 for organizer-controlled browser evaluation; publishing that port still requires an explicit container port mapping or shared container network.

## Run the public challenge

The runner uses `contract-public/development-idea.txt` by default. During template development it contains a placeholder; organizers must replace that file with the finalized public prompt before participant distribution.

```bash
npm run challenge
```

Use `--idea-file /path/to/idea.txt` to override the default for organizer testing or hidden evaluation.

For a setup-only check that does not call a model:

```bash
npm run challenge -- --prepare-only
```

After a complete run:

```bash
cd output/app
npm run dev
```

The app must be available at `http://localhost:3000`. In another terminal, validate the machine-readable result:

```bash
npm run validate:result -- output/app/result.json
```

## Result and telemetry ownership

The model writes `report.partial.json`, containing the product summary, assumptions, features, and tests. The runner writes `result.json` after parsing Pi's completed `message_end` events. This prevents the model from inventing headline token totals.

The runner appends the canonical domain-neutral journey guidance from `contract-public/journeys.md` to Pi's built-in system prompt. The protected-paths extension removes only Pi's documentation-reference block, retaining its tool list and usage guidance without steering the model toward package internals. The challenge guidance prevents implied behaviors from being dropped for simplicity while explicitly rejecting unrelated substitute features; the input idea remains authoritative.

The runner independently executes the pinned Vitest binary, requires at least one completed passing test with no skipped or todo tests, runs `npm run build`, starts the application, probes the published `http://localhost:3000` URL only while the spawned server is alive, and terminates the full process group. Product-journey records remain in the specification-defined `tests_run` field; `success` requires at least one such journey and no failed entries. Independent Vitest, build, and startup evidence is recorded in `harness_checks`. The runner also owns `app_url` and a location-aware `start_command`, so harmless formatting differences in the partial report cannot invalidate a run.

The runner records whether port 3000 was occupied before Pi starts. If Pi leaves a listener behind, cleanup only targets same-user listener processes whose working directory is the generated app; Linux uses `/proc`, while macOS uses bounded, non-blocking `lsof` calls. A listener that predates Pi is never reclaimed. The `port_reclamation` result field records whether cleanup was considered, attempted, and successful, plus the affected process IDs.

A provisional result is written before app verification starts. Verification failures degrade a completed model run to `partial`; Pi startup or telemetry failures remain `failed`. Equivalent final results are emitted at the generated app root (`output/app/result.json`) and repository root (`result.json`); only `start_command` differs so each command works from the directory containing its result. Failure to write either required destination makes the harness exit non-zero. Port 3000 must be free on both IPv4 and IPv6 loopback addresses before verification begins.

The raw event stream and Pi session files are retained for audit. Official judging must independently recompute usage and compare it with `result.json`; the participant-controlled report is never the final scoring authority.

`reasoning_tokens` and `cost_total` are included as additional audit fields. No efficiency score is calculated here because the public specification must first define the cache-write weighting and whether ranking uses the custom token formula or Pi's monetary cost.

## Develop the harness

The starter deliberately makes one autonomous Pi invocation. Possible participant improvements include:

- a shorter or more reliable prompt;
- specialized extensions or tools;
- reusable but domain-neutral application primitives;
- test-and-repair orchestration;
- deliberate prompt caching;
- a different Pi integration through its SDK or RPC mode.

Do not add a challenge idea's domain vocabulary or expected records to reusable code. The official judging idea will be different.

## Security

Pi and participant extensions execute with the permissions of the current process. The included extension rejects direct `write` and `edit` calls outside the generated app, but shell commands and symlink tricks can bypass an in-process guard. It is not a sandbox. Official evaluation must run each frozen submission in an isolated container or VM with a read-only harness mount and bounded CPU, memory, disk, time, and network access.

See `docs/organizer-checklist.md` before publishing the template or running a judged submission.

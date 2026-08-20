---
name: self-repair
description: In-flight self-check and self-repair loop for generated applications
---

# Self-Repair Skill

This skill provides an automated, in-flight verification and repair mechanism for code generated during the AgentCofounder execution loop.

## Directives

1. **In-Flight Verification**:
   Before finalizing any application code changes, run the following verification steps locally in the workspace:
   - `npm test` or `npx vitest run`
   - `npm run build` or `npx tsc --noEmit`

2. **Automated Repair Loop**:
   If any test or build check fails:
   - Extract the exact error message and stack trace.
   - Analyze the root cause (e.g., missing imports, type mismatches, or failed assertions).
   - Modify the source code to resolve the error.
   - Re-run verification until all tests and build checks pass (up to 3 repair iterations).

3. **Zero-Defect Guarantee**:
   Do not report execution completion until both Vitest and build compilation pass cleanly with 0 failing, pending, or todo tests.

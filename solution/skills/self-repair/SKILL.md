---
name: self-repair
description: An in-flight test and repair loop to guarantee the application passes all tests and builds successfully before finishing.
---

# Self-Repair Loop

Before completing the overall task, you MUST run tests and perform a production build.

1. Run `npm test` inside the workspace. If there are any failing tests, analyze the test failure output carefully.
2. Edit the application code or tests to resolve the issues.
3. Re-run `npm test` until all tests pass.
4. Once tests pass, run `npm run build` inside the workspace.
5. If the build fails with TypeScript or Vite compilation errors, analyze the errors and fix the source code.
6. Re-run `npm run build` until it succeeds.
7. Only after both tests and the build pass without any errors, proceed to finalize your execution and write the `report.partial.json`.

🎯 **What:**
- Simplified the `isInside` function in `src/fs-utils.ts` to reuse `isInsideOrEqual`.
- Replaced the duplicated `isInside` logic in `boundedDisplayPath` (in `src/verify-app.ts`) with a direct call to the shared `isInside` helper.

💡 **Why:**
The logic to determine if a path is inside another was duplicated between `isInside`, `isInsideOrEqual`, and inside `boundedDisplayPath` in `verify-app.ts`. Consolidating this logic improves maintainability by removing code duplication. Any future bug fixes or optimizations for this check only need to be done in one place.

✅ **Verification:**
I ran the full test suite (`npm run check`) which includes TypeScript strict typechecking, testing, and building the application, and everything passes successfully. I also verified the changes locally in both `src/fs-utils.ts` and `src/verify-app.ts`.

✨ **Result:**
- `src/fs-utils.ts` is more DRY (Don't Repeat Yourself).
- `src/verify-app.ts` is cleaner and easier to read, deferring path boundary logic to the dedicated utility module.

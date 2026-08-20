---
name: fuzz-test-synthesizer
description: Auto-generate comprehensive Vitest test suites covering edge cases, boundary conditions, and corrupt state recovery
---

# Fuzz Test Synthesizer Skill

## Directives

1. **Mandatory Edge Case Coverage**:
   When writing Vitest suites in `src/**/*.test.ts` or `src/**/*.test.tsx`, synthesize explicit tests asserting application resilience against:
   - **Empty States**: Rendering components with empty arrays or null values gracefully.
   - **Invalid User Inputs**: Testing whitespace, special characters, and out-of-bound numeric inputs.
   - **Storage Corruption**: Simulating corrupted or unparseable JSON in `localStorage` and verifying that state safely falls back to defaults without crashing the app.
   - **Rapid Action Spamming**: Verifying state integrity when buttons are clicked rapidly multiple times.

2. **Compliance**:
   Ensure all tests execute and pass cleanly under `npm test`. Never mark tests as skipped (`it.skip`) or todo (`it.todo`).

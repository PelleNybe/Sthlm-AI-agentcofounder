---
name: fuzz-test-generator
description: Synthesizes edge-case and robustness tests using Vitest to ensure app reliability under unexpected conditions.
---

# Automated Edge-Case & Fuzz Test Generator

To score maximum points for Robustness (20 PTS), you must synthesize tests covering the following edge cases. Add these to your Vitest suite (`src/**/*.test.ts` or `src/**/*.test.tsx`):

1. **Empty State Recovery:**
   - Ensure the app renders properly without crashing when local storage is completely empty.
2. **Corrupted Data Resilience:**
   - Write a test that deliberately injects malformed JSON into local storage (e.g., `localStorage.setItem('data', '{bad json');`) and verifies that the app mounts and defaults to a safe fallback state without a runtime exception.
3. **Boundary Values:**
   - Test UI inputs with extremely long strings, empty strings, and special characters. Ensure appropriate validation messages are shown or input is handled gracefully.
4. **Rapid State Changes:**
   - Where applicable, test that rapid successive state changes (like multi-clicking a submit button) do not duplicate data improperly or crash the UI.

Include these tests along with the normal user journey tests to guarantee the application handles adverse conditions perfectly.

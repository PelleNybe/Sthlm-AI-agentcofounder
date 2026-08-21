---
name: domain-architecture-scaffolder
description: Enforces a strict 3-tier structure (Domain, Storage, Components) for the MVP to ensure maintainability and robust state persistence.
---

# Domain Architecture & State Persistence

To get a high score on the evaluation (specifically the 100-Pt App Score: Data & State Persistence and API & Integration Readiness), you MUST follow this structure:

1. **`src/domain/`**: Pure TypeScript logic and data models. No UI code (no React, no DOM).
2. **`src/storage/`**: LocalStorage persistence adapters. Must validate data and handle corruption gracefully.
3. **`src/components/`**: React UI consuming domain logic and storage. No direct `localStorage` calls in components.

Example Storage Adapter (`src/storage/adapter.ts`):
```typescript
export function loadData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Error reading ${key} from local storage, falling back.`, e);
    return fallback;
  }
}

export function saveData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${key} to local storage.`, e);
  }
}
```
You should implement a variation of this logic to manage state resilience.

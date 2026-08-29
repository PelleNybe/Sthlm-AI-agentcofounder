import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Notice: We don't import @testing-library/jest-dom/matchers here to avoid
// conflicting with the test harness runner which doesn't have it configured.

afterEach(() => {
  cleanup();
});

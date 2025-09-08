import { describe, it, expect } from 'vitest';
import { multiply } from './main';

describe('multiply', () => {
  it('works', () => {
    expect(multiply(2, 3)).toBe(6);
  });
});

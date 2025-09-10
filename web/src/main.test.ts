import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('main can be imported without throwing', async () => {
    // 不執行 boot，單純確認模組可以載入（我們在 main.ts 已避免測試環境副作用）
    await import('./main');
    expect(true).toBe(true);
  });
});

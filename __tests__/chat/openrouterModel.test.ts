import { describe, expect, it } from 'vitest';
import { resolveOpenRouterModel } from '@/lib/api/openrouterChat';

describe('resolveOpenRouterModel', () => {
  it('varsayılan model deepseek-v4-pro', () => {
    delete process.env.OPENROUTER_MODEL_OVERRIDE;
    delete process.env.SPECTROMIND_CHAT_MODEL;
    const model = resolveOpenRouterModel();
    expect(model.model).toBe('deepseek-v4-pro');
  });

  it('SPECTROMIND_CHAT_MODEL verilirse onu kullanır', () => {
    delete process.env.OPENROUTER_MODEL_OVERRIDE;
    process.env.SPECTROMIND_CHAT_MODEL = 'deepseek-v4-pro';
    const model = resolveOpenRouterModel();
    expect(model.model).toBe('deepseek-v4-pro');
    delete process.env.SPECTROMIND_CHAT_MODEL;
  });

  it('override varsa override model kullanır', () => {
    process.env.OPENROUTER_MODEL_OVERRIDE = 'openai/gpt-4o-mini:free';
    const model = resolveOpenRouterModel();
    expect(model.model).toBe('openai/gpt-4o-mini:free');
    delete process.env.OPENROUTER_MODEL_OVERRIDE;
  });
});

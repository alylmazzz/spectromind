import { describe, expect, it } from 'vitest';
import { classifyChatIntent } from '@/lib/chat/intentRouter';

describe('classifyChatIntent', () => {
  it('direct action request algılar', () => {
    expect(classifyChatIntent('Bu FID’yi işle')).toBe('direct_action_request');
  });

  it('root-cause isteğini algılar', () => {
    expect(classifyChatIntent('root cause nedir, hangi guardrail eksik?')).toBe('root_cause_request');
  });

  it('mixed request algılar', () => {
    expect(classifyChatIntent('Neden fail dedi ve residual mask uygula?')).toBe('mixed_request');
  });
});

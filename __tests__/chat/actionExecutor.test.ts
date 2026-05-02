import { describe, expect, it } from 'vitest';
import { executeChatAction, isAllowedAction } from '@/lib/chat/actionExecutor';

describe('action executor receipts', () => {
  it('allowed action için structured receipt döner', async () => {
    const result = await executeChatAction({ action: 'switch_modality' }, async () => 'ok');
    expect(result.success).toBe(true);
    expect(result.receipt.actor).toBe('chatbot');
    expect(result.receipt.rollback_possible).toBe(true);
  });

  it('allowlist dışı action block eder', async () => {
    const result = await executeChatAction({ action: 'drop_database' }, async () => 'no');
    expect(result.success).toBe(false);
    expect(result.receipt.execution_status).toBe('blocked');
  });

  it('known actions allowlistte olmalı', () => {
    expect(isAllowedAction('recluster_peaks')).toBe(true);
    expect(isAllowedAction('run_verification')).toBe(true);
  });

  it('rollback action zinciri undo için hazır olmalı', async () => {
    const first = await executeChatAction({ action: 'apply_residual_mask' }, async () => 'mask toggled');
    expect(first.receipt.rollback_possible).toBe(true);
    expect(first.receipt.rollback_action?.action).toBe('apply_residual_mask');

    const undo = await executeChatAction(first.receipt.rollback_action!, async () => 'mask reverted');
    expect(undo.success).toBe(true);
    expect(undo.receipt.requested_action).toBe('apply_residual_mask');
  });
});

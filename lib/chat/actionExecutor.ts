import type { ActionReceipt, ChatToolAction } from '@/lib/chat/contracts';
import { emitChatTelemetry } from '@/lib/chat/telemetry';

export type ClientActionHandler = (action: ChatToolAction) => Promise<string>;

export function isAllowedAction(action: string): boolean {
  return [
    'reprocess_fid',
    'apply_residual_mask',
    'recluster_peaks',
    'rerun_ranking',
    'switch_modality',
    'open_compare_mode',
    'generate_docx',
    'generate_json',
    'run_verification',
    'show_authority_trace',
    'open_root_cause_report',
  ].includes(action);
}

export async function executeChatAction(
  action: ChatToolAction,
  handler: ClientActionHandler
): Promise<{ success: boolean; message: string; action: string; receipt: ActionReceipt }> {
  const baseReceipt: ActionReceipt = {
    action_id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    actor: 'chatbot',
    requested_action: action.action,
    execution_status: 'blocked',
    affected_scope: 'analysis_view',
    provenance_impact: 'No change (blocked).',
    rollback_possible: false,
  };
  if (!isAllowedAction(action.action)) {
    const receipt: ActionReceipt = { ...baseReceipt, execution_status: 'blocked', provenance_impact: 'Action allowlist blocked.' };
    emitChatTelemetry({ type: 'chat.action', payload: receipt as unknown as Record<string, unknown> });
    return { success: false, action: action.action, message: 'ACTION_NOT_ALLOWED', receipt };
  }
  try {
    const message = await handler(action);
    const rollbackMap: Record<string, ChatToolAction | undefined> = {
      switch_modality: { action: 'switch_modality' },
      apply_residual_mask: { action: 'apply_residual_mask' },
      recluster_peaks: { action: 'recluster_peaks' },
      open_compare_mode: { action: 'open_compare_mode' },
    };
    const rollbackAction = rollbackMap[action.action];
    const receipt: ActionReceipt = {
      ...baseReceipt,
      execution_status: 'success',
      affected_scope: rollbackAction ? 'analysis_view' : 'ui_only',
      provenance_impact: rollbackAction
        ? 'New analysis-view state generated with traceable lineage.'
        : 'UI-only action; authoritative evidence unchanged.',
      rollback_possible: Boolean(rollbackAction),
      rollback_action: rollbackAction,
    };
    emitChatTelemetry({ type: 'chat.action', payload: receipt as unknown as Record<string, unknown> });
    return { success: true, action: action.action, message, receipt };
  } catch {
    const receipt = {
      ...baseReceipt,
      execution_status: 'failed',
      provenance_impact: 'Execution failed; no authoritative mutation committed.',
    } as ActionReceipt;
    emitChatTelemetry({ type: 'chat.action', payload: receipt as unknown as Record<string, unknown> });
    return { success: false, action: action.action, message: 'ACTION_EXECUTION_FAILED', receipt };
  }
}

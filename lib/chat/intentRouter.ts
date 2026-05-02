import type { ChatIntent } from '@/lib/chat/contracts';

const ACTION_PATTERNS = [
  /işle/i,
  /uygula/i,
  /recluster/i,
  /yeniden/i,
  /taşı/i,
  /aç/i,
  /üret/i,
  /export/i,
  /doğrulama dışında bırak/i,
];

export function classifyChatIntent(message: string): ChatIntent {
  const text = message.trim();
  const lowered = text.toLowerCase();
  const hasQuestion = lowered.includes('?') || /neden|nasıl|hangi|what|why|how/.test(lowered);
  const hasAction = ACTION_PATTERNS.some((p) => p.test(text));
  const hasRootCause = /root cause|kök neden|neden tekrar olur|guardrail|test eksik/.test(lowered);
  const hasExport = /rapor|docx|json|export/.test(lowered);
  const hasUi = /panel|sayfa|tooltip|kart|ui|ux/.test(lowered);
  const hasDebug = /drift|authority breach|parity|debug|audit|çelişki/.test(lowered);
  const hasWorkflow = /(önce).*(sonra)|multi|çok adımlı/.test(lowered);

  if (hasRootCause) return 'root_cause_request';
  if (hasWorkflow) return 'multi_step_workflow';
  if (hasAction && hasQuestion) return 'mixed_request';
  if (hasExport) return 'export_report_request';
  if (hasUi) return 'ui_command';
  if (hasDebug) return 'debug_audit_request';
  if (hasAction) return 'direct_action_request';
  if (hasQuestion) return 'interpretation_request';
  return 'simple_qa';
}

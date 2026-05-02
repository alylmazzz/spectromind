'use client';

import { useMemo, useRef, useState } from 'react';
import { classifyChatIntent } from '@/lib/chat/intentRouter';
import type {
  ActionReceipt,
  ChatMessage,
  ChatToolAction,
  OpenRouterRequestPayload,
  StructuredEvidenceObject,
} from '@/lib/chat/contracts';
import { executeChatAction, type ClientActionHandler } from '@/lib/chat/actionExecutor';
import { buildForensicOutput, isForensicMessage } from '@/lib/chat/forensicMode';
import { emitChatTelemetry } from '@/lib/chat/telemetry';
import { buildStructuredEvidence } from '@/lib/chat/evidenceBuilder';
import { buildLocalFallbackResponse } from '@/lib/chat/localFallback';
import type { FinalVerdict } from '@/lib/types';
import { buildStructuredTurkishWhyWrong } from '@/lib/chat/structuredTurkishResponse';

interface ChatContextInput {
  modality: string;
  solvent: string;
  qcStatus: 'PASS' | 'WARN' | 'FAIL_WITH_CONFIDENCE_CEILING';
  authorityTier: StructuredEvidenceObject['authority_tier'];
  moleculeRegions: string[];
  residualRegions: string[];
  artifactRegions: string[];
  contradictions: string[];
  candidateStructures?: Array<{ name: string; support: number; contradictions?: string[] }>;
  analyteRegions?: string[];
  crossModalAnchors?: string[];
  exactIdEligibility?: { eligible: boolean; candidate?: string; reasons: string[] };
  parserConfidence?: number;
  /** Analiz sonrası nihai verdict (kimlik yüzeyi + gözlemlenebilirlik). */
  finalVerdict?: FinalVerdict;
}

interface SpectroMindChatPanelProps {
  context: ChatContextInput;
  onClientAction: ClientActionHandler;
}

export default function SpectroMindChatPanel({ context, onClientAction }: SpectroMindChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<'openrouter' | 'deepseek'>('openrouter');
  const [input, setInput] = useState('');
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'partial' | 'completed'>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hazırım. Sorunu açıklayabilir veya doğrudan aksiyon komutu verebilirsin.' },
  ]);
  const [receipts, setReceipts] = useState<ActionReceipt[]>([]);
  const [history, setHistory] = useState<ActionReceipt[]>([]);
  const [lastUserPrompt, setLastUserPrompt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const evidence = useMemo(() => {
    const fv = context.finalVerdict;
    const identitySurface = fv
      ? {
          display_molecule: fv.final_candidate,
          display_iupac: fv.final_iupac || '',
          display_formula: fv.final_formula || '',
          display_smiles: fv.final_smiles || '',
          final_identity_source: fv.final_identity_source || 'analysis_sot',
          exact_id_active: fv.exact_id_active,
          parity_status: fv.parity_status,
          verdict_mode: fv.verdict_mode,
          display_verification_status: fv.display_verification_status,
        }
      : undefined;
    return buildStructuredEvidence({
      modality: context.modality,
      solvent: context.solvent,
      qcStatus: context.qcStatus,
      authorityTier: context.authorityTier,
      moleculeRegions: context.moleculeRegions,
      residualRegions: context.residualRegions,
      artifactRegions: context.artifactRegions,
      contradictions: context.contradictions,
      candidateStructures: context.candidateStructures,
      analyteRegions: context.analyteRegions,
      crossModalAnchors: context.crossModalAnchors,
      exactIdEligibility: context.exactIdEligibility,
      parserConfidence: context.parserConfidence,
      identitySurface,
      observability: fv
        ? {
            final_identity_source: fv.final_identity_source,
            iupac_source: 'final_verdict_lock',
            formula_source: 'final_verdict_lock',
            smiles_source: 'final_verdict_lock',
            verdict_source: fv.verdict_source,
            parity_status: fv.parity_status,
            fallback_leak_detected: fv.fallback_leak_detected,
            authority_breach_detected: fv.authority_breach_detected,
            assistant_response_mode: 'deterministic_or_llm',
            assistant_language_mode: 'tr',
          }
        : undefined,
    });
  }, [context]);
  const mode = useMemo(() => (messages[messages.length - 1]?.role === 'assistant' ? 'explanation' : 'action'), [messages]);
  const quickActions = useMemo(() => {
    const actions: Array<{ id: string; label: string }> = [];
    if (context.residualRegions.length > 0) actions.push({ id: 'apply_residual_mask', label: 'Residual mask uygula' });
    if (context.moleculeRegions.length > 0) actions.push({ id: 'recluster_peaks', label: 'Peak reclustering yap' });
    actions.push({ id: 'run_verification', label: 'Run verification' });
    if (['NMR', '13C', 'HSQC', 'COSY'].includes(context.modality)) actions.push({ id: 'switch_modality', label: '1H/13C/HSQC/COSY geç' });
    actions.push({ id: 'open_compare_mode', label: 'Compare solvents' });
    actions.push({ id: 'generate_docx', label: 'Export DOCX' });
    actions.push({ id: 'generate_json', label: 'Export JSON' });
    actions.push({ id: 'show_authority_trace', label: 'Show authority trace' });
    actions.push({ id: 'open_root_cause_report', label: 'Open root-cause report' });
    return actions;
  }, [context]);

  function parseSseChunk(chunk: string): string {
    const lines = chunk.split('\n');
    let content = '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const value = line.slice(5).trim();
      if (!value || value === '[DONE]') continue;
      try {
        const parsed = JSON.parse(value);
        content += parsed?.choices?.[0]?.delta?.content ?? '';
      } catch {
        content += value;
      }
    }
    return content;
  }

  async function sendWithPrompt(prompt: string) {
    const text = prompt.trim();
    if (!text || loadingState === 'loading' || loadingState === 'partial') return;
    setInput('');
    setLastUserPrompt(text);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);

    const intent = classifyChatIntent(text);
    const forensic = isForensicMessage(text) ? buildForensicOutput(text, evidence) : null;
    const deterministicWhy = buildStructuredTurkishWhyWrong(text, evidence);
    if (deterministicWhy) {
      setMessages([...nextMessages, { role: 'assistant', content: deterministicWhy }]);
      setLoadingState('completed');
      emitChatTelemetry({
        type: 'chat.reply',
        payload: {
          authority_source: evidence.authority_tier,
          assistant_response_mode: 'deterministic_tr_structured',
          evidence_id: evidence.evidence_id,
        },
      });
      return;
    }
    setLoadingState('loading');
    abortRef.current = new AbortController();
    let streamedContent = '';
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
    try {
      const payload: OpenRouterRequestPayload = {
        messages: nextMessages,
        intent,
        evidence,
        provider,
        stream: true,
        forensic,
      };
      const response = await fetch('/api/chat/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        const parity = data.error === 'PARITY_VIOLATION';
        const blockedMessage =
          data.error === 'CHAT_OPENROUTER_FAILED'
            ? buildLocalFallbackResponse({
                userPrompt: text,
                evidence,
                failureDetail: data.detail || data.error,
              })
            : `${parity ? 'PARITY VIOLATION' : 'Guardrail'}: ${data.error || 'Bilinmeyen hata'} (${(data.reason_codes || []).join(', ')})${data.detail ? `\nDetay: ${data.detail}` : ''}`;
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: 'assistant',
            content: blockedMessage,
          },
        ]);
        setLoadingState('completed');
        return;
      }
      if (!response.body) throw new Error('STREAM_BODY_MISSING');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: rdDone } = await reader.read();
        done = rdDone;
        if (value) {
          const textChunk = decoder.decode(value, { stream: true });
          streamedContent += parseSseChunk(textChunk);
          setLoadingState('partial');
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: streamedContent };
            return updated;
          });
        }
      }
      if (!streamedContent) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: 'Yanıt boş döndü.' };
          return updated;
        });
      } else {
        emitChatTelemetry({
          type: 'chat.reply',
          payload: {
            authority_source: evidence.authority_tier,
            evidence_version: evidence.evidence_version,
            streamed: true,
          },
        });
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      const fallback = buildLocalFallbackResponse({
        userPrompt: text,
        evidence,
        failureDetail: detail,
      });
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: fallback };
        return updated;
      });
    } finally {
      abortRef.current = null;
      setLoadingState('completed');
    }
  }

  async function runQuickAction(action: string) {
    const toolAction: ChatToolAction = { action };
    const result = await executeChatAction(toolAction, onClientAction);
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: result.success ? `Aksiyon tamamlandı: ${result.message}` : `Aksiyon reddedildi: ${result.message}` },
    ]);
    setReceipts((prev) => [result.receipt, ...prev].slice(0, 10));
    if (result.receipt.rollback_possible) {
      setHistory((prev) => [result.receipt, ...prev].slice(0, 20));
    }
  }

  async function undoLast() {
    const last = history[0];
    if (!last?.rollback_possible || !last.rollback_action) return;
    const result = await executeChatAction(last.rollback_action, onClientAction);
    const rolled: ActionReceipt = { ...result.receipt, execution_status: 'rolled_back' };
    setReceipts((prev) => [rolled, ...prev].slice(0, 10));
    setHistory((prev) => prev.slice(1));
    emitChatTelemetry({ type: 'chat.rollback', payload: rolled as unknown as Record<string, unknown> });
    setMessages((prev) => [...prev, { role: 'assistant', content: `UNDO tamamlandı: ${last.requested_action}` }]);
  }

  function stopGeneration() {
    abortRef.current?.abort();
    setLoadingState('completed');
  }

  async function retryLast() {
    if (!lastUserPrompt) return;
    await sendWithPrompt(lastUserPrompt);
  }

  async function regenerateLast() {
    if (!lastUserPrompt) return;
    setMessages((prev) => prev.slice(0, -1));
    await sendWithPrompt(lastUserPrompt);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-cyan-400"
      >
        {open ? 'Chat Kapat' : 'SpectroMind Chat'}
      </button>
      {open ? (
        <div className="fixed right-3 bottom-16 z-50 h-[78vh] w-[390px] max-w-[95vw] rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur transition-all">
          <div className="sticky top-0 border-b border-slate-700 px-4 py-3 text-sm bg-slate-900/95 z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-cyan-300">SpectroMind Assistant</div>
              <div className="inline-flex rounded-md border border-slate-700 bg-slate-850 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setProvider('deepseek')}
                  className={`rounded px-2 py-1 ${provider === 'deepseek' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                  DeepSeek API
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('openrouter')}
                  className={`rounded px-2 py-1 ${provider === 'openrouter' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                  OpenRouter API
                </button>
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-2">
              Authority: {context.authorityTier} • QC: {context.qcStatus} • Modality: {context.modality}
              <span className={mode === 'action' ? 'text-amber-300' : 'text-emerald-300'}>
                Mode: {mode === 'action' ? 'Action' : 'Explanation'}
              </span>
              <span className="text-slate-300">Provider: {provider}</span>
            </div>
          </div>
          <div className="h-[calc(78vh-250px)] overflow-y-auto p-3 space-y-2">
            {messages.map((m, idx) => (
              <div
                key={`${m.role}_${idx}`}
                className={`rounded-md px-3 py-2 text-sm ${
                  m.role === 'user' ? 'bg-cyan-900/40 text-cyan-100 ml-6' : 'bg-slate-800 text-slate-100 mr-6'
                }`}
              >
                {m.content}
              </div>
            ))}
            {(loadingState === 'loading' || loadingState === 'partial') ? (
              <div className="text-xs text-slate-400">Yanıt üretiliyor ({loadingState})...</div>
            ) : null}
            {receipts.length ? (
              <div className="pt-2">
                <div className="text-[11px] text-slate-400 mb-1">Action Receipts</div>
                <div className="space-y-1">
                  {receipts.slice(0, 3).map((r) => (
                    <div key={r.action_id} className="rounded border border-slate-700 bg-slate-850 px-2 py-1 text-[11px]">
                      <div className="text-slate-200">{r.requested_action} • {r.execution_status}</div>
                      <div className="text-slate-400">{r.provenance_impact}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="border-t border-slate-700 p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {quickActions.map((a) => (
                <button key={a.id} type="button" onClick={() => runQuickAction(a.id)} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">
                  {a.label}
                </button>
              ))}
              <button type="button" onClick={() => void undoLast()} className="rounded bg-amber-900/60 px-2 py-1 text-xs hover:bg-amber-800">Undo</button>
            </div>
            <div className="mb-2 flex gap-2">
              <button type="button" onClick={() => void retryLast()} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">Retry</button>
              <button type="button" onClick={() => void regenerateLast()} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">Regenerate</button>
              <button type="button" onClick={stopGeneration} className="rounded bg-rose-900/60 px-2 py-1 text-xs hover:bg-rose-800">Stop</button>
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void sendWithPrompt(input);
                }}
                placeholder="Sor veya komut ver..."
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              />
              <button
                type="button"
                onClick={() => void sendWithPrompt(input)}
                disabled={loadingState === 'loading' || loadingState === 'partial'}
                className="rounded bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                Gönder
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

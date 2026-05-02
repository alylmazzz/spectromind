import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouterChat, callOpenRouterChatStream } from '@/lib/api/openrouterChat';
import { callDeepSeekChat, callDeepSeekChatStream } from '@/lib/api/deepseekChat';
import { evaluateAuthorityGate } from '@/lib/chat/authorityGate';
import { enforceParityGuard } from '@/lib/chat/parityGuard';
import type { OpenRouterRequestPayload } from '@/lib/chat/contracts';
import { emitChatTelemetry } from '@/lib/chat/telemetry';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OpenRouterRequestPayload;
    if (!body?.messages?.length || !body?.evidence) {
      return NextResponse.json({ success: false, error: 'INVALID_CHAT_PAYLOAD' }, { status: 400 });
    }

    const authority = evaluateAuthorityGate(body.evidence);
    const parity = enforceParityGuard(body.evidence);
    if (!authority.allowed) {
      emitChatTelemetry({ type: 'chat.authority_breach', payload: { reason_codes: authority.reason_codes, evidence_id: body.evidence.evidence_id } });
      return NextResponse.json(
        {
          success: false,
          error: 'AUTHORITY_GATE_DENIED',
          reason_codes: authority.reason_codes,
        },
        { status: 400 }
      );
    }
    if (!parity.parity_ok) {
      emitChatTelemetry({ type: 'chat.parity_violation', payload: { reason_codes: parity.reasons, evidence_id: body.evidence.evidence_id } });
      return NextResponse.json(
        {
          success: false,
          error: 'PARITY_VIOLATION',
          reason_codes: parity.reasons,
        },
        { status: 400 }
      );
    }

    const provider = body.provider === 'deepseek' ? 'deepseek' : 'openrouter';

    if (body.stream) {
      emitChatTelemetry({ type: 'chat.stream.start', payload: { evidence_id: body.evidence.evidence_id, intent: body.intent } });
      const upstream = provider === 'deepseek' ? await callDeepSeekChatStream(body) : await callOpenRouterChatStream(body);
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = upstream.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }
          let done = false;
          while (!done) {
            const { value, done: rdDone } = await reader.read();
            done = rdDone;
            if (value) {
              controller.enqueue(encoder.encode(decoder.decode(value, { stream: true })));
            }
          }
          emitChatTelemetry({ type: 'chat.stream.end', payload: { evidence_id: body.evidence.evidence_id } });
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    const response = provider === 'deepseek' ? await callDeepSeekChat(body) : await callOpenRouterChat(body);
    emitChatTelemetry({
      type: 'chat.reply',
      payload: {
        evidence_id: body.evidence.evidence_id,
        authority_source: body.evidence.authority_tier,
        evidence_version: body.evidence.evidence_version,
        model: response.actual_model_used,
        provider,
        latency_ms: response.latency_ms,
        streamed: false,
      },
    });
    return NextResponse.json({
      ...response,
      guardrail: {
        authority_gate: authority,
        parity_guard: parity,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown';
    emitChatTelemetry({ type: 'chat.authority_breach', payload: { error: 'CHAT_PROVIDER_FAILED', detail } });
    return NextResponse.json(
      {
        success: false,
        error: 'CHAT_OPENROUTER_FAILED',
        detail,
        reason_codes: ['PROVIDER_OR_MODEL_FAILURE'],
      },
      { status: 500 }
    );
  }
}

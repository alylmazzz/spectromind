import { describe, expect, it, vi } from 'vitest';
import { callOpenRouterChatStream } from '@/lib/api/openrouterChat';
import type { OpenRouterRequestPayload } from '@/lib/chat/contracts';
import { buildStructuredEvidence } from '@/lib/chat/evidenceBuilder';

describe('openrouter streaming path', () => {
  it('streamed response path çalışmalı', async () => {
    process.env.OPENROUTER_API_KEY = 'test';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const payload: OpenRouterRequestPayload = {
      messages: [{ role: 'user', content: 'test' }],
      intent: 'simple_qa',
      evidence: buildStructuredEvidence({
        modality: '1H',
        solvent: 'DMSO',
        qcStatus: 'PASS',
        authorityTier: 'AUTHORITATIVE_OBSERVED',
        moleculeRegions: [],
        residualRegions: [],
        artifactRegions: [],
        contradictions: [],
      }),
      stream: true,
    };

    const response = await callOpenRouterChatStream(payload);
    expect(response.body).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('bozuk chunk olsa da stream path response döner', async () => {
    process.env.OPENROUTER_API_KEY = 'test';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {not-json}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok2"}}]}\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const payload: OpenRouterRequestPayload = {
      messages: [{ role: 'user', content: 'test malformed' }],
      intent: 'simple_qa',
      evidence: buildStructuredEvidence({
        modality: '1H',
        solvent: 'DMSO',
        qcStatus: 'PASS',
        authorityTier: 'AUTHORITATIVE_OBSERVED',
        moleculeRegions: [],
        residualRegions: [],
        artifactRegions: [],
        contradictions: [],
      }),
      stream: true,
    };
    const response = await callOpenRouterChatStream(payload);
    expect(response.status).toBe(200);
    vi.unstubAllGlobals();
  });
});

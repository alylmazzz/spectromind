import type { OpenRouterRequestPayload } from '@/lib/chat/contracts';
import { SPECTROMIND_CHAT_SYSTEM_PROMPT } from '@/lib/chat/systemPrompt';

export interface ResolvedOpenRouterModel {
  model: string;
  fallbackChain: string[];
}

export interface OpenRouterNormalizedResponse {
  success: boolean;
  content: string;
  actual_model_used: string;
  provider: 'openrouter';
  latency_ms: number;
  token_usage?: unknown;
  authority_mix: string;
  reasoning_mode: string;
  structured_output_used: boolean;
  streamed: boolean;
  failure_reason?: string;
  fallback_model?: string;
}

export function resolveOpenRouterModel(): ResolvedOpenRouterModel {
  const preferred = process.env.SPECTROMIND_CHAT_MODEL?.trim() || 'deepseek-v4-pro';
  const override = process.env.OPENROUTER_MODEL_OVERRIDE?.trim();
  if (override) {
    return { model: override, fallbackChain: ['openrouter/free'] };
  }
  return { model: preferred, fallbackChain: ['openrouter/free'] };
}

function buildRequestBody(model: string, payload: OpenRouterRequestPayload) {
  const systemPrompt = SPECTROMIND_CHAT_SYSTEM_PROMPT;

  return {
    model,
    temperature: payload.intent === 'simple_qa' ? 0.3 : 0.15,
    response_format: { type: 'text' },
    stream: Boolean(payload.stream),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: `StructuredEvidenceObject=${JSON.stringify(payload.evidence)}` },
      ...(payload.forensic ? [{ role: 'system', content: `ForensicMode=${JSON.stringify(payload.forensic)}` }] : []),
      ...payload.messages,
    ],
  };
}

export async function callOpenRouterChat(
  payload: OpenRouterRequestPayload
): Promise<OpenRouterNormalizedResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing');
  }
  const startedAt = Date.now();
  const modelResolution = resolveOpenRouterModel();
  let chosenModel = modelResolution.model;
  let fallbackModel: string | undefined;
  let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildRequestBody(chosenModel, payload)),
  });
  if (!response.ok && process.env.OPENROUTER_MODEL_OVERRIDE && modelResolution.fallbackChain.length) {
    fallbackModel = modelResolution.fallbackChain[0];
    chosenModel = fallbackModel;
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildRequestBody(chosenModel, payload)),
    });
  }

  const latency = Date.now() - startedAt;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '';

  return {
    success: true,
    content,
    actual_model_used: data?.model ?? modelResolution.model,
    provider: 'openrouter',
    latency_ms: latency,
    token_usage: data?.usage,
    authority_mix: payload.evidence.authority_tier,
    reasoning_mode: payload.intent,
    structured_output_used: true,
    streamed: false,
    fallback_model: fallbackModel,
  };
}

export async function callOpenRouterChatStream(payload: OpenRouterRequestPayload): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing');
  }
  const modelResolution = resolveOpenRouterModel();
  let chosenModel = modelResolution.model;
  let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildRequestBody(chosenModel, { ...payload, stream: true })),
  });
  if ((!response.ok || !response.body) && process.env.OPENROUTER_MODEL_OVERRIDE && modelResolution.fallbackChain.length) {
    chosenModel = modelResolution.fallbackChain[0];
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildRequestBody(chosenModel, { ...payload, stream: true })),
    });
  }
  if (!response.ok || !response.body) {
    const body = await response.text();
    throw new Error(`OpenRouter stream error: ${response.status} ${body}`);
  }
  return response;
}

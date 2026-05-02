import type { OpenRouterRequestPayload } from '@/lib/chat/contracts';
import { SPECTROMIND_CHAT_SYSTEM_PROMPT } from '@/lib/chat/systemPrompt';

export interface DeepSeekNormalizedResponse {
  success: boolean;
  content: string;
  actual_model_used: string;
  provider: 'deepseek';
  latency_ms: number;
  token_usage?: unknown;
  authority_mix: string;
  reasoning_mode: string;
  structured_output_used: boolean;
  streamed: boolean;
}

function resolveDeepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-v4-pro';
}

function resolveDeepSeekBaseUrl(): string {
  const raw = process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com';
  return raw.endsWith('/v1') ? raw : `${raw.replace(/\/$/, '')}/v1`;
}

function buildRequestBody(model: string, payload: OpenRouterRequestPayload) {
  const systemPrompt = SPECTROMIND_CHAT_SYSTEM_PROMPT;

  return {
    model,
    temperature: payload.intent === 'simple_qa' ? 0.3 : 0.15,
    stream: Boolean(payload.stream),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: `StructuredEvidenceObject=${JSON.stringify(payload.evidence)}` },
      ...(payload.forensic ? [{ role: 'system', content: `ForensicMode=${JSON.stringify(payload.forensic)}` }] : []),
      ...payload.messages,
    ],
  };
}

export async function callDeepSeekChat(payload: OpenRouterRequestPayload): Promise<DeepSeekNormalizedResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is missing');
  }
  const model = resolveDeepSeekModel();
  const baseUrl = resolveDeepSeekBaseUrl();
  const isLocal = /localhost|127\.0\.0\.1/i.test(baseUrl) || baseUrl.includes('.local');
  const cloudFallbackModel = process.env.DEEPSEEK_CLOUD_MODEL?.trim() || 'deepseek-chat';
  const chosenModel = !isLocal && (model === 'deepseek-v4-pro' || model === 'deepseek-v4-flash') ? cloudFallbackModel : model;
  const startedAt = Date.now();
  let response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildRequestBody(chosenModel, payload)),
  });
  if (!response.ok && chosenModel !== cloudFallbackModel && !isLocal) {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildRequestBody(cloudFallbackModel, payload)),
    });
  }
  const latency = Date.now() - startedAt;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepSeek error: ${response.status} ${body}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '';

  return {
    success: true,
    content,
    actual_model_used: data?.model ?? chosenModel,
    provider: 'deepseek',
    latency_ms: latency,
    token_usage: data?.usage,
    authority_mix: payload.evidence.authority_tier,
    reasoning_mode: payload.intent,
    structured_output_used: true,
    streamed: false,
  };
}

export async function callDeepSeekChatStream(payload: OpenRouterRequestPayload): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is missing');
  }
  const model = resolveDeepSeekModel();
  const baseUrl = resolveDeepSeekBaseUrl();
  const isLocal = /localhost|127\.0\.0\.1/i.test(baseUrl) || baseUrl.includes('.local');
  const cloudFallbackModel = process.env.DEEPSEEK_CLOUD_MODEL?.trim() || 'deepseek-chat';
  const chosenModel = !isLocal && (model === 'deepseek-v4-pro' || model === 'deepseek-v4-flash') ? cloudFallbackModel : model;
  let response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildRequestBody(chosenModel, { ...payload, stream: true })),
  });
  if ((!response.ok || !response.body) && chosenModel !== cloudFallbackModel && !isLocal) {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildRequestBody(cloudFallbackModel, { ...payload, stream: true })),
    });
  }
  if (!response.ok || !response.body) {
    const body = await response.text();
    throw new Error(`DeepSeek stream error: ${response.status} ${body}`);
  }
  return response;
}

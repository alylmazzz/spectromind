interface ChatTelemetryEvent {
  type:
    | 'chat.reply'
    | 'chat.stream.start'
    | 'chat.stream.end'
    | 'chat.authority_breach'
    | 'chat.parity_violation'
    | 'chat.action'
    | 'chat.rollback';
  payload: Record<string, unknown>;
}

export function emitChatTelemetry(event: ChatTelemetryEvent): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...event,
  });
  // Lightweight inspectable telemetry
  console.log(`[chat-telemetry] ${line}`);
}

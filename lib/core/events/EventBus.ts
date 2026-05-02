import type { EventType, SpectroMindEvent } from './types';

type EventHandler<T = unknown> = (event: SpectroMindEvent<T>) => void;

const handlers = new Map<EventType, Set<EventHandler>>();

export const EventBus = {
  on<T = unknown>(type: EventType, handler: EventHandler<T>): () => void {
    if (!handlers.has(type)) {
      handlers.set(type, new Set());
    }
    const set = handlers.get(type)!;
    set.add(handler as EventHandler);

    return () => {
      set.delete(handler as EventHandler);
      if (set.size === 0) handlers.delete(type);
    };
  },

  emit<T = unknown>(type: EventType, payload: T, source: string): void {
    const event: SpectroMindEvent<T> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      source,
    };

    const set = handlers.get(type);
    if (set) {
      set.forEach(handler => {
        try {
          handler(event);
        } catch (err) {
          console.error(`[EventBus] Handler error for ${type}:`, err);
        }
      });
    }
  },

  off(type: EventType): void {
    handlers.delete(type);
  },

  clear(): void {
    handlers.clear();
  },
};

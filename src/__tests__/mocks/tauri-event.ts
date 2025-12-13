/**
 * Mock for @tauri-apps/api/event
 *
 * This mock simulates the Tauri event API for frontend testing.
 */

import { vi } from "vitest";

// Types for event system
type EventCallback<T> = (event: { payload: T }) => void;
type UnlistenFn = () => void;

// Store for registered event listeners
const eventListeners: Map<string, Set<EventCallback<unknown>>> = new Map();

// Track listen calls for assertions
export const listenHistory: Array<{
  event: string;
  callback: EventCallback<unknown>;
}> = [];

/**
 * Mock listen function
 */
export const listen = vi.fn(
  async <T>(event: string, callback: EventCallback<T>): Promise<UnlistenFn> => {
    listenHistory.push({ event, callback: callback as EventCallback<unknown> });

    // Add to event listeners
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    eventListeners.get(event)!.add(callback as EventCallback<unknown>);

    // Return unlisten function
    return () => {
      const listeners = eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback as EventCallback<unknown>);
      }
    };
  },
);

/**
 * Mock once function - listens for a single event
 */
export const once = vi.fn(
  async <T>(event: string, callback: EventCallback<T>): Promise<UnlistenFn> => {
    const wrappedCallback: EventCallback<T> = (eventData) => {
      callback(eventData);
      // Auto-unsubscribe after first event
      const listeners = eventListeners.get(event);
      if (listeners) {
        listeners.delete(wrappedCallback as EventCallback<unknown>);
      }
    };

    listenHistory.push({
      event,
      callback: wrappedCallback as EventCallback<unknown>,
    });

    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    eventListeners.get(event)!.add(wrappedCallback as EventCallback<unknown>);

    return () => {
      const listeners = eventListeners.get(event);
      if (listeners) {
        listeners.delete(wrappedCallback as EventCallback<unknown>);
      }
    };
  },
);

/**
 * Mock emit function - emit event to frontend
 */
export const emit = vi.fn(
  async (event: string, payload?: unknown): Promise<void> => {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        callback({ payload });
      });
    }
  },
);

/**
 * Simulate emitting an event (for testing purposes)
 */
export function simulateEvent<T>(event: string, payload: T): void {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach((callback) => {
      try {
        callback({ payload });
      } catch (error) {
        // Swallow errors to prevent crashes, matching Tauri's behavior
        console.error(`Error in event listener for "${event}":`, error);
      }
    });
  }
}

/**
 * Get registered listeners for an event
 */
export function getListeners(
  event: string,
): Set<EventCallback<unknown>> | undefined {
  return eventListeners.get(event);
}

/**
 * Check if there are any listeners for an event
 */
export function hasListeners(event: string): boolean {
  const listeners = eventListeners.get(event);
  return listeners !== undefined && listeners.size > 0;
}

/**
 * Clear all event listeners and history
 */
export function clearAllListeners(): void {
  eventListeners.clear();
  listenHistory.length = 0;
  listen.mockClear();
  once.mockClear();
  emit.mockClear();
}

/**
 * Get listen history for a specific event
 */
export function getListenHistory(
  event?: string,
): Array<{ event: string; callback: EventCallback<unknown> }> {
  if (event) {
    return listenHistory.filter((call) => call.event === event);
  }
  return listenHistory;
}

// Reset mocks between tests
beforeEach(() => {
  clearAllListeners();
});

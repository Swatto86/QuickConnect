/**
 * Mock for @tauri-apps/plugin-global-shortcut
 *
 * This mock simulates the Tauri global shortcut plugin for frontend testing.
 */

import { vi, beforeEach } from "vitest";

// Types
export type ShortcutHandler = (shortcut: string) => void;

interface RegisteredShortcut {
  shortcut: string;
  handler: ShortcutHandler;
}

// Store for registered shortcuts
const registeredShortcuts: Map<string, ShortcutHandler> = new Map();

// Track registration history for assertions
export const registrationHistory: Array<{
  action: "register" | "unregister" | "unregisterAll";
  shortcut?: string;
}> = [];

/**
 * Mock register function - registers a global shortcut
 */
export const register = vi.fn(
  async (shortcut: string, handler: ShortcutHandler): Promise<void> => {
    registeredShortcuts.set(shortcut, handler);
    registrationHistory.push({ action: "register", shortcut });
  }
);

/**
 * Mock registerAll function - registers multiple global shortcuts
 */
export const registerAll = vi.fn(
  async (
    shortcuts: string[],
    handler: ShortcutHandler
  ): Promise<void> => {
    for (const shortcut of shortcuts) {
      registeredShortcuts.set(shortcut, handler);
      registrationHistory.push({ action: "register", shortcut });
    }
  }
);

/**
 * Mock unregister function - unregisters a global shortcut
 */
export const unregister = vi.fn(async (shortcut: string): Promise<void> => {
  registeredShortcuts.delete(shortcut);
  registrationHistory.push({ action: "unregister", shortcut });
});

/**
 * Mock unregisterAll function - unregisters all global shortcuts
 */
export const unregisterAll = vi.fn(async (): Promise<void> => {
  registeredShortcuts.clear();
  registrationHistory.push({ action: "unregisterAll" });
});

/**
 * Mock isRegistered function - checks if a shortcut is registered
 */
export const isRegistered = vi.fn(async (shortcut: string): Promise<boolean> => {
  return registeredShortcuts.has(shortcut);
});

/**
 * Simulate triggering a shortcut (for testing purposes)
 * @param shortcut - The shortcut string to trigger (e.g., "CommandOrControl+Shift+E")
 */
export function simulateShortcut(shortcut: string): void {
  const handler = registeredShortcuts.get(shortcut);
  if (handler) {
    handler(shortcut);
  }
}

/**
 * Get all registered shortcuts (for testing assertions)
 */
export function getRegisteredShortcuts(): Map<string, ShortcutHandler> {
  return new Map(registeredShortcuts);
}

/**
 * Check if a specific shortcut is registered
 */
export function hasShortcut(shortcut: string): boolean {
  return registeredShortcuts.has(shortcut);
}

/**
 * Get registration history
 */
export function getRegistrationHistory(
  action?: "register" | "unregister" | "unregisterAll"
): typeof registrationHistory {
  if (action) {
    return registrationHistory.filter((entry) => entry.action === action);
  }
  return registrationHistory;
}

/**
 * Clear all mocks and registered shortcuts
 */
export function clearAllMocks(): void {
  registeredShortcuts.clear();
  registrationHistory.length = 0;
  register.mockClear();
  registerAll.mockClear();
  unregister.mockClear();
  unregisterAll.mockClear();
  isRegistered.mockClear();
}

// Reset mocks between tests
beforeEach(() => {
  clearAllMocks();
});

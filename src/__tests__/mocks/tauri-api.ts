/**
 * Mock for @tauri-apps/api/core
 *
 * This mock simulates the Tauri invoke API for frontend testing.
 */

import { vi } from "vitest";

// Store for mock command responses
const mockResponses: Map<string, unknown> = new Map();
const mockErrors: Map<string, Error> = new Map();

// Track invocations for assertions
export const invokeHistory: Array<{ cmd: string; args?: unknown }> = [];

/**
 * Mock invoke function
 */
export const invoke = vi.fn(
  async <T>(cmd: string, args?: unknown): Promise<T> => {
    invokeHistory.push({ cmd, args });

    // Check for mock errors first
    if (mockErrors.has(cmd)) {
      throw mockErrors.get(cmd);
    }

    // Return mock response if set
    if (mockResponses.has(cmd)) {
      return mockResponses.get(cmd) as T;
    }

    // Default responses for common commands
    switch (cmd) {
      case "get_theme":
        return "dark" as T;

      case "get_stored_credentials":
        return null as T;

      case "get_all_hosts":
        return [] as T;

      case "get_hosts":
        return [] as T;

      case "search_hosts":
        return [] as T;

      case "get_recent_connections":
        return [] as T;

      case "save_credentials":
      case "delete_credentials":
      case "save_host":
      case "delete_host":
      case "delete_all_hosts":
      case "launch_rdp":
      case "show_error":
      case "hide_main_window":
      case "show_main_window":
      case "show_login_window":
      case "hide_login_window":
      case "show_hosts_window":
      case "hide_hosts_window":
      case "switch_to_main_window":
      case "close_login_window":
      case "close_login_and_prepare_main":
      case "save_host_credentials":
      case "get_host_credentials":
      case "delete_host_credentials":
      case "scan_domain":
      case "quit_app":
        return undefined as T;

      case "check_autostart":
        return false as T;

      default:
        console.warn(`Unhandled mock invoke command: ${cmd}`);
        return undefined as T;
    }
  },
);

/**
 * Set a mock response for a specific command
 */
export function setMockResponse(cmd: string, response: unknown): void {
  mockResponses.set(cmd, response);
}

/**
 * Set a mock error for a specific command
 */
export function setMockError(cmd: string, error: Error): void {
  mockErrors.set(cmd, error);
}

/**
 * Clear a specific mock response
 */
export function clearMockResponse(cmd: string): void {
  mockResponses.delete(cmd);
  mockErrors.delete(cmd);
}

/**
 * Clear all mock responses and history
 */
export function clearAllMocks(): void {
  mockResponses.clear();
  mockErrors.clear();
  invokeHistory.length = 0;
  invoke.mockClear();
}

/**
 * Get invoke history for a specific command
 */
export function getInvokeHistory(
  cmd?: string,
): Array<{ cmd: string; args?: unknown }> {
  if (cmd) {
    return invokeHistory.filter((call) => call.cmd === cmd);
  }
  return invokeHistory;
}

// Reset mocks between tests
beforeEach(() => {
  clearAllMocks();
});

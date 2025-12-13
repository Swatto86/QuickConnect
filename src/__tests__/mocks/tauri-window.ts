/**
 * Mock for @tauri-apps/api/window
 *
 * This mock simulates the Tauri window API for frontend testing.
 */

import { vi } from 'vitest';

// Window state tracking
interface WindowState {
  visible: boolean;
  focused: boolean;
  minimized: boolean;
  maximized: boolean;
  fullscreen: boolean;
  title: string;
}

const windowStates: Map<string, WindowState> = new Map();

// Get or create window state
function getWindowState(label: string): WindowState {
  if (!windowStates.has(label)) {
    windowStates.set(label, {
      visible: true,
      focused: false,
      minimized: false,
      maximized: false,
      fullscreen: false,
      title: label,
    });
  }
  return windowStates.get(label)!;
}

/**
 * Mock WebviewWindow class
 */
export class WebviewWindow {
  label: string;

  constructor(label: string) {
    this.label = label;
    getWindowState(label);
  }

  async show(): Promise<void> {
    const state = getWindowState(this.label);
    state.visible = true;
    state.minimized = false;
  }

  async hide(): Promise<void> {
    const state = getWindowState(this.label);
    state.visible = false;
  }

  async close(): Promise<void> {
    windowStates.delete(this.label);
  }

  async setFocus(): Promise<void> {
    const state = getWindowState(this.label);
    state.focused = true;
    // Unfocus other windows
    windowStates.forEach((s, label) => {
      if (label !== this.label) {
        s.focused = false;
      }
    });
  }

  async minimize(): Promise<void> {
    const state = getWindowState(this.label);
    state.minimized = true;
    state.focused = false;
  }

  async unminimize(): Promise<void> {
    const state = getWindowState(this.label);
    state.minimized = false;
  }

  async maximize(): Promise<void> {
    const state = getWindowState(this.label);
    state.maximized = true;
  }

  async unmaximize(): Promise<void> {
    const state = getWindowState(this.label);
    state.maximized = false;
  }

  async toggleMaximize(): Promise<void> {
    const state = getWindowState(this.label);
    state.maximized = !state.maximized;
  }

  async setFullscreen(fullscreen: boolean): Promise<void> {
    const state = getWindowState(this.label);
    state.fullscreen = fullscreen;
  }

  async isVisible(): Promise<boolean> {
    return getWindowState(this.label).visible;
  }

  async isFocused(): Promise<boolean> {
    return getWindowState(this.label).focused;
  }

  async isMinimized(): Promise<boolean> {
    return getWindowState(this.label).minimized;
  }

  async isMaximized(): Promise<boolean> {
    return getWindowState(this.label).maximized;
  }

  async isFullscreen(): Promise<boolean> {
    return getWindowState(this.label).fullscreen;
  }

  async setTitle(title: string): Promise<void> {
    const state = getWindowState(this.label);
    state.title = title;
  }

  async title(): Promise<string> {
    return getWindowState(this.label).title;
  }

  async center(): Promise<void> {
    // No-op for mock
  }

  async setSize(): Promise<void> {
    // No-op for mock
  }

  async setMinSize(): Promise<void> {
    // No-op for mock
  }

  async setMaxSize(): Promise<void> {
    // No-op for mock
  }

  async setPosition(): Promise<void> {
    // No-op for mock
  }

  async setResizable(): Promise<void> {
    // No-op for mock
  }

  async setDecorations(): Promise<void> {
    // No-op for mock
  }

  async setAlwaysOnTop(): Promise<void> {
    // No-op for mock
  }

  async requestUserAttention(): Promise<void> {
    // No-op for mock
  }
}

// Current window label (set by tests)
let currentWindowLabel = 'main';

/**
 * Set the current window label for testing
 */
export function setCurrentWindowLabel(label: string): void {
  currentWindowLabel = label;
  getWindowState(label);
}

/**
 * Mock getCurrentWindow function
 */
export const getCurrentWindow = vi.fn((): WebviewWindow => {
  return new WebviewWindow(currentWindowLabel);
});

/**
 * Mock getAll function - returns all windows
 */
export const getAll = vi.fn((): WebviewWindow[] => {
  return Array.from(windowStates.keys()).map((label) => new WebviewWindow(label));
});

/**
 * Get window state for testing assertions
 */
export function getWindowStateForTest(label: string): WindowState | undefined {
  return windowStates.get(label);
}

/**
 * Clear all window states
 */
export function clearAllWindowStates(): void {
  windowStates.clear();
  currentWindowLabel = 'main';
  getCurrentWindow.mockClear();
  getAll.mockClear();
}

// Reset mocks between tests
beforeEach(() => {
  clearAllWindowStates();
});

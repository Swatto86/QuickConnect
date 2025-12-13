/**
 * Vitest Test Setup File
 *
 * This file runs before each test file and sets up the testing environment.
 */

import { vi, beforeAll, afterEach, beforeEach } from "vitest";

// Setup DOM environment
beforeAll(() => {
  // Create a basic document body for DOM tests
  document.body.innerHTML = "";
});

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();

  // Reset the document body
  document.body.innerHTML = "";

  // Clear any timers
  vi.clearAllTimers();

  // Restore real timers if fake ones were used
  vi.useRealTimers();
});

// Reset mocks before each test
beforeEach(() => {
  vi.resetModules();
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
  writable: true,
});

// Mock clipboard API
const clipboardMock = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(""),
  write: vi.fn().mockResolvedValue(undefined),
  read: vi.fn().mockResolvedValue([]),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

Object.defineProperty(navigator, "clipboard", {
  value: clipboardMock,
  writable: true,
  configurable: true,
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("dark") ? false : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock requestAnimationFrame and cancelAnimationFrame
let animationFrameId = 0;
const animationFrameCallbacks: Map<number, FrameRequestCallback> = new Map();

global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  const id = ++animationFrameId;
  animationFrameCallbacks.set(id, callback);
  // Execute callback asynchronously
  Promise.resolve().then(() => {
    const cb = animationFrameCallbacks.get(id);
    if (cb) {
      cb(performance.now());
      animationFrameCallbacks.delete(id);
    }
  });
  return id;
});

global.cancelAnimationFrame = vi.fn((id: number) => {
  animationFrameCallbacks.delete(id);
});

// Mock ResizeObserver
class ResizeObserverMock {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock IntersectionObserver
class IntersectionObserverMock {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.callback = callback;
    this.options = options;
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);

  get root() {
    return this.options?.root ?? null;
  }
  get rootMargin() {
    return this.options?.rootMargin ?? "0px";
  }
  get thresholds() {
    const threshold = this.options?.threshold;
    if (Array.isArray(threshold)) return threshold;
    return threshold !== undefined ? [threshold] : [0];
  }
}

global.IntersectionObserver =
  IntersectionObserverMock as unknown as typeof IntersectionObserver;

// Mock confirm dialog
window.confirm = vi.fn().mockReturnValue(true);

// Mock alert dialog
window.alert = vi.fn();

// Mock prompt dialog
window.prompt = vi.fn().mockReturnValue(null);

// Mock HTMLDialogElement methods if not available
if (typeof HTMLDialogElement === "undefined") {
  // @ts-expect-error - Creating mock for testing
  global.HTMLDialogElement = class HTMLDialogElement extends HTMLElement {
    open = false;

    showModal() {
      this.open = true;
      this.setAttribute("open", "");
    }

    show() {
      this.open = true;
      this.setAttribute("open", "");
    }

    close(returnValue?: string) {
      this.open = false;
      this.removeAttribute("open");
      if (returnValue !== undefined) {
        (this as HTMLDialogElement & { returnValue: string }).returnValue =
          returnValue;
      }
    }
  };
}

// Mock console methods to reduce noise (uncomment if needed)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});

// Keep console.error visible for debugging test failures
// vi.spyOn(console, 'error').mockImplementation(() => {});

// Export mocks for direct access in tests
export { localStorageMock, sessionStorageMock, clipboardMock };

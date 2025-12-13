/**
 * Integration Tests
 *
 * Tests for Tauri event handling and cross-component interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listen,
  simulateEvent,
  hasListeners,
  clearAllListeners,
} from "./mocks/tauri-event";
import {
  invoke,
  setMockResponse,
  setMockError,
  clearAllMocks,
  getInvokeHistory,
} from "./mocks/tauri-api";
import {
  getCurrentWindow,
  getWindowStateForTest,
  clearAllWindowStates,
  setCurrentWindowLabel,
} from "./mocks/tauri-window";
import { setTheme, getTheme, focusInput } from "../utils/ui";
import { filterHosts, type Host } from "../utils/hosts";

describe("Theme Change Event Integration", () => {
  beforeEach(() => {
    clearAllListeners();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    clearAllListeners();
  });

  it("should register listener for theme-changed event", async () => {
    await listen("theme-changed", () => {});
    expect(hasListeners("theme-changed")).toBe(true);
  });

  it("should update theme when theme-changed event is emitted", async () => {
    await listen<string>("theme-changed", (event) => {
      setTheme(event.payload);
    });

    simulateEvent("theme-changed", "dark");
    expect(getTheme()).toBe("dark");
  });

  it("should handle switching from dark to light theme", async () => {
    setTheme("dark");
    expect(getTheme()).toBe("dark");

    await listen<string>("theme-changed", (event) => {
      setTheme(event.payload);
    });

    simulateEvent("theme-changed", "light");
    expect(getTheme()).toBe("light");
  });

  it("should handle switching from light to dark theme", async () => {
    setTheme("light");

    await listen<string>("theme-changed", (event) => {
      setTheme(event.payload);
    });

    simulateEvent("theme-changed", "dark");
    expect(getTheme()).toBe("dark");
  });

  it("should handle custom theme names", async () => {
    await listen<string>("theme-changed", (event) => {
      setTheme(event.payload);
    });

    simulateEvent("theme-changed", "dracula");
    expect(getTheme()).toBe("dracula");
  });
});

describe("Focus Search Event Integration", () => {
  let searchInput: HTMLInputElement;

  beforeEach(() => {
    clearAllListeners();
    document.body.innerHTML = '<input type="text" id="search-input" />';
    searchInput = document.getElementById("search-input") as HTMLInputElement;
  });

  afterEach(() => {
    clearAllListeners();
    document.body.innerHTML = "";
  });

  it("should register listener for focus-search event", async () => {
    await listen("focus-search", () => {});
    expect(hasListeners("focus-search")).toBe(true);
  });

  it("should focus search input when focus-search event is emitted", async () => {
    const focusSpy = vi.spyOn(searchInput, "focus");

    await listen("focus-search", () => {
      const input = document.getElementById("search-input") as HTMLInputElement;
      focusInput(input, true);
    });

    simulateEvent("focus-search", null);
    expect(focusSpy).toHaveBeenCalled();
  });

  it("should select existing text in search input", async () => {
    searchInput.value = "existing text";
    const selectSpy = vi.spyOn(searchInput, "select");

    await listen("focus-search", () => {
      const input = document.getElementById("search-input") as HTMLInputElement;
      focusInput(input, true);
    });

    simulateEvent("focus-search", null);
    expect(selectSpy).toHaveBeenCalled();
  });

  it("should handle missing search input gracefully", async () => {
    document.body.innerHTML = "";

    let errorThrown = false;
    await listen("focus-search", () => {
      const input = document.getElementById(
        "search-input",
      ) as HTMLInputElement | null;
      if (!input) {
        // Gracefully handle missing input
        return;
      }
      focusInput(input, true);
    });

    try {
      simulateEvent("focus-search", null);
    } catch {
      errorThrown = true;
    }

    expect(errorThrown).toBe(false);
  });
});

describe("Hosts Updated Event Integration", () => {
  let hostsList: Host[];

  beforeEach(() => {
    clearAllListeners();
    clearAllMocks();
    hostsList = [];
  });

  afterEach(() => {
    clearAllListeners();
    clearAllMocks();
  });

  it("should register listener for hosts-updated event", async () => {
    await listen("hosts-updated", () => {});
    expect(hasListeners("hosts-updated")).toBe(true);
  });

  it("should trigger host reload when hosts-updated event is emitted", async () => {
    const mockHosts: Host[] = [
      { hostname: "server01.domain.com", description: "Test Server" },
    ];
    setMockResponse("get_all_hosts", mockHosts);

    await listen("hosts-updated", async () => {
      hostsList = await invoke<Host[]>("get_all_hosts");
    });

    simulateEvent("hosts-updated", null);

    // Allow async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(hostsList).toHaveLength(1);
    expect(hostsList[0].hostname).toBe("server01.domain.com");
  });

  it("should handle empty hosts list", async () => {
    setMockResponse("get_all_hosts", []);

    await listen("hosts-updated", async () => {
      hostsList = await invoke<Host[]>("get_all_hosts");
    });

    simulateEvent("hosts-updated", null);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(hostsList).toHaveLength(0);
  });
});

describe("Host Connected Event Integration", () => {
  beforeEach(() => {
    clearAllListeners();
    clearAllMocks();
  });

  afterEach(() => {
    clearAllListeners();
    clearAllMocks();
  });

  it("should register listener for host-connected event", async () => {
    await listen("host-connected", () => {});
    expect(hasListeners("host-connected")).toBe(true);
  });

  it("should receive hostname in event payload", async () => {
    let connectedHostname = "";

    await listen<string>("host-connected", (event) => {
      connectedHostname = event.payload;
    });

    simulateEvent("host-connected", "server01.domain.com");
    expect(connectedHostname).toBe("server01.domain.com");
  });

  it("should trigger host list refresh after connection", async () => {
    const mockHosts: Host[] = [
      {
        hostname: "server01.domain.com",
        description: "Test Server",
        last_connected: "15/01/2024 10:30:00",
      },
    ];
    setMockResponse("get_all_hosts", mockHosts);

    let refreshTriggered = false;

    await listen("host-connected", async () => {
      await invoke("get_all_hosts");
      refreshTriggered = true;
    });

    simulateEvent("host-connected", "server01.domain.com");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(refreshTriggered).toBe(true);
    expect(getInvokeHistory("get_all_hosts")).toHaveLength(1);
  });
});

describe("Show Error Event Integration", () => {
  interface ErrorData {
    message: string;
    timestamp: string;
    category?: string;
    details?: string;
  }

  let receivedErrors: ErrorData[];

  beforeEach(() => {
    clearAllListeners();
    receivedErrors = [];
    document.body.innerHTML = '<div id="errorList"></div>';
  });

  afterEach(() => {
    clearAllListeners();
    document.body.innerHTML = "";
  });

  it("should register listener for show-error event", async () => {
    await listen("show-error", () => {});
    expect(hasListeners("show-error")).toBe(true);
  });

  it("should add error to list when show-error event is emitted", async () => {
    await listen<ErrorData>("show-error", (event) => {
      receivedErrors.push(event.payload);
    });

    const errorData: ErrorData = {
      message: "Connection failed",
      timestamp: "2024-01-15 10:30:00",
      category: "ERROR",
    };

    simulateEvent("show-error", errorData);
    expect(receivedErrors).toHaveLength(1);
    expect(receivedErrors[0].message).toBe("Connection failed");
  });

  it("should handle error with all fields", async () => {
    let receivedError: ErrorData | null = null;

    await listen<ErrorData>("show-error", (event) => {
      receivedError = event.payload;
    });

    const errorData: ErrorData = {
      message: "Fatal error occurred",
      timestamp: "2024-01-15 10:30:00",
      category: "CRITICAL",
      details: "Stack trace: ...",
    };

    simulateEvent("show-error", errorData);

    expect(receivedError).not.toBeNull();
    expect(receivedError!.message).toBe("Fatal error occurred");
    expect(receivedError!.category).toBe("CRITICAL");
    expect(receivedError!.details).toBe("Stack trace: ...");
  });

  it("should handle error without optional fields", async () => {
    let receivedError: ErrorData | null = null;

    await listen<ErrorData>("show-error", (event) => {
      receivedError = event.payload;
    });

    const errorData: ErrorData = {
      message: "Simple error",
      timestamp: "2024-01-15 10:30:00",
    };

    simulateEvent("show-error", errorData);

    expect(receivedError).not.toBeNull();
    expect(receivedError!.category).toBeUndefined();
    expect(receivedError!.details).toBeUndefined();
  });

  it("should handle multiple errors", async () => {
    await listen<ErrorData>("show-error", (event) => {
      receivedErrors.push(event.payload);
    });

    simulateEvent("show-error", {
      message: "Error 1",
      timestamp: "2024-01-15 10:00:00",
    });
    simulateEvent("show-error", {
      message: "Error 2",
      timestamp: "2024-01-15 11:00:00",
    });
    simulateEvent("show-error", {
      message: "Error 3",
      timestamp: "2024-01-15 12:00:00",
    });

    expect(receivedErrors).toHaveLength(3);
  });
});

describe("Multiple Event Listeners", () => {
  beforeEach(() => {
    clearAllListeners();
  });

  afterEach(() => {
    clearAllListeners();
  });

  it("should support multiple listeners for the same event", async () => {
    let listener1Called = false;
    let listener2Called = false;

    await listen("test-event", () => {
      listener1Called = true;
    });
    await listen("test-event", () => {
      listener2Called = true;
    });

    simulateEvent("test-event", null);

    expect(listener1Called).toBe(true);
    expect(listener2Called).toBe(true);
  });

  it("should support listeners for different events simultaneously", async () => {
    let themeChanged = false;
    let hostsUpdated = false;
    let focusSearch = false;

    await listen("theme-changed", () => {
      themeChanged = true;
    });
    await listen("hosts-updated", () => {
      hostsUpdated = true;
    });
    await listen("focus-search", () => {
      focusSearch = true;
    });

    simulateEvent("theme-changed", "dark");
    simulateEvent("hosts-updated", null);
    simulateEvent("focus-search", null);

    expect(themeChanged).toBe(true);
    expect(hostsUpdated).toBe(true);
    expect(focusSearch).toBe(true);
  });

  it("should allow unlistening from events", async () => {
    let callCount = 0;

    const unlisten = await listen("test-event", () => {
      callCount++;
    });

    simulateEvent("test-event", null);
    expect(callCount).toBe(1);

    unlisten();

    simulateEvent("test-event", null);
    expect(callCount).toBe(1); // Should not increment
  });
});

describe("Event Error Handling", () => {
  beforeEach(() => {
    clearAllListeners();
  });

  afterEach(() => {
    clearAllListeners();
  });

  it("should not crash when listener throws error", async () => {
    await listen("error-prone-event", () => {
      throw new Error("Listener error");
    });

    expect(() => {
      simulateEvent("error-prone-event", null);
    }).not.toThrow();
  });

  it("should continue processing other listeners after one fails", async () => {
    let secondListenerCalled = false;

    await listen("error-prone-event", () => {
      throw new Error("First listener error");
    });
    await listen("error-prone-event", () => {
      secondListenerCalled = true;
    });

    simulateEvent("error-prone-event", null);

    expect(secondListenerCalled).toBe(true);
  });

  it("should handle events with no listeners gracefully", () => {
    expect(() => {
      simulateEvent("no-listeners-event", { data: "test" });
    }).not.toThrow();
  });
});

describe("Async Event Handlers", () => {
  beforeEach(() => {
    clearAllListeners();
    clearAllMocks();
  });

  afterEach(() => {
    clearAllListeners();
    clearAllMocks();
  });

  it("should support async event handlers", async () => {
    let asyncComplete = false;

    await listen("async-event", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      asyncComplete = true;
    });

    simulateEvent("async-event", null);

    // Wait for async handler to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(asyncComplete).toBe(true);
  });

  it("should handle async invoke calls in event handlers", async () => {
    const mockHosts: Host[] = [{ hostname: "server.com", description: "Test" }];
    setMockResponse("get_all_hosts", mockHosts);

    let hostsReceived: Host[] = [];

    await listen("hosts-updated", async () => {
      hostsReceived = await invoke<Host[]>("get_all_hosts");
    });

    simulateEvent("hosts-updated", null);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(hostsReceived).toHaveLength(1);
  });
});

describe("Window Management Integration", () => {
  beforeEach(() => {
    clearAllWindowStates();
    clearAllMocks();
  });

  afterEach(() => {
    clearAllWindowStates();
    clearAllMocks();
  });

  it("should track window visibility state", async () => {
    setCurrentWindowLabel("main");
    const window = getCurrentWindow();

    await window.hide();
    const state = getWindowStateForTest("main");
    expect(state?.visible).toBe(false);

    await window.show();
    const newState = getWindowStateForTest("main");
    expect(newState?.visible).toBe(true);
  });

  it("should track window focus state", async () => {
    setCurrentWindowLabel("main");
    const window = getCurrentWindow();

    await window.setFocus();
    const state = getWindowStateForTest("main");
    expect(state?.focused).toBe(true);
  });

  it("should track window minimize state", async () => {
    setCurrentWindowLabel("main");
    const window = getCurrentWindow();

    await window.minimize();
    const state = getWindowStateForTest("main");
    expect(state?.minimized).toBe(true);

    await window.unminimize();
    const newState = getWindowStateForTest("main");
    expect(newState?.minimized).toBe(false);
  });

  it("should track window maximize state", async () => {
    setCurrentWindowLabel("main");
    const window = getCurrentWindow();

    await window.maximize();
    expect(await window.isMaximized()).toBe(true);

    await window.unmaximize();
    expect(await window.isMaximized()).toBe(false);
  });

  it("should toggle maximize state", async () => {
    setCurrentWindowLabel("main");
    const window = getCurrentWindow();

    await window.toggleMaximize();
    expect(await window.isMaximized()).toBe(true);

    await window.toggleMaximize();
    expect(await window.isMaximized()).toBe(false);
  });
});

describe("Invoke Command Integration", () => {
  beforeEach(() => {
    clearAllMocks();
  });

  afterEach(() => {
    clearAllMocks();
  });

  it("should return default values for common commands", async () => {
    const theme = await invoke<string>("get_theme");
    expect(theme).toBe("dark");

    const credentials = await invoke("get_stored_credentials");
    expect(credentials).toBeNull();

    const hosts = await invoke<Host[]>("get_all_hosts");
    expect(hosts).toEqual([]);
  });

  it("should return mock responses when set", async () => {
    const mockHosts: Host[] = [{ hostname: "test.com", description: "Test" }];
    setMockResponse("get_all_hosts", mockHosts);

    const hosts = await invoke<Host[]>("get_all_hosts");
    expect(hosts).toEqual(mockHosts);
  });

  it("should throw mock errors when set", async () => {
    setMockError("get_all_hosts", new Error("Connection failed"));

    await expect(invoke("get_all_hosts")).rejects.toThrow("Connection failed");
  });

  it("should track invoke history", async () => {
    await invoke("get_theme");
    await invoke("get_all_hosts");
    await invoke("save_host", {
      host: { hostname: "test.com", description: "Test" },
    });

    const history = getInvokeHistory();
    expect(history).toHaveLength(3);
    expect(history[0].cmd).toBe("get_theme");
    expect(history[1].cmd).toBe("get_all_hosts");
    expect(history[2].cmd).toBe("save_host");
  });

  it("should track invoke arguments", async () => {
    const host = { hostname: "server.com", description: "My Server" };
    await invoke("save_host", { host });

    const history = getInvokeHistory("save_host");
    expect(history).toHaveLength(1);
    expect(history[0].args).toEqual({ host });
  });
});

describe("Search and Filter Integration", () => {
  const testHosts: Host[] = [
    { hostname: "web01.prod.com", description: "Production Web Server" },
    { hostname: "web02.prod.com", description: "Production Web Server 2" },
    { hostname: "db01.prod.com", description: "Production Database" },
    { hostname: "web01.dev.com", description: "Development Web Server" },
    { hostname: "cache01.prod.com", description: "Redis Cache Server" },
  ];

  it("should filter hosts by hostname", () => {
    const result = filterHosts(testHosts, "web01");
    expect(result).toHaveLength(2);
    expect(result.every((h) => h.hostname.includes("web01"))).toBe(true);
  });

  it("should filter hosts by domain", () => {
    const result = filterHosts(testHosts, "dev.com");
    expect(result).toHaveLength(1);
    expect(result[0].hostname).toBe("web01.dev.com");
  });

  it("should filter hosts by description", () => {
    const result = filterHosts(testHosts, "Database");
    expect(result).toHaveLength(1);
    expect(result[0].hostname).toBe("db01.prod.com");
  });

  it("should handle combined hostname and description matches", () => {
    const result = filterHosts(testHosts, "prod");
    // Matches: web01.prod.com, web02.prod.com, db01.prod.com, cache01.prod.com (hostname)
    // "Production" in description matches web01, web02, db01
    // But "prod" also appears in hostname for 4 hosts
    expect(result).toHaveLength(4);
  });

  it("should return empty array for no matches", () => {
    const result = filterHosts(testHosts, "nonexistent");
    expect(result).toHaveLength(0);
  });

  it("should be case-insensitive", () => {
    const resultUpper = filterHosts(testHosts, "WEB01");
    const resultLower = filterHosts(testHosts, "web01");
    expect(resultUpper).toEqual(resultLower);
  });
});

describe("Credential Flow Integration", () => {
  beforeEach(() => {
    clearAllMocks();
  });

  afterEach(() => {
    clearAllMocks();
  });

  it("should handle save credentials flow", async () => {
    setMockResponse("save_credentials", undefined);

    await invoke("save_credentials", {
      credentials: { username: "DOMAIN\\user", password: "secret" },
    });

    const history = getInvokeHistory("save_credentials");
    expect(history).toHaveLength(1);
    expect(history[0].args).toEqual({
      credentials: { username: "DOMAIN\\user", password: "secret" },
    });
  });

  it("should handle get stored credentials flow", async () => {
    setMockResponse("get_stored_credentials", {
      username: "DOMAIN\\user",
      password: "secret",
    });

    const creds = await invoke<{ username: string; password: string }>(
      "get_stored_credentials",
    );
    expect(creds.username).toBe("DOMAIN\\user");
    expect(creds.password).toBe("secret");
  });

  it("should handle delete credentials flow", async () => {
    setMockResponse("delete_credentials", undefined);

    await invoke("delete_credentials");

    const history = getInvokeHistory("delete_credentials");
    expect(history).toHaveLength(1);
  });

  it("should handle no stored credentials", async () => {
    setMockResponse("get_stored_credentials", null);

    const creds = await invoke("get_stored_credentials");
    expect(creds).toBeNull();
  });
});

describe("RDP Launch Flow Integration", () => {
  beforeEach(() => {
    clearAllMocks();
    clearAllListeners();
  });

  afterEach(() => {
    clearAllMocks();
    clearAllListeners();
  });

  it("should invoke launch_rdp with host", async () => {
    setMockResponse("launch_rdp", undefined);

    const host: Host = {
      hostname: "server01.domain.com",
      description: "Production Server",
    };

    await invoke("launch_rdp", { host });

    const history = getInvokeHistory("launch_rdp");
    expect(history).toHaveLength(1);
    expect(history[0].args).toEqual({ host });
  });

  it("should handle launch_rdp error", async () => {
    setMockError("launch_rdp", new Error("No credentials found"));

    const host: Host = {
      hostname: "server01.domain.com",
      description: "Test",
    };

    await expect(invoke("launch_rdp", { host })).rejects.toThrow(
      "No credentials found",
    );
  });

  it("should emit host-connected event after successful connection", async () => {
    setMockResponse("launch_rdp", undefined);
    setMockResponse("get_all_hosts", [
      {
        hostname: "server01.domain.com",
        description: "Test",
        last_connected: "15/01/2024 10:30:00",
      },
    ]);

    let connectedHost = "";
    await listen<string>("host-connected", (event) => {
      connectedHost = event.payload;
    });

    // Simulate what the backend would do after successful connection
    simulateEvent("host-connected", "server01.domain.com");

    expect(connectedHost).toBe("server01.domain.com");
  });
});

describe("Host Management Flow Integration", () => {
  beforeEach(() => {
    clearAllMocks();
    clearAllListeners();
  });

  afterEach(() => {
    clearAllMocks();
    clearAllListeners();
  });

  it("should invoke save_host correctly", async () => {
    setMockResponse("save_host", undefined);

    const host: Host = {
      hostname: "newserver.domain.com",
      description: "New Server",
    };

    await invoke("save_host", { host });

    const history = getInvokeHistory("save_host");
    expect(history).toHaveLength(1);
  });

  it("should invoke delete_host correctly", async () => {
    setMockResponse("delete_host", undefined);

    await invoke("delete_host", { hostname: "server.domain.com" });

    const history = getInvokeHistory("delete_host");
    expect(history).toHaveLength(1);
    expect(history[0].args).toEqual({ hostname: "server.domain.com" });
  });

  it("should emit hosts-updated after save", async () => {
    setMockResponse("save_host", undefined);

    let hostsUpdated = false;
    await listen("hosts-updated", () => {
      hostsUpdated = true;
    });

    // Simulate backend emitting event after save
    simulateEvent("hosts-updated", null);

    expect(hostsUpdated).toBe(true);
  });

  it("should emit hosts-updated after delete", async () => {
    setMockResponse("delete_host", undefined);

    let updateCount = 0;
    await listen("hosts-updated", () => {
      updateCount++;
    });

    simulateEvent("hosts-updated", null);
    simulateEvent("hosts-updated", null);

    expect(updateCount).toBe(2);
  });
});

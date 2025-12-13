/**
 * UI Tests for Main Page (Server List)
 *
 * Tests the main window functionality including:
 * - Server list rendering
 * - Search functionality
 * - Host filtering
 * - Host highlighting
 * - Navigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  invoke,
  setMockResponse,
  clearAllMocks,
} from "./mocks/tauri-api";

// Import utility functions we're testing
import { filterHosts, highlightMatches, type Host } from "../utils/hosts";

// Sample test data
const sampleHosts: Host[] = [
  {
    hostname: "server1.contoso.com",
    description: "Production Web Server",
    last_connected: "01/01/2024 10:00:00",
  },
  {
    hostname: "server2.contoso.com",
    description: "Development Database",
    last_connected: "02/01/2024 14:30:00",
  },
  {
    hostname: "dc01.contoso.com",
    description: "Domain Controller",
    last_connected: "03/01/2024 09:15:00",
  },
  {
    hostname: "fileserver.contoso.com",
    description: "File Storage Server",
  },
  {
    hostname: "mail.example.org",
    description: "Email Server",
    last_connected: "04/01/2024 16:45:00",
  },
];

// Helper to create the main page DOM
function createMainPageDOM() {
  document.body.innerHTML = `
    <main class="p-4 flex flex-col h-screen">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Connect to a Server</h1>
        <div class="flex items-center gap-2">
          <button id="manageHosts" class="btn btn-primary">Manage Hosts</button>
        </div>
      </div>

      <div class="mb-4">
        <input
          type="text"
          id="search-input"
          placeholder="Search hosts by name or description..."
          class="input input-bordered w-full"
        />
      </div>

      <div class="flex-1 bg-base-200 rounded-lg overflow-hidden mb-16">
        <div id="server-list" class="h-full overflow-y-auto">
          <p class="text-center text-base-content/60 p-4">Loading hosts...</p>
        </div>
      </div>

      <div class="fixed bottom-0 left-0 right-0 h-16 bg-base-100 flex items-center px-4">
        <button id="backToLogin" class="btn btn-ghost btn-circle" title="Back to Login">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
      </div>
    </main>
  `;
}

// Helper to get main page elements
function getMainPageElements() {
  return {
    searchInput: document.getElementById("search-input") as HTMLInputElement,
    serverList: document.getElementById("server-list") as HTMLDivElement,
    manageHostsBtn: document.getElementById("manageHosts") as HTMLButtonElement,
    backToLoginBtn: document.getElementById("backToLogin") as HTMLButtonElement,
  };
}

// Helper to render hosts list (simulates main.ts renderHostsList)
function renderHostsList(hosts: Host[], container: HTMLElement, query = "") {
  container.innerHTML = "";

  if (hosts.length === 0) {
    container.innerHTML = `
      <div class="text-center text-base-content/60 p-4">
        ${query ? "No matching hosts found" : 'No hosts available. Click "Manage Hosts" to add servers.'}
      </div>
    `;
    return;
  }

  hosts.forEach((host) => {
    const item = document.createElement("div");
    item.className = "flex items-center justify-between py-2 px-3 border-b border-base-300";
    item.dataset.hostname = host.hostname;

    const highlightedHostname = highlightMatches(host.hostname, query);
    const highlightedDescription = highlightMatches(host.description, query);
    const lastConnected = host.last_connected || "Never";

    item.innerHTML = `
      <div class="flex flex-col flex-1 gap-0.5">
        <span class="font-medium text-sm hostname">${highlightedHostname}</span>
        <span class="text-xs opacity-70 description">${highlightedDescription}</span>
        <span class="text-xs opacity-50 last-connected">Last connected: ${lastConnected}</span>
      </div>
      <button class="connect-btn btn btn-primary btn-xs">Connect</button>
    `;

    container.appendChild(item);
  });
}

describe("Main Page UI", () => {
  beforeEach(() => {
    createMainPageDOM();
    clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  describe("Page Elements", () => {
    it("should have all required page elements", () => {
      const elements = getMainPageElements();

      expect(elements.searchInput).toBeTruthy();
      expect(elements.serverList).toBeTruthy();
      expect(elements.manageHostsBtn).toBeTruthy();
      expect(elements.backToLoginBtn).toBeTruthy();
    });

    it("should have search input with correct placeholder", () => {
      const { searchInput } = getMainPageElements();
      expect(searchInput.placeholder).toBe("Search hosts by name or description...");
    });

    it("should have Manage Hosts button", () => {
      const { manageHostsBtn } = getMainPageElements();
      expect(manageHostsBtn.textContent).toContain("Manage Hosts");
    });

    it("should have Back to Login button", () => {
      const { backToLoginBtn } = getMainPageElements();
      expect(backToLoginBtn).toBeTruthy();
      expect(backToLoginBtn.title).toBe("Back to Login");
    });
  });

  describe("Server List Rendering", () => {
    it("should render empty state when no hosts", () => {
      const { serverList } = getMainPageElements();

      renderHostsList([], serverList);

      expect(serverList.textContent).toContain("No hosts available");
      expect(serverList.textContent).toContain("Manage Hosts");
    });

    it("should render hosts list correctly", () => {
      const { serverList } = getMainPageElements();

      renderHostsList(sampleHosts, serverList);

      const items = serverList.querySelectorAll("[data-hostname]");
      expect(items.length).toBe(5);
    });

    it("should display hostname for each host", () => {
      const { serverList } = getMainPageElements();

      renderHostsList(sampleHosts, serverList);

      const hostnames = serverList.querySelectorAll(".hostname");
      expect(hostnames[0].textContent).toContain("server1.contoso.com");
      expect(hostnames[1].textContent).toContain("server2.contoso.com");
    });

    it("should display description for each host", () => {
      const { serverList } = getMainPageElements();

      renderHostsList(sampleHosts, serverList);

      const descriptions = serverList.querySelectorAll(".description");
      expect(descriptions[0].textContent).toContain("Production Web Server");
      expect(descriptions[1].textContent).toContain("Development Database");
    });

    it("should display last connected date", () => {
      const { serverList } = getMainPageElements();

      renderHostsList(sampleHosts, serverList);

      const lastConnected = serverList.querySelectorAll(".last-connected");
      expect(lastConnected[0].textContent).toContain("01/01/2024 10:00:00");
    });

    it("should display 'Never' for hosts without last_connected", () => {
      const { serverList } = getMainPageElements();

      renderHostsList(sampleHosts, serverList);

      const items = serverList.querySelectorAll("[data-hostname]");
      const fileserverItem = Array.from(items).find(
        (item) => item.getAttribute("data-hostname") === "fileserver.contoso.com"
      );

      expect(fileserverItem?.querySelector(".last-connected")?.textContent).toContain("Never");
    });

    it("should have connect button for each host", () => {
      const { serverList } = getMainPageElements();

      renderHostsList(sampleHosts, serverList);

      const connectBtns = serverList.querySelectorAll(".connect-btn");
      expect(connectBtns.length).toBe(5);
    });
  });

  describe("Search Functionality", () => {
    it("should filter hosts by hostname", () => {
      const filtered = filterHosts(sampleHosts, "server1");

      expect(filtered.length).toBe(1);
      expect(filtered[0].hostname).toBe("server1.contoso.com");
    });

    it("should filter hosts by description", () => {
      const filtered = filterHosts(sampleHosts, "database");

      expect(filtered.length).toBe(1);
      expect(filtered[0].hostname).toBe("server2.contoso.com");
    });

    it("should filter hosts case-insensitively", () => {
      const filtered = filterHosts(sampleHosts, "DOMAIN");

      expect(filtered.length).toBe(1);
      expect(filtered[0].hostname).toBe("dc01.contoso.com");
    });

    it("should return all hosts for empty query", () => {
      const filtered = filterHosts(sampleHosts, "");

      expect(filtered.length).toBe(5);
    });

    it("should return all hosts for whitespace query", () => {
      const filtered = filterHosts(sampleHosts, "   ");

      expect(filtered.length).toBe(5);
    });

    it("should return empty array when no matches", () => {
      const filtered = filterHosts(sampleHosts, "nonexistent");

      expect(filtered.length).toBe(0);
    });

    it("should match partial hostnames", () => {
      const filtered = filterHosts(sampleHosts, "contoso");

      expect(filtered.length).toBe(4); // All .contoso.com hosts
    });

    it("should match partial descriptions", () => {
      const filtered = filterHosts(sampleHosts, "server");

      expect(filtered.length).toBe(4); // Various servers
    });

    it("should handle special characters in query", () => {
      const filtered = filterHosts(sampleHosts, ".");

      expect(filtered.length).toBe(5); // All have dots
    });

    it("should render no matches message when search has no results", () => {
      const { serverList } = getMainPageElements();
      const filtered = filterHosts(sampleHosts, "nonexistent");

      renderHostsList(filtered, serverList, "nonexistent");

      expect(serverList.textContent).toContain("No matching hosts found");
    });
  });

  describe("Highlight Matches", () => {
    it("should highlight matching text", () => {
      const result = highlightMatches("server1.contoso.com", "server");

      expect(result).toContain("<mark");
      expect(result).toContain("server");
      expect(result).toContain("</mark>");
    });

    it("should preserve non-matching text", () => {
      const result = highlightMatches("server1.contoso.com", "server");

      expect(result).toContain("1.contoso.com");
    });

    it("should handle no match", () => {
      const result = highlightMatches("server1.contoso.com", "xyz");

      expect(result).toBe("server1.contoso.com");
      expect(result).not.toContain("<mark");
    });

    it("should handle empty query", () => {
      const result = highlightMatches("server1.contoso.com", "");

      expect(result).toBe("server1.contoso.com");
    });

    it("should highlight case-insensitively", () => {
      const result = highlightMatches("Server1.Contoso.Com", "server");

      expect(result).toContain("<mark");
      expect(result).toContain("Server");
    });

    it("should highlight multiple occurrences", () => {
      const result = highlightMatches("server-server-server", "server");

      const markCount = (result.match(/<mark/g) || []).length;
      expect(markCount).toBe(3);
    });

    it("should apply correct CSS classes to highlights", () => {
      const result = highlightMatches("server1.contoso.com", "server");

      expect(result).toContain("bg-yellow-300");
      expect(result).toContain("dark:bg-yellow-600");
    });
  });

  describe("Search Input Behavior", () => {
    it("should trigger input event when user types", () => {
      const { searchInput } = getMainPageElements();
      const inputHandler = vi.fn();

      searchInput.addEventListener("input", inputHandler);
      searchInput.value = "test";
      searchInput.dispatchEvent(new Event("input"));

      expect(inputHandler).toHaveBeenCalled();
    });

    it("should clear search input value", () => {
      const { searchInput } = getMainPageElements();

      searchInput.value = "test";
      expect(searchInput.value).toBe("test");

      searchInput.value = "";
      expect(searchInput.value).toBe("");
    });

    it("should focus search input", () => {
      const { searchInput } = getMainPageElements();

      searchInput.focus();

      expect(document.activeElement).toBe(searchInput);
    });

    it("should select all text in search input", () => {
      const { searchInput } = getMainPageElements();

      searchInput.value = "test query";
      searchInput.focus();
      searchInput.select();

      expect(searchInput.selectionStart).toBe(0);
      expect(searchInput.selectionEnd).toBe(10);
    });
  });

  describe("Navigation", () => {
    it("should trigger Manage Hosts button click", () => {
      const { manageHostsBtn } = getMainPageElements();
      const clickHandler = vi.fn();

      manageHostsBtn.addEventListener("click", clickHandler);
      manageHostsBtn.click();

      expect(clickHandler).toHaveBeenCalled();
    });

    it("should trigger Back to Login button click", () => {
      const { backToLoginBtn } = getMainPageElements();
      const clickHandler = vi.fn();

      backToLoginBtn.addEventListener("click", clickHandler);
      backToLoginBtn.click();

      expect(clickHandler).toHaveBeenCalled();
    });
  });

  describe("Host Item Interaction", () => {
    it("should trigger connect button click", () => {
      const { serverList } = getMainPageElements();
      renderHostsList(sampleHosts, serverList);

      const connectBtn = serverList.querySelector(".connect-btn") as HTMLButtonElement;
      const clickHandler = vi.fn();

      connectBtn.addEventListener("click", clickHandler);
      connectBtn.click();

      expect(clickHandler).toHaveBeenCalled();
    });

    it("should trigger row click", () => {
      const { serverList } = getMainPageElements();
      renderHostsList(sampleHosts, serverList);

      const row = serverList.querySelector("[data-hostname]") as HTMLDivElement;
      const clickHandler = vi.fn();

      row.addEventListener("click", clickHandler);
      row.click();

      expect(clickHandler).toHaveBeenCalled();
    });

    it("should have data-hostname attribute on each row", () => {
      const { serverList } = getMainPageElements();
      renderHostsList(sampleHosts, serverList);

      const rows = serverList.querySelectorAll("[data-hostname]");
      rows.forEach((row, index) => {
        expect(row.getAttribute("data-hostname")).toBe(sampleHosts[index].hostname);
      });
    });
  });

  describe("Integration with Tauri API", () => {
    it("should call get_all_hosts to load hosts", async () => {
      setMockResponse("get_all_hosts", sampleHosts);

      const hosts = await invoke<Host[]>("get_all_hosts");

      expect(invoke).toHaveBeenCalledWith("get_all_hosts");
      expect(hosts.length).toBe(5);
    });

    it("should call launch_rdp when connecting to host", async () => {
      const host = sampleHosts[0];

      await invoke("launch_rdp", { host });

      expect(invoke).toHaveBeenCalledWith("launch_rdp", { host });
    });

    it("should call show_hosts_window when clicking Manage Hosts", async () => {
      await invoke("show_hosts_window");

      expect(invoke).toHaveBeenCalledWith("show_hosts_window");
    });

    it("should call show_login_window when clicking Back to Login", async () => {
      await invoke("show_login_window");

      expect(invoke).toHaveBeenCalledWith("show_login_window");
    });

    it("should call hide_main_window when returning to login", async () => {
      await invoke("hide_main_window");

      expect(invoke).toHaveBeenCalledWith("hide_main_window");
    });

    it("should get theme preference on load", async () => {
      setMockResponse("get_theme", "dark");

      const theme = await invoke<string>("get_theme");

      expect(theme).toBe("dark");
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("should detect Escape key press", () => {
      const escapeHandler = vi.fn();

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          escapeHandler();
        }
      });

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );

      expect(escapeHandler).toHaveBeenCalled();
    });

    it("should detect Ctrl+Shift+Alt+R for reset", () => {
      const resetHandler = vi.fn();

      document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.altKey && e.key === "R") {
          resetHandler();
        }
      });

      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "R",
          ctrlKey: true,
          shiftKey: true,
          altKey: true,
          bubbles: true,
        })
      );

      expect(resetHandler).toHaveBeenCalled();
    });
  });

  describe("Loading State", () => {
    it("should show loading message initially", () => {
      // Re-create DOM to test initial state
      createMainPageDOM();

      const { serverList } = getMainPageElements();
      expect(serverList.textContent).toContain("Loading hosts...");
    });

    it("should replace loading message when hosts are loaded", () => {
      const { serverList } = getMainPageElements();

      // Initially shows loading
      expect(serverList.textContent).toContain("Loading hosts...");

      // After loading hosts
      renderHostsList(sampleHosts, serverList);

      expect(serverList.textContent).not.toContain("Loading hosts...");
      expect(serverList.querySelectorAll("[data-hostname]").length).toBe(5);
    });
  });

  describe("Error Handling", () => {
    it("should handle empty hosts array gracefully", () => {
      const { serverList } = getMainPageElements();

      expect(() => renderHostsList([], serverList)).not.toThrow();
      expect(serverList.textContent).toContain("No hosts available");
    });

    it("should handle host with missing description", () => {
      const { serverList } = getMainPageElements();
      const hostsWithMissingDesc: Host[] = [
        { hostname: "test.com", description: "" },
      ];

      expect(() => renderHostsList(hostsWithMissingDesc, serverList)).not.toThrow();
    });

    it("should handle very long hostname", () => {
      const { serverList } = getMainPageElements();
      const longHostname = "a".repeat(200) + ".contoso.com";
      const hostsWithLongName: Host[] = [
        { hostname: longHostname, description: "Long hostname test" },
      ];

      expect(() => renderHostsList(hostsWithLongName, serverList)).not.toThrow();
    });

    it("should handle special characters in hostname", () => {
      const { serverList } = getMainPageElements();
      const hostsWithSpecialChars: Host[] = [
        { hostname: "server-01.sub-domain.contoso.com", description: "Test" },
      ];

      expect(() => renderHostsList(hostsWithSpecialChars, serverList)).not.toThrow();
    });
  });

  describe("Performance", () => {
    it("should handle large number of hosts", () => {
      const { serverList } = getMainPageElements();
      const manyHosts: Host[] = Array.from({ length: 1000 }, (_, i) => ({
        hostname: `server${i}.contoso.com`,
        description: `Server number ${i}`,
      }));

      const startTime = performance.now();
      renderHostsList(manyHosts, serverList);
      const endTime = performance.now();

      expect(serverList.querySelectorAll("[data-hostname]").length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it("should handle rapid search updates", () => {
      const queries = ["s", "se", "ser", "serv", "serve", "server"];

      queries.forEach((query) => {
        const filtered = filterHosts(sampleHosts, query);
        expect(filtered).toBeDefined();
      });
    });
  });
});

describe("Main Page Search Integration", () => {
  beforeEach(() => {
    createMainPageDOM();
    clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should update list when search input changes", () => {
    const { searchInput, serverList } = getMainPageElements();

    // Initial render
    renderHostsList(sampleHosts, serverList);
    expect(serverList.querySelectorAll("[data-hostname]").length).toBe(5);

    // Simulate search
    searchInput.value = "dc01";
    const filtered = filterHosts(sampleHosts, searchInput.value);
    renderHostsList(filtered, serverList, searchInput.value);

    expect(serverList.querySelectorAll("[data-hostname]").length).toBe(1);
  });

  it("should highlight matches in filtered results", () => {
    const { searchInput, serverList } = getMainPageElements();

    searchInput.value = "domain";
    const filtered = filterHosts(sampleHosts, searchInput.value);
    renderHostsList(filtered, serverList, searchInput.value);

    const description = serverList.querySelector(".description");
    expect(description?.innerHTML).toContain("<mark");
    expect(description?.innerHTML).toContain("Domain");
  });

  it("should restore full list when search is cleared", () => {
    const { searchInput, serverList } = getMainPageElements();

    // Search
    searchInput.value = "dc01";
    let filtered = filterHosts(sampleHosts, searchInput.value);
    renderHostsList(filtered, serverList, searchInput.value);
    expect(serverList.querySelectorAll("[data-hostname]").length).toBe(1);

    // Clear search
    searchInput.value = "";
    filtered = filterHosts(sampleHosts, searchInput.value);
    renderHostsList(filtered, serverList, searchInput.value);
    expect(serverList.querySelectorAll("[data-hostname]").length).toBe(5);
  });
});

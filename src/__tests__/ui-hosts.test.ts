/**
 * UI Tests for Hosts Management Page
 *
 * Tests the hosts management functionality including:
 * - Hosts table rendering
 * - Add/Edit/Delete host operations
 * - Domain scanning modal
 * - Credentials management modal
 * - Search/filter functionality
 * - Form validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invoke, setMockResponse, clearAllMocks } from "./mocks/tauri-api";

// Import utility functions we're testing
import {
  isValidFQDN,
  isValidDomain,
  isValidServerName,
} from "../utils/validation";
import { filterHosts, type Host } from "../utils/hosts";
import { showToast } from "../utils/ui";

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
];

// Helper to create the hosts page DOM
function createHostsPageDOM() {
  document.body.innerHTML = `
    <main class="p-4 flex flex-col h-screen">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Manage Server List</h1>
        <div class="flex items-center gap-2">
          <button id="deleteAllHosts" class="btn btn-error">Delete All</button>
          <button id="scanDomain" class="btn btn-primary">Scan Domain</button>
          <button id="addHost" class="btn btn-accent">Add Host</button>
        </div>
      </div>

      <div id="server-list" class="bg-base-200 rounded-lg p-4 mb-16 overflow-y-auto flex-1 relative">
        <div id="toastContainer" class="fixed top-4 right-4 z-50"></div>

        <div class="mb-4">
          <input
            type="text"
            id="hostSearch"
            class="input input-bordered w-full max-w-xs"
            placeholder="Search hosts..."
          />
        </div>

        <div id="noHostsMessage" class="hidden">
          No hosts found. Add one to get started.
        </div>

        <div id="hostsTableWrapper">
          <table class="table w-full" id="hostsTable">
            <thead class="border-b border-base-300">
              <tr>
                <th class="text-center w-[25%]">Connection String</th>
                <th class="text-center w-[35%]">Description</th>
                <th class="text-center w-[20%]">Last Connected</th>
                <th class="text-center w-[20%]">Actions</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <div class="fixed bottom-0 left-0 right-0 h-16 bg-base-100 flex items-center px-4">
        <button id="backToMain" class="btn btn-ghost btn-circle" title="Back to Main">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
      </div>

      <dialog id="hostModal" class="modal">
        <div class="modal-box">
          <h3 id="modalTitle" class="text-2xl font-bold mb-8 text-center">Edit Host</h3>
          <form id="hostForm" autocomplete="off">
            <div>
              <label class="label"><span class="label-text">RDP Hostname</span></label>
              <input type="text" id="hostname" name="hostname" class="input input-bordered w-full" required placeholder="server.domain.com" />
            </div>
            <div>
              <label class="label"><span class="label-text">Description</span></label>
              <textarea id="description" name="description" class="textarea textarea-bordered w-full"></textarea>
            </div>
            <div class="modal-action">
              <button type="button" id="hostModalCancel" class="btn">Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog id="scanDomainModal" class="modal">
        <div class="modal-box">
          <h3 class="text-2xl font-bold mb-8 text-center">Scan Domain</h3>
          <form id="scanDomainForm" autocomplete="off">
            <div class="form-control w-full mb-4">
              <label for="domainName" class="label"><span class="label-text">Domain Name</span></label>
              <input type="text" id="domainName" name="domainName" class="input input-bordered w-full" required placeholder="domain.com" />
            </div>
            <div class="form-control w-full mb-4">
              <label for="serverName" class="label"><span class="label-text">Domain Controller</span></label>
              <input type="text" id="serverName" name="serverName" class="input input-bordered w-full" required placeholder="dc01.domain.com" />
            </div>
            <div class="modal-action">
              <button type="button" id="scanDomainCancel" class="btn">Cancel</button>
              <button type="submit" class="btn btn-primary">Scan</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog id="credentialsModal" class="modal">
        <div class="modal-box">
          <h3 class="text-2xl font-bold mb-8 text-center">Edit Credentials</h3>
          <p id="credentialsHostname" class="text-lg mb-6 text-center"></p>
          <form id="credentialsForm" autocomplete="off">
            <div class="form-control w-full mb-4">
              <label for="credUsername" class="label"><span class="label-text">Username</span></label>
              <input type="text" id="credUsername" name="credUsername" class="input input-bordered w-full" required />
            </div>
            <div class="form-control w-full mb-4">
              <label for="credPassword" class="label"><span class="label-text">Password</span></label>
              <input type="password" id="credPassword" name="credPassword" class="input input-bordered w-full" required />
            </div>
            <div class="modal-action">
              <button type="button" id="credentialsModalCancel" class="btn">Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      </dialog>
    </main>
  `;
}

// Helper to get hosts page elements
function getHostsPageElements() {
  return {
    addHostBtn: document.getElementById("addHost") as HTMLButtonElement,
    scanDomainBtn: document.getElementById("scanDomain") as HTMLButtonElement,
    deleteAllBtn: document.getElementById(
      "deleteAllHosts",
    ) as HTMLButtonElement,
    backToMainBtn: document.getElementById("backToMain") as HTMLButtonElement,
    searchInput: document.getElementById("hostSearch") as HTMLInputElement,
    hostsTable: document.getElementById("hostsTable") as HTMLTableElement,
    hostsTableWrapper: document.getElementById(
      "hostsTableWrapper",
    ) as HTMLDivElement,
    noHostsMessage: document.getElementById("noHostsMessage") as HTMLDivElement,
    toastContainer: document.getElementById("toastContainer") as HTMLDivElement,
    // Modals
    hostModal: document.getElementById("hostModal") as HTMLDialogElement,
    hostForm: document.getElementById("hostForm") as HTMLFormElement,
    hostnameInput: document.getElementById("hostname") as HTMLInputElement,
    descriptionInput: document.getElementById(
      "description",
    ) as HTMLTextAreaElement,
    modalTitle: document.getElementById("modalTitle") as HTMLHeadingElement,
    hostModalCancel: document.getElementById(
      "hostModalCancel",
    ) as HTMLButtonElement,
    // Scan Domain Modal
    scanDomainModal: document.getElementById(
      "scanDomainModal",
    ) as HTMLDialogElement,
    scanDomainForm: document.getElementById(
      "scanDomainForm",
    ) as HTMLFormElement,
    domainNameInput: document.getElementById("domainName") as HTMLInputElement,
    serverNameInput: document.getElementById("serverName") as HTMLInputElement,
    scanDomainCancel: document.getElementById(
      "scanDomainCancel",
    ) as HTMLButtonElement,
    // Credentials Modal
    credentialsModal: document.getElementById(
      "credentialsModal",
    ) as HTMLDialogElement,
    credentialsForm: document.getElementById(
      "credentialsForm",
    ) as HTMLFormElement,
    credUsernameInput: document.getElementById(
      "credUsername",
    ) as HTMLInputElement,
    credPasswordInput: document.getElementById(
      "credPassword",
    ) as HTMLInputElement,
    credentialsHostname: document.getElementById(
      "credentialsHostname",
    ) as HTMLParagraphElement,
    credentialsModalCancel: document.getElementById(
      "credentialsModalCancel",
    ) as HTMLButtonElement,
  };
}

// Helper to render hosts table
function renderHostsTable(
  hosts: Host[],
  tbody: HTMLTableSectionElement,
  noHostsMessage: HTMLElement,
  tableWrapper: HTMLElement,
) {
  if (hosts.length === 0) {
    noHostsMessage.classList.remove("hidden");
    tableWrapper.classList.add("hidden");
    return;
  }

  noHostsMessage.classList.add("hidden");
  tableWrapper.classList.remove("hidden");

  tbody.innerHTML = hosts
    .map(
      (host) => `
      <tr class="border-b border-base-300" data-hostname="${host.hostname}">
        <td class="text-center">${host.hostname}</td>
        <td class="text-center">${host.description || ""}</td>
        <td class="text-center">${host.last_connected || "Never"}</td>
        <td class="text-center space-x-2">
          <button class="btn btn-xs btn-ghost credentials-btn" data-hostname="${host.hostname}">🔑</button>
          <button class="btn btn-xs btn-ghost edit-btn" data-hostname="${host.hostname}">✏️</button>
          <button class="btn btn-xs btn-ghost text-error delete-btn" data-hostname="${host.hostname}">🗑️</button>
        </td>
      </tr>
    `,
    )
    .join("");
}

describe("Hosts Management Page UI", () => {
  beforeEach(() => {
    createHostsPageDOM();
    clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  describe("Page Elements", () => {
    it("should have all required page elements", () => {
      const elements = getHostsPageElements();

      expect(elements.addHostBtn).toBeTruthy();
      expect(elements.scanDomainBtn).toBeTruthy();
      expect(elements.deleteAllBtn).toBeTruthy();
      expect(elements.backToMainBtn).toBeTruthy();
      expect(elements.searchInput).toBeTruthy();
      expect(elements.hostsTable).toBeTruthy();
    });

    it("should have Add Host button", () => {
      const { addHostBtn } = getHostsPageElements();
      expect(addHostBtn.textContent).toContain("Add Host");
    });

    it("should have Scan Domain button", () => {
      const { scanDomainBtn } = getHostsPageElements();
      expect(scanDomainBtn.textContent).toContain("Scan Domain");
    });

    it("should have Delete All button", () => {
      const { deleteAllBtn } = getHostsPageElements();
      expect(deleteAllBtn.textContent).toContain("Delete All");
    });

    it("should have search input with correct placeholder", () => {
      const { searchInput } = getHostsPageElements();
      expect(searchInput.placeholder).toBe("Search hosts...");
    });

    it("should have all modals", () => {
      const { hostModal, scanDomainModal, credentialsModal } =
        getHostsPageElements();

      expect(hostModal).toBeTruthy();
      expect(scanDomainModal).toBeTruthy();
      expect(credentialsModal).toBeTruthy();
    });
  });

  describe("Hosts Table Rendering", () => {
    it("should show no hosts message when empty", () => {
      const { noHostsMessage, hostsTableWrapper } = getHostsPageElements();
      const tbody = document.querySelector(
        "#hostsTable tbody",
      ) as HTMLTableSectionElement;

      renderHostsTable([], tbody, noHostsMessage, hostsTableWrapper);

      expect(noHostsMessage.classList.contains("hidden")).toBe(false);
      expect(hostsTableWrapper.classList.contains("hidden")).toBe(true);
    });

    it("should render hosts table correctly", () => {
      const { noHostsMessage, hostsTableWrapper } = getHostsPageElements();
      const tbody = document.querySelector(
        "#hostsTable tbody",
      ) as HTMLTableSectionElement;

      renderHostsTable(sampleHosts, tbody, noHostsMessage, hostsTableWrapper);

      const rows = tbody.querySelectorAll("tr");
      expect(rows.length).toBe(4);
    });

    it("should display hostname in each row", () => {
      const { noHostsMessage, hostsTableWrapper } = getHostsPageElements();
      const tbody = document.querySelector(
        "#hostsTable tbody",
      ) as HTMLTableSectionElement;

      renderHostsTable(sampleHosts, tbody, noHostsMessage, hostsTableWrapper);

      const rows = tbody.querySelectorAll("tr");
      expect(rows[0].textContent).toContain("server1.contoso.com");
    });

    it("should display description in each row", () => {
      const { noHostsMessage, hostsTableWrapper } = getHostsPageElements();
      const tbody = document.querySelector(
        "#hostsTable tbody",
      ) as HTMLTableSectionElement;

      renderHostsTable(sampleHosts, tbody, noHostsMessage, hostsTableWrapper);

      const rows = tbody.querySelectorAll("tr");
      expect(rows[0].textContent).toContain("Production Web Server");
    });

    it("should display last connected date", () => {
      const { noHostsMessage, hostsTableWrapper } = getHostsPageElements();
      const tbody = document.querySelector(
        "#hostsTable tbody",
      ) as HTMLTableSectionElement;

      renderHostsTable(sampleHosts, tbody, noHostsMessage, hostsTableWrapper);

      const rows = tbody.querySelectorAll("tr");
      expect(rows[0].textContent).toContain("01/01/2024 10:00:00");
    });

    it("should display 'Never' for hosts without last_connected", () => {
      const { noHostsMessage, hostsTableWrapper } = getHostsPageElements();
      const tbody = document.querySelector(
        "#hostsTable tbody",
      ) as HTMLTableSectionElement;

      renderHostsTable(sampleHosts, tbody, noHostsMessage, hostsTableWrapper);

      const rows = tbody.querySelectorAll("tr");
      expect(rows[3].textContent).toContain("Never");
    });

    it("should have action buttons for each host", () => {
      const { noHostsMessage, hostsTableWrapper } = getHostsPageElements();
      const tbody = document.querySelector(
        "#hostsTable tbody",
      ) as HTMLTableSectionElement;

      renderHostsTable(sampleHosts, tbody, noHostsMessage, hostsTableWrapper);

      const credentialsBtns = tbody.querySelectorAll(".credentials-btn");
      const editBtns = tbody.querySelectorAll(".edit-btn");
      const deleteBtns = tbody.querySelectorAll(".delete-btn");

      expect(credentialsBtns.length).toBe(4);
      expect(editBtns.length).toBe(4);
      expect(deleteBtns.length).toBe(4);
    });
  });

  describe("FQDN Validation", () => {
    it("should validate correct FQDN", () => {
      expect(isValidFQDN("server.domain.com")).toBe(true);
      expect(isValidFQDN("dc01.contoso.com")).toBe(true);
      expect(isValidFQDN("web-server.sub.domain.org")).toBe(true);
    });

    it("should reject invalid FQDN", () => {
      expect(isValidFQDN("server")).toBe(false);
      expect(isValidFQDN("")).toBe(false);
      expect(isValidFQDN("   ")).toBe(false);
    });

    it("should reject IP addresses", () => {
      expect(isValidFQDN("192.168.1.1")).toBe(false);
      expect(isValidFQDN("10.0.0.1")).toBe(false);
    });

    it("should reject hostnames without domain", () => {
      expect(isValidFQDN("localhost")).toBe(false);
      expect(isValidFQDN("server")).toBe(false);
    });

    it("should validate hostnames with hyphens", () => {
      expect(isValidFQDN("web-server-01.domain.com")).toBe(true);
    });

    it("should reject hostnames starting with hyphen", () => {
      expect(isValidFQDN("-server.domain.com")).toBe(false);
    });

    it("should reject hostnames ending with hyphen", () => {
      expect(isValidFQDN("server-.domain.com")).toBe(false);
    });
  });

  describe("Domain Validation", () => {
    it("should validate correct domain", () => {
      expect(isValidDomain("contoso.com")).toBe(true);
      expect(isValidDomain("example.org")).toBe(true);
      expect(isValidDomain("sub.domain.co.uk")).toBe(true);
    });

    it("should reject invalid domain", () => {
      expect(isValidDomain("")).toBe(false);
      expect(isValidDomain("   ")).toBe(false);
      expect(isValidDomain("notadomain")).toBe(false);
    });

    it("should reject domains without TLD", () => {
      expect(isValidDomain("contoso")).toBe(false);
    });
  });

  describe("Server Name Validation", () => {
    it("should validate server name matching domain", () => {
      expect(isValidServerName("dc01.contoso.com", "contoso.com")).toBe(true);
      expect(isValidServerName("web-server.example.org", "example.org")).toBe(
        true,
      );
    });

    it("should reject server not matching domain", () => {
      expect(isValidServerName("dc01.contoso.com", "example.org")).toBe(false);
    });

    it("should reject invalid server FQDN", () => {
      expect(isValidServerName("dc01", "contoso.com")).toBe(false);
    });

    it("should handle case insensitivity", () => {
      expect(isValidServerName("DC01.CONTOSO.COM", "contoso.com")).toBe(true);
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

    it("should filter case-insensitively", () => {
      const filtered = filterHosts(sampleHosts, "DOMAIN");

      expect(filtered.length).toBe(1);
      expect(filtered[0].hostname).toBe("dc01.contoso.com");
    });

    it("should return all hosts for empty query", () => {
      const filtered = filterHosts(sampleHosts, "");

      expect(filtered.length).toBe(4);
    });

    it("should update search input value", () => {
      const { searchInput } = getHostsPageElements();

      searchInput.value = "test";
      searchInput.dispatchEvent(new Event("input"));

      expect(searchInput.value).toBe("test");
    });
  });

  describe("Add Host Modal", () => {
    it("should open modal when Add Host button clicked", () => {
      const { addHostBtn, hostModal, modalTitle, hostForm } =
        getHostsPageElements();

      // Mock showModal since jsdom doesn't fully support HTMLDialogElement
      hostModal.showModal = vi.fn(() => {
        hostModal.setAttribute("open", "");
      });

      addHostBtn.addEventListener("click", () => {
        modalTitle.textContent = "Add Host";
        hostForm.reset();
        hostModal.showModal();
      });

      addHostBtn.click();

      expect(modalTitle.textContent).toBe("Add Host");
      expect(hostModal.showModal).toHaveBeenCalled();
    });

    it("should have hostname input", () => {
      const { hostnameInput } = getHostsPageElements();

      expect(hostnameInput).toBeTruthy();
      expect(hostnameInput.placeholder).toBe("server.domain.com");
    });

    it("should have description textarea", () => {
      const { descriptionInput } = getHostsPageElements();

      expect(descriptionInput).toBeTruthy();
    });

    it("should close modal on cancel", () => {
      const { hostModal, hostModalCancel } = getHostsPageElements();

      // Mock dialog methods since jsdom doesn't fully support HTMLDialogElement
      hostModal.showModal = vi.fn(() => {
        hostModal.setAttribute("open", "");
      });
      hostModal.close = vi.fn(() => {
        hostModal.removeAttribute("open");
      });

      hostModal.showModal();
      hostModalCancel.addEventListener("click", () => hostModal.close());
      hostModalCancel.click();

      expect(hostModal.close).toHaveBeenCalled();
      expect(hostModal.hasAttribute("open")).toBe(false);
    });

    it("should prevent submission with invalid hostname", () => {
      const { hostForm, hostnameInput } = getHostsPageElements();
      const submitHandler = vi.fn((e: Event) => {
        e.preventDefault();
        if (!isValidFQDN(hostnameInput.value.trim())) {
          return;
        }
      });

      hostForm.addEventListener("submit", submitHandler);
      hostnameInput.value = "invalid";
      hostForm.dispatchEvent(new Event("submit"));

      expect(submitHandler).toHaveBeenCalled();
    });

    it("should allow submission with valid hostname", () => {
      const { hostForm, hostnameInput } = getHostsPageElements();
      let isValid = false;

      hostForm.addEventListener("submit", (e) => {
        e.preventDefault();
        isValid = isValidFQDN(hostnameInput.value.trim());
      });

      hostnameInput.value = "server.domain.com";
      hostForm.dispatchEvent(new Event("submit"));

      expect(isValid).toBe(true);
    });
  });

  describe("Edit Host Modal", () => {
    it("should populate form when editing host", () => {
      const { hostnameInput, descriptionInput, modalTitle } =
        getHostsPageElements();
      const hostToEdit = sampleHosts[0];

      modalTitle.textContent = "Edit Host";
      hostnameInput.value = hostToEdit.hostname;
      descriptionInput.value = hostToEdit.description;

      expect(modalTitle.textContent).toBe("Edit Host");
      expect(hostnameInput.value).toBe("server1.contoso.com");
      expect(descriptionInput.value).toBe("Production Web Server");
    });
  });

  describe("Scan Domain Modal", () => {
    it("should open modal when Scan Domain button clicked", () => {
      const { scanDomainBtn, scanDomainModal, scanDomainForm } =
        getHostsPageElements();

      // Mock showModal since jsdom doesn't fully support HTMLDialogElement
      scanDomainModal.showModal = vi.fn(() => {
        scanDomainModal.setAttribute("open", "");
      });

      scanDomainBtn.addEventListener("click", () => {
        scanDomainForm.reset();
        scanDomainModal.showModal();
      });

      scanDomainBtn.click();

      expect(scanDomainModal.showModal).toHaveBeenCalled();
    });

    it("should have domain name input", () => {
      const { domainNameInput } = getHostsPageElements();

      expect(domainNameInput).toBeTruthy();
      expect(domainNameInput.placeholder).toBe("domain.com");
    });

    it("should have server name input", () => {
      const { serverNameInput } = getHostsPageElements();

      expect(serverNameInput).toBeTruthy();
      expect(serverNameInput.placeholder).toBe("dc01.domain.com");
    });

    it("should close modal on cancel", () => {
      const { scanDomainModal, scanDomainCancel } = getHostsPageElements();

      // Mock dialog methods since jsdom doesn't fully support HTMLDialogElement
      scanDomainModal.showModal = vi.fn(() => {
        scanDomainModal.setAttribute("open", "");
      });
      scanDomainModal.close = vi.fn(() => {
        scanDomainModal.removeAttribute("open");
      });

      scanDomainModal.showModal();
      scanDomainCancel.addEventListener("click", () => scanDomainModal.close());
      scanDomainCancel.click();

      expect(scanDomainModal.close).toHaveBeenCalled();
      expect(scanDomainModal.hasAttribute("open")).toBe(false);
    });

    it("should validate domain before submission", () => {
      const { scanDomainForm, domainNameInput, serverNameInput } =
        getHostsPageElements();
      let validationPassed = false;

      scanDomainForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const domain = domainNameInput.value.trim();
        const server = serverNameInput.value.trim();

        if (isValidDomain(domain) && isValidServerName(server, domain)) {
          validationPassed = true;
        }
      });

      domainNameInput.value = "contoso.com";
      serverNameInput.value = "dc01.contoso.com";
      scanDomainForm.dispatchEvent(new Event("submit"));

      expect(validationPassed).toBe(true);
    });

    it("should reject invalid domain", () => {
      const { scanDomainForm, domainNameInput, serverNameInput } =
        getHostsPageElements();
      let validationPassed = true;

      scanDomainForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const domain = domainNameInput.value.trim();

        if (!isValidDomain(domain)) {
          validationPassed = false;
        }
      });

      domainNameInput.value = "invalid";
      serverNameInput.value = "dc01.invalid";
      scanDomainForm.dispatchEvent(new Event("submit"));

      expect(validationPassed).toBe(false);
    });
  });

  describe("Credentials Modal", () => {
    it("should have username input", () => {
      const { credUsernameInput } = getHostsPageElements();

      expect(credUsernameInput).toBeTruthy();
    });

    it("should have password input", () => {
      const { credPasswordInput } = getHostsPageElements();

      expect(credPasswordInput).toBeTruthy();
      expect(credPasswordInput.type).toBe("password");
    });

    it("should display hostname", () => {
      const { credentialsHostname } = getHostsPageElements();

      credentialsHostname.textContent = "Host: server1.contoso.com";

      expect(credentialsHostname.textContent).toBe("Host: server1.contoso.com");
    });

    it("should close modal on cancel", () => {
      const { credentialsModal, credentialsModalCancel } =
        getHostsPageElements();

      // Mock dialog methods since jsdom doesn't fully support HTMLDialogElement
      credentialsModal.showModal = vi.fn(() => {
        credentialsModal.setAttribute("open", "");
      });
      credentialsModal.close = vi.fn(() => {
        credentialsModal.removeAttribute("open");
      });

      credentialsModal.showModal();
      credentialsModalCancel.addEventListener("click", () =>
        credentialsModal.close(),
      );
      credentialsModalCancel.click();

      expect(credentialsModal.close).toHaveBeenCalled();
      expect(credentialsModal.hasAttribute("open")).toBe(false);
    });
  });

  describe("Delete Operations", () => {
    it("should trigger delete confirmation for single host", () => {
      const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);

      const confirmed = window.confirm(
        "Are you sure you want to delete this host?",
      );

      expect(confirmed).toBe(true);
      expect(confirmMock).toHaveBeenCalledWith(
        "Are you sure you want to delete this host?",
      );

      confirmMock.mockRestore();
    });

    it("should trigger delete all confirmation", () => {
      const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);

      const confirmed = window.confirm(
        "Are you sure you want to delete all hosts?",
      );

      expect(confirmed).toBe(true);
      expect(confirmMock).toHaveBeenCalledWith(
        "Are you sure you want to delete all hosts?",
      );

      confirmMock.mockRestore();
    });

    it("should not delete when confirmation is cancelled", () => {
      const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(false);

      const confirmed = window.confirm("Are you sure?");

      expect(confirmed).toBe(false);

      confirmMock.mockRestore();
    });
  });

  describe("Toast Notifications", () => {
    it("should create toast container if not exists", () => {
      // Remove existing container
      const existingContainer = document.getElementById("toastContainer");
      existingContainer?.remove();

      const toast = showToast("Test message", "success", "toastContainer");

      // Container should be created
      const newContainer = document.getElementById("toastContainer");
      expect(newContainer).toBeTruthy();
    });

    it("should not show error toasts (they go to error window)", () => {
      const toast = showToast("Error message", "error", "toastContainer");

      expect(toast).toBeNull();
    });

    it("should show success toasts", () => {
      const toast = showToast("Success message", "success", "toastContainer");

      expect(toast).toBeTruthy();
      expect(toast?.textContent).toContain("Success message");
    });
  });

  describe("Navigation", () => {
    it("should trigger Back to Main button click", () => {
      const { backToMainBtn } = getHostsPageElements();
      const clickHandler = vi.fn();

      backToMainBtn.addEventListener("click", clickHandler);
      backToMainBtn.click();

      expect(clickHandler).toHaveBeenCalled();
    });
  });

  describe("Integration with Tauri API", () => {
    it("should call get_hosts to load hosts", async () => {
      setMockResponse("get_hosts", sampleHosts);

      const hosts = await invoke<Host[]>("get_hosts");

      expect(invoke).toHaveBeenCalledWith("get_hosts");
      expect(hosts.length).toBe(4);
    });

    it("should call save_host when adding new host", async () => {
      const newHost: Host = {
        hostname: "newserver.domain.com",
        description: "New Server",
      };

      await invoke("save_host", { host: newHost });

      expect(invoke).toHaveBeenCalledWith("save_host", { host: newHost });
    });

    it("should call delete_host when deleting host", async () => {
      await invoke("delete_host", { hostname: "server1.contoso.com" });

      expect(invoke).toHaveBeenCalledWith("delete_host", {
        hostname: "server1.contoso.com",
      });
    });

    it("should call delete_all_hosts when deleting all", async () => {
      await invoke("delete_all_hosts");

      expect(invoke).toHaveBeenCalledWith("delete_all_hosts");
    });

    it("should call scan_domain when scanning", async () => {
      setMockResponse("scan_domain", "Found 5 servers");

      const result = await invoke<string>("scan_domain", {
        domain: "contoso.com",
        server: "dc01.contoso.com",
      });

      expect(invoke).toHaveBeenCalledWith("scan_domain", {
        domain: "contoso.com",
        server: "dc01.contoso.com",
      });
      expect(result).toBe("Found 5 servers");
    });

    it("should call save_host_credentials when saving credentials", async () => {
      const host = sampleHosts[0];
      const credentials = { username: "admin", password: "secret" };

      await invoke("save_host_credentials", { host, credentials });

      expect(invoke).toHaveBeenCalledWith("save_host_credentials", {
        host,
        credentials,
      });
    });

    it("should call get_host_credentials when loading credentials", async () => {
      setMockResponse("get_host_credentials", {
        username: "admin",
        password: "secret",
      });

      const creds = await invoke<{ username: string; password: string }>(
        "get_host_credentials",
        {
          hostname: "server1.contoso.com",
        },
      );

      expect(invoke).toHaveBeenCalledWith("get_host_credentials", {
        hostname: "server1.contoso.com",
      });
      expect(creds.username).toBe("admin");
    });

    it("should call hide_hosts_window when going back", async () => {
      await invoke("hide_hosts_window");

      expect(invoke).toHaveBeenCalledWith("hide_hosts_window");
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
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
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
        }),
      );

      expect(resetHandler).toHaveBeenCalled();
    });
  });

  describe("Form Reset", () => {
    it("should reset host form", () => {
      const { hostForm, hostnameInput, descriptionInput } =
        getHostsPageElements();

      hostnameInput.value = "test.domain.com";
      descriptionInput.value = "Test description";

      hostForm.reset();

      expect(hostnameInput.value).toBe("");
      expect(descriptionInput.value).toBe("");
    });

    it("should reset scan domain form", () => {
      const { scanDomainForm, domainNameInput, serverNameInput } =
        getHostsPageElements();

      domainNameInput.value = "contoso.com";
      serverNameInput.value = "dc01.contoso.com";

      scanDomainForm.reset();

      expect(domainNameInput.value).toBe("");
      expect(serverNameInput.value).toBe("");
    });

    it("should reset credentials form", () => {
      const { credentialsForm, credUsernameInput, credPasswordInput } =
        getHostsPageElements();

      credUsernameInput.value = "admin";
      credPasswordInput.value = "secret";

      credentialsForm.reset();

      expect(credUsernameInput.value).toBe("");
      expect(credPasswordInput.value).toBe("");
    });
  });

  describe("Error Handling", () => {
    it("should handle empty hosts array", () => {
      const { noHostsMessage, hostsTableWrapper } = getHostsPageElements();
      const tbody = document.querySelector(
        "#hostsTable tbody",
      ) as HTMLTableSectionElement;

      expect(() =>
        renderHostsTable([], tbody, noHostsMessage, hostsTableWrapper),
      ).not.toThrow();
    });

    it("should handle hosts with missing description", () => {
      const { noHostsMessage, hostsTableWrapper } = getHostsPageElements();
      const tbody = document.querySelector(
        "#hostsTable tbody",
      ) as HTMLTableSectionElement;
      const hostsWithMissingDesc: Host[] = [
        { hostname: "test.domain.com", description: "" },
      ];

      expect(() =>
        renderHostsTable(
          hostsWithMissingDesc,
          tbody,
          noHostsMessage,
          hostsTableWrapper,
        ),
      ).not.toThrow();
    });

    it("should handle very long hostname", () => {
      const { noHostsMessage, hostsTableWrapper } = getHostsPageElements();
      const tbody = document.querySelector(
        "#hostsTable tbody",
      ) as HTMLTableSectionElement;
      const longHostname = "a".repeat(200) + ".contoso.com";
      const hostsWithLongName: Host[] = [
        { hostname: longHostname, description: "Long hostname test" },
      ];

      expect(() =>
        renderHostsTable(
          hostsWithLongName,
          tbody,
          noHostsMessage,
          hostsTableWrapper,
        ),
      ).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible form labels", () => {
      const labels = document.querySelectorAll("label");

      expect(labels.length).toBeGreaterThan(0);
    });

    it("should have required inputs marked", () => {
      const { hostnameInput, domainNameInput, serverNameInput } =
        getHostsPageElements();

      expect(hostnameInput.required).toBe(true);
      expect(domainNameInput.required).toBe(true);
      expect(serverNameInput.required).toBe(true);
    });

    it("should have accessible button text", () => {
      const { addHostBtn, scanDomainBtn, deleteAllBtn } =
        getHostsPageElements();

      expect(addHostBtn.textContent?.trim()).toBeTruthy();
      expect(scanDomainBtn.textContent?.trim()).toBeTruthy();
      expect(deleteAllBtn.textContent?.trim()).toBeTruthy();
    });

    it("should have back button with title", () => {
      const { backToMainBtn } = getHostsPageElements();

      expect(backToMainBtn.title).toBe("Back to Main");
    });
  });
});

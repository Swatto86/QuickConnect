/**
 * Host Management Window Script for QuickConnect
 *
 * This module handles the host management window where administrators can:
 * - Add, edit, and delete RDP hosts manually
 * - Scan Active Directory for Windows servers
 * - Set per-host credentials for specific servers
 * - Search and filter the hosts list
 *
 * Features:
 * - FQDN validation for hostnames
 * - Modal-based UI for host editing
 * - AD domain scanning with LDAP integration
 * - Credential override for individual hosts
 * - Real-time search and filtering
 *
 * @module hosts
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Import utility functions
import {
  isValidFQDN,
  isValidDomain,
  isValidServerName,
} from "./utils/validation";
import { filterHosts as filterHostsUtil, type Host } from "./utils/hosts";
import { showToast as showToastUtil } from "./utils/ui";

// Host interface is now imported from utils/hosts

interface StoredCredentials {
  username: string;
  password: string;
}

let hosts: Host[] = [];
let filteredHosts: Host[] = [];

/**
 * Displays an error in the dedicated error window.
 * If the error window cannot be shown, the error is silently ignored.
 * This is acceptable as the error window is always available in normal operation.
 * 
 * @param message - User-friendly error message
 * @param category - Optional error category (e.g., 'CSV_OPERATIONS', 'LDAP_SCAN', 'HOST_CREDENTIALS')
 * @param details - Optional technical details for debugging
 */
async function showError(message: string, category?: string, details?: string) {
  try {
    await invoke("show_error", {
      message,
      category: category || "ERROR",
      details: details || undefined,
    });
  } catch {
    // If error window cannot be shown, error will be lost
    // In production, this should be rare as error window is always available
  }
}

/**
 * Initializes the theme system and sets up event listeners for the hosts window.
 * Loads the saved theme preference (defaults to dark mode).
 * Listens for theme changes from the system tray and hosts-updated events.
 */
async function initializeTheme() {
  let defaultTheme = "dark";

  // Try to get saved theme preference
  try {
    defaultTheme = await invoke<string>("get_theme");
  } catch {
    // Silently fall back to dark theme if preference cannot be loaded
  }

  document.documentElement.setAttribute("data-theme", defaultTheme);

  // Listen for theme change events from the system tray
  await listen<string>("theme-changed", (event) => {
    const newTheme = event.payload;
    document.documentElement.setAttribute("data-theme", newTheme);
  });

  // Listen for hosts-updated events to refresh the hosts list
  await listen("hosts-updated", async () => {
    await loadHosts();
  });
}

/**
 * Handles the "Add Host" button click event.
 * Opens the host modal dialog with a clean form.
 */
function handleAddHostClick(): void {
  const modal = document.getElementById("hostModal") as HTMLDialogElement;
  document.getElementById("modalTitle")!.textContent = "Add Host";
  const form = document.getElementById("hostForm") as HTMLFormElement;
  form.reset();
  modal.showModal();
}

/**
 * Handles the host form submission event.
 * Validates hostname and description, then saves the host to the backend.
 * 
 * @param e - The form submit event
 */
async function handleHostFormSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const hostnameInput = document.getElementById("hostname") as HTMLInputElement;
  const descriptionInput = document.getElementById("description") as HTMLTextAreaElement;
  
  const hostname = hostnameInput.value.trim();
  const description = descriptionInput.value;

  // Validate hostname length
  if (hostname.length > 253) {
    alert("Hostname must not exceed 253 characters");
    return;
  }

  // Validate hostname format
  if (!isValidFQDN(hostname)) {
    alert("Please enter a valid hostname in the format: server.domain.com");
    return;
  }

  // Validate description length
  if (description.length > 500) {
    alert("Description must not exceed 500 characters");
    return;
  }

  const host: Host = {
    hostname: hostname,
    description: description,
  };

  try {
    await saveHost(host);
    (document.getElementById("hostModal") as HTMLDialogElement).close();
  } catch (error) {
    await showError(
      "Failed to save host to database",
      "CSV_OPERATIONS",
      String(error),
    );
  }
}

/**
 * Handles the "Back to Main" button click event.
 * Hides the hosts window and returns to the main window.
 */
async function handleBackToMainClick(): Promise<void> {
  try {
    await invoke("hide_hosts_window");
  } catch (err) {
    await showError(
      "Failed to return to main window",
      "WINDOW",
      String(err),
    );
  }
}

/**
 * Handles the "Scan Domain" button click event.
 * Opens the domain scan modal with a clean form.
 */
function handleScanDomainClick(): void {
  const modal = document.getElementById("scanDomainModal") as HTMLDialogElement;
  const form = document.getElementById("scanDomainForm") as HTMLFormElement;
  form.reset();
  modal.showModal();
}

/**
 * Handles the scan domain modal cancel button click.
 * Closes the scan domain modal without performing any action.
 */
function handleScanDomainCancelClick(): void {
  const modal = document.getElementById("scanDomainModal") as HTMLDialogElement;
  modal.close();
}

/**
 * Handles the host modal cancel button click.
 * Closes the host modal without saving changes.
 */
function handleHostModalCancelClick(): void {
  const modal = document.getElementById("hostModal") as HTMLDialogElement;
  modal.close();
}

/**
 * Handles the credentials modal cancel button click.
 * Closes the credentials modal without saving changes.
 */
function handleCredentialsModalCancelClick(): void {
  const modal = document.getElementById("credentialsModal") as HTMLDialogElement;
  modal.close();
}

/**
 * Handles the domain scan form submission event.
 * Validates domain and server, then performs an LDAP scan to discover servers.
 * 
 * @param e - The form submit event
 */
async function handleScanDomainFormSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const domainInput = document.getElementById("domainName") as HTMLInputElement;
  const serverInput = document.getElementById("serverName") as HTMLInputElement;
  const submitButton = (e.target as HTMLFormElement).querySelector(
    'button[type="submit"]',
  ) as HTMLButtonElement;
  const modal = document.getElementById("scanDomainModal") as HTMLDialogElement;

  const domain = domainInput.value.trim();
  const server = serverInput.value.trim();

  // Validate length limits
  if (domain.length > 253) {
    showToast("Domain name must not exceed 253 characters", "error");
    await showError(
      "Domain name must not exceed 253 characters",
      "VALIDATION",
      `Domain length: ${domain.length} characters`,
    );
    return;
  }

  if (server.length > 253) {
    showToast("Server name must not exceed 253 characters", "error");
    await showError(
      "Server name must not exceed 253 characters",
      "VALIDATION",
      `Server name length: ${server.length} characters`,
    );
    return;
  }

  if (!isValidDomain(domain)) {
    showToast(
      "Please enter a valid domain name (e.g., contoso.com)",
      "error",
    );
    await showError(
      "Please enter a valid domain name (e.g., contoso.com)",
      "VALIDATION",
      "The domain name format is invalid. It should be like contoso.com or example.org",
    );
    return;
  }

  if (!isValidServerName(server, domain)) {
    showToast(
      `Server must be a valid FQDN ending with .${domain} (e.g., dc01.${domain})`,
      "error",
    );
    await showError(
      `Server must be a valid FQDN ending with .${domain} (e.g., dc01.${domain})`,
      "VALIDATION",
      "The server name must be a fully qualified domain name that ends with the specified domain",
    );
    return;
  }

  try {
    submitButton.disabled = true;
    submitButton.classList.add("btn-disabled");
    submitButton.innerHTML = `
        <span class="loading loading-spinner loading-sm"></span>
        <span class="ml-2">Scanning...</span>
      `;

    const result = await invoke<string>("scan_domain", { domain, server });

    modal.close();
    showToast(result, "success");
    await loadHosts();
  } catch (error) {
    showToast(`Failed to scan domain: ${error}`, "error");
    await showError(
      "Failed to scan Active Directory domain",
      "LDAP_SCAN",
      String(error),
    );
  } finally {
    submitButton.disabled = false;
    submitButton.classList.remove("btn-disabled");
    submitButton.innerHTML = "Scan";
  }
}

/**
 * Handles the host search input event.
 * Filters the hosts list in real-time based on the search term.
 * 
 * @param e - The input event
 */
function handleHostSearchInput(e: Event): void {
  const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
  filterHosts(searchTerm);
}

/**
 * Sets up all event listeners for the host management window.
 * Handles:
 * - Add/Edit/Delete host operations
 * - Active Directory domain scanning
 * - Per-host credential management
 * - Search and filtering
 * - Navigation (back button, modals)
 */
function setupEventListeners() {
  document.getElementById("addHost")?.addEventListener("click", handleAddHostClick);
  document.getElementById("hostForm")?.addEventListener("submit", handleHostFormSubmit);
  
  const backButton = document.getElementById("backToMain");
  if (backButton) {
    backButton.addEventListener("click", handleBackToMainClick);
  }

  document.getElementById("scanDomain")?.addEventListener("click", handleScanDomainClick);
  document.getElementById("scanDomainCancel")?.addEventListener("click", handleScanDomainCancelClick);
  document.getElementById("hostModalCancel")?.addEventListener("click", handleHostModalCancelClick);
  document.getElementById("credentialsModalCancel")?.addEventListener("click", handleCredentialsModalCancelClick);
  document.getElementById("scanDomainForm")?.addEventListener("submit", handleScanDomainFormSubmit);
  document.getElementById("deleteAllHosts")?.addEventListener("click", deleteAllHosts);
  document.getElementById("hostSearch")?.addEventListener("input", handleHostSearchInput);
}

/**
 * Filters the host list based on a search term.
 * Searches in both hostname and description fields (case-insensitive).
 * 
 * @param searchTerm - The search term to filter by
 */
function filterHosts(searchTerm: string) {
  // Use utility function for filtering logic
  filteredHosts = filterHostsUtil(hosts, searchTerm);
  renderHosts();
}

/**
 * Loads all hosts from the backend CSV file and renders them.
 * If loading fails, displays an error in the dedicated error window.
 */
async function loadHosts() {
  try {
    hosts = await invoke<Host[]>("get_hosts");
    filteredHosts = [...hosts];
    renderHosts();
  } catch (error) {
    await showError(
      "Failed to load hosts from database",
      "CSV_OPERATIONS",
      String(error),
    );
  }
}

/**
 * Creates an HTML string for a single host row in the hosts table.
 * Includes hostname, description, last connected date, and action buttons.
 * 
 * @param host - The host object to render
 * @returns HTML string for the table row
 */
function createHostRow(host: Host): string {
  return `
      <tr class="border-b border-base-300">
        <td class="text-center">${host.hostname}</td>
        <td class="text-center">${host.description || ""}</td>
        <td class="text-center">${host.last_connected || "Never"}</td>
        <td class="text-center space-x-2">
          <button class="btn btn-xs btn-ghost" onclick="window.saveHostCredentials('${host.hostname}')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>
          <button class="btn btn-xs btn-ghost" onclick="window.editHost('${host.hostname}')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button class="btn btn-xs btn-ghost text-error" onclick="window.deleteHost('${host.hostname}')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      </tr>
    `;
}

/**
 * Displays an empty state message when no hosts are found.
 * Shows different messages depending on whether the host list is empty or filtered.
 * 
 * @param noHostsMessage - The message element to update
 * @param hostsTableWrapper - The table wrapper to hide
 * @param hasHosts - Whether the unfiltered host list has any hosts
 */
function showEmptyState(
  noHostsMessage: HTMLElement,
  hostsTableWrapper: HTMLElement,
  hasHosts: boolean,
): void {
  if (hasHosts) {
    noHostsMessage.textContent = "No hosts match your search criteria.";
  } else {
    noHostsMessage.textContent = "No hosts found. Add some hosts to get started!";
  }
  noHostsMessage.classList.remove("hidden");
  hostsTableWrapper.classList.add("hidden");
}

/**
 * Renders the hosts table with all filtered hosts.
 * Shows each host with hostname, description, last connected date, and action buttons.
 * Displays appropriate empty state messages when no hosts exist or no matches are found.
 */
function renderHosts() {
  const tbody = document.querySelector("#hostsTable tbody")!;
  const noHostsMessage = document.getElementById("noHostsMessage")!;
  const hostsTableWrapper = document.getElementById("hostsTableWrapper")!;

  if (filteredHosts.length === 0) {
    showEmptyState(noHostsMessage, hostsTableWrapper, hosts.length > 0);
  } else {
    noHostsMessage.classList.add("hidden");
    hostsTableWrapper.classList.remove("hidden");
    tbody.innerHTML = filteredHosts.map((host) => createHostRow(host)).join("");
  }
}

/**
 * Saves a host to the backend CSV file and reloads the host list.
 * 
 * @param host - The host object to save
 * @throws Re-throws any error from the backend for caller to handle
 */
async function saveHost(host: Host) {
  try {
    await invoke("save_host", { host });
    await loadHosts();
  } catch (error) {
    throw error;
  }
}

window.deleteHost = async (hostname: string) => {
  if (!confirm("Are you sure you want to delete this host?")) return;

  try {
    await invoke("delete_host", { hostname });
    await loadHosts();
  } catch (error) {
    await showError(
      "Failed to delete host from database",
      "CSV_OPERATIONS",
      String(error),
    );
  }
};

window.editHost = (hostname: string) => {
  const host = hosts.find((h) => h.hostname === hostname);
  if (!host) return;

  const modal = document.getElementById("hostModal") as HTMLDialogElement;
  document.getElementById("modalTitle")!.textContent = "Edit Host";

  const form = document.getElementById("hostForm") as HTMLFormElement;
  (form.querySelector("#hostname") as HTMLInputElement).value = host.hostname;
  (form.querySelector("#description") as HTMLTextAreaElement).value =
    host.description;

  modal.showModal();
};

// Validation functions (isValidFQDN, isValidDomain, isValidServerName) are now imported from utils/validation

function showToast(message: string, type: "success" | "error" = "success") {
  // Use utility function for toast display
  showToastUtil(message, type, "toastContainer");
}

window.saveHostCredentials = async (hostname: string) => {
  const host = hosts.find((h) => h.hostname === hostname);
  if (!host) return;

  try {
    // Get stored credentials
    const storedCreds = await invoke<StoredCredentials>(
      "get_host_credentials",
      { hostname: host.hostname },
    );

    // Show modal with credentials form
    const modal = document.getElementById(
      "credentialsModal",
    ) as HTMLDialogElement;
    const hostnameEl = document.getElementById("credentialsHostname")!;
    const form = document.getElementById("credentialsForm") as HTMLFormElement;
    const usernameInput = document.getElementById(
      "credUsername",
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      "credPassword",
    ) as HTMLInputElement;

    // Set hostname display
    hostnameEl.textContent = `Host: ${host.hostname}`;

    // If we have stored credentials, populate them
    if (storedCreds) {
      usernameInput.value = storedCreds.username;
      passwordInput.value = storedCreds.password;
    } else {
      // If no stored credentials, try to get default ones
      const defaultCreds = await invoke<StoredCredentials>(
        "get_stored_credentials",
      );
      if (defaultCreds) {
        usernameInput.value = defaultCreds.username;
        passwordInput.value = defaultCreds.password;
      } else {
        form.reset();
      }
    }

    // Handle form submission
    const handleSubmit = async (e: Event) => {
      e.preventDefault();
      
      const username = usernameInput.value;
      const password = passwordInput.value;
      
      // Validate length limits
      if (username.length > 104) {
        showToast("Username must not exceed 104 characters", "error");
        await showError(
          "Username must not exceed 104 characters",
          "VALIDATION",
          `Username length: ${username.length} characters`,
        );
        return;
      }
      
      if (password.length > 256) {
        showToast("Password must not exceed 256 characters", "error");
        await showError(
          "Password must not exceed 256 characters",
          "VALIDATION",
          `Password length: ${password.length} characters`,
        );
        return;
      }
      
      try {
        await invoke("save_host_credentials", {
          host,
          credentials: {
            username,
            password,
          },
        });
        showToast(`Credentials saved for ${hostname}`, "success");
        modal.close();
      } catch (error) {
        showToast(`Failed to save credentials: ${error}`, "error");
        await showError(
          "Failed to save credentials for host",
          "HOST_CREDENTIALS",
          String(error),
        );
      }
    };

    form.removeEventListener("submit", handleSubmit);
    form.addEventListener("submit", handleSubmit);

    modal.showModal();
  } catch (error) {
    showToast(`Failed to manage credentials: ${error}`, "error");
    await showError(
      "Failed to open credentials management dialog",
      "HOST_CREDENTIALS",
      String(error),
    );
  }
};

async function deleteAllHosts() {
  if (
    !confirm(
      "Are you sure you want to delete all hosts? This action cannot be undone.",
    )
  )
    return;

  try {
    await invoke("delete_all_hosts");
    await loadHosts();
    showToast("All hosts deleted successfully", "success");
  } catch (error) {
    showToast(`Failed to delete all hosts: ${error}`, "error");
    await showError(
      "Failed to delete all hosts",
      "CSV_OPERATIONS",
      String(error),
    );
  }
}

declare global {
  interface Window {
    editHost: (hostname: string) => void;
    deleteHost: (hostname: string) => void;
    saveHostCredentials: (hostname: string) => void;
  }
}

// Initialize the application when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initializeTheme();
    setupEventListeners();
    await loadHosts();
  } catch (error) {
    await showError(
      "Failed to initialize Manage Hosts window",
      "INITIALIZATION",
      String(error),
    );
  }

  window.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      try {
        await invoke("hide_hosts_window");
      } catch {
        // Silently ignore error if window cannot be hidden
      }
    }

    // Secret reset shortcut: Ctrl+Shift+Alt+R
    if (e.ctrlKey && e.shiftKey && e.altKey && e.key === "R") {
      e.preventDefault();

      const confirmed = confirm(
        "⚠️ WARNING: Application Reset ⚠️\n\n" +
          "This will permanently delete:\n" +
          "• All saved credentials\n" +
          "• All RDP connection files\n" +
          "• All saved hosts\n" +
          "• Recent connection history\n\n" +
          "This action CANNOT be undone!\n\n" +
          "Are you sure you want to continue?",
      );

      if (!confirmed) {
        return;
      }

      try {
        const result = await invoke<string>("reset_application");
        alert(result);

        // Recommend restarting the application
        const shouldQuit = confirm(
          "Reset complete!\n\n" +
            "It is recommended to restart the application now.\n\n" +
            "Do you want to quit the application?",
        );

        if (shouldQuit) {
          await invoke("quit_app");
        }
      } catch (err) {
        alert("Failed to reset application: " + err);
      }
    }
  });
});

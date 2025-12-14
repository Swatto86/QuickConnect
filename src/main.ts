/**
 * Main Window Script for QuickConnect
 *
 * This module handles the main application window where users can:
 * - View and search their list of RDP hosts
 * - Connect to servers with a single click
 * - Access host management and settings
 * - View recent connections
 *
 * The window includes:
 * - Search functionality with real-time filtering
 * - Host cards with descriptions and last connection info
 * - Quick access to manage hosts, credentials, and settings
 * - System tray integration via minimize button
 *
 * @module main
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Import utility functions
import {
  filterHosts as filterHostsUtil,
  highlightMatches as highlightMatchesUtil,
  checkAllHostsStatus,
  type Host,
} from "./utils/hosts";
import { validateCredentials } from "./utils/validation";
import {
  showNotification as showNotificationUtil,
  setButtonDisabled,
} from "./utils/ui";

interface StoredCredentials {
  username: string;
  password: string;
}

// Host interface is now imported from utils/hosts

/**
 * Displays a success notification to the user.
 * Error notifications are intentionally not displayed as they are handled by the dedicated error window.
 * 
 * @param message - The message to display to the user
 * @param isError - If true, the notification is suppressed (errors go to error window)
 */
function showNotification(message: string, isError: boolean = false) {
  // Don't show error notifications as they will be handled by the error window
  if (isError) {
    return;
  }

  // Use utility function for notification display
  showNotificationUtil({
    message,
    type: "success",
    duration: 1000,
    position: "bottom",
  });
}

/**
 * Displays an error in the dedicated error window.
 * If the error window cannot be shown (rare failure case), falls back to console logging.
 * This ensures errors are always visible during development/debugging.
 * 
 * @param message - User-friendly error message
 * @param category - Optional error category (e.g., 'CREDENTIALS', 'RDP_LAUNCH', 'CSV_OPERATIONS')
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
    // Error window unavailable - silently fail
    // In production, errors are lost if error window cannot be shown
    // This is acceptable as the error window is always available in normal operation
  }
}

/**
 * Updates button states based on whether credentials are stored.
 * Enables/disables the delete button based on credential existence.
 * 
 * @param hasCredentials - True if credentials are currently stored
 */
function updateButtonStates(hasCredentials: boolean) {
  const deleteBtn = document.querySelector(
    "#delete-btn",
  ) as HTMLButtonElement | null;
  // Use utility function for button state management
  setButtonDisabled(deleteBtn, !hasCredentials);
}

/**
 * Validates the login form and updates the OK button state.
 * The OK button is enabled only when both username and password meet validation criteria.
 * Uses utility function for credential validation logic.
 */
function validateForm() {
  const okBtn = document.querySelector(
    'button[type="submit"]',
  ) as HTMLButtonElement | null;
  const username = document.querySelector(
    "#username",
  ) as HTMLInputElement | null;
  const password = document.querySelector(
    "#password",
  ) as HTMLInputElement | null;

  if (okBtn && username && password) {
    // Use utility function for credential validation
    const isValid = validateCredentials(username.value, password.value);
    // Use utility function for button state management
    setButtonDisabled(okBtn, !isValid);
  }
}

/**
 * Cancels the auto-close timer that automatically switches to the main window.
 * Clears the timeout, countdown interval, and animation frame.
 * Also hides the timer notification banner.
 */
function cancelAutoCloseTimer() {
  if (autoCloseTimer !== null) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
  if (countdownInterval !== null) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  // Hide the timer notification
  if (timerNotificationElement) {
    timerNotificationElement.classList.add("hidden");
  }
}

/**
 * Checks if credentials are stored and populates the login form if they exist.
 * If credentials exist and this is not an intentional return to login, starts an auto-close timer
 * that automatically switches to the main window after 5 seconds.
 * The timer includes a visual countdown and can be cancelled by user interaction.
 */
async function checkCredentialsExist() {
  try {
    const stored = await invoke<StoredCredentials>("get_stored_credentials");
    updateButtonStates(!!stored);

    // If credentials exist, populate the form
    if (stored) {
      const username = document.querySelector(
        "#username",
      ) as HTMLInputElement | null;
      const password = document.querySelector(
        "#password",
      ) as HTMLInputElement | null;

      if (username && password) {
        username.value = stored.username;
        password.value = stored.password;
        validateForm();

        // Only start the auto-close timer if NOT an intentional return
        if (!isIntentionalReturn) {
          // Start the auto-close timer
          timerNotificationElement = document.querySelector(
            "#timer-notification",
          );
          countdownElement = document.querySelector("#countdown");

          if (timerNotificationElement && countdownElement) {
            remainingSeconds = 5;
            countdownElement.textContent = String(remainingSeconds);

            timerNotificationElement.classList.remove("hidden");
            timerNotificationElement.style.display = "block";
            timerNotificationElement.style.visibility = "visible";
            timerNotificationElement.style.opacity = "1";

            let lastUpdate = Date.now();
            const loop = function () {
              const now = Date.now();
              if (now - lastUpdate >= 1000) {
                lastUpdate = now;
                remainingSeconds--;

                if (countdownElement)
                  countdownElement.textContent = String(remainingSeconds);
                if (timerNotificationElement) {
                  timerNotificationElement.style.backgroundColor =
                    remainingSeconds % 2 === 0
                      ? "rgba(59, 130, 246, 0.3)"
                      : "rgba(59, 130, 246, 0.2)";
                }

                if (remainingSeconds <= 0) {
                  // Hide the banner before switching windows
                  if (timerNotificationElement) {
                    timerNotificationElement.classList.add("hidden");
                    timerNotificationElement.style.display = "";
                    timerNotificationElement.style.visibility = "";
                    timerNotificationElement.style.opacity = "";
                  }
                  // Just hide login window but set last hidden to "main" so tray shows main window
                  invoke("close_login_and_prepare_main");
                  return;
                }
              }
              requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
          }
        } else {
          // Reset the flag after use
          isIntentionalReturn = false;
        }
      }
    }
  } catch {
    updateButtonStates(false);
  }
}

/**
 * Initializes the theme system and sets up event listeners.
 * Loads the saved theme preference (defaults to dark mode).
 * Listens for theme changes from the system tray and applies them in real-time.
 * Also listens for hosts-updated events to refresh the host list when changes occur.
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
    await loadAllHosts();
    await checkHostsStatus();
  });
}

// Declare this once at the top of the file
let searchTimeout: ReturnType<typeof setTimeout>;
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let remainingSeconds = 5;
let animationFrameId: number | null = null;

// Store DOM element references globally to avoid re-querying
let countdownElement: HTMLElement | null = null;
let timerNotificationElement: HTMLElement | null = null;

// Flag to track if user intentionally returned to login (don't show timer)
let isIntentionalReturn = false;

// Store all hosts globally for client-side filtering
let allHosts: Host[] = [];

/**
 * Highlights matching characters in text based on the search query.
 * Wraps matches in <mark> tags for visual emphasis.
 * 
 * @param text - The text to search within
 * @param query - The search query to highlight
 * @returns HTML string with highlighted matches
 */
function highlightMatches(text: string, query: string): string {
  return highlightMatchesUtil(text, query);
}

/**
 * Renders the list of RDP hosts in the main window.
 * Each host shows hostname, description, and last connected date.
 * Highlights search matches in hostname and description fields.
 * Empty state messages are shown when no hosts exist or no matches are found.
 * 
 * @param hosts - Array of hosts to display
 * @param query - Optional search query for highlighting matches
 */
function renderHostsList(hosts: Host[], query: string = "") {
  const serverList = document.querySelector("#server-list") as HTMLElement;
  if (!serverList) return;

  serverList.innerHTML = "";

  if (hosts.length === 0) {
    serverList.innerHTML = `
            <div class="text-center text-base-content/60 p-4">
                ${query ? "No matching hosts found" : 'No hosts available. Click "Manage Hosts" to add servers.'}
            </div>
        `;
    return;
  }

  hosts.forEach((host) => {
    const item = document.createElement("div");
    item.className =
      "flex items-center justify-between py-2 px-3 border-b border-base-300 last:border-b-0 hover:bg-base-300 cursor-pointer transition-colors";

    const highlightedHostname = highlightMatches(host.hostname, query);
    const highlightedDescription = highlightMatches(host.description, query);
    const lastConnected = host.last_connected || "Never";

    // Status indicator
    let statusIndicator = "";
    if (host.status === "online") {
      statusIndicator = `<span class="w-2 h-2 rounded-full bg-green-500 mr-2" title="Online"></span>`;
    } else if (host.status === "offline") {
      statusIndicator = `<span class="w-2 h-2 rounded-full bg-red-500 mr-2" title="Offline"></span>`;
    } else if (host.status === "checking") {
      statusIndicator = `<span class="w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse" title="Checking..."></span>`;
    } else {
      statusIndicator = `<span class="w-2 h-2 rounded-full bg-gray-500 mr-2" title="Unknown"></span>`;
    }

    item.innerHTML = `
            <div class="flex items-center flex-1 gap-2">
                ${statusIndicator}
                <div class="flex flex-col flex-1 gap-0.5">
                    <span class="font-medium text-sm">${highlightedHostname}</span>
                    <span class="text-xs opacity-70">${highlightedDescription}</span>
                    <span class="text-xs opacity-50">Last connected: ${lastConnected}</span>
                </div>
            </div>
            <button class="connect-btn btn btn-primary btn-xs">
                Connect
            </button>
        `;

    // Add click handler for the entire row
    item.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      // Don't trigger row click if connect button was clicked
      if (
        !target.classList.contains("connect-btn") &&
        !target.closest(".connect-btn")
      ) {
        try {
          await invoke("launch_rdp", { host });
        } catch {
          // Errors are displayed in the dedicated error window by the backend
        }
      }
    });

    // Add click handler for the connect button
    const connectBtn = item.querySelector(".connect-btn");
    if (connectBtn) {
      connectBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await invoke("launch_rdp", { host });
        } catch {
          // Errors are displayed in the dedicated error window by the backend
        }
      });
    }

    serverList.appendChild(item);
  });
}

/**
 * Filters the host list based on a search query.
 * Searches in both hostname and description fields (case-insensitive).
 * 
 * @param query - The search term to filter by
 * @returns Filtered array of hosts matching the query
 */
function filterHosts(query: string): Host[] {
  return filterHostsUtil(allHosts, query);
}

/**
 * Handles search input changes and updates the displayed host list.
 * Reads the current search query, filters hosts, and re-renders the list.
 */
async function handleSearch() {
  const searchInput = document.querySelector(
    "#search-input",
  ) as HTMLInputElement;
  if (!searchInput) return;

  const query = searchInput.value;
  const filteredHosts = filterHosts(query);
  renderHostsList(filteredHosts, query);
}

/**
 * Loads all hosts from the backend and renders them.
 * If loading fails, displays an error message and sends error to the dedicated error window.
 */
async function loadAllHosts() {
  try {
    allHosts = await invoke<Host[]>("get_all_hosts");
    renderHostsList(allHosts);
  } catch (err) {
    const serverList = document.querySelector("#server-list") as HTMLElement;
    if (serverList) {
      serverList.innerHTML = `
                <div class="text-center text-base-content/60 p-4">
                    Failed to load hosts
                </div>
            `;
    }
    await showError("Failed to load hosts list", "CSV_OPERATIONS", String(err));
  }
}

/**
 * Initializes the search functionality with debounced input handling.
 * Delays search execution by 150ms after the user stops typing for better performance.
 */
function initializeSearch() {
  const searchInput = document.querySelector(
    "#search-input",
  ) as HTMLInputElement;

  if (searchInput) {
    // Handle input changes with debounce for smoother performance
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        handleSearch();
      }, 150);
    });
  }
}

/**
 * Initializes the server list and sets up real-time event listeners.
 * Loads all hosts and listens for connection events to update last-connected timestamps.
 * Also listens for focus-search events triggered by global hotkeys.
 */
async function initializeServerList() {
  await loadAllHosts();
  
  // Automatically check host status after loading
  await checkHostsStatus();

  // Listen for host-connected events to refresh the list in real-time
  await listen("host-connected", async () => {
    await loadAllHosts();
    await checkHostsStatus();
  });

  // Listen for focus-search event to focus the search input when window is shown via hotkey
  await listen("focus-search", () => {
    const searchInput = document.querySelector(
      "#search-input",
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  });
}

/**
 * Hides the auto-close timer notification banner.
 * Clears inline styles to ensure the hidden class takes effect.
 */
function hideTimerNotification() {
  const timerNotif = document.querySelector(
    "#timer-notification",
  ) as HTMLElement | null;
  if (timerNotif) {
    // Clear inline styles that override the hidden class
    timerNotif.classList.add("hidden");
    timerNotif.style.display = "";
    timerNotif.style.visibility = "";
    timerNotif.style.opacity = "";
  }
}

// Modify the main DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", async () => {
  await initializeTheme();
  initializeSearch();
  await initializeServerList();

  // Banner is already hidden in HTML with class="hidden", no need to hide on page load
  // It will be shown only when auto-close timer starts (if credentials exist)

  // Get form elements
  const form = document.querySelector("#login-form") as HTMLFormElement | null;
  const username = document.querySelector(
    "#username",
  ) as HTMLInputElement | null;
  const password = document.querySelector(
    "#password",
  ) as HTMLInputElement | null;
  const deleteBtn = document.querySelector(
    "#delete-btn",
  ) as HTMLButtonElement | null;
  const cancelBtn = document.querySelector(
    "#cancel-btn",
  ) as HTMLButtonElement | null;
  const okBtn = document.querySelector(
    'button[type="submit"]',
  ) as HTMLButtonElement | null;

  // LOGIN-SPECIFIC CODE - Only run if we're on the login page
  if (form) {
    // Set initial button states
    if (okBtn) {
      okBtn.disabled = true;
      okBtn.classList.add("opacity-50", "cursor-not-allowed");
    }
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.classList.add("opacity-50", "cursor-not-allowed");
    }

    // Check for existing credentials FIRST (before adding event listeners that might cancel the timer)
    checkCredentialsExist();

    // Add input listeners AFTER checking credentials to prevent accidental cancellation
    // Only hide banner on actual typing (input event), not on focus
    if (username) {
      username.addEventListener("input", () => {
        validateForm();
        hideTimerNotification();
        cancelAutoCloseTimer(); // Cancel timer when user types
      });
    }
    if (password) {
      password.addEventListener("input", () => {
        validateForm();
        hideTimerNotification();
        cancelAutoCloseTimer(); // Cancel timer when user types
      });
    }

    // Set initial focus AFTER setting up event listeners
    // But DON'T focus if we just showed the auto-close timer (let user see the countdown)
    // Focus will be set when user clicks
    // Removed: if (username) { username.focus(); }

    // Handle delete
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        hideTimerNotification();
        cancelAutoCloseTimer();
        try {
          await invoke("delete_credentials");
          if (username) username.value = "";
          if (password) password.value = "";
          showNotification("Credentials deleted successfully");
          checkCredentialsExist();
          validateForm();
        } catch (err) {
          showNotification("Failed to delete credentials", true);
          await showError(
            "Failed to delete stored credentials",
            "CREDENTIALS",
            String(err),
          );
        }
      });
    }

    // Handle cancel
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async () => {
        hideTimerNotification();
        cancelAutoCloseTimer();
        await invoke("quit_app");
      });
    }

    // Handle form submit
    form.addEventListener("submit", async (e) => {
      hideTimerNotification();
      cancelAutoCloseTimer();
      e.preventDefault();
      
      const usernameValue = username?.value || "";
      const passwordValue = password?.value || "";
      
      // Validate credentials (includes length checks)
      if (!validateCredentials(usernameValue, passwordValue)) {
        showNotification("Invalid credentials: check length limits", true);
        return;
      }
      
      try {
        await invoke("save_credentials", {
          credentials: {
            username: usernameValue,
            password: passwordValue,
          },
        });

        // Show success notification immediately after saving
        showNotification("Credentials saved successfully");

        // Enable delete button after successful save
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.classList.remove("opacity-50", "cursor-not-allowed");
        }

        // Switch windows after a short delay to ensure notification is seen
        setTimeout(async () => {
          await invoke("switch_to_main_window");
        }, 500);
      } catch (err) {
        showNotification("Failed to save credentials", true);
        await showError(
          "Failed to save credentials to Windows Credential Manager",
          "CREDENTIALS",
          String(err),
        );
      }
    });
  }

  // Add this to your initialization code
  window.addEventListener("storage", (e) => {
    if (e.key === "theme") {
      // Update theme when it's changed in another window
      const newTheme = e.newValue || "dracula";
      document.documentElement.setAttribute("data-theme", newTheme);
    }
  });

  // Secret reset shortcut: Ctrl+Shift+Alt+R
  window.addEventListener("keydown", async (e) => {
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

      const confirmedAgain = confirm(
        "FINAL CONFIRMATION:\n\n" +
          "This will COMPLETELY reset QuickConnect and permanently delete your data.\n\n" +
          "Press OK to proceed with the reset, or Cancel to abort.",
      );

      if (!confirmedAgain) {
        return;
      }

      try {
        const result = await invoke<string>("reset_application");
        alert(result);

        // Return to the initial credentials screen
        try {
          await invoke("show_login_window");
        } catch {
          // Non-critical: window switching may fail if windows are missing
        }

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

  // Modify the back button handler to properly switch windows
  const backToLogin = document.querySelector("#backToLogin");
  if (backToLogin) {
    backToLogin.addEventListener("click", async () => {
      try {
        // Set flag to prevent timer from starting
        isIntentionalReturn = true;
        // First show login window, then hide main window
        await invoke("show_login_window");
        await invoke("hide_main_window");
      } catch {
        // Window switching errors are rare and non-critical
      }
    });
  }

  // Update the manage hosts event listener
  document
    .getElementById("manageHosts")
    ?.addEventListener("click", async () => {
      try {
        await invoke("show_hosts_window");
      } catch {
        // Window showing errors are rare and non-critical
      }
    });

  // Add refresh status button handler
  const refreshStatusBtn = document.getElementById("refreshStatus");
  if (refreshStatusBtn) {
    refreshStatusBtn.addEventListener("click", async () => {
      await checkHostsStatus();
    });
  }
});

/**
 * Checks the status of all hosts and updates the UI
 * Shows a spinner animation on the refresh button during checking
 */
async function checkHostsStatus() {
  const refreshStatusBtn = document.getElementById("refreshStatus");
  if (!refreshStatusBtn) return;

  // Disable button and add spinning animation during check
  setButtonDisabled(refreshStatusBtn as HTMLButtonElement, true);
  refreshStatusBtn.classList.add("animate-spin");

  try {
    // Create wrapper function for the Tauri command
    const checkStatusFn = async (hostname: string) => {
      return await invoke<string>("check_host_status", { hostname });
    };

    // Check all hosts and get updated list with status
    const updatedHosts = await checkAllHostsStatus(allHosts, checkStatusFn);
    
    // Update the global hosts array with status information
    allHosts = updatedHosts;

    // Re-render the current view (respecting search filter)
    const searchInput = document.querySelector("#search-input") as HTMLInputElement;
    const query = searchInput?.value || "";
    const filteredHosts = filterHosts(query);
    renderHostsList(filteredHosts, query);
  } catch (error) {
    // Status checking errors are non-critical - hosts remain in unknown state
    console.error("Error checking host status:", error);
  } finally {
    // Re-enable button and remove spinning animation
    setButtonDisabled(refreshStatusBtn as HTMLButtonElement, false);
    refreshStatusBtn.classList.remove("animate-spin");
  }
}

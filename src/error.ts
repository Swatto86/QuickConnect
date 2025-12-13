/**
 * Error Display Window Script for QuickConnect
 *
 * This module manages the dedicated error window that displays all application errors
 * in a centralized, user-friendly interface. The error window provides comprehensive
 * error tracking and management capabilities.
 *
 * Key Features:
 * - Real-time error display with automatic window showing
 * - Error categorization by severity (CRITICAL, ERROR, WARNING, INFO)
 * - Searchable error list with filtering
 * - Individual error details with expandable technical information
 * - Copy-to-clipboard for individual errors or bulk export
 * - Auto-scroll option for monitoring new errors
 * - Persistent error list across window closures
 * - Theme synchronization with application settings
 *
 * Architecture:
 * - Listens for 'show-error' events from the Rust backend
 * - Maintains in-memory error list for the session
 * - Uses utility functions from utils/errors for formatting
 * - Integrates with utils/validation for XSS prevention
 * - Window management follows Tauri best practices
 *
 * Error Structure:
 * Each error contains:
 * - message: User-friendly error description
 * - timestamp: ISO 8601 formatted time of occurrence
 * - category: Error classification (e.g., CREDENTIALS, RDP_LAUNCH, LDAP)
 * - details: Optional technical information for debugging
 *
 * User Interactions:
 * - Click individual error X to remove
 * - Click copy icon to copy error to clipboard
 * - Search bar filters errors by message/category/details
 * - Export button copies all errors as formatted text
 * - Clear button removes all errors after confirmation
 * - Auto-scroll checkbox controls scroll-to-bottom behavior
 * - Escape key or Close button hides window (preserves errors)
 *
 * @module error
 */

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

// Import utility functions
import {
  type ErrorData,
  getSeverityColor as getSeverityColorUtil,
  getBorderColor as getBorderColorUtil,
  filterErrors,
  formatErrorForExport,
  formatErrorsForExport,
} from "./utils/errors";
import { escapeHtml } from "./utils/validation";
import { showNotification as showNotificationUtil } from "./utils/ui";

// ErrorData interface is now imported from utils/errors

let errors: ErrorData[] = [];
let filteredErrors: ErrorData[] = [];
let searchQuery = "";
let autoScroll = true;

// DOM Elements
const errorList = document.getElementById("errorList") as HTMLDivElement;
const closeBtn = document.getElementById("closeBtn") as HTMLButtonElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;
const exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;
const errorCount = document.getElementById("errorCount") as HTMLDivElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const clearSearchBtn = document.getElementById(
  "clearSearchBtn",
) as HTMLButtonElement;
const autoScrollCheckbox = document.getElementById(
  "autoScrollCheckbox",
) as HTMLInputElement;
const filteredCount = document.getElementById(
  "filteredCount",
) as HTMLDivElement;

// Add error to the list
function addError(error: ErrorData) {
  errors.push(error);
  applyFilters();
  renderErrors();

  // Auto-scroll to bottom if enabled
  if (autoScroll) {
    setTimeout(() => {
      errorList.scrollTop = errorList.scrollHeight;
    }, 100);
  }
}

// Apply search filters
// Uses utility function from utils/errors
function applyFilters() {
  filteredErrors = filterErrors(errors, searchQuery);
  updateFilteredCount();
}

// Update filtered count display
function updateFilteredCount() {
  if (searchQuery.trim() && filteredErrors.length !== errors.length) {
    filteredCount.textContent = `Showing ${filteredErrors.length} of ${errors.length}`;
  } else {
    filteredCount.textContent = "";
  }
}

// Get severity badge color based on category
// Uses utility function from utils/errors
function getSeverityColor(category?: string): string {
  return getSeverityColorUtil(category);
}

// Get border color based on category
// Uses utility function from utils/errors
function getBorderColor(category?: string): string {
  return getBorderColorUtil(category);
}

/**
 * Creates HTML for the "no errors" empty state display.
 * Shows a success icon and message when the error list is empty.
 * 
 * @returns HTML string for the empty state
 */
function createNoErrorsEmptyState(): string {
  return `
            <div class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <svg class="w-20 h-20 mb-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-lg font-medium">No errors to display</p>
                <p class="text-sm mt-1">All clear! No errors have been logged.</p>
            </div>
        `;
}

/**
 * Creates HTML for the "no search results" empty state display.
 * Shows a search icon and message when search yields no matches.
 * 
 * @returns HTML string for the empty search state
 */
function createNoSearchResultsState(): string {
  return `
            <div class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p class="text-lg font-medium">No matching errors</p>
                <p class="text-sm mt-1">Try a different search term</p>
            </div>
        `;
}

/**
 * Creates HTML for the error details section (expandable).
 * 
 * @param details - The error details text
 * @returns HTML string for the details section, or empty string if no details
 */
function createErrorDetailsSection(details?: string): string {
  if (!details) {
    return "";
  }
  return `
                        <details class="mt-2 group">
                            <summary class="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 flex items-center space-x-1">
                                <svg class="w-3 h-3 transform transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                                <span>Show details</span>
                            </summary>
                            <pre class="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap break-words border border-gray-200 dark:border-gray-700">${escapeHtml(details)}</pre>
                        </details>
                    `;
}

/**
 * Creates a complete error card element with all UI components.
 * Includes category badge, timestamp, message, optional details, and action buttons.
 * 
 * @param error - The error data to display
 * @param actualIndex - The index of the error in the main errors array
 * @returns A DOM element for the error card
 */
function createErrorCard(error: ErrorData, actualIndex: number): HTMLDivElement {
  const errorDiv = document.createElement("div");
  errorDiv.className = `p-4 border rounded-lg transition-all duration-200 hover:shadow-md ${getBorderColor(error.category)}`;

  errorDiv.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2 mb-2 flex-wrap">
                        <span class="text-xs font-semibold px-2 py-1 rounded ${getSeverityColor(error.category)}">
                            ${error.category || "ERROR"}
                        </span>
                        <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ${error.timestamp}
                        </span>
                    </div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 break-words">
                        ${escapeHtml(error.message)}
                    </p>
                    ${createErrorDetailsSection(error.details)}
                </div>
                <div class="flex items-start space-x-2 ml-4">
                    <button class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onclick="copyError(${actualIndex})" title="Copy to clipboard">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </button>
                    <button class="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" onclick="removeError(${actualIndex})" title="Remove error">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        `;

  return errorDiv;
}

/**
 * Renders all errors in the error list.
 * Displays appropriate empty states for no errors or no search results.
 * Shows errors in reverse chronological order (newest first).
 * Each error includes timestamp, category badge, message, and optional details.
 */
function renderErrors() {
  errorList.innerHTML = "";

  const errorsToDisplay = filteredErrors.length > 0 ? filteredErrors : errors;

  if (errors.length === 0) {
    errorList.innerHTML = createNoErrorsEmptyState();
    errorCount.textContent = "0 error(s)";
    return;
  }

  if (searchQuery.trim() && filteredErrors.length === 0) {
    errorList.innerHTML = createNoSearchResultsState();
    errorCount.textContent = `${errors.length} error(s)`;
    return;
  }

  // Render errors in reverse order (newest first)
  errorsToDisplay
    .slice()
    .reverse()
    .forEach((error) => {
      const actualIndex = errors.indexOf(error);
      const errorCard = createErrorCard(error, actualIndex);
      errorList.appendChild(errorCard);
    });

  errorCount.textContent = `${errors.length} error(s)`;
}

/**
 * Removes a specific error from the list by index.
 * 
 * @param index - The index of the error to remove
 */
function removeError(index: number) {
  errors.splice(index, 1);
  applyFilters();
  renderErrors();
}

/**
 * Copies a specific error to the clipboard in formatted text.
 * 
 * @param index - The index of the error to copy
 */
async function copyError(index: number) {
  const error = errors[index];
  if (!error) return;

  const text = formatErrorForExport(error);

  try {
    await navigator.clipboard.writeText(text);
    showNotification("Error copied to clipboard");
  } catch {
    showNotification("Failed to copy to clipboard", true);
  }
}

// Expose functions to window for inline onclick handlers
(window as any).removeError = removeError;
(window as any).copyError = copyError;

/**
 * Shows a temporary success notification in the error window.
 * Error notifications are suppressed since this is the error window itself.
 * 
 * @param message - The notification message
 * @param isError - If true, the notification is suppressed
 */
function showNotification(message: string, isError = false) {
  // Don't show error notifications visually since this IS the error window
  if (isError) {
    return;
  }

  showNotificationUtil({
    message,
    type: "success",
    duration: 2000,
    position: "bottom",
  });
}

// Escape HTML to prevent XSS
// Uses utility function from utils/validation
// (escapeHtml is imported directly from utils/validation)

// Clear all errors
clearBtn.addEventListener("click", () => {
  if (errors.length === 0) return;

  if (
    confirm(`Are you sure you want to clear all ${errors.length} error(s)?`)
  ) {
    errors = [];
    filteredErrors = [];
    searchQuery = "";
    searchInput.value = "";
    clearSearchBtn.classList.add("hidden");
    applyFilters();
    renderErrors();
    showNotification("All errors cleared");
  }
});

// Export errors to clipboard
// Uses utility function from utils/errors for formatting
exportBtn.addEventListener("click", async () => {
  if (errors.length === 0) {
    showNotification("No errors to export", true);
    return;
  }

  const text = formatErrorsForExport(errors);

  try {
    await navigator.clipboard.writeText(text);
    showNotification(`Exported ${errors.length} error(s) to clipboard`);
  } catch {
    showNotification("Failed to export to clipboard", true);
  }
});

// Search functionality
searchInput.addEventListener("input", (e) => {
  searchQuery = (e.target as HTMLInputElement).value;
  clearSearchBtn.classList.toggle("hidden", !searchQuery.trim());
  applyFilters();
  renderErrors();
});

clearSearchBtn.addEventListener("click", () => {
  searchQuery = "";
  searchInput.value = "";
  clearSearchBtn.classList.add("hidden");
  applyFilters();
  renderErrors();
});

// Auto-scroll toggle
autoScrollCheckbox.addEventListener("change", (e) => {
  autoScroll = (e.target as HTMLInputElement).checked;
});

// Close/Hide window
closeBtn.addEventListener("click", async () => {
  // Don't clear errors, just hide the window
  await getCurrentWindow().hide();
});

// Handle keyboard shortcuts
document.addEventListener("keydown", async (e) => {
  // Ctrl+Shift+E to toggle window
  if (e.ctrlKey && e.shiftKey && e.key === "E") {
    e.preventDefault();
    await getCurrentWindow().hide();
  }

  // Escape key to close
  if (e.key === "Escape") {
    e.preventDefault();
    await getCurrentWindow().hide();
  }
});

/**
 * Initializes the theme system for the error window.
 * Loads the saved theme preference and listens for theme change events.
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

  // Listen for theme change events
  await listen<string>("theme-changed", (event) => {
    const newTheme = event.payload;
    document.documentElement.setAttribute("data-theme", newTheme);
  });
}

// Listen for error events from backend and initialize
(async () => {
  await initializeTheme();

  await listen<ErrorData>("show-error", (event: any) => {
    addError(event.payload);
    // The window will be shown automatically by the backend
  });

  renderErrors();
})();

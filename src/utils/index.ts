/**
 * QuickConnect Utility Functions
 *
 * This module exports all utility functions for use across the application.
 * These functions are designed to be pure and testable.
 */

// Validation utilities
export {
  isValidFQDN,
  isValidDomain,
  isValidServerName,
  validateCredentials,
  escapeHtml,
} from './validation';

// Host management utilities
export {
  type Host,
  filterHosts,
  highlightMatches,
  sortHostsByHostname,
  sortHostsByLastConnected,
  parseUKDate,
  formatUKDate,
  groupHostsByDomain,
  findHostByHostname,
  hostnameExists,
} from './hosts';

// Error handling utilities
export {
  type ErrorData,
  type ErrorSeverity,
  getSeverityFromCategory,
  getSeverityColor,
  getBorderColor,
  filterErrors,
  formatErrorForExport,
  formatErrorsForExport,
  createError,
  formatTimestamp,
  countByCategory,
  countBySeverity,
  sortByTimestamp,
} from './errors';

// UI utilities
export {
  type ToastType,
  type NotificationOptions,
  showNotification,
  getNotificationColorClasses,
  showToast,
  escapeHtmlForDisplay,
  setButtonDisabled,
  debounce,
  querySelector,
  querySelectorAll,
  setTheme,
  getTheme,
  setVisible,
  clearChildren,
  createElement,
  focusInput,
} from './ui';

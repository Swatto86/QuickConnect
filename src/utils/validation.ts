/**
 * Validation Utility Module for QuickConnect
 *
 * This module provides comprehensive input validation functions used throughout
 * the application to ensure data integrity and security.
 *
 * Key features:
 * - FQDN validation (hostname.domain.com format)
 * - Domain validation for Active Directory queries
 * - Server name validation (ensures server belongs to domain)
 * - Credential format validation
 * - HTML escaping to prevent XSS attacks
 *
 * All validation functions are:
 * - Pure functions with no side effects
 * - Thoroughly unit tested (101 tests)
 * - Defensive against null/undefined/malformed inputs
 * - Documented with examples and edge cases
 *
 * @module utils/validation
 */

/**
 * Validates if a string is a valid Fully Qualified Domain Name (FQDN)
 * @param hostname - The hostname to validate
 * @returns true if valid FQDN, false otherwise
 * @example
 * isValidFQDN("server01.domain.com"); // true
 * isValidFQDN("server.local"); // true
 * isValidFQDN("server"); // false (no domain)
 * isValidFQDN("192.168.1.1"); // false (IP address)
 */
export function isValidFQDN(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') {
    return false;
  }

  const trimmed = hostname.trim();
  if (trimmed.length === 0 || trimmed.length > 253) {
    return false;
  }

  // Check for IP address format (should not be considered FQDN)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(trimmed)) {
    return false;
  }

  // FQDN validation regex:
  // - Contains at least one dot
  // - Only allows letters, numbers, dots, and hyphens
  // - Labels are 1-63 characters long
  // - Doesn't start or end with a dot or hyphen
  // - TLD must be at least 2 characters
  const fqdnRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}$/;
  return fqdnRegex.test(trimmed);
}

/**
 * Validates if a string is a valid domain name
 * @param domain - The domain to validate
 * @returns true if valid domain, false otherwise
 * @example
 * isValidDomain("example.com"); // true
 * isValidDomain("subdomain.example.com"); // true
 * isValidDomain("local"); // false (no TLD)
 * isValidDomain("example"); // false (no TLD)
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  const trimmed = domain.trim();
  if (trimmed.length === 0 || trimmed.length > 253) {
    return false;
  }

  // Domain validation: letters, numbers, dots, hyphens
  // Must have at least one dot and valid TLD (at least 2 chars, letters only)
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return domainRegex.test(trimmed);
}

/**
 * Validates if a server name is valid for a given domain
 * @param server - The server FQDN to validate
 * @param domain - The domain the server should belong to
 * @returns true if valid server name for the domain, false otherwise
 * @example
 * isValidServerName("dc01.example.com", "example.com"); // true
 * isValidServerName("server.sub.example.com", "example.com"); // true
 * isValidServerName("dc01.otherdomain.com", "example.com"); // false (wrong domain)
 * isValidServerName("server", "example.com"); // false (not FQDN)
 */
export function isValidServerName(server: string, domain: string): boolean {
  if (!server || !domain || typeof server !== 'string' || typeof domain !== 'string') {
    return false;
  }

  const serverTrimmed = server.trim();
  const domainTrimmed = domain.trim();

  // Domain must be valid
  if (!isValidDomain(domainTrimmed)) {
    return false;
  }

  // Server must be a valid FQDN
  if (!isValidFQDN(serverTrimmed)) {
    return false;
  }

  // Convert both to lowercase for comparison
  const serverLower = serverTrimmed.toLowerCase();
  const domainLower = domainTrimmed.toLowerCase();

  // Server must end with ".domain" (e.g., "dc01.domain.com" ends with ".domain.com")
  const expectedSuffix = '.' + domainLower;
  if (!serverLower.endsWith(expectedSuffix)) {
    return false;
  }

  // Check if server has a valid hostname prefix
  const prefix = serverLower.slice(0, -expectedSuffix.length);

  // Prefix must not be empty
  if (prefix.length === 0) {
    return false;
  }

  // Validate the prefix (hostname portion)
  const hostnameRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
  return hostnameRegex.test(prefix);
}

/**
 * Validates form inputs for username and password
 * @param username - The username value
 * @param password - The password value
 * @returns true if both fields have non-empty trimmed values and within length limits
 * @example
 * validateCredentials("user", "password123"); // true
 * validateCredentials("DOMAIN\\user", "P@ssw0rd"); // true
 * validateCredentials("user@domain.com", "secret"); // true
 * validateCredentials("", "password"); // false (empty username)
 * validateCredentials("a".repeat(105), "pass"); // false (username too long)
 */
export function validateCredentials(username: string, password: string): boolean {
  if (!username?.trim() || !password?.trim()) {
    return false;
  }
  
  // Enforce length limits
  if (username.length > 104 || password.length > 256) {
    return false;
  }
  
  return true;
}

/**
 * Validates that a hostname doesn't exceed maximum length
 * @param hostname - The hostname to validate
 * @returns true if hostname is within valid length (1-253 characters)
 * @example
 * isValidHostnameLength("server01.domain.com"); // true
 * isValidHostnameLength("a"); // true
 * isValidHostnameLength(""); // false (empty)
 * isValidHostnameLength("a".repeat(254)); // false (too long)
 */
export function isValidHostnameLength(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') {
    return false;
  }
  return hostname.length > 0 && hostname.length <= 253;
}

/**
 * Validates that a description doesn't exceed maximum length
 * @param description - The description to validate
 * @returns true if description is within valid length (0-500 characters)
 * @example
 * isValidDescriptionLength("Production web server"); // true
 * isValidDescriptionLength(""); // true (empty allowed)
 * isValidDescriptionLength("a".repeat(500)); // true
 * isValidDescriptionLength("a".repeat(501)); // false (too long)
 */
export function isValidDescriptionLength(description: string): boolean {
  if (typeof description !== 'string') {
    return false;
  }
  return description.length <= 500;
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param text - The text to escape
 * @returns Escaped HTML-safe string
 * @example
 * escapeHtml("<script>alert('XSS')</script>"); // "&lt;script&gt;alert('XSS')&lt;/script&gt;"
 * escapeHtml("a > b & c < d"); // "a &gt; b &amp; c &lt; d"
 * escapeHtml("Safe text"); // "Safe text"
 */
export function escapeHtml(text: string): string {
  if (!text) return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

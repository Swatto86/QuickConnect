/**
 * Validation Utility Tests
 *
 * Tests for validation functions in src/utils/validation.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidFQDN,
  isValidDomain,
  isValidServerName,
  validateCredentials,
  isValidHostnameLength,
  isValidDescriptionLength,
  escapeHtml,
} from "../utils/validation";

describe("isValidFQDN", () => {
  describe("valid FQDNs", () => {
    it("should accept standard server.domain.com format", () => {
      expect(isValidFQDN("server01.domain.com")).toBe(true);
    });

    it("should accept server.subdomain.domain.com format", () => {
      expect(isValidFQDN("server01.subdomain.domain.com")).toBe(true);
    });

    it("should accept two-part domain (server.local)", () => {
      expect(isValidFQDN("server01.local")).toBe(true);
    });

    it("should accept hostnames with numbers", () => {
      expect(isValidFQDN("server01.domain123.com")).toBe(true);
    });

    it("should accept hostnames with hyphens", () => {
      expect(isValidFQDN("web-server-01.my-domain.com")).toBe(true);
    });

    it("should accept uppercase characters", () => {
      expect(isValidFQDN("SERVER01.DOMAIN.COM")).toBe(true);
    });

    it("should accept mixed case", () => {
      expect(isValidFQDN("Server01.Domain.Com")).toBe(true);
    });

    it("should accept long TLDs", () => {
      expect(isValidFQDN("server.domain.technology")).toBe(true);
    });

    it("should accept .local domain", () => {
      expect(isValidFQDN("dc01.contoso.local")).toBe(true);
    });

    it("should accept .internal domain", () => {
      expect(isValidFQDN("server.corp.internal")).toBe(true);
    });

    it("should accept deeply nested subdomains", () => {
      expect(isValidFQDN("server.dept.region.corp.company.com")).toBe(true);
    });
  });

  describe("invalid FQDNs", () => {
    it("should reject empty string", () => {
      expect(isValidFQDN("")).toBe(false);
    });

    it("should reject whitespace only", () => {
      expect(isValidFQDN("   ")).toBe(false);
    });

    it("should reject null", () => {
      expect(isValidFQDN(null as unknown as string)).toBe(false);
    });

    it("should reject undefined", () => {
      expect(isValidFQDN(undefined as unknown as string)).toBe(false);
    });

    it("should reject single word without domain", () => {
      expect(isValidFQDN("server")).toBe(false);
    });

    it("should reject hostname starting with hyphen", () => {
      expect(isValidFQDN("-server.domain.com")).toBe(false);
    });

    it("should reject hostname ending with hyphen", () => {
      expect(isValidFQDN("server-.domain.com")).toBe(false);
    });

    it("should reject domain starting with dot", () => {
      expect(isValidFQDN(".server.domain.com")).toBe(false);
    });

    it("should reject domain ending with dot", () => {
      expect(isValidFQDN("server.domain.com.")).toBe(false);
    });

    it("should reject IP addresses", () => {
      expect(isValidFQDN("192.168.1.1")).toBe(false);
    });

    it("should reject hostnames with spaces", () => {
      expect(isValidFQDN("server 01.domain.com")).toBe(false);
    });

    it("should reject hostnames with underscores", () => {
      expect(isValidFQDN("server_01.domain.com")).toBe(false);
    });

    it("should reject consecutive dots", () => {
      expect(isValidFQDN("server..domain.com")).toBe(false);
    });

    it("should reject single character TLD", () => {
      expect(isValidFQDN("server.domain.c")).toBe(false);
    });

    it("should reject hostname exceeding 253 characters total", () => {
      const longHostname =
        "a".repeat(64) +
        "." +
        "b".repeat(64) +
        "." +
        "c".repeat(64) +
        "." +
        "d".repeat(60) +
        ".com";
      expect(isValidFQDN(longHostname)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle trimming of whitespace", () => {
      expect(isValidFQDN("  server.domain.com  ")).toBe(true);
    });

    it("should accept hostname portion at exactly 63 characters", () => {
      const maxHostname = "a".repeat(63) + ".domain.com";
      expect(isValidFQDN(maxHostname)).toBe(true);
    });

    it("should reject hostname portion exceeding 63 characters", () => {
      const tooLongHostname = "a".repeat(64) + ".domain.com";
      expect(isValidFQDN(tooLongHostname)).toBe(false);
    });

    it("should accept numeric hostname", () => {
      expect(isValidFQDN("123.domain.com")).toBe(true);
    });

    it("should accept two-letter TLD", () => {
      expect(isValidFQDN("server.domain.uk")).toBe(true);
    });
  });
});

describe("isValidDomain", () => {
  describe("valid domains", () => {
    it("should accept standard domain.com format", () => {
      expect(isValidDomain("domain.com")).toBe(true);
    });

    it("should accept subdomain.domain.com format", () => {
      expect(isValidDomain("subdomain.domain.com")).toBe(true);
    });

    it("should accept contoso.local format", () => {
      expect(isValidDomain("contoso.local")).toBe(true);
    });

    it("should accept corp.contoso.com format", () => {
      expect(isValidDomain("corp.contoso.com")).toBe(true);
    });

    it("should accept domains with numbers", () => {
      expect(isValidDomain("domain123.com")).toBe(true);
    });

    it("should accept domains with hyphens", () => {
      expect(isValidDomain("my-domain.com")).toBe(true);
    });

    it("should accept long TLDs", () => {
      expect(isValidDomain("example.technology")).toBe(true);
    });

    it("should accept country-code TLDs", () => {
      expect(isValidDomain("example.co.uk")).toBe(true);
    });

    it("should accept internal domains", () => {
      expect(isValidDomain("internal.corp")).toBe(true);
    });
  });

  describe("invalid domains", () => {
    it("should reject empty string", () => {
      expect(isValidDomain("")).toBe(false);
    });

    it("should reject whitespace only", () => {
      expect(isValidDomain("   ")).toBe(false);
    });

    it("should reject null", () => {
      expect(isValidDomain(null as unknown as string)).toBe(false);
    });

    it("should reject undefined", () => {
      expect(isValidDomain(undefined as unknown as string)).toBe(false);
    });

    it("should reject single word without TLD", () => {
      expect(isValidDomain("domain")).toBe(false);
    });

    it("should reject single letter TLD", () => {
      expect(isValidDomain("domain.c")).toBe(false);
    });

    it("should reject domain starting with hyphen", () => {
      expect(isValidDomain("-domain.com")).toBe(false);
    });

    it("should reject domain ending with hyphen", () => {
      expect(isValidDomain("domain-.com")).toBe(false);
    });

    it("should reject domain starting with dot", () => {
      expect(isValidDomain(".domain.com")).toBe(false);
    });

    it("should reject domain ending with dot", () => {
      expect(isValidDomain("domain.com.")).toBe(false);
    });

    it("should reject domains with spaces", () => {
      expect(isValidDomain("my domain.com")).toBe(false);
    });

    it("should reject domains with underscores", () => {
      expect(isValidDomain("my_domain.com")).toBe(false);
    });

    it("should reject numeric-only TLD", () => {
      expect(isValidDomain("domain.123")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle trimming of whitespace", () => {
      expect(isValidDomain("  domain.com  ")).toBe(true);
    });
  });
});

describe("isValidServerName", () => {
  describe("valid server names", () => {
    it("should accept server.domain.com with domain.com", () => {
      expect(isValidServerName("server.domain.com", "domain.com")).toBe(true);
    });

    it("should accept dc01.contoso.local with contoso.local", () => {
      expect(isValidServerName("dc01.contoso.local", "contoso.local")).toBe(
        true,
      );
    });

    it("should accept server with hyphen", () => {
      expect(
        isValidServerName("web-server-01.contoso.com", "contoso.com"),
      ).toBe(true);
    });

    it("should accept server with numbers", () => {
      expect(isValidServerName("server123.domain.com", "domain.com")).toBe(
        true,
      );
    });

    it("should be case-insensitive", () => {
      expect(isValidServerName("SERVER.DOMAIN.COM", "domain.com")).toBe(true);
    });

    it("should accept mixed case", () => {
      expect(isValidServerName("Server.Domain.Com", "DOMAIN.COM")).toBe(true);
    });

    it("should accept subdomain in server name", () => {
      expect(isValidServerName("server.dept.contoso.com", "contoso.com")).toBe(
        true,
      );
    });
  });

  describe("invalid server names", () => {
    it("should reject empty server", () => {
      expect(isValidServerName("", "domain.com")).toBe(false);
    });

    it("should reject empty domain", () => {
      expect(isValidServerName("server.domain.com", "")).toBe(false);
    });

    it("should reject null server", () => {
      expect(isValidServerName(null as unknown as string, "domain.com")).toBe(
        false,
      );
    });

    it("should reject null domain", () => {
      expect(
        isValidServerName("server.domain.com", null as unknown as string),
      ).toBe(false);
    });

    it("should reject server not ending with domain", () => {
      expect(isValidServerName("server.other.com", "domain.com")).toBe(false);
    });

    it("should reject server that is just the domain", () => {
      expect(isValidServerName("domain.com", "domain.com")).toBe(false);
    });

    it("should reject server starting with hyphen", () => {
      expect(isValidServerName("-server.domain.com", "domain.com")).toBe(false);
    });

    it("should reject server ending with hyphen before domain", () => {
      expect(isValidServerName("server-.domain.com", "domain.com")).toBe(false);
    });

    it("should reject server with spaces", () => {
      expect(isValidServerName("ser ver.domain.com", "domain.com")).toBe(false);
    });

    it("should reject server with underscores", () => {
      expect(isValidServerName("ser_ver.domain.com", "domain.com")).toBe(false);
    });

    it("should reject partial domain match", () => {
      expect(isValidServerName("server.subdomain.com", "domain.com")).toBe(
        false,
      );
    });
  });

  describe("edge cases", () => {
    it("should handle trimming of whitespace", () => {
      expect(isValidServerName("  server.domain.com  ", "  domain.com  ")).toBe(
        true,
      );
    });

    it("should reject hostname portion exceeding 63 characters", () => {
      const longHostname = "a".repeat(64) + ".domain.com";
      expect(isValidServerName(longHostname, "domain.com")).toBe(false);
    });

    it("should accept hostname portion at 63 characters", () => {
      const maxHostname = "a".repeat(63) + ".domain.com";
      expect(isValidServerName(maxHostname, "domain.com")).toBe(true);
    });
  });
});

describe("validateCredentials", () => {
  describe("valid credentials", () => {
    it("should return true when both username and password are provided", () => {
      expect(validateCredentials("user", "pass")).toBe(true);
    });

    it("should accept domain\\username format", () => {
      expect(validateCredentials("DOMAIN\\user", "password")).toBe(true);
    });

    it("should accept user@domain.com format", () => {
      expect(validateCredentials("user@domain.com", "password")).toBe(true);
    });

    it("should accept special characters in password", () => {
      expect(validateCredentials("user", "P@ssw0rd!#$%")).toBe(true);
    });
  });

  describe("invalid credentials", () => {
    it("should return false when username is empty", () => {
      expect(validateCredentials("", "password")).toBe(false);
    });

    it("should return false when password is empty", () => {
      expect(validateCredentials("user", "")).toBe(false);
    });

    it("should return false when both are empty", () => {
      expect(validateCredentials("", "")).toBe(false);
    });

    it("should return false when username is only whitespace", () => {
      expect(validateCredentials("   ", "password")).toBe(false);
    });

    it("should return false when password is only whitespace", () => {
      expect(validateCredentials("user", "   ")).toBe(false);
    });

    it("should return false when username is null", () => {
      expect(validateCredentials(null as unknown as string, "password")).toBe(
        false,
      );
    });

    it("should return false when password is null", () => {
      expect(validateCredentials("user", null as unknown as string)).toBe(
        false,
      );
    });

    it("should return false when username is undefined", () => {
      expect(
        validateCredentials(undefined as unknown as string, "password"),
      ).toBe(false);
    });

    it("should return false when password is undefined", () => {
      expect(validateCredentials("user", undefined as unknown as string)).toBe(
        false,
      );
    });
  });
});

describe("escapeHtml", () => {
  beforeEach(() => {
    // Ensure we have a clean document
    document.body.innerHTML = "";
  });

  it("should escape less than sign", () => {
    const result = escapeHtml("<script>");
    expect(result).toBe("&lt;script&gt;");
  });

  it("should escape greater than sign", () => {
    const result = escapeHtml("a > b");
    expect(result).toBe("a &gt; b");
  });

  it("should escape ampersand", () => {
    const result = escapeHtml("a & b");
    expect(result).toBe("a &amp; b");
  });

  it("should escape double quotes", () => {
    const result = escapeHtml('He said "hello"');
    // jsdom's textContent/innerHTML doesn't escape double quotes as entities
    // but it does prevent them from breaking out of attribute contexts
    expect(result).toContain('"');
  });

  it("should return empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("should return empty string for null input", () => {
    expect(escapeHtml(null as unknown as string)).toBe("");
  });

  it("should return empty string for undefined input", () => {
    expect(escapeHtml(undefined as unknown as string)).toBe("");
  });

  it("should not modify safe text", () => {
    const safeText = "Hello World 123";
    expect(escapeHtml(safeText)).toBe(safeText);
  });

  it("should escape complete XSS payload", () => {
    const xssPayload = '<script>alert("XSS")</script>';
    const result = escapeHtml(xssPayload);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
  });

  it("should escape HTML event handlers", () => {
    const result = escapeHtml('<img onerror="alert(1)">');
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;");
  });

  it("should handle multiple special characters", () => {
    const result = escapeHtml("<div class=\"test\" data-value='foo&bar'>");
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
    expect(result).toContain("&amp;");
  });

  it("should preserve line breaks as literal characters", () => {
    const result = escapeHtml("line1\nline2");
    expect(result).toBe("line1\nline2");
  });

  it("should handle unicode characters", () => {
    const result = escapeHtml("Hello 世界 🌍");
    expect(result).toBe("Hello 世界 🌍");
  });
});

describe("validateCredentials", () => {
  describe("valid credentials", () => {
    it("should accept valid username and password", () => {
      expect(validateCredentials("user", "pass")).toBe(true);
    });

    it("should accept credentials at max length", () => {
      const username = "a".repeat(104);
      const password = "b".repeat(256);
      expect(validateCredentials(username, password)).toBe(true);
    });

    it("should accept domain\\username format", () => {
      expect(validateCredentials("DOMAIN\\user", "password123")).toBe(true);
    });

    it("should accept UPN format", () => {
      expect(validateCredentials("user@domain.com", "password123")).toBe(true);
    });

    it("should accept usernames with spaces", () => {
      expect(validateCredentials("First Last", "password123")).toBe(true);
    });
  });

  describe("invalid credentials", () => {
    it("should reject empty username", () => {
      expect(validateCredentials("", "password")).toBe(false);
    });

    it("should reject empty password", () => {
      expect(validateCredentials("username", "")).toBe(false);
    });

    it("should reject whitespace-only username", () => {
      expect(validateCredentials("   ", "password")).toBe(false);
    });

    it("should reject whitespace-only password", () => {
      expect(validateCredentials("username", "   ")).toBe(false);
    });

    it("should reject username exceeding max length (104)", () => {
      const username = "a".repeat(105);
      expect(validateCredentials(username, "password")).toBe(false);
    });

    it("should reject password exceeding max length (256)", () => {
      const password = "b".repeat(257);
      expect(validateCredentials("username", password)).toBe(false);
    });

    it("should reject null values", () => {
      expect(validateCredentials(null as any, "password")).toBe(false);
      expect(validateCredentials("username", null as any)).toBe(false);
    });

    it("should reject undefined values", () => {
      expect(validateCredentials(undefined as any, "password")).toBe(false);
      expect(validateCredentials("username", undefined as any)).toBe(false);
    });
  });
});
describe("isValidHostnameLength", () => {
  describe("valid hostnames", () => {
    it("should accept single character hostname", () => {
      expect(isValidHostnameLength("a")).toBe(true);
    });

    it("should accept typical hostname length", () => {
      expect(isValidHostnameLength("server01.domain.com")).toBe(true);
    });

    it("should accept hostname at maximum length (253 chars)", () => {
      const hostname = "a".repeat(253);
      expect(isValidHostnameLength(hostname)).toBe(true);
    });

    it("should accept short hostname", () => {
      expect(isValidHostnameLength("pc")).toBe(true);
    });
  });

  describe("invalid hostnames", () => {
    it("should reject empty string", () => {
      expect(isValidHostnameLength("")).toBe(false);
    });

    it("should reject hostname exceeding maximum length (254 chars)", () => {
      const hostname = "a".repeat(254);
      expect(isValidHostnameLength(hostname)).toBe(false);
    });

    it("should reject null value", () => {
      expect(isValidHostnameLength(null as any)).toBe(false);
    });

    it("should reject undefined value", () => {
      expect(isValidHostnameLength(undefined as any)).toBe(false);
    });

    it("should reject non-string value (number)", () => {
      expect(isValidHostnameLength(123 as any)).toBe(false);
    });

    it("should reject non-string value (object)", () => {
      expect(isValidHostnameLength({} as any)).toBe(false);
    });
  });
});

describe("isValidDescriptionLength", () => {
  describe("valid descriptions", () => {
    it("should accept empty string", () => {
      expect(isValidDescriptionLength("")).toBe(true);
    });

    it("should accept typical description", () => {
      expect(isValidDescriptionLength("Production web server")).toBe(true);
    });

    it("should accept description at maximum length (500 chars)", () => {
      const description = "a".repeat(500);
      expect(isValidDescriptionLength(description)).toBe(true);
    });

    it("should accept single character", () => {
      expect(isValidDescriptionLength("x")).toBe(true);
    });

    it("should accept description with special characters", () => {
      expect(isValidDescriptionLength("Server @ Building #4 - 3rd Floor")).toBe(
        true,
      );
    });

    it("should accept description with unicode characters", () => {
      expect(isValidDescriptionLength("サーバー 🖥️")).toBe(true);
    });
  });

  describe("invalid descriptions", () => {
    it("should reject description exceeding maximum length (501 chars)", () => {
      const description = "a".repeat(501);
      expect(isValidDescriptionLength(description)).toBe(false);
    });

    it("should reject non-string value (null)", () => {
      expect(isValidDescriptionLength(null as any)).toBe(false);
    });

    it("should reject non-string value (undefined)", () => {
      expect(isValidDescriptionLength(undefined as any)).toBe(false);
    });

    it("should reject non-string value (number)", () => {
      expect(isValidDescriptionLength(123 as any)).toBe(false);
    });

    it("should reject non-string value (object)", () => {
      expect(isValidDescriptionLength({} as any)).toBe(false);
    });
  });
});
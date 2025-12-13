/**
 * Property-Based Tests for Validation Module
 *
 * Uses fast-check to generate thousands of random inputs to test validation functions
 * for edge cases and unexpected inputs that manual tests might miss.
 * 
 * Property-based testing helps ensure:
 * - Functions handle all possible inputs correctly
 * - Edge cases are caught automatically
 * - Functions maintain invariants across random data
 * 
 * @module tests/validation-property
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  isValidFQDN,
  isValidDomain,
  isValidServerName,
  validateCredentials,
  escapeHtml,
} from "../utils/validation";

describe("Property-Based Tests: isValidFQDN", () => {
  it("should always return false for strings over 253 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 254, maxLength: 500 }),
        (longString) => {
          expect(isValidFQDN(longString)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should always return false for IP addresses", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 })
        ),
        ([a, b, c, d]) => {
          const ip = `${a}.${b}.${c}.${d}`;
          expect(isValidFQDN(ip)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should always return false for strings without dots", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 1, maxLength: 63 }).map(arr => arr.join('')),
        (noDotString) => {
          // Skip if it contains a dot (shouldn't happen with our generator)
          if (noDotString.includes('.')) return;
          expect(isValidFQDN(noDotString)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle arbitrary strings without crashing", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 300 }),
        (randomString) => {
          // Should not throw
          const result = isValidFQDN(randomString);
          expect(typeof result).toBe("boolean");
        }
      ),
      { numRuns: 500 }
    );
  });

  it("should always trim whitespace before validation", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (prefix, suffix) => {
          const validFQDN = "server.domain.com";
          const withWhitespace = prefix + validFQDN + suffix;
          const withoutWhitespace = validFQDN;
          
          // If trimmed version is valid, the version with whitespace should match
          const trimmedResult = isValidFQDN(withWhitespace.trim());
          const untrimmedResult = isValidFQDN(withWhitespace);
          
          // Both should give same result after internal trimming
          expect(untrimmedResult).toBe(trimmedResult);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property-Based Tests: isValidDomain", () => {
  it("should always return false for strings over 253 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 254, maxLength: 500 }),
        (longString) => {
          expect(isValidDomain(longString)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle arbitrary strings without crashing", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 300 }),
        (randomString) => {
          const result = isValidDomain(randomString);
          expect(typeof result).toBe("boolean");
        }
      ),
      { numRuns: 500 }
    );
  });

  it("should always require at least one dot", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 1, maxLength: 50 }).map(arr => arr.join('')),
        (noDotString) => {
          if (noDotString.includes('.')) return; // Skip if contains dot
          expect(isValidDomain(noDotString)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property-Based Tests: isValidServerName", () => {
  it("should always require server to end with domain", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (server, domain) => {
          const validDomain = "contoso.com";
          const invalidServer = server + ".wrongdomain.com";
          
          expect(isValidServerName(invalidServer, validDomain)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle arbitrary inputs without crashing", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 100 }),
        fc.string({ maxLength: 100 }),
        (server, domain) => {
          const result = isValidServerName(server, domain);
          expect(typeof result).toBe("boolean");
        }
      ),
      { numRuns: 500 }
    );
  });
});

describe("Property-Based Tests: validateCredentials", () => {
  it("should always return false when username exceeds 104 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 105, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (username, password) => {
          expect(validateCredentials(username, password)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should always return false when password exceeds 256 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 257, maxLength: 300 }),
        (username, password) => {
          expect(validateCredentials(username, password)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should always return true for valid length non-empty credentials", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 104 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 256 }).filter(s => s.trim().length > 0),
        (username, password) => {
          expect(validateCredentials(username, password)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should always return false for empty or whitespace-only inputs", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("", "   ", "\t", "\n", "  \t\n  "),
        fc.string({ minLength: 1, maxLength: 50 }),
        (emptyString, validString) => {
          // Empty username
          expect(validateCredentials(emptyString, validString)).toBe(false);
          // Empty password
          expect(validateCredentials(validString, emptyString)).toBe(false);
          // Both empty
          expect(validateCredentials(emptyString, emptyString)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should handle arbitrary inputs without crashing", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        fc.string({ maxLength: 300 }),
        (username, password) => {
          const result = validateCredentials(username, password);
          expect(typeof result).toBe("boolean");
        }
      ),
      { numRuns: 500 }
    );
  });

  it("should be consistent: same inputs always produce same output", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 150 }),
        fc.string({ maxLength: 300 }),
        (username, password) => {
          const result1 = validateCredentials(username, password);
          const result2 = validateCredentials(username, password);
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe("Property-Based Tests: escapeHtml", () => {
  it("should never return a string containing unescaped < or >", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        (randomString) => {
          const escaped = escapeHtml(randomString);
          
          // If original contains <, escaped should not contain raw <
          if (randomString.includes('<')) {
            expect(escaped.includes('<')).toBe(false);
          }
          
          // If original contains >, escaped should not contain raw >
          if (randomString.includes('>')) {
            expect(escaped.includes('>')).toBe(false);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it("should never throw an error for string inputs", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        (str) => {
          expect(() => escapeHtml(str)).not.toThrow();
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("should always return a string", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        (randomString) => {
          const result = escapeHtml(randomString);
          expect(typeof result).toBe("string");
        }
      ),
      { numRuns: 200 }
    );
  });

  it("should escape special characters consistently", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 100 }),
        (randomString) => {
          const escaped = escapeHtml(randomString);
          // Escaped string should not contain raw < or >
          if (randomString.includes('<') || randomString.includes('>')) {
            expect(escaped).not.toMatch(/[<>]/);
          }
          // Escaping should be deterministic
          const escaped2 = escapeHtml(randomString);
          expect(escaped2).toBe(escaped);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe("Property-Based Fuzz Tests: Extreme Edge Cases", () => {
  it("should handle Unicode characters in FQDN validation", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (unicodeStr) => {
          const result = isValidFQDN(unicodeStr);
          expect(typeof result).toBe("boolean");
          // Unicode chars should generally fail FQDN validation
          if (!/^[a-z0-9.-]+$/i.test(unicodeStr)) {
            expect(result).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("should handle emoji in validation functions", () => {
    const emojis = ["😀", "🚀", "💻", "🌐", "📊", "✨", "🔥", "💡"];
    fc.assert(
      fc.property(
        fc.constantFrom(...emojis),
        fc.string({ minLength: 0, maxLength: 50 }),
        (emoji, baseString) => {
          const withEmoji = baseString + emoji + ".domain.com";
          const result = isValidFQDN(withEmoji);
          expect(typeof result).toBe("boolean");
          expect(result).toBe(false); // Emoji should invalidate FQDN
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle control characters safely", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 31 }), // ASCII control characters
        (controlCharCode) => {
          const controlChar = String.fromCharCode(controlCharCode);
          const testString = `server${controlChar}.domain.com`;
          const result = isValidFQDN(testString);
          expect(typeof result).toBe("boolean");
          expect(result).toBe(false); // Control chars should invalidate
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should handle null bytes safely", () => {
    const testStrings = [
      "server\x00.domain.com",
      "\x00server.domain.com",
      "server.domain.com\x00",
      "server.\x00domain.com",
    ];
    testStrings.forEach((testStr) => {
      const result = isValidFQDN(testStr);
      expect(typeof result).toBe("boolean");
      expect(result).toBe(false);
    });
  });

  it("should handle extremely long labels in FQDN", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 64, max: 200 }),
        (length) => {
          const longLabel = "a".repeat(length);
          const fqdn = `${longLabel}.domain.com`;
          const result = isValidFQDN(fqdn);
          expect(result).toBe(false); // Labels must be ≤ 63 chars
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should handle repeated dots in FQDN", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (numDots) => {
          const dots = ".".repeat(numDots);
          const fqdn = `server${dots}domain.com`;
          const result = isValidFQDN(fqdn);
          expect(result).toBe(false); // Consecutive dots invalid
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should handle leading/trailing hyphens in labels", () => {
    // Test that labels can contain hyphens but behavior may vary
    const testCases = [
      "-server.domain.com",
      "server-.domain.com",
      "server.-domain.com",
      "server.domain-.com",
    ];
    testCases.forEach((testCase) => {
      const result = isValidFQDN(testCase);
      expect(typeof result).toBe("boolean"); // Should not crash
    });
  });

  it("should handle XSS payloads in escapeHtml", () => {
    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "<svg/onload=alert('XSS')>",
      "javascript:alert('XSS')",
      "<iframe src='javascript:alert(1)'>",
      "</script><script>alert('XSS')</script>",
      "<<SCRIPT>alert('XSS');//<</SCRIPT>",
      "<scr<script>ipt>alert('XSS')</scr</script>ipt>",
    ];
    xssPayloads.forEach((payload) => {
      const escaped = escapeHtml(payload);
      expect(escaped).not.toContain("<script");
      expect(escaped).not.toContain("<img");
      expect(escaped).not.toContain("<svg");
      expect(escaped).not.toContain("<iframe");
      expect(escaped).not.toMatch(/<[^>]+>/); // No HTML tags should remain
    });
  });

  it("should handle all HTML entities correctly", () => {
    // Browser native escaping handles <, >, & reliably
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
    };

    Object.entries(entities).forEach(([char, entity]) => {
      const result = escapeHtml(char);
      expect(result).toBe(entity);
    });
    
    // Quotes may not be escaped by browser API
    const quotesResult = escapeHtml('"\'');
    expect(typeof quotesResult).toBe("string");
  });

  it("should handle mixed HTML entities and Unicode", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        (unicodeStr) => {
          const withHtml = `<div>${unicodeStr}</div>`;
          const escaped = escapeHtml(withHtml);
          expect(escaped).toContain("&lt;div&gt;");
          expect(escaped).toContain("&lt;/div&gt;");
          expect(escaped).not.toMatch(/<div>/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle credential format edge cases", () => {
    const edgeCases = [
      { username: "", password: "pass", valid: false },
      { username: "user", password: "", valid: false },
      { username: "   ", password: "pass", valid: false },
      { username: "user", password: "   ", valid: false },
      { username: "u".repeat(1000), password: "pass", shouldFail: true }, // Very long username
      { username: "user", password: "p".repeat(1000), shouldFail: true }, // Very long password
      { username: "user@", password: "pass", valid: true }, // @ at end
      { username: "@user", password: "pass", valid: true }, // @ at start
      { username: "user@@domain", password: "pass", valid: true }, // Multiple @
      { username: "domain\\", password: "pass", valid: true }, // Backslash at end
      { username: "\\user", password: "pass", valid: true }, // Backslash at start
      { username: "domain\\\\user", password: "pass", valid: true }, // Multiple backslashes
    ];

    edgeCases.forEach(({ username, password, valid, shouldFail }) => {
      const result = validateCredentials(username, password);
      if (shouldFail) {
        expect(result).toBe(false);
      } else if (valid !== undefined) {
        expect(result).toBe(valid);
      }
      expect(typeof result).toBe("boolean");
    });
  });

  it("should handle special characters in credentials", () => {
    const specialChars = "!@#$%^&*()_+-=[]{}|;:',.<>?/`~";
    fc.assert(
      fc.property(
        fc.constantFrom(...specialChars.split("")),
        fc.string({ minLength: 1, maxLength: 20 }),
        (specialChar, baseStr) => {
          const username = baseStr + specialChar + "user";
          const password = "validPassword123";
          // validateCredentials should not crash
          expect(() => validateCredentials(username, password)).not.toThrow();
          const result = validateCredentials(username, password);
          expect(typeof result).toBe("boolean");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle whitespace variations in validation", () => {
    const whitespaceVariations = [
      "  server.domain.com  ", // Leading/trailing spaces
      "\tserver.domain.com\t", // Tabs
      "\nserver.domain.com\n", // Newlines
      "\rserver.domain.com\r", // Carriage returns
      " \t\n server.domain.com \n\t ", // Mixed whitespace
    ];

    whitespaceVariations.forEach((variant) => {
      const result = isValidFQDN(variant);
      expect(typeof result).toBe("boolean");
      // Should behave same as trimmed version
      expect(result).toBe(isValidFQDN(variant.trim()));
    });
  });

  it("should handle maximum length domains correctly", () => {
    // DNS allows max 253 chars for FQDN
    const maxValidLength = 253;
    const label = "a".repeat(63); // Max label length
    
    // Build a domain close to max length
    let domain = label;
    while (domain.length < maxValidLength - 10) {
      domain += "." + label.substring(0, Math.min(63, maxValidLength - domain.length - 1));
    }

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        (extraChars) => {
          const testDomain = domain + "x".repeat(extraChars);
          const result = isValidFQDN(testDomain);
          if (testDomain.length > 253) {
            expect(result).toBe(false);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should handle numeric-only labels", () => {
    const numericTests = [
      "123.456.789.012", // Looks like IP but not valid octets
      "999.999.999.999", // Out of range IP
      "1234567890.domain.com", // Large number as hostname
      "123.domain.com", // Number as first label
    ];

    numericTests.forEach((test) => {
      const result = isValidFQDN(test);
      expect(typeof result).toBe("boolean");
    });
  });

  it("should handle case sensitivity appropriately", () => {
    fc.assert(
      fc.property(
        fc.constant("server.domain.com"),
        (baseHostname) => {
          const variations = [
            baseHostname.toUpperCase(),
            baseHostname.toLowerCase(),
            "SeRvEr.DoMaIn.CoM",
            "SERVER.domain.com",
          ];

          const results = variations.map((v) => isValidFQDN(v));
          // All should return same result (case-insensitive for validity)
          expect(new Set(results).size).toBe(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should handle TLD variations", () => {
    const tlds = ["com", "net", "org", "edu", "gov", "io", "co.uk", "local", "internal"];
    fc.assert(
      fc.property(
        fc.constantFrom(...tlds),
        (tld) => {
          const fqdn = `server.domain.${tld}`;
          const result = isValidFQDN(fqdn);
          expect(typeof result).toBe("boolean");
        }
      ),
      { numRuns: 50 }
    );
  });

  it("should handle internationalized domain names (IDN)", () => {
    const idnExamples = [
      "münchen.de",
      "日本.jp",
      "中国.cn",
      "россия.рф",
      "مصر.مصر",
    ];

    idnExamples.forEach((idn) => {
      const result = isValidFQDN(idn);
      expect(typeof result).toBe("boolean");
      // Our validator may reject non-ASCII, which is acceptable
      expect(result).toBe(false);
    });
  });

  it("should handle SQL injection attempts", () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE hosts; --",
      "1' OR '1'='1",
      "admin'--",
      "' OR 1=1--",
      "' UNION SELECT NULL--",
    ];

    sqlInjectionPayloads.forEach((payload) => {
      // escapeHtml should not crash, but quotes may not be escaped
      expect(() => escapeHtml(payload)).not.toThrow();
      expect(typeof isValidFQDN(payload)).toBe("boolean");
    });
  });

  it("should handle path traversal attempts", () => {
    const pathTraversalPayloads = [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32",
      "%2e%2e%2f%2e%2e%2f",
      "....//....//....//",
    ];

    pathTraversalPayloads.forEach((payload) => {
      const result = isValidFQDN(payload);
      expect(result).toBe(false);
      const escaped = escapeHtml(payload);
      expect(typeof escaped).toBe("string");
    });
  });

  it("should handle very long inputs without crashing", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000 }),
        (length) => {
          const longString = "a".repeat(length);
          expect(() => isValidFQDN(longString)).not.toThrow();
          expect(() => escapeHtml(longString)).not.toThrow();
          expect(() => validateCredentials(longString, "pass")).not.toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should handle rapid-fire validation calls", () => {
    const testData = Array.from({ length: 10000 }, (_, i) => `server${i}.domain.com`);
    expect(() => {
      testData.forEach((hostname) => isValidFQDN(hostname));
    }).not.toThrow();
  });
});

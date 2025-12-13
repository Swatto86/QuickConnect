/**
 * Error Utility Tests
 *
 * Tests for error handling functions in src/utils/errors.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
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
  type ErrorData,
  type ErrorSeverity,
} from "../utils/errors";

// Sample test data
const createSampleErrors = (): ErrorData[] => [
  {
    message: "Connection failed to server",
    timestamp: "2024-01-15 10:30:00",
    category: "ERROR",
    details: "Socket timeout after 30 seconds",
  },
  {
    message: "Authentication warning",
    timestamp: "2024-01-15 11:00:00",
    category: "WARNING",
  },
  {
    message: "Server unreachable",
    timestamp: "2024-01-15 12:00:00",
    category: "CRITICAL",
    details: "All retry attempts exhausted",
  },
  {
    message: "Debug information logged",
    timestamp: "2024-01-15 13:00:00",
    category: "INFO",
  },
  {
    message: "Fatal system error",
    timestamp: "2024-01-15 14:00:00",
    category: "FATAL",
    details: "Memory allocation failed",
  },
];

describe("getSeverityFromCategory", () => {
  describe("critical severity", () => {
    it("should return critical for CRITICAL category", () => {
      expect(getSeverityFromCategory("CRITICAL")).toBe("critical");
    });

    it("should return critical for FATAL category", () => {
      expect(getSeverityFromCategory("FATAL")).toBe("critical");
    });

    it("should return critical for CRITICAL_ERROR category", () => {
      expect(getSeverityFromCategory("CRITICAL_ERROR")).toBe("critical");
    });

    it("should return critical for FATAL_CRASH category", () => {
      expect(getSeverityFromCategory("FATAL_CRASH")).toBe("critical");
    });

    it("should be case-insensitive for critical", () => {
      expect(getSeverityFromCategory("critical")).toBe("critical");
      expect(getSeverityFromCategory("Critical")).toBe("critical");
    });
  });

  describe("error severity", () => {
    it("should return error for ERROR category", () => {
      expect(getSeverityFromCategory("ERROR")).toBe("error");
    });

    it("should return error for RDP_ERROR category", () => {
      expect(getSeverityFromCategory("RDP_ERROR")).toBe("error");
    });

    it("should return error for CONNECTION_ERROR category", () => {
      expect(getSeverityFromCategory("CONNECTION_ERROR")).toBe("error");
    });

    it("should be case-insensitive for error", () => {
      expect(getSeverityFromCategory("error")).toBe("error");
      expect(getSeverityFromCategory("Error")).toBe("error");
    });
  });

  describe("warning severity", () => {
    it("should return warning for WARN category", () => {
      expect(getSeverityFromCategory("WARN")).toBe("warning");
    });

    it("should return warning for WARNING category", () => {
      expect(getSeverityFromCategory("WARNING")).toBe("warning");
    });

    it("should return warning for TIMEOUT_WARN category", () => {
      expect(getSeverityFromCategory("TIMEOUT_WARN")).toBe("warning");
    });

    it("should be case-insensitive for warn", () => {
      expect(getSeverityFromCategory("warn")).toBe("warning");
      expect(getSeverityFromCategory("Warn")).toBe("warning");
    });
  });

  describe("info severity", () => {
    it("should return info for INFO category", () => {
      expect(getSeverityFromCategory("INFO")).toBe("info");
    });

    it("should return info for INFORMATION category", () => {
      expect(getSeverityFromCategory("INFORMATION")).toBe("info");
    });

    it("should return info for DEBUG_INFO category", () => {
      expect(getSeverityFromCategory("DEBUG_INFO")).toBe("info");
    });

    it("should be case-insensitive for info", () => {
      expect(getSeverityFromCategory("info")).toBe("info");
      expect(getSeverityFromCategory("Info")).toBe("info");
    });
  });

  describe("default behavior", () => {
    it("should return error for undefined category", () => {
      expect(getSeverityFromCategory(undefined)).toBe("error");
    });

    it("should return error for unknown category", () => {
      expect(getSeverityFromCategory("UNKNOWN")).toBe("error");
    });

    it("should return error for empty string", () => {
      expect(getSeverityFromCategory("")).toBe("error");
    });

    it("should return error for DEBUG (not matching any)", () => {
      expect(getSeverityFromCategory("DEBUG")).toBe("error");
    });
  });
});

describe("getSeverityColor", () => {
  describe("color classes by category", () => {
    it("should return purple classes for CRITICAL category", () => {
      const result = getSeverityColor("CRITICAL");
      expect(result).toContain("purple");
      expect(result).toContain("bg-purple");
      expect(result).toContain("text-purple");
    });

    it("should return purple classes for FATAL category", () => {
      const result = getSeverityColor("FATAL");
      expect(result).toContain("purple");
    });

    it("should return red classes for ERROR category", () => {
      const result = getSeverityColor("ERROR");
      expect(result).toContain("red");
      expect(result).toContain("bg-red");
      expect(result).toContain("text-red");
    });

    it("should return yellow classes for WARN category", () => {
      const result = getSeverityColor("WARN");
      expect(result).toContain("yellow");
      expect(result).toContain("bg-yellow");
      expect(result).toContain("text-yellow");
    });

    it("should return yellow classes for WARNING category", () => {
      const result = getSeverityColor("WARNING");
      expect(result).toContain("yellow");
    });

    it("should return blue classes for INFO category", () => {
      const result = getSeverityColor("INFO");
      expect(result).toContain("blue");
      expect(result).toContain("bg-blue");
      expect(result).toContain("text-blue");
    });

    it("should return red classes for undefined category", () => {
      const result = getSeverityColor(undefined);
      expect(result).toContain("red");
    });

    it("should return red classes for unknown category", () => {
      const result = getSeverityColor("UNKNOWN");
      expect(result).toContain("red");
    });
  });

  describe("dark mode classes", () => {
    it("should include dark mode classes", () => {
      const result = getSeverityColor("ERROR");
      expect(result).toContain("dark:");
    });

    it("should include both light and dark text colors", () => {
      const result = getSeverityColor("INFO");
      expect(result).toContain("text-blue-800");
      expect(result).toContain("dark:text-blue-300");
    });
  });
});

describe("getBorderColor", () => {
  describe("border classes by category", () => {
    it("should return purple border for CRITICAL category", () => {
      const result = getBorderColor("CRITICAL");
      expect(result).toContain("border-purple");
      expect(result).toContain("bg-purple");
    });

    it("should return red border for ERROR category", () => {
      const result = getBorderColor("ERROR");
      expect(result).toContain("border-red");
      expect(result).toContain("bg-red");
    });

    it("should return yellow border for WARN category", () => {
      const result = getBorderColor("WARN");
      expect(result).toContain("border-yellow");
      expect(result).toContain("bg-yellow");
    });

    it("should return blue border for INFO category", () => {
      const result = getBorderColor("INFO");
      expect(result).toContain("border-blue");
      expect(result).toContain("bg-blue");
    });

    it("should return red border for undefined category", () => {
      const result = getBorderColor(undefined);
      expect(result).toContain("border-red");
    });
  });

  describe("dark mode classes", () => {
    it("should include dark mode border classes", () => {
      const result = getBorderColor("ERROR");
      expect(result).toContain("dark:border-red");
    });

    it("should include dark mode background classes", () => {
      const result = getBorderColor("INFO");
      expect(result).toContain("dark:bg-blue");
    });
  });
});

describe("filterErrors", () => {
  let sampleErrors: ErrorData[];

  beforeEach(() => {
    sampleErrors = createSampleErrors();
  });

  describe("no filter", () => {
    it("should return all errors when query is empty", () => {
      const result = filterErrors(sampleErrors, "");
      expect(result).toHaveLength(5);
    });

    it("should return all errors when query is whitespace", () => {
      const result = filterErrors(sampleErrors, "   ");
      expect(result).toHaveLength(5);
    });

    it("should return a copy, not the original array", () => {
      const result = filterErrors(sampleErrors, "");
      expect(result).not.toBe(sampleErrors);
      expect(result).toEqual(sampleErrors);
    });
  });

  describe("filtering by message", () => {
    it("should filter by exact message text", () => {
      const result = filterErrors(sampleErrors, "Connection failed to server");
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe("Connection failed to server");
    });

    it("should filter by partial message", () => {
      const result = filterErrors(sampleErrors, "server");
      expect(result).toHaveLength(2); // "Connection failed to server" and "Server unreachable"
    });

    it("should be case-insensitive", () => {
      const result = filterErrors(sampleErrors, "CONNECTION");
      expect(result).toHaveLength(1);
    });
  });

  describe("filtering by category", () => {
    it("should filter by category", () => {
      const result = filterErrors(sampleErrors, "CRITICAL");
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("CRITICAL");
    });

    it("should filter by partial category", () => {
      const result = filterErrors(sampleErrors, "ERR");
      // Matches ERROR category and "Server unreachable" message (contains "err")
      expect(result).toHaveLength(2);
    });

    it("should be case-insensitive for category", () => {
      const result = filterErrors(sampleErrors, "warning");
      expect(result).toHaveLength(1);
    });
  });

  describe("filtering by details", () => {
    it("should filter by details content", () => {
      const result = filterErrors(sampleErrors, "timeout");
      expect(result).toHaveLength(1);
      expect(result[0].details).toContain("timeout");
    });

    it("should filter by partial details", () => {
      const result = filterErrors(sampleErrors, "retry");
      expect(result).toHaveLength(1);
    });

    it("should handle errors without details", () => {
      const result = filterErrors(sampleErrors, "Authentication");
      expect(result).toHaveLength(1);
      expect(result[0].details).toBeUndefined();
    });
  });

  describe("filtering by timestamp", () => {
    it("should filter by timestamp", () => {
      const result = filterErrors(sampleErrors, "10:30:00");
      expect(result).toHaveLength(1);
    });

    it("should filter by date portion", () => {
      const result = filterErrors(sampleErrors, "2024-01-15");
      expect(result).toHaveLength(5);
    });
  });

  describe("combined matching", () => {
    it("should match across multiple fields", () => {
      // "error" matches ERROR category
      const result = filterErrors(sampleErrors, "error");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should return empty array when no matches", () => {
      const result = filterErrors(sampleErrors, "nonexistent");
      expect(result).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty errors array", () => {
      const result = filterErrors([], "test");
      expect(result).toHaveLength(0);
    });

    it("should handle single character search", () => {
      const result = filterErrors(sampleErrors, "e");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should trim whitespace from query", () => {
      const result = filterErrors(sampleErrors, "  CRITICAL  ");
      expect(result).toHaveLength(1);
    });
  });
});

describe("formatErrorForExport", () => {
  it("should format error with category and timestamp", () => {
    const error: ErrorData = {
      message: "Test error",
      timestamp: "2024-01-15 10:00:00",
      category: "ERROR",
    };
    const result = formatErrorForExport(error);
    expect(result).toContain("[ERROR]");
    expect(result).toContain("2024-01-15 10:00:00");
    expect(result).toContain("Test error");
  });

  it("should include details when present", () => {
    const error: ErrorData = {
      message: "Test error",
      timestamp: "2024-01-15 10:00:00",
      category: "ERROR",
      details: "Additional information",
    };
    const result = formatErrorForExport(error);
    expect(result).toContain("Details:");
    expect(result).toContain("Additional information");
  });

  it("should not include details section when details is undefined", () => {
    const error: ErrorData = {
      message: "Test error",
      timestamp: "2024-01-15 10:00:00",
      category: "ERROR",
    };
    const result = formatErrorForExport(error);
    expect(result).not.toContain("Details:");
  });

  it("should use ERROR as default category when undefined", () => {
    const error: ErrorData = {
      message: "Test error",
      timestamp: "2024-01-15 10:00:00",
    };
    const result = formatErrorForExport(error);
    expect(result).toContain("[ERROR]");
  });
});

describe("formatErrorsForExport", () => {
  it("should format multiple errors with separators", () => {
    const errors: ErrorData[] = [
      {
        message: "Error 1",
        timestamp: "2024-01-15 10:00:00",
        category: "ERROR",
      },
      {
        message: "Error 2",
        timestamp: "2024-01-15 11:00:00",
        category: "WARNING",
      },
    ];
    const result = formatErrorsForExport(errors);
    expect(result).toContain("Error 1");
    expect(result).toContain("Error 2");
    expect(result).toContain("=".repeat(80));
  });

  it("should handle single error", () => {
    const errors: ErrorData[] = [
      {
        message: "Single error",
        timestamp: "2024-01-15 10:00:00",
        category: "ERROR",
      },
    ];
    const result = formatErrorsForExport(errors);
    expect(result).toContain("Single error");
  });

  it("should handle empty array", () => {
    const result = formatErrorsForExport([]);
    expect(result).toBe("");
  });
});

describe("createError", () => {
  it("should create error with message and default category", () => {
    const error = createError("Test message");
    expect(error.message).toBe("Test message");
    expect(error.category).toBe("ERROR");
    expect(error.timestamp).toBeDefined();
  });

  it("should create error with custom category", () => {
    const error = createError("Test message", "CUSTOM_CATEGORY");
    expect(error.category).toBe("CUSTOM_CATEGORY");
  });

  it("should create error with details", () => {
    const error = createError("Test message", "ERROR", "Some details");
    expect(error.details).toBe("Some details");
  });

  it("should have valid timestamp format", () => {
    const error = createError("Test message");
    // Format: YYYY-MM-DD HH:MM:SS
    const timestampRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    expect(error.timestamp).toMatch(timestampRegex);
  });
});

describe("formatTimestamp", () => {
  it("should format date to YYYY-MM-DD HH:MM:SS", () => {
    const date = new Date(2024, 0, 15, 10, 30, 45); // 15 Jan 2024 10:30:45
    const result = formatTimestamp(date);
    expect(result).toBe("2024-01-15 10:30:45");
  });

  it("should pad single digit values with zeros", () => {
    const date = new Date(2024, 0, 5, 9, 5, 3); // 5 Jan 2024 09:05:03
    const result = formatTimestamp(date);
    expect(result).toBe("2024-01-05 09:05:03");
  });

  it("should handle midnight", () => {
    const date = new Date(2024, 0, 1, 0, 0, 0);
    const result = formatTimestamp(date);
    expect(result).toBe("2024-01-01 00:00:00");
  });

  it("should handle end of year", () => {
    const date = new Date(2024, 11, 31, 23, 59, 59);
    const result = formatTimestamp(date);
    expect(result).toBe("2024-12-31 23:59:59");
  });
});

describe("countByCategory", () => {
  let sampleErrors: ErrorData[];

  beforeEach(() => {
    sampleErrors = createSampleErrors();
  });

  it("should count errors by category", () => {
    const result = countByCategory(sampleErrors);
    expect(result["ERROR"]).toBe(1);
    expect(result["WARNING"]).toBe(1);
    expect(result["CRITICAL"]).toBe(1);
    expect(result["INFO"]).toBe(1);
    expect(result["FATAL"]).toBe(1);
  });

  it("should use ERROR for undefined category", () => {
    const errors: ErrorData[] = [
      { message: "No category", timestamp: "2024-01-15 10:00:00" },
      {
        message: "Has category",
        timestamp: "2024-01-15 10:00:00",
        category: "ERROR",
      },
    ];
    const result = countByCategory(errors);
    expect(result["ERROR"]).toBe(2);
  });

  it("should handle empty array", () => {
    const result = countByCategory([]);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("should handle multiple errors with same category", () => {
    const errors: ErrorData[] = [
      {
        message: "Error 1",
        timestamp: "2024-01-15 10:00:00",
        category: "ERROR",
      },
      {
        message: "Error 2",
        timestamp: "2024-01-15 10:00:00",
        category: "ERROR",
      },
      {
        message: "Error 3",
        timestamp: "2024-01-15 10:00:00",
        category: "ERROR",
      },
    ];
    const result = countByCategory(errors);
    expect(result["ERROR"]).toBe(3);
  });
});

describe("countBySeverity", () => {
  let sampleErrors: ErrorData[];

  beforeEach(() => {
    sampleErrors = createSampleErrors();
  });

  it("should count errors by severity level", () => {
    const result = countBySeverity(sampleErrors);
    expect(result.critical).toBe(2); // CRITICAL and FATAL
    expect(result.error).toBe(1);
    expect(result.warning).toBe(1);
    expect(result.info).toBe(1);
  });

  it("should return zeros for empty array", () => {
    const result = countBySeverity([]);
    expect(result.critical).toBe(0);
    expect(result.error).toBe(0);
    expect(result.warning).toBe(0);
    expect(result.info).toBe(0);
  });

  it("should have all severity keys", () => {
    const result = countBySeverity([]);
    const keys = Object.keys(result) as ErrorSeverity[];
    expect(keys).toContain("critical");
    expect(keys).toContain("error");
    expect(keys).toContain("warning");
    expect(keys).toContain("info");
  });
});

describe("sortByTimestamp", () => {
  it("should sort errors by timestamp (newest first by default)", () => {
    const errors: ErrorData[] = [
      { message: "Old", timestamp: "2024-01-01 00:00:00", category: "ERROR" },
      {
        message: "Newest",
        timestamp: "2024-12-31 23:59:59",
        category: "ERROR",
      },
      {
        message: "Middle",
        timestamp: "2024-06-15 12:00:00",
        category: "ERROR",
      },
    ];
    const result = sortByTimestamp(errors);
    expect(result[0].message).toBe("Newest");
    expect(result[1].message).toBe("Middle");
    expect(result[2].message).toBe("Old");
  });

  it("should sort errors ascending when specified", () => {
    const errors: ErrorData[] = [
      { message: "Old", timestamp: "2024-01-01 00:00:00", category: "ERROR" },
      {
        message: "Newest",
        timestamp: "2024-12-31 23:59:59",
        category: "ERROR",
      },
      {
        message: "Middle",
        timestamp: "2024-06-15 12:00:00",
        category: "ERROR",
      },
    ];
    const result = sortByTimestamp(errors, true);
    expect(result[0].message).toBe("Old");
    expect(result[1].message).toBe("Middle");
    expect(result[2].message).toBe("Newest");
  });

  it("should return a new array, not modify the original", () => {
    const errors: ErrorData[] = [
      {
        message: "Error 1",
        timestamp: "2024-01-15 10:00:00",
        category: "ERROR",
      },
    ];
    const result = sortByTimestamp(errors);
    expect(result).not.toBe(errors);
  });

  it("should handle empty array", () => {
    const result = sortByTimestamp([]);
    expect(result).toHaveLength(0);
  });

  it("should handle single element", () => {
    const errors: ErrorData[] = [
      {
        message: "Only one",
        timestamp: "2024-01-15 10:00:00",
        category: "ERROR",
      },
    ];
    const result = sortByTimestamp(errors);
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("Only one");
  });

  it("should handle errors with same timestamp", () => {
    const errors: ErrorData[] = [
      { message: "First", timestamp: "2024-01-15 10:00:00", category: "ERROR" },
      {
        message: "Second",
        timestamp: "2024-01-15 10:00:00",
        category: "ERROR",
      },
    ];
    const result = sortByTimestamp(errors);
    expect(result).toHaveLength(2);
  });
});

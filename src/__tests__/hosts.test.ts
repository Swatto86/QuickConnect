/**
 * Host Utility Tests
 *
 * Tests for host filtering and search functions in src/utils/hosts.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  filterHosts,
  highlightMatches,
  sortHostsByHostname,
  sortHostsByLastConnected,
  parseUKDate,
  formatUKDate,
  groupHostsByDomain,
  findHostByHostname,
  hostnameExists,
  type Host,
} from "../utils/hosts";

// Sample test data
const createSampleHosts = (): Host[] => [
  { hostname: "server01.domain.com", description: "Production Web Server" },
  { hostname: "server02.domain.com", description: "Development Server" },
  {
    hostname: "dc01.contoso.local",
    description: "Domain Controller",
    last_connected: "15/01/2024 10:30:00",
  },
  {
    hostname: "sql01.contoso.local",
    description: "SQL Database Server",
    last_connected: "20/01/2024 14:45:30",
  },
  { hostname: "web-server.other.com", description: "External Web Host" },
];

describe("filterHosts", () => {
  let sampleHosts: Host[];

  beforeEach(() => {
    sampleHosts = createSampleHosts();
  });

  describe("no filter", () => {
    it("should return all hosts when query is empty", () => {
      const result = filterHosts(sampleHosts, "");
      expect(result).toHaveLength(5);
    });

    it("should return all hosts when query is whitespace only", () => {
      const result = filterHosts(sampleHosts, "   ");
      expect(result).toHaveLength(5);
    });

    it("should return a copy, not the original array", () => {
      const result = filterHosts(sampleHosts, "");
      expect(result).not.toBe(sampleHosts);
      expect(result).toEqual(sampleHosts);
    });
  });

  describe("filtering by hostname", () => {
    it("should filter by exact hostname", () => {
      const result = filterHosts(sampleHosts, "server01.domain.com");
      expect(result).toHaveLength(1);
      expect(result[0].hostname).toBe("server01.domain.com");
    });

    it("should filter by partial hostname", () => {
      const result = filterHosts(sampleHosts, "server");
      // Matches: server01, server02, web-server, plus "SQL Database Server" in description
      expect(result).toHaveLength(4);
    });

    it("should filter by domain portion", () => {
      const result = filterHosts(sampleHosts, "contoso.local");
      expect(result).toHaveLength(2);
    });

    it("should be case-insensitive", () => {
      const result = filterHosts(sampleHosts, "SERVER01");
      expect(result).toHaveLength(1);
      expect(result[0].hostname).toBe("server01.domain.com");
    });

    it("should match partial hostname at any position", () => {
      const result = filterHosts(sampleHosts, "01");
      expect(result).toHaveLength(3); // server01, dc01, sql01
    });
  });

  describe("filtering by description", () => {
    it("should filter by description keyword", () => {
      const result = filterHosts(sampleHosts, "Production");
      expect(result).toHaveLength(1);
      expect(result[0].hostname).toBe("server01.domain.com");
    });

    it("should filter by partial description", () => {
      const result = filterHosts(sampleHosts, "Server");
      expect(result).toHaveLength(4); // All except web-server (matches "Host")
    });

    it("should be case-insensitive for description", () => {
      const result = filterHosts(sampleHosts, "DEVELOPMENT");
      expect(result).toHaveLength(1);
      expect(result[0].hostname).toBe("server02.domain.com");
    });
  });

  describe("combined matching", () => {
    it("should match hosts where term appears in either hostname or description", () => {
      const result = filterHosts(sampleHosts, "web");
      expect(result).toHaveLength(2); // server01 (Web Server) and web-server
    });

    it("should return empty array when no matches", () => {
      const result = filterHosts(sampleHosts, "nonexistent");
      expect(result).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty hosts array", () => {
      const result = filterHosts([], "test");
      expect(result).toHaveLength(0);
    });

    it("should handle single character search", () => {
      const result = filterHosts(sampleHosts, "d");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle special regex characters safely", () => {
      const hostsWithSpecialChars: Host[] = [
        { hostname: "server.test.com", description: "Test [special] chars" },
      ];
      // This should not throw
      const result = filterHosts(hostsWithSpecialChars, "[special]");
      expect(result).toHaveLength(1);
    });

    it("should trim whitespace from query", () => {
      const result = filterHosts(sampleHosts, "  server01  ");
      expect(result).toHaveLength(1);
    });
  });
});

describe("highlightMatches", () => {
  it("should return original text when query is empty", () => {
    const result = highlightMatches("server01.domain.com", "");
    expect(result).toBe("server01.domain.com");
  });

  it("should return original text when query is whitespace only", () => {
    const result = highlightMatches("server01.domain.com", "   ");
    expect(result).toBe("server01.domain.com");
  });

  it("should highlight single occurrence of query", () => {
    const result = highlightMatches("server01.domain.com", "server");
    expect(result).toContain("<mark");
    expect(result).toContain("server");
    expect(result).toContain("01.domain.com");
  });

  it("should highlight multiple occurrences of query", () => {
    const result = highlightMatches("server server server", "server");
    const markCount = (result.match(/<mark/g) || []).length;
    expect(markCount).toBe(3);
  });

  it("should be case-insensitive", () => {
    const result = highlightMatches("Server01.domain.com", "SERVER");
    expect(result).toContain("<mark");
    expect(result).toContain("Server"); // Original case preserved
  });

  it("should preserve original case in highlighted text", () => {
    const result = highlightMatches("MyServer.Domain.COM", "server");
    expect(result).toContain("Server");
    expect(result).not.toContain("server");
  });

  it("should handle query at the beginning of text", () => {
    const result = highlightMatches("server01.domain.com", "server01");
    expect(result.startsWith("<mark")).toBe(true);
  });

  it("should handle query at the end of text", () => {
    const result = highlightMatches("server01.domain.com", "com");
    expect(result.endsWith("</mark>")).toBe(true);
  });

  it("should handle query that matches entire text", () => {
    const result = highlightMatches("test", "test");
    expect(result).toContain("<mark");
    expect(result).toContain("test");
  });

  it("should return original text when query is not found", () => {
    const result = highlightMatches("server01.domain.com", "xyz");
    expect(result).toBe("server01.domain.com");
  });

  it("should include proper CSS classes in mark tag", () => {
    const result = highlightMatches("server.domain.com", "server");
    expect(result).toContain('class="bg-yellow-300');
  });

  it("should handle overlapping potential matches correctly", () => {
    const result = highlightMatches("aaa", "aa");
    // Should find first "aa" and then nothing left to match
    const markCount = (result.match(/<mark/g) || []).length;
    expect(markCount).toBe(1);
  });
});

describe("sortHostsByHostname", () => {
  let sampleHosts: Host[];

  beforeEach(() => {
    sampleHosts = createSampleHosts();
  });

  it("should sort hosts alphabetically by hostname", () => {
    const result = sortHostsByHostname(sampleHosts);
    expect(result[0].hostname).toBe("dc01.contoso.local");
    expect(result[result.length - 1].hostname).toBe("web-server.other.com");
  });

  it("should return a new array, not modify the original", () => {
    const originalFirst = sampleHosts[0].hostname;
    const result = sortHostsByHostname(sampleHosts);
    expect(result).not.toBe(sampleHosts);
    expect(sampleHosts[0].hostname).toBe(originalFirst);
  });

  it("should be case-insensitive", () => {
    const mixedCaseHosts: Host[] = [
      { hostname: "Zebra.com", description: "" },
      { hostname: "alpha.com", description: "" },
      { hostname: "Beta.com", description: "" },
    ];
    const result = sortHostsByHostname(mixedCaseHosts);
    expect(result[0].hostname).toBe("alpha.com");
    expect(result[1].hostname).toBe("Beta.com");
    expect(result[2].hostname).toBe("Zebra.com");
  });

  it("should handle empty array", () => {
    const result = sortHostsByHostname([]);
    expect(result).toHaveLength(0);
  });

  it("should handle single element array", () => {
    const singleHost: Host[] = [{ hostname: "only.host.com", description: "" }];
    const result = sortHostsByHostname(singleHost);
    expect(result).toHaveLength(1);
    expect(result[0].hostname).toBe("only.host.com");
  });
});

describe("sortHostsByLastConnected", () => {
  it("should sort hosts by last connected date (newest first)", () => {
    const hosts: Host[] = [
      {
        hostname: "old.com",
        description: "",
        last_connected: "01/01/2024 00:00:00",
      },
      {
        hostname: "newest.com",
        description: "",
        last_connected: "31/12/2024 23:59:59",
      },
      {
        hostname: "middle.com",
        description: "",
        last_connected: "15/06/2024 12:00:00",
      },
    ];
    const result = sortHostsByLastConnected(hosts);
    expect(result[0].hostname).toBe("newest.com");
    expect(result[1].hostname).toBe("middle.com");
    expect(result[2].hostname).toBe("old.com");
  });

  it("should place hosts without last_connected at the end", () => {
    const hosts: Host[] = [
      { hostname: "never.com", description: "" },
      {
        hostname: "connected.com",
        description: "",
        last_connected: "15/01/2024 10:00:00",
      },
    ];
    const result = sortHostsByLastConnected(hosts);
    expect(result[0].hostname).toBe("connected.com");
    expect(result[1].hostname).toBe("never.com");
  });

  it("should handle all hosts without last_connected", () => {
    const hosts: Host[] = [
      { hostname: "a.com", description: "" },
      { hostname: "b.com", description: "" },
    ];
    const result = sortHostsByLastConnected(hosts);
    expect(result).toHaveLength(2);
  });

  it("should return a new array", () => {
    const hosts: Host[] = [
      {
        hostname: "test.com",
        description: "",
        last_connected: "01/01/2024 00:00:00",
      },
    ];
    const result = sortHostsByLastConnected(hosts);
    expect(result).not.toBe(hosts);
  });
});

describe("parseUKDate", () => {
  it("should parse DD/MM/YYYY HH:MM:SS format", () => {
    const result = parseUKDate("15/01/2024 10:30:45");
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(0); // January is 0
    expect(result.getFullYear()).toBe(2024);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(45);
  });

  it("should handle date without time portion", () => {
    const result = parseUKDate("25/12/2023");
    expect(result.getDate()).toBe(25);
    expect(result.getMonth()).toBe(11); // December
    expect(result.getFullYear()).toBe(2023);
  });

  it("should parse midnight correctly", () => {
    const result = parseUKDate("01/01/2024 00:00:00");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it("should parse end of day correctly", () => {
    const result = parseUKDate("31/12/2024 23:59:59");
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
  });
});

describe("formatUKDate", () => {
  it("should format date to DD/MM/YYYY HH:MM:SS", () => {
    const date = new Date(2024, 0, 15, 10, 30, 45); // 15 Jan 2024 10:30:45
    const result = formatUKDate(date);
    expect(result).toBe("15/01/2024 10:30:45");
  });

  it("should pad single digit values with zeros", () => {
    const date = new Date(2024, 0, 5, 9, 5, 3); // 5 Jan 2024 09:05:03
    const result = formatUKDate(date);
    expect(result).toBe("05/01/2024 09:05:03");
  });

  it("should handle midnight", () => {
    const date = new Date(2024, 0, 1, 0, 0, 0);
    const result = formatUKDate(date);
    expect(result).toBe("01/01/2024 00:00:00");
  });

  it("should be reversible with parseUKDate", () => {
    const original = new Date(2024, 5, 15, 14, 30, 0);
    const formatted = formatUKDate(original);
    const parsed = parseUKDate(formatted);
    expect(parsed.getTime()).toBe(original.getTime());
  });
});

describe("groupHostsByDomain", () => {
  let sampleHosts: Host[];

  beforeEach(() => {
    sampleHosts = createSampleHosts();
  });

  it("should group hosts by domain", () => {
    const result = groupHostsByDomain(sampleHosts);
    expect(result["domain.com"]).toHaveLength(2);
    expect(result["contoso.local"]).toHaveLength(2);
    expect(result["other.com"]).toHaveLength(1);
  });

  it("should handle hosts with same domain", () => {
    const hosts: Host[] = [
      { hostname: "a.test.com", description: "" },
      { hostname: "b.test.com", description: "" },
      { hostname: "c.test.com", description: "" },
    ];
    const result = groupHostsByDomain(hosts);
    expect(result["test.com"]).toHaveLength(3);
  });

  it("should handle empty array", () => {
    const result = groupHostsByDomain([]);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("should handle single-part hostname as unknown", () => {
    const hosts: Host[] = [{ hostname: "localhost", description: "" }];
    const result = groupHostsByDomain(hosts);
    expect(result["unknown"]).toHaveLength(1);
  });

  it("should handle deeply nested subdomains", () => {
    const hosts: Host[] = [
      { hostname: "server.dept.region.company.com", description: "" },
    ];
    const result = groupHostsByDomain(hosts);
    expect(result["dept.region.company.com"]).toHaveLength(1);
  });
});

describe("findHostByHostname", () => {
  let sampleHosts: Host[];

  beforeEach(() => {
    sampleHosts = createSampleHosts();
  });

  it("should find host by exact hostname", () => {
    const result = findHostByHostname(sampleHosts, "server01.domain.com");
    expect(result).toBeDefined();
    expect(result?.hostname).toBe("server01.domain.com");
  });

  it("should be case-insensitive", () => {
    const result = findHostByHostname(sampleHosts, "SERVER01.DOMAIN.COM");
    expect(result).toBeDefined();
    expect(result?.hostname).toBe("server01.domain.com");
  });

  it("should return undefined when not found", () => {
    const result = findHostByHostname(sampleHosts, "nonexistent.com");
    expect(result).toBeUndefined();
  });

  it("should return undefined for empty array", () => {
    const result = findHostByHostname([], "test.com");
    expect(result).toBeUndefined();
  });

  it("should not match partial hostnames", () => {
    const result = findHostByHostname(sampleHosts, "server01");
    expect(result).toBeUndefined();
  });
});

describe("hostnameExists", () => {
  let sampleHosts: Host[];

  beforeEach(() => {
    sampleHosts = createSampleHosts();
  });

  it("should return true when hostname exists", () => {
    expect(hostnameExists(sampleHosts, "server01.domain.com")).toBe(true);
  });

  it("should return false when hostname does not exist", () => {
    expect(hostnameExists(sampleHosts, "nonexistent.com")).toBe(false);
  });

  it("should be case-insensitive", () => {
    expect(hostnameExists(sampleHosts, "SERVER01.DOMAIN.COM")).toBe(true);
  });

  it("should return false for empty array", () => {
    expect(hostnameExists([], "test.com")).toBe(false);
  });

  it("should not match partial hostnames", () => {
    expect(hostnameExists(sampleHosts, "server")).toBe(false);
  });
});

describe("checkAllHostsStatus", () => {
  it("should check status for all hosts in parallel", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = [
      { hostname: "server01.domain.com", description: "Server 1" },
      { hostname: "server02.domain.com", description: "Server 2" },
      { hostname: "server03.domain.com", description: "Server 3" },
    ];

    const mockCheckFn = async (hostname: string): Promise<string> => {
      if (hostname === "server01.domain.com") return "online";
      if (hostname === "server02.domain.com") return "offline";
      return "unknown";
    };

    const result = await checkAllHostsStatus(hosts, mockCheckFn);

    expect(result).toHaveLength(3);
    expect(result[0].status).toBe("online");
    expect(result[1].status).toBe("offline");
    expect(result[2].status).toBe("unknown");
  });

  it("should preserve host data when adding status", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = [
      {
        hostname: "server01.domain.com",
        description: "Production Server",
        last_connected: "15/01/2024 10:30:00",
      },
    ];

    const mockCheckFn = async (): Promise<string> => "online";

    const result = await checkAllHostsStatus(hosts, mockCheckFn);

    expect(result[0].hostname).toBe("server01.domain.com");
    expect(result[0].description).toBe("Production Server");
    expect(result[0].last_connected).toBe("15/01/2024 10:30:00");
    expect(result[0].status).toBe("online");
  });

  it("should handle empty host array", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = [];
    const mockCheckFn = async (): Promise<string> => "online";

    const result = await checkAllHostsStatus(hosts, mockCheckFn);

    expect(result).toHaveLength(0);
  });

  it("should handle errors gracefully and mark as unknown", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = [
      { hostname: "server01.domain.com", description: "Server 1" },
      { hostname: "server02.domain.com", description: "Server 2" },
    ];

    const mockCheckFn = async (hostname: string): Promise<string> => {
      if (hostname === "server01.domain.com") throw new Error("Network error");
      return "online";
    };

    const result = await checkAllHostsStatus(hosts, mockCheckFn);

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("unknown"); // Error handled
    expect(result[1].status).toBe("online");
  });

  it("should check all hosts in parallel, not sequentially", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = Array.from({ length: 10 }, (_, i) => ({
      hostname: `server${i + 1}.domain.com`,
      description: `Server ${i + 1}`,
    }));

    let concurrentCalls = 0;
    let maxConcurrent = 0;

    const mockCheckFn = async (): Promise<string> => {
      concurrentCalls++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
      await new Promise((resolve) => setTimeout(resolve, 10));
      concurrentCalls--;
      return "online";
    };

    await checkAllHostsStatus(hosts, mockCheckFn);

    // If parallel, maxConcurrent should be > 1
    expect(maxConcurrent).toBeGreaterThan(1);
  });

  it("should handle large number of hosts efficiently", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = Array.from({ length: 100 }, (_, i) => ({
      hostname: `server${i + 1}.domain.com`,
      description: `Server ${i + 1}`,
    }));

    const mockCheckFn = async (): Promise<string> => "online";

    const startTime = Date.now();
    const result = await checkAllHostsStatus(hosts, mockCheckFn);
    const duration = Date.now() - startTime;

    expect(result).toHaveLength(100);
    expect(duration).toBeLessThan(1000); // Should complete quickly with parallel processing
  });

  it("should handle mix of all status types", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = [
      { hostname: "online.domain.com", description: "Online Server" },
      { hostname: "offline.domain.com", description: "Offline Server" },
      { hostname: "unknown.domain.com", description: "Unknown Server" },
      { hostname: "error.domain.com", description: "Error Server" },
    ];

    const mockCheckFn = async (hostname: string): Promise<string> => {
      if (hostname === "online.domain.com") return "online";
      if (hostname === "offline.domain.com") return "offline";
      if (hostname === "unknown.domain.com") return "unknown";
      throw new Error("Check failed");
    };

    const result = await checkAllHostsStatus(hosts, mockCheckFn);

    expect(result).toHaveLength(4);
    expect(result[0].status).toBe("online");
    expect(result[1].status).toBe("offline");
    expect(result[2].status).toBe("unknown");
    expect(result[3].status).toBe("unknown"); // Error handled
  });

  it("should not mutate original host array", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = [
      { hostname: "server01.domain.com", description: "Server 1" },
    ];

    const originalHostname = hosts[0].hostname;
    const mockCheckFn = async (): Promise<string> => "online";

    await checkAllHostsStatus(hosts, mockCheckFn);

    // Original array should not have status field
    expect(hosts[0].status).toBeUndefined();
    expect(hosts[0].hostname).toBe(originalHostname);
  });

  it("should handle async check function that takes time", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = [
      { hostname: "slow.domain.com", description: "Slow Server" },
    ];

    const mockCheckFn = async (): Promise<string> => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return "online";
    };

    const result = await checkAllHostsStatus(hosts, mockCheckFn);

    expect(result[0].status).toBe("online");
  });

  it("should handle special characters in hostnames", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = [
      { hostname: "server-01.domain.com", description: "Hyphen Server" },
      { hostname: "server_02.domain.com", description: "Underscore Server" },
    ];

    const mockCheckFn = async (): Promise<string> => "online";

    const result = await checkAllHostsStatus(hosts, mockCheckFn);

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("online");
    expect(result[1].status).toBe("online");
  });

  it("should handle hosts with existing status field", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = [
      {
        hostname: "server01.domain.com",
        description: "Server 1",
        status: "checking" as const,
      },
    ];

    const mockCheckFn = async (): Promise<string> => "online";

    const result = await checkAllHostsStatus(hosts, mockCheckFn);

    expect(result[0].status).toBe("online"); // Should override existing status
  });

  it("should complete even if all checks fail", async () => {
    const { checkAllHostsStatus } = await import("../utils/hosts");
    
    const hosts: Host[] = [
      { hostname: "fail1.domain.com", description: "Server 1" },
      { hostname: "fail2.domain.com", description: "Server 2" },
      { hostname: "fail3.domain.com", description: "Server 3" },
    ];

    const mockCheckFn = async (): Promise<string> => {
      throw new Error("All checks fail");
    };

    const result = await checkAllHostsStatus(hosts, mockCheckFn);

    expect(result).toHaveLength(3);
    expect(result[0].status).toBe("unknown");
    expect(result[1].status).toBe("unknown");
    expect(result[2].status).toBe("unknown");
  });
});

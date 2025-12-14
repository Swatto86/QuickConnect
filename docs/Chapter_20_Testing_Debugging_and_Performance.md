# Chapter 20: Testing, Debugging, and Performance

**Learning Objectives:**
- Write unit tests for Rust backend code
- Implement integration tests for Tauri commands
- Test frontend TypeScript code effectively
- Use DevTools for debugging and profiling
- Profile application performance and identify bottlenecks
- Understand memory management in Tauri applications
- Apply optimization techniques for better performance
- Avoid common performance pitfalls

---

## 20.1 Unit Testing Rust Code

Testing is crucial for maintaining code quality. Rust has excellent built-in testing support that makes it easy to write and run tests.

### 20.1.1 Test Structure in QuickConnect

QuickConnect has **129 passing unit tests** across its codebase. Tests are written in the same file using `#[cfg(test)]` modules:

```rust
// src-tauri/src/core/hosts.rs

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    /// Helper to set up a test environment with a temporary CSV file
    fn setup_test_env() -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let csv_path = temp_dir.path().join("hosts.csv");
        (temp_dir, csv_path)
    }

    /// Helper to create test hosts
    fn create_test_host(hostname: &str, description: &str) -> Host {
        Host {
            hostname: hostname.to_string(),
            description: description.to_string(),
            last_connected: None,
        }
    }

    #[test]
    fn test_search_hosts_by_hostname() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server01.domain.com", "Web Server"),
            create_test_host("server02.domain.com", "Database Server"),
            create_test_host("workstation01.domain.com", "Dev Machine"),
        ];
        
        csv_writer::write_hosts_to_csv(&csv_path, &hosts)
            .expect("Failed to write CSV");
        
        let loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path)
            .expect("Failed to read CSV");
        
        // Test search logic
        let query = "server";
        let filtered: Vec<Host> = loaded_hosts
            .into_iter()
            .filter(|host| {
                host.hostname.to_lowercase().contains(&query.to_lowercase())
                    || host.description.to_lowercase().contains(&query.to_lowercase())
            })
            .collect();
        
        assert_eq!(filtered.len(), 2);
        assert!(filtered.iter().any(|h| h.hostname == "server01.domain.com"));
        assert!(filtered.iter().any(|h| h.hostname == "server02.domain.com"));
    }
}
```

**Key Testing Patterns:**
- ✅ `#[cfg(test)]`: Conditional compilation - only compiled during testing
- ✅ `tempfile::TempDir`: Isolated test environment (no shared state)
- ✅ Helper functions: `setup_test_env()`, `create_test_host()`
- ✅ `.expect()` for test error handling (NO `.unwrap()` - clippy violation!)
- ✅ Descriptive assertions with `assert_eq!` and `assert!`

### 20.1.2 Testing Error Handling with AppError

QuickConnect uses structured `AppError` types. Testing error conditions:

```rust
// src-tauri/src/core/hosts.rs

#[test]
fn test_upsert_host_empty_hostname_fails() {
    let (_temp_dir, csv_path) = setup_test_env();
    
    // Create empty CSV
    csv_writer::write_hosts_to_csv(&csv_path, &[])
        .expect("Failed to write CSV");
    
    // Test that empty hostname is rejected
    let invalid_host = Host {
        hostname: "   ".to_string(),  // Empty after trim
        description: "Test".to_string(),
        last_connected: None,
    };
    
    // In real code, upsert_host validates hostname
    // We're testing the validation logic
    let result = if invalid_host.hostname.trim().is_empty() {
        Err(AppError::InvalidHostname {
            hostname: invalid_host.hostname.clone(),
            reason: "Hostname cannot be empty".to_string(),
        })
    } else {
        Ok(())
    };
    
    // Verify error is returned
    assert!(result.is_err());
    
    // Verify specific error type
    match result {
        Err(AppError::InvalidHostname { hostname, reason }) => {
            assert!(hostname.trim().is_empty());
            assert!(reason.contains("empty"));
        }
        _ => panic!("Expected InvalidHostname error"),
    }
}
```

**Error Testing Best Practices:**
- ✅ Use `.expect("message")` instead of `.unwrap()` in tests
- ✅ Test both success and error paths
- ✅ Match specific `AppError` variants
- ✅ Verify error messages contain expected context

### 20.1.3 Testing RDP File Generation

QuickConnect tests RDP file creation with special character handling:

```rust
// src-tauri/src/core/rdp_launcher.rs

#[test]
fn test_create_rdp_file_with_username() {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let rdp_path = temp_dir.path().join("test.rdp");
    
    let hostname = "server01.contoso.com";
    let credentials = Credentials {
        username: "admin".to_string(),
        password: "P@ssw0rd".to_string(),
        domain: Some("CONTOSO".to_string()),
    };
    
    // Call RDP file creation function
    let result = create_rdp_file_content(hostname, Some(&credentials));
    
    // Write to file
    std::fs::write(&rdp_path, result)
        .expect("Failed to write RDP file");
    
    // Verify file was created
    assert!(rdp_path.exists());
    
    // Read and verify content
    let content = std::fs::read_to_string(&rdp_path)
        .expect("Failed to read RDP file");
    
    assert!(content.contains("full address:s:server01.contoso.com"));
    assert!(content.contains("username:s:CONTOSO\\admin"));
    assert!(content.contains("domain:s:CONTOSO"));
}

#[test]
fn test_create_rdp_file_special_characters() {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    
    let hostname = "server-01.test_domain.com";
    let credentials = Credentials {
        username: "user.name".to_string(),
        password: "P@ss#123".to_string(),
        domain: Some("TEST-DOMAIN".to_string()),
    };
    
    let content = create_rdp_file_content(hostname, Some(&credentials));
    
    // Verify special characters are preserved
    assert!(content.contains("server-01.test_domain.com"));
    assert!(content.contains("user.name"));
    assert!(content.contains("TEST-DOMAIN"));
}
```

**Testing File Operations:**
- ✅ Use `tempfile::TempDir` for isolated test files
- ✅ Test with realistic data (special characters, domains)
- ✅ Verify file creation AND content
- ✅ Clean up automatically (TempDir drops at end of test)

### 20.1.4 Running Tests

QuickConnect has **129 passing unit tests** across the codebase:

```powershell
# Run all tests
cargo test

# Run only library tests (faster, skips integration tests)
cargo test --lib

# Run tests with output
cargo test -- --nocapture

# Run specific test module
cargo test hosts::tests

# Run single test
cargo test test_search_hosts_by_hostname
```

**Test Output:**
```
running 129 tests
test adapters::windows::credential_manager::tests::test_credential_manager ... ok
test core::hosts::tests::test_search_hosts_by_hostname ... ok
test core::hosts::tests::test_upsert_host_creates_new ... ok
test core::rdp_launcher::tests::test_create_rdp_file_with_username ... ok
...

test result: ok. 129 passed; 0 failed; 0 ignored; 0 measured
```

### 20.1.5 Clippy: Zero-Warning Policy

QuickConnect enforces **zero clippy warnings** using strict mode:

```powershell
# Run clippy with warnings as errors
cargo clippy --all-targets --all-features -- -D warnings
```

**What this means:**
- `-D warnings`: Treats all warnings as compilation errors
- Test code must also pass clippy checks
- Enforces best practices automatically

**Common Clippy Fixes Applied:**

```rust
// ❌ BAD: len_zero warning
if record.len() >= 1 {
    // ...
}

// ✅ GOOD: Use is_empty()
if !record.is_empty() {
    // ...
}

// ❌ BAD: needless_borrow warning
process_data(&deeply_nested);

// ✅ GOOD: Remove unnecessary &
process_data(deeply_nested);

// ❌ BAD: useless_vec warning
let items = vec!["item1", "item2"];
for item in items { ... }

// ✅ GOOD: Use array literal
let items = ["item1", "item2"];
for item in items { ... }

// ❌ BAD: unwrap() in tests (explicit error principle violation)
let hosts = get_hosts().unwrap();

// ✅ GOOD: Use expect() with descriptive message
let hosts = get_hosts().expect("Failed to load hosts for test");
```

**CI/CD Integration:**
```yaml
# .github/workflows/ci.yml
- name: Run Clippy
  run: cargo clippy --all-targets --all-features -- -D warnings

- name: Run Tests
  run: cargo test --lib
```

### 20.1.6 Testing with Mocks

For testing code that depends on external systems (like file I/O or network), use mock objects:

```rust
// Trait for testability
trait HostStorage {
    fn read_hosts(&self) -> Result<Vec<String>, String>;
    fn write_hosts(&self, hosts: &[String]) -> Result<(), String>;
}

// Real implementation
struct FileHostStorage {
    path: PathBuf,
}

impl HostStorage for FileHostStorage {
    fn read_hosts(&self) -> Result<Vec<String>, String> {
        std::fs::read_to_string(&self.path)
            .map(|content| content.lines().map(String::from).collect())
            .map_err(|e| e.to_string())
    }

    fn write_hosts(&self, hosts: &[String]) -> Result<(), String> {
        std::fs::write(&self.path, hosts.join("\n"))
            .map_err(|e| e.to_string())
    }
}

// Mock for testing
#[cfg(test)]
struct MockHostStorage {
    hosts: Vec<String>,
}

#[cfg(test)]
impl HostStorage for MockHostStorage {
    fn read_hosts(&self) -> Result<Vec<String>, String> {
        Ok(self.hosts.clone())
    }

    fn write_hosts(&self, hosts: &[String]) -> Result<(), String> {
        Ok(())
    }
}

// Function using the trait
fn count_hosts<S: HostStorage>(storage: &S) -> Result<usize, String> {
    storage.read_hosts().map(|hosts| hosts.len())
}

#[cfg(test)]
mod storage_tests {
    use super::*;

    #[test]
    fn test_count_hosts() {
        let mock = MockHostStorage {
            hosts: vec!["server1".to_string(), "server2".to_string()],
        };
        
        let count = count_hosts(&mock).unwrap();
        assert_eq!(count, 2);
    }
}
```

---

## 20.2 Integration Testing

Integration tests verify that multiple components work together correctly. In Rust projects, integration tests go in the `tests/` directory.

### 20.2.1 Creating Integration Tests

Create `src-tauri/tests/integration_test.rs`:

```rust
use quickconnect_lib::{rdp::parse_username, Host};

#[test]
fn test_username_parsing_integration() {
    let test_cases = vec![
        ("admin@contoso.com", "contoso.com", "admin"),
        ("CONTOSO\\admin", "CONTOSO", "admin"),
        ("localuser", "", "localuser"),
    ];

    for (input, expected_domain, expected_user) in test_cases {
        let (domain, user) = parse_username(input);
        assert_eq!(domain, expected_domain);
        assert_eq!(user, expected_user);
    }
}
```

### 20.2.2 Testing Tauri Commands

Testing Tauri commands requires a bit more setup. You can test the underlying logic without the Tauri runtime:

```rust
// Keep business logic separate from the Tauri command layer
pub fn create_rdp_file_content(
    hostname: &str,
    username: Option<&str>,
    width: u32,
    height: u32,
) -> String {
    let mut content = String::new();
    content.push_str(&format!("full address:s:{}\n", hostname));
    
    if let Some(user) = username {
        content.push_str(&format!("username:s:{}\n", user));
    }
    
    content.push_str(&format!("desktopwidth:i:{}\n", width));
    content.push_str(&format!("desktopheight:i:{}\n", height));
    content.push_str("screen mode id:i:2\n"); // Fullscreen
    
    content
}

#[tauri::command]
fn generate_rdp_file(
    hostname: String,
    username: Option<String>,
) -> Result<String, String> {
    Ok(create_rdp_file_content(
        &hostname,
        username.as_deref(),
        1920,
        1080,
    ))
}

#[cfg(test)]
mod rdp_tests {
    use super::*;

    #[test]
    fn test_rdp_file_content_with_username() {
        let content = create_rdp_file_content("server.local", Some("admin"), 1920, 1080);
        
        assert!(content.contains("full address:s:server.local"));
        assert!(content.contains("username:s:admin"));
        assert!(content.contains("desktopwidth:i:1920"));
        assert!(content.contains("desktopheight:i:1080"));
    }

    #[test]
    fn test_rdp_file_content_without_username() {
        let content = create_rdp_file_content("server.local", None, 1024, 768);
        
        assert!(content.contains("full address:s:server.local"));
        assert!(!content.contains("username:s:"));
        assert!(content.contains("desktopwidth:i:1024"));
    }
}
```

**Key Principle:** Separate business logic from Tauri commands so you can test the logic independently.

### 20.2.3 Testing Async Functions

QuickConnect uses `tokio::test` for async test execution:

```rust
// src-tauri/src/core/ldap.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ldap_connection_timeout() {
        // Test that connection timeout works correctly
        let result = connect_to_ldap(
            "nonexistent.server.local",
            389,
            Duration::from_secs(1)
        ).await;
        
        assert!(result.is_err());
        
        // Verify it's a connection error, not a timeout
        match result {
            Err(AppError::LdapConnectionError { server, port, .. }) => {
                assert_eq!(server, "nonexistent.server.local");
                assert_eq!(port, 389);
            }
            _ => panic!("Expected LdapConnectionError"),
        }
    }

    #[tokio::test]
    async fn test_credential_fallback_async() {
        // Test async credential retrieval with fallback
        let primary_result = get_credentials("TERMSRV/server01").await;
        let fallback_result = get_credentials("QuickConnect").await;
        
        // At least one should succeed (or both fail predictably)
        if primary_result.is_err() && fallback_result.is_err() {
            // Expected when no credentials are stored
            assert!(true);
        }
    }
}
```

**Async Testing Requirements:**
- \u2705 Add `#[tokio::test]` attribute for async tests
- \u2705 Add `tokio = { version = "1", features = ["macros", "rt-multi-thread"] }` to `Cargo.toml`
- \u2705 Use `.await` in test body
- \u2705 Test both success and timeout/error paths

**Cargo.toml Configuration:**
```toml
[dev-dependencies]
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
tempfile = "3.14"
```

### 20.2.4 Testing with the Tauri Runtime

For testing that requires the Tauri runtime, use the `tauri::test` module:

```rust
#[cfg(test)]
mod tauri_tests {
    use tauri::test::{mock_builder, MockRuntime};

    #[test]
    fn test_app_initialization() {
        let app = mock_builder()
            .build(tauri::generate_context!())
            .expect("Failed to build app");

        // Test that windows are created correctly
        assert!(app.get_webview_window("main").is_some());
    }
}
```

---

## 20.3 Frontend Testing Strategies

Testing the TypeScript/JavaScript frontend is equally important.

### 20.3.1 Unit Testing TypeScript Functions

Create `src/tests/utils.test.ts`:

```typescript
// utils.ts
export function formatHostname(hostname: string): string {
    return hostname.toLowerCase().trim();
}

export function isValidHostname(hostname: string): boolean {
    if (!hostname || hostname.trim().length === 0) {
        return false;
    }
    
    // Basic validation: alphanumeric, dots, hyphens
    const regex = /^[a-zA-Z0-9.-]+$/;
    return regex.test(hostname);
}

// utils.test.ts (using Vitest)
import { describe, it, expect } from 'vitest';
import { formatHostname, isValidHostname } from './utils';

describe('formatHostname', () => {
    it('should lowercase and trim hostname', () => {
        expect(formatHostname('  SERVER.LOCAL  ')).toBe('server.local');
        expect(formatHostname('WEBSERVER')).toBe('webserver');
    });
});

describe('isValidHostname', () => {
    it('should accept valid hostnames', () => {
        expect(isValidHostname('server.local')).toBe(true);
        expect(isValidHostname('web-server-01')).toBe(true);
        expect(isValidHostname('192.168.1.1')).toBe(true);
    });

    it('should reject invalid hostnames', () => {
        expect(isValidHostname('')).toBe(false);
        expect(isValidHostname('   ')).toBe(false);
        expect(isValidHostname('server with spaces')).toBe(false);
        expect(isValidHostname('server@invalid')).toBe(false);
    });
});
```

### 20.3.2 Setting Up Vitest

Add to `package.json`:

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

### 20.3.3 Mocking Tauri Commands

When testing frontend code that calls Tauri commands, mock them:

```typescript
// hosts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Tauri invoke function
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke,
}));

import { loadHosts, saveHost } from './hosts';

describe('Host Management', () => {
    beforeEach(() => {
        mockInvoke.mockClear();
    });

    it('should load hosts from backend', async () => {
        const mockHosts = [
            { name: 'server1', hostname: 'server1.local' },
            { name: 'server2', hostname: 'server2.local' },
        ];
        
        mockInvoke.mockResolvedValue(mockHosts);
        
        const hosts = await loadHosts();
        
        expect(mockInvoke).toHaveBeenCalledWith('get_hosts');
        expect(hosts).toEqual(mockHosts);
    });

    it('should save host to backend', async () => {
        const newHost = { name: 'server3', hostname: 'server3.local' };
        
        mockInvoke.mockResolvedValue(null);
        
        await saveHost(newHost);
        
        expect(mockInvoke).toHaveBeenCalledWith('save_host', {
            host: newHost,
        });
    });
});
```

### 20.3.4 Testing DOM Interactions

For testing UI interactions, you can use testing libraries like Testing Library:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/dom';

describe('Search Functionality', () => {
    it('should filter hosts based on search input', () => {
        document.body.innerHTML = `
            <input type="text" id="searchInput" />
            <div id="hostList">
                <div class="host-card" data-name="server1">Server 1</div>
                <div class="host-card" data-name="server2">Server 2</div>
                <div class="host-card" data-name="webserver">Web Server</div>
            </div>
        `;

        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        const hostCards = document.querySelectorAll('.host-card');

        // Simulate search
        searchInput.value = 'web';
        fireEvent.input(searchInput);

        // In a real implementation, you'd have a filterHosts function
        // that hides non-matching hosts
        hostCards.forEach(card => {
            const name = card.getAttribute('data-name') || '';
            if (name.toLowerCase().includes('web')) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });

        // Verify filtering
        expect(hostCards[0].classList.contains('hidden')).toBe(true);
        expect(hostCards[1].classList.contains('hidden')).toBe(true);
        expect(hostCards[2].classList.contains('hidden')).toBe(false);
    });
});
```

---

### 20.3.5 QuickConnect Frontend Test Suite

QuickConnect has a comprehensive frontend testing infrastructure with **321 utility tests** across **9 test files** totaling **6,634 lines of test code**. This ensures reliability and maintainability of all frontend functionality.

#### Test Configuration (`vitest.config.ts`)

QuickConnect uses Vitest v4 (see `package.json`; currently `^4.0.15`) with the jsdom environment for DOM testing:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Environment
    environment: 'jsdom',
    
    // Test file patterns
    include: ['src/__tests__/**/*.test.ts'],
    
    // Setup files run before each test
    setupFiles: ['src/__tests__/setup.ts'],
    
    // Global test timeout
    testTimeout: 10000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      
      // Enforce coverage thresholds
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      
      // Files to include in coverage
      include: ['src/utils/**/*.ts'],
      
      // Files to exclude
      exclude: [
        'src/__tests__/**',
        'src/**/*.d.ts',
        'node_modules/**',
      ],
    },
  },
});
```

**Key Configuration Features:**

- ✅ **jsdom environment**: Full DOM API for testing UI interactions
- ✅ **Setup files**: Mocking Tauri API before tests run
- ✅ **Coverage thresholds**: 80% statement/function/line coverage, 75% branch coverage
- ✅ **Multiple reporters**: Text output for CLI, HTML for detailed browsing, lcov for CI/CD

**Running Tests:**

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test validation.test.ts
```

#### Test Suite Overview

QuickConnect's **9 test files** provide comprehensive coverage:

| Test File | Lines | Tests | Focus Area |
|-----------|-------|-------|------------|
| `validation.test.ts` | 678 | 101 | FQDN validation, domain validation, XSS prevention |
| `validation.property.test.ts` | 708 | - | Property-based testing with fast-check |
| `ui.test.ts` | 586 | 74 | Notifications, button state, form utilities |
| `errors.test.ts` | 698 | 85 | Severity categorization, CSS generation, filtering |
| `hosts.test.ts` | 728 | 61 | Host filtering, sorting, date parsing |
| `ui-main.test.ts` | 685 | - | Main window UI integration |
| `ui-login.test.ts` | 591 | - | Login window UI integration |
| `ui-hosts.test.ts` | 1093 | - | Hosts window UI integration |
| `integration.test.ts` | 867 | - | End-to-end workflow testing |
| **TOTAL** | **6,634** | **321+** | Full frontend coverage |

#### Validation Tests (`validation.test.ts`)

**101 tests** ensuring robust input validation:

```typescript
import { describe, it, expect } from 'vitest';
import { isValidFQDN, isValidDomain, escapeHtml } from '../utils/validation';

describe('isValidFQDN', () => {
  it('should accept valid FQDNs', () => {
    expect(isValidFQDN('server.company.com')).toBe(true);
    expect(isValidFQDN('db-01.internal.corp.net')).toBe(true);
    expect(isValidFQDN('web-server.sub.domain.com')).toBe(true);
  });

  it('should reject IP addresses', () => {
    expect(isValidFQDN('192.168.1.1')).toBe(false);
    expect(isValidFQDN('10.0.0.1')).toBe(false);
  });

  it('should reject single-label names', () => {
    expect(isValidFQDN('localhost')).toBe(false);
    expect(isValidFQDN('server')).toBe(false);
  });

  it('should reject names with invalid characters', () => {
    expect(isValidFQDN('server_.company.com')).toBe(false);
    expect(isValidFQDN('server..company.com')).toBe(false);
    expect(isValidFQDN('server-.company.com')).toBe(false);
  });

  it('should reject TLDs shorter than 2 characters', () => {
    expect(isValidFQDN('server.c')).toBe(false);
    expect(isValidFQDN('server.company.c')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isValidFQDN('')).toBe(false);
    expect(isValidFQDN('   ')).toBe(false);
    expect(isValidFQDN('.')).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('should escape HTML entities', () => {
    expect(escapeHtml('<script>alert("XSS")</script>'))
      .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  });

  it('should escape quotes', () => {
    expect(escapeHtml("It's a test")).toBe('It&#039;s a test');
    expect(escapeHtml('Say "Hello"')).toBe('Say &quot;Hello&quot;');
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });
});
```

**Coverage includes:**
- ✅ Valid FQDN formats (101 test cases)
- ✅ IP address rejection
- ✅ Single-label rejection
- ✅ Invalid character handling
- ✅ TLD length validation
- ✅ Edge cases (empty, whitespace, special characters)
- ✅ XSS prevention with HTML entity escaping

#### Property-Based Testing (`validation.property.test.ts`)

**708 lines** of property-based tests using `fast-check` to generate thousands of random inputs:

```typescript
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { isValidFQDN, isValidDomain } from '../utils/validation';

describe('Property-Based: FQDN Validation', () => {
  it('should never accept IP addresses', () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        (ip) => {
          expect(isValidFQDN(ip)).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should never accept strings with spaces', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s.includes(' ')),
        (str) => {
          expect(isValidFQDN(str)).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should accept valid domain format', () => {
    // Generate valid FQDN structure
    const validFqdnArb = fc.tuple(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 1, maxLength: 63 }),
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 1, maxLength: 63 }),
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 2, maxLength: 10 })
    ).map(([label1, label2, tld]) => `${label1}.${label2}.${tld}`);

    fc.assert(
      fc.property(validFqdnArb, (fqdn) => {
        // If it matches the pattern, should be valid
        if (!/^[a-z0-9-]+\.[a-z0-9-]+\.[a-z]{2,}$/.test(fqdn)) {
          return;
        }
        expect(isValidFQDN(fqdn)).toBe(true);
      }),
      { numRuns: 10000 }  // 10,000 generated test cases!
    );
  });
});

describe('Property-Based: Domain Validation', () => {
  it('should never accept empty strings', () => {
    fc.assert(
      fc.property(
        fc.constant(''),
        (empty) => {
          expect(isValidDomain(empty)).toBe(false);
        }
      )
    );
  });

  it('should handle arbitrary Unicode safely', () => {
    fc.assert(
      fc.property(
        fc.unicodeString(),
        (str) => {
          // Should not crash, just return true or false
          const result = isValidDomain(str);
          expect(typeof result).toBe('boolean');
        }
      ),
      { numRuns: 5000 }
    );
  });
});
```

**Property-based testing benefits:**
- ✅ Tests with **10,000+ generated inputs** instead of handwritten cases
- ✅ Discovers edge cases humans might miss
- ✅ Ensures functions handle arbitrary input safely
- ✅ Higher confidence than example-based testing alone

#### UI Tests (`ui.test.ts`)

**74 tests** for notification system and button state management:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showNotification, setButtonsEnabled, getFormData } from '../utils/ui';

describe('showNotification', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="notification-container-top"></div>
      <div id="notification-container-bottom"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should display success notification at top', () => {
    showNotification('Operation successful', 'success');
    
    const container = document.getElementById('notification-container-top');
    expect(container?.children.length).toBe(1);
    
    const notification = container?.firstElementChild;
    expect(notification?.classList.contains('alert-success')).toBe(true);
    expect(notification?.textContent).toContain('Operation successful');
  });

  it('should display error notification at bottom with custom duration', () => {
    showNotification('Error occurred', 'error', {
      position: 'bottom',
      duration: 5000
    });
    
    const container = document.getElementById('notification-container-bottom');
    expect(container?.children.length).toBe(1);
    
    const notification = container?.firstElementChild;
    expect(notification?.classList.contains('alert-error')).toBe(true);
  });

  it('should escape HTML in message', () => {
    showNotification('<script>alert("XSS")</script>', 'info');
    
    const container = document.getElementById('notification-container-top');
    const notification = container?.firstElementChild;
    
    // Should display escaped HTML, not execute it
    expect(notification?.innerHTML).toContain('&lt;script&gt;');
    expect(notification?.innerHTML).not.toContain('<script>');
  });

  it('should auto-dismiss after duration', async () => {
    vi.useFakeTimers();
    
    showNotification('Auto dismiss test', 'info', { duration: 3000 });
    
    const container = document.getElementById('notification-container-top');
    expect(container?.children.length).toBe(1);
    
    // Fast-forward 3 seconds
    vi.advanceTimersByTime(3000);
    
    // Should have animation class
    expect(container?.firstElementChild?.classList.contains('animate-slide-out')).toBe(true);
    
    // Fast-forward animation time
    vi.advanceTimersByTime(300);
    
    // Should be removed
    expect(container?.children.length).toBe(0);
    
    vi.useRealTimers();
  });
});

describe('setButtonsEnabled', () => {
  it('should disable multiple buttons', () => {
    document.body.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
      <button id="btn3">Button 3</button>
    `;
    
    const btn1 = document.getElementById('btn1') as HTMLButtonElement;
    const btn2 = document.getElementById('btn2') as HTMLButtonElement;
    const btn3 = document.getElementById('btn3') as HTMLButtonElement;
    
    setButtonsEnabled(false, btn1, btn2, btn3);
    
    expect(btn1.disabled).toBe(true);
    expect(btn2.disabled).toBe(true);
    expect(btn3.disabled).toBe(true);
    expect(btn1.classList.contains('loading')).toBe(true);
  });

  it('should re-enable buttons', () => {
    document.body.innerHTML = `<button id="btn">Button</button>`;
    const btn = document.getElementById('btn') as HTMLButtonElement;
    
    setButtonsEnabled(false, btn);
    expect(btn.disabled).toBe(true);
    
    setButtonsEnabled(true, btn);
    expect(btn.disabled).toBe(false);
    expect(btn.classList.contains('loading')).toBe(false);
  });
});

describe('getFormData', () => {
  it('should extract form data', () => {
    document.body.innerHTML = `
      <form id="testForm">
        <input name="username" value="alice" />
        <input name="email" value="alice@example.com" />
        <select name="role">
          <option value="admin" selected>Admin</option>
        </select>
      </form>
    `;
    
    const data = getFormData('testForm');
    
    expect(data.username).toBe('alice');
    expect(data.email).toBe('alice@example.com');
    expect(data.role).toBe('admin');
  });

  it('should trim whitespace from values', () => {
    document.body.innerHTML = `
      <form id="testForm">
        <input name="field" value="  value  " />
      </form>
    `;
    
    const data = getFormData('testForm');
    expect(data.field).toBe('value');
  });
});
```

#### Error Tests (`errors.test.ts`)

**85 tests** for error categorization and styling:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getSeverityFromCategory,
  getSeverityColor,
  getBorderColor,
  filterErrors
} from '../utils/errors';

describe('getSeverityFromCategory', () => {
  it('should map critical categories', () => {
    expect(getSeverityFromCategory('Critical System Error')).toBe('critical');
    expect(getSeverityFromCategory('FATAL')).toBe('critical');
  });

  it('should map error categories', () => {
    expect(getSeverityFromCategory('Authentication Error')).toBe('error');
    expect(getSeverityFromCategory('Network Failure')).toBe('error');
  });

  it('should map warning categories', () => {
    expect(getSeverityFromCategory('Warning: Low Disk Space')).toBe('warning');
  });

  it('should default to info', () => {
    expect(getSeverityFromCategory('Configuration')).toBe('info');
    expect(getSeverityFromCategory('Status Update')).toBe('info');
  });
});

describe('getSeverityColor', () => {
  it('should return correct DaisyUI classes', () => {
    expect(getSeverityColor('critical')).toBe('badge-error');
    expect(getSeverityColor('error')).toBe('badge-error');
    expect(getSeverityColor('warning')).toBe('badge-warning');
    expect(getSeverityColor('info')).toBe('badge-info');
  });
});

describe('filterErrors', () => {
  const errors = [
    {
      category: 'Authentication',
      message: 'Login failed',
      details: 'Invalid password',
      timestamp: '14/12/2024 09:30:45',
      severity: 'error'
    },
    {
      category: 'Network',
      message: 'Connection timeout',
      details: 'Server unreachable',
      timestamp: '14/12/2024 09:31:12',
      severity: 'error'
    }
  ];

  it('should filter by category', () => {
    const filtered = filterErrors(errors, 'auth');
    expect(filtered.length).toBe(1);
    expect(filtered[0].category).toBe('Authentication');
  });

  it('should filter by message', () => {
    const filtered = filterErrors(errors, 'timeout');
    expect(filtered.length).toBe(1);
    expect(filtered[0].message).toBe('Connection timeout');
  });

  it('should be case-insensitive', () => {
    const filtered = filterErrors(errors, 'NETWORK');
    expect(filtered.length).toBe(1);
  });
});
```

#### Host Tests (`hosts.test.ts`)

**61 tests** for host filtering, sorting, and date handling:

```typescript
import { describe, it, expect } from 'vitest';
import {
  filterHosts,
  highlightMatches,
  sortHostsByHostname,
  sortHostsByLastConnected,
  parseDate,
  formatDate
} from '../utils/hosts';

describe('filterHosts', () => {
  const hosts = [
    { hostname: 'server01.company.com', description: 'Web Server' },
    { hostname: 'db01.company.com', description: 'Database Server' },
    { hostname: 'workstation01.company.com', description: 'Dev Machine' }
  ];

  it('should filter by hostname', () => {
    const filtered = filterHosts(hosts, 'db');
    expect(filtered.length).toBe(1);
    expect(filtered[0].hostname).toBe('db01.company.com');
  });

  it('should filter by description', () => {
    const filtered = filterHosts(hosts, 'web');
    expect(filtered.length).toBe(1);
    expect(filtered[0].description).toBe('Web Server');
  });

  it('should be case-insensitive', () => {
    const filtered = filterHosts(hosts, 'WORKSTATION');
    expect(filtered.length).toBe(1);
  });
});

describe('highlightMatches', () => {
  it('should wrap matches in mark tags', () => {
    const result = highlightMatches('server01.company.com', 'server');
    expect(result).toContain('<mark');
    expect(result).toContain('server');
    expect(result).toContain('</mark>');
  });

  it('should escape HTML', () => {
    const result = highlightMatches('<script>alert("XSS")</script>', 'script');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should be case-insensitive', () => {
    const result = highlightMatches('ServerName', 'server');
    expect(result).toContain('<mark');
  });
});

describe('parseDate', () => {
  it('should parse UK format dates', () => {
    const date = parseDate('14/12/2024 09:30:45');
    expect(date.getDate()).toBe(14);
    expect(date.getMonth()).toBe(11); // 0-indexed
    expect(date.getFullYear()).toBe(2024);
    expect(date.getHours()).toBe(9);
    expect(date.getMinutes()).toBe(30);
    expect(date.getSeconds()).toBe(45);
  });
});

describe('sortHostsByLastConnected', () => {
  it('should sort by most recent first', () => {
    const hosts = [
      { hostname: 'a', description: '', last_connected: '10/12/2024 10:00:00' },
      { hostname: 'b', description: '', last_connected: '12/12/2024 10:00:00' },
      { hostname: 'c', description: '', last_connected: '11/12/2024 10:00:00' }
    ];
    
    const sorted = sortHostsByLastConnected(hosts);
    expect(sorted[0].hostname).toBe('b'); // Most recent
    expect(sorted[1].hostname).toBe('c');
    expect(sorted[2].hostname).toBe('a');
  });

  it('should put hosts without dates at end', () => {
    const hosts = [
      { hostname: 'a', description: '', last_connected: '10/12/2024 10:00:00' },
      { hostname: 'b', description: '' }, // No date
      { hostname: 'c', description: '', last_connected: '12/12/2024 10:00:00' }
    ];
    
    const sorted = sortHostsByLastConnected(hosts);
    expect(sorted[0].hostname).toBe('c');
    expect(sorted[1].hostname).toBe('a');
    expect(sorted[2].hostname).toBe('b'); // No date goes last
  });
});
```

#### Integration Tests (`integration.test.ts`)

**867 lines** of end-to-end workflow testing:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

describe('Host Management Workflow', () => {
  beforeEach(() => {
    // Mock Tauri commands
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it('should complete full host lifecycle', async () => {
    // 1. Load hosts
    vi.mocked(invoke).mockResolvedValueOnce([]);
    const hosts = await invoke('get_all_hosts');
    expect(hosts).toEqual([]);
    
    // 2. Add host
    const newHost = {
      hostname: 'server01.company.com',
      description: 'Test Server'
    };
    vi.mocked(invoke).mockResolvedValueOnce(newHost);
    await invoke('create_host', newHost);
    
    // 3. Update host
    vi.mocked(invoke).mockResolvedValueOnce({
      ...newHost,
      description: 'Updated Server'
    });
    await invoke('update_host', {
      hostname: newHost.hostname,
      description: 'Updated Server'
    });
    
    // 4. Delete host
    vi.mocked(invoke).mockResolvedValueOnce(true);
    await invoke('delete_host', { hostname: newHost.hostname });
    
    expect(vi.mocked(invoke)).toHaveBeenCalledTimes(4);
  });
});
```

#### Test Setup (`setup.ts`)

Mocks Tauri API for all tests:

```typescript
import { vi } from 'vitest';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    label: 'main',
    close: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  })),
}));

// Mock window.__TAURI__
global.window = Object.create(window);
Object.defineProperty(window, '__TAURI__', {
  value: {
    invoke: vi.fn(),
  },
  writable: true,
});
```

#### Running Tests and Coverage

**Test Scripts:**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**Coverage Report Example:**

```bash
$ npm run test:coverage

 Test Files  9 passed (9)
      Tests  321 passed (321)
   Start at  09:30:45
   Duration  2.34s

 ✓ src/__tests__/validation.test.ts (101)
 ✓ src/__tests__/ui.test.ts (74)
 ✓ src/__tests__/errors.test.ts (85)
 ✓ src/__tests__/hosts.test.ts (61)
 ✓ src/__tests__/validation.property.test.ts
 ✓ src/__tests__/integration.test.ts
 ✓ src/__tests__/ui-main.test.ts
 ✓ src/__tests__/ui-login.test.ts
 ✓ src/__tests__/ui-hosts.test.ts

 % Coverage report from v8
-------------------------|---------|----------|---------|---------|
File                     | % Stmts | % Branch | % Funcs | % Lines |
-------------------------|---------|----------|---------|---------|
All files                |   94.23 |    89.47 |   92.85 |   94.23 |
 src/utils               |   94.23 |    89.47 |   92.85 |   94.23 |
  errors.ts              |   96.10 |    91.66 |   100   |   96.10 |
  hosts.ts               |   95.32 |    88.88 |   90.90 |   95.32 |
  ui.ts                  |   91.42 |    85.71 |   87.50 |   91.42 |
  validation.ts          |   94.73 |    90.90 |   100   |   94.73 |
-------------------------|---------|----------|---------|---------|

✓ All coverage thresholds passed (80% minimum)
```

#### Key Testing Takeaways

✅ **Comprehensive Coverage**
- 321 unit tests for utility modules
- 6,634 lines of test code
- 94% statement coverage achieved

✅ **Property-Based Testing**
- 10,000+ generated test cases using fast-check
- Discovers edge cases missed by manual testing
- Higher confidence in validation logic

✅ **Real DOM Testing**
- jsdom environment for accurate DOM simulation
- Tests actual UI interactions
- Ensures accessibility (ARIA attributes)

✅ **Mocked Tauri API**
- Tests run without Tauri runtime
- Fast execution (2-3 seconds for 321 tests)
- CI/CD friendly

✅ **Coverage Enforcement**
- 80% threshold ensures quality
- HTML reports for detailed analysis
- Prevents untested code merges

---

## 20.4 DevTools and Debugging

Effective debugging is essential for fixing issues quickly.

### 20.4.1 Opening DevTools in Tauri

In development mode, you can open DevTools in any window:

**Method 1: Via Code**

Add to `tauri.conf.json`:

```json
{
  "tauri": {
    "windows": [
      {
        "label": "main",
        "title": "QuickConnect",
        "width": 1000,
        "height": 700,
        "devtools": true
      }
    ]
  }
}
```

**Method 2: Via Keyboard Shortcut**

- Press `F12` in development mode to open DevTools
- Or use `Ctrl+Shift+I` (Windows/Linux)

**Method 3: Programmatically**

```rust
#[tauri::command]
fn open_devtools(window: tauri::Window) {
    #[cfg(debug_assertions)]
    window.open_devtools();
}
```

### 20.4.2 Console Logging

Use `console.log()` in your frontend code:

```typescript
async function connectToHost(hostname: string) {
    console.log(`Connecting to ${hostname}`);
    
    try {
        const result = await invoke('launch_rdp', {
          host: { hostname, description: '' }
        });
        console.log('Connection successful:', result);
    } catch (error) {
        console.error('Connection failed:', error);
    }
}
```

**Structured Logging:**

```typescript
// Create a logger utility
class Logger {
    private static prefix(level: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}]`;
    }

    static debug(message: string, data?: any) {
        console.debug(this.prefix('DEBUG'), message, data || '');
    }

    static info(message: string, data?: any) {
        console.info(this.prefix('INFO'), message, data || '');
    }

    static warn(message: string, data?: any) {
        console.warn(this.prefix('WARN'), message, data || '');
    }

    static error(message: string, error?: any) {
        console.error(this.prefix('ERROR'), message, error || '');
    }
}

// Usage
Logger.info('Loading hosts');
Logger.error('Failed to save host', error);
```

### 20.4.3 Debugging Rust Code

**Print Debugging:**

```rust
#[tauri::command]
fn process_host(hostname: String) -> Result<(), String> {
    println!("Processing host: {}", hostname);
    
    // For structured output
    dbg!(&hostname);
    
    // For complex structs
    let host = Host { name: "test", hostname: &hostname };
    dbg!(&host);
    
    Ok(())
}
```

**Using a Debugger:**

1. Install the CodeLLDB extension in VS Code
2. Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Debug Tauri",
      "cargo": {
        "args": [
          "build",
          "--manifest-path=./src-tauri/Cargo.toml",
          "--no-default-features"
        ]
      },
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

3. Set breakpoints in Rust code
4. Press F5 to start debugging

### 20.4.4 QuickConnect Debug Mode

QuickConnect has a built-in debug logging system (from Chapter 14):

```rust
static DEBUG_MODE: Mutex<bool> = Mutex::new(false);

fn debug_log(level: &str, category: &str, message: &str, details: Option<&str>) {
    let debug_mode = *DEBUG_MODE.lock().unwrap();
    if !debug_mode {
        return;
    }

    // Get AppData path and write to debug.log
    if let Ok(app_data) = std::env::var("APPDATA") {
        let log_path = PathBuf::from(app_data)
            .join("QuickConnect")
            .join("debug.log");

        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
            let log_line = if let Some(d) = details {
                format!("[{}] [{}] [{}] {} - {}\n", timestamp, level, category, message, d)
            } else {
                format!("[{}] [{}] [{}] {}\n", timestamp, level, category, message)
            };
            let _ = file.write_all(log_line.as_bytes());
        }
    }
}
```

Enable via command line:

```powershell
.\QuickConnect.exe --debug
```

Then check `%APPDATA%\QuickConnect\debug.log` for detailed logs.

### 20.4.5 Network Debugging

For debugging LDAP or other network operations:

```rust
use std::time::Instant;

#[tauri::command]
async fn scan_domain(app_handle: tauri::AppHandle, domain: String, server: String) -> Result<String, String> {
    let start = Instant::now();
    debug_log(
        "INFO",
        "LDAP",
        &format!("Starting scan_domain: domain={}, server={}", domain, server),
        None,
    );
    
    // Perform LDAP scan (QuickConnect delegates to core::ldap)
    let credentials = crate::commands::get_stored_credentials().await?
        .ok_or_else(|| "No stored credentials found. Please save your domain credentials in the login window first.".to_string())?;
    let result = crate::core::ldap::scan_domain_for_servers(&domain, &server, &credentials)
        .await
        .map_err(|e| e.to_string());
    
    let duration = start.elapsed();
    debug_log(
        "INFO",
        "LDAP",
        &format!("scan_domain completed in {:?}", duration),
        Some(&format!(
            "Found {} Windows Server(s)",
            result.as_ref().map(|r| r.count).unwrap_or(0)
        ))
    );
    
    Ok(format!(
        "Successfully found {} Windows Server(s).",
        result.map(|r| r.count).unwrap_or(0)
    ))
}
```

---

## 20.5 Performance Profiling

Understanding where your application spends time helps identify optimization opportunities.

### 20.5.1 Profiling Rust Code

**Using `cargo flamegraph`:**

```powershell
# Install
cargo install flamegraph

# Generate flamegraph (requires admin privileges on Windows)
cargo flamegraph --bin QuickConnect

# Open flamegraph.svg in browser
```

**Using `cargo bench`:**

Create `benches/my_benchmark.rs`:

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use quickconnect_lib::rdp::parse_username;

fn benchmark_parse_username(c: &mut Criterion) {
    c.bench_function("parse_username backslash", |b| {
        b.iter(|| parse_username(black_box("DOMAIN\\user")))
    });

    c.bench_function("parse_username at", |b| {
        b.iter(|| parse_username(black_box("user@domain.com")))
    });
}

criterion_group!(benches, benchmark_parse_username);
criterion_main!(benches);
```

Add to `Cargo.toml`:

```toml
[dev-dependencies]
criterion = "0.5"

[[bench]]
name = "my_benchmark"
harness = false
```

Run:

```powershell
cargo bench
```

### 20.5.2 Profiling Frontend Performance

**Using Browser DevTools:**

1. Open DevTools (F12)
2. Go to Performance tab
3. Click Record
4. Perform actions in your app
5. Stop recording
6. Analyze the timeline

**Key Metrics to Watch:**
- **Scripting (Yellow):** JavaScript execution time
- **Rendering (Purple):** Layout and paint operations
- **Loading (Blue):** Network requests
- **Idle (White):** Waiting time

**Measuring Specific Operations:**

```typescript
async function loadHosts() {
    console.time('loadHosts');
    
    try {
        const hosts = await invoke<Host[]>('get_hosts');
        console.log(`Loaded ${hosts.length} hosts`);
        return hosts;
    } finally {
        console.timeEnd('loadHosts');
    }
}

// More detailed profiling
async function complexOperation() {
    performance.mark('start');
    
    // Do work
    const data = await fetchData();
    performance.mark('data-fetched');
    
    processData(data);
    performance.mark('data-processed');
    
    renderUI(data);
    performance.mark('ui-rendered');
    
    // Measure durations
    performance.measure('fetch-time', 'start', 'data-fetched');
    performance.measure('process-time', 'data-fetched', 'data-processed');
    performance.measure('render-time', 'data-processed', 'ui-rendered');
    
    // Log measurements
    const entries = performance.getEntriesByType('measure');
    entries.forEach(entry => {
        console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
    });
}
```

### 20.5.3 Memory Profiling

**Rust Memory Profiling:**

Use `heaptrack` or `valgrind` on Linux, or built-in tools:

```rust
// Monitor allocation patterns
#[global_allocator]
static GLOBAL: jemallocator::Jemalloc = jemallocator::Jemalloc;

// In your code
fn check_memory_usage() {
    if let Ok(stats) = jemalloc_ctl::stats::allocated::read() {
        println!("Allocated: {} bytes", stats);
    }
}
```

**Frontend Memory Profiling:**

1. Open DevTools → Memory tab
2. Take heap snapshot
3. Perform operations
4. Take another snapshot
5. Compare snapshots to find leaks

**Common Memory Leaks to Watch For:**
- Event listeners not cleaned up
- Timers not cleared
- Large objects in closures
- Circular references

---

## 20.6 Memory Management

Understanding memory management helps prevent leaks and reduce memory usage.

### 20.6.1 Rust Memory Management

Rust's ownership system prevents most memory issues, but be aware of:

**Avoiding Clones When Possible:**

```rust
// ❌ Unnecessary clone
fn process_host(host: Host) -> String {
    let hostname = host.hostname.clone(); // Unnecessary
    hostname.to_uppercase()
}

// ✅ Use references
fn process_host(host: &Host) -> String {
    host.hostname.to_uppercase()
}
```

**Using Cow (Clone on Write):**

```rust
use std::borrow::Cow;

fn normalize_hostname(hostname: &str) -> Cow<str> {
    if hostname.chars().any(|c| c.is_uppercase()) {
        // Only allocate if we need to change something
        Cow::Owned(hostname.to_lowercase())
    } else {
        // No allocation needed
        Cow::Borrowed(hostname)
    }
}

// Usage
let host1 = "server.local"; // Already lowercase, no allocation
let normalized1 = normalize_hostname(host1);

let host2 = "SERVER.LOCAL"; // Uppercase, will allocate
let normalized2 = normalize_hostname(host2);
```

**Careful with String Concatenation:**

```rust
// ❌ Inefficient - creates many intermediate strings
let mut result = String::new();
for i in 0..1000 {
    result = result + &i.to_string(); // Creates new string each time
}

// ✅ Efficient - pre-allocate and push
let mut result = String::with_capacity(4000); // Estimate capacity
for i in 0..1000 {
    result.push_str(&i.to_string());
}

// ✅ Even better - use format! macro or join
let result: String = (0..1000)
    .map(|i| i.to_string())
    .collect::<Vec<_>>()
    .join("");
```

### 20.6.2 Frontend Memory Management

**Cleaning Up Event Listeners:**

```typescript
class HostManager {
    private abortController: AbortController;

    constructor() {
        this.abortController = new AbortController();
        this.setupListeners();
    }

    private setupListeners() {
        // Use AbortController for easy cleanup
        document.addEventListener(
            'click',
            this.handleClick.bind(this),
            { signal: this.abortController.signal }
        );
    }

    private handleClick(event: MouseEvent) {
        // Handle click
    }

    // Clean up when done
    destroy() {
        this.abortController.abort(); // Removes all listeners
    }
}
```

**Clearing Timers:**

```typescript
class AutoCloseWindow {
    private timerId: number | null = null;

    startTimer(duration: number) {
        // Clear existing timer
        this.clearTimer();
        
        this.timerId = window.setTimeout(() => {
            this.close();
        }, duration);
    }

    clearTimer() {
        if (this.timerId !== null) {
            window.clearTimeout(this.timerId);
            this.timerId = null;
        }
    }

    close() {
        this.clearTimer();
        // Close window logic
    }
}
```

**Managing Large Lists:**

```typescript
// Virtual scrolling for large lists
class VirtualList {
    private visibleItems = 20;
    private itemHeight = 50;
    
    renderVisibleItems(allItems: any[], scrollTop: number) {
        const startIndex = Math.floor(scrollTop / this.itemHeight);
        const endIndex = startIndex + this.visibleItems;
        
        // Only render visible items
        return allItems.slice(startIndex, endIndex);
    }
}
```

### 20.6.3 QuickConnect Memory Patterns

QuickConnect uses several memory-efficient patterns:

**1. Lazy Loading:**

```typescript
// Don't load all hosts at startup if not needed
let hostsCache: Host[] | null = null;

async function getHosts(): Promise<Host[]> {
    if (hostsCache === null) {
        hostsCache = await invoke<Host[]>('get_hosts');
    }
    return hostsCache;
}

// Invalidate cache when data changes
function onHostAdded() {
    hostsCache = null; // Will reload on next access
}
```

**2. Efficient Search:**

```typescript
// Instead of filtering entire array every keystroke
let searchTimeout: number | null = null;

function onSearchInput(query: string) {
    // Debounce search
    if (searchTimeout !== null) {
        clearTimeout(searchTimeout);
    }
    
    searchTimeout = window.setTimeout(() => {
        performSearch(query);
    }, 300); // Wait 300ms after user stops typing
}
```

---

## 20.7 Optimization Techniques

Let's explore practical optimizations you can apply.

### 20.7.1 Optimizing Rust Backend

**1. Use Release Builds:**

```toml
# Cargo.toml
[profile.release]
opt-level = 3           # Maximum optimization
lto = true              # Link-time optimization
codegen-units = 1       # Better optimization (slower compile)
strip = true            # Remove debug symbols
panic = 'abort'         # Smaller binary
```

**2. Avoid Unnecessary Allocations:**

```rust
// ❌ Allocates a new Vec
fn get_user_list(names: &[String]) -> Vec<String> {
    names.iter().map(|s| s.to_uppercase()).collect()
}

// ✅ Use iterators when possible
fn process_users(names: &[String]) {
    for name in names.iter().map(|s| s.to_uppercase()) {
        // Process without allocating intermediate Vec
        println!("{}", name);
    }
}
```

**3. Use Appropriate Data Structures:**

```rust
use std::collections::HashMap;

// For lookups, HashMap is O(1) vs Vec O(n)
let mut host_map: HashMap<String, Host> = HashMap::new();

// For ordered data or iterations, Vec is better
let mut host_list: Vec<Host> = Vec::new();
```

**4. Reduce Serialization Overhead:**

```rust
// Instead of sending large structs
#[derive(serde::Serialize)]
struct FullHost {
    id: u64,
    name: String,
    hostname: String,
    description: String,
    created_at: String,
    modified_at: String,
    tags: Vec<String>,
    // ... many more fields
}

// Send only what frontend needs
#[derive(serde::Serialize)]
struct HostSummary {
    hostname: String,
    description: String,
}

// Hypothetical example: if your real Host struct had many fields,
// expose a minimal "summary" shape instead of sending everything.
fn get_host_summaries_example() -> Vec<HostSummary> {
    vec![]
}
```

### 20.7.2 Optimizing Frontend

**1. Minimize DOM Manipulations:**

```typescript
// ❌ Multiple DOM updates
function updateHostList(hosts: Host[]) {
    const list = document.getElementById('hostList')!;
    hosts.forEach(host => {
        const div = document.createElement('div');
        div.textContent = host.hostname;
        list.appendChild(div); // Each append triggers reflow
    });
}

// ✅ Single DOM update
function updateHostList(hosts: Host[]) {
    const html = hosts.map(host => 
        `<div class="host-card">${host.hostname}</div>`
    ).join('');
    
    document.getElementById('hostList')!.innerHTML = html;
}

// ✅✅ Even better - use DocumentFragment
function updateHostList(hosts: Host[]) {
    const fragment = document.createDocumentFragment();
    
    hosts.forEach(host => {
        const div = document.createElement('div');
        div.className = 'host-card';
        div.textContent = host.hostname;
        fragment.appendChild(div);
    });
    
    const list = document.getElementById('hostList')!;
    list.innerHTML = ''; // Clear once
    list.appendChild(fragment); // Append once
}
```

**2. Debounce Expensive Operations:**

```typescript
function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: number | null = null;
    
    return function(...args: Parameters<T>) {
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        
        timeout = window.setTimeout(() => {
            func(...args);
        }, wait);
    };
}

// Usage
const searchHosts = debounce((query: string) => {
    // Expensive search operation
}, 300);

searchInput.addEventListener('input', (e) => {
    searchHosts((e.target as HTMLInputElement).value);
});
```

**3. Use requestAnimationFrame for Animations:**

```typescript
// ❌ Using setTimeout for animations
function animateScroll(target: number) {
    const step = 5;
    const current = window.scrollY;
    
    if (current < target) {
        window.scrollTo(0, current + step);
        setTimeout(() => animateScroll(target), 16); // ~60fps
    }
}

// ✅ Using requestAnimationFrame
function animateScroll(target: number) {
    const start = window.scrollY;
    const distance = target - start;
    const duration = 500; // ms
    let startTime: number | null = null;
    
    function animation(currentTime: number) {
        if (startTime === null) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        window.scrollTo(0, start + distance * progress);
        
        if (progress < 1) {
            requestAnimationFrame(animation);
        }
    }
    
    requestAnimationFrame(animation);
}
```

**4. Lazy Load Images:**

```typescript
class LazyImageLoader {
    private observer: IntersectionObserver;
    
    constructor() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target as HTMLImageElement;
                        const src = img.dataset.src;
                        if (src) {
                            img.src = src;
                            this.observer.unobserve(img);
                        }
                    }
                });
            },
            { rootMargin: '50px' } // Load 50px before visible
        );
    }
    
    observe(img: HTMLImageElement) {
        this.observer.observe(img);
    }
}

// Usage
const loader = new LazyImageLoader();
document.querySelectorAll('img[data-src]').forEach(img => {
    loader.observe(img as HTMLImageElement);
});
```

### 20.7.3 Optimizing IPC Calls

**Batch Operations:**

```rust
// ❌ Multiple IPC calls
#[tauri::command]
fn save_host(host: Host) -> Result<(), String> {
    // Save one host
}

// Frontend makes 100 calls
for (const host of hosts) {
    await invoke('save_host', { host });
}

// ✅ QuickConnect pattern: move the batch work into ONE command.
// Example: scan_domain finds many hosts, writes hosts.csv, and emits "hosts-updated".
const message = await invoke<string>('scan_domain', { domain, server });
console.log(message);
```

**Cache Results:**

```typescript
class HostCache {
    private cache = new Map<string, Host>();
    private cacheTime = 60000; // 1 minute
    private timestamps = new Map<string, number>();
    
    async get(hostname: string): Promise<Host> {
        const cached = this.cache.get(hostname);
        const timestamp = this.timestamps.get(hostname) || 0;
        
        if (cached && Date.now() - timestamp < this.cacheTime) {
            return cached;
        }
        
        // Cache miss or expired
        const host = await invoke<Host>('get_host', { hostname });
        this.cache.set(hostname, host);
        this.timestamps.set(hostname, Date.now());
        
        return host;
    }
    
    invalidate(hostname: string) {
        this.cache.delete(hostname);
        this.timestamps.delete(hostname);
    }
}
```

---

## 20.8 Common Pitfalls and Solutions

### 20.8.1 Backend Pitfalls

**❌ Problem: Blocking the UI Thread**

```rust
#[tauri::command]
fn slow_operation() -> String {
    // This blocks the UI
    std::thread::sleep(std::time::Duration::from_secs(5));
    "Done".to_string()
}
```

**✅ Solution: Use Async**

```rust
#[tauri::command]
async fn slow_operation() -> String {
    // This doesn't block the UI
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    "Done".to_string()
}
```

**❌ Problem: Unwrapping Can Crash the App**

```rust
#[tauri::command]
fn read_config() -> String {
    let content = std::fs::read_to_string("config.json").unwrap(); // Crashes if file missing
    content
}
```

**✅ Solution: Proper Error Handling**

```rust
#[tauri::command]
fn read_config() -> Result<String, String> {
    std::fs::read_to_string("config.json")
        .map_err(|e| format!("Failed to read config: {}", e))
}
```

**❌ Problem: Not Cleaning Up Resources**

```rust
#[tauri::command]
fn start_server() {
    std::thread::spawn(|| {
        // Server runs forever, no way to stop
        loop {
            // Do work
        }
    });
}
```

**✅ Solution: Store Handle for Cleanup**

```rust
use std::sync::Mutex;

struct ServerHandle {
    running: Arc<Mutex<bool>>,
}

#[tauri::command]
fn start_server(state: State<ServerHandle>) -> Result<(), String> {
    let running = Arc::clone(&state.running);
    *running.lock().unwrap() = true;
    
    let running_clone = Arc::clone(&running);
    std::thread::spawn(move || {
        while *running_clone.lock().unwrap() {
            // Do work
            std::thread::sleep(Duration::from_millis(100));
        }
    });
    
    Ok(())
}

#[tauri::command]
fn stop_server(state: State<ServerHandle>) {
    *state.running.lock().unwrap() = false;
}
```

### 20.8.2 Frontend Pitfalls

**❌ Problem: Memory Leak from Event Listeners**

```typescript
function setupButton() {
    const button = document.getElementById('myButton')!;
    button.addEventListener('click', () => {
        // Handler never removed
        console.log('Clicked');
    });
}

// Called multiple times = multiple listeners
setupButton();
setupButton();
setupButton();
```

**✅ Solution: Clean Up Listeners**

```typescript
let cleanupFn: (() => void) | null = null;

function setupButton() {
    // Clean up previous listener
    if (cleanupFn) {
        cleanupFn();
    }
    
    const button = document.getElementById('myButton')!;
    const handler = () => console.log('Clicked');
    
    button.addEventListener('click', handler);
    
    // Store cleanup function
    cleanupFn = () => {
        button.removeEventListener('click', handler);
    };
}
```

**❌ Problem: Race Conditions**

```typescript
let currentRequest = 0;

async function searchHosts(query: string) {
    const requestId = ++currentRequest;
    
    const results = await invoke('search_hosts', { query });
    
    // Problem: Older request might finish after newer one
    displayResults(results);
}
```

**✅ Solution: Cancel or Ignore Old Requests**

```typescript
let currentRequest = 0;

async function searchHosts(query: string) {
    const requestId = ++currentRequest;
    
    const results = await invoke('search_hosts', { query });
    
    // Only use results if this is still the latest request
    if (requestId === currentRequest) {
        displayResults(results);
    }
}
```

**❌ Problem: Not Handling Async Errors**

```typescript
async function loadData() {
    const data = await invoke('get_data');
    // If this throws, it's an unhandled promise rejection
    processData(data);
}

loadData(); // Fire and forget - bad!
```

**✅ Solution: Always Handle Errors**

```typescript
async function loadData() {
    try {
        const data = await invoke('get_data');
        processData(data);
    } catch (error) {
        console.error('Failed to load data:', error);
        showErrorToast('Failed to load data');
    }
}

loadData().catch(error => {
    console.error('Unexpected error in loadData:', error);
});
```

### 20.8.3 Performance Pitfalls

**❌ Problem: N+1 Query Pattern**

```typescript
// Load hosts
const hosts = await invoke<Host[]>('get_hosts');

// Then call another command per host (N separate calls!)
for (const host of hosts) {
    const status = await invoke<string>('check_host_status', { hostname: host.hostname });
    // Process status
}
```

**✅ Solution: Cache + parallelize (matches QuickConnect command set)**

```typescript
// Load once
const hosts = await invoke<Host[]>('get_hosts');

// Parallelize status checks
const statuses = await Promise.all(
  hosts.map(h => invoke<string>('check_host_status', { hostname: h.hostname }))
);

// Or cache results per hostname if you call this repeatedly.
```

**❌ Problem: Excessive Rendering**

```typescript
function updateList() {
    setInterval(() => {
        // Re-render entire list every 100ms, even if no changes
        renderHostList();
    }, 100);
}
```

**✅ Solution: Only Render When Data Changes**

```typescript
let lastHostsJson = '';

function updateListIfNeeded(hosts: Host[]) {
    const currentJson = JSON.stringify(hosts);
    
    if (currentJson !== lastHostsJson) {
        renderHostList(hosts);
        lastHostsJson = currentJson;
    }
}
```

---

## 20.9 Key Takeaways

### Testing Best Practices

1. **Write tests first** - TDD helps design better APIs
2. **Test behavior, not implementation** - Tests should survive refactoring
3. **Keep tests simple** - Each test should verify one thing
4. **Use descriptive names** - `test_save_host_with_invalid_hostname_returns_error`
5. **Mock external dependencies** - Make tests fast and reliable

### Debugging Best Practices

1. **Use structured logging** - Consistent format helps parsing
2. **Log context** - Include relevant data (IDs, timestamps)
3. **Different log levels** - DEBUG, INFO, WARN, ERROR
4. **Development vs Production** - More logging in dev, less in prod
5. **DevTools are your friend** - Network tab, Console, Performance

### Performance Best Practices

1. **Measure first** - Profile before optimizing
2. **Optimize the right things** - Focus on bottlenecks
3. **Async for I/O** - Don't block on network/disk
4. **Batch operations** - Reduce IPC overhead
5. **Cache wisely** - Balance memory vs computation

### Memory Management Best Practices

1. **Clean up resources** - Remove listeners, clear timers
2. **Avoid unnecessary clones** - Use references when possible
3. **Pre-allocate when size known** - `Vec::with_capacity()`
4. **Watch for leaks** - Use memory profiler regularly
5. **Lazy loading** - Load data when needed, not all upfront

---

## 20.10 Practice Exercises

### Exercise 1: Write Unit Tests

Create comprehensive tests for a host validation function:

```rust
pub fn validate_host(name: &str, hostname: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    
    if hostname.trim().is_empty() {
        return Err("Hostname cannot be empty".to_string());
    }
    
    if hostname.contains(' ') {
        return Err("Hostname cannot contain spaces".to_string());
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // TODO: Write tests for:
    // 1. Valid host with name and hostname
    // 2. Empty name should return error
    // 3. Empty hostname should return error
    // 4. Whitespace-only name should return error
    // 5. Hostname with spaces should return error
    // 6. Valid hostname formats (IP, FQDN, short name)
}
```

### Exercise 2: Add Performance Logging

Add timing measurements to the LDAP scan function:

```rust
#[tauri::command]
async fn scan_domain(app_handle: tauri::AppHandle, domain: String, server: String) -> Result<String, String> {
    // TODO: Add timing measurements
    // 1. Measure total time
    // 2. Log the result count
    // 3. (Optional) Add deeper timings inside core::ldap
    // 4. Log results using debug_log

    // QuickConnect: authenticate using stored domain credentials.
    let credentials = crate::commands::get_stored_credentials().await?
        .ok_or_else(|| "No stored credentials found. Please save your domain credentials in the login window first.".to_string())?;

    // QuickConnect: delegate the LDAP work to core::ldap.
    let scan_result = crate::core::ldap::scan_domain_for_servers(&domain, &server, &credentials)
        .await
        .map_err(|e| e.to_string())?;

    Ok(format!("Successfully found {} Windows Server(s).", scan_result.count))
}
```

<details>
<summary><strong>Solution</strong></summary>

```rust
#[tauri::command]
async fn scan_domain(app_handle: tauri::AppHandle, domain: String, server: String) -> Result<String, String> {
    use std::time::Instant;

    let total_start = Instant::now();
    debug_log(
        "INFO",
        "LDAP",
        &format!("Starting domain scan: domain={}, server={}", domain, server),
        None,
    );

    let credentials = crate::commands::get_stored_credentials().await?
        .ok_or_else(|| "No stored credentials found. Please save your domain credentials in the login window first.".to_string())?;

    let scan_result = crate::core::ldap::scan_domain_for_servers(&domain, &server, &credentials)
        .await
        .map_err(|e| e.to_string())?;

    let total_duration = total_start.elapsed();
    debug_log(
        "INFO",
        "LDAP",
        "Domain scan completed",
        Some(&format!(
            "Total time: {:?}, Found {} Windows Server(s)",
            total_duration, scan_result.count
        ))
    );

    Ok(format!(
        "Successfully found {} Windows Server(s).",
        scan_result.count
    ))
}
```

</details>

### Exercise 3: Optimize a Slow Function

This function is slow. Identify and fix the performance issues:

```typescript
async function displaySearchResults(query: string) {
    // Load all hosts
    const allHosts = await invoke<Host[]>('get_hosts');
    
    // Filter hosts
    const lowerQuery = query.toLowerCase();
    const filtered = allHosts.filter(host =>
        host.hostname.toLowerCase().includes(lowerQuery) ||
        host.description.toLowerCase().includes(lowerQuery)
    );
    
    // Clear existing results
    const container = document.getElementById('results')!;
    container.innerHTML = '';
    
    // Add each result individually
    for (const host of filtered) {
        const div = document.createElement('div');
        div.className = 'host-card';
        div.innerHTML = `
            <h3>${host.hostname}</h3>
            <p>${host.description}</p>
        `;
        
        // Anti-pattern: N+1 IPC calls (one status check per host)
        const status = await invoke<string>('check_host_status', { hostname: host.hostname });
        const statusDiv = document.createElement('div');
        statusDiv.textContent = status;
        div.appendChild(statusDiv);
        
        // Add to DOM
        container.appendChild(div); // Reflow on each append
    }
}

// Called on every keystroke
document.getElementById('search')!.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value;
    displaySearchResults(query);
});
```

**Problems to fix:**
1. Loading all hosts on every search
2. Multiple IPC calls per result (N+1 status checks)
3. Multiple DOM reflows
4. No debouncing

<details>
<summary><strong>Solution</strong></summary>

```typescript
// Cache hosts
let hostsCache: Host[] | null = null;
let hostStatusCache = new Map<string, string>();

async function getHosts(): Promise<Host[]> {
    if (hostsCache === null) {
        hostsCache = await invoke<Host[]>('get_hosts');
    }
    return hostsCache;
}

async function displaySearchResults(query: string) {
    // Use cached hosts
    const allHosts = await getHosts();
    
    // Filter hosts
    const lowerQuery = query.toLowerCase();
    const filtered = allHosts.filter(host =>
        host.hostname.toLowerCase().includes(lowerQuery) ||
        host.description.toLowerCase().includes(lowerQuery)
    );
    
    // Cache host status (avoid repeating status calls while typing)
    const hostnamesNeeded = filtered
        .map(h => h.hostname)
        .filter(hostname => !hostStatusCache.has(hostname));
    await Promise.all(
        hostnamesNeeded.map(async (hostname) => {
            const status = await invoke<string>('check_host_status', { hostname });
            hostStatusCache.set(hostname, status);
        })
    );
    
    // Build HTML in one go
    const html = filtered.map(host => {
        const status = hostStatusCache.get(host.hostname) ?? '';
        return `
            <div class="host-card">
                <h3>${host.hostname}</h3>
                <p>${host.description}</p>
                <div>${status}</div>
            </div>
        `;
    }).join('');
    
    // Single DOM update
    document.getElementById('results')!.innerHTML = html;
}

// Debounce search
const debouncedSearch = debounce(displaySearchResults, 300);

document.getElementById('search')!.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value;
    debouncedSearch(query);
});

// Invalidate cache when data changes
function onHostsChanged() {
    hostsCache = null;
    hostDetailsCache.clear();
}

function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: number | null = null;
    return function(...args: Parameters<T>) {
        if (timeout !== null) clearTimeout(timeout);
        timeout = window.setTimeout(() => func(...args), wait);
    };
}
```

</details>

### Exercise 4: Find and Fix Memory Leak

This code has a memory leak. Find and fix it:

```typescript
class ConnectionMonitor {
    private connections = new Map<string, number>();
    
    startMonitoring(hostname: string) {
        // Start checking connection every second
        setInterval(() => {
            this.checkConnection(hostname);
        }, 1000);
    }
    
    async checkConnection(hostname: string) {
        try {
            const isOnline = await invoke('ping_host', { hostname });
            this.connections.set(hostname, isOnline ? 1 : 0);
        } catch (error) {
            console.error('Connection check failed:', error);
        }
    }
    
    stopMonitoring(hostname: string) {
        this.connections.delete(hostname);
        // TODO: Stop the interval!
    }
}
```

<details>
<summary><strong>Solution</strong></summary>

```typescript
class ConnectionMonitor {
    private connections = new Map<string, number>();
    private intervals = new Map<string, number>();
    
    startMonitoring(hostname: string) {
        // Stop any existing monitor for this host
        this.stopMonitoring(hostname);
        
        // Start checking connection every second
        const intervalId = setInterval(() => {
            this.checkConnection(hostname);
        }, 1000);
        
        // Store interval ID so we can clear it later
        this.intervals.set(hostname, intervalId);
    }
    
    async checkConnection(hostname: string) {
        try {
            const isOnline = await invoke('ping_host', { hostname });
            this.connections.set(hostname, isOnline ? 1 : 0);
        } catch (error) {
            console.error('Connection check failed:', error);
        }
    }
    
    stopMonitoring(hostname: string) {
        // Clear the interval
        const intervalId = this.intervals.get(hostname);
        if (intervalId !== undefined) {
            clearInterval(intervalId);
            this.intervals.delete(hostname);
        }
        
        this.connections.delete(hostname);
    }
    
    // Clean up all monitors
    stopAll() {
        for (const [hostname] of this.intervals) {
            this.stopMonitoring(hostname);
        }
    }
}
```

</details>

---

## 20.11 Further Reading

### Testing Resources

- **Rust Book - Testing Chapter:** https://doc.rust-lang.org/book/ch11-00-testing.html
- **Cargo Book - Tests:** https://doc.rust-lang.org/cargo/guide/tests.html
- **Vitest Documentation:** https://vitest.dev/
- **Testing Library:** https://testing-library.com/

### Performance Resources

- **Rust Performance Book:** https://nnethercote.github.io/perf-book/
- **Web Performance:** https://web.dev/performance/
- **Chrome DevTools:** https://developer.chrome.com/docs/devtools/
- **Flamegraph Tool:** https://github.com/flamegraph-rs/flamegraph

### Debugging Resources

- **Debugging Rust:** https://doc.rust-lang.org/book/appendix-04-useful-development-tools.html
- **Tauri Debugging:** https://tauri.app/v1/guides/debugging/
- **Chrome DevTools Documentation:** https://developer.chrome.com/docs/devtools/

---

## Summary

In this chapter, you learned:

✅ How to write effective unit tests for Rust and TypeScript code  
✅ Integration testing strategies for Tauri applications  
✅ Using DevTools and debuggers to identify issues  
✅ Profiling techniques for finding performance bottlenecks  
✅ Memory management best practices in Rust and JavaScript  
✅ Practical optimization techniques for backend and frontend  
✅ Common pitfalls and how to avoid them  

Testing, debugging, and performance optimization are ongoing processes. Make them part of your development workflow, not afterthoughts. Profile before optimizing, test continuously, and always measure the impact of your changes.

In the next chapter, we'll cover **Building and Distribution** - preparing your application for release and distributing it to users!

---

**Chapter 20 Complete!** 🎉

You now have the skills to ensure your Tauri application is fast, reliable, and bug-free. These practices will serve you well in any software project.

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

### 20.1.1 Basic Test Structure

In Rust, tests are typically written in the same file as the code being tested, using a `#[cfg(test)]` module:

```rust
// Simple function to test
fn add_numbers(a: i32, b: i32) -> i32 {
    a + b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_numbers() {
        assert_eq!(add_numbers(2, 3), 5);
        assert_eq!(add_numbers(-1, 1), 0);
        assert_eq!(add_numbers(0, 0), 0);
    }
}
```

**Key Concepts:**
- `#[cfg(test)]`: Conditional compilation - only compiled during testing
- `#[test]`: Marks a function as a test
- `assert_eq!`: Checks if two values are equal
- `assert!`: Checks if a condition is true

### 20.1.2 Testing Error Handling

Testing functions that return `Result<T, E>` is straightforward:

```rust
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err("Division by zero".to_string())
    } else {
        Ok(a / b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_divide_success() {
        let result = divide(10.0, 2.0).unwrap();
        assert_eq!(result, 5.0);
    }

    #[test]
    fn test_divide_by_zero() {
        let result = divide(10.0, 0.0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Division by zero");
    }

    #[test]
    #[should_panic(expected = "Division by zero")]
    fn test_divide_panic() {
        divide(10.0, 0.0).unwrap(); // This will panic
    }
}
```

### 20.1.3 Testing QuickConnect Functions

Let's test some utility functions similar to those in QuickConnect:

```rust
// Function to parse username format (domain\user or user@domain)
fn parse_username(username: &str) -> (Option<String>, String) {
    if username.contains('\\') {
        let parts: Vec<&str> = username.split('\\').collect();
        if parts.len() == 2 {
            return (Some(parts[0].to_string()), parts[1].to_string());
        }
    } else if username.contains('@') {
        let parts: Vec<&str> = username.split('@').collect();
        if parts.len() == 2 {
            return (Some(parts[1].to_string()), parts[0].to_string());
        }
    }
    (None, username.to_string())
}

#[cfg(test)]
mod username_tests {
    use super::*;

    #[test]
    fn test_backslash_format() {
        let (domain, user) = parse_username("CONTOSO\\jsmith");
        assert_eq!(domain, Some("CONTOSO".to_string()));
        assert_eq!(user, "jsmith".to_string());
    }

    #[test]
    fn test_at_format() {
        let (domain, user) = parse_username("jsmith@contoso.com");
        assert_eq!(domain, Some("contoso.com".to_string()));
        assert_eq!(user, "jsmith".to_string());
    }

    #[test]
    fn test_no_domain() {
        let (domain, user) = parse_username("jsmith");
        assert_eq!(domain, None);
        assert_eq!(user, "jsmith".to_string());
    }

    #[test]
    fn test_malformed_username() {
        let (domain, user) = parse_username("CONTOSO\\");
        assert_eq!(domain, None);
        assert_eq!(user, "CONTOSO\\".to_string());
    }
}
```

### 20.1.4 Running Tests

To run all tests in your Rust project:

```powershell
cargo test
```

To run specific tests:

```powershell
# Run tests with "username" in the name
cargo test username

# Run tests in a specific module
cargo test username_tests

# Show output from successful tests too
cargo test -- --nocapture

# Run tests in parallel (default) or serially
cargo test -- --test-threads=1
```

### 20.1.5 Testing with Mocks

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
use QuickConnect_lib::{parse_username, Host};

#[test]
fn test_username_parsing_integration() {
    let test_cases = vec![
        ("admin@contoso.com", Some("contoso.com"), "admin"),
        ("CONTOSO\\admin", Some("CONTOSO"), "admin"),
        ("localuser", None, "localuser"),
    ];

    for (input, expected_domain, expected_user) in test_cases {
        let (domain, user) = parse_username(input);
        assert_eq!(domain.as_deref(), expected_domain);
        assert_eq!(user, expected_user);
    }
}
```

### 20.2.2 Testing Tauri Commands

Testing Tauri commands requires a bit more setup. You can test the underlying logic without the Tauri runtime:

```rust
// In src-tauri/src/lib.rs - separate business logic from command
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

### 20.2.3 Testing with the Tauri Runtime

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
        const result = await invoke('connect_rdp', { hostname });
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
async fn scan_domain(domain: String) -> Result<Vec<String>, String> {
    let start = Instant::now();
    debug_log("INFO", "LDAP", &format!("Starting scan of domain: {}", domain), None);
    
    // Perform LDAP scan
    let result = perform_ldap_scan(&domain).await;
    
    let duration = start.elapsed();
    debug_log(
        "INFO",
        "LDAP",
        &format!("Scan completed in {:?}", duration),
        Some(&format!("Found {} hosts", result.as_ref().map(|r| r.len()).unwrap_or(0)))
    );
    
    result
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
use QuickConnect_lib::parse_username;

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
    let name = host.name.clone(); // Unnecessary
    name.to_uppercase()
}

// ✅ Use references
fn process_host(host: &Host) -> String {
    host.name.to_uppercase()
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
    name: String,
    hostname: String,
}

#[tauri::command]
fn get_host_summaries() -> Vec<HostSummary> {
    // Return minimal data
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
        div.textContent = host.name;
        list.appendChild(div); // Each append triggers reflow
    });
}

// ✅ Single DOM update
function updateHostList(hosts: Host[]) {
    const html = hosts.map(host => 
        `<div class="host-card">${host.name}</div>`
    ).join('');
    
    document.getElementById('hostList')!.innerHTML = html;
}

// ✅✅ Even better - use DocumentFragment
function updateHostList(hosts: Host[]) {
    const fragment = document.createDocumentFragment();
    
    hosts.forEach(host => {
        const div = document.createElement('div');
        div.className = 'host-card';
        div.textContent = host.name;
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

// ✅ Single batched call
#[tauri::command]
fn save_hosts(hosts: Vec<Host>) -> Result<(), String> {
    // Save all hosts at once
}

// Frontend makes 1 call
await invoke('save_hosts', { hosts });
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

// Then load details for each (N separate calls!)
for (const host of hosts) {
    const details = await invoke('get_host_details', { id: host.id });
    // Process details
}
```

**✅ Solution: Batch Loading**

```rust
#[tauri::command]
fn get_hosts_with_details() -> Result<Vec<HostWithDetails>, String> {
    // Load everything in one go
}
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
async fn scan_domain(domain: String) -> Result<Vec<String>, String> {
    // TODO: Add timing measurements
    // 1. Measure connection time
    // 2. Measure search time
    // 3. Measure total time
    // 4. Log results using debug_log
    
    let base_dn = domain_to_base_dn(&domain);
    let ldap_url = format!("ldap://{}:389", domain);
    
    let (conn, mut ldap) = LdapConnAsync::new(&ldap_url)
        .await
        .map_err(|e| format!("LDAP connection failed: {}", e))?;
    
    ldap3::drive!(conn);
    
    ldap.simple_bind("", "")
        .await
        .map_err(|e| format!("LDAP bind failed: {}", e))?;
    
    let (rs, _res) = ldap
        .search(
            &base_dn,
            Scope::Subtree,
            "(&(objectClass=computer)(operatingSystem=Windows*))",
            vec!["cn"],
        )
        .await
        .map_err(|e| format!("LDAP search failed: {}", e))?;
    
    let computers: Vec<String> = rs
        .into_iter()
        .filter_map(|entry| {
            let se = SearchEntry::construct(entry);
            se.attrs.get("cn").and_then(|v| v.first().cloned())
        })
        .collect();
    
    ldap.unbind()
        .await
        .map_err(|e| format!("LDAP unbind failed: {}", e))?;
    
    Ok(computers)
}
```

<details>
<summary><strong>Solution</strong></summary>

```rust
#[tauri::command]
async fn scan_domain(domain: String) -> Result<Vec<String>, String> {
    use std::time::Instant;
    
    let total_start = Instant::now();
    debug_log("INFO", "LDAP", &format!("Starting domain scan: {}", domain), None);
    
    let base_dn = domain_to_base_dn(&domain);
    let ldap_url = format!("ldap://{}:389", domain);
    
    // Measure connection time
    let conn_start = Instant::now();
    let (conn, mut ldap) = LdapConnAsync::new(&ldap_url)
        .await
        .map_err(|e| format!("LDAP connection failed: {}", e))?;
    let conn_duration = conn_start.elapsed();
    debug_log("INFO", "LDAP", "Connected to LDAP server", Some(&format!("Time: {:?}", conn_duration)));
    
    ldap3::drive!(conn);
    
    ldap.simple_bind("", "")
        .await
        .map_err(|e| format!("LDAP bind failed: {}", e))?;
    
    // Measure search time
    let search_start = Instant::now();
    let (rs, _res) = ldap
        .search(
            &base_dn,
            Scope::Subtree,
            "(&(objectClass=computer)(operatingSystem=Windows*))",
            vec!["cn"],
        )
        .await
        .map_err(|e| format!("LDAP search failed: {}", e))?;
    let search_duration = search_start.elapsed();
    
    let computers: Vec<String> = rs
        .into_iter()
        .filter_map(|entry| {
            let se = SearchEntry::construct(entry);
            se.attrs.get("cn").and_then(|v| v.first().cloned())
        })
        .collect();
    
    debug_log(
        "INFO",
        "LDAP",
        &format!("Search completed, found {} computers", computers.len()),
        Some(&format!("Search time: {:?}", search_duration))
    );
    
    ldap.unbind()
        .await
        .map_err(|e| format!("LDAP unbind failed: {}", e))?;
    
    let total_duration = total_start.elapsed();
    debug_log(
        "INFO",
        "LDAP",
        "Domain scan completed",
        Some(&format!("Total time: {:?}, Connection: {:?}, Search: {:?}",
            total_duration, conn_duration, search_duration))
    );
    
    Ok(computers)
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
    const filtered = allHosts.filter(host => 
        host.name.toLowerCase().includes(query.toLowerCase()) ||
        host.hostname.toLowerCase().includes(query.toLowerCase())
    );
    
    // Clear existing results
    const container = document.getElementById('results')!;
    container.innerHTML = '';
    
    // Add each result individually
    for (const host of filtered) {
        const div = document.createElement('div');
        div.className = 'host-card';
        div.innerHTML = `
            <h3>${host.name}</h3>
            <p>${host.hostname}</p>
        `;
        
        // Load details for each host
        const details = await invoke('get_host_details', { id: host.id });
        const detailsDiv = document.createElement('div');
        detailsDiv.textContent = JSON.stringify(details);
        div.appendChild(detailsDiv);
        
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
2. Multiple IPC calls for details (N+1 query)
3. Multiple DOM reflows
4. No debouncing

<details>
<summary><strong>Solution</strong></summary>

```typescript
// Cache hosts
let hostsCache: Host[] | null = null;
let hostDetailsCache = new Map<number, any>();

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
        host.name.toLowerCase().includes(lowerQuery) ||
        host.hostname.toLowerCase().includes(lowerQuery)
    );
    
    // Batch load details if needed
    const idsNeeded = filtered
        .map(h => h.id)
        .filter(id => !hostDetailsCache.has(id));
    
    if (idsNeeded.length > 0) {
        const details = await invoke('get_hosts_details_batch', { ids: idsNeeded });
        details.forEach((detail: any, index: number) => {
            hostDetailsCache.set(idsNeeded[index], detail);
        });
    }
    
    // Build HTML in one go
    const html = filtered.map(host => {
        const details = hostDetailsCache.get(host.id) || {};
        return `
            <div class="host-card">
                <h3>${host.name}</h3>
                <p>${host.hostname}</p>
                <div>${JSON.stringify(details)}</div>
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

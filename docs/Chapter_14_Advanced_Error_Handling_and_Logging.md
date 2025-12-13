# Chapter 14: Advanced Error Handling and Logging

## Introduction

Building robust desktop applications requires more than just making features work—you need comprehensive error handling and logging systems to diagnose issues in production environments. When users encounter problems, detailed logs become invaluable for troubleshooting.

In this chapter, we'll explore QuickConnect's sophisticated error handling and logging system, including:
- Custom error types and propagation patterns
- A centralized error display window
- Conditional debug logging system
- Context-aware error messages with troubleshooting guides
- Command-line argument parsing for debug mode
- Production vs development logging strategies

---

## 14.1 Error Handling Philosophy

### The QuickConnect Approach

QuickConnect follows a **user-first error handling philosophy**:

1. **User-Friendly Messages**: Errors shown to users are clear and actionable
2. **Detailed Logging**: Technical details are logged for developers
3. **Graceful Degradation**: Non-critical errors don't crash the application
4. **Contextual Help**: Error messages include troubleshooting steps
5. **Opt-In Debugging**: Detailed logging is disabled by default for performance

### Error Categories

QuickConnect organizes errors into categories:

| Category | Description | Examples |
|----------|-------------|----------|
| `CREDENTIALS` | Credential Manager operations | Save/retrieve failures |
| `RDP_LAUNCH` | RDP connection operations | File creation, process launch |
| `LDAP_*` | Active Directory operations | Connection, bind, search |
| `CSV_OPERATIONS` | File I/O operations | Read/write hosts.csv |
| `WINDOW` | Window management | Show/hide, focus |
| `SYSTEM` | System-level operations | Initialization, shutdown |

---

## 14.2 The Result<T, E> Pattern

Rust's `Result` type is the foundation of error handling. Let's see how QuickConnect uses it.

### Basic Result Usage

```rust
#[tauri::command]
async fn save_credentials(credentials: Credentials) -> Result<(), String> {
    // Validation
    if credentials.username.is_empty() {
        return Err("Username cannot be empty".to_string());
    }
    
    // Operation that might fail
    unsafe {
        match CredWriteW(&cred, 0) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to save credentials: {:?}", e)),
        }
    }
}
```

**Key Points:**
- Return `Result<T, E>` where `T` is success type, `E` is error type
- Use `String` for error type (serializable to frontend)
- Return early with `Err(...)` for validation failures
- Convert API errors to descriptive strings

### The ? Operator

The `?` operator simplifies error propagation:

```rust
#[tauri::command]
async fn launch_rdp(host: Host) -> Result<(), String> {
    // ? automatically returns Err if function fails
    let credentials = get_stored_credentials().await?
        .ok_or("No credentials found")?;
    
    // Multiple operations with ?
    let appdata_dir = std::env::var("APPDATA")
        .map_err(|_| "Failed to get APPDATA directory")?;
    
    std::fs::create_dir_all(&connections_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    Ok(())
}
```

**The ? Operator:**
- If `Result` is `Ok(value)`, extracts `value`
- If `Result` is `Err(e)`, immediately returns the error
- Requires return type to be compatible `Result`

### Converting Error Types

Different error types need conversion:

```rust
use std::io;
use std::env;

fn example() -> Result<(), String> {
    // std::io::Error → String
    std::fs::write("file.txt", "content")
        .map_err(|e| format!("Write failed: {}", e))?;
    
    // VarError → String  
    let path = std::env::var("APPDATA")
        .map_err(|_| "APPDATA not found".to_string())?;
    
    // Windows API Error → String
    CredWriteW(&cred, 0)
        .map_err(|e| format!("Credential write failed: {:?}", e))?;
    
    Ok(())
}
```

---

## 14.3 Centralized Error Display System

QuickConnect uses a dedicated **error window** to display errors to users.

### The ErrorPayload Structure

```rust
#[derive(Clone, serde::Serialize)]
struct ErrorPayload {
    message: String,        // User-friendly message
    timestamp: String,      // When error occurred
    category: Option<String>,   // Error category
    details: Option<String>,    // Technical details (optional)
}
```

### The show_error Command

```rust
#[tauri::command]
fn show_error(
    app_handle: tauri::AppHandle,
    message: String,
    category: Option<String>,
    details: Option<String>,
) -> Result<(), String> {
    use chrono::Local;
    
    // Add timestamp
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let payload = ErrorPayload {
        message,
        timestamp,
        category,
        details,
    };
    
    // Log the error
    debug_log(
        "INFO",
        "ERROR_WINDOW",
        &format!("Showing error in error window: {}", payload.message),
        payload.details.as_deref(),
    );
    
    // Emit event to error window
    if let Some(error_window) = app_handle.get_webview_window("error") {
        let _ = error_window.emit("show-error", &payload);
        
        // Show and focus the window
        error_window.show().map_err(|e| e.to_string())?;
        error_window.unminimize().map_err(|e| e.to_string())?;
        error_window.set_focus().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

### Using show_error from Other Commands

```rust
#[tauri::command]
async fn scan_domain(
    app_handle: tauri::AppHandle,
    domain: String,
) -> Result<String, String> {
    match perform_ldap_scan(&domain).await {
        Ok(result) => Ok(result),
        Err(e) => {
            // Show error window
            let _ = show_error(
                app_handle,
                format!("Failed to scan domain: {}", e),
                Some("LDAP_SCAN".to_string()),
                Some(format!("Domain: {}", domain)),
            );
            Err(e)
        }
    }
}
```

### Frontend Error Display

The error window listens for the event:

```typescript
// error.ts
import { listen } from '@tauri-apps/api/event';

interface ErrorPayload {
    message: string;
    timestamp: string;
    category?: string;
    details?: string;
}

// Listen for error events
listen<ErrorPayload>('show-error', (event) => {
    const error = event.payload;
    
    // Update UI
    document.getElementById('error-message')!.textContent = error.message;
    document.getElementById('error-timestamp')!.textContent = error.timestamp;
    
    if (error.category) {
        document.getElementById('error-category')!.textContent = error.category;
    }
    
    if (error.details) {
        document.getElementById('error-details')!.textContent = error.details;
        document.getElementById('details-section')!.style.display = 'block';
    }
});
```

**Benefits:**
- ✅ Centralized error display
- ✅ Consistent user experience
- ✅ Error history tracking
- ✅ Technical details available but not overwhelming

---

## 14.4 Debug Logging System

QuickConnect implements a comprehensive debug logging system that's **disabled by default** for performance but can be enabled with a command-line flag.

### Debug Mode State

```rust
use std::sync::Mutex;

// Global debug mode flag
static DEBUG_MODE: Mutex<bool> = Mutex::new(false);

fn set_debug_mode(enabled: bool) {
    if let Ok(mut flag) = DEBUG_MODE.lock() {
        *flag = enabled;
    }
}
```

### The debug_log Function

```rust
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

fn debug_log(
    level: &str,         // INFO, WARN, ERROR, DEBUG
    category: &str,      // Category like "CREDENTIALS", "RDP_LAUNCH"
    message: &str,       // Main message
    error_details: Option<&str>,  // Optional technical details
) {
    // Check if debug mode is enabled
    let debug_enabled = DEBUG_MODE.lock().map(|flag| *flag).unwrap_or(false);
    
    if !debug_enabled {
        return;  // Early exit if debug is off
    }

    // Determine log file location
    let log_file = if let Ok(appdata_dir) = std::env::var("APPDATA") {
        let QuickConnect_dir = PathBuf::from(appdata_dir).join("QuickConnect");
        let _ = std::fs::create_dir_all(&QuickConnect_dir);
        QuickConnect_dir.join("QuickConnect_Debug.log")
    } else {
        PathBuf::from("QuickConnect_Debug.log")
    };

    // Check if this is a new file
    let is_new_file = !log_file.exists();

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file) 
    {
        // Write header for new files
        if is_new_file {
            let _ = writeln!(file, "{}", "=".repeat(80));
            let _ = writeln!(file, "QuickConnect Debug Log");
            let _ = writeln!(file, "{}", "=".repeat(80));
            let _ = writeln!(file, "This file contains detailed application logs.");
            let _ = writeln!(file, "To enable: QuickConnect.exe --debug");
            let _ = writeln!(file, "");
            let _ = writeln!(file, "Log Levels:");
            let _ = writeln!(file, "  - INFO:  General information");
            let _ = writeln!(file, "  - WARN:  Warning messages");
            let _ = writeln!(file, "  - ERROR: Error messages");
            let _ = writeln!(file, "  - DEBUG: Debug information");
            let _ = writeln!(file, "{}", "=".repeat(80));
            let _ = writeln!(file, "");
        }

        // Format timestamp
        use chrono::Local;
        let timestamp = Local::now()
            .format("%Y-%m-%d %H:%M:%S%.3f")
            .to_string();

        // Level indicator
        let level_indicator = match level {
            "ERROR" => "[!]",
            "WARN"  => "[*]",
            "INFO"  => "[i]",
            "DEBUG" => "[d]",
            _       => "[?]",
        };

        // Build log entry
        let mut log_entry = format!(
            "\n{} {} [{:8}] [{}]\n",
            timestamp, level_indicator, level, category
        );
        log_entry.push_str(&format!("Message: {}\n", message));

        if let Some(details) = error_details {
            log_entry.push_str(&format!("Details: {}\n", details));
        }

        // Add context based on category
        match category {
            "RDP_LAUNCH" => {
                if let Ok(appdata_dir) = std::env::var("APPDATA") {
                    let connections_dir = PathBuf::from(appdata_dir)
                        .join("QuickConnect")
                        .join("Connections");
                    log_entry.push_str(&format!(
                        "RDP Files Directory: {:?}\n",
                        connections_dir
                    ));
                }
            }
            "CREDENTIALS" => {
                log_entry.push_str("Credential Storage: Windows Credential Manager\n");
            }
            "LDAP_CONNECTION" | "LDAP_BIND" | "LDAP_SEARCH" => {
                log_entry.push_str("LDAP Port: 389\n");
            }
            _ => {}
        }

        log_entry.push_str(&format!("{}\n", "-".repeat(80)));

        let _ = write!(file, "{}", log_entry);
    }
}
```

### Using debug_log

```rust
#[tauri::command]
async fn launch_rdp(host: Host) -> Result<(), String> {
    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!("Starting RDP launch for host: {}", host.hostname),
        None,
    );

    // Perform operation
    match create_rdp_file(&host) {
        Ok(path) => {
            debug_log(
                "INFO",
                "RDP_LAUNCH",
                "RDP file created successfully",
                Some(&format!("Path: {:?}", path)),
            );
        }
        Err(e) => {
            debug_log(
                "ERROR",
                "RDP_LAUNCH",
                "Failed to create RDP file",
                Some(&format!("Error: {}", e)),
            );
            return Err(e);
        }
    }
    
    Ok(())
}
```

---

## 14.5 Command-Line Debug Mode

QuickConnect enables debug logging via command-line arguments.

### Parsing Command-Line Arguments

```rust
pub fn run() {
    // Get command-line arguments
    let args: Vec<String> = std::env::args().collect();
    
    // Check for --debug flag
    let debug_enabled = args
        .iter()
        .any(|arg| arg == "--debug" || arg == "--debug-log");

    if debug_enabled {
        eprintln!("[QuickConnect] Debug mode enabled");
        eprintln!("[QuickConnect] Args: {:?}", args);

        // Show log file location
        if let Ok(appdata_dir) = std::env::var("APPDATA") {
            let log_file = PathBuf::from(appdata_dir)
                .join("QuickConnect")
                .join("QuickConnect_Debug.log");
            eprintln!("[QuickConnect] Log file: {:?}", log_file);
        }

        // Enable debug mode
        set_debug_mode(true);
        
        // Log startup information
        debug_log(
            "INFO",
            "SYSTEM",
            "Debug logging enabled via command line argument",
            Some(&format!("Arguments: {:?}", args)),
        );
        
        debug_log(
            "INFO",
            "SYSTEM",
            &format!("Application version: {}", env!("CARGO_PKG_VERSION")),
            None,
        );
        
        debug_log(
            "INFO",
            "SYSTEM",
            &format!("Operating System: {}", std::env::consts::OS),
            Some(&format!("Architecture: {}", std::env::consts::ARCH)),
        );
    } else {
        eprintln!("[QuickConnect] Starting without debug mode.");
        eprintln!("[QuickConnect] Use --debug to enable logging.");
    }

    // Continue with Tauri setup...
    tauri::Builder::default()
        // ...
}
```

### Running with Debug Mode

```powershell
# Windows
.\QuickConnect.exe --debug

# Or
.\QuickConnect.exe --debug-log
```

**Output:**
```
[QuickConnect] Debug mode enabled
[QuickConnect] Args: ["QuickConnect.exe", "--debug"]
[QuickConnect] Log file: "C:\\Users\\Username\\AppData\\Roaming\\QuickConnect\\QuickConnect_Debug.log"
[QuickConnect] Debug log initialized
```

---

## 14.6 Context-Aware Error Messages

QuickConnect provides detailed troubleshooting information for errors.

### Troubleshooting Guide System

```rust
fn debug_log(level: &str, category: &str, message: &str, error_details: Option<&str>) {
    // ... (timestamp, formatting code) ...
    
    // Add troubleshooting for errors
    if level == "ERROR" {
        log_entry.push_str("\nPossible Causes:\n");
        
        match category {
            "LDAP_CONNECTION" => {
                log_entry.push_str("  • LDAP server is not reachable\n");
                log_entry.push_str("  • Port 389 is blocked by firewall\n");
                log_entry.push_str("  • Network connectivity issues\n");
                log_entry.push_str("  • DNS resolution failure\n");
                log_entry.push_str("\nTroubleshooting Steps:\n");
                log_entry.push_str("  1. Verify server name is correct\n");
                log_entry.push_str("  2. Test connectivity: ping <server>\n");
                log_entry.push_str("  3. Check firewall rules for port 389\n");
                log_entry.push_str("  4. Verify DNS: nslookup <server>\n");
            }
            "CREDENTIALS" => {
                log_entry.push_str("  • Windows Credential Manager access denied\n");
                log_entry.push_str("  • Credential storage is corrupted\n");
                log_entry.push_str("  • Insufficient permissions\n");
                log_entry.push_str("\nTroubleshooting Steps:\n");
                log_entry.push_str("  1. Run application as administrator\n");
                log_entry.push_str("  2. Check Windows Credential Manager\n");
                log_entry.push_str("  3. Try removing and re-adding credentials\n");
            }
            "RDP_LAUNCH" => {
                log_entry.push_str("  • mstsc.exe is not available or corrupted\n");
                log_entry.push_str("  • RDP file creation failed\n");
                log_entry.push_str("  • Directory is not accessible\n");
                log_entry.push_str("\nTroubleshooting Steps:\n");
                log_entry.push_str("  1. Verify mstsc.exe exists in System32\n");
                log_entry.push_str("  2. Check disk space in AppData folder\n");
                log_entry.push_str("  3. Verify file permissions\n");
                log_entry.push_str("  4. Try running as administrator\n");
            }
            _ => {
                log_entry.push_str("  • Check system event logs\n");
                log_entry.push_str("  • Verify application permissions\n");
                log_entry.push_str("  • Try running as administrator\n");
            }
        }
    }
    
    // Add warnings context
    if level == "WARN" {
        log_entry.push_str("\nRecommendation: This warning may not prevent ");
        log_entry.push_str("operation but should be investigated.\n");
    }
    
    // Write to file...
}
```

### Example Log Output

```
2025-11-23 14:32:15.123 [!] [ERROR   ] [LDAP_CONNECTION]
Message: Failed to connect to LDAP server dc01.company.com
Details: Connection timeout after 30 seconds
LDAP Port: 389

Possible Causes:
  • LDAP server is not reachable or incorrect server name
  • Port 389 is blocked by firewall
  • Network connectivity issues
  • DNS resolution failure for server name

Troubleshooting Steps:
  1. Verify server name is correct
  2. Test network connectivity: ping dc01.company.com
  3. Check firewall rules for port 389
  4. Verify DNS resolution: nslookup dc01.company.com
--------------------------------------------------------------------------------
```

---

## 14.7 Error Propagation Patterns

### Pattern 1: Early Return

```rust
fn validate_and_process(host: &Host) -> Result<(), String> {
    // Validate early, fail fast
    if host.hostname.is_empty() {
        return Err("Hostname cannot be empty".to_string());
    }
    
    if !host.hostname.contains('.') {
        return Err("Hostname must be fully qualified".to_string());
    }
    
    // Continue with processing
    process_host(host)?;
    Ok(())
}
```

### Pattern 2: Error Context

```rust
fn read_config_file(path: &Path) -> Result<Config, String> {
    let contents = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read config from {:?}: {}", path, e))?;
    
    let config: Config = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse config: {}", e))?;
    
    Ok(config)
}
```

### Pattern 3: Graceful Degradation

```rust
#[tauri::command]
async fn launch_rdp(host: Host) -> Result<(), String> {
    // Critical operation - must succeed
    let credentials = get_credentials().await?;
    
    // Non-critical operation - log but don't fail
    if let Err(e) = save_to_recent(&host) {
        debug_log(
            "WARN",
            "RDP_LAUNCH",
            "Failed to update recent connections",
            Some(&e),
        );
        // Don't return error - continue with RDP launch
    }
    
    // Continue with critical operations
    launch_rdp_process(&host, &credentials)?;
    Ok(())
}
```

### Pattern 4: Retry Logic

```rust
async fn connect_with_retry(url: &str, max_retries: u32) -> Result<Connection, String> {
    let mut last_error = String::new();
    
    for attempt in 1..=max_retries {
        debug_log(
            "INFO",
            "CONNECTION",
            &format!("Connection attempt {} of {}", attempt, max_retries),
            None,
        );
        
        match try_connect(url).await {
            Ok(conn) => return Ok(conn),
            Err(e) => {
                last_error = e.clone();
                debug_log("WARN", "CONNECTION", "Connection failed", Some(&e));
                
                if attempt < max_retries {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                }
            }
        }
    }
    
    Err(format!("Failed after {} attempts: {}", max_retries, last_error))
}
```

---

## 14.8 Logging Best Practices

### 1. Log Levels Usage

```rust
// DEBUG - Detailed information for diagnosing problems
debug_log("DEBUG", "WINDOW", "Window state changed", Some("visible -> hidden"));

// INFO - General informational messages
debug_log("INFO", "RDP_LAUNCH", "RDP connection initiated", None);

// WARN - Potentially harmful situations that don't prevent operation
debug_log("WARN", "CSV_OPERATIONS", "File locked, retrying", None);

// ERROR - Error events that might still allow operation to continue
debug_log("ERROR", "CREDENTIALS", "Failed to save credentials", Some(&err));
```

### 2. Never Log Sensitive Data

```rust
// ❌ NEVER DO THIS
debug_log("INFO", "CREDENTIALS", &format!("Password: {}", password), None);

// ✅ DO THIS
debug_log(
    "INFO",
    "CREDENTIALS",
    &format!("Password length: {} characters", password.len()),
    None,
);

// ✅ ALSO GOOD
debug_log(
    "INFO",
    "CREDENTIALS",
    &format!("Username: {}", username),
    Some("Password provided (not logged)"),
);
```

### 3. Contextual Information

```rust
debug_log(
    "INFO",
    "RDP_LAUNCH",
    &format!("Launching RDP to {}", hostname),
    Some(&format!(
        "Username: {}, Protocol: RDP, Port: 3389",
        username
    )),
);
```

### 4. Consistent Categories

Define categories as constants:

```rust
// At module level
const CAT_CREDENTIALS: &str = "CREDENTIALS";
const CAT_RDP_LAUNCH: &str = "RDP_LAUNCH";
const CAT_LDAP_CONNECTION: &str = "LDAP_CONNECTION";

// Usage
debug_log("INFO", CAT_RDP_LAUNCH, "Starting RDP", None);
```

### 5. Performance Considerations

```rust
// ✅ Check debug mode before expensive operations
if DEBUG_MODE.lock().map(|f| *f).unwrap_or(false) {
    let detailed_info = expensive_operation();
    debug_log("DEBUG", "SYSTEM", "Details", Some(&detailed_info));
}

// ❌ Don't do expensive work if debug is off
debug_log(
    "DEBUG",
    "SYSTEM",
    "Details",
    Some(&expensive_operation()),  // Always runs!
);
```

---

## 14.9 Production vs Development Logging

### Development Configuration

```rust
// In development, you might enable debug by default
#[cfg(debug_assertions)]
fn initialize_logging() {
    set_debug_mode(true);
    debug_log("INFO", "SYSTEM", "Development mode - debug enabled", None);
}

#[cfg(not(debug_assertions))]
fn initialize_logging() {
    // Production - debug disabled by default
    debug_log("INFO", "SYSTEM", "Production mode - debug disabled", None);
}
```

### Conditional Compilation

```rust
// Debug-only code
#[cfg(debug_assertions)]
fn log_detailed_state(state: &AppState) {
    debug_log(
        "DEBUG",
        "STATE",
        "Application state",
        Some(&format!("{:#?}", state)),
    );
}

#[cfg(not(debug_assertions))]
fn log_detailed_state(_state: &AppState) {
    // No-op in production
}
```

### Release Optimization

In `Cargo.toml`:

```toml
[profile.release]
opt-level = 3
lto = true
strip = true  # Remove debug symbols
```

This removes debug symbols but **doesn't disable debug_log**—users can still opt-in with `--debug`.

---

## 14.10 Real-World Example: LDAP Scan

Let's see comprehensive error handling in action:

```rust
async fn scan_domain_ldap(domain: String, server: String) -> Result<String, String> {
    // Log start
    debug_log(
        "INFO",
        "LDAP_SCAN",
        &format!("Starting LDAP scan for domain: {} on server: {}", domain, server),
        Some(&format!("Domain: {}, Server: {}", domain, server)),
    );

    // Validate inputs
    if domain.is_empty() {
        let error = "Domain name is empty";
        debug_log(
            "ERROR",
            "LDAP_SCAN",
            error,
            Some("Domain parameter was empty or whitespace"),
        );
        return Err(error.to_string());
    }

    if server.is_empty() {
        let error = "Server name is empty";
        debug_log(
            "ERROR",
            "LDAP_SCAN",
            error,
            Some("Server parameter was empty or whitespace"),
        );
        return Err(error.to_string());
    }

    // Build LDAP URL
    let ldap_url = format!("ldap://{}:389", server);
    debug_log(
        "INFO",
        "LDAP_CONNECTION",
        &format!("Attempting to connect to: {}", ldap_url),
        None,
    );

    // Connect
    let (conn, mut ldap) = match LdapConnAsync::new(&ldap_url).await {
        Ok(conn) => {
            debug_log(
                "INFO",
                "LDAP_CONNECTION",
                "LDAP connection established successfully",
                None,
            );
            conn
        }
        Err(e) => {
            let error_msg = format!("Failed to connect to LDAP server {}: {}", server, e);
            debug_log(
                "ERROR",
                "LDAP_CONNECTION",
                &error_msg,
                Some(&format!("Connection error: {:?}. Check if server is reachable.", e)),
            );
            return Err(error_msg);
        }
    };

    ldap3::drive!(conn);

    // Get credentials
    debug_log(
        "INFO",
        "LDAP_BIND",
        "Retrieving stored credentials for LDAP authentication",
        None,
    );

    let credentials = match get_stored_credentials().await {
        Ok(Some(creds)) => {
            debug_log(
                "INFO",
                "CREDENTIALS",
                &format!(
                    "Retrieved credentials: username={}, password_len={}",
                    creds.username,
                    creds.password.len()
                ),
                None,
            );
            creds
        }
        Ok(None) => {
            let error = "No stored credentials found. Please save credentials first.";
            debug_log(
                "ERROR",
                "CREDENTIALS",
                error,
                Some("No credentials in Windows Credential Manager"),
            );
            return Err(error.to_string());
        }
        Err(e) => {
            let error = format!("Failed to retrieve credentials: {}", e);
            debug_log(
                "ERROR",
                "CREDENTIALS",
                &error,
                Some(&format!("Credential retrieval error: {:?}", e)),
            );
            return Err(error);
        }
    };

    // Bind
    let bind_dn = format!("{}@{}", credentials.username, domain);
    debug_log(
        "INFO",
        "LDAP_BIND",
        &format!("Attempting authenticated LDAP bind with username: {}", bind_dn),
        None,
    );

    match ldap.simple_bind(&bind_dn, &credentials.password).await {
        Ok(_) => {
            debug_log("INFO", "LDAP_BIND", "LDAP bind successful", None);
        }
        Err(e) => {
            let error = format!(
                "LDAP bind failed: {}. Please verify credentials have AD query permissions.",
                e
            );
            debug_log(
                "ERROR",
                "LDAP_BIND",
                &error,
                Some(&format!("Bind error: {:?}. Check username/password.", e)),
            );
            return Err(error);
        }
    }

    // Search
    let base_dn = domain
        .split('.')
        .map(|part| format!("DC={}", part))
        .collect::<Vec<String>>()
        .join(",");

    debug_log(
        "INFO",
        "LDAP_SEARCH",
        &format!("Searching base DN: {}", base_dn),
        None,
    );

    let filter = "(&(objectClass=computer)(operatingSystem=Windows Server*))";
    let attrs = vec!["dNSHostName", "description"];

    let (rs, _) = match ldap.search(&base_dn, Scope::Subtree, filter, attrs).await {
        Ok(result) => match result.success() {
            Ok(search_result) => {
                debug_log(
                    "INFO",
                    "LDAP_SEARCH",
                    &format!("LDAP search completed, found {} entries", search_result.0.len()),
                    None,
                );
                search_result
            }
            Err(e) => {
                let error = format!("LDAP search failed: {}", e);
                debug_log("ERROR", "LDAP_SEARCH", &error, Some(&format!("{:?}", e)));
                return Err(error);
            }
        },
        Err(e) => {
            let error = format!("Failed to execute LDAP search: {}", e);
            debug_log("ERROR", "LDAP_SEARCH", &error, Some(&format!("{:?}", e)));
            return Err(error);
        }
    };

    // Parse results
    let mut hosts = Vec::new();
    for entry in rs {
        let search_entry = SearchEntry::construct(entry);
        if let Some(hostname) = search_entry.attrs.get("dNSHostName").and_then(|v| v.first()) {
            let description = search_entry
                .attrs
                .get("description")
                .and_then(|v| v.first())
                .cloned()
                .unwrap_or_default();

            debug_log(
                "INFO",
                "LDAP_SEARCH",
                &format!("Found host: {} - {}", hostname, description),
                None,
            );

            hosts.push(Host {
                hostname: hostname.to_string(),
                description,
                last_connected: None,
            });
        }
    }

    let _ = ldap.unbind().await;
    debug_log("INFO", "LDAP_CONNECTION", "LDAP connection closed", None);

    if hosts.is_empty() {
        let error = "No Windows Servers found in the domain.";
        debug_log(
            "ERROR",
            "LDAP_SEARCH",
            error,
            Some("Search completed but no hosts matched filter"),
        );
        return Err(error.to_string());
    }

    debug_log(
        "INFO",
        "LDAP_SCAN",
        &format!("Successfully completed scan, found {} hosts", hosts.len()),
        None,
    );

    Ok(format!("Successfully found {} Windows Server(s).", hosts.len()))
}
```

**This example demonstrates:**
- ✅ Validation at entry point
- ✅ Detailed logging at each step
- ✅ Error context with troubleshooting info
- ✅ Graceful error propagation
- ✅ Success logging
- ✅ Resource cleanup (LDAP unbind)

---

## 14.11 Testing Error Handling

### Manual Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_empty_hostname_error() {
        let result = validate_hostname("").await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Hostname cannot be empty");
    }

    #[tokio::test]
    async fn test_credential_not_found() {
        // Clear credentials first
        let _ = delete_credentials().await;
        
        let result = get_stored_credentials().await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }
}
```

### Integration Testing

```rust
#[tokio::test]
async fn test_rdp_launch_flow() {
    // Enable debug mode for test
    set_debug_mode(true);
    
    // Setup test data
    let host = Host {
        hostname: "test-server.local".to_string(),
        description: "Test Server".to_string(),
        last_connected: None,
    };
    
    let creds = Credentials {
        username: "testuser".to_string(),
        password: "testpass".to_string(),
    };
    
    // Test credential save
    let save_result = save_credentials(creds).await;
    assert!(save_result.is_ok());
    
    // Test RDP launch (will fail if no mstsc, but tests error handling)
    let launch_result = launch_rdp(host).await;
    // Either succeeds or returns descriptive error
    match launch_result {
        Ok(_) => println!("RDP launched successfully"),
        Err(e) => println!("Expected error: {}", e),
    }
    
    // Cleanup
    let _ = delete_credentials().await;
}
```

---

## 14.12 Key Takeaways

### Error Handling Principles

1. **Use Result<T, E>** for all fallible operations
2. **Validate early** - fail fast on invalid input
3. **Provide context** - explain what went wrong and why
4. **Log comprehensively** - but only when debug mode is enabled
5. **Graceful degradation** - non-critical errors shouldn't crash the app
6. **User-friendly messages** - technical details in logs, clear messages to users

### Logging Best Practices

1. **Conditional logging** - disabled by default, enabled via `--debug`
2. **Structured logs** - timestamp, level, category, message, details
3. **Security first** - never log passwords or sensitive data
4. **Context-aware** - include troubleshooting steps for errors
5. **Performance conscious** - early exit if debug is off
6. **Persistent storage** - logs saved to AppData for later analysis

### Production Checklist

- ✅ All `Result` types have descriptive error messages
- ✅ Critical operations have comprehensive logging
- ✅ No passwords or sensitive data in logs
- ✅ Error window shows user-friendly messages
- ✅ Debug mode can be enabled via `--debug` flag
- ✅ Log file location is documented
- ✅ Troubleshooting guides included in error logs
- ✅ Non-critical errors don't stop execution
- ✅ Resource cleanup happens even on errors
- ✅ Tests verify error handling paths

---

## 14.13 Practice Exercises

### Exercise 1: Custom Error Type

Create a custom error type for your application:

```rust
#[derive(Debug)]
pub enum AppError {
    CredentialError(String),
    NetworkError(String),
    FileError(std::io::Error),
    ValidationError(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            AppError::CredentialError(msg) => write!(f, "Credential error: {}", msg),
            AppError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            AppError::FileError(e) => write!(f, "File error: {}", e),
            AppError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

// Implement conversions
impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::FileError(e)
    }
}
```

Convert QuickConnect commands to use this custom error type.

### Exercise 2: Structured Logging

Implement a structured logging system using JSON:

```rust
#[derive(serde::Serialize)]
struct LogEntry {
    timestamp: String,
    level: String,
    category: String,
    message: String,
    details: Option<String>,
    context: HashMap<String, String>,
}
```

Write logs in JSON format for easier parsing and analysis.

### Exercise 3: Error Recovery

Implement automatic error recovery:

```rust
async fn connect_with_exponential_backoff(
    url: &str,
    max_retries: u32,
) -> Result<Connection, String> {
    // Implement exponential backoff: 1s, 2s, 4s, 8s, etc.
    // Log each attempt
    // Return success or final error
}
```

### Exercise 4: Log Analyzer

Create a command-line tool that analyzes QuickConnect_Debug.log:

- Count errors by category
- Show error timeline
- Extract most common errors
- Generate summary report

---

## 14.14 Further Reading

### Rust Error Handling
- [The Rust Programming Language - Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
- [Error Handling in Rust (Blog)](https://blog.burntsushi.net/rust-error-handling/)
- [anyhow Crate](https://docs.rs/anyhow/) - Flexible error handling
- [thiserror Crate](https://docs.rs/thiserror/) - Custom error types

### Logging
- [log Crate](https://docs.rs/log/) - Standard logging facade
- [env_logger Crate](https://docs.rs/env_logger/) - Environment-based logging
- [tracing Crate](https://docs.rs/tracing/) - Structured, async-aware logging

### Best Practices
- [Rust API Guidelines - Error Handling](https://rust-lang.github.io/api-guidelines/type-safety.html#error-types)
- [Error Handling in Production Rust](https://doc.rust-lang.org/stable/book/ch09-00-error-handling.html)

---

## Summary

In this chapter, we explored QuickConnect's comprehensive error handling and logging system:

- Using `Result<T, E>` for fallible operations
- The `?` operator for error propagation
- Centralized error display with a dedicated error window
- Conditional debug logging system (disabled by default)
- Command-line argument parsing for `--debug` mode
- Context-aware error messages with troubleshooting guides
- Best practices for production-ready error handling
- Security considerations (never log sensitive data)
- Testing strategies for error paths

A robust error handling and logging system is essential for production applications. It helps you diagnose issues quickly, provides users with clear feedback, and enables continuous improvement through detailed analysis of real-world usage patterns.

In the next chapter, we'll explore **System Tray Integration**, learning how to create system tray icons, menus, and background operation for QuickConnect.

---

**Chapter 14 Complete** | **Next**: Chapter 15 - System Tray Integration


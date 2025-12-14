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

## 14.2 The AppError Type and thiserror

QuickConnect uses a **centralized error type** called `AppError` defined in [src-tauri/src/errors.rs](../src-tauri/src/errors.rs). This provides structured error handling with context.

### The AppError Enum with thiserror

Instead of using plain strings, QuickConnect defines specific error variants:

```rust
//! src-tauri/src/errors.rs
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    /// Credentials not found in Windows Credential Manager
    #[error("Credentials not found for target: {target}")]
    CredentialsNotFound { target: String },

    /// Failed to access Windows Credential Manager
    #[error("Windows Credential Manager error: {operation}")]
    CredentialManagerError {
        operation: String,
        #[source]
        source: Option<anyhow::Error>,
    },

    /// Invalid hostname format
    #[error("Invalid hostname '{hostname}': {reason}")]
    InvalidHostname { hostname: String, reason: String },

    /// CSV file operation failed
    #[error("CSV operation failed: {operation}")]
    CsvError {
        operation: String,
        #[source]
        source: csv::Error,
    },

    // ... 17 total variants
}
```

**Benefits of thiserror:**
- ✅ Automatic `Display` and `Error` trait implementations
- ✅ `#[source]` attribute for error chaining
- ✅ Contextual information in each variant
- ✅ Type-safe error matching
- ✅ User-friendly error messages via `#[error(...)]`

### The ? Operator with AppError

The `?` operator automatically propagates errors. With `AppError`, you get rich context:

```rust
// src-tauri/src/core/rdp_launcher.rs
use crate::AppError;

pub async fn launch_rdp_connection(
    hostname: &str,
    credentials: &Credentials,
) -> Result<(), AppError> {
    // ? automatically returns AppError variants
    let rdp_file_path = create_rdp_file(hostname, credentials)?;
    
    // Launch mstsc.exe
    std::process::Command::new("mstsc.exe")
        .arg(&rdp_file_path)
        .spawn()
        .map_err(|e| AppError::RdpLaunchError { source: e })?;
    
    Ok(())
}
```

**The ? Operator:**
- If `Result` is `Ok(value)`, extracts `value`
- If `Result` is `Err(e)`, immediately returns the error
- Works seamlessly with `AppError` variants
- Use `.map_err(|e| AppError::Variant { ... })` to convert external errors

### Trait-Based Error Handling

QuickConnect uses **trait abstractions** to isolate unsafe code and provide clean error boundaries:

```rust
// src-tauri/src/adapters/windows/credential_manager.rs

/// Trait for credential storage operations
pub trait CredentialManager: Send + Sync {
    fn save(&self, target: &str, username: &str, password: &str) 
        -> Result<(), AppError>;
    
    fn read(&self, target: &str) 
        -> Result<Option<(String, String)>, AppError>;
    
    fn delete(&self, target: &str) 
        -> Result<(), AppError>;
}

/// Windows implementation with unsafe code isolated
pub struct WindowsCredentialManager;

impl CredentialManager for WindowsCredentialManager {
    fn save(&self, target: &str, username: &str, password: &str) 
        -> Result<(), AppError> {
        unsafe {
            // Unsafe Windows API call isolated here
            CredWriteW(&cred, 0)
                .map_err(|e| AppError::CredentialManagerError {
                    operation: "save".to_string(),
                    source: Some(e.into()),
                })?;
        }
        Ok(())
    }
}
```

**Architecture Benefits:**
- ✅ Unsafe code isolated to adapter layer
- ✅ Core business logic works with safe traits
- ✅ Easy to mock for testing
- ✅ Consistent `AppError` return type

---

## 14.3 AppError Helper Methods

The `AppError` enum includes helper methods for categorization and user-friendly messaging.

### Error Codes for Categorization

```rust
impl AppError {
    /// Returns an error code for categorization
    pub fn code(&self) -> &'static str {
        match self {
            AppError::CredentialsNotFound { .. } => "CRED_NOT_FOUND",
            AppError::CredentialManagerError { .. } => "CRED_MANAGER",
            AppError::InvalidHostname { .. } => "INVALID_HOSTNAME",
            AppError::CsvError { .. } => "CSV_ERROR",
            AppError::LdapConnectionError { .. } => "LDAP_CONNECTION",
            AppError::LdapBindError { .. } => "LDAP_BIND",
            AppError::RdpFileError { .. } => "RDP_FILE",
            AppError::RdpLaunchError { .. } => "RDP_LAUNCH",
            // ... all variants mapped to codes
        }
    }
}
```

These codes enable:
- ✅ Error filtering in logs
- ✅ Metrics collection
- ✅ Frontend error categorization
- ✅ Conditional error handling

### User-Friendly Error Messages

```rust
impl AppError {
    /// Returns a user-friendly error message suitable for display
    pub fn user_message(&self) -> String {
        match self {
            AppError::CredentialsNotFound { target } => {
                if target.starts_with("TERMSRV/") {
                    format!("No credentials saved for host '{}'", 
                        target.trim_start_matches("TERMSRV/"))
                } else {
                    "No credentials found. Please save your credentials in the login window first.".to_string()
                }
            }
            AppError::InvalidHostname { hostname, reason } => {
                format!("Invalid hostname '{}': {}", hostname, reason)
            }
            AppError::CsvError { operation, .. } => {
                format!("Failed to {} hosts database", operation)
            }
            // ... contextual messages for all variants
        }
    }
}
```

**Example Usage in Commands:**

```rust
// src-tauri/src/commands/hosts.rs
#[tauri::command]
pub fn save_host(app_handle: tauri::AppHandle, host: Host) -> Result<(), String> {
    use tauri::{Emitter, Manager};

    // Core logic returns AppError; QuickConnect converts that into a UI-safe String.
    crate::core::hosts::upsert_host(host).map_err(String::from)?;

    // Notify windows to refresh.
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.emit("hosts-updated", ());
    }
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.emit("hosts-updated", ());
    }

    Ok(())
}
```

This pattern provides:
- ✅ Technical details for logging (via `Display` trait)
- ✅ User-friendly messages for UI (via `user_message()`)
- ✅ Error codes for categorization (via `code()`)

---

## 14.4 Centralized Error Display System

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

## 14.5 Structured Logging with Tracing

QuickConnect uses the **tracing ecosystem** for structured, efficient logging. Logging is **disabled by default** and enabled with the `--debug` flag.

### Why Tracing?

The `tracing` crate provides:
- ✅ **Structured Logging**: Key-value pairs, not just strings
- ✅ **Zero-Cost Abstractions**: Minimal overhead when disabled
- ✅ **Async-Aware**: Tracks execution across async boundaries
- ✅ **Filtering**: Fine-grained control via `RUST_LOG` environment variable

### Logging Infrastructure

```rust
// src-tauri/src/infra/logging.rs

use std::sync::Mutex;

/// Global debug mode flag (thread-safe)
static DEBUG_MODE: Mutex<bool> = Mutex::new(false);

pub fn set_debug_mode(enabled: bool) {
    if let Ok(mut flag) = DEBUG_MODE.lock() {
        *flag = enabled;
    }
}

/// Initialize tracing subscriber (called at startup)
pub fn init_tracing() -> Result<(), String> {
    use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    let log_dir = std::env::var("APPDATA")
        .map(|p| PathBuf::from(p).join("QuickConnect"))
        .unwrap_or_else(|_| PathBuf::from("."));
    
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;

    // Rolling log file appender
    let file_appender = tracing_appender::rolling::never(
        &log_dir, 
        "QuickConnect_Debug.log"
    );

    // Configure file output layer
    let file_layer = fmt::layer()
        .with_writer(file_appender)
        .with_ansi(false)       // No color codes in file
        .with_target(true)      // Show module path
        .with_thread_ids(true)  // Show thread info
        .with_file(true)        // Show file name
        .with_line_number(true); // Show line number

    // Environment filter (defaults to INFO level)
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer)
        .try_init()
        .map_err(|e| format!("Failed to initialize: {}", e))?;

    tracing::info!("Tracing initialized successfully");
    Ok(())
}
```

### Using Tracing Macros

```rust
// In any module
use tracing::{info, warn, error, debug};

// Basic logging
info!("Application started");
warn!("Deprecated API used");
error!("Connection failed");

// Structured logging with fields
info!(
    hostname = "server01",
    port = 3389,
    "Connecting to RDP server"
);

// With AppError context
match launch_rdp(hostname).await {
    Ok(_) => info!(hostname = hostname, "RDP connection successful"),
    Err(e) => error!(
        hostname = hostname,
        error = %e,
        code = e.code(),
        "RDP connection failed"
    ),
}
```

### Legacy debug_log Compatibility

For backward compatibility, a legacy `debug_log` function still exists:

```rust
pub fn debug_log(
    level: &str,
    category: &str,
    message: &str,
    error_details: Option<&str>,
) {
    let debug_enabled = DEBUG_MODE.lock()
        .map(|flag| *flag)
        .unwrap_or(false);
    
    if !debug_enabled {
        return; // Early exit
    }

    // Delegate to tracing macros
    match level {
        "ERROR" => error!(category = category, details = ?error_details, "{}", message),
        "WARN" => warn!(category = category, details = ?error_details, "{}", message),
        "INFO" => info!(category = category, details = ?error_details, "{}", message),
        "DEBUG" => debug!(category = category, details = ?error_details, "{}", message),
        _ => debug!(category = category, details = ?error_details, "{}", message),
    }
    
    // Also write to file directly for legacy format
    // (implementation details omitted)
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

## 14.6 Command-Line Debug Mode

QuickConnect enables debug logging via the `--debug` command-line flag.

### Application Startup with Debug Mode

```rust
// src-tauri/src/main.rs

use quick_connect::infra::logging::{init_tracing, set_debug_mode};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Parse command-line arguments
    let args: Vec<String> = std::env::args().collect();
    
    // Check for --debug flag
    let debug_enabled = args
        .iter()
        .any(|arg| arg == "--debug" || arg == "--debug-log");

    if debug_enabled {
        eprintln!("[QuickConnect] Debug mode enabled");
        eprintln!("[QuickConnect] Args: {:?}", args);

        // Set global debug flag
        set_debug_mode(true);
        
        // Initialize tracing subscriber
        if let Err(e) = init_tracing() {
            eprintln!("[QuickConnect] Failed to initialize tracing: {}", e);
        } else {
            eprintln!("[QuickConnect] Tracing initialized successfully");
        }

        // Log file location
        if let Ok(appdata_dir) = std::env::var("APPDATA") {
            let log_file = PathBuf::from(appdata_dir)
                .join("QuickConnect")
                .join("QuickConnect_Debug.log");
            eprintln!("[QuickConnect] Log file: {:?}", log_file);
        }

        // Log system information
        tracing::info!(
            version = env!("CARGO_PKG_VERSION"),
            os = std::env::consts::OS,
            arch = std::env::consts::ARCH,
            "Application startup"
        );
    }

    // Build and run Tauri application
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::hosts::get_all_hosts,
            commands::hosts::search_hosts,
            // ... other commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Running with Debug Mode

**PowerShell:**
```powershell
# Run with debug logging
.\QuickConnect.exe --debug

# Development mode
npm run tauri -- dev -- --debug
```

**Expected Console Output:**
```
[QuickConnect] Debug mode enabled
[QuickConnect] Args: ["QuickConnect.exe", "--debug"]
[QuickConnect] Tracing initialized successfully
[QuickConnect] Log file: "C:\\Users\\Username\\AppData\\Roaming\\QuickConnect\\QuickConnect_Debug.log"
```

**Log File Output:**
```
2024-12-14T10:30:45.123Z INFO quick_connect: Tracing initialized successfully
2024-12-14T10:30:45.125Z INFO quick_connect: Application startup version="1.0.0" os="windows" arch="x86_64"
2024-12-14T10:30:45.200Z INFO hosts: Loading hosts from CSV path="C:\\Users\\...\\hosts.csv"
2024-12-14T10:30:45.210Z INFO hosts: Loaded 15 hosts
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


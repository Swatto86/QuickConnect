# Chapter 10: Tauri Commands - The Bridge Between Frontend and Backend

## Introduction

In a Tauri application, the frontend (HTML/TypeScript) and backend (Rust) run in completely separate processes. They cannot directly call each other's functions or share memory. This is a security feature that prevents malicious JavaScript from accessing system resources directly.

**Tauri Commands** are the bridge that connects these two worlds. They are Rust functions that you expose to the frontend, allowing JavaScript to invoke backend functionality safely and securely.

Think of commands as an API for your application:
- The **frontend** is the client that makes requests
- The **backend** is the server that processes those requests
- **Commands** are the endpoints that define what operations are available

In this chapter, we'll explore how QuickConnect uses commands to enable features like:
- Saving and retrieving credentials from Windows Credential Manager
- Managing the hosts CSV file
- Launching RDP connections
- Scanning Active Directory domains
- Managing application settings

---

## 10.1 Understanding #[tauri::command]

The `#[tauri::command]` attribute is what transforms a regular Rust function into a Tauri command that can be called from JavaScript.

### Basic Syntax

```rust
#[tauri::command]
fn my_command() -> String {
    "Hello from Rust!".to_string()
}
```

This simple command can be called from the frontend like this:

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<string>('my_command');
console.log(result); // "Hello from Rust!"
```

### Key Points

1. **Naming Convention**: The command name in JavaScript is the snake_case version of the Rust function name
2. **Automatic Serialization**: Tauri automatically serializes the return value to JSON
3. **Type Safety**: TypeScript can provide type hints with generic parameters (`invoke<string>`)
4. **Async by Default**: All invocations from JavaScript are asynchronous (return Promises)

### QuickConnect Example: Quit Application

One of the simplest commands in QuickConnect:

```rust
#[tauri::command]
pub async fn quit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}
```

Called from the frontend:

```typescript
import { invoke } from '@tauri-apps/api/core';

async function quitApplication() {
    await invoke('quit_app');
}
```

This command is `async` in Rust (we'll explore why in the next section) and takes an `AppHandle` parameter for accessing Tauri's application context.

---

## 10.2 Synchronous vs Asynchronous Commands

Commands can be either synchronous or asynchronous, depending on whether they perform I/O operations or long-running tasks.

### Synchronous Commands

Use regular functions for quick operations that don't involve:
- File I/O
- Network requests
- Database queries
- Long computations

```rust
#[tauri::command]
fn add_numbers(a: i32, b: i32) -> i32 {
    a + b
}
```

**QuickConnect Example**: Checking Windows theme

```rust
use crate::adapters::{RegistryAdapter, WindowsRegistry};

#[tauri::command]
pub fn get_windows_theme() -> Result<String, String> {
    let registry = WindowsRegistry::new();
    let key_path = "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize";
    
    match registry.read_dword(key_path, "AppsUseLightTheme") {
        Ok(Some(value)) => {
            // Value is 0 for dark, 1 for light
            if value == 0 {
                Ok("dark".to_string())
            } else {
                Ok("light".to_string())
            }
        }
        _ => Ok("dark".to_string()), // Default to dark
    }
}
```

This is synchronous because registry reads are very fast and don't block for long.

### Asynchronous Commands

Use `async fn` for operations that involve:
- Network I/O (LDAP queries, HTTP requests)
- File I/O (reading/writing large files)
- External process execution
- Database queries
- Long computations

```rust
#[tauri::command]
async fn fetch_data_from_api(url: String) -> Result<String, String> {
    // Simulate async HTTP request
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    Ok("Data from API".to_string())
}
```

**QuickConnect Example**: Scanning Active Directory

```rust
#[tauri::command]
pub async fn scan_domain(
    app_handle: tauri::AppHandle,
    domain: String,
    server: String,
) -> Result<String, String> {
    // Set hosts window to always on top during scan
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.set_always_on_top(true);
    }

    // Get credentials
    let credentials = commands::get_stored_credentials().await?.ok_or_else(|| {
        "No stored credentials found. Please save your domain credentials in the login window first."
            .to_string()
    })?;

    // Perform LDAP scan using core module
    let result = core::ldap::scan_domain_for_servers(&domain, &server, &credentials)
        .await
        .map_err(|e| e.to_string());

    // Reset window always on top
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.set_always_on_top(false);
    }

    // Write results to CSV if successful
    if let Ok(scan_result) = &result {
        let csv_path = crate::infra::get_hosts_csv_path()?;
        core::csv_writer::write_hosts_to_csv(&csv_path, &scan_result.hosts)
            .map_err(|e| e.to_string())?;

        // Emit UI events
        if let Some(main_window) = app_handle.get_webview_window("main") {
            let _ = main_window.emit("hosts-updated", ());
        }
        if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
            let _ = hosts_window.emit("hosts-updated", ());
        }

        Ok(format!(
            "Successfully found {} Windows Server(s).",
            scan_result.count
        ))
    } else {
        result.map(|r| format!("Successfully found {} Windows Server(s).", r.count))
    }
}
```

### When to Use Async

**Use `async fn` when:**
- Your function calls other async functions (`.await`)
- You perform I/O operations
- You need to spawn background tasks
- The operation might take more than a few milliseconds

**Use regular `fn` when:**
- The operation is purely computational
- It completes in microseconds
- There's no I/O involved

---

## 10.3 Parameter Passing and Serialization

Tauri automatically deserializes parameters from JSON. You can pass:
- Primitives: `String`, `i32`, `bool`, etc.
- Complex types: Custom structs that implement `serde::Deserialize`

### Primitive Parameters

```rust
#[tauri::command]
fn greet(name: String, age: u32) -> String {
    format!("Hello {}, you are {} years old", name, age)
}
```

Frontend:

```typescript
const greeting = await invoke<string>('greet', {
    name: 'Alice',
    age: 30
});
```

### Struct Parameters

Define structs with `#[derive(serde::Deserialize)]`:

```rust
#[derive(serde::Deserialize)]
struct Credentials {
    username: String,
    password: String,
}

#[tauri::command]
async fn save_credentials(credentials: Credentials) -> Result<(), String> {
    // credentials.username and credentials.password are available
    unsafe {
        // Save to Windows Credential Manager
        // ... implementation
    }
    Ok(())
}
```

Frontend:

```typescript
interface Credentials {
    username: string;
    password: string;
}

await invoke('save_credentials', {
    credentials: {
        username: 'john.doe',
        password: 'secret123'
    }
});
```

**Important**: Parameter names in the `invoke` call must match the Rust function parameter names exactly.

### QuickConnect Example: Saving a Host

```rust
use crate::core::types::Host;
use tauri::{Emitter, Manager};

#[tauri::command]
pub fn save_host(app_handle: tauri::AppHandle, host: Host) -> Result<(), String> {
    crate::core::hosts::upsert_host(host).map_err(|e| e.to_string())?;

    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.emit("hosts-updated", ());
    }
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.emit("hosts-updated", ());
    }

    Ok(())
}
```

Frontend:

```typescript
interface Host {
    hostname: string;
    description: string;
    last_connected?: string;
}

const newHost: Host = {
    hostname: 'server01.domain.com',
    description: 'Production Web Server'
};

try {
    await invoke('save_host', { host: newHost });
    console.log('Host saved successfully');
} catch (error) {
    console.error('Failed to save host:', error);
}
```

---

## 10.4 Return Types and Error Handling

Commands can return:
1. **Unit type** `()` - No return value
2. **Direct values** - `String`, `i32`, structs, etc.
3. **Result<T, E>** - For operations that can fail

### Unit Return Type

```rust
#[tauri::command]
fn do_something() {
    println!("Doing something...");
}
```

Frontend receives `null`:

```typescript
await invoke('do_something'); // Returns null/undefined
```

### Direct Return Values

```rust
#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
```

### Result<T, E> for Error Handling

The most common pattern in QuickConnect:

```rust
#[tauri::command]
async fn get_stored_credentials() -> Result<Option<StoredCredentials>, String> {
    // QuickConnect uses an adapter around Windows Credential Manager.
    use crate::adapters::{CredentialManager, WindowsCredentialManager};

    static CREDENTIAL_MANAGER: once_cell::sync::Lazy<WindowsCredentialManager> =
        once_cell::sync::Lazy::new(WindowsCredentialManager::new);

    match CREDENTIAL_MANAGER.read("QuickConnect") {
        Ok(Some((username, password))) => Ok(Some(StoredCredentials { username, password })),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
```

Frontend error handling:

```typescript
try {
    const credentials = await invoke<StoredCredentials | null>('get_stored_credentials');
    
    if (credentials) {
        console.log('Found credentials for:', credentials.username);
    } else {
        console.log('No credentials saved');
    }
} catch (error) {
    // This catches errors returned as Err(String) from Rust
    console.error('Failed to retrieve credentials:', error);
}
```

### Error Type Convention

QuickConnect uses `Result<T, String>` consistently:
- **Success**: `Ok(value)`
- **Error**: `Err(error_message)` where error_message is a human-readable string

This is simpler than custom error types for most use cases, and the string error message can be displayed directly to users.

### Complex Return Types

You can return complex nested types:

```rust
#[derive(Debug, serde::Serialize)]
struct RecentConnection {
    hostname: String,
    description: String,
    timestamp: u64,
}

#[tauri::command]
fn get_recent_connections() -> Result<Vec<RecentConnection>, String> {
    let recent = load_recent_connections()?;
    Ok(recent.connections)
}
```

Frontend:

```typescript
interface RecentConnection {
    hostname: string;
    description: string;
    timestamp: number;
}

const recent = await invoke<RecentConnection[]>('get_recent_connections');
console.log(`Found ${recent.length} recent connections`);
```

---

## 10.5 Using AppHandle for Window Access

Many commands need to interact with windows or emit events. The `tauri::AppHandle` provides this capability.

### Accessing Windows

```rust
#[tauri::command]
fn show_about(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(about_window) = app_handle.get_webview_window("about") {
        about_window.show().map_err(|e| e.to_string())?;
        about_window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("About window not found".to_string())
    }
}
```

### Emitting Events to Windows

Commands can push data to specific windows:

```rust
#[derive(Clone, serde::Serialize)]
struct ErrorPayload {
    message: String,
    timestamp: String,
    category: Option<String>,
    details: Option<String>,
}

#[tauri::command]
fn show_error(
    app_handle: tauri::AppHandle,
    message: String,
    category: Option<String>,
    details: Option<String>,
) -> Result<(), String> {
    use chrono::Local;
    
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let payload = ErrorPayload {
        message,
        timestamp,
        category,
        details,
    };
    
    // Emit event to error window
    if let Some(error_window) = app_handle.get_webview_window("error") {
        error_window.emit("show-error", &payload)
            .map_err(|e| e.to_string())?;
        error_window.show().map_err(|e| e.to_string())?;
        error_window.set_focus().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

Frontend listens for the event:

```typescript
import { listen } from '@tauri-apps/api/event';

interface ErrorPayload {
    message: string;
    timestamp: string;
    category?: string;
    details?: string;
}

await listen<ErrorPayload>('show-error', (event) => {
    const error = event.payload;
    console.error(`[${error.timestamp}] ${error.message}`);
    
    // Display error in UI
    displayErrorDialog(error);
});
```

### Window Management Example

```rust
#[tauri::command]
async fn switch_to_main_window(app_handle: tauri::AppHandle) -> Result<(), tauri::Error> {
    let login_window = app_handle.get_webview_window("login").unwrap();
    let main_window = app_handle.get_webview_window("main").unwrap();

    // Show main window first to prevent flicker
    main_window.unminimize()?;
    main_window.show()?;
    main_window.set_focus()?;

    // Then hide login window
    login_window.hide()?;

    Ok(())
}
```

---

## 10.6 Command Organization Patterns

As your application grows, organizing commands becomes important. QuickConnect demonstrates several patterns.

### Grouping Related Commands

Commands are typically grouped by functionality:

**Window Management**
- `close_login_window`
- `show_login_window`
- `switch_to_main_window`
- `show_hosts_window`
- `hide_hosts_window`

**Credential Management**
- `save_credentials`
- `get_stored_credentials`
- `delete_credentials`
- `save_host_credentials`
- `get_host_credentials`

**Host Management**
- `get_hosts`
- `get_all_hosts`
- `search_hosts`
- `save_host`
- `delete_host`
- `delete_all_hosts`

**RDP Operations**
- `launch_rdp`
- `scan_domain`

**Application Settings**
- `check_autostart`
- `toggle_autostart`
- `get_theme`
- `set_theme`
- `get_windows_theme`

### Helper Functions vs Commands

Not every function needs to be a command. Use helper functions for internal logic:

```rust
// HELPER FUNCTION - Not a command, not exposed to frontend
fn get_hosts() -> Result<Vec<Host>, String> {
    let path = std::path::Path::new("hosts.csv");
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read CSV: {}", e))?;

    // Parse CSV...
    Ok(hosts)
}

// COMMAND - Exposed to frontend
#[tauri::command]
async fn get_all_hosts() -> Result<Vec<Host>, String> {
    get_hosts() // Calls helper function
}

// COMMAND - Also uses the same helper
#[tauri::command]
async fn search_hosts(query: String) -> Result<Vec<Host>, String> {
    let hosts = get_hosts()?; // Reuse helper
    let query = query.to_lowercase();

    let filtered: Vec<Host> = hosts
        .into_iter()
        .filter(|host| {
            host.hostname.to_lowercase().contains(&query)
                || host.description.to_lowercase().contains(&query)
        })
        .collect();

    Ok(filtered)
}
```

**Benefits:**
- Helper functions can be reused by multiple commands
- Testing is easier (test helpers independently)
- Code is more maintainable
- Commands become thin wrappers that add validation or formatting

### Command Composition

Commands can call other commands (but not directly - they call the underlying functions):

```rust
// Helper that updates CSV
fn update_last_connected(hostname: &str) -> Result<(), String> {
    use chrono::Local;
    
    let timestamp = Local::now().format("%d/%m/%Y %H:%M:%S").to_string();
    
    let mut hosts = get_hosts()?;
    
    for host in &mut hosts {
        if host.hostname == hostname {
            host.last_connected = Some(timestamp);
            break;
        }
    }
    
    // Write back to CSV...
    Ok(())
}

// Command that launches RDP and updates timestamp
#[tauri::command]
async fn launch_rdp(host: Host) -> Result<(), String> {
    // Get credentials
    let credentials = get_stored_credentials().await?
        .ok_or("No credentials found")?;

    // Create RDP file
    // ... RDP file creation logic ...

    // Launch RDP
    // ... launch logic ...

    // Update last connected timestamp (reuse helper)
    update_last_connected(&host.hostname)?;

    // Save to recent connections (another helper)
    if let Ok(mut recent) = load_recent_connections() {
        recent.add_connection(host.hostname, host.description);
        let _ = save_recent_connections(&recent);
    }

    Ok(())
}
```

---

## 10.7 Type Safety Across the Bridge

One of the biggest challenges in multi-language applications is keeping types synchronized between frontend and backend.

### The Problem

You define a struct in Rust:

```rust
#[derive(serde::Serialize)]
struct Host {
    hostname: String,
    description: String,
    last_connected: Option<String>,
}
```

And you need to manually create the corresponding TypeScript interface:

```typescript
interface Host {
    hostname: string;
    description: string;
    last_connected?: string;
}
```

If these get out of sync, you'll have runtime errors that TypeScript can't catch.

### Solutions

**1. Manual Synchronization**

The simplest approach (used by QuickConnect):
- Keep Rust structs and TypeScript interfaces in sync manually
- Document the types clearly
- Use consistent naming conventions

**2. Type Generation Tools**

Use tools like `ts-rs` to generate TypeScript definitions from Rust:

```rust
use ts_rs::TS;

#[derive(serde::Serialize, TS)]
#[ts(export)]
struct Host {
    hostname: String,
    description: String,
    last_connected: Option<String>,
}
```

This generates a `Host.ts` file automatically:

```typescript
export interface Host {
    hostname: string;
    description: string;
    last_connected?: string;
}
```

**3. Shared Schema**

Use a schema language like JSON Schema or Protocol Buffers to define types once, generate for both languages.

### QuickConnect Type Definitions

QuickConnect defines types in both Rust and TypeScript:

**Rust** (`src-tauri/src/core/types.rs`):

```rust
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
struct Host {
    hostname: String,
    description: String,
    last_connected: Option<String>,
}

#[derive(serde::Serialize)]
struct StoredCredentials {
    username: String,
    password: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
struct RecentConnection {
    hostname: String,
    description: String,
    timestamp: u64,
}
```

**TypeScript** (typically in each `.ts` file):

```typescript
// main.ts
interface Host {
    hostname: string;
    description: string;
    last_connected?: string;
}

interface StoredCredentials {
    username: string;
    password: string;
}

interface RecentConnection {
    hostname: string;
    description: string;
    timestamp: number;
}
```

### Best Practices

1. **Use Descriptive Names**: `StoredCredentials` is clearer than `Creds`
2. **Match Naming Conventions**: 
   - Rust: `snake_case` for fields, `PascalCase` for types
   - TypeScript: `camelCase` for fields, `PascalCase` for types
3. **Document Complex Types**: Add comments explaining each field
4. **Keep Types Close**: Define TypeScript interfaces near where they're used
5. **Use Optional Fields Consistently**: `Option<T>` in Rust → `?` in TypeScript

---

## 10.8 QuickConnect Command Examples

Let's examine some real-world commands from QuickConnect to see these patterns in action.

### Example 1: Delete Host

**Purpose**: Remove a host from the CSV file

```rust
#[tauri::command]
fn delete_host(hostname: String) -> Result<(), String> {
    debug_log("INFO", "CSV_OPERATIONS", 
        &format!("Deleting host: {}", hostname), None);
    
    // Read all hosts and filter out the one to delete
    let hosts: Vec<Host> = get_hosts()?
        .into_iter()
        .filter(|h| h.hostname != hostname)
        .collect();

    // Write the remaining hosts back to CSV
    let mut wtr = csv::WriterBuilder::new()
        .from_path("hosts.csv")
        .map_err(|e| format!("Failed to create CSV writer: {}", e))?;

    wtr.write_record(&["hostname", "description", "last_connected"])
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;

    for host in hosts {
        wtr.write_record(&[
            &host.hostname,
            &host.description,
            &host.last_connected.unwrap_or_default(),
        ])
        .map_err(|e| format!("Failed to write CSV record: {}", e))?;
    }

    wtr.flush()
        .map_err(|e| format!("Failed to flush CSV writer: {}", e))?;

    Ok(())
}
```

**Frontend** (`hosts.ts`):

```typescript
async function deleteHost(hostname: string) {
    try {
        await invoke('delete_host', { hostname });
        console.log(`Host ${hostname} deleted`);
        
        // Refresh the host list
        await loadHosts();
    } catch (error) {
        console.error('Failed to delete host:', error);
        alert(`Failed to delete host: ${error}`);
    }
}
```

**Key Techniques:**
- Uses `Result<(), String>` to propagate errors
- Calls helper function `get_hosts()`
- Detailed error messages with context
- Debug logging for troubleshooting
- Frontend refreshes UI after successful deletion

### Example 2: Toggle Autostart

**Purpose**: Enable or disable Windows autostart

```rust
#[tauri::command]
fn toggle_autostart() -> Result<bool, String> {
    // First, check current state
    let is_enabled = check_autostart()?;

    if is_enabled {
        disable_autostart()?;
        Ok(false)
    } else {
        enable_autostart()?;
        Ok(true)
    }
}

// Helper function (not a command)
fn check_autostart() -> Result<bool, String> {
    unsafe {
        let key_path: Vec<u16> = OsStr::new(REGISTRY_RUN_KEY)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut hkey = HKEY::default();

        let result = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );

        if result.is_err() {
            return Ok(false);
        }

        let value_name: Vec<u16> = OsStr::new(APP_NAME)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut data_size: u32 = 0;

        let query_result = RegQueryValueExW(
            hkey,
            PCWSTR::from_raw(value_name.as_ptr()),
            None,
            None,
            None,
            Some(&mut data_size),
        );

        let _ = RegCloseKey(hkey);

        Ok(query_result.is_ok())
    }
}
```

**Frontend**:

```typescript
async function toggleAutostart() {
    try {
        const enabled = await invoke<boolean>('toggle_autostart');
        
        if (enabled) {
            console.log('Autostart enabled');
        } else {
            console.log('Autostart disabled');
        }
        
        // Update UI checkbox
        updateAutostartCheckbox(enabled);
    } catch (error) {
        console.error('Failed to toggle autostart:', error);
    }
}
```

**Key Techniques:**
- Returns the new state (`bool`) so UI can update
- Separates read (`check_autostart`) from write (`enable_autostart`, `disable_autostart`)
- Uses a registry adapter (no unsafe blocks in the command layer)
- Handles errors gracefully

### Example 3: Launch RDP

**Purpose**: Create and launch an RDP connection

This is one of the most complex commands in QuickConnect:

```rust
#[tauri::command]
async fn launch_rdp(app_handle: tauri::AppHandle, host: Host) -> Result<(), String> {
    use tauri::{Emitter, Manager};

    // QuickConnect keeps the command layer thin:
    // - core::rdp_launcher handles: credential selection, TERMSRV storage, .rdp writing,
    //   spawning `mstsc.exe`, and recent-connections updates.
    // - the command layer handles UI events and window/tray coordination.
    crate::core::rdp_launcher::launch_rdp_connection(
        &host,
        |hostname| async move {
            crate::commands::get_host_credentials(hostname)
                .await
                .map_err(|e| crate::AppError::CredentialManagerError {
                    operation: "get host credentials".to_string(),
                    source: Some(anyhow::anyhow!(e)),
                })
        },
        || async {
            crate::commands::get_stored_credentials()
                .await
                .map_err(|e| crate::AppError::CredentialManagerError {
                    operation: "get stored credentials".to_string(),
                    source: Some(anyhow::anyhow!(e)),
                })
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    // Update last connected timestamp and tell the UI to refresh.
    if crate::commands::hosts::update_last_connected(&host.hostname).is_ok() {
        if let Some(main_window) = app_handle.get_webview_window("main") {
            let _ = main_window.emit("host-connected", &host.hostname);
        }
    }

    Ok(())
}
```

**Frontend**:

```typescript
async function connectToHost(host: Host) {
    try {
        // Show loading indicator
        showLoadingSpinner();
        
        await invoke('launch_rdp', { host });
        
        console.log(`RDP connection launched to ${host.hostname}`);
        
        // Connection launched successfully
        hideLoadingSpinner();
        
        // Optionally hide the application window
        await invoke('hide_main_window');
        
    } catch (error) {
        hideLoadingSpinner();
        console.error('Failed to launch RDP:', error);
        
        // Show error dialog
        alert(`Failed to connect to ${host.hostname}: ${error}`);
    }
}
```

**Key Techniques:**
- **Async**: Network and file I/O operations
- **Fallback logic**: Try per-host credentials, fall back to global
- **Parsing**: Extract domain from username (supports multiple formats)
- **Windows API**: Use Credential Manager and ShellExecuteW
- **File generation**: Create RDP files dynamically
- **Side effects**: Update recent connections and timestamps
- **Comprehensive error handling**: Each step can fail independently

---

## 10.9 Registering Commands

After defining commands, you must register them in your Tauri setup:

```rust
// In src-tauri/src/core/types.rs
pub fn run() {
    tauri::Builder::default()
        .plugin(/* ... */)
        .setup(|app| {
            // Setup code...
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Window Management
            close_login_window,
            show_login_window,
            switch_to_main_window,
            show_hosts_window,
            hide_hosts_window,
            show_about,
            
            // Credentials
            save_credentials,
            get_stored_credentials,
            delete_credentials,
            save_host_credentials,
            get_host_credentials,
            
            // Hosts
            get_all_hosts,
            search_hosts,
            save_host,
            delete_host,
            delete_all_hosts,
            
            // RDP
            launch_rdp,
            scan_domain,
            
            // Settings
            check_autostart,
            toggle_autostart,
            get_theme,
            set_theme,
            get_windows_theme,
            
            // Application
            quit_app,
            reset_application,
            get_recent_connections,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Important**: If you forget to add a command to `invoke_handler`, you'll get a runtime error when trying to call it from the frontend:

```
Error: No command registered for 'my_command'
```

---

## 10.10 Key Takeaways

1. **Commands are the only way** for frontend to communicate with backend
2. **Use `#[tauri::command]`** to expose Rust functions to JavaScript
3. **Async for I/O**, sync for quick operations
4. **Parameters are deserialized** from JSON automatically
5. **Return `Result<T, String>`** for operations that can fail
6. **Use `AppHandle`** to access windows and emit events
7. **Organize commands by functionality** for maintainability
8. **Keep types synchronized** between Rust and TypeScript
9. **Register all commands** in `invoke_handler`
10. **Test error handling** on both sides of the bridge

---

## 10.11 Practice Exercises

### Exercise 1: Simple Calculator Command

Create a command that performs basic arithmetic:

**Rust:**
```rust
#[tauri::command]
fn calculate(operation: String, a: f64, b: f64) -> Result<f64, String> {
    // TODO: Implement add, subtract, multiply, divide
    // Return error for division by zero
    todo!()
}
```

**TypeScript:**
```typescript
// TODO: Call the command and display the result
```

### Exercise 2: File Information Command

Create a command that returns information about a file:

**Rust:**
```rust
#[derive(serde::Serialize)]
struct FileInfo {
    size: u64,
    modified: String,
    is_readonly: bool,
}

#[tauri::command]
fn get_file_info(path: String) -> Result<FileInfo, String> {
    // TODO: Use std::fs::metadata to get file info
    todo!()
}
```

**TypeScript:**
```typescript
interface FileInfo {
    size: number;
    modified: string;
    is_readonly: boolean;
}

// TODO: Implement file info UI
```

### Exercise 3: Async Data Fetcher

Create an async command that simulates fetching data:

**Rust:**
```rust
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    // TODO: Simulate async operation with tokio::time::sleep
    // Return mock data after delay
    todo!()
}
```

**TypeScript:**
```typescript
// TODO: Call fetch_data and show loading indicator
```

---

## Solutions

<details>
<summary>Exercise 1 Solution</summary>

**Rust:**
```rust
#[tauri::command]
fn calculate(operation: String, a: f64, b: f64) -> Result<f64, String> {
    match operation.as_str() {
        "add" => Ok(a + b),
        "subtract" => Ok(a - b),
        "multiply" => Ok(a * b),
        "divide" => {
            if b == 0.0 {
                Err("Cannot divide by zero".to_string())
            } else {
                Ok(a / b)
            }
        }
        _ => Err(format!("Unknown operation: {}", operation)),
    }
}
```

**TypeScript:**
```typescript
async function performCalculation() {
    const a = 10;
    const b = 5;
    
    try {
        const sum = await invoke<number>('calculate', { 
            operation: 'add', a, b 
        });
        console.log(`${a} + ${b} = ${sum}`);
        
        const result = await invoke<number>('calculate', { 
            operation: 'divide', a, b 
        });
        console.log(`${a} / ${b} = ${result}`);
        
        // This will throw an error
        await invoke<number>('calculate', { 
            operation: 'divide', a: 10, b: 0 
        });
    } catch (error) {
        console.error('Calculation error:', error);
    }
}
```
</details>

<details>
<summary>Exercise 2 Solution</summary>

**Rust:**
```rust
use std::fs;
use chrono::{DateTime, Local};

#[derive(serde::Serialize)]
struct FileInfo {
    size: u64,
    modified: String,
    is_readonly: bool,
}

#[tauri::command]
fn get_file_info(path: String) -> Result<FileInfo, String> {
    let metadata = fs::metadata(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let modified: DateTime<Local> = metadata.modified()
        .map_err(|e| format!("Failed to get modified time: {}", e))?
        .into();
    
    Ok(FileInfo {
        size: metadata.len(),
        modified: modified.format("%Y-%m-%d %H:%M:%S").to_string(),
        is_readonly: metadata.permissions().readonly(),
    })
}
```

**TypeScript:**
```typescript
interface FileInfo {
    size: number;
    modified: string;
    is_readonly: boolean;
}

async function displayFileInfo(filePath: string) {
    try {
        const info = await invoke<FileInfo>('get_file_info', { 
            path: filePath 
        });
        
        console.log(`File: ${filePath}`);
        console.log(`Size: ${info.size} bytes`);
        console.log(`Modified: ${info.modified}`);
        console.log(`Read-only: ${info.is_readonly}`);
    } catch (error) {
        console.error('Failed to get file info:', error);
    }
}
```
</details>

<details>
<summary>Exercise 3 Solution</summary>

**Rust:**
```rust
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    // Simulate network delay
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    
    // Return mock data
    Ok(format!("Data from {}: [mock content]", url))
}
```

**TypeScript:**
```typescript
async function loadData() {
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    
    loadingDiv.style.display = 'block';
    resultDiv.textContent = '';
    
    try {
        const data = await invoke<string>('fetch_data', { 
            url: 'https://api.example.com/data' 
        });
        
        resultDiv.textContent = data;
    } catch (error) {
        resultDiv.textContent = `Error: ${error}`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}
```
</details>

---

## Summary

In this chapter, you learned:
- How to create Tauri commands with `#[tauri::command]`
- When to use synchronous vs asynchronous commands
- How to pass parameters and return values
- Error handling with `Result<T, String>`
- Using `AppHandle` for window management and events
- Organizing commands for maintainability
- Maintaining type safety between Rust and TypeScript
- Real-world examples from QuickConnect

Tauri commands are the foundation of your application's architecture. Mastering them enables you to build powerful, secure desktop applications that leverage both the performance of Rust and the flexibility of web technologies.

In the next chapter, we'll dive deeper into **Windows API Integration**, exploring how QuickConnect uses commands to interact with Windows-specific features like the Credential Manager, Registry, and process launching.

---

**Chapter 10 Complete** | Next: [Chapter 11: Windows API Integration →](Chapter_11_Windows_API_Integration.md)

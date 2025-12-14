# Chapter 9: Advanced Features and Windows Integration

**Estimated Reading Time:** 35-40 minutes  
**Difficulty Level:** Advanced

---

## Introduction

QuickConnect demonstrates several advanced features that make it production-ready and user-friendly. In this chapter, we'll explore the Windows-specific integrations and additional features that weren't fully covered in previous chapters but are crucial to understanding the complete application.

By the end of this chapter, you'll understand:
- Error window system with centralized error display
- Recent connections tracking and tray menu integration
- Per-host credential management
- Debug logging system
- Application reset functionality
- Windows Registry integration for autostart
- Theme management across windows
- Single-instance application handling

---

## 9.1 Centralized Error Display System

### The Error Window Architecture

QuickConnect uses a dedicated error window instead of browser alerts or console logging. This provides:
- **Consistent UX** - All errors displayed in the same format
- **Detailed information** - Timestamp, category, and troubleshooting tips
- **Non-blocking** - Errors don't interrupt workflow
- **Always on top** - Ensures visibility

### Backend Implementation

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
    
    debug_log(
        "INFO",
        "ERROR_WINDOW",
        &format!("Showing error in error window: {}", payload.message),
        payload.details.as_deref(),
    );
    
    // Emit the error event to the error window
    if let Some(error_window) = app_handle.get_webview_window("error") {
        let _ = error_window.emit("show-error", &payload);
        // Always show and focus the window when a new error occurs
        error_window.show().map_err(|e| e.to_string())?;
        error_window.unminimize().map_err(|e| e.to_string())?;
        error_window.set_focus().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

### Frontend Error Handler

```typescript
// error.ts - Error window frontend
interface ErrorPayload {
  message: string;
  timestamp: string;
  category?: string;
  details?: string;
}

await listen<ErrorPayload>('show-error', (event) => {
  const error = event.payload;
  
  // Display error with formatted information
  document.getElementById('error-message')!.textContent = error.message;
  document.getElementById('error-timestamp')!.textContent = error.timestamp;
  
  if (error.category) {
    document.getElementById('error-category')!.textContent = error.category;
  }
  
  if (error.details) {
    document.getElementById('error-details')!.textContent = error.details;
  }
});
```

### Usage Throughout Application

```typescript
// Instead of alert() or console.error()
async function showError(message: string, category?: string, details?: string) {
  try {
    await invoke("show_error", {
      message,
      category: category || "ERROR",
      details: details || undefined,
    });
  } catch (err) {
    console.error("Failed to show error window:", err);
    console.error(`[${category || "ERROR"}] ${message}`, details);
  }
}

// Usage example
try {
  await invoke("save_host", { host });
} catch (error) {
  await showError(
    "Failed to save host to database",
    "CSV_OPERATIONS",
    String(error)
  );
}
```

---

## 9.2 Recent Connections Tracking

### Data Structure

```rust
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
struct RecentConnection {
    hostname: String,
    description: String,
    timestamp: u64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct RecentConnections {
    connections: Vec<RecentConnection>,
}

impl RecentConnections {
    fn new() -> Self {
        Self {
            connections: Vec::new(),
        }
    }

    fn add_connection(&mut self, hostname: String, description: String) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Remove existing entry for this hostname if it exists
        self.connections.retain(|c| c.hostname != hostname);

        // Add new connection at the beginning
        self.connections.insert(0, RecentConnection {
            hostname,
            description,
            timestamp,
        });

        // Keep only the 5 most recent
        if self.connections.len() > 5 {
            self.connections.truncate(5);
        }
    }
}
```

### Persistent Storage

```rust
fn get_recent_connections_file() -> Result<PathBuf, String> {
    let appdata_dir = std::env::var("APPDATA")
        .map_err(|_| "Failed to get APPDATA directory".to_string())?;
    let QuickConnect_dir = PathBuf::from(appdata_dir).join("QuickConnect");
    std::fs::create_dir_all(&QuickConnect_dir)
        .map_err(|e| format!("Failed to create QuickConnect directory: {}", e))?;
    Ok(QuickConnect_dir.join("recent_connections.json"))
}

fn save_recent_connections(recent: &RecentConnections) -> Result<(), String> {
    let file_path = get_recent_connections_file()?;
    let json = serde_json::to_string_pretty(recent)
        .map_err(|e| format!("Failed to serialize recent connections: {}", e))?;
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write recent connections: {}", e))?;
    Ok(())
}

fn load_recent_connections() -> Result<RecentConnections, String> {
    let file_path = get_recent_connections_file()?;
    if !file_path.exists() {
        return Ok(RecentConnections::new());
    }
    let json = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read recent connections: {}", e))?;
    let recent: RecentConnections = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse recent connections: {}", e))?;
    Ok(recent)
}
```

### Command Implementation

```rust
#[tauri::command]
fn get_recent_connections() -> Result<Vec<RecentConnection>, String> {
    let recent = load_recent_connections()?;
    Ok(recent.connections)
}
```

### Recording Connections

```rust
#[tauri::command]
async fn launch_rdp(host: Host) -> Result<(), String> {
    // ... RDP launch logic ...
    
    // Save to recent connections
    if let Ok(mut recent) = load_recent_connections() {
        recent.add_connection(host.hostname.clone(), host.description.clone());
        let _ = save_recent_connections(&recent);
    }
    
    Ok(())
}
```

### Tray Menu Integration

```rust
fn build_tray_menu(app: &tauri::AppHandle, current_theme: &str) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    // ... other menu items ...
    
    // Create recent connections submenu
    let recent_connections = load_recent_connections().unwrap_or_else(|_| RecentConnections::new());
    
    let recent_submenu = if recent_connections.connections.is_empty() {
        let no_recent = MenuItem::with_id(
            app,
            "no_recent",
            "No recent connections",
            false,
            None::<&str>,
        )?;
        Submenu::with_items(
            app,
            "Recent Connections",
            true,
            &[&no_recent],
        )?
    } else {
        // Build submenu with actual recent items
        let items: Vec<_> = recent_connections.connections.iter().map(|conn| {
            let label = if conn.description.is_empty() {
                conn.hostname.clone()
            } else {
                format!("{} - {}", conn.hostname, conn.description)
            };
            let menu_id = format!("recent_{}", conn.hostname);
            MenuItem::with_id(
                app,
                &menu_id,
                &label,
                true,
                None::<&str>,
            )
        }).collect::<Result<Vec<_>, _>>()?;
        
        let item_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = 
            items.iter().map(|item| item as &dyn tauri::menu::IsMenuItem<tauri::Wry>).collect();
        
        Submenu::with_items(
            app,
            "Recent Connections",
            true,
            &item_refs,
        )?
    };
    
    Menu::with_items(
        app,
        &[&recent_submenu, /* other items */],
    ).map_err(|e| e.into())
}
```

---

## 9.3 Per-Host Credential Management

### Why Per-Host Credentials?

QuickConnect supports both global credentials and per-host credentials:
- **Global credentials** - Default username/password for most connections
- **Per-host credentials** - Specific credentials for individual servers

### Storage Location

Credentials are stored in Windows Credential Manager:
- **Global:** `QuickConnect`
- **Per-host:** `TERMSRV/{hostname}`

### Saving Per-Host Credentials

```rust
#[tauri::command]
async fn save_host_credentials(host: Host, credentials: Credentials) -> Result<(), String> {
    debug_log(
        "INFO",
        "HOST_CREDENTIALS",
        &format!("Saving credentials for host: {}", host.hostname),
        None,
    );

    // Parse username to extract just the username part (not DOMAIN\username)
    let username = if credentials.username.contains('\\') {
        let parts: Vec<&str> = credentials.username.splitn(2, '\\').collect();
        if parts.len() == 2 {
            parts[1].to_string()
        } else {
            credentials.username.clone()
        }
    } else if credentials.username.contains('@') {
        let parts: Vec<&str> = credentials.username.splitn(2, '@').collect();
        if parts.len() == 2 {
            parts[0].to_string()
        } else {
            credentials.username.clone()
        }
    } else {
        credentials.username.clone()
    };

    unsafe {
        let password_wide: Vec<u16> = OsStr::new(&credentials.password)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let target_name: Vec<u16> = OsStr::new(&format!("TERMSRV/{}", host.hostname))
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        
        let username_wide: Vec<u16> = OsStr::new(&username)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let cred = CREDENTIALW {
            Flags: CRED_FLAGS(0),
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(target_name.as_ptr() as *mut u16),
            Comment: PWSTR::null(),
            LastWritten: FILETIME::default(),
            CredentialBlobSize: (password_wide.len() * 2) as u32,
            CredentialBlob: password_wide.as_ptr() as *mut u8,
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: std::ptr::null_mut(),
            TargetAlias: PWSTR::null(),
            UserName: PWSTR(username_wide.as_ptr() as *mut u16),
        };

        match CredWriteW(&cred, 0) {
            Ok(_) => {
                debug_log(
                    "INFO",
                    "HOST_CREDENTIALS",
                    &format!("Successfully saved credentials for host: {}", host.hostname),
                    None,
                );
                Ok(())
            }
            Err(e) => {
                let error = format!("Failed to save credentials for host {}: {:?}", host.hostname, e);
                debug_log("ERROR", "HOST_CREDENTIALS", &error, Some(&format!("CredWriteW error: {:?}", e)));
                Err(error)
            }
        }
    }
}
```

### Retrieving Per-Host Credentials

```rust
#[tauri::command]
async fn get_host_credentials(hostname: String) -> Result<Option<StoredCredentials>, String> {
    unsafe {
        let target_name: Vec<u16> = OsStr::new(&format!("TERMSRV/{}", hostname))
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut pcred = std::ptr::null_mut();

        match CredReadW(
            PCWSTR::from_raw(target_name.as_ptr()),
            CRED_TYPE_GENERIC,
            0,
            &mut pcred,
        ) {
            Ok(_) => {
                let cred = &*(pcred as *const CREDENTIALW);
                let username = if !cred.UserName.is_null() {
                    PWSTR::from_raw(cred.UserName.0).to_string()
                        .map_err(|e| format!("Failed to read username: {:?}", e))?
                } else {
                    String::new()
                };

                // Password is stored as UTF-16
                let password_bytes = std::slice::from_raw_parts(
                    cred.CredentialBlob,
                    cred.CredentialBlobSize as usize,
                );

                let password_wide: Vec<u16> = password_bytes
                    .chunks_exact(2)
                    .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                    .collect();

                let password = String::from_utf16(&password_wide)
                    .map_err(|e| format!("Failed to decode password: {:?}", e))?
                    .trim_end_matches('\0')
                    .to_string();

                Ok(Some(StoredCredentials { username, password }))
            }
            Err(_) => Ok(None),
        }
    }
}
```

### Fallback Strategy in launch_rdp

```rust
#[tauri::command]
async fn launch_rdp(host: Host) -> Result<(), String> {
    // First check for per-host credentials, fall back to global credentials
    let credentials = match get_host_credentials(host.hostname.clone()).await? {
        Some(creds) => {
            debug_log(
                "INFO",
                "RDP_LAUNCH",
                &format!("Using per-host credentials for {}", host.hostname),
                None,
            );
            creds
        }
        None => {
            debug_log(
                "INFO",
                "RDP_LAUNCH",
                &format!("No per-host credentials, using global credentials"),
                None,
            );
            match get_stored_credentials().await? {
                Some(creds) => creds,
                None => {
                    return Err("No credentials found. Please save credentials first.".to_string());
                }
            }
        }
    };
    
    // ... continue with RDP launch ...
}
```

---

## 9.4 Debug Logging System

### Debug Mode Activation

QuickConnect supports command-line debug flags:

```bash
# Enable debug logging
QuickConnect.exe --debug
# or
QuickConnect.exe --debug-log
```

### Implementation

```rust
static DEBUG_MODE: Mutex<bool> = Mutex::new(false);

fn set_debug_mode(enabled: bool) {
    if let Ok(mut flag) = DEBUG_MODE.lock() {
        *flag = enabled;
    }
}

pub fn run() {
    // Check for --debug or --debug-log command line argument
    let args: Vec<String> = std::env::args().collect();
    let debug_enabled = args
        .iter()
        .any(|arg| arg == "--debug" || arg == "--debug-log");

    if debug_enabled {
        eprintln!("[QuickConnect] Debug mode enabled");
        
        // Show where log file will be written
        if let Ok(appdata_dir) = std::env::var("APPDATA") {
            let log_file = PathBuf::from(appdata_dir)
                .join("QuickConnect")
                .join("QuickConnect_Debug.log");
            eprintln!("[QuickConnect] Log file: {:?}", log_file);
        }

        set_debug_mode(true);
        debug_log(
            "INFO",
            "SYSTEM",
            "Debug logging enabled",
            Some(&format!("Arguments: {:?}", args)),
        );
    }
    
    // ... rest of application setup ...
}
```

### Debug Log Function

```rust
fn debug_log(level: &str, category: &str, message: &str, error_details: Option<&str>) {
    let debug_enabled = DEBUG_MODE.lock().map(|flag| *flag).unwrap_or(false);

    if !debug_enabled {
        return;
    }

    // Use AppData\Roaming\QuickConnect for reliable write permissions
    let log_file = if let Ok(appdata_dir) = std::env::var("APPDATA") {
        let QuickConnect_dir = PathBuf::from(appdata_dir).join("QuickConnect");
        let _ = std::fs::create_dir_all(&QuickConnect_dir);
        QuickConnect_dir.join("QuickConnect_Debug.log")
    } else {
        PathBuf::from("QuickConnect_Debug.log")
    };

    // Check if file is new (to add header)
    let is_new_file = !log_file.exists();

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_file) {
        if is_new_file {
            let _ = writeln!(file, "{}", "=".repeat(80));
            let _ = writeln!(file, "QuickConnect Debug Log");
            let _ = writeln!(file, "{}", "=".repeat(80));
            let _ = writeln!(file, "This file contains detailed application logs.");
            let _ = writeln!(file, "");
        }

        use chrono::Local;
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();

        let level_indicator = match level {
            "ERROR" => "[!]",
            "WARN" => "[*]",
            "INFO" => "[i]",
            "DEBUG" => "[d]",
            _ => "[?]",
        };

        let mut log_entry = format!("\n{} {} [{:8}] [{}]\n", timestamp, level_indicator, level, category);
        log_entry.push_str(&format!("Message: {}\n", message));

        if let Some(details) = error_details {
            log_entry.push_str(&format!("Details: {}\n", details));
        }

        // Add troubleshooting context for errors
        if level == "ERROR" {
            log_entry.push_str("\nPossible Causes:\n");
            match category {
                "LDAP_CONNECTION" => {
                    log_entry.push_str("  • LDAP server not reachable\n");
                    log_entry.push_str("  • Port 389 blocked by firewall\n");
                    log_entry.push_str("  • Network connectivity issues\n");
                }
                "CREDENTIALS" => {
                    log_entry.push_str("  • Windows Credential Manager access denied\n");
                    log_entry.push_str("  • Credential storage corrupted\n");
                }
                "RDP_LAUNCH" => {
                    log_entry.push_str("  • mstsc.exe not available\n");
                    log_entry.push_str("  • RDP file creation failed\n");
                }
                _ => {}
            }
        }

        log_entry.push_str(&format!("{}\n", "-".repeat(80)));

        let _ = write!(file, "{}", log_entry);
    }
}
```

### Usage Throughout Application

```rust
// Information logging
debug_log("INFO", "RDP_LAUNCH", "Starting RDP connection", None);

// Error logging with details
debug_log(
    "ERROR",
    "CREDENTIALS",
    "Failed to save credentials",
    Some(&format!("CredWriteW error: {:?}", error))
);

// Warning logging
debug_log("WARN", "CSV_OPERATIONS", "File not found, creating new", None);
```

---

## 9.5 Application Reset Functionality

### Secret Keyboard Shortcut

QuickConnect includes a hidden reset function activated with `Ctrl+Shift+Alt+R`:

```typescript
// In all window TypeScript files
import { showCustomDialog } from './utils/ui';

window.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.shiftKey && e.altKey && e.key === 'R') {
        e.preventDefault();
        
        const confirmed = await showCustomDialog({
            title: '⚠️ WARNING: Application Reset ⚠️',
            message:
                'This will permanently delete:\n' +
                '• All saved credentials\n' +
                '• All RDP connection files\n' +
                '• All saved hosts\n' +
                '• Recent connection history\n\n' +
                'This action CANNOT be undone!\n\n' +
                'Are you sure you want to continue?',
            type: 'warning',
            showCancel: true
        });
        
        if (!confirmed) return;

        const confirmedAgain = await showCustomDialog({
            title: 'FINAL CONFIRMATION',
            message:
                'This will COMPLETELY reset QuickConnect and permanently delete your data.\n\n' +
                'Press OK to proceed with the reset, or Cancel to abort.',
            type: 'error',
            showCancel: true
        });

        if (!confirmedAgain) return;
        
        try {
            const result = await invoke<string>("reset_application");
            await showCustomDialog({
                title: 'Success',
                message: result,
                type: 'success'
            });

            // Return to the initial credentials screen
            await invoke('show_login_window');
            
            const shouldQuit = await showCustomDialog({
                title: 'Reset Complete',
                message:
                    'It is recommended to restart the application.\n\n' +
                    'Do you want to quit now?',
                type: 'info',
                showCancel: true
            });
            
            if (shouldQuit) {
                await invoke("quit_app");
            }
        } catch (err) {
            await showCustomDialog({
                title: 'Error',
                message: 'Failed to reset application: ' + err,
                type: 'error'
            });
        }
    }
});
```

### Backend Implementation

```rust
// Production implementation (adapter-based, no direct Win32 calls here):
// see src-tauri/src/commands/system.rs
#[tauri::command]
pub async fn reset_application(app_handle: tauri::AppHandle) -> Result<String, String> {
    use crate::adapters::{CredentialManager, WindowsCredentialManager};
    use crate::infra::debug_log;

    debug_log(
        "WARN",
        "RESET",
        "Application reset initiated - deleting all credentials and data",
        None,
    );

    let mut report = String::from("=== QuickConnect Application Reset ===\n\n");
    let cred_manager = WindowsCredentialManager::new();

    // 1) Delete global QuickConnect credentials
    let _ = crate::commands::delete_credentials().await;

    // 2) Delete all TERMSRV/* credentials (per-host RDP credentials)
    if let Ok(targets) = cred_manager.list_with_prefix("TERMSRV/") {
        for target in targets {
            let _ = cred_manager.delete(&target);
        }
    }

    // 3) Delete all saved RDP files in %APPDATA%\QuickConnect\Connections
    // 4) Clear hosts list (hosts.csv)
    // 5) Delete recent_connections.json
    // (see the full implementation for detailed reporting)

    let _ = crate::commands::delete_all_hosts(app_handle).await;

    report.push_str("\n=== Reset Complete ===\n");
    Ok(report)
}
```

---

## 9.6 Autostart with Windows

### Registry Integration

QuickConnect can automatically start with Windows using the Registry:

```rust
const REGISTRY_RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const APP_NAME: &str = "QuickConnect";

#[tauri::command]
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
            &mut hkey as *mut HKEY,
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

#[tauri::command]
fn toggle_autostart() -> Result<bool, String> {
    let is_enabled = check_autostart()?;

    if is_enabled {
        disable_autostart()?;
        Ok(false)
    } else {
        enable_autostart()?;
        Ok(true)
    }
}

fn enable_autostart() -> Result<(), String> {
    unsafe {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?;

        let exe_path_str = exe_path.to_string_lossy().to_string();

        let key_path: Vec<u16> = OsStr::new(REGISTRY_RUN_KEY)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut hkey = HKEY::default();

        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(key_path.as_ptr()),
            0,
            KEY_WRITE,
            &mut hkey as *mut HKEY,
        ).map_err(|e| format!("Failed to open key: {:?}", e))?;

        let value_name: Vec<u16> = OsStr::new(APP_NAME)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let value_data: Vec<u16> = OsStr::new(&exe_path_str)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let result = RegSetValueExW(
            hkey,
            PCWSTR::from_raw(value_name.as_ptr()),
            0,
            REG_SZ,
            Some(&value_data.align_to::<u8>().1),
        );

        let _ = RegCloseKey(hkey);

        result.map_err(|e| format!("Failed to set value: {:?}", e))?;

        Ok(())
    }
}

fn disable_autostart() -> Result<(), String> {
    unsafe {
        let key_path: Vec<u16> = OsStr::new(REGISTRY_RUN_KEY)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut hkey = HKEY::default();

        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(key_path.as_ptr()),
            0,
            KEY_WRITE,
            &mut hkey as *mut HKEY,
        ).map_err(|e| format!("Failed to open key: {:?}", e))?;

        let value_name: Vec<u16> = OsStr::new(APP_NAME)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let result = RegDeleteValueW(hkey, PCWSTR::from_raw(value_name.as_ptr()));

        let _ = RegCloseKey(hkey);

        result.map_err(|e| format!("Failed to delete value: {:?}", e))?;

        Ok(())
    }
}
```

### Tray Menu Integration

The autostart toggle is integrated into the system tray menu:

```rust
fn build_tray_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let autostart_enabled = check_autostart().unwrap_or(false);
    let autostart_text = if autostart_enabled {
        "✓ Autostart with Windows"
    } else {
        "✗ Autostart with Windows"
    };
    
    let autostart_item = MenuItem::with_id(
        app,
        "toggle_autostart",
        &autostart_text,
        true,
        None::<&str>,
    )?;
    
    // ... rest of menu ...
}
```

---

## 9.7 Theme Management Across Windows

### Theme Storage

QuickConnect stores theme preference in AppData:

```rust
#[tauri::command]
fn set_theme(app_handle: tauri::AppHandle, theme: String) -> Result<(), String> {
    // Save preference
    let app_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create dir: {}", e))?;

    let theme_file = app_dir.join("theme.txt");
    std::fs::write(&theme_file, &theme)
        .map_err(|e| format!("Failed to write theme: {}", e))?;

    // Emit event to all windows
    for window_label in ["login", "main", "hosts", "about", "error"] {
        if let Some(window) = app_handle.get_webview_window(window_label) {
            let _ = window.emit("theme-changed", theme.clone());
        }
    }

    // Rebuild tray menu with new theme
    if let Some(tray) = app_handle.tray_by_id("main") {
        if let Ok(menu) = build_tray_menu(&app_handle, &theme) {
            let _ = tray.set_menu(Some(menu));
        }
    }

    Ok(())
}

#[tauri::command]
fn get_theme(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = match app_handle.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return get_windows_theme(),
    };

    let theme_file = app_dir.join("theme.txt");

    if theme_file.exists() {
        match std::fs::read_to_string(&theme_file) {
            Ok(theme) => Ok(theme.trim().to_string()),
            Err(_) => get_windows_theme(),
        }
    } else {
        get_windows_theme()
    }
}
```

### System Theme Detection

```rust
#[tauri::command]
fn get_windows_theme() -> Result<String, String> {
    unsafe {
        let key_path: Vec<u16> =
            OsStr::new("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

        let mut hkey = HKEY::default();

        let result = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey as *mut HKEY,
        );

        if result.is_err() {
            return Ok("dark".to_string());
        }

        let value_name: Vec<u16> = OsStr::new("AppsUseLightTheme")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut data_type = REG_VALUE_TYPE::default();
        let mut data: u32 = 0;
        let mut data_size: u32 = std::mem::size_of::<u32>() as u32;

        let query_result = RegQueryValueExW(
            hkey,
            PCWSTR::from_raw(value_name.as_ptr()),
            None,
            Some(&mut data_type),
            Some(&mut data as *mut u32 as *mut u8),
            Some(&mut data_size),
        );

        let _ = RegCloseKey(hkey);

        if query_result.is_ok() {
            if data == 0 {
                Ok("dark".to_string())
            } else {
                Ok("light".to_string())
            }
        } else {
            Ok("dark".to_string())
        }
    }
}
```

### Frontend Theme Handling

```typescript
async function initializeTheme() {
  let defaultTheme = 'dark';
  
  try {
    defaultTheme = await invoke<string>('get_theme');
  } catch (error) {
    console.log('Could not get saved theme, using dark as default:', error);
  }
  
  document.documentElement.setAttribute('data-theme', defaultTheme);
  
  // Listen for theme change events from tray menu
  await listen<string>('theme-changed', (event) => {
    const newTheme = event.payload;
    document.documentElement.setAttribute('data-theme', newTheme);
    console.log('Theme changed to:', newTheme);
  });
}
```

---

## 9.8 Single Instance Application

### Preventing Multiple Instances

QuickConnect uses `tauri-plugin-single-instance` to prevent multiple instances:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When second instance is launched, show the last hidden window
            let _ = app.emit("single-instance", ());
            
            if let Ok(window_label) = LAST_HIDDEN_WINDOW.lock() {
                if let Some(window) = app.get_webview_window(&window_label) {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }))
        // ... rest of setup ...
}
```

When the user tries to launch QuickConnect while it's already running:
1. The second instance is prevented from starting
2. The first instance receives a notification
3. The last active window is shown and focused

---

## 9.9 Key Takeaways

✅ **Error handling** - Centralized error window provides consistent UX

✅ **Recent connections** - Tracked in JSON, displayed in tray menu

✅ **Per-host credentials** - Individual credentials per server with fallback

✅ **Debug logging** - Comprehensive logging activated via command line

✅ **Application reset** - Complete cleanup with secret keyboard shortcut

✅ **Autostart integration** - Windows Registry integration for startup

✅ **Theme management** - Persistent theme with system detection fallback

✅ **Single instance** - Prevents duplicate processes, restores existing window

---

## Additional Resources

- [Windows Credential Manager API](https://docs.microsoft.com/windows/win32/api/wincred/)
- [Windows Registry API](https://docs.microsoft.com/windows/win32/sysinfo/registry)
- [Tauri Plugins](https://tauri.app/v1/guides/features/plugin/)
- [QuickConnect Entry Point (setup + command registration)](../src-tauri/src/lib.rs)

---

**You now understand all the advanced features that make QuickConnect production-ready!**

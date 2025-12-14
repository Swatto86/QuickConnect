# Chapter 18: Configuration and Settings Management

**Learning Objectives:**
- Understand different storage mechanisms for application settings
- Implement Windows Registry integration for system settings
- Manage theme persistence and preferences
- Handle recent connections tracking
- Build configuration systems that survive application updates

---

## 18.1 Introduction to Configuration Management

Application settings are the backbone of a good user experience. Users expect their preferences, recent activity, and customizations to persist across sessions and even application updates. In this chapter, we'll explore the various configuration patterns used in QuickConnect and learn when to use each approach.

### Types of Application Settings

**System-Level Settings** (Windows Registry):
- Autostart with Windows
- System integration preferences
- Machine-specific configuration

**User-Level Settings** (AppData Directory):
- Theme preferences
- UI customization
- Application-specific data

**Sensitive Data** (Windows Credential Manager):
- Passwords and credentials
- Authentication tokens
- Covered in Chapter 13

**Transient Data** (JSON Files):
- Recent connections
- Usage history
- Non-critical cached data

### QuickConnect's Configuration Architecture

QuickConnect uses a layered approach:

```
┌─────────────────────────────────────────┐
│      Windows Registry                    │
│  (Autostart, System Integration)        │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│      AppData\Roaming\QuickConnect            │
│  (theme.txt, recent_connections.json)   │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│      Windows Credential Manager          │
│  (Passwords, Sensitive Data)             │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│      Working Directory                   │
│  (hosts.csv - User-Editable Data)       │
└─────────────────────────────────────────┘
```

---

## 18.2 Windows Registry for System Settings

The Windows Registry is the ideal place for system-level settings that integrate with Windows itself. QuickConnect uses it for the "Autostart with Windows" feature.

### Understanding the Registry Structure

Windows stores startup applications in a specific registry key:

```
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
```

Each value in this key represents an application that should start when the user logs in.

### Reading from the Registry

Here's how QuickConnect checks if autostart is enabled:

```rust
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use windows::core::PCWSTR;
use windows::Win32::System::Registry::{
    RegOpenKeyExW, RegQueryValueExW, RegCloseKey,
    HKEY, HKEY_CURRENT_USER, KEY_READ,
};

const REGISTRY_RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const APP_NAME: &str = "QuickConnect";

#[tauri::command]
fn check_autostart() -> Result<bool, String> {
    unsafe {
        // Convert the registry path to wide string (UTF-16)
        let key_path: Vec<u16> = OsStr::new(REGISTRY_RUN_KEY)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut hkey = HKEY::default();

        // Open the registry key with read permissions
        let result = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey as *mut HKEY,
        );

        if result.is_err() {
            // Key doesn't exist or can't be opened
            return Ok(false);
        }

        // Convert our app name to wide string
        let value_name: Vec<u16> = OsStr::new(APP_NAME)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut data_size: u32 = 0;

        // Query the value to check if it exists
        let query_result = RegQueryValueExW(
            hkey,
            PCWSTR::from_raw(value_name.as_ptr()),
            None,           // Reserved, must be None
            None,           // Type - we don't need it
            None,           // Data - we're just checking existence
            Some(&mut data_size),
        );

        // Always close the key when done
        let _ = RegCloseKey(hkey);

        // If query succeeded, the value exists
        Ok(query_result.is_ok())
    }
}
```

**Key Concepts:**

1. **Wide String Conversion**: Windows APIs use UTF-16, so we convert Rust strings using `encode_wide()`
2. **RAII Pattern**: Always close registry keys with `RegCloseKey`
3. **Error Handling**: Registry operations can fail for many reasons (permissions, key doesn't exist, etc.)

### Writing to the Registry

Enabling autostart requires writing the executable path to the registry:

```rust
use windows::Win32::System::Registry::{
    RegSetValueExW, KEY_WRITE, REG_SZ,
};

fn enable_autostart() -> Result<(), String> {
    unsafe {
        // Get the current executable path
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;

        let exe_path_str = exe_path.to_string_lossy().to_string();

        debug_log(
            "INFO",
            "AUTOSTART",
            &format!("Enabling autostart with path: {}", exe_path_str),
            Some(&format!("Executable path: {}", exe_path_str)),
        );

        let key_path: Vec<u16> = OsStr::new(REGISTRY_RUN_KEY)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut hkey = HKEY::default();

        // Open the registry key with write access
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(key_path.as_ptr()),
            0,
            KEY_WRITE,  // Request write permission
            &mut hkey as *mut HKEY,
        )
        .map_err(|e| format!("Failed to open registry key: {:?}", e))?;

        let value_name: Vec<u16> = OsStr::new(APP_NAME)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Convert the executable path to wide string
        let value_data: Vec<u16> = OsStr::new(&exe_path_str)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Set the registry value
        let result = RegSetValueExW(
            hkey,
            PCWSTR::from_raw(value_name.as_ptr()),
            0,              // Reserved, must be 0
            REG_SZ,         // Type: null-terminated string
            Some(&value_data.align_to::<u8>().1),
        );

        // Always close the key
        let _ = RegCloseKey(hkey);

        result.map_err(|e| format!("Failed to set registry value: {:?}", e))?;

        debug_log(
            "INFO",
            "AUTOSTART",
            "Autostart enabled successfully",
            Some(&format!("Registry value set for {}", APP_NAME)),
        );
        Ok(())
    }
}
```

**Important Details:**

- `std::env::current_exe()` gets the full path to your application
- `REG_SZ` indicates a null-terminated string value
- `align_to::<u8>()` converts the u16 slice to bytes for the Windows API

### Deleting Registry Values

To disable autostart, we remove the registry value:

```rust
use windows::Win32::System::Registry::RegDeleteValueW;

fn disable_autostart() -> Result<(), String> {
    unsafe {
        debug_log("INFO", "AUTOSTART", "Disabling autostart", None);

        let key_path: Vec<u16> = OsStr::new(REGISTRY_RUN_KEY)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut hkey = HKEY::default();

        // Open the registry key with write access
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(key_path.as_ptr()),
            0,
            KEY_WRITE,
            &mut hkey as *mut HKEY,
        )
        .map_err(|e| format!("Failed to open registry key: {:?}", e))?;

        let value_name: Vec<u16> = OsStr::new(APP_NAME)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Delete the registry value
        let result = RegDeleteValueW(
            hkey,
            PCWSTR::from_raw(value_name.as_ptr())
        );

        let _ = RegCloseKey(hkey);

        result.map_err(|e| format!("Failed to delete registry value: {:?}", e))?;

        debug_log(
            "INFO",
            "AUTOSTART",
            "Autostart disabled successfully",
            Some(&format!("Registry value deleted for {}", APP_NAME)),
        );
        Ok(())
    }
}
```

### Creating a Toggle Command

For better UX, we create a toggle command that handles both states:

```rust
#[tauri::command]
fn toggle_autostart() -> Result<bool, String> {
    let is_enabled = check_autostart()?;

    if is_enabled {
        // Disable autostart - remove from registry
        disable_autostart()?;
        Ok(false)
    } else {
        // Enable autostart - add to registry
        enable_autostart()?;
        Ok(true)
    }
}
```

This returns the new state, making it easy for the frontend to update the UI.

---

## 18.3 Theme Persistence with AppData

Theme preferences are user-specific and should persist across application updates. QuickConnect stores them in the AppData directory.

### Understanding AppData Directory

Windows provides three AppData locations:

- **Roaming** (`%APPDATA%`): Syncs across computers in a domain
- **Local** (`%LOCALAPPDATA%`): Stays on the current computer
- **LocalLow**: For lower-privilege applications

QuickConnect uses Roaming AppData for theme preferences, allowing them to follow users across computers.

### Getting the AppData Directory

Tauri provides a convenient path API:

```rust
#[tauri::command]
fn get_theme(app_handle: tauri::AppHandle) -> Result<String, String> {
    // Try to read the saved theme preference
    let app_dir = match app_handle.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return get_windows_theme(), // Fallback to Windows theme
    };

    let theme_file = app_dir.join("theme.txt");

    if theme_file.exists() {
        match std::fs::read_to_string(&theme_file) {
            Ok(theme) => Ok(theme.trim().to_string()),
            Err(_) => get_windows_theme(), // Fallback to Windows theme
        }
    } else {
        get_windows_theme() // Fallback to Windows theme
    }
}
```

**Design Decisions:**

1. **Fallback Strategy**: If the saved theme can't be read, fall back to the Windows system theme
2. **Simple Format**: A plain text file is perfect for a single string value
3. **Trim Whitespace**: Always trim to handle newlines and spaces

### Detecting the Windows System Theme

QuickConnect can detect whether Windows is using light or dark mode:

```rust
use windows::Win32::System::Registry::REG_VALUE_TYPE;

#[tauri::command]
fn get_windows_theme() -> Result<String, String> {
    unsafe {
        // Windows theme is stored in the registry at:
        // HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize
        // Value: AppsUseLightTheme (0 = dark, 1 = light)

        let key_path: Vec<u16> =
            OsStr::new("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

        let mut hkey = HKEY::default();

        // Open the registry key
        let result = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR::from_raw(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey as *mut HKEY,
        );

        if result.is_err() {
            // If we can't read the registry, default to dark theme
            return Ok("dark".to_string());
        }

        let value_name: Vec<u16> = OsStr::new("AppsUseLightTheme")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut data_type = REG_VALUE_TYPE::default();
        let mut data: u32 = 0;
        let mut data_size: u32 = std::mem::size_of::<u32>() as u32;

        // Query the value
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
            // 0 = dark theme, 1 (or any other value) = light theme
            if data == 0 {
                Ok("dark".to_string())
            } else {
                Ok("light".to_string())
            }
        } else {
            // Default to dark if we can't read the value
            Ok("dark".to_string())
        }
    }
}
```

This provides a seamless experience where the app matches the user's Windows theme by default.

### Saving Theme Preferences

When the user changes the theme, we save it and notify all windows:

```rust
use tauri::Emitter;

#[tauri::command]
fn set_theme(app_handle: tauri::AppHandle, theme: String) -> Result<(), String> {
    // Save the theme preference in the app's data directory
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let theme_file = app_dir.join("theme.txt");
    std::fs::write(&theme_file, &theme)
        .map_err(|e| format!("Failed to write theme preference: {}", e))?;

    // Emit an event to all windows to update their theme
    for window_label in ["login", "main", "hosts", "about"] {
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
```

**Key Techniques:**

1. **Event Emission**: All windows are notified via the `theme-changed` event
2. **Tray Menu Update**: The system tray menu is rebuilt with checkmarks showing the active theme
3. **Create Directory**: `create_dir_all` ensures the directory exists before writing

---

## 18.4 Recent Connections Tracking

Recent connections enhance UX by allowing quick access to frequently used hosts. QuickConnect tracks the last 5 connections in a JSON file.

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

**Design Choices:**

- **Unix Timestamp**: Simple, sortable, no timezone issues
- **Deduplication**: Connecting to the same host moves it to the top
- **Size Limit**: Only the 5 most recent connections are kept

### File Operations

Getting the file path:

```rust
use std::path::PathBuf;

fn get_recent_connections_file() -> Result<PathBuf, String> {
    let appdata_dir = std::env::var("APPDATA")
        .map_err(|_| "Failed to get APPDATA directory".to_string())?;
    let QuickConnect_dir = PathBuf::from(appdata_dir).join("QuickConnect");
    std::fs::create_dir_all(&QuickConnect_dir)
        .map_err(|e| format!("Failed to create QuickConnect directory: {}", e))?;
    Ok(QuickConnect_dir.join("recent_connections.json"))
}
```

Saving to JSON:

```rust
fn save_recent_connections(recent: &RecentConnections) -> Result<(), String> {
    let file_path = get_recent_connections_file()?;
    let json = serde_json::to_string_pretty(recent)
        .map_err(|e| format!("Failed to serialize recent connections: {}", e))?;
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write recent connections: {}", e))?;
    Ok(())
}
```

Loading from JSON:

```rust
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

### Tauri Command Interface

```rust
#[tauri::command]
fn get_recent_connections() -> Result<Vec<RecentConnection>, String> {
    let recent = load_recent_connections()?;
    Ok(recent.connections)
}
```

### Integration with RDP Launch

Every time a connection is launched, it's added to recent connections:

```rust
#[tauri::command]
async fn launch_rdp(app_handle: tauri::AppHandle, host: Host) -> Result<(), String> {
    // ... RDP launch logic ...

    // Save to recent connections
    if let Ok(mut recent) = load_recent_connections() {
        recent.add_connection(host.hostname.clone(), host.description.clone());
        let _ = save_recent_connections(&recent);
    }

    Ok(())
}
```

---

## 18.5 System Tray Recent Connections

QuickConnect displays recent connections in the system tray menu for quick access.

### Dynamic Menu Building

```rust
use tauri::menu::{Menu, MenuItem, Submenu};

fn build_tray_menu(
    app: &tauri::AppHandle, 
    current_theme: &str
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    // ... other menu items ...

    // Create recent connections submenu
    let recent_connections = load_recent_connections()
        .unwrap_or_else(|_| RecentConnections::new());
    
    let recent_submenu = if recent_connections.connections.is_empty() {
        let no_recent = MenuItem::with_id(
            app,
            "no_recent",
            "No recent connections",
            false,  // Disabled
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
        let items: Vec<_> = recent_connections.connections
            .iter()
            .map(|conn| {
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
            })
            .collect::<Result<Vec<_>, _>>()?;
        
        let item_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = 
            items.iter()
                .map(|item| item as &dyn tauri::menu::IsMenuItem<tauri::Wry>)
                .collect();
        
        Submenu::with_items(
            app,
            "Recent Connections",
            true,
            &item_refs,
        )?
    };

    // ... build complete menu ...
    
    Menu::with_items(
        app,
        &[&recent_submenu, /* other items */],
    ).map_err(|e| e.into())
}
```

### Handling Recent Connection Clicks

```rust
.on_menu_event(|app, event| {
    let id_str = event.id().as_ref();
    
    // Check if it's a recent connection item
    if id_str.starts_with("recent_") {
        let hostname = id_str.strip_prefix("recent_").unwrap_or("").to_string();
        if !hostname.is_empty() {
            // Get the host details and launch RDP
            tauri::async_runtime::spawn(async move {
                match get_hosts() {
                    Ok(hosts) => {
                        if let Some(host) = hosts.into_iter()
                            .find(|h| h.hostname == hostname) 
                        {
                            if let Err(e) = launch_rdp(host).await {
                                eprintln!("Failed to launch RDP to {}: {}", hostname, e);
                            }
                        } else {
                            // Host not in list, create a temporary host entry
                            let host = Host {
                                hostname: hostname.clone(),
                                description: String::new(),
                                last_connected: None,
                            };
                            if let Err(e) = launch_rdp(host).await {
                                eprintln!("Failed to launch RDP to {}: {}", hostname, e);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to get hosts: {}", e);
                    }
                }
            });
        }
        return;
    }
    
    // ... handle other menu events ...
})
```

---

## 18.6 Frontend Theme Initialization

The frontend needs to initialize the theme on page load and respond to theme changes.

### Theme Initialization

```typescript
async function initializeTheme() {
  let defaultTheme = 'dark';
  
  // Try to get saved theme preference
  try {
    defaultTheme = await invoke<string>('get_theme');
  } catch (error) {
    console.log('Could not get saved theme, using dark as default:', error);
  }
  
  document.documentElement.setAttribute('data-theme', defaultTheme);
  
  // Listen for theme change events from the system tray
  await listen<string>('theme-changed', (event) => {
    const newTheme = event.payload;
    document.documentElement.setAttribute('data-theme', newTheme);
    console.log('Theme changed to:', newTheme);
  });
}

// Call during page initialization
document.addEventListener("DOMContentLoaded", async () => {
    await initializeTheme();
    // ... rest of initialization ...
});
```

**Key Points:**

1. **Event Listener**: Set up before any theme changes can occur
2. **Fallback**: Default to dark theme if the command fails
3. **DOM Attribute**: DaisyUI uses the `data-theme` attribute

---

## 18.7 Configuration Best Practices

### 1. Fail Gracefully

Configuration should never prevent the app from running:

```rust
fn get_theme(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = match app_handle.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return get_windows_theme(), // Fallback
    };

    let theme_file = app_dir.join("theme.txt");

    if theme_file.exists() {
        match std::fs::read_to_string(&theme_file) {
            Ok(theme) => Ok(theme.trim().to_string()),
            Err(_) => get_windows_theme(), // Fallback
        }
    } else {
        get_windows_theme() // Fallback
    }
}
```

### 2. Provide Sensible Defaults

Always have a default value:

```rust
fn load_recent_connections() -> Result<RecentConnections, String> {
    let file_path = get_recent_connections_file()?;
    if !file_path.exists() {
        return Ok(RecentConnections::new()); // Empty is a valid default
    }
    // ... load from file ...
}
```

### 3. Use Appropriate Storage

Choose the right location for each type of data:

| Data Type | Storage Location | Reason |
|-----------|------------------|--------|
| System integration | Windows Registry | OS-level settings |
| User preferences | AppData | Survives updates |
| Sensitive data | Credential Manager | Encrypted by OS |
| User-editable data | Working directory | Easy to find/edit |
| Temporary data | Temp directory | Cleaned automatically |

### 4. Handle Concurrent Access

Settings files can be accessed by multiple instances:

```rust
use std::fs::OpenOptions;

fn save_recent_connections(recent: &RecentConnections) -> Result<(), String> {
    let file_path = get_recent_connections_file()?;
    let json = serde_json::to_string_pretty(recent)
        .map_err(|e| format!("Failed to serialize recent connections: {}", e))?;
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write recent connections: {}", e))?;
    
    Ok(())
}
```

### 5. Version Your Configuration

Plan for future changes:

```rust
#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct RecentConnections {
    version: u32,  // Add version field
    connections: Vec<RecentConnection>,
}

impl RecentConnections {
    fn new() -> Self {
        Self {
            version: 1,
            connections: Vec::new(),
        }
    }
}
```

---

## 18.8 Testing Configuration Systems

### Unit Testing Registry Operations

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_autostart_toggle() {
        // Enable autostart
        let result = enable_autostart();
        assert!(result.is_ok());
        
        // Check that it's enabled
        let is_enabled = check_autostart().unwrap();
        assert!(is_enabled);
        
        // Disable autostart
        let result = disable_autostart();
        assert!(result.is_ok());
        
        // Check that it's disabled
        let is_enabled = check_autostart().unwrap();
        assert!(!is_enabled);
    }
}
```

### Testing Recent Connections

```rust
#[test]
fn test_recent_connections_limit() {
    let mut recent = RecentConnections::new();
    
    // Add 10 connections
    for i in 0..10 {
        recent.add_connection(
            format!("host{}", i),
            format!("Description {}", i),
        );
    }
    
    // Should only keep 5
    assert_eq!(recent.connections.len(), 5);
    
    // Most recent should be host9
    assert_eq!(recent.connections[0].hostname, "host9");
}

#[test]
fn test_recent_connections_deduplication() {
    let mut recent = RecentConnections::new();
    
    recent.add_connection("host1".to_string(), "Desc 1".to_string());
    recent.add_connection("host2".to_string(), "Desc 2".to_string());
    recent.add_connection("host1".to_string(), "Desc 1 Updated".to_string());
    
    // Should have 2 connections
    assert_eq!(recent.connections.len(), 2);
    
    // host1 should be first (most recent)
    assert_eq!(recent.connections[0].hostname, "host1");
    assert_eq!(recent.connections[0].description, "Desc 1 Updated");
}
```

---

## 18.9 Configuration Migration

As your application evolves, you may need to migrate old configuration formats.

### Example Migration Strategy

```rust
#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct RecentConnectionsV1 {
    connections: Vec<RecentConnection>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct RecentConnectionsV2 {
    version: u32,
    connections: Vec<RecentConnection>,
    last_updated: u64,
}

fn load_recent_connections() -> Result<RecentConnectionsV2, String> {
    let file_path = get_recent_connections_file()?;
    if !file_path.exists() {
        return Ok(RecentConnectionsV2::new());
    }
    
    let json = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read: {}", e))?;
    
    // Try to load as V2 first
    if let Ok(v2) = serde_json::from_str::<RecentConnectionsV2>(&json) {
        return Ok(v2);
    }
    
    // Fall back to V1 and migrate
    if let Ok(v1) = serde_json::from_str::<RecentConnectionsV1>(&json) {
        let v2 = RecentConnectionsV2 {
            version: 2,
            connections: v1.connections,
            last_updated: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        };
        
        // Save the migrated version
        let _ = save_recent_connections(&v2);
        
        return Ok(v2);
    }
    
    // Couldn't parse as either version
    Err("Invalid configuration format".to_string())
}
```

---

## 18.10 Key Takeaways

1. **Use the Right Storage**: Registry for system integration, AppData for user settings, Credential Manager for secrets

2. **Fail Gracefully**: Configuration errors should never crash your app

3. **Provide Defaults**: Always have sensible fallback values

4. **Notify Changes**: Use events to keep all windows synchronized

5. **Plan for Growth**: Version your configuration and have migration strategies

6. **Test Thoroughly**: Configuration systems are critical - test edge cases

7. **Document Locations**: Make it easy for users to find and understand their data

---

## 18.11 Practice Exercises

### Exercise 1: Add Window Position Persistence

Implement a system to save and restore window positions across sessions.

**Requirements:**
- Save window position when it's moved
- Restore position on next launch
- Handle multi-monitor scenarios
- Provide a "Reset Window Positions" option

**Hints:**
- Use Tauri's window events to detect moves
- Store positions in AppData as JSON
- Use `window.set_position()` to restore
- Consider screen bounds validation

<details>
<summary>Solution Approach</summary>

```rust
#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct WindowPosition {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct WindowPositions {
    login: Option<WindowPosition>,
    main: Option<WindowPosition>,
    hosts: Option<WindowPosition>,
}

#[tauri::command]
fn save_window_position(
    window_label: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let mut positions = load_window_positions()?;
    
    let pos = WindowPosition { x, y, width, height };
    
    match window_label.as_str() {
        "login" => positions.login = Some(pos),
        "main" => positions.main = Some(pos),
        "hosts" => positions.hosts = Some(pos),
        _ => return Err("Unknown window".to_string()),
    }
    
    save_window_positions(&positions)?;
    Ok(())
}

#[tauri::command]
fn get_window_position(window_label: String) -> Result<Option<WindowPosition>, String> {
    let positions = load_window_positions()?;
    
    let pos = match window_label.as_str() {
        "login" => positions.login,
        "main" => positions.main,
        "hosts" => positions.hosts,
        _ => return Err("Unknown window".to_string()),
    };
    
    Ok(pos)
}
```

Frontend:

```typescript
// Listen for window move events
import { getCurrentWindow } from '@tauri-apps/api/window';

const window = getCurrentWindow();

window.listen('tauri://move', async () => {
    const position = await window.outerPosition();
    const size = await window.outerSize();
    
    await invoke('save_window_position', {
        windowLabel: window.label,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    });
});

// On startup, restore position
async function restoreWindowPosition() {
    const position = await invoke<WindowPosition | null>('get_window_position', {
        windowLabel: window.label,
    });
    
    if (position) {
        await window.setPosition(new LogicalPosition(position.x, position.y));
        await window.setSize(new LogicalSize(position.width, position.height));
    }
}
```

</details>

### Exercise 2: Implement a Settings Panel

Create a dedicated settings window with all configurable options.

**Requirements:**
- Show current theme
- Show autostart status
- Allow clearing recent connections
- Reset all settings option
- Export/import settings

### Exercise 3: Add Language Preferences

Extend the theme system to support multiple languages.

**Requirements:**
- Store language preference in AppData
- Provide language selection in settings
- Load language files from JSON
- Support at least English and one other language

---

## 18.12 Further Reading

**Windows Registry:**
- [Microsoft Docs: Registry Functions](https://docs.microsoft.com/en-us/windows/win32/sysinfo/registry-functions)
- [windows-rs Documentation](https://microsoft.github.io/windows-docs-rs/)

**File Formats:**
- [TOML vs JSON vs YAML](https://www.thoughtworks.com/insights/blog/configuration-file-formats)
- [serde Documentation](https://serde.rs/)

**Cross-Platform Configuration:**
- [dirs crate](https://docs.rs/dirs/latest/dirs/)
- [confy crate](https://docs.rs/confy/latest/confy/) - Simple configuration management

**Best Practices:**
- [12-Factor App: Config](https://12factor.net/config)
- [Configuration Management Patterns](https://martinfowler.com/articles/consumerDrivenContracts.html)

---

**Next Chapter Preview:**  
In Chapter 19, we'll explore keyboard shortcuts and global hotkeys, learning how to implement Ctrl+Shift+R to show windows and the secret Ctrl+Shift+Alt+R reset shortcut. We'll cover the `tauri-plugin-global-shortcut` and best practices for keyboard input handling.

**Chapter Progress:** ✅ Completed  
**Pages:** 52

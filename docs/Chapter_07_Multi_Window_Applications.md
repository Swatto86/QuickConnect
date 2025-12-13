# Chapter 7: Multi-Window Applications

**Estimated Reading Time:** 25-30 minutes  
**Difficulty Level:** Intermediate

---

## Introduction

Most desktop applications aren't limited to a single window. Think about how you use software daily—settings dialogs, about windows, error popups, and specialized tool windows are all separate windows working together. In this chapter, we'll explore how to build **multi-window applications** in Tauri.

QuickConnect is an excellent example of a multi-window application. It uses five distinct windows:
1. **Login Window** - Initial authentication screen
2. **Main Window** - Primary connection interface
3. **Hosts Window** - Manage saved RDP hosts
4. **About Window** - Application information
5. **Error Window** - Centralized error display

By the end of this chapter, you'll understand:
- How to configure multiple windows in `tauri.conf.json`
- Creating, showing, hiding, and closing windows from Rust
- Managing window state and lifecycle
- Implementing inter-window communication
- Building modal dialogs and utility windows
- Best practices for multi-window architecture

---

## 7.1 Window Configuration in tauri.conf.json

### The Windows Array

Every Tauri application's windows are defined in `tauri.conf.json`. Let's examine QuickConnect's complete window configuration:

```json
{
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "label": "login",
        "width": 400,
        "height": 370,
        "resizable": false,
        "title": "QuickConnect",
        "url": "index.html",
        "transparent": true,
        "decorations": true,
        "visible": false,
        "focus": true,
        "skipTaskbar": false,
        "alwaysOnTop": false,
        "center": true
      },
      {
        "label": "main",
        "width": 800,
        "height": 400,
        "minWidth": 800,
        "minHeight": 400,
        "resizable": true,
        "title": "QuickConnect",
        "url": "main.html",
        "transparent": false,
        "decorations": true,
        "visible": false,
        "focus": true,
        "skipTaskbar": false,
        "alwaysOnTop": false,
        "center": true
      },
      {
        "label": "hosts",
        "width": 800,
        "height": 400,
        "minWidth": 600,
        "minHeight": 500,
        "resizable": true,
        "title": "QuickConnect",
        "url": "hosts.html",
        "transparent": false,
        "decorations": true,
        "visible": false,
        "focus": true,
        "skipTaskbar": false,
        "alwaysOnTop": false,
        "center": true
      },
      {
        "label": "about",
        "width": 420,
        "height": 480,
        "resizable": false,
        "title": "About QuickConnect",
        "url": "about.html",
        "transparent": false,
        "decorations": true,
        "visible": false,
        "focus": true,
        "skipTaskbar": true,
        "alwaysOnTop": true,
        "center": true
      },
      {
        "label": "error",
        "width": 700,
        "height": 500,
        "minWidth": 500,
        "minHeight": 400,
        "resizable": true,
        "title": "Error - QuickConnect",
        "url": "error.html",
        "transparent": false,
        "decorations": true,
        "visible": false,
        "focus": true,
        "skipTaskbar": true,
        "alwaysOnTop": true,
        "center": true
      }
    ]
  }
}
```

### Understanding Window Properties

Let's break down each property and understand when to use each:

#### Essential Properties

| Property | Type | Description | Example Use Case |
|----------|------|-------------|------------------|
| `label` | String | **Unique identifier** for the window | `"login"`, `"main"`, `"about"` |
| `url` | String | HTML file to load (relative to dist folder) | `"index.html"`, `"main.html"` |
| `title` | String | Window title bar text | `"QuickConnect"`, `"Error - QuickConnect"` |

#### Size Properties

| Property | Type | Description | Example Use Case |
|----------|------|-------------|------------------|
| `width` | Number | Initial window width in pixels | `800` |
| `height` | Number | Initial window height in pixels | `400` |
| `minWidth` | Number | Minimum allowed width | `600` (prevents UI breakage) |
| `minHeight` | Number | Minimum allowed height | `400` (keeps controls visible) |
| `maxWidth` | Number | Maximum allowed width | Rarely needed |
| `maxHeight` | Number | Maximum allowed height | Rarely needed |
| `resizable` | Boolean | Allow user to resize window | `true` for main, `false` for dialogs |

#### Position Properties

| Property | Type | Description | Example Use Case |
|----------|------|-------------|------------------|
| `center` | Boolean | Center window on screen at startup | `true` for most windows |
| `x` | Number | Specific X coordinate (overrides center) | `100` |
| `y` | Number | Specific Y coordinate (overrides center) | `100` |

#### Visibility Properties

| Property | Type | Description | Example Use Case |
|----------|------|-------------|------------------|
| `visible` | Boolean | Show window immediately on creation | `false` = create hidden, show later |
| `focus` | Boolean | Give window focus when shown | `true` for dialogs |
| `alwaysOnTop` | Boolean | Keep window above other windows | `true` for errors/alerts |
| `skipTaskbar` | Boolean | Hide from taskbar | `true` for utility windows |

#### Style Properties

| Property | Type | Description | Example Use Case |
|----------|------|-------------|------------------|
| `decorations` | Boolean | Show native title bar and borders | `true` = standard window |
| `transparent` | Boolean | Transparent window background | `true` for custom-shaped windows |
| `fullscreen` | Boolean | Start in fullscreen mode | Rarely used in Tauri |

---

## 7.2 Window Types and Design Patterns

Different windows serve different purposes. Let's examine common patterns:

### Pattern 1: The Main Window

**Characteristics:**
- Resizable and shows in taskbar
- Primary interface for the application
- Should restore size/position on relaunch

```json
{
  "label": "main",
  "width": 800,
  "height": 600,
  "minWidth": 800,
  "minHeight": 400,
  "resizable": true,
  "visible": false,
  "skipTaskbar": false,
  "alwaysOnTop": false,
  "center": true
}
```

**When to use:**
- Primary application interface
- Multi-tab or multi-section interfaces
- Long-running user sessions

---

### Pattern 2: Modal Dialogs

**Characteristics:**
- Fixed size (not resizable)
- Always on top
- Hidden from taskbar
- Centered on screen

```json
{
  "label": "about",
  "width": 420,
  "height": 480,
  "resizable": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "visible": false,
  "center": true
}
```

**When to use:**
- About/settings windows
- Confirmation dialogs
- Simple forms or data entry

---

### Pattern 3: Utility Windows

**Characteristics:**
- Resizable but with minimum sizes
- Can be shown alongside main window
- May skip taskbar

```json
{
  "label": "hosts",
  "width": 800,
  "height": 400,
  "minWidth": 600,
  "minHeight": 500,
  "resizable": true,
  "visible": false,
  "skipTaskbar": false,
  "center": true
}
```

**When to use:**
- Management interfaces (hosts, connections)
- Log viewers
- Property inspectors

---

### Pattern 4: Error/Alert Windows

**Characteristics:**
- Resizable for long error messages
- Always on top to ensure visibility
- Hidden from taskbar
- Auto-focus when shown

```json
{
  "label": "error",
  "width": 700,
  "height": 500,
  "minWidth": 500,
  "minHeight": 400,
  "resizable": true,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "visible": false,
  "focus": true,
  "center": true
}
```

**When to use:**
- Critical error display
- Warning messages
- Important notifications

---

## 7.3 Window Management from Rust

### Accessing Windows with AppHandle

The `AppHandle` gives you access to all windows in your application. Here's how to get a reference to a specific window:

```rust
#[tauri::command]
fn show_about(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Get window by label (the "label" from tauri.conf.json)
    if let Some(about_window) = app_handle.get_webview_window("about") {
        // Window exists, show it
        about_window.show().map_err(|e| e.to_string())?;
        about_window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        // Window doesn't exist (shouldn't happen with pre-configured windows)
        Err("About window not found".to_string())
    }
}
```

**Key Concepts:**

1. **`app_handle.get_webview_window(label)`** - Returns `Option<WebviewWindow>`
2. **`if let Some(window) = ...`** - Safe pattern for handling missing windows
3. **`.show()`** - Makes a hidden window visible
4. **`.set_focus()`** - Brings window to front and gives it keyboard focus

---

### Common Window Operations

#### Showing and Hiding Windows

```rust
use tauri::Manager;

#[tauri::command]
fn toggle_window(app_handle: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window(&label) {
        if window.is_visible().map_err(|e| e.to_string())? {
            window.hide().map_err(|e| e.to_string())?;
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
        Ok(())
    } else {
        Err(format!("Window '{}' not found", label))
    }
}
```

**Available Methods:**
- `.show()` - Make window visible
- `.hide()` - Hide window (keeps it in memory)
- `.close()` - Close window completely (removes from memory)
- `.is_visible()` - Check if window is currently visible

---

#### Focusing and Positioning

```rust
#[tauri::command]
fn bring_window_to_front(app_handle: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window(&label) {
        // Make sure it's visible
        window.show().map_err(|e| e.to_string())?;
        
        // Bring to front
        window.set_focus().map_err(|e| e.to_string())?;
        
        // Optionally center it
        window.center().map_err(|e| e.to_string())?;
        
        Ok(())
    } else {
        Err(format!("Window '{}' not found", label))
    }
}
```

**Positioning Methods:**
- `.set_focus()` - Give window keyboard focus and bring to front
- `.center()` - Center window on screen
- `.set_position(position)` - Move to specific coordinates
- `.set_size(size)` - Resize window programmatically

---

#### Window State Queries

```rust
#[tauri::command]
fn get_window_info(app_handle: tauri::AppHandle, label: String) -> Result<String, String> {
    if let Some(window) = app_handle.get_webview_window(&label) {
        let is_visible = window.is_visible().map_err(|e| e.to_string())?;
        let is_focused = window.is_focused().map_err(|e| e.to_string())?;
        let is_minimized = window.is_minimized().map_err(|e| e.to_string())?;
        let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;
        
        let info = format!(
            "Window '{}': visible={}, focused={}, minimized={}, maximized={}",
            label, is_visible, is_focused, is_minimized, is_maximized
        );
        
        Ok(info)
    } else {
        Err(format!("Window '{}' not found", label))
    }
}
```

**Query Methods:**
- `.is_visible()` - Is window visible?
- `.is_focused()` - Does window have focus?
- `.is_minimized()` - Is window minimized?
- `.is_maximized()` - Is window maximized?
- `.is_resizable()` - Can window be resized?
- `.is_decorated()` - Does window have title bar?

---

## 7.4 Window Lifecycle and State Management

### Creating Windows Dynamically

While QuickConnect pre-defines all windows in `tauri.conf.json`, you can also create windows dynamically at runtime:

```rust
use tauri::{Manager, WindowBuilder};

#[tauri::command]
fn create_dynamic_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Check if window already exists
    if app_handle.get_webview_window("dynamic").is_some() {
        return Err("Window already exists".to_string());
    }
    
    // Create new window
    WindowBuilder::new(
        &app_handle,
        "dynamic", // label
        tauri::WindowUrl::App("dynamic.html".into())
    )
    .title("Dynamic Window")
    .inner_size(800.0, 600.0)
    .resizable(true)
    .center()
    .build()
    .map_err(|e| e.to_string())?;
    
    Ok(())
}
```

**When to Create Windows Dynamically:**
- ✅ Multiple instances of the same window type (e.g., multiple document windows)
- ✅ Windows created based on user actions (e.g., opening files)
- ✅ Dynamic content windows that may or may not be needed

**When to Pre-configure in tauri.conf.json:**
- ✅ Windows that are always part of the application (login, main, about)
- ✅ Windows with specific startup configurations
- ✅ Better performance (loaded at startup)

---

### Window Lifecycle Events

Windows go through various lifecycle stages. You can listen to these events:

```rust
use tauri::{Manager, WindowEvent};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Get a window and listen to its events
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(|event| {
                    match event {
                        WindowEvent::CloseRequested { api, .. } => {
                            println!("Window close requested");
                            // You can prevent closing:
                            // api.prevent_close();
                        }
                        WindowEvent::Focused(focused) => {
                            println!("Window focus changed: {}", focused);
                        }
                        WindowEvent::Resized(size) => {
                            println!("Window resized: {}x{}", size.width, size.height);
                        }
                        WindowEvent::Moved(position) => {
                            println!("Window moved to: {},{}",position.x, position.y);
                        }
                        WindowEvent::Destroyed => {
                            println!("Window destroyed");
                        }
                        _ => {}
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Available Window Events:**
- `CloseRequested` - User clicked close button (can be prevented)
- `Focused` - Window gained or lost focus
- `Resized` - Window was resized
- `Moved` - Window was moved
- `Destroyed` - Window was completely destroyed
- `ThemeChanged` - System theme changed (dark/light mode)

---

### Preventing Window Close

Sometimes you want to confirm before closing a window:

```rust
use tauri::{Manager, WindowEvent};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(main_window) = app.get_webview_window("main") {
                main_window.on_window_event(|event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        // Prevent the window from closing
                        api.prevent_close();
                        
                        // Show a confirmation dialog (you'd implement this)
                        // If confirmed, call window.close() manually
                        println!("Close prevented - show confirmation dialog");
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 7.5 Inter-Window Communication

Windows in Tauri need to communicate with each other. There are three primary methods:

### Method 1: Events (Recommended)

**Scenario:** The main window needs to notify the error window about an error.

**From Rust Backend:**

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
    
    // Emit event to the error window specifically
    if let Some(error_window) = app_handle.get_webview_window("error") {
        error_window.emit("show-error", &payload)
            .map_err(|e| e.to_string())?;
        
        // Show and focus the window
        error_window.show().map_err(|e| e.to_string())?;
        error_window.set_focus().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

**In the Error Window Frontend (error.ts):**

```typescript
import { listen } from '@tauri-apps/api/event';

interface ErrorPayload {
  message: string;
  timestamp: string;
  category?: string;
  details?: string;
}

// Listen for error events
await listen<ErrorPayload>('show-error', (event) => {
  const error = event.payload;
  
  // Update UI with error details
  document.getElementById('error-message')!.textContent = error.message;
  document.getElementById('error-time')!.textContent = error.timestamp;
  
  if (error.category) {
    document.getElementById('error-category')!.textContent = error.category;
  }
  
  if (error.details) {
    document.getElementById('error-details')!.textContent = error.details;
  }
});
```

**Benefits:**
- ✅ Decoupled - sender doesn't need to know about receiver implementation
- ✅ Multiple listeners can respond to same event
- ✅ Works even if target window is hidden
- ✅ Type-safe with TypeScript interfaces

---

### Method 2: Shared State (AppHandle State)

For data that needs to be accessed by multiple windows, use Tauri's state management:

```rust
use std::sync::Mutex;
use tauri::State;

// Define shared state
struct AppState {
    current_user: Mutex<Option<String>>,
    connection_count: Mutex<u32>,
}

// Initialize state in setup
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            current_user: Mutex::new(None),
            connection_count: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            set_current_user,
            get_current_user,
            increment_connections
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Commands that use shared state
#[tauri::command]
fn set_current_user(state: State<AppState>, username: String) -> Result<(), String> {
    let mut user = state.current_user.lock().map_err(|e| e.to_string())?;
    *user = Some(username);
    Ok(())
}

#[tauri::command]
fn get_current_user(state: State<AppState>) -> Result<Option<String>, String> {
    let user = state.current_user.lock().map_err(|e| e.to_string())?;
    Ok(user.clone())
}

#[tauri::command]
fn increment_connections(state: State<AppState>) -> Result<u32, String> {
    let mut count = state.connection_count.lock().map_err(|e| e.to_string())?;
    *count += 1;
    Ok(*count)
}
```

**From Any Window:**

```typescript
import { invoke } from '@tauri-apps/api/core';

// Set user in login window
await invoke('set_current_user', { username: 'admin' });

// Read user in main window
const user = await invoke<string | null>('get_current_user');
console.log('Current user:', user);
```

**Benefits:**
- ✅ Centralized state management
- ✅ Thread-safe with Mutex
- ✅ Persists across window lifecycle
- ✅ Any window can access state

---

### Method 3: Global Events (Broadcast)

Sometimes you want to notify ALL windows about something:

```rust
use tauri::Manager;

#[tauri::command]
fn broadcast_theme_change(app_handle: tauri::AppHandle, theme: String) -> Result<(), String> {
    // Emit to ALL windows
    app_handle.emit("theme-changed", theme)
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

**In Every Window's Frontend:**

```typescript
import { listen } from '@tauri-apps/api/event';

await listen<string>('theme-changed', (event) => {
  const newTheme = event.payload;
  document.documentElement.setAttribute('data-theme', newTheme);
  console.log('Theme changed to:', newTheme);
});
```

**Benefits:**
- ✅ Simple broadcast mechanism
- ✅ All windows automatically receive updates
- ✅ Good for global settings changes

---

## 7.6 QuickConnect Multi-Window System Analysis

Let's examine how QuickConnect orchestrates its five windows:

### Window Flow Diagram

```
[Application Start]
        ↓
   [Login Window]
   - Credential entry
   - Domain authentication
        ↓
   [Success] → [Main Window]
                - RDP connections
                - Quick search
                     ↓
             [User Actions]
                  ↓
        ┌─────────┼─────────┐
        ↓         ↓         ↓
   [Hosts]   [About]   [Error]
   Window    Window    Window
   - Manage  - Info    - Errors
   - CRUD ops - Version - Details
```

---

### 1. Login Window (index.html)

**Purpose:** Initial authentication screen

**Configuration:**
```json
{
  "label": "login",
  "width": 400,
  "height": 370,
  "resizable": false,
  "visible": false,
  "transparent": true
}
```

**Key Features:**
- Small, fixed size (authentication doesn't need much space)
- Transparent for modern UI effect
- Hidden initially (shown in setup callback)
- First window shown to user

**Transition to Main:**

```rust
#[tauri::command]
async fn login(
    app_handle: tauri::AppHandle,
    username: String,
    password: String,
) -> Result<(), String> {
    // Verify credentials...
    
    // On success, switch windows
    if let Some(login) = app_handle.get_webview_window("login") {
        login.close().map_err(|e| e.to_string())?;
    }
    
    if let Some(main) = app_handle.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

---

### 2. Main Window (main.html)

**Purpose:** Primary application interface for RDP connections

**Configuration:**
```json
{
  "label": "main",
  "width": 800,
  "height": 400,
  "minWidth": 800,
  "minHeight": 400,
  "resizable": true,
  "visible": false
}
```

**Key Features:**
- Larger, resizable workspace
- Minimum size ensures UI doesn't break
- Hidden until login succeeds
- Shows in taskbar (primary window)

**Opening Child Windows:**

```typescript
// From main.ts - Open hosts window
document.getElementById('manage-hosts-btn')?.addEventListener('click', async () => {
  await invoke('show_hosts_window');
});

// From main.ts - Open about window
document.getElementById('about-btn')?.addEventListener('click', async () => {
  await invoke('show_about');
});
```

---

### 3. Hosts Window (hosts.html)

**Purpose:** Manage saved RDP hosts (CRUD operations)

**Configuration:**
```json
{
  "label": "hosts",
  "width": 800,
  "height": 400,
  "minWidth": 600,
  "minHeight": 500,
  "resizable": true,
  "visible": false
}
```

**Key Features:**
- Independent utility window
- Can be open alongside main window
- Resizable for viewing long lists
- Notifies main window of changes via events

**Communication Pattern:**

```rust
#[tauri::command]
fn save_host(
    app_handle: tauri::AppHandle,
    host: Host,
) -> Result<(), String> {
    // Save host to CSV...
    
    // Notify main window to refresh its list
    if let Some(main_window) = app_handle.get_webview_window("main") {
        main_window.emit("hosts-changed", ())
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

**In Main Window:**

```typescript
await listen('hosts-changed', async () => {
  // Reload hosts list
  await loadHosts();
  console.log('Hosts list refreshed due to changes');
});
```

---

### 4. About Window (about.html)

**Purpose:** Display application information

**Configuration:**
```json
{
  "label": "about",
  "width": 420,
  "height": 480,
  "resizable": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "visible": false
}
```

**Key Features:**
- Small, fixed-size dialog
- Always on top (modal behavior)
- Hidden from taskbar (utility window)
- Simple show/hide pattern

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

---

### 5. Error Window (error.html)

**Purpose:** Centralized error display with details

**Configuration:**
```json
{
  "label": "error",
  "width": 700,
  "height": 500,
  "minWidth": 500,
  "minHeight": 400,
  "resizable": true,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "visible": false
}
```

**Key Features:**
- Resizable (error details can be long)
- Always on top (errors need visibility)
- Receives errors from ALL windows
- Event-driven architecture

**Error Display Pattern:**

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
    
    let payload = ErrorPayload {
        message,
        timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        category,
        details,
    };
    
    if let Some(error_window) = app_handle.get_webview_window("error") {
        // Emit event to error window
        error_window.emit("show-error", &payload)
            .map_err(|e| e.to_string())?;
        
        // Show and focus
        error_window.show().map_err(|e| e.to_string())?;
        error_window.set_focus().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

**In Error Window Frontend:**

```typescript
interface ErrorPayload {
  message: string;
  timestamp: string;
  category?: string;
  details?: string;
}

await listen<ErrorPayload>('show-error', (event) => {
  const error = event.payload;
  
  // Update all UI elements
  updateErrorDisplay(error);
  
  // Add to history
  addToErrorHistory(error);
});
```

---

## 7.7 Best Practices for Multi-Window Applications

### 1. Always Start Windows Hidden

```json
{
  "visible": false
}
```

**Why?**
- Prevents flickering during initialization
- Allows you to position and configure before showing
- Better user experience (smooth transitions)

---

### 2. Use Descriptive Window Labels

```json
// ❌ Bad
{"label": "win1"}
{"label": "w2"}

// ✅ Good
{"label": "login"}
{"label": "main"}
{"label": "error"}
```

**Why?**
- Easier to debug
- Self-documenting code
- Reduces mistakes when accessing windows

---

### 3. Set Minimum Sizes for Resizable Windows

```json
{
  "resizable": true,
  "minWidth": 600,
  "minHeight": 400
}
```

**Why?**
- Prevents UI from breaking at small sizes
- Ensures buttons/controls remain visible
- Better UX (users can't make window unusably small)

---

### 4. Use alwaysOnTop for Modal Dialogs

```json
{
  "alwaysOnTop": true,
  "skipTaskbar": true
}
```

**Why?**
- Ensures important dialogs aren't hidden behind other windows
- Clear visual hierarchy
- Better for errors and alerts

---

### 5. Close vs Hide Windows

```rust
// ✅ Hide for windows that will be reused
window.hide().map_err(|e| e.to_string())?;

// ✅ Close for one-time windows or when done
window.close().map_err(|e| e.to_string())?;
```

**When to Hide:**
- Windows that open repeatedly (about, settings)
- Keeps state and doesn't reload HTML
- Faster to show again

**When to Close:**
- Login window after successful login (won't be used again)
- Dynamic windows that won't be reused
- To free memory

---

### 6. Event-Driven Communication

```rust
// ✅ Good - Decoupled, flexible
error_window.emit("show-error", &payload)?;

// ❌ Avoid - Tight coupling
// Directly calling methods across windows
```

**Why?**
- Windows can come and go
- Multiple listeners possible
- Easier to test and maintain

---

### 7. Handle Missing Windows Gracefully

```rust
// ✅ Good
if let Some(window) = app_handle.get_webview_window("main") {
    window.show()?;
} else {
    eprintln!("Warning: main window not found");
    // Fallback behavior or error handling
}

// ❌ Bad - Will panic if window doesn't exist
let window = app_handle.get_webview_window("main").unwrap();
window.show().unwrap();
```

---

## 7.8 Practice Exercises

### Exercise 1: Add a Settings Window

**Goal:** Add a new settings window to a Tauri application.

**Requirements:**
1. Create a new window configuration in `tauri.conf.json`
2. Window should be 600x400, not resizable
3. Should be modal (alwaysOnTop, skipTaskbar)
4. Create a command to show the settings window
5. Add a button in the main window to open settings

**Configuration to Add:**

```json
{
  "label": "settings",
  "width": 600,
  "height": 400,
  "resizable": false,
  "title": "Settings",
  "url": "settings.html",
  "transparent": false,
  "decorations": true,
  "visible": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "center": true
}
```

**Command to Create:**

```rust
#[tauri::command]
fn show_settings(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Your implementation here
    todo!()
}
```

---

### Exercise 2: Implement Window State Persistence

**Goal:** Save and restore window size and position.

**Requirements:**
1. Save window position when it moves
2. Save window size when it resizes
3. Restore position and size on next app launch
4. Use localStorage or a JSON file

**Hint:** Use window events to detect changes

```rust
use tauri::{Manager, WindowEvent};

window.on_window_event(|event| {
    match event {
        WindowEvent::Resized(size) => {
            // Save size
        }
        WindowEvent::Moved(position) => {
            // Save position
        }
        _ => {}
    }
});
```

---

### Exercise 3: Create a Notification System

**Goal:** Build a notification window that slides in from the corner.

**Requirements:**
1. Small window (300x100) positioned in bottom-right
2. Shows for 5 seconds then auto-hides
3. Always on top
4. Command to show notification with message
5. Queue multiple notifications

**Challenge:** Make notifications stack if multiple are shown at once.

---

### Exercise 4: Inter-Window Data Sync

**Goal:** Keep a counter synchronized across two windows.

**Requirements:**
1. Create two windows (window1, window2)
2. Each has a counter display and increment button
3. When counter increments in one window, update the other
4. Use events for communication

**Implementation Approach:**
- Use shared state (Mutex<u32>)
- Emit events when counter changes
- Listen for events in both windows

---

## Solutions to Practice Exercises

### Solution 1: Add a Settings Window

**Step 1: Add to tauri.conf.json**

Add this to the `windows` array:

```json
{
  "label": "settings",
  "width": 600,
  "height": 400,
  "resizable": false,
  "title": "Settings",
  "url": "settings.html",
  "transparent": false,
  "decorations": true,
  "visible": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "center": true
}
```

**Step 2: Create Rust Command**

```rust
#[tauri::command]
fn show_settings(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(settings_window) = app_handle.get_webview_window("settings") {
        settings_window.show().map_err(|e| e.to_string())?;
        settings_window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Settings window not found".to_string())
    }
}
```

**Step 3: Register Command**

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        show_settings
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

**Step 4: Create settings.html**

```html
<!DOCTYPE html>
<html>
<head>
    <title>Settings</title>
</head>
<body>
    <h1>Application Settings</h1>
    <div>
        <label>
            <input type="checkbox" id="auto-start">
            Start on system boot
        </label>
    </div>
    <div>
        <label>
            Theme:
            <select id="theme">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
            </select>
        </label>
    </div>
    <button id="close-btn">Close</button>
    
    <script type="module">
        import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
        
        document.getElementById('close-btn').addEventListener('click', () => {
            getCurrentWebviewWindow().hide();
        });
    </script>
</body>
</html>
```

**Step 5: Add Button in Main Window**

```typescript
// In your main window TypeScript
import { invoke } from '@tauri-apps/api/core';

document.getElementById('settings-btn')?.addEventListener('click', async () => {
    await invoke('show_settings');
});
```

---

### Solution 2: Window State Persistence

**Step 1: Create State Storage**

```rust
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn get_state_file_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("my-app");
    path.push("window-state.json");
    path
}

fn save_window_state(state: &WindowState) -> Result<(), String> {
    let path = get_state_file_path();
    
    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    
    Ok(())
}

fn load_window_state() -> Option<WindowState> {
    let path = get_state_file_path();
    if !path.exists() {
        return None;
    }
    
    let json = fs::read_to_string(path).ok()?;
    serde_json::from_str(&json).ok()
}
```

**Step 2: Setup Window Event Listener**

```rust
use tauri::{Manager, WindowEvent, PhysicalPosition, PhysicalSize};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Load saved state
            if let Some(state) = load_window_state() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
                    let _ = window.set_size(PhysicalSize::new(state.width, state.height));
                }
            }
            
            // Listen for window events
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    match event {
                        WindowEvent::Resized(size) => {
                            if let Ok(position) = window.outer_position() {
                                let state = WindowState {
                                    x: position.x,
                                    y: position.y,
                                    width: size.width,
                                    height: size.height,
                                };
                                let _ = save_window_state(&state);
                            }
                        }
                        WindowEvent::Moved(position) => {
                            if let Ok(size) = window.outer_size() {
                                let state = WindowState {
                                    x: position.x,
                                    y: position.y,
                                    width: size.width,
                                    height: size.height,
                                };
                                let _ = save_window_state(&state);
                            }
                        }
                        _ => {}
                    }
                });
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### Solution 3: Notification System

**Step 1: Add Notification Window**

```json
{
  "label": "notification",
  "width": 300,
  "height": 100,
  "resizable": false,
  "title": "Notification",
  "url": "notification.html",
  "decorations": false,
  "visible": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "transparent": true,
  "center": false
}
```

**Step 2: Create Show Notification Command**

```rust
use tauri::{Manager, PhysicalPosition};

#[derive(Clone, serde::Serialize)]
struct NotificationPayload {
    message: String,
}

#[tauri::command]
async fn show_notification(
    app_handle: tauri::AppHandle,
    message: String,
) -> Result<(), String> {
    if let Some(notif) = app_handle.get_webview_window("notification") {
        // Position in bottom-right corner
        let monitor = notif.current_monitor()
            .map_err(|e| e.to_string())?
            .ok_or("No monitor found")?;
        
        let screen_size = monitor.size();
        let x = screen_size.width as i32 - 320; // 300 width + 20 margin
        let y = screen_size.height as i32 - 120; // 100 height + 20 margin
        
        notif.set_position(PhysicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        
        // Send message to notification window
        notif.emit("notification-message", NotificationPayload { message })
            .map_err(|e| e.to_string())?;
        
        // Show window
        notif.show().map_err(|e| e.to_string())?;
        notif.set_focus().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

**Step 3: Create notification.html**

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            font-family: system-ui;
            border-radius: 8px;
            backdrop-filter: blur(10px);
        }
        #message {
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div id="message">Notification</div>
    
    <script type="module">
        import { listen } from '@tauri-apps/api/event';
        import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
        
        const currentWindow = getCurrentWebviewWindow();
        
        await listen('notification-message', (event) => {
            document.getElementById('message').textContent = event.payload.message;
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                currentWindow.hide();
            }, 5000);
        });
    </script>
</body>
</html>
```

---

### Solution 4: Inter-Window Data Sync

**Step 1: Create Shared State**

```rust
use std::sync::Mutex;
use tauri::{Manager, State};

struct CounterState {
    value: Mutex<u32>,
}

pub fn run() {
    tauri::Builder::default()
        .manage(CounterState {
            value: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            get_counter,
            increment_counter
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 2: Create Commands**

```rust
#[tauri::command]
fn get_counter(state: State<CounterState>) -> Result<u32, String> {
    let value = state.value.lock().map_err(|e| e.to_string())?;
    Ok(*value)
}

#[tauri::command]
fn increment_counter(
    app_handle: tauri::AppHandle,
    state: State<CounterState>,
) -> Result<u32, String> {
    let mut value = state.value.lock().map_err(|e| e.to_string())?;
    *value += 1;
    let new_value = *value;
    
    // Broadcast to all windows
    app_handle.emit("counter-changed", new_value)
        .map_err(|e| e.to_string())?;
    
    Ok(new_value)
}
```

**Step 3: Frontend for Both Windows**

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Display element
const counterDisplay = document.getElementById('counter')!;

// Load initial value
async function loadCounter() {
    const value = await invoke<number>('get_counter');
    counterDisplay.textContent = value.toString();
}

// Increment button
document.getElementById('increment-btn')!.addEventListener('click', async () => {
    await invoke('increment_counter');
});

// Listen for changes from other windows
await listen<number>('counter-changed', (event) => {
    counterDisplay.textContent = event.payload.toString();
});

// Initial load
await loadCounter();
```

---

## Summary

In this chapter, you learned how to build multi-window Tauri applications:

✅ **Window Configuration** - How to define windows in `tauri.conf.json` with appropriate properties  
✅ **Window Patterns** - Main windows, modal dialogs, utility windows, and error windows  
✅ **Window Management** - Show, hide, close, focus, and query window state from Rust  
✅ **Lifecycle Events** - Listen to window events and handle close requests  
✅ **Inter-Window Communication** - Events, shared state, and broadcast patterns  
✅ **QuickConnect Architecture** - Real-world example with five coordinated windows  
✅ **Best Practices** - Hidden starts, descriptive labels, minimum sizes, and graceful error handling

Multi-window applications provide professional user experiences with specialized interfaces for different tasks. QuickConnect demonstrates how to coordinate multiple windows effectively while maintaining clean architecture and type safety.

---

## What's Next?

In **Chapter 8**, we'll explore **State Management and Data Flow** in depth:
- Frontend state patterns and reactivity
- Form validation and handling
- Search and filter implementations
- Real-time UI updates
- Connecting everything together

You now have the foundation to build complex, professional desktop applications with Tauri! 🚀

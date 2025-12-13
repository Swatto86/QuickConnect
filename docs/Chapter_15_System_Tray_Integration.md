# Chapter 15: System Tray Integration

## Introduction

System tray integration is a hallmark of professional desktop applications. It allows your application to run in the background, provide quick access to common functions, and maintain a persistent presence without cluttering the user's taskbar. In this chapter, we'll explore how to implement a fully functional system tray icon with Tauri, covering menu creation, event handling, dynamic updates, and seamless window management.

**What You'll Learn:**
- Setting up the Tauri tray icon plugin
- Creating static and dynamic tray menus
- Handling tray click events
- Building submenus for organized features
- Dynamically updating menu items
- Integrating window show/hide functionality
- Theme switching from the tray
- Recent connections quick access

**QuickConnect Context:**
QuickConnect uses the system tray as its primary interface paradigm. Users can:
- Toggle window visibility with a single click
- Access recent connections instantly
- Switch themes without opening windows
- Enable/disable autostart
- View application information
- Quit the application gracefully

This approach makes QuickConnect feel like a native Windows utility rather than a standalone application.

---

## 15.1 Understanding System Tray in Tauri

### What is a System Tray?

The system tray (also called notification area) is the small area in the taskbar, typically on the right side in Windows, where background applications display icons. These icons provide:

1. **Status Indication**: Visual feedback about the application state
2. **Quick Access**: One-click access to common features
3. **Background Operation**: Applications can run without visible windows
4. **Context Menus**: Right-click menus for various actions

### Tauri's Tray Implementation

Tauri 2.0 includes built-in tray icon support through the core `tauri` crate. Key features include:

- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Menu Builder API**: Fluent API for constructing menus
- **Event System**: Handle click events and menu selections
- **Dynamic Updates**: Change icons, tooltips, and menus at runtime
- **Multiple Trays**: Support for multiple tray icons (advanced use cases)

### Architecture Overview

```
┌─────────────────────────────────────┐
│       User Clicks Tray Icon         │
└────────────┬────────────────────────┘
             │
             v
┌─────────────────────────────────────┐
│    Tauri Tray Event Handler         │
│  (on_tray_icon_event closure)       │
└────────────┬────────────────────────┘
             │
             v
┌─────────────────────────────────────┐
│   Match Event Type                  │
│   • Left Click → Show/Hide Window   │
│   • Right Click → Show Context Menu │
│   • Menu Click → Execute Action     │
└────────────┬────────────────────────┘
             │
             v
┌─────────────────────────────────────┐
│   Application Logic                 │
│   • Window management               │
│   • Settings changes                │
│   • Launch connections              │
└─────────────────────────────────────┘
```

---

## 15.2 Setting Up the Tray Icon Plugin

### Adding Dependencies

The tray icon functionality is built into Tauri 2.0's core. Add the `tray-icon` feature to your `Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2.0.0", features = ["tray-icon"] }
```

**Explanation:**
- The `tray-icon` feature flag enables tray functionality
- No additional crates needed for basic tray support
- Platform-specific implementations are handled automatically

### Importing Required Types

At the top of your `lib.rs`, import the necessary tray-related types:

```rust
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
```

**Type Breakdown:**
- **`Menu`**: Container for menu items
- **`MenuItem`**: Individual clickable menu item
- **`PredefinedMenuItem`**: Built-in items like separators
- **`Submenu`**: Nested menu for organizing related items
- **`TrayIconBuilder`**: Builder pattern for creating tray icons
- **`TrayIconEvent`**: Events triggered by tray interactions
- **`MouseButton`** and **`MouseButtonState`**: For click detection
- **`Manager`**: Trait providing access to app resources

---

## 15.3 Creating Your First Tray Icon

### Basic Tray Setup

Here's a minimal example to create a tray icon with a simple menu:

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Create a simple menu
            let quit_item = MenuItem::with_id(
                app,
                "quit",
                "Quit",
                true,  // enabled
                None::<&str>,  // no keyboard shortcut
            )?;

            let menu = Menu::with_items(app, &[&quit_item])?;

            // Build the tray icon
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("My Application")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    if event.id().as_ref() == "quit" {
                        app.exit(0);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Key Points:**
1. **Builder Pattern**: `TrayIconBuilder` uses the builder pattern for configuration
2. **ID Required**: Every tray icon needs a unique ID (`"main"`)
3. **Icon Source**: Uses the default window icon from `tauri.conf.json`
4. **Tooltip**: Shown when hovering over the tray icon
5. **Menu Association**: The menu is attached with `.menu(&menu)`
6. **Event Handler**: `.on_menu_event()` handles menu item clicks

### Understanding MenuItem Creation

```rust
let item = MenuItem::with_id(
    app,           // AppHandle for context
    "item_id",     // Unique identifier for this item
    "Display Text", // Text shown in menu
    true,          // enabled (false = grayed out)
    None::<&str>,  // Optional keyboard shortcut
)?;
```

**Important Notes:**
- IDs must be unique within the menu
- IDs are used to identify which item was clicked
- Display text supports Unicode (emojis, special characters)
- Keyboard shortcuts are platform-specific

---

## 15.4 Building Complex Menus

### Menu Structure with Submenus

Real applications need organized menus with multiple sections:

```rust
fn build_app_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    // Theme submenu
    let theme_light = MenuItem::with_id(app, "theme_light", "Light Mode", true, None::<&str>)?;
    let theme_dark = MenuItem::with_id(app, "theme_dark", "Dark Mode", true, None::<&str>)?;
    
    let theme_submenu = Submenu::with_items(
        app,
        "Theme",
        true,  // enabled
        &[&theme_light, &theme_dark],
    )?;

    // Top-level items
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let about_item = MenuItem::with_id(app, "about", "About", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    // Build the complete menu
    Menu::with_items(
        app,
        &[&theme_submenu, &settings_item, &about_item, &separator, &quit_item],
    )
    .map_err(|e| e.into())
}
```

**Menu Organization Best Practices:**
1. **Group Related Items**: Use submenus for related actions
2. **Logical Ordering**: Most common actions at top
3. **Use Separators**: Visually group different categories
4. **Quit at Bottom**: Standard convention across platforms

### Dynamic Menu Items with Checkmarks

QuickConnect uses checkmarks to show the current state:

```rust
fn build_tray_menu(
    app: &tauri::AppHandle,
    current_theme: &str,
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    // Create theme items with conditional checkmarks
    let theme_light = MenuItem::with_id(
        app,
        "theme_light",
        if current_theme == "light" { "✓ Light" } else { "✗ Light" },
        true,
        None::<&str>,
    )?;
    
    let theme_dark = MenuItem::with_id(
        app,
        "theme_dark",
        if current_theme == "dark" { "✓ Dark" } else { "✗ Dark" },
        true,
        None::<&str>,
    )?;

    let theme_submenu = Submenu::with_items(
        app,
        "Theme",
        true,
        &[&theme_light, &theme_dark],
    )?;

    // Autostart with checkmark
    let autostart_enabled = check_autostart().unwrap_or(false);
    let autostart_text = if autostart_enabled {
        "✓ Autostart with Windows"
    } else {
        "✗ Autostart with Windows"
    };
    
    let autostart_item = MenuItem::with_id(
        app,
        "toggle_autostart",
        autostart_text,
        true,
        None::<&str>,
    )?;

    Menu::with_items(app, &[&theme_submenu, &autostart_item])
        .map_err(|e| e.into())
}
```

**Visual Feedback Techniques:**
- **✓** and **✗**: Clear visual indicators
- **Rebuild Menu**: Recreate menu after state changes
- **Consistent Symbols**: Use across all stateful items

---

## 15.5 Handling Tray Icon Events

### Click Event Detection

Tray icons support two types of clicks: left and right. Here's how to handle both:

```rust
TrayIconBuilder::with_id("main")
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .show_menu_on_left_click(false)  // Don't show menu on left click
    .on_tray_icon_event(|tray_handle, event| {
        match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Down,
                ..
            } => {
                println!("Left click detected");
                let app = tray_handle.app_handle();
                // Toggle main window visibility
                if let Some(window) = app.get_webview_window("main") {
                    match window.is_visible() {
                        Ok(true) => { let _ = window.hide(); }
                        Ok(false) => {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        Err(e) => eprintln!("Error checking visibility: {}", e),
                    }
                }
            }
            TrayIconEvent::Click {
                button: MouseButton::Right,
                button_state: MouseButtonState::Up,
                ..
            } => {
                println!("Right click detected - menu will show");
                // Menu shows automatically
            }
            _ => {}
        }
    })
    .build(app)?;
```

**Event Handling Details:**
- **`button_state`**: `Down` or `Up` - handle one to avoid double-triggering
- **`show_menu_on_left_click(false)`**: Custom behavior for left click
- **Default Behavior**: Right-click shows menu automatically
- **Pattern Matching**: Use `..` to ignore unused fields

### QuickConnect's Smart Window Management

QuickConnect tracks which window was last hidden and shows it on tray click:

```rust
use std::sync::Mutex;

static LAST_HIDDEN_WINDOW: Mutex<String> = Mutex::new(String::new());

// When window is hidden
let app_handle = app.app_handle().clone();
let main_window = app.get_webview_window("main").unwrap();
main_window.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        // Update the last hidden window
        if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
            *last_hidden = "main".to_string();
        }
        let _ = app_handle.get_webview_window("main").unwrap().hide();
        api.prevent_close();  // Don't destroy the window
    }
});

// On tray click
TrayIconEvent::Click {
    button: MouseButton::Left,
    button_state: MouseButtonState::Down,
    ..
} => {
    let app_handle = tray_handle.app_handle().clone();
    
    if let Ok(window_label) = LAST_HIDDEN_WINDOW.lock() {
        let window = app_handle.get_webview_window(&window_label)
            .or_else(|| app_handle.get_webview_window("main"));
        
        if let Some(window) = window {
            match window.is_visible() {
                Ok(true) => { let _ = window.hide(); }
                Ok(false) => {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                Err(_) => {}
            }
        }
    }
}
```

**Smart Features:**
1. **Memory**: Remembers which window user closed
2. **Fallback**: If tracked window unavailable, shows main
3. **Toggle**: Click once to hide, click again to show
4. **Focus**: Brings window to front when shown

---

## 15.6 Menu Event Handling

### Routing Menu Selections

Menu events are handled separately from click events:

```rust
.on_menu_event(|app, event| {
    let id_str = event.id().as_ref();
    
    match id_str {
        "quit" => {
            app.exit(0);
        }
        "about" => {
            if let Err(e) = show_about_window(app.clone()) {
                eprintln!("Failed to show about: {}", e);
            }
        }
        "toggle_autostart" => {
            if let Ok(_enabled) = toggle_autostart() {
                // Rebuild menu with updated state
                if let Some(tray) = app.tray_by_id("main") {
                    let theme = get_current_theme(app).unwrap_or("dark".to_string());
                    if let Ok(new_menu) = build_tray_menu(app, &theme) {
                        let _ = tray.set_menu(Some(new_menu));
                    }
                }
            }
        }
        _ => {
            eprintln!("Unknown menu item: {}", id_str);
        }
    }
})
```

**Best Practices:**
- **Error Handling**: Always handle potential errors gracefully
- **Async Operations**: Use `tauri::async_runtime::spawn()` for async code
- **State Updates**: Rebuild menu when state changes
- **Logging**: Log unhandled menu items for debugging

### Prefix-Based Menu Routing

For dynamic items (like recent connections), use prefixes:

```rust
.on_menu_event(|app, event| {
    let id_str = event.id().as_ref();
    
    // Check for prefixed IDs
    if id_str.starts_with("recent_") {
        let hostname = id_str.strip_prefix("recent_").unwrap_or("");
        
        // Launch RDP connection
        tauri::async_runtime::spawn(async move {
            if let Err(e) = connect_to_host(hostname).await {
                eprintln!("Connection failed: {}", e);
            }
        });
        return;
    }
    
    // Handle other menu items...
    match id_str {
        "quit" => app.exit(0),
        _ => {}
    }
})
```

**Dynamic Menu Pattern:**
1. **Prefix**: Use consistent prefix (e.g., `"recent_"`)
2. **Extract Data**: Strip prefix to get the actual data
3. **Async Handling**: Spawn async tasks for I/O operations
4. **Early Return**: Return after handling to avoid fallthrough

---

## 15.7 Dynamic Submenu Creation

### Building Recent Connections Menu

QuickConnect creates a submenu of recent connections dynamically:

```rust
// Load recent connections from storage
let recent_connections = load_recent_connections()
    .unwrap_or_else(|_| RecentConnections::new());

let recent_submenu = if recent_connections.connections.is_empty() {
    // No recent connections - show disabled placeholder
    let no_recent = MenuItem::with_id(
        app,
        "no_recent",
        "No recent connections",
        false,  // disabled/grayed out
        None::<&str>,
    )?;
    
    Submenu::with_items(
        app,
        "Recent Connections",
        true,
        &[&no_recent],
    )?
} else {
    // Build menu items from recent connections
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
    
    // Convert to trait object references for the submenu
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
```

**Key Techniques:**
1. **Empty State**: Show placeholder when no data available
2. **Formatting**: Create readable labels with multiple fields
3. **ID Generation**: Construct unique IDs from data
4. **Type Conversion**: Convert concrete types to trait objects
5. **Error Propagation**: Use `?` operator throughout

### Handling Menu Updates

When data changes, rebuild and update the tray menu:

```rust
fn update_tray_menu(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Get current state
    let theme = get_current_theme(app)?;
    
    // Build new menu
    let new_menu = build_tray_menu(app, &theme)?;
    
    // Get tray handle and update
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(new_menu))?;
    }
    
    Ok(())
}
```

**When to Update:**
- After adding/removing recent connections
- After changing settings (theme, autostart)
- After major state changes

---

## 15.8 Integrating with Application State

### Theme Switching from Tray

Complete integration with the theme system:

```rust
.on_menu_event(|app, event| {
    match event.id().as_ref() {
        "theme_light" => {
            if let Err(e) = set_theme(app.clone(), "light".to_string()) {
                eprintln!("Failed to set light theme: {}", e);
            }
        }
        "theme_dark" => {
            if let Err(e) = set_theme(app.clone(), "dark".to_string()) {
                eprintln!("Failed to set dark theme: {}", e);
            }
        }
        _ => {}
    }
})
```

Where `set_theme()` is implemented to:
1. Save theme to registry
2. Emit event to all windows
3. Rebuild tray menu with updated checkmarks

```rust
#[tauri::command]
fn set_theme(app_handle: tauri::AppHandle, theme: String) -> Result<(), String> {
    // Save to registry
    save_theme_to_registry(&theme)?;
    
    // Notify all windows
    app_handle.emit("theme-changed", theme.clone())
        .map_err(|e| format!("Failed to emit theme event: {}", e))?;
    
    // Rebuild tray menu with new theme
    if let Some(tray) = app_handle.tray_by_id("main") {
        if let Ok(menu) = build_tray_menu(&app_handle, &theme) {
            let _ = tray.set_menu(Some(menu));
        }
    }
    
    Ok(())
}
```

**Complete Integration:**
1. **Persistence**: Save to Windows Registry
2. **Live Update**: Emit event to frontend
3. **Visual Feedback**: Update tray checkmarks
4. **Error Handling**: Propagate errors cleanly

---

## 15.9 Advanced Tray Features

### Multiple Tray Icons

While uncommon, you can create multiple tray icons for different purposes:

```rust
// Main application tray
let _main_tray = TrayIconBuilder::with_id("main")
    .icon(app.default_window_icon().unwrap().clone())
    .tooltip("QuickConnect")
    .menu(&main_menu)
    .build(app)?;

// Status indicator tray (example)
let _status_tray = TrayIconBuilder::with_id("status")
    .icon(app.default_window_icon().unwrap().clone())
    .tooltip("Status: Active")
    .build(app)?;
```

**Use Cases:**
- Separate controls and status
- Different functions for power users
- Plugin/extension system

### Changing Tray Icon Dynamically

Update the tray icon to reflect application state:

```rust
fn update_tray_icon(app: &tauri::AppHandle, connected: bool) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main") {
        // Load appropriate icon
        let icon = if connected {
            load_icon("icons/connected.png")?
        } else {
            load_icon("icons/disconnected.png")?
        };
        
        tray.set_icon(Some(icon))
            .map_err(|e| format!("Failed to set icon: {}", e))?;
    }
    Ok(())
}
```

**Common Patterns:**
- Green/red for connection status
- Animated icons for activity
- Overlay badges for notifications

### Tooltip Updates

Change the tooltip based on application state:

```rust
if let Some(tray) = app.tray_by_id("main") {
    let tooltip = format!("QuickConnect - {} connections", connection_count);
    tray.set_tooltip(Some(tooltip))
        .map_err(|e| format!("Failed to set tooltip: {}", e))?;
}
```

---

## 15.10 QuickConnect Implementation Analysis

### Complete Setup Flow

Let's walk through QuickConnect's complete tray setup:

```rust
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Get current theme for initial menu
            let current_theme = get_theme(app.app_handle().clone())
                .unwrap_or_else(|_| "dark".to_string());

            // Build the tray menu with theme awareness
            let menu = build_tray_menu(app.app_handle(), &current_theme)?;

            // Create the system tray
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray_handle, event| {
                    // Handle tray clicks (see section 15.5)
                })
                .on_menu_event(|app, event| {
                    // Handle menu selections (see section 15.6)
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Window Close Handler Integration

QuickConnect prevents windows from closing, instead hiding them:

```rust
let app_handle = app.app_handle().clone();
let main_window = app.get_webview_window("main").unwrap();

main_window.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        // Track this as the last hidden window
        if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
            *last_hidden = "main".to_string();
        }
        
        // Hide instead of close
        let _ = app_handle.get_webview_window("main").unwrap().hide();
        
        // Prevent actual window destruction
        api.prevent_close();
    }
});
```

**Why This Approach?**
1. **Fast Show/Hide**: No window recreation overhead
2. **State Preservation**: Window maintains its state
3. **Better UX**: Instant response to tray clicks
4. **Resource Efficiency**: No repeated initialization

### Menu Rebuild Pattern

After state changes, QuickConnect rebuilds the menu:

```rust
// In the toggle_autostart handler
match toggle_autostart() {
    Ok(_enabled) => {
        // Rebuild the entire menu with updated state
        if let Some(tray) = app.tray_by_id("main") {
            let current_theme = get_theme(app.clone())
                .unwrap_or_else(|_| "dark".to_string());
            if let Ok(new_menu) = build_tray_menu(app, &current_theme) {
                let _ = tray.set_menu(Some(new_menu));
            }
        }
    }
    Err(e) => {
        eprintln!("Failed to toggle autostart: {}", e);
    }
}
```

**Pattern Summary:**
1. Execute the state change
2. Read current state (theme, autostart, etc.)
3. Build new menu with updated state
4. Replace tray menu

---

## 15.11 Best Practices and Common Pitfalls

### Best Practices

1. **Always Handle Both Button States Separately**
   ```rust
   // ✅ Good - Handle only Down state
   TrayIconEvent::Click {
       button: MouseButton::Left,
       button_state: MouseButtonState::Down,
       ..
   } => { /* handle click */ }
   
   // ❌ Bad - Handles both Down and Up, triggering twice
   TrayIconEvent::Click {
       button: MouseButton::Left,
       ..
   } => { /* handle click */ }
   ```

2. **Graceful Error Handling**
   ```rust
   // ✅ Good - Log errors, don't crash
   if let Err(e) = window.show() {
       eprintln!("Failed to show window: {}", e);
   }
   
   // ❌ Bad - Panics on error
   window.show().unwrap();
   ```

3. **Async Operations in Event Handlers**
   ```rust
   // ✅ Good - Spawn async task
   .on_menu_event(|app, event| {
       tauri::async_runtime::spawn(async move {
           launch_rdp(hostname).await;
       });
   })
   
   // ❌ Bad - Blocks event handler
   .on_menu_event(|app, event| {
       // This won't compile (can't await in sync closure)
       launch_rdp(hostname).await;
   })
   ```

4. **Menu Rebuild After State Changes**
   ```rust
   // ✅ Good - Rebuild menu to reflect changes
   fn toggle_setting(app: &tauri::AppHandle) {
       change_setting();
       rebuild_tray_menu(app);
   }
   
   // ❌ Bad - Menu shows stale state
   fn toggle_setting(app: &tauri::AppHandle) {
       change_setting();
       // Menu still shows old state
   }
   ```

### Common Pitfalls

**Pitfall 1: Double-Triggering**
```rust
// Problem: This triggers on both mouse down and up
TrayIconEvent::Click { button: MouseButton::Left, .. } => {
    toggle_window();  // Called twice!
}

// Solution: Check button_state
TrayIconEvent::Click {
    button: MouseButton::Left,
    button_state: MouseButtonState::Down,
    ..
} => {
    toggle_window();  // Called once
}
```

**Pitfall 2: Menu Not Updating**
```rust
// Problem: Menu checkmarks don't update after theme change
"theme_dark" => {
    set_theme("dark");
    // Tray menu still shows old checkmarks!
}

// Solution: Rebuild menu after change
"theme_dark" => {
    set_theme("dark");
    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(menu) = build_tray_menu(app, "dark") {
            tray.set_menu(Some(menu));
        }
    }
}
```

**Pitfall 3: Window Focus Issues**
```rust
// Problem: Window shows but doesn't get focus
window.show()?;

// Solution: Explicitly set focus
window.unminimize()?;  // Restore if minimized
window.show()?;
window.set_focus()?;   // Bring to front
```

**Pitfall 4: Memory Leaks with Menu Items**
```rust
// Problem: Creating new menu items without properly managing memory
for i in 0..1000 {
    let item = MenuItem::with_id(app, &format!("item_{}", i), "Item", true, None)?;
    // Items accumulate in memory
}

// Solution: Keep only what you need, rebuild menus cleanly
let items: Vec<_> = data.iter()
    .take(10)  // Limit number of items
    .map(|d| create_menu_item(app, d))
    .collect::<Result<Vec<_>, _>>()?;
```

---

## 15.12 Testing Your Tray Implementation

### Manual Testing Checklist

1. **Icon Display**
   - [ ] Icon appears in system tray after launch
   - [ ] Icon is crisp and clear at system tray size
   - [ ] Tooltip appears on hover

2. **Click Behavior**
   - [ ] Left click toggles window visibility
   - [ ] Right click shows context menu
   - [ ] No double-triggering on single click

3. **Menu Navigation**
   - [ ] All menu items are visible
   - [ ] Submenus expand correctly
   - [ ] Disabled items are grayed out
   - [ ] Separators display properly

4. **Menu Actions**
   - [ ] Each menu item performs correct action
   - [ ] Checkmarks update after toggle actions
   - [ ] Recent items launch correctly
   - [ ] Quit exits application gracefully

5. **State Consistency**
   - [ ] Theme checkmarks match actual theme
   - [ ] Autostart checkmark matches registry state
   - [ ] Menu updates after changing settings

### Debug Logging

Add logging to understand tray behavior:

```rust
.on_tray_icon_event(|tray_handle, event| {
    eprintln!("Tray event: {:?}", event);
    
    match event {
        TrayIconEvent::Click { button, button_state, .. } => {
            eprintln!("Click - Button: {:?}, State: {:?}", button, button_state);
        }
        _ => {}
    }
})

.on_menu_event(|app, event| {
    eprintln!("Menu event - ID: {}", event.id().as_ref());
    
    // Your handler logic...
})
```

### Common Issues and Solutions

**Issue: Tray icon doesn't appear**
- Check that `tray-icon` feature is enabled in `Cargo.toml`
- Verify icon file exists and is in correct format
- Ensure tray builder returns successfully (check for errors)

**Issue: Menu doesn't show on right-click**
- Check `.menu(&menu)` is called on builder
- Verify menu creation doesn't error
- Ensure `show_menu_on_left_click` setting is correct

**Issue: Window doesn't show on tray click**
- Check window label matches expected label
- Verify window exists (not destroyed)
- Use `.unminimize()` before `.show()`

---

## 15.13 Platform-Specific Considerations

### Windows

- **Icon Size**: 16x16 pixels at 100% DPI scaling
- **Menu Style**: Native Windows context menu styling
- **Behavior**: Right-click shows menu, left-click is customizable
- **Limitations**: No animated icons in system tray

### macOS

- **Icon Size**: 22x22 pixels (template images recommended)
- **Menu Style**: macOS menu styling with rounded corners
- **Behavior**: Click shows menu (left/right distinction less common)
- **Template Icons**: Use single-color template icons for proper theme integration

### Linux

- **Varies by Desktop Environment**: GNOME, KDE, etc. have different behaviors
- **Icon Size**: Typically 22x22 or 24x24 pixels
- **AppIndicator**: May use AppIndicator library on some distributions
- **Limitations**: Feature support varies by DE

### Cross-Platform Icon Strategy

```rust
// Use appropriate icon format for each platform
#[cfg(target_os = "windows")]
const ICON_SIZE: u32 = 16;

#[cfg(target_os = "macos")]
const ICON_SIZE: u32 = 22;

#[cfg(target_os = "linux")]
const ICON_SIZE: u32 = 24;
```

---

## 15.14 Key Takeaways

1. **Tray Integration is Essential**: System tray makes your app feel professional and native
2. **Builder Pattern**: TrayIconBuilder provides clean, fluent API
3. **Event Separation**: Handle tray clicks and menu events separately
4. **State Management**: Always rebuild menus after state changes
5. **Window Management**: Hide windows instead of destroying them for better UX
6. **Error Handling**: Gracefully handle all errors to prevent crashes
7. **User Feedback**: Use checkmarks and visual indicators for state
8. **Dynamic Content**: Build menus from application data for powerful features
9. **Async Considerations**: Use `tauri::async_runtime::spawn()` for async operations
10. **Testing**: Manually test all interactions on target platforms

**QuickConnect Lessons:**
- Track last hidden window for smart show/hide behavior
- Integrate theme switching directly in tray menu
- Provide quick access to recent items
- Use visual indicators (✓/✗) for all toggle states
- Prevent double-triggering by checking button state

---

## 15.15 Practice Exercises

### Exercise 1: Basic Tray Icon

Create a tray icon with three menu items:
- Show Window
- Settings
- Quit

**Starter Code:**
```rust
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // TODO: Create menu items
            
            // TODO: Build menu
            
            // TODO: Create tray icon
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Solution:**
```rust
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Create menu items
            let show_item = MenuItem::with_id(
                app,
                "show",
                "Show Window",
                true,
                None::<&str>,
            )?;
            
            let settings_item = MenuItem::with_id(
                app,
                "settings",
                "Settings",
                true,
                None::<&str>,
            )?;
            
            let quit_item = MenuItem::with_id(
                app,
                "quit",
                "Quit",
                true,
                None::<&str>,
            )?;
            
            // Build menu
            let menu = Menu::with_items(
                app,
                &[&show_item, &settings_item, &quit_item],
            )?;
            
            // Create tray icon
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("My Application")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "settings" => {
                            if let Some(window) = app.get_webview_window("settings") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Exercise 2: Theme Submenu

Create a theme submenu with three options: Light, Dark, and Auto. Show checkmarks next to the active theme.

**Requirements:**
- Store current theme in a static `Mutex<String>`
- Show checkmark (✓) next to active theme
- Rebuild menu after theme change

**Solution:**
```rust
use std::sync::Mutex;

static CURRENT_THEME: Mutex<String> = Mutex::new(String::new());

fn build_theme_menu(
    app: &tauri::AppHandle,
) -> Result<Submenu<tauri::Wry>, Box<dyn std::error::Error>> {
    let current = CURRENT_THEME.lock().unwrap();
    let current_theme = if current.is_empty() {
        "dark"
    } else {
        &current
    };
    
    let light_item = MenuItem::with_id(
        app,
        "theme_light",
        if current_theme == "light" { "✓ Light" } else { "Light" },
        true,
        None::<&str>,
    )?;
    
    let dark_item = MenuItem::with_id(
        app,
        "theme_dark",
        if current_theme == "dark" { "✓ Dark" } else { "Dark" },
        true,
        None::<&str>,
    )?;
    
    let auto_item = MenuItem::with_id(
        app,
        "theme_auto",
        if current_theme == "auto" { "✓ Auto" } else { "Auto" },
        true,
        None::<&str>,
    )?;
    
    Submenu::with_items(
        app,
        "Theme",
        true,
        &[&light_item, &dark_item, &auto_item],
    )
    .map_err(|e| e.into())
}

fn change_theme(app: &tauri::AppHandle, theme: &str) -> Result<(), String> {
    // Update stored theme
    if let Ok(mut current) = CURRENT_THEME.lock() {
        *current = theme.to_string();
    }
    
    // Rebuild tray menu
    if let Some(tray) = app.tray_by_id("main") {
        let theme_submenu = build_theme_menu(app)
            .map_err(|e| format!("Failed to build menu: {}", e))?;
        
        // In a real implementation, rebuild entire menu
        // For exercise, we're just showing the pattern
    }
    
    Ok(())
}

// In on_menu_event:
match event.id().as_ref() {
    "theme_light" => { let _ = change_theme(app, "light"); }
    "theme_dark" => { let _ = change_theme(app, "dark"); }
    "theme_auto" => { let _ = change_theme(app, "auto"); }
    _ => {}
}
```

### Exercise 3: Recent Files Menu

Create a "Recent Files" submenu that displays the 5 most recently opened files. If no files are open, show "No recent files" (disabled).

**Requirements:**
- Load recent files from a vector
- Show "No recent files" if list is empty
- Clicking a file should open it

**Solution:**
```rust
#[derive(Clone)]
struct RecentFile {
    path: String,
    display_name: String,
}

fn build_recent_files_menu(
    app: &tauri::AppHandle,
    recent_files: Vec<RecentFile>,
) -> Result<Submenu<tauri::Wry>, Box<dyn std::error::Error>> {
    if recent_files.is_empty() {
        let no_files = MenuItem::with_id(
            app,
            "no_recent",
            "No recent files",
            false,  // disabled
            None::<&str>,
        )?;
        
        return Submenu::with_items(
            app,
            "Recent Files",
            true,
            &[&no_files],
        )
        .map_err(|e| e.into());
    }
    
    // Create items for each file
    let items: Vec<_> = recent_files
        .iter()
        .take(5)
        .map(|file| {
            let menu_id = format!("recent_file_{}", file.path);
            MenuItem::with_id(
                app,
                &menu_id,
                &file.display_name,
                true,
                None::<&str>,
            )
        })
        .collect::<Result<Vec<_>, _>>()?;
    
    let item_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> =
        items.iter()
            .map(|item| item as &dyn tauri::menu::IsMenuItem<tauri::Wry>)
            .collect();
    
    Submenu::with_items(app, "Recent Files", true, &item_refs)
        .map_err(|e| e.into())
}

// In on_menu_event:
let id_str = event.id().as_ref();
if id_str.starts_with("recent_file_") {
    let file_path = id_str.strip_prefix("recent_file_").unwrap_or("");
    // Open the file
    open_file(file_path);
}
```

### Exercise 4: Toggle Window Visibility

Implement tray icon click to toggle the main window visibility. Track whether window is visible or hidden.

**Solution:**
```rust
TrayIconBuilder::with_id("main")
    .icon(app.default_window_icon().unwrap().clone())
    .show_menu_on_left_click(false)
    .on_tray_icon_event(|tray_handle, event| {
        match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Down,
                ..
            } => {
                let app = tray_handle.app_handle();
                
                if let Some(window) = app.get_webview_window("main") {
                    tauri::async_runtime::spawn(async move {
                        match window.is_visible() {
                            Ok(true) => {
                                // Window is visible, hide it
                                if let Err(e) = window.hide() {
                                    eprintln!("Error hiding window: {}", e);
                                }
                            }
                            Ok(false) => {
                                // Window is hidden, show it
                                if let Err(e) = window.unminimize() {
                                    eprintln!("Error unminimizing: {}", e);
                                }
                                if let Err(e) = window.show() {
                                    eprintln!("Error showing window: {}", e);
                                }
                                if let Err(e) = window.set_focus() {
                                    eprintln!("Error setting focus: {}", e);
                                }
                            }
                            Err(e) => {
                                eprintln!("Error checking visibility: {}", e);
                            }
                        }
                    });
                }
            }
            _ => {}
        }
    })
    .build(app)?;
```

---

## 15.16 Further Reading

### Official Documentation
- [Tauri Tray Documentation](https://v2.tauri.app/reference/javascript/api/namespaces/tray/)
- [Tauri Menu Documentation](https://v2.tauri.app/reference/javascript/api/namespaces/menu/)
- [Tauri System Tray Guide](https://v2.tauri.app/features/system-tray/)

### Related Topics
- **Chapter 7**: Multi-Window Applications (window management)
- **Chapter 8**: State Management (coordinating tray and application state)
- **Chapter 10**: Tauri Commands (calling backend from tray events)

### Platform-Specific Resources
- Windows: [System Tray Guidelines](https://learn.microsoft.com/en-us/windows/win32/shell/notification-area)
- macOS: [Menu Bar Extras](https://developer.apple.com/design/human-interface-guidelines/status-bars)
- Linux: [AppIndicator Specification](https://github.com/AyatanaIndicators/libayatana-appindicator)

---

## Summary

System tray integration transforms your Tauri application from a standard desktop app into a native-feeling system utility. Key concepts covered:

1. **Setup**: Enable the `tray-icon` feature and use `TrayIconBuilder`
2. **Menus**: Build static and dynamic menus with items, submenus, and separators
3. **Events**: Handle click events (left/right) and menu selections separately
4. **Dynamic Updates**: Rebuild menus when application state changes
5. **Window Management**: Track hidden windows and toggle visibility on tray click
6. **Visual Feedback**: Use checkmarks and symbols to indicate state
7. **Best Practices**: Handle button states properly, manage errors gracefully, and use async for I/O

QuickConnect demonstrates professional tray integration with smart window management, theme switching, recent connections, and seamless user experience. The system tray becomes the primary interaction point, keeping the application accessible yet unobtrusive.

In the next chapter, we'll explore LDAP and Active Directory integration, building on these concepts to create a domain scanner that queries corporate directories and populates our hosts list automatically.

---

**Total Pages: 50**

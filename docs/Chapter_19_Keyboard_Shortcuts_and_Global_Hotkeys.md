# Chapter 19: Keyboard Shortcuts and Global Hotkeys

**Learning Objectives:**
- Understand the difference between global shortcuts and window-level keyboard events
- Implement global hotkeys using tauri-plugin-global-shortcut
- Handle window-level keyboard shortcuts with JavaScript
- Implement secret shortcuts and power-user features
- Manage shortcut conflicts and platform differences
- Build user-friendly keyboard navigation

**Prerequisites:**
- Understanding of Tauri plugins (Chapter 15)
- JavaScript event handling (Chapter 5)
- Multi-window management (Chapter 7)

---

## 19.1 Understanding Keyboard Shortcuts in Tauri

Keyboard shortcuts are essential for power users and accessibility. In Tauri applications, you have two types of keyboard shortcuts:

### Global Shortcuts vs Window-Level Shortcuts

**Global Shortcuts (System-Wide):**
- Work even when your application doesn't have focus
- Registered through the operating system
- Can wake up or show your application
- Require special permissions and careful handling
- Example: `Ctrl+Shift+R` to show QuickConnect from anywhere

**Window-Level Shortcuts:**
- Only work when the window has focus
- Handled by JavaScript event listeners
- Don't require special permissions
- Better for in-app navigation and actions
- Example: `Escape` to close a dialog

```typescript
// Window-level shortcut (JavaScript)
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Handle Escape key
    }
});

// Global shortcut (Rust)
// Works even when app doesn't have focus
app.global_shortcut().register("Ctrl+Shift+R")?;
```

### When to Use Each Type

**Use Global Shortcuts For:**
- Opening/showing the main application window
- Quick actions that should work from anywhere
- Wake-up commands for background applications
- System tray integrated features

**Use Window-Level Shortcuts For:**
- Navigation within the application
- Form submission (Enter key)
- Dialog closing (Escape key)
- Multi-key combinations for complex actions
- Secret shortcuts for power users

---

## 19.2 Setting Up tauri-plugin-global-shortcut

Global shortcuts require a Tauri plugin. Let's set it up.

### Required Tauri 2 Permissions (QuickConnect)

In Tauri 2, plugins are gated by **capabilities**. QuickConnect grants global shortcut permissions via:

```json
// src-tauri/capabilities/desktop.json
{
    "identifier": "desktop-capability",
    "platforms": ["macOS", "windows", "linux"],
    "windows": ["main"],
    "permissions": [
        "global-shortcut:allow-register",
        "global-shortcut:allow-unregister",
        "global-shortcut:allow-is-registered"
    ]
}
```

Without these permissions, `tauri-plugin-global-shortcut` may fail at runtime even if it compiles.

### Adding the Dependency

Add to `Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = [ "tray-icon" ] }
# ... other dependencies

# Add global shortcut support for desktop platforms only
[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-global-shortcut = "2"
```

**Why the conditional dependency?**
- Global shortcuts don't work on mobile platforms (Android/iOS)
- Mobile apps can't register system-wide hotkeys
- This prevents compilation errors on mobile targets
- Desktop-only features should use conditional dependencies

### Registering the Plugin

In your `lib.rs` or `main.rs`, register the plugin:

```rust
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Setup code here
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Basic Global Shortcut Registration

Here's a simple example:

```rust
use tauri_plugin_global_shortcut::GlobalShortcutExt;

fn setup_global_shortcuts(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut_manager = app.handle().global_shortcut();
    
    // Register Ctrl+Shift+R
    shortcut_manager.register("Ctrl+Shift+R")?;
    
    // Set up the handler
    let app_handle = app.handle().clone();
    shortcut_manager.on_shortcut("Ctrl+Shift+R", move |_app, _shortcut, _event| {
        println!("Ctrl+Shift+R pressed!");
        
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    })?;
    
    Ok(())
}
```

**Important:** The handler must be set up BEFORE or WHEN registering the shortcut, not after.

---

## 19.3 QuickConnect Global Shortcut Implementation

Let's examine how QuickConnect implements `Ctrl+Shift+R` to show the main window from anywhere.

### The Complete Implementation

```rust
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri::Manager;

// In your setup() function
fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // ... other setup code ...
    
    // Register global hotkey Ctrl+Shift+R to show the main window
    // Note: We don't fail the app if hotkey registration fails
    let app_handle_for_hotkey = app.app_handle().clone();
    let shortcut_manager = app.handle().global_shortcut();
    
    // Try to unregister first in case it was registered by a previous instance
    let _ = shortcut_manager.unregister("Ctrl+Shift+R");
    
    // Set up the handler BEFORE registering (per Tauri docs)
    match shortcut_manager.on_shortcut("Ctrl+Shift+R", move |_app_handle, _shortcut, _event| {
        println!("Global hotkey Ctrl+Shift+R pressed!");
        
        let main_window = app_handle_for_hotkey.get_webview_window("main");
        
        if let Some(window) = main_window {
            tauri::async_runtime::spawn(async move {
                // Update last hidden window to main so tray shows correct window
                if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
                    *last_hidden = "main".to_string();
                }
                
                // Show and focus the window
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
                println!("Main window shown via global hotkey");
            });
        }
    }) {
        Ok(_) => {
            println!("Global hotkey handler registered");
            
            // Now register the actual shortcut
            match shortcut_manager.register("Ctrl+Shift+R") {
                Ok(_) => println!("Global hotkey Ctrl+Shift+R activated successfully"),
                Err(e) => {
                    eprintln!("Warning: Failed to register global hotkey Ctrl+Shift+R: {:?}", e);
                    eprintln!("The hotkey may be in use by another application.");
                }
            }
        }
        Err(e) => {
            eprintln!("Warning: Failed to set up global hotkey handler: {:?}", e);
            eprintln!("The application will continue without global hotkey support.");
        }
    }
    
    Ok(())
}
```

### Key Design Decisions

**1. Graceful Degradation**
```rust
match shortcut_manager.register("Ctrl+Shift+R") {
    Ok(_) => println!("Global hotkey activated"),
    Err(e) => {
        eprintln!("Warning: Failed to register: {:?}", e);
        // Don't fail the entire app!
    }
}
```

If the shortcut is already in use by another application, QuickConnect doesn't crash—it just logs a warning and continues without the global shortcut. The app is still fully functional.

**2. Unregister Before Register**
```rust
let _ = shortcut_manager.unregister("Ctrl+Shift+R");
```

This handles the case where a previous instance might have crashed and left the shortcut registered. It's defensive programming.

**3. Async Window Operations**
```rust
tauri::async_runtime::spawn(async move {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
});
```

Window operations are async and spawned in a separate task to avoid blocking the shortcut handler.

**4. State Synchronization**
```rust
if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
    *last_hidden = "main".to_string();
}
```

QuickConnect tracks which window was last hidden so the system tray can show/hide the correct window. When the global shortcut shows the main window, it updates this state.

---

## 19.4 Window-Level Keyboard Shortcuts

Window-level shortcuts are simpler to implement and don't require plugins. Let's look at common patterns.

### Basic Escape to Close Pattern

```typescript
// about.ts - Close about window on Escape
window.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
        const window = getCurrentWindow();
        await window.hide();
    }
});
```

### QuickConnect Hosts Window Implementation

```typescript
// hosts.ts - Multiple keyboard shortcuts
window.addEventListener("keydown", async (e) => {
    // Escape to hide window
    if (e.key === "Escape") {
        try {
            await invoke("hide_hosts_window");
        } catch (err) {
            console.error("Error hiding hosts window:", err);
        }
    }
    
    // Enter to submit form (if not in textarea)
    if (e.key === "Enter" && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "TEXTAREA") {
            e.preventDefault();
            // Trigger save/submit
            const saveBtn = document.querySelector("#saveBtn") as HTMLButtonElement;
            if (saveBtn && !saveBtn.disabled) {
                saveBtn.click();
            }
        }
    }
});
```

### Error Window with Auto-Close

```typescript
// error.ts - Keyboard shortcuts with auto-close timer
let autoCloseTimer: number | null = null;

window.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
        // Clear auto-close timer when user manually closes
        if (autoCloseTimer !== null) {
            clearTimeout(autoCloseTimer);
            autoCloseTimer = null;
        }
        
        const window = getCurrentWindow();
        await window.hide();
    }
    
    // C key to copy error details
    if (e.key === "c" || e.key === "C") {
        const detailsElement = document.querySelector("#errorDetails");
        if (detailsElement) {
            await navigator.clipboard.writeText(detailsElement.textContent || "");
            // Show a quick toast
            showToast("Error details copied to clipboard", "info");
        }
    }
});
```

---

## 19.5 Secret Shortcuts Pattern

Secret shortcuts are powerful combinations not advertised in the UI, designed for power users. QuickConnect uses `Ctrl+Shift+Alt+R` for application reset.

### Why Secret Shortcuts?

- **Dangerous Actions**: Reset, debug modes, etc.
- **Power User Features**: Advanced options that might confuse beginners
- **Developer Tools**: Quick access to debug information
- **Easter Eggs**: Fun features for those who explore

### QuickConnect Reset Shortcut Implementation

This shortcut is implemented in **every window** so users can reset from anywhere:

```typescript
// main.ts, about.ts, hosts.ts - Secret reset shortcut
window.addEventListener('keydown', async (e) => {
    // Secret reset shortcut: Ctrl+Shift+Alt+R
    if (e.ctrlKey && e.shiftKey && e.altKey && e.key === 'R') {
        e.preventDefault();
        
        const confirmed = confirm(
            '⚠️ WARNING: Application Reset ⚠️\n\n' +
            'This will permanently delete:\n' +
            '• All saved credentials\n' +
            '• All RDP connection files\n' +
            '• All saved hosts\n' +
            '• Recent connection history\n\n' +
            'This action CANNOT be undone!\n\n' +
            'Are you sure you want to continue?'
        );
        
        if (!confirmed) {
            return;
        }

        const confirmedAgain = confirm(
            'FINAL CONFIRMATION:\n\n' +
            'This will COMPLETELY reset QuickConnect and permanently delete your data.\n\n' +
            'Press OK to proceed with the reset, or Cancel to abort.'
        );

        if (!confirmedAgain) {
            return;
        }
        
        try {
            const result = await invoke<string>("reset_application");
            alert(result);

            // Return to the initial credentials screen
            await invoke('show_login_window');
            
            // Recommend restarting the application
            const shouldQuit = confirm(
                'Reset complete!\n\n' +
                'It is recommended to restart the application now.\n\n' +
                'Do you want to quit the application?'
            );
            
            if (shouldQuit) {
                await invoke("quit_app");
            }
        } catch (err) {
            alert('Failed to reset application: ' + err);
            console.error("Reset error:", err);
        }
    }
});
```

### Best Practices for Secret Shortcuts

**1. Use Complex Combinations**
```typescript
// Good: Unlikely to be pressed accidentally
if (e.ctrlKey && e.shiftKey && e.altKey && e.key === 'R') { }

// Bad: Too easy to trigger accidentally
if (e.key === 'R') { }
```

**2. Always Confirm Dangerous Actions**
```typescript
const confirmed = confirm('⚠️ WARNING: This action cannot be undone!');
if (!confirmed) return;
```

**3. Provide Clear Feedback**
```typescript
alert('Reset complete!\n\nIt is recommended to restart the application now.');
```

**4. Document in About Screen (Optional)**
```html
<!-- about.html - Documenting the secret shortcut -->
<div class="flex items-center justify-center gap-2">
  <div class="flex items-center gap-1">
    <kbd class="kbd kbd-sm">Ctrl</kbd>
    <span>+</span>
    <kbd class="kbd kbd-sm">Shift</kbd>
    <span>+</span>
    <kbd class="kbd kbd-sm">Alt</kbd>
    <span>+</span>
    <kbd class="kbd kbd-sm">R</kbd>
  </div>
  <span class="text-base-content/80">Reset application data</span>
</div>
```

**Note:** QuickConnect documents this in the About window, but many apps don't document secret shortcuts at all.

---

## 19.6 Shortcut Conflict Resolution

Keyboard shortcuts can conflict with other applications or the operating system. Here's how to handle it.

### Common Conflicts on Windows

| Shortcut | Potential Conflict |
|----------|-------------------|
| `Ctrl+C` | System copy command |
| `Ctrl+V` | System paste command |
| `Ctrl+Alt+Delete` | Windows Security screen |
| `Windows+L` | Lock screen |
| `Ctrl+Shift+Esc` | Task Manager |
| `Alt+F4` | Close window |

### Choosing Conflict-Free Shortcuts

**Good Choices:**
- `Ctrl+Shift+[Letter]` - Rarely used by system
- `Ctrl+Alt+[Letter]` - Available but less comfortable
- Function keys with modifiers: `Ctrl+F5`

**Avoid:**
- Single letters without modifiers
- Common editing shortcuts: `Ctrl+C`, `Ctrl+V`, `Ctrl+X`, `Ctrl+Z`
- System shortcuts: `Alt+Tab`, `Windows+D`, etc.

### Detecting and Handling Conflicts

```rust
match shortcut_manager.register("Ctrl+Shift+R") {
    Ok(_) => {
        println!("✓ Global hotkey registered successfully");
    }
    Err(e) => {
        // Log the error but don't crash the app
        eprintln!("⚠ Warning: Failed to register global hotkey: {:?}", e);
        eprintln!("The shortcut may be in use by another application.");
        eprintln!("The application will continue without global hotkey support.");
        
        // Optionally, try to register an alternative shortcut
        let alternative = "Ctrl+Alt+R";
        match shortcut_manager.register(alternative) {
            Ok(_) => {
                println!("✓ Registered alternative shortcut: {}", alternative);
            }
            Err(_) => {
                eprintln!("Could not register alternative shortcut either.");
            }
        }
    }
}
```

### User Feedback for Conflicts

If your app heavily relies on shortcuts, inform users:

```typescript
// Check if shortcut registration succeeded (backend sets a flag)
const shortcutAvailable = await invoke<boolean>("is_global_shortcut_available");

if (!shortcutAvailable) {
    showToast(
        "Global shortcut (Ctrl+Shift+R) is not available. " +
        "It may be in use by another application.",
        "warning"
    );
}
```

---

## 19.7 Modifier Key Handling

Understanding modifier keys is crucial for implementing shortcuts.

### The Standard Modifiers

```typescript
window.addEventListener('keydown', (e) => {
    console.log({
        key: e.key,           // The actual key: 'a', 'Enter', 'Escape'
        code: e.code,         // Physical key: 'KeyA', 'Enter', 'Escape'
        ctrlKey: e.ctrlKey,   // Ctrl pressed?
        shiftKey: e.shiftKey, // Shift pressed?
        altKey: e.altKey,     // Alt pressed?
        metaKey: e.metaKey    // Windows/Command key pressed?
    });
});
```

### Checking Multiple Modifiers

```typescript
// Exact match: Only Ctrl+Shift, no other modifiers
if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key === 'R') {
    // Handle Ctrl+Shift+R
}

// Any match: At least Ctrl, other modifiers don't matter
if (e.ctrlKey && e.key === 'R') {
    // Handles Ctrl+R, Ctrl+Shift+R, Ctrl+Alt+R, etc.
}
```

### Platform Differences

```typescript
// Use Cmd on Mac, Ctrl on Windows/Linux
const isModifierPressed = (e: KeyboardEvent): boolean => {
    // On macOS, metaKey is the Command key
    // On Windows/Linux, ctrlKey is used
    return navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
};

window.addEventListener('keydown', (e) => {
    if (isModifierPressed(e) && e.key === 'k') {
        // Cmd+K on Mac, Ctrl+K on Windows/Linux
        e.preventDefault();
        openSearchBar();
    }
});
```

**Note:** QuickConnect is Windows-only, so it doesn't need cross-platform handling.

---

## 19.8 Preventing Default Browser Behavior

Some key combinations have default browser behaviors that you need to prevent.

### Common Shortcuts That Need preventDefault()

```typescript
window.addEventListener('keydown', (e) => {
    // Ctrl+F: Browser's Find in Page
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        openInAppSearch();
    }
    
    // Ctrl+W: Close tab/window
    if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        closeCurrentView();
    }
    
    // Ctrl+R or F5: Refresh page
    if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
        e.preventDefault();
        refreshData();
    }
    
    // Space: Scroll page
    if (e.key === ' ' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlayback();
    }
});
```

### QuickConnect's Reset Shortcut Prevention

```typescript
// Secret reset shortcut: Ctrl+Shift+Alt+R
if (e.ctrlKey && e.shiftKey && e.altKey && e.key === 'R') {
    e.preventDefault(); // Prevent any default browser behavior
    // ... reset logic
}
```

**Why preventDefault()?**
- Ensures the browser doesn't try to handle the shortcut
- Prevents confusion if the browser has a conflicting shortcut
- Makes your app feel more "native" and less "web-like"

---

## 19.9 Keyboard Navigation for Accessibility

Good keyboard shortcuts improve accessibility for users who can't or prefer not to use a mouse.

### Tab Navigation

Ensure logical tab order:

```html
<!-- Explicit tab order -->
<button tabindex="1">Connect</button>
<button tabindex="2">Cancel</button>

<!-- Natural tab order (preferred) -->
<button>Connect</button>
<button>Cancel</button>

<!-- Remove from tab order -->
<div tabindex="-1">Not keyboard accessible</div>
```

### Enter Key for Form Submission

```typescript
// Automatically submit form on Enter
document.querySelector('form')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        // Let form handle submission naturally
        // Or manually trigger:
        e.preventDefault();
        submitForm();
    }
});
```

### Arrow Keys for Navigation

```typescript
// Navigate lists with arrow keys
const items = document.querySelectorAll('.list-item');
let currentIndex = 0;

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentIndex = Math.min(currentIndex + 1, items.length - 1);
        items[currentIndex].focus();
    }
    
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentIndex = Math.max(currentIndex - 1, 0);
        items[currentIndex].focus();
    }
});
```

### Escape Key for Dialogs

```typescript
// Universal Escape handler for modal dialogs
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.querySelector('.modal:not(.hidden)');
        if (modal) {
            closeModal(modal);
        }
    }
});
```

---

## 19.10 Debugging Keyboard Shortcuts

Keyboard shortcuts can be tricky to debug. Here are helpful techniques.

### Logging Key Events

```typescript
// Comprehensive key event logger
window.addEventListener('keydown', (e) => {
    console.log('Key Event:', {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        which: e.which,
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
        repeat: e.repeat,
        target: (e.target as HTMLElement).tagName
    });
});
```

### Visual Key Press Indicator

```typescript
// Show which keys are being pressed (debug mode)
const debugKeyPress = (e: KeyboardEvent) => {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #000;
        color: #fff;
        padding: 10px;
        border-radius: 5px;
        z-index: 99999;
    `;
    indicator.textContent = `
        ${e.ctrlKey ? 'Ctrl+' : ''}
        ${e.shiftKey ? 'Shift+' : ''}
        ${e.altKey ? 'Alt+' : ''}
        ${e.metaKey ? 'Meta+' : ''}
        ${e.key}
    `;
    document.body.appendChild(indicator);
    setTimeout(() => indicator.remove(), 1000);
};

// Enable in debug mode
if (DEBUG_MODE) {
    window.addEventListener('keydown', debugKeyPress);
}
```

### Backend Shortcut Logging

```rust
// In your global shortcut handler
shortcut_manager.on_shortcut("Ctrl+Shift+R", move |_app_handle, shortcut, event| {
    println!("Global hotkey pressed!");
    println!("  Shortcut: {:?}", shortcut);
    println!("  Event: {:?}", event);
    println!("  Time: {}", chrono::Local::now());
    
    // Your handler logic...
})?;
```

---

## 19.11 Advanced: User-Customizable Shortcuts

For advanced applications, allow users to customize shortcuts.

### Storing User Preferences

```typescript
// shortcuts-config.ts
interface ShortcutConfig {
    action: string;
    shortcut: string;
    description: string;
}

const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
    { action: 'show_main', shortcut: 'Ctrl+Shift+R', description: 'Show main window' },
    { action: 'new_connection', shortcut: 'Ctrl+N', description: 'New connection' },
    { action: 'search', shortcut: 'Ctrl+F', description: 'Search hosts' },
];

// Save to localStorage
const saveShortcuts = (shortcuts: ShortcutConfig[]) => {
    localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
};

// Load from localStorage
const loadShortcuts = (): ShortcutConfig[] => {
    const saved = localStorage.getItem('shortcuts');
    return saved ? JSON.parse(saved) : DEFAULT_SHORTCUTS;
};
```

### Dynamic Shortcut Registration

```rust
// Backend command to update global shortcut
#[tauri::command]
fn update_global_shortcut(
    app_handle: tauri::AppHandle,
    old_shortcut: String,
    new_shortcut: String,
) -> Result<(), String> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    
    let shortcut_manager = app_handle.global_shortcut();
    
    // Unregister old shortcut
    shortcut_manager.unregister(&old_shortcut)
        .map_err(|e| format!("Failed to unregister old shortcut: {:?}", e))?;
    
    // Register new shortcut
    shortcut_manager.register(&new_shortcut)
        .map_err(|e| format!("Failed to register new shortcut: {:?}", e))?;
    
    println!("Shortcut updated: {} -> {}", old_shortcut, new_shortcut);
    Ok(())
}
```

### UI for Shortcut Customization

```html
<!-- settings.html -->
<div class="shortcut-editor">
    <div class="shortcut-item">
        <span class="action-name">Show Main Window</span>
        <input 
            type="text" 
            class="shortcut-input" 
            value="Ctrl+Shift+R"
            readonly
            data-action="show_main"
        />
        <button class="edit-btn">Edit</button>
    </div>
</div>

<script>
// Click input to start recording
document.querySelectorAll('.shortcut-input').forEach(input => {
    input.addEventListener('click', () => {
        input.value = 'Press keys...';
        input.classList.add('recording');
        
        const handler = (e: KeyboardEvent) => {
            e.preventDefault();
            
            // Build shortcut string
            const parts = [];
            if (e.ctrlKey) parts.push('Ctrl');
            if (e.shiftKey) parts.push('Shift');
            if (e.altKey) parts.push('Alt');
            if (e.metaKey) parts.push('Meta');
            
            // Add the actual key (but not modifier keys themselves)
            if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                parts.push(e.key.toUpperCase());
            }
            
            const shortcut = parts.join('+');
            input.value = shortcut || 'Press keys...';
            
            if (parts.length >= 2) { // At least one modifier + one key
                input.classList.remove('recording');
                window.removeEventListener('keydown', handler);
                
                // Save the new shortcut
                saveShortcut(input.dataset.action!, shortcut);
            }
        };
        
        window.addEventListener('keydown', handler);
    });
});
</script>
```

**Note:** User-customizable shortcuts add significant complexity. Only implement if your app truly needs it.

---

## 19.12 Testing Your Shortcuts

### Manual Testing Checklist

- [ ] Shortcut works when window has focus
- [ ] Global shortcut works when window doesn't have focus
- [ ] Shortcut works when window is minimized
- [ ] Shortcut doesn't interfere with text input in form fields
- [ ] Shortcut provides visual feedback when triggered
- [ ] Shortcut gracefully handles failure (already registered, etc.)
- [ ] Shortcut is documented in UI or About screen

### Automated Testing

While you can't easily automate global shortcuts, you can test window-level shortcuts:

```typescript
// test/shortcuts.test.ts
describe('Keyboard Shortcuts', () => {
    it('should close window on Escape', async () => {
        const escapeEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
        });
        
        window.dispatchEvent(escapeEvent);
        
        // Assert window.hide() was called
        expect(mockWindow.hide).toHaveBeenCalled();
    });
    
    it('should submit form on Enter', async () => {
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
        });
        
        const form = document.querySelector('form')!;
        form.dispatchEvent(enterEvent);
        
        // Assert form submission
        expect(mockInvoke).toHaveBeenCalledWith('submit_form', expect.any(Object));
    });
});
```

---

## 19.13 Common Pitfalls and Solutions

### Pitfall 1: Shortcut Doesn't Work in Input Fields

**Problem:**
```typescript
// This captures ALL 'Enter' presses, even in text inputs!
window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        submitForm();
    }
});
```

**Solution:**
```typescript
window.addEventListener('keydown', (e) => {
    // Check if we're in an input field
    const target = e.target as HTMLElement;
    const isInInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    
    if (e.key === 'Enter' && !isInInput) {
        submitForm();
    }
});
```

### Pitfall 2: Global Shortcut Fails Silently

**Problem:**
```rust
// App crashes if shortcut registration fails!
shortcut_manager.register("Ctrl+Shift+R")?;
```

**Solution:**
```rust
// Handle failure gracefully
match shortcut_manager.register("Ctrl+Shift+R") {
    Ok(_) => println!("Shortcut registered"),
    Err(e) => eprintln!("Warning: Shortcut registration failed: {:?}", e),
}
// App continues even if shortcut fails
```

### Pitfall 3: Case Sensitivity Issues

**Problem:**
```typescript
// This won't work for lowercase 'r'!
if (e.key === 'R') { }
```

**Solution:**
```typescript
// Use toUpperCase() for consistency
if (e.key.toUpperCase() === 'R') { }
```

### Pitfall 4: Forgetting to Unregister

**Problem:**
Global shortcuts persist across app restarts if not cleaned up properly.

**Solution:**
```rust
// In your app shutdown handler
impl Drop for AppState {
    fn drop(&mut self) {
        // Clean up global shortcuts
        if let Some(shortcut_manager) = &self.shortcut_manager {
            let _ = shortcut_manager.unregister("Ctrl+Shift+R");
        }
    }
}
```

Or unregister at startup:
```rust
// Defensive: unregister before registering
let _ = shortcut_manager.unregister("Ctrl+Shift+R");
shortcut_manager.register("Ctrl+Shift+R")?;
```

---

## 19.14 Key Takeaways

**Global Shortcuts:**
- Use `tauri-plugin-global-shortcut` for system-wide hotkeys
- Always handle registration failures gracefully
- Unregister shortcuts on app shutdown or before re-registering
- Choose shortcuts unlikely to conflict with system or other apps
- Provide fallback functionality if shortcut registration fails

**Window-Level Shortcuts:**
- Implemented with simple JavaScript event listeners
- Check if focus is in an input field before handling
- Use `preventDefault()` to avoid browser default behaviors
- Provide visual feedback when shortcuts are triggered

**Secret Shortcuts:**
- Use complex combinations (`Ctrl+Shift+Alt+Key`)
- Always confirm dangerous actions
- Document in About screen or user manual
- Perfect for power user features and app reset

**Accessibility:**
- Support Tab navigation with logical tab order
- Implement Enter for form submission
- Use Escape for closing dialogs and modals
- Consider arrow keys for list navigation

**Best Practices:**
- Test shortcuts on all target platforms
- Log shortcut events during development
- Handle edge cases (input fields, modals, etc.)
- Provide user feedback when shortcuts are triggered
- Document all shortcuts somewhere accessible

---

## 19.15 Practice Exercises

### Exercise 1: Add Window Management Shortcuts

Add global shortcuts for other windows in your app.

**Requirements:**
- `Ctrl+Shift+H` to show the hosts management window
- `Ctrl+Shift+A` to show the about window
- Gracefully handle registration failures

**Hints:**
- Follow the same pattern as `Ctrl+Shift+R`
- Remember to get the correct window by label
- Update the about window to document the new shortcuts

### Exercise 2: Implement Quick Connect Shortcut

Add `Ctrl+Q` to quickly connect to the most recently used server.

**Requirements:**
- Load the most recent connection from recent connections
- Show a confirmation toast with the server name
- Handle the case where there are no recent connections

**Hints:**
- Create a new window-level shortcut in `main.ts`
- Use the existing recent connections system
- Call the `connect_to_rdp` command

### Exercise 3: Create a Debug Mode Shortcut

Implement `Ctrl+Shift+D` to toggle debug mode.

**Requirements:**
- Global shortcut that works anywhere
- Shows a toast indicating debug mode status
- Persists across app restarts
- Updates the debug logging system

**Hints:**
- Store debug mode in AppData or localStorage
- Update the `DEBUG_MODE` mutex
- Show a visual indicator in the UI when debug mode is on

### Exercise 4: Add Search Focus Shortcut

Add `Ctrl+F` to focus the search box in the main window.

**Requirements:**
- Only works when main window is visible
- Prevents default browser Find dialog
- Clears current search text and focuses the input

**Implementation:**
```typescript
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        
        const searchInput = document.querySelector('#serverSearch') as HTMLInputElement;
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
    }
});
```

### Exercise 5: Secret Theme Toggle

Add `Ctrl+Shift+T` as a secret shortcut to cycle through themes.

**Requirements:**
- Available in all windows
- Cycles through: light → dark → light
- Shows a toast with the new theme name
- Saves the preference

**Hints:**
- Use the existing `set_theme` command
- Get current theme with `get_theme` command
- Show feedback with a toast notification

---

## 19.16 Further Reading

**Official Documentation:**
- [tauri-plugin-global-shortcut](https://v2.tauri.app/plugin/global-shortcut/)
- [Keyboard Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent)
- [Accessibility Keyboard Navigation](https://www.w3.org/WAI/WCAG21/Understanding/keyboard)

**Related Topics:**
- Chapter 7: Multi-Window Applications
- Chapter 15: System Tray Integration
- Chapter 9: Advanced Features

**Best Practices:**
- [Windows Keyboard Shortcuts Guidelines](https://learn.microsoft.com/en-us/windows/apps/design/input/keyboard-accelerators)
- [Keyboard Navigation Best Practices](https://webaim.org/techniques/keyboard/)

---

**Next Chapter:** [Chapter 20: Testing, Debugging, and Performance](Chapter_20_Testing_Debugging_and_Performance.md)

In the next chapter, we'll explore how to test your Tauri application, debug issues effectively, and optimize performance for production deployment.

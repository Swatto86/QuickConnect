# Chapter 8: State Management and Data Flow

**Estimated Reading Time:** 30-35 minutes  
**Difficulty Level:** Intermediate

---

## Introduction

Building responsive, interactive applications requires careful management of **state**—the data that drives your user interface. In this chapter, we'll explore how to manage application state effectively in Tauri applications, ensuring smooth data flow between backend (Rust) and frontend (TypeScript).

QuickConnect demonstrates several state management patterns:
- **Client-side filtering** for instant search results
- **Debounced input** for performance optimization
- **Form validation** with real-time feedback
- **Global state synchronization** across windows
- **Event-driven updates** for data changes

By the end of this chapter, you'll understand:
- Different state management patterns and when to use them
- Implementing real-time search and filtering
- Form validation techniques
- Reactive UI updates
- Optimizing performance with debouncing
- Synchronizing state across multiple windows

---

## 8.1 Understanding State in Tauri Applications

### The Three Layers of State

In a Tauri application, state exists at three distinct layers:

```
┌─────────────────────────────────────┐
│   Frontend State (TypeScript)       │
│   - UI state (dropdowns, modals)   │
│   - Temporary data (search queries) │
│   - Cached data (host lists)        │
└─────────────────────────────────────┘
            ↕ IPC Bridge
┌─────────────────────────────────────┐
│   Backend State (Rust)              │
│   - Shared state (Mutex<T>)         │
│   - Application configuration       │
│   - Active connections              │
└─────────────────────────────────────┘
            ↕ I/O Operations
┌─────────────────────────────────────┐
│   Persistent State (Storage)        │
│   - CSV files (hosts.csv)           │
│   - Credential Manager              │
│   - Registry (settings)             │
└─────────────────────────────────────┘
```

**Frontend State** is fast and reactive but temporary (lost on refresh).  
**Backend State** is shared across windows but requires Rust commands to access.  
**Persistent State** survives application restarts but requires I/O operations.

---

### State Management Principles

**1. Single Source of Truth**
Each piece of data should have one authoritative source.

```typescript
// ❌ Bad - Data duplicated in multiple places
let hosts: Host[] = [];
let hostsCache: Host[] = [];
let filteredHosts: Host[] = [];

// ✅ Good - Single source with derived data
let allHosts: Host[] = [];  // Source of truth
let filteredHosts: Host[] = []; // Derived from allHosts
```

**2. Unidirectional Data Flow**
Data should flow in one direction: Source → Transform → Display

```typescript
// Backend → Frontend → UI
allHosts = await invoke('get_all_hosts');  // 1. Fetch from backend
filteredHosts = filterHosts(query);         // 2. Transform
renderHostsList(filteredHosts);            // 3. Display
```

**3. Minimize Backend Calls**
Cache data on the frontend and only refresh when necessary.

```typescript
// ✅ Load once, filter on frontend
let allHosts: Host[] = await invoke('get_all_hosts');
function search(query: string) {
    // Fast - no backend call
    return allHosts.filter(h => h.hostname.includes(query));
}

// ❌ Call backend on every keystroke
async function search(query: string) {
    // Slow - makes backend call every time
    return await invoke('search_hosts', { query });
}
```

---

## 8.2 Client-Side State Management

### Pattern 1: In-Memory Caching

QuickConnect loads all hosts once and filters them on the frontend for instant results.

**Implementation from main.ts:**

```typescript
// Store all hosts globally for client-side filtering
let allHosts: Host[] = [];

// Load all hosts from backend ONCE
async function loadAllHosts() {
    try {
        allHosts = await invoke<Host[]>("get_all_hosts");
        renderHostsList(allHosts);
    } catch (err) {
        console.error("Failed to load hosts:", err);
        await showError(
            "Failed to load hosts list",
            "CSV_OPERATIONS",
            String(err)
        );
    }
}

// Filter happens entirely on frontend - instant results
function filterHosts(query: string): Host[] {
    if (!query.trim()) {
        return allHosts;  // No filter, return all
    }
    
    const lowerQuery = query.toLowerCase();
    return allHosts.filter(host => 
        host.hostname.toLowerCase().includes(lowerQuery) ||
        host.description.toLowerCase().includes(lowerQuery)
    );
}
```

**Benefits:**
- ✅ Instant search results (no network delay)
- ✅ Works offline once data is loaded
- ✅ Reduces backend load
- ✅ Simple implementation

**When to Use:**
- Data sets that fit comfortably in memory (< 10,000 items)
- Data that doesn't change frequently
- Search/filter operations

**When NOT to Use:**
- Large datasets (> 100,000 items)
- Frequently changing data
- Complex queries requiring database indexes

---

### Pattern 2: Component-Level State

State scoped to individual UI components.

**Example: Modal State**

```typescript
// Modal visibility is component-level state
function showAddHostModal() {
    const modal = document.getElementById("hostModal") as HTMLDialogElement;
    const form = document.getElementById("hostForm") as HTMLFormElement;
    
    // Reset form state
    form.reset();
    
    // Update modal state
    document.getElementById("modalTitle")!.textContent = "Add Host";
    
    // Show modal
    modal.showModal();
}

function hideModal() {
    const modal = document.getElementById("hostModal") as HTMLDialogElement;
    modal.close();  // State change: visible → hidden
}
```

---

### Pattern 3: Derived State

State calculated from other state rather than stored separately.

**QuickConnect Example:**

```typescript
import {
    filterHosts as filterHostsUtil,
    type Host,
} from "./utils/hosts";

let allHosts: Host[] = [];

function filterHosts(query: string): Host[] {
    return filterHostsUtil(allHosts, query);
}

async function handleSearch() {
    const searchInput = document.querySelector(
        "#search-input",
    ) as HTMLInputElement;
    if (!searchInput) return;

    const query = searchInput.value;
    const filteredHosts = filterHosts(query);
    renderHostsList(filteredHosts, query);
}
```

**Benefits:**
- ✅ No duplication - single source of truth
- ✅ Automatically consistent
- ✅ Easy to debug (just check source data)

---

## 8.3 Real-Time Search and Filtering

### Implementing Instant Search

QuickConnect implements instant search with highlighting for a smooth user experience.

**Step 1: Store Data Globally**

```typescript
let allHosts: Host[] = [];
```

**Step 2: Implement Filter Logic**

```typescript
function filterHosts(query: string): Host[] {
    if (!query.trim()) {
        return allHosts;
    }
    
    const lowerQuery = query.toLowerCase();
    return allHosts.filter(host => 
        host.hostname.toLowerCase().includes(lowerQuery) ||
        host.description.toLowerCase().includes(lowerQuery)
    );
}
```

**Step 3: Add Debouncing for Performance**

```typescript
let searchTimeout: ReturnType<typeof setTimeout>;

function initializeSearch() {
    const searchInput = document.querySelector("#search-input") as HTMLInputElement;
    
    if (searchInput) {
        // Debounce: wait 150ms after user stops typing
        searchInput.addEventListener("input", () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                handleSearch();
            }, 150);  // 150ms feels instant but saves CPU
        });
    }
}
```

**Why Debounce?**

Without debouncing, every keystroke triggers a re-render:

```
User types: "s e r v e r"
Without debounce: 6 renders (one per keystroke)
With 150ms debounce: 1 render (after user stops typing)
```

**Debounce Delay Guidelines:**
- **0-100ms** - Feels instant, use for simple operations
- **100-300ms** - Still responsive, good for filtering/search
- **300-500ms** - Noticeable delay, use for expensive operations
- **500ms+** - Slow, only for very expensive operations (API calls)

---

### Highlighting Search Matches

QuickConnect highlights matching text for better UX:

```typescript
function highlightMatches(text: string, query: string): string {
    if (!query.trim()) return text;
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: string[] = [];
    let lastIndex = 0;
    
    // Find all occurrences of query in text
    let index = lowerText.indexOf(lowerQuery, lastIndex);
    while (index !== -1) {
        // Add text before match
        if (index > lastIndex) {
            parts.push(text.substring(lastIndex, index));
        }
        
        // Add highlighted match
        parts.push(
            `<mark class="bg-yellow-300 dark:bg-yellow-600 text-base-content">
                ${text.substring(index, index + lowerQuery.length)}
            </mark>`
        );
        
        lastIndex = index + lowerQuery.length;
        index = lowerText.indexOf(lowerQuery, lastIndex);
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    
    return parts.join('');
}
```

**Usage in Rendering:**

```typescript
function renderHostsList(hosts: Host[], query: string = '') {
    hosts.forEach(host => {
        const highlightedHostname = highlightMatches(host.hostname, query);
        const highlightedDescription = highlightMatches(host.description, query);
        
        item.innerHTML = `
            <div class="flex flex-col flex-1">
                <span class="font-medium">${highlightedHostname}</span>
                <span class="text-sm opacity-70">${highlightedDescription}</span>
            </div>
        `;
    });
}
```

**Result:** Text matching "serv" appears highlighted in yellow.

---

### Advanced Filtering: Multiple Criteria

For more complex filtering, combine multiple conditions:

```typescript
interface FilterOptions {
    query: string;
    showOnlyRecent: boolean;
    sortBy: 'hostname' | 'description' | 'last_connected';
}

function filterHosts(options: FilterOptions): Host[] {
    let results = [...allHosts];
    
    // Text search
    if (options.query.trim()) {
        const lowerQuery = options.query.toLowerCase();
        results = results.filter(host => 
            host.hostname.toLowerCase().includes(lowerQuery) ||
            host.description.toLowerCase().includes(lowerQuery)
        );
    }
    
    // Only show recently connected
    if (options.showOnlyRecent) {
        results = results.filter(host => host.last_connected !== undefined);
    }
    
    // Sort
    results.sort((a, b) => {
        switch (options.sortBy) {
            case 'hostname':
                return a.hostname.localeCompare(b.hostname);
            case 'description':
                return a.description.localeCompare(b.description);
            case 'last_connected':
                return (b.last_connected || '').localeCompare(a.last_connected || '');
        }
    });
    
    return results;
}
```

---

## 8.4 Form Validation and Handling

### Real-Time Form Validation

QuickConnect validates forms as users type, providing immediate feedback.

**Pattern: Enable/Disable Submit Button**

```typescript
function validateForm() {
    const okBtn = document.querySelector(
        'button[type="submit"]'
    ) as HTMLButtonElement | null;
    const username = document.querySelector(
        "#username"
    ) as HTMLInputElement | null;
    const password = document.querySelector(
        "#password"
    ) as HTMLInputElement | null;

    if (okBtn && username && password) {
        // Check if both fields have content
        const isValid = 
            username.value.trim() !== "" && 
            password.value.trim() !== "";
        
        // Update button state
        okBtn.disabled = !isValid;
        okBtn.classList.toggle("opacity-50", !isValid);
        okBtn.classList.toggle("cursor-not-allowed", !isValid);
    }
}

// Attach to input events
username?.addEventListener("input", validateForm);
password?.addEventListener("input", validateForm);
```

**Visual Feedback:**
- Button is grayed out (`opacity-50`) when invalid
- Cursor changes to `cursor-not-allowed`
- Button becomes clickable when valid

---

### Custom Validation Rules

For more complex validation, create reusable validators:

```typescript
// Validation functions
function isValidFQDN(hostname: string): boolean {
    // Validates Fully Qualified Domain Names
    // - Contains at least one dot
    // - Labels are 1-63 characters
    // - Total length ≤ 253 characters
    const fqdnRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}$/;
    return fqdnRegex.test(hostname) && hostname.length <= 253;
}

function isValidDomain(domain: string): boolean {
    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[A-Za-z]{2,}$/;
    return domainRegex.test(domain) && domain.length <= 253;
}

function isValidServerName(server: string, domain: string): boolean {
    // Server must be FQDN ending with the domain
    if (!isValidDomain(domain)) return false;
    if (!isValidFQDN(server)) return false;
    
    const serverLower = server.toLowerCase();
    const domainLower = domain.toLowerCase();
    const expectedSuffix = '.' + domainLower;
    
    return serverLower.endsWith(expectedSuffix);
}
```

**Usage in Form Submission:**

```typescript
document.getElementById("hostForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const hostnameInput = document.getElementById("hostname") as HTMLInputElement;
    const hostname = hostnameInput.value.trim();
    
    // Validate before submitting
    if (!isValidFQDN(hostname)) {
        // Production: use showCustomDialog (see Chapter 5)
        console.error("Invalid hostname format");
        showNotification("Please enter a valid hostname: server.domain.com", 'error');
        return;  // Stop submission
    }
    
    // Proceed with submission
    const host: Host = {
        hostname: hostname,
        description: (document.getElementById("description") as HTMLTextAreaElement).value,
    };
    
    await saveHost(host);
});
```

---

### Inline Validation with Visual Feedback

Show validation errors directly in the form:

```typescript
function validateHostnameInput(input: HTMLInputElement) {
    const hostname = input.value.trim();
    const errorElement = document.getElementById("hostname-error")!;
    
    if (hostname === "") {
        // Empty - no error yet
        input.classList.remove("input-error", "input-success");
        errorElement.textContent = "";
        return false;
    } else if (!isValidFQDN(hostname)) {
        // Invalid format
        input.classList.add("input-error");
        input.classList.remove("input-success");
        errorElement.textContent = "Invalid hostname format. Use: server.domain.com";
        return false;
    } else {
        // Valid
        input.classList.add("input-success");
        input.classList.remove("input-error");
        errorElement.textContent = "";
        return true;
    }
}

// Attach to input event
hostnameInput.addEventListener("input", () => {
    validateHostnameInput(hostnameInput);
});
```

**HTML Structure:**

```html
<div class="form-control">
    <label class="label">
        <span class="label-text">Hostname</span>
    </label>
    <input 
        type="text" 
        id="hostname" 
        class="input input-bordered"
        placeholder="server.domain.com"
    />
    <label class="label">
        <span id="hostname-error" class="label-text-alt text-error"></span>
    </label>
</div>
```

**CSS Classes (DaisyUI):**
- `input-error` - Red border
- `input-success` - Green border
- `text-error` - Red text for error message

---

## 8.5 State Synchronization Across Windows

### Pattern: Event-Driven Updates

When data changes in one window, other windows need to know about it.

**Scenario:** User adds a host in the Hosts window. The Main window should refresh its list.

**Solution: Emit Events from Backend**

**In Rust (`src-tauri/src/commands/hosts.rs`):**

```rust
#[tauri::command]
pub fn save_host(app_handle: tauri::AppHandle, host: Host) -> Result<(), String> {
    use crate::core::types::Host;
    use tauri::{Emitter, Manager};

    // Persist host (QuickConnect delegates to core logic)
    crate::core::hosts::upsert_host(host).map_err(|e| e.to_string())?;

    // Notify windows that the hosts list should be refreshed
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.emit("hosts-updated", ());
    }
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.emit("hosts-updated", ());
    }

    Ok(())
}
```

**In Main Window (`main.ts`):**

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for host changes
await listen('hosts-updated', async () => {
    console.log('Hosts list changed, reloading...');
    await loadAllHosts();  // Refresh the list
});
```

**Flow:**
1. User clicks "Save" in Hosts window
2. Frontend calls `save_host` command
3. Backend saves to CSV
4. Backend emits `hosts-updated` event
5. Main window receives event
6. Main window reloads host list
7. UI updates automatically

---

### Pattern: Shared Backend State

For data that needs to be accessed by multiple windows simultaneously:

```rust
use std::sync::Mutex;
use tauri::State;

// Shared state
struct AppState {
    current_user: Mutex<Option<String>>,
    active_connections: Mutex<Vec<String>>,
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            current_user: Mutex::new(None),
            active_connections: Mutex::new(Vec::new()),
        })
        .invoke_handler(tauri::generate_handler![
            set_current_user,
            get_current_user,
            add_connection,
            get_active_connections
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn set_current_user(
    state: State<AppState>,
    username: String,
) -> Result<(), String> {
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
fn add_connection(
    app_handle: tauri::AppHandle,
    state: State<AppState>,
    hostname: String,
) -> Result<(), String> {
    // Add to active connections
    let mut connections = state.active_connections.lock()
        .map_err(|e| e.to_string())?;
    connections.push(hostname.clone());
    
    // Broadcast to all windows
    app_handle.emit("connection-added", hostname)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn get_active_connections(
    state: State<AppState>,
) -> Result<Vec<String>, String> {
    let connections = state.active_connections.lock()
        .map_err(|e| e.to_string())?;
    Ok(connections.clone())
}
```

**Usage in Frontend:**

```typescript
// Login window sets user
await invoke('set_current_user', { username: 'admin' });

// Main window displays user
const user = await invoke<string | null>('get_current_user');
document.getElementById('username-display')!.textContent = user || 'Guest';

// Any window can check active connections
const connections = await invoke<string[]>('get_active_connections');
console.log('Active connections:', connections);
```

---

### Pattern: LocalStorage for Simple State

For simple state that doesn't need backend involvement:

```typescript
// Save theme preference
function setTheme(theme: string) {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    
    // Notify other windows via storage event
    // (automatically fired by browser)
}

// Listen for changes from other windows
window.addEventListener('storage', (e) => {
    if (e.key === 'theme' && e.newValue) {
        document.documentElement.setAttribute('data-theme', e.newValue);
        console.log('Theme updated from another window');
    }
});
```

**Note:** LocalStorage events only fire in OTHER windows, not the one that made the change.

---

## 8.6 Managing Button and UI States

### Disabling Buttons During Operations

Prevent double-clicks and show loading states:

```typescript
document.getElementById("scanDomainForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const submitButton = (e.target as HTMLFormElement)
        .querySelector('button[type="submit"]') as HTMLButtonElement;
    const modal = document.getElementById("scanDomainModal") as HTMLDialogElement;
    
    try {
        // Disable button and show loading
        submitButton.disabled = true;
        submitButton.classList.add('btn-disabled');
        submitButton.innerHTML = `
            <span class="loading loading-spinner loading-sm"></span>
            <span class="ml-2">Scanning...</span>
        `;
        
        // Perform operation
        const result = await invoke<string>("scan_domain", { domain, server });
        
        // Close modal and show success
        modal.close();
        showToast(result, 'success');
        await loadHosts();
        
    } catch (error) {
        console.error("Failed to scan domain:", error);
        showToast(`Failed to scan domain: ${error}`, 'error');
    } finally {
        // Re-enable button and restore text
        submitButton.disabled = false;
        submitButton.classList.remove('btn-disabled');
        submitButton.innerHTML = 'Scan';
    }
});
```

**Key Points:**
- Disable button immediately to prevent double-click
- Show loading spinner for visual feedback
- Use `try/finally` to ensure button is re-enabled even if operation fails
- Restore original button text in `finally` block

---

### Conditional Button States

Enable/disable buttons based on data availability:

```typescript
function updateButtonStates(hasCredentials: boolean) {
    const deleteBtn = document.querySelector(
        "#delete-btn"
    ) as HTMLButtonElement | null;
    
    if (deleteBtn) {
        deleteBtn.disabled = !hasCredentials;
        deleteBtn.classList.toggle("opacity-50", !hasCredentials);
        deleteBtn.classList.toggle("cursor-not-allowed", !hasCredentials);
    }
}

// Call when credentials are loaded
async function checkCredentialsExist() {
    try {
        const stored = await invoke<StoredCredentials>("get_stored_credentials");
        updateButtonStates(!!stored);  // true if credentials exist
    } catch (err) {
        updateButtonStates(false);  // false if error or no credentials
    }
}
```

---

## 8.7 Auto-Close Timer Pattern

QuickConnect implements an auto-close timer when credentials are already stored.

**Scenario:** User opens app, credentials exist, automatically proceed after 5 seconds unless user interacts.

**Implementation:**

```typescript
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
let remainingSeconds = 5;
let animationFrameId: number | null = null;

let countdownElement: HTMLElement | null = null;
let timerNotificationElement: HTMLElement | null = null;

async function checkCredentialsExist() {
    try {
        const stored = await invoke<StoredCredentials>("get_stored_credentials");
        
        if (stored) {
            // Populate form
            username.value = stored.username;
            password.value = stored.password;
            
            // Start auto-close timer
            timerNotificationElement = document.querySelector("#timer-notification");
            countdownElement = document.querySelector("#countdown");
            
            if (timerNotificationElement && countdownElement) {
                remainingSeconds = 5;
                countdownElement.textContent = String(remainingSeconds);
                
                timerNotificationElement.classList.remove("hidden");
                timerNotificationElement.style.opacity = '1';
                
                // Animate countdown
                let lastUpdate = Date.now();
                const loop = function() {
                    const now = Date.now();
                    if (now - lastUpdate >= 1000) {
                        lastUpdate = now;
                        remainingSeconds--;
                        
                        if (countdownElement) {
                            countdownElement.textContent = String(remainingSeconds);
                        }
                        
                        // Pulse effect
                        if (timerNotificationElement) {
                            timerNotificationElement.style.backgroundColor = 
                                remainingSeconds % 2 === 0 
                                    ? 'rgba(59, 130, 246, 0.3)' 
                                    : 'rgba(59, 130, 246, 0.2)';
                        }
                        
                        if (remainingSeconds <= 0) {
                            // Time's up - proceed
                            invoke("close_login_and_prepare_main");
                            return;
                        }
                    }
                    animationFrameId = requestAnimationFrame(loop);
                };
                animationFrameId = requestAnimationFrame(loop);
            }
        }
    } catch (err) {
        console.error("Error checking credentials:", err);
    }
}

// Cancel timer when user interacts
function cancelAutoCloseTimer() {
    if (autoCloseTimer !== null) {
        clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
    }
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (timerNotificationElement) {
        timerNotificationElement.classList.add("hidden");
    }
}

// Cancel on user input
username?.addEventListener("input", () => {
    cancelAutoCloseTimer();
});
password?.addEventListener("input", () => {
    cancelAutoCloseTimer();
});
```

**HTML Structure:**

```html
<div id="timer-notification" class="hidden bg-blue-500/20 text-blue-100 px-4 py-2 rounded-md mb-4">
    Auto-proceeding in <span id="countdown" class="font-bold">5</span> seconds...
    <br>
    <span class="text-xs">Type to cancel</span>
</div>
```

**Benefits:**
- ✅ Smooth UX for returning users
- ✅ Visual countdown provides context
- ✅ Easy to cancel (just start typing)
- ✅ Uses `requestAnimationFrame` for smooth animation

---

## 8.8 Toast Notifications for User Feedback

### Simple Toast Implementation

QuickConnect uses toast notifications for quick feedback:

```typescript
function showToast(message: string, type: 'success' | 'error' = 'success') {
    const toastContainer = document.getElementById('toastContainer')!;
    const toast = document.createElement('div');
    
    toast.className = type === 'success' 
        ? 'alert alert-success mb-2' 
        : 'alert alert-error mb-2';
    
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Usage
showToast("Host saved successfully", 'success');
showToast("Failed to connect", 'error');
```

**HTML Container:**

```html
<div id="toastContainer" class="toast toast-top toast-center"></div>
```

---

### Notification vs Error Window

QuickConnect has two feedback mechanisms:

**Use Toast Notifications for:**
- ✅ Success messages ("Saved successfully")
- ✅ Quick confirmations ("Deleted")
- ✅ Non-critical info ("5 hosts found")

**Use Error Window for:**
- ✅ Critical errors that need attention
- ✅ Errors with detailed information
- ✅ Errors that require user action

```typescript
async function showError(message: string, category?: string, details?: string) {
    try {
        await invoke("show_error", {
            message,
            category: category || "ERROR",
            details: details || undefined,
        });
    } catch (err) {
        console.error("Failed to show error window:", err);
    }
}

// Success - use toast
showToast("Credentials saved successfully", 'success');

// Error - use error window
await showError(
    "Failed to save credentials to Windows Credential Manager",
    "CREDENTIALS",
    String(err)
);
```

---

## 8.9 QuickConnect State Management Architecture

Let's analyze how QuickConnect manages state across its application:

### State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER ACTIONS                            │
└─────────────────┬───────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND STATE (TypeScript)                    │
│  • allHosts: Host[] - Cached host list                     │
│  • filteredHosts: Host[] - Search results                  │
│  • searchTimeout - Debounce timer                          │
│  • autoCloseTimer - Auto-proceed countdown                 │
└─────────────────┬───────────────────────────────────────────┘
                  ↓ invoke()
┌─────────────────────────────────────────────────────────────┐
│              BACKEND STATE (Rust)                           │
│  • AppHandle - Window management                           │
│  • State<T> - Shared application state                     │
└─────────────────┬───────────────────────────────────────────┘
                  ↓ I/O Operations
┌─────────────────────────────────────────────────────────────┐
│              PERSISTENT STATE                               │
│  • hosts.csv - Host database                               │
│  • Credential Manager - Passwords                          │
│  • Registry - Theme preference                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Main Window State

**State Variables:**

```typescript
// Source of truth
let allHosts: Host[] = [];

// Derived state
let filteredHosts: Host[] = [];

// Timers
let searchTimeout: ReturnType<typeof setTimeout>;
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
let animationFrameId: number | null = null;

// UI state
let remainingSeconds = 5;
let isIntentionalReturn = false;
```

**State Lifecycle:**

1. **Initialization** - Load hosts from backend
   ```typescript
   await loadAllHosts();  // allHosts = [...]
   ```

2. **User Search** - Filter without backend call
   ```typescript
   filteredHosts = filterHosts(query);
   renderHostsList(filteredHosts, query);
   ```

3. **Data Change** - Reload from backend
   ```typescript
    await listen('hosts-updated', async () => {
       await loadAllHosts();  // Refresh allHosts
   });
   ```

---

### Hosts Window State

**State Variables:**

```typescript
let hosts: Host[] = [];           // All hosts
let filteredHosts: Host[] = [];   // Search results
```

**CRUD Operations:**

```typescript
// CREATE
async function saveHost(host: Host) {
    await invoke("save_host", { host });
    await loadHosts();  // Refresh local state
}

// READ
async function loadHosts() {
    hosts = await invoke<Host[]>("get_hosts");
    filteredHosts = [...hosts];
    renderHosts();
}

// UPDATE
window.editHost = (hostname: string) => {
    const host = hosts.find(h => h.hostname === hostname);
    // Populate form with host data
    // User edits and submits
    // saveHost() is called
};

// DELETE
window.deleteHost = async (hostname: string) => {
    await invoke("delete_host", { hostname });
    await loadHosts();  // Refresh
};
```

---

## 8.10 Performance Optimization Patterns

### 1. Debouncing Input

Reduce unnecessary work by waiting for user to stop typing:

```typescript
let searchTimeout: ReturnType<typeof setTimeout>;

searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch();  // Only runs once user stops typing
    }, 150);
});
```

**Before Debouncing:**
- User types "server" (6 keystrokes)
- 6 function calls
- 6 re-renders

**After Debouncing:**
- User types "server" (6 keystrokes)
- 1 function call (150ms after last keystroke)
- 1 re-render

---

### 2. Request Animation Frame for Smooth Animations

Use `requestAnimationFrame` for smooth 60fps animations:

```typescript
let lastUpdate = Date.now();

const loop = function() {
    const now = Date.now();
    
    // Only update every 1000ms (1 second)
    if (now - lastUpdate >= 1000) {
        lastUpdate = now;
        remainingSeconds--;
        updateDisplay();
    }
    
    // Continue animation loop
    animationFrameId = requestAnimationFrame(loop);
};

animationFrameId = requestAnimationFrame(loop);
```

**Benefits:**
- ✅ Browser-optimized timing (60fps)
- ✅ Automatic pausing when tab is not visible
- ✅ Smooth animations without setTimeout jitter

---

### 3. Minimize DOM Queries

Cache DOM elements instead of querying repeatedly:

```typescript
// ❌ Bad - Query DOM on every call
function updateCountdown() {
    document.getElementById('countdown')!.textContent = String(remaining);
}

// ✅ Good - Cache element reference
let countdownElement: HTMLElement | null = null;

function initTimer() {
    countdownElement = document.getElementById('countdown');
}

function updateCountdown() {
    if (countdownElement) {
        countdownElement.textContent = String(remaining);
    }
}
```

---

### 4. Batch DOM Updates

Update DOM once instead of multiple times:

```typescript
// ❌ Bad - Multiple DOM updates
filteredHosts.forEach(host => {
    const row = createRow(host);
    tableBody.appendChild(row);  // DOM update for each row
});

// ✅ Good - Single DOM update
const fragment = document.createDocumentFragment();
filteredHosts.forEach(host => {
    const row = createRow(host);
    fragment.appendChild(row);  // Update fragment (in memory)
});
tableBody.appendChild(fragment);  // Single DOM update
```

---

### 5. Virtual Scrolling for Large Lists

For very large lists (>1000 items), render only visible items:

```typescript
// Simplified virtual scrolling concept
function renderVisibleRows(scrollTop: number, viewportHeight: number) {
    const rowHeight = 50; // pixels
    const startIndex = Math.floor(scrollTop / rowHeight);
    const endIndex = startIndex + Math.ceil(viewportHeight / rowHeight);
    
    // Only render rows that are visible
    const visibleHosts = allHosts.slice(startIndex, endIndex);
    renderRows(visibleHosts);
}
```

**Note:** QuickConnect doesn't need this (typical use has <1000 hosts), but it's useful for large datasets.

---

## 8.11 Practice Exercises

### Exercise 1: Add Sorting to Host List

**Goal:** Add column headers that sort the host list.

**Requirements:**
1. Click "Hostname" header to sort by hostname
2. Click "Description" header to sort by description
3. Click "Last Connected" header to sort by date
4. Second click reverses sort order
5. Show arrow indicator (↑/↓) for current sort

**Hint:** Add state variables for sort column and direction:

```typescript
let sortColumn: 'hostname' | 'description' | 'last_connected' = 'hostname';
let sortDirection: 'asc' | 'desc' = 'asc';
```

---

### Exercise 2: Add Pagination

**Goal:** Show hosts in pages of 20 items.

**Requirements:**
1. Show only 20 hosts at a time
2. Add "Previous" and "Next" buttons
3. Show "Page 1 of 5" indicator
4. Disable "Previous" on first page
5. Disable "Next" on last page

**State Variables:**

```typescript
let currentPage = 1;
let itemsPerPage = 20;

function getPaginatedHosts(): Host[] {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredHosts.slice(start, end);
}
```

---

### Exercise 3: Add Recent Searches

**Goal:** Remember the last 5 searches and show them as quick buttons.

**Requirements:**
1. Store last 5 unique search queries
2. Show them as clickable buttons below search input
3. Click to re-apply that search
4. Clear button to remove all recent searches
5. Persist in localStorage

**Implementation:**

```typescript
let recentSearches: string[] = [];

function addRecentSearch(query: string) {
    if (!query.trim()) return;
    
    // Remove if already exists
    recentSearches = recentSearches.filter(s => s !== query);
    
    // Add to front
    recentSearches.unshift(query);
    
    // Keep only last 5
    recentSearches = recentSearches.slice(0, 5);
    
    // Save to localStorage
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    
    // Update UI
    renderRecentSearches();
}
```

---

### Exercise 4: Add Undo for Delete

**Goal:** Allow undo after deleting a host.

**Requirements:**
1. After delete, show toast: "Host deleted. Undo?"
2. Click "Undo" within 5 seconds to restore
3. Toast disappears after 5 seconds
4. Undo not available after toast closes

**State Variables:**

```typescript
let deletedHost: Host | null = null;
let undoTimeout: ReturnType<typeof setTimeout> | null = null;
```

---

## Solutions to Practice Exercises

### Solution 1: Add Sorting to Host List

```typescript
let sortColumn: 'hostname' | 'description' | 'last_connected' = 'hostname';
let sortDirection: 'asc' | 'desc' = 'asc';

function sortHosts(hosts: Host[]): Host[] {
    return [...hosts].sort((a, b) => {
        let compareA: string;
        let compareB: string;
        
        switch (sortColumn) {
            case 'hostname':
                compareA = a.hostname;
                compareB = b.hostname;
                break;
            case 'description':
                compareA = a.description;
                compareB = b.description;
                break;
            case 'last_connected':
                compareA = a.last_connected || '';
                compareB = b.last_connected || '';
                break;
        }
        
        const result = compareA.localeCompare(compareB);
        return sortDirection === 'asc' ? result : -result;
    });
}

function setSortColumn(column: typeof sortColumn) {
    if (sortColumn === column) {
        // Toggle direction
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // New column, default to ascending
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    // Re-render with new sort
    renderHostsList(sortHosts(filteredHosts), searchQuery);
}

// Add click handlers to headers
document.getElementById('header-hostname')?.addEventListener('click', () => {
    setSortColumn('hostname');
});
document.getElementById('header-description')?.addEventListener('click', () => {
    setSortColumn('description');
});
document.getElementById('header-lastconnected')?.addEventListener('click', () => {
    setSortColumn('last_connected');
});
```

---

### Solution 2: Add Pagination

```typescript
let currentPage = 1;
let itemsPerPage = 20;

function getTotalPages(): number {
    return Math.ceil(filteredHosts.length / itemsPerPage);
}

function getPaginatedHosts(): Host[] {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredHosts.slice(start, end);
}

function renderPagination() {
    const totalPages = getTotalPages();
    const paginationContainer = document.getElementById('pagination')!;
    
    paginationContainer.innerHTML = `
        <button 
            id="prev-btn" 
            class="btn btn-sm"
            ${currentPage === 1 ? 'disabled' : ''}
        >
            Previous
        </button>
        <span class="mx-4">
            Page ${currentPage} of ${totalPages}
        </span>
        <button 
            id="next-btn" 
            class="btn btn-sm"
            ${currentPage === totalPages ? 'disabled' : ''}
        >
            Next
        </button>
    `;
    
    document.getElementById('prev-btn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderAll();
        }
    });
    
    document.getElementById('next-btn')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderAll();
        }
    });
}

function renderAll() {
    const paginatedHosts = getPaginatedHosts();
    renderHostsList(paginatedHosts);
    renderPagination();
}

// Reset to page 1 when search changes
function handleSearch() {
    currentPage = 1;
    filteredHosts = filterHosts(query);
    renderAll();
}
```

---

### Solution 3: Add Recent Searches

```typescript
let recentSearches: string[] = [];

function loadRecentSearches() {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
        recentSearches = JSON.parse(saved);
        renderRecentSearches();
    }
}

function addRecentSearch(query: string) {
    if (!query.trim()) return;
    
    // Remove if already exists
    recentSearches = recentSearches.filter(s => s !== query);
    
    // Add to front
    recentSearches.unshift(query);
    
    // Keep only last 5
    recentSearches = recentSearches.slice(0, 5);
    
    // Save
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    
    renderRecentSearches();
}

function renderRecentSearches() {
    const container = document.getElementById('recent-searches')!;
    
    if (recentSearches.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div class="flex gap-2 items-center flex-wrap mb-2">
            <span class="text-sm opacity-70">Recent:</span>
            ${recentSearches.map(search => `
                <button class="btn btn-xs recent-search-btn" data-query="${search}">
                    ${search}
                </button>
            `).join('')}
            <button class="btn btn-xs btn-ghost clear-recent-btn">
                Clear
            </button>
        </div>
    `;
    
    // Add click handlers
    document.querySelectorAll('.recent-search-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const query = (e.target as HTMLElement).dataset.query!;
            const searchInput = document.getElementById('search-input') as HTMLInputElement;
            searchInput.value = query;
            handleSearch();
        });
    });
    
    document.querySelector('.clear-recent-btn')?.addEventListener('click', () => {
        recentSearches = [];
        localStorage.removeItem('recentSearches');
        renderRecentSearches();
    });
}

// Call on search
function handleSearch() {
    const query = searchInput.value;
    addRecentSearch(query);
    // ... rest of search logic
}

// Load on initialization
loadRecentSearches();
```

---

### Solution 4: Add Undo for Delete

```typescript
let deletedHost: Host | null = null;
let undoTimeout: ReturnType<typeof setTimeout> | null = null;

window.deleteHost = async (hostname: string) => {
    const host = hosts.find(h => h.hostname === hostname);
    if (!host) return;
    
    // Store for undo
    deletedHost = host;
    
    // Delete from backend
    await invoke("delete_host", { hostname });
    await loadHosts();
    
    // Show undo toast
    showUndoToast();
    
    // Clear undo option after 5 seconds
    undoTimeout = setTimeout(() => {
        deletedHost = null;
    }, 5000);
};

function showUndoToast() {
    const toast = document.createElement('div');
    toast.className = 'alert alert-warning mb-2';
    toast.innerHTML = `
        <span>Host deleted</span>
        <button class="btn btn-sm" id="undo-btn">Undo</button>
    `;
    
    const container = document.getElementById('toastContainer')!;
    container.appendChild(toast);
    
    document.getElementById('undo-btn')?.addEventListener('click', async () => {
        if (deletedHost) {
            await invoke("save_host", { host: deletedHost });
            await loadHosts();
            deletedHost = null;
            
            if (undoTimeout) {
                clearTimeout(undoTimeout);
                undoTimeout = null;
            }
            
            toast.remove();
            showToast("Host restored", 'success');
        }
    });
    
    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}
```

---

## Summary

In this chapter, you learned comprehensive state management patterns for Tauri applications:

✅ **State Layers** - Frontend, backend, and persistent state  
✅ **Client-Side Caching** - Load once, filter locally for instant results  
✅ **Debouncing** - Optimize performance by reducing unnecessary work  
✅ **Form Validation** - Real-time feedback with custom validators  
✅ **Search & Filter** - Instant search with highlighting  
✅ **State Synchronization** - Keep multiple windows in sync with events  
✅ **UI State Management** - Button states, loading indicators, toasts  
✅ **Performance Patterns** - Request animation frame, DOM batching, virtual scrolling  
✅ **QuickConnect Architecture** - Real-world example of effective state management

Effective state management is the foundation of responsive, user-friendly applications. By following these patterns, you can build applications that feel instant and professional.

---

## What's Next?

In **Chapter 9**, we'll dive into **Tauri Commands - The Bridge**:
- Understanding `#[tauri::command]` in depth
- Synchronous vs asynchronous commands
- Parameter passing and serialization
- Advanced error handling patterns
- Command organization and best practices

You now have the skills to manage complex application state! 🎯

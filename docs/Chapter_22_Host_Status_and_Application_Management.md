# Chapter 22: Host Status Checking and Application Management

**Learning Objectives:**
- Implement online/offline host status detection
- Display real-time connectivity indicators in the UI
- Build a complete application reset system
- Manage bulk host operations
- Handle host deletion workflows
- Optimize status checking performance

---

## 22.1 Introduction to Host Status Checking

In an RDP connection manager, knowing whether a host is reachable before attempting to connect significantly improves the user experience. QuickConnect implements intelligent host status detection by checking TCP connectivity to the RDP port (3389).

### Why Status Checking Matters

**User Benefits:**
- Instant visual feedback on host availability
- Avoid wasting time on unreachable hosts
- Identify network issues quickly
- Better decision-making for connection attempts

**Technical Benefits:**
- Non-blocking asynchronous checks
- Configurable timeout prevents UI hangs
- Minimal network overhead
- Cross-platform TCP implementation

### Architecture Overview

```
┌─────────────────────────────────────────┐
│  Frontend (TypeScript)                  │
│  - Display host list with status icons │
│  - Request status updates               │
└────────────┬────────────────────────────┘
             │ invoke('check_host_status')
             v
┌─────────────────────────────────────────┐
│  Commands Layer                         │
│  commands/hosts.rs                      │
│  - Validate hostname                    │
│  - Call async status check              │
└────────────┬────────────────────────────┘
             │
             v
┌─────────────────────────────────────────┐
│  Status Check Logic                     │
│  - Resolve DNS hostname → IP            │
│  - Attempt TCP connection to port 3389  │
│  - 2-second timeout                     │
│  - Return "online", "offline", "unknown"│
└─────────────────────────────────────────┘
```

---

## 22.2 Implementing Host Status Detection

### The check_host_status Command

QuickConnect's host status checking is implemented in [commands/hosts.rs](../src-tauri/src/commands/hosts.rs#L108):

```rust
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;
use crate::infra::debug_log;

/// Checks if a host is online by attempting to connect to RDP port 3389.
///
/// Returns "online", "offline", or "unknown".
///
/// # Arguments
/// * `hostname` - The hostname or IP address to check
///
/// # Returns
/// * `Ok("online")` - Host is reachable on port 3389
/// * `Ok("offline")` - Host is not reachable or port is closed
/// * `Ok("unknown")` - DNS resolution failed
///
/// # Implementation Details
/// - Uses TCP connection attempt to port 3389 (standard RDP port)
/// - 2-second timeout prevents UI blocking
/// - Asynchronous execution doesn't block main thread
/// - Logs all attempts for debugging
#[tauri::command]
pub async fn check_host_status(hostname: String) -> Result<String, String> {
    debug_log(
        "DEBUG",
        "STATUS_CHECK",
        &format!("Checking status for host: {}", hostname),
        None,
    );

    // Step 1: Resolve hostname to IP address
    // Port 3389 is the standard RDP port
    let addr = format!("{}:3389", hostname);
    let socket_addrs: Vec<_> = match addr.to_socket_addrs() {
        Ok(addrs) => addrs.collect(),
        Err(e) => {
            // DNS resolution failed - host doesn't exist or network issue
            debug_log(
                "DEBUG",
                "STATUS_CHECK",
                &format!("Failed to resolve hostname {}: {}", hostname, e),
                Some(&e.to_string()),
            );
            return Ok("unknown".to_string());
        }
    };

    if socket_addrs.is_empty() {
        debug_log(
            "DEBUG",
            "STATUS_CHECK",
            &format!("No addresses resolved for hostname: {}", hostname),
            None,
        );
        return Ok("unknown".to_string());
    }

    // Step 2: Attempt TCP connection with timeout
    // This checks if port 3389 is open and accepting connections
    // Timeout prevents UI from hanging on unreachable hosts
    let timeout = Duration::from_secs(2);
    match TcpStream::connect_timeout(&socket_addrs[0], timeout) {
        Ok(_) => {
            debug_log(
                "DEBUG",
                "STATUS_CHECK",
                &format!("Host {} is online (port 3389 open)", hostname),
                None,
            );
            Ok("online".to_string())
        }
        Err(e) => {
            debug_log(
                "DEBUG",
                "STATUS_CHECK",
                &format!("Host {} is offline or unreachable: {}", hostname, e),
                Some(&e.to_string()),
            );
            Ok("offline".to_string())
        }
    }
}
```

### Key Implementation Details

**1. DNS Resolution:**
```rust
let addr = format!("{}:3389", hostname);
let socket_addrs: Vec<_> = match addr.to_socket_addrs() {
    Ok(addrs) => addrs.collect(),
    Err(e) => return Ok("unknown".to_string()),
};
```
- Converts hostname to IP address
- Returns "unknown" if DNS fails
- Handles both hostnames and IP addresses

**2. TCP Connection Attempt:**
```rust
let timeout = Duration::from_secs(2);
match TcpStream::connect_timeout(&socket_addrs[0], timeout) {
    Ok(_) => Ok("online".to_string()),
    Err(_) => Ok("offline".to_string()),
}
```
- 2-second timeout prevents hanging
- Tests actual connectivity, not just ping
- Checks the RDP port specifically

**3. Return Values:**
- `"online"` - Host is reachable and RDP port is open
- `"offline"` - Host is unreachable or port is closed/filtered
- `"unknown"` - DNS resolution failed (invalid hostname or network issue)

---

## 22.3 Frontend Integration: Displaying Status

### TypeScript Interface

```typescript
interface Host {
  hostname: string;
  description: string;
  last_connected?: string;
  status?: 'online' | 'offline' | 'unknown' | 'checking';
}

type HostStatus = 'online' | 'offline' | 'unknown';
```

### Checking Host Status

```typescript
import { invoke } from '@tauri-apps/api/core';

async function checkHostStatus(hostname: string): Promise<HostStatus> {
  try {
    const status = await invoke<string>('check_host_status', { hostname });
    return status as HostStatus;
  } catch (error) {
    console.error(`Failed to check status for ${hostname}:`, error);
    return 'unknown';
  }
}
```

### Real-Time Status Updates

```typescript
interface HostWithStatus extends Host {
  status: 'online' | 'offline' | 'unknown' | 'checking';
}

let hosts: HostWithStatus[] = [];

// Load hosts and check status for each
async function loadHostsWithStatus() {
  try {
    // Load all hosts from backend
    const hostsData = await invoke<Host[]>('get_hosts');
    
    // Initialize with 'checking' status
    hosts = hostsData.map(host => ({
      ...host,
      status: 'checking' as const
    }));
    
    // Render immediately with checking indicators
    renderHosts();
    
    // Check status for each host in parallel
    const statusPromises = hosts.map(async (host, index) => {
      const status = await checkHostStatus(host.hostname);
      hosts[index].status = status;
      // Update UI for this specific host
      updateHostStatus(host.hostname, status);
    });
    
    // Wait for all status checks to complete
    await Promise.all(statusPromises);
    
  } catch (error) {
    console.error('Failed to load hosts:', error);
  }
}
```

### Status Indicators in HTML

```html
<!-- Host card with status indicator -->
<div class="card bg-base-200 shadow-sm" data-hostname="${host.hostname}">
  <div class="card-body">
    <div class="flex items-center gap-2">
      <!-- Status indicator -->
      <div class="status-indicator ${getStatusClass(host.status)}">
        ${getStatusIcon(host.status)}
      </div>
      
      <!-- Host info -->
      <div class="flex-1">
        <h3 class="card-title">${escapeHtml(host.hostname)}</h3>
        <p class="text-sm text-base-content/70">
          ${escapeHtml(host.description)}
        </p>
      </div>
      
      <!-- Actions -->
      <button class="btn btn-primary" 
              ${host.status === 'offline' ? 'disabled' : ''}>
        Connect
      </button>
    </div>
  </div>
</div>
```

### Status Icon Helper Functions

```typescript
function getStatusClass(status: string): string {
  switch (status) {
    case 'online':
      return 'text-success'; // Green
    case 'offline':
      return 'text-error';   // Red
    case 'checking':
      return 'text-info loading'; // Blue, animated
    case 'unknown':
    default:
      return 'text-warning'; // Yellow
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'online':
      return '●'; // Solid circle
    case 'offline':
      return '○'; // Empty circle
    case 'checking':
      return '◐'; // Half circle (or use spinner)
    case 'unknown':
    default:
      return '◌'; // Dotted circle
  }
}

// Update a single host's status in the UI
function updateHostStatus(hostname: string, status: HostStatus) {
  const hostCard = document.querySelector(`[data-hostname="${hostname}"]`);
  if (!hostCard) return;
  
  const indicator = hostCard.querySelector('.status-indicator');
  if (indicator) {
    indicator.className = `status-indicator ${getStatusClass(status)}`;
    indicator.textContent = getStatusIcon(status);
  }
  
  // Disable connect button if offline
  const connectBtn = hostCard.querySelector('.btn-primary');
  if (connectBtn) {
    if (status === 'offline') {
      connectBtn.setAttribute('disabled', 'true');
      connectBtn.setAttribute('title', 'Host is offline');
    } else {
      connectBtn.removeAttribute('disabled');
      connectBtn.setAttribute('title', 'Connect to this host');
    }
  }
}
```

### Styling Status Indicators

```css
/* Status indicator base styles */
.status-indicator {
  font-size: 1.5rem;
  line-height: 1;
  transition: all 0.3s ease;
}

/* Online status - green pulse */
.status-indicator.text-success {
  color: #10b981;
  animation: pulse-green 2s infinite;
}

/* Offline status - red */
.status-indicator.text-error {
  color: #ef4444;
}

/* Checking status - rotating spinner */
.status-indicator.loading {
  animation: spin 1s linear infinite;
}

/* Unknown status - yellow */
.status-indicator.text-warning {
  color: #f59e0b;
}

@keyframes pulse-green {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

---

## 22.4 Performance Optimization

### Batching Status Checks

Instead of checking all hosts simultaneously, batch them to avoid overwhelming the network:

```typescript
async function batchCheckHostStatus(hosts: Host[], batchSize: number = 5) {
  const results = new Map<string, HostStatus>();
  
  // Process hosts in batches
  for (let i = 0; i < hosts.length; i += batchSize) {
    const batch = hosts.slice(i, i + batchSize);
    
    // Check this batch in parallel
    const batchPromises = batch.map(async (host) => {
      const status = await checkHostStatus(host.hostname);
      results.set(host.hostname, status);
      updateHostStatus(host.hostname, status);
    });
    
    await Promise.all(batchPromises);
    
    // Small delay between batches to prevent network flooding
    if (i + batchSize < hosts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
```

### Caching Status Results

```typescript
interface StatusCache {
  status: HostStatus;
  timestamp: number;
}

const statusCache = new Map<string, StatusCache>();
const CACHE_DURATION = 30000; // 30 seconds

async function checkHostStatusCached(hostname: string): Promise<HostStatus> {
  const now = Date.now();
  const cached = statusCache.get(hostname);
  
  // Return cached status if still valid
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.status;
  }
  
  // Check actual status
  const status = await checkHostStatus(hostname);
  
  // Update cache
  statusCache.set(hostname, {
    status,
    timestamp: now
  });
  
  return status;
}

// Clear cache for a specific host (e.g., after connection attempt)
function invalidateStatusCache(hostname: string) {
  statusCache.delete(hostname);
}

// Clear entire cache
function clearStatusCache() {
  statusCache.clear();
}
```

### Background Periodic Checks

```typescript
class HostStatusMonitor {
  private interval: number | null = null;
  private checkInterval: number = 60000; // 1 minute
  
  start(hosts: Host[]) {
    // Stop existing monitor
    this.stop();
    
    // Start periodic checks
    this.interval = window.setInterval(() => {
      this.checkAllHosts(hosts);
    }, this.checkInterval);
    
    // Check immediately on start
    this.checkAllHosts(hosts);
  }
  
  stop() {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  private async checkAllHosts(hosts: Host[]) {
    await batchCheckHostStatus(hosts, 5);
  }
  
  setInterval(milliseconds: number) {
    this.checkInterval = milliseconds;
    // Restart with new interval
    if (this.interval !== null) {
      this.stop();
      // Will start again when needed
    }
  }
}

// Usage
const statusMonitor = new HostStatusMonitor();

// Start monitoring when hosts window is visible
document.addEventListener('DOMContentLoaded', async () => {
  const hosts = await invoke<Host[]>('get_hosts');
  statusMonitor.start(hosts);
});

// Stop monitoring when window is hidden
window.addEventListener('beforeunload', () => {
  statusMonitor.stop();
});
```

---

## 22.5 Application Reset System

QuickConnect includes a comprehensive application reset feature that clears all user data and returns the application to its initial state. This is implemented in [commands/system.rs](../src-tauri/src/commands/system.rs#L219).

### The reset_application Command

```rust
/// Resets the application to its initial state.
///
/// This command:
/// 1. Deletes all stored credentials from Windows Credential Manager
/// 2. Clears the hosts list (hosts.csv)
/// 3. Deletes recent_connections.json
/// 4. Deletes all saved RDP connection files (*.rdp)
/// 5. Returns a detailed report of what was deleted
///
/// # Returns
/// * `Ok(String)` - Detailed report of reset operations
/// * `Err(String)` - Error if reset fails
///
/// # Security Note
/// This is a destructive operation and should require user confirmation.
/// In QuickConnect, the UI binds the secret keyboard shortcut Ctrl+Shift+Alt+R
/// in each window (frontend keydown listener) and then invokes this command.
#[tauri::command]
pub async fn reset_application(app_handle: tauri::AppHandle) -> Result<String, String> {
    use crate::adapters::{CredentialManager, WindowsCredentialManager};
    use std::fs;
    use std::path::PathBuf;
    
    let mut report = String::from("=== QuickConnect Application Reset ===\n\n");
    let cred_manager = WindowsCredentialManager::new();
    
    // Step 1: Delete global credentials
    match commands::delete_credentials().await {
        Ok(_) => {
            report.push_str("✓ Deleted global QuickConnect credentials\n");
        }
        Err(e) => {
            report.push_str(&format!("✗ Failed to delete global credentials: {}\n", e));
        }
    }
    
    // Step 2: Delete all TERMSRV/* credentials (RDP host credentials)
    match cred_manager.list_with_prefix("TERMSRV/") {
        Ok(targets) => {
            let count = targets.len();
            report.push_str(&format!("\nFound {} RDP host credentials:\n", count));
            for target in &targets {
                report.push_str(&format!("  - {}\n", target));
                if let Err(e) = cred_manager.delete(target) {
                    report.push_str(&format!("    ✗ Failed to delete: {}\n", e));
                }
            }
            report.push_str(&format!("✓ Processed {} RDP host credentials\n", count));
        }
        Err(e) => {
            report.push_str(&format!("✗ Failed to enumerate TERMSRV credentials: {}\n", e));
        }
    }
    
    // Step 3: Delete all RDP files
    if let Ok(appdata_dir) = std::env::var("APPDATA") {
        let connections_dir = PathBuf::from(appdata_dir)
            .join("QuickConnect")
            .join("Connections");
        report.push_str(&format!("\nRDP Files in {:?}:\n", connections_dir));
        
        if connections_dir.exists() {
            match std::fs::read_dir(&connections_dir) {
                Ok(entries) => {
                    let mut deleted_count = 0;
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().and_then(|s| s.to_str()) == Some("rdp")
                            && std::fs::remove_file(&path).is_ok()
                        {
                            deleted_count += 1;
                        }
                    }
                    report.push_str(&format!("✓ Deleted {} RDP files\n", deleted_count));
                }
                Err(e) => {
                    report.push_str(&format!("✗ Failed to read connections directory: {}\n", e));
                }
            }
        }
    }
    
    // Step 4: Delete hosts.csv
    match commands::delete_all_hosts(app_handle).await {
        Ok(_) => report.push_str("\n✓ Cleared hosts.csv\n"),
        Err(e) => report.push_str(&format!("\n✗ Failed to clear hosts.csv: {}\n", e)),
    }
    
    // Step 5: Delete recent_connections.json
    report.push_str("\nRecent Connections:\n");
    if let Ok(appdata) = std::env::var("APPDATA") {
        let recent_path = PathBuf::from(appdata)
            .join("QuickConnect")
            .join("recent_connections.json");
        
        if recent_path.exists() {
            match fs::remove_file(&recent_path) {
                Ok(_) => report.push_str("✓ Deleted recent connections history\n"),
                Err(e) => report.push_str(&format!("✗ Failed to delete recent connections: {}\n", e)),
            }
        } else {
            report.push_str("  (No recent connections found)\n");
        }
    }
    
    report.push_str("\n=== Reset Complete ===\n");
    report.push_str("The application has been reset to its initial state.\n");
    report.push_str("Please restart the application.\n");
    
    Ok(report)
}
```

### Frontend Integration

```typescript
// Typically called from a secret keyboard shortcut
async function resetApplication() {
  // Import custom dialog utility
  import { showCustomDialog } from './utils/ui';
  
  // Always confirm before resetting with styled custom dialog
  const confirmed = await showCustomDialog({
    title: '⚠️ WARNING: Application Reset ⚠️',
    message: 'This will permanently delete:\n' +
      '• All saved credentials\n' +
      '• All RDP connection files\n' +
      '• All saved hosts\n' +
      '• Recent connection history\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Are you sure you want to continue?',
    type: 'confirm',
    icon: 'warning',
    confirmText: 'Continue',
    cancelText: 'Cancel'
  });
  
  if (!confirmed) return;
  
  // Second confirmation for safety
  const confirmedAgain = await showCustomDialog({
    title: 'FINAL CONFIRMATION',
    message: 'This will COMPLETELY reset QuickConnect and permanently delete your data.\n\n' +
      'Click Confirm to proceed with the reset, or Cancel to abort.',
    type: 'confirm',
    icon: 'error',
    confirmText: 'Reset Now',
    cancelText: 'Cancel'
  });
  
  if (!confirmedAgain) return;
  
  try {
    // Perform reset
    const report = await invoke<string>('reset_application');
    
    // Show detailed report with success icon
    await showCustomDialog({
      title: 'Application Reset',
      message: report,
      type: 'alert',
      icon: 'success'
    });

    // Return to the initial credentials screen
    await invoke('show_login_window');

    // Optional restart
    const shouldQuit = await showCustomDialog({
      title: 'Reset Complete',
      message: 'It is recommended to restart the application now.\n\n' +
        'Do you want to quit the application?',
      type: 'confirm',
      icon: 'info',
      confirmText: 'Quit Now',
      cancelText: 'Continue'
    });
    
    if (shouldQuit) {
      await invoke('quit_app');
    }
    
  } catch (error) {
    await showCustomDialog({
      title: 'Reset Failed',
      message: 'Failed to reset application: ' + error,
      type: 'alert',
      icon: 'error'
    });
  }
}
```

### Keyboard Shortcut Registration

```rust
// In QuickConnect this is done in src-tauri/src/lib.rs inside the Builder .setup(|app| { ... }) closure.
use tauri_plugin_global_shortcut::GlobalShortcutExt;

let shortcut_manager = app.handle().global_shortcut();

// Try to unregister first in case it was registered by a previous instance
let _ = shortcut_manager.unregister("Ctrl+Shift+R");
let _ = shortcut_manager.unregister("Ctrl+Shift+E");

// Ctrl+Shift+R toggles the main window and focuses search
let app_handle_for_hotkey = app.app_handle().clone();
match shortcut_manager.on_shortcut("Ctrl+Shift+R", move |_app_handle, _shortcut, event| {
  use tauri_plugin_global_shortcut::ShortcutState;
  if event.state != ShortcutState::Pressed {
    return;
  }

  if let Some(window) = app_handle_for_hotkey.get_webview_window("main") {
    tauri::async_runtime::spawn(async move {
      if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
      } else {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("focus-search", ());
      }
    });
  }
}) {
  Ok(_) => {
    let _ = shortcut_manager.register("Ctrl+Shift+R");
  }
  Err(_) => {
    // QuickConnect continues to run even if hotkeys cannot be registered.
  }
}

// Ctrl+Shift+E toggles the error window
let app_handle_for_error_hotkey = app.app_handle().clone();
if shortcut_manager
  .on_shortcut("Ctrl+Shift+E", move |_app_handle, _shortcut, event| {
    use tauri_plugin_global_shortcut::ShortcutState;
    if event.state != ShortcutState::Pressed {
      return;
    }
    if let Some(window) = app_handle_for_error_hotkey.get_webview_window("error") {
      tauri::async_runtime::spawn(async move {
        if window.is_visible().unwrap_or(false) {
          let _ = window.hide();
        } else {
          let _ = window.unminimize();
          let _ = window.show();
          let _ = window.set_focus();
        }
      });
    }
  })
  .is_ok()
{
  let _ = shortcut_manager.register("Ctrl+Shift+E");
}
```

---

## 22.6 Bulk Host Operations

### Delete All Hosts

QuickConnect provides a `delete_all_hosts` command for clearing the entire hosts database:

```rust
/// Deletes all hosts from the CSV file.
///
/// Thin wrapper that:
/// 1. Calls core::hosts::delete_all_hosts()
/// 2. Emits UI update events
///
/// # Returns
/// * `Ok(())` - All hosts deleted successfully
/// * `Err(String)` - Error message for frontend
#[tauri::command]
pub async fn delete_all_hosts(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Delegate to core business logic
    crate::core::hosts::delete_all_hosts().map_err(|e| e.to_string())?;

    // Emit event to notify all windows that hosts list has been updated
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.emit("hosts-updated", ());
    }
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.emit("hosts-updated", ());
    }

    Ok(())
}
```

### Frontend Implementation

```typescript
async function deleteAllHosts() {
  // Confirmation dialog using custom dialog
  const count = hosts.length;
  const confirmed = await showCustomDialog({
    title: 'Delete All Hosts?',
    message: `Delete all ${count} host(s)?\n\nThis will permanently remove all hosts from your database.\nRecent connections and credentials will not be affected.`,
    type: 'warning'
  });
  
  if (!confirmed) return;
  
  try {
    await invoke('delete_all_hosts');
    
    // Clear local state
    hosts = [];
    renderHosts();
    
    // Show success message
    showNotification('All hosts deleted successfully', 'success');
    
  } catch (error) {
    showNotification(`Failed to delete hosts: ${error}`, 'error');
  }
}
```

### Bulk Delete with Selection

```typescript
interface SelectableHost extends HostWithStatus {
  selected: boolean;
}

let selectableHosts: SelectableHost[] = [];

// Select/deselect individual host
function toggleHostSelection(hostname: string) {
  const host = selectableHosts.find(h => h.hostname === hostname);
  if (host) {
    host.selected = !host.selected;
    updateHostCard(hostname);
  }
}

// Select/deselect all hosts
function toggleSelectAll() {
  const allSelected = selectableHosts.every(h => h.selected);
  selectableHosts.forEach(h => h.selected = !allSelected);
  renderHosts();
}

// Delete selected hosts
async function deleteSelectedHosts() {
  const selectedHosts = selectableHosts.filter(h => h.selected);
  
  if (selectedHosts.length === 0) {
    await showCustomDialog({
      title: 'No Selection',
      message: 'No hosts selected',
      type: 'info'
    });
    return;
  }
  
  const confirmed = await showCustomDialog({
    title: 'Confirm Deletion',
    message: `Delete ${selectedHosts.length} selected host(s)?`,
    type: 'warning'
  });
  
  if (!confirmed) return;
  
  // Delete each selected host
  const deletePromises = selectedHosts.map(host => 
    invoke('delete_host', { hostname: host.hostname })
  );
  
  try {
    await Promise.all(deletePromises);
    
    // Remove deleted hosts from local state
    selectableHosts = selectableHosts.filter(h => !h.selected);
    renderHosts();
    
    showNotification(
      `Successfully deleted ${selectedHosts.length} host(s)`,
      'success'
    );
    
  } catch (error) {
    showNotification(`Failed to delete some hosts: ${error}`, 'error');
  }
}
```

---

## 22.7 Best Practices

### Status Checking Guidelines

**DO:**
- ✅ Use async/await for non-blocking checks
- ✅ Implement reasonable timeouts (2-3 seconds)
- ✅ Batch requests to avoid network flooding
- ✅ Cache results for frequently checked hosts
- ✅ Show intermediate "checking" state
- ✅ Provide visual feedback (colors, icons)

**DON'T:**
- ❌ Check all hosts simultaneously on large lists
- ❌ Use infinite timeouts
- ❌ Block UI thread during checks
- ❌ Check status too frequently (< 30 seconds)
- ❌ Ignore DNS resolution failures

### Security Considerations

**Reset Operations:**
- Always require double confirmation
- Use secret keyboard shortcuts (not exposed in UI)
- Log reset operations for audit trail
- Provide detailed report of what was deleted
- Don't allow reset during active connections

**Bulk Deletions:**
- Require explicit confirmation
- Show count of affected items
- Provide undo mechanism if possible
- Emit events to update all UI elements
- Handle partial failures gracefully

### Performance Tips

**Status Checks:**
```rust
// Adjust timeout based on expected network conditions
let timeout = if is_local_network(&hostname) {
    Duration::from_millis(500)  // Fast for LAN
} else {
    Duration::from_secs(3)      // Longer for WAN
};
```

**Batching:**
```typescript
// Process in reasonable batches
const BATCH_SIZE = 5;          // Don't overwhelm network
const BATCH_DELAY_MS = 100;    // Small delay between batches
```

**Caching:**
```typescript
const CACHE_DURATION = 30000;  // 30 seconds
const MAX_CACHE_SIZE = 100;    // Limit cache memory usage
```

---

## 22.8 Testing

### Unit Tests for Status Checking

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_check_online_host() {
        // Test against a known online host (localhost if RDP is running)
        let result = check_host_status("localhost".to_string()).await;
        assert!(result.is_ok());
        // Result depends on whether RDP is actually running locally
    }
    
    #[tokio::test]
    async fn test_check_invalid_hostname() {
        let result = check_host_status("invalid.hostname.that.does.not.exist".to_string()).await;
        assert_eq!(result.unwrap(), "unknown");
    }
    
    #[tokio::test]
    async fn test_check_unreachable_host() {
        // Use a non-routable IP address
        let result = check_host_status("192.0.2.1".to_string()).await;
        assert_eq!(result.unwrap(), "offline");
    }
}
```

### Integration Tests

```typescript
describe('Host Status Checking', () => {
  it('should check host status', async () => {
    const status = await invoke<string>('check_host_status', {
      hostname: 'localhost'
    });
    
    expect(['online', 'offline', 'unknown']).toContain(status);
  });
  
  it('should handle invalid hostnames', async () => {
    const status = await invoke<string>('check_host_status', {
      hostname: 'invalid..hostname'
    });
    
    expect(status).toBe('unknown');
  });
  
  it('should timeout appropriately', async () => {
    const start = Date.now();
    await invoke<string>('check_host_status', {
      hostname: '192.0.2.1'  // Non-routable IP
    });
    const duration = Date.now() - start;
    
    // Should complete within 3 seconds (2 second timeout + overhead)
    expect(duration).toBeLessThan(3000);
  });
});
```

---

## 22.9 Summary

This chapter covered essential host management features:

1. **Host Status Detection**
   - TCP-based connectivity checks
   - Asynchronous non-blocking implementation
   - Visual indicators in UI
   - Performance optimization strategies

2. **Application Reset**
   - Complete data deletion
   - Detailed operation reporting
   - Security confirmations
   - Keyboard shortcut integration

3. **Bulk Operations**
   - Delete all hosts
   - Selective deletion
   - Batch processing
   - Event-driven UI updates

These features enhance QuickConnect's usability by providing real-time feedback, efficient host management, and maintenance tools. The combination of smart status checking and bulk operations creates a professional, responsive user experience.

**Key Takeaways:**
- ✅ Status checking improves UX by showing real-time connectivity
- ✅ Async operations prevent UI blocking
- ✅ Batching and caching optimize performance
- ✅ Reset functionality provides safety net for users
- ✅ Bulk operations save time on large host lists

---

**Next Steps:**
In Chapter 23, we'll explore advanced deployment scenarios, including silent installers, auto-updates, and enterprise distribution methods.

**Total Pages:** 32

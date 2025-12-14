# Appendix C: Troubleshooting Guide

This appendix provides solutions to common problems encountered when developing and deploying Tauri applications on Windows.

---

## Table of Contents

- [C.1 Build Errors](#c1-build-errors)
- [C.2 Runtime Issues](#c2-runtime-issues)
- [C.3 Platform-Specific Problems](#c3-platform-specific-problems)
- [C.4 Performance Issues](#c4-performance-issues)
- [C.5 Deployment Problems](#c5-deployment-problems)
- [C.6 Debugging Techniques](#c6-debugging-techniques)

---

## C.1 Build Errors

### C.1.1 "linker link.exe not found"

**Error Message:**
```
error: linker `link.exe` not found
  |
  = note: program not found
```

**Cause:** Visual Studio Build Tools not installed or not in PATH.

**Solution:**

1. **Install Visual Studio Build Tools:**
```powershell
# Download from: https://visualstudio.microsoft.com/downloads/
# Select "Build Tools for Visual Studio 2022"
# During installation, select:
# - Desktop development with C++
# - Windows 10/11 SDK
```

2. **Verify Installation:**
```powershell
# Open "Developer PowerShell for VS 2022"
where link.exe
# Should show: C:\Program Files\Microsoft Visual Studio\...\link.exe
```

3. **If Installed but Not Found:**
```powershell
# Run build from Developer PowerShell
# OR add to PATH manually:
$env:PATH += ";C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.XX.XXXXX\bin\Hostx64\x64"
```

---

### C.1.2 "failed to run custom build command for `tauri-build`"

**Error Message:**
```
error: failed to run custom build command for `tauri-build v2.x.x`

Caused by:
  process didn't exit successfully
```

**Cause:** Node.js dependencies not installed or frontend build failed.

**Solution:**

1. **Install Node Dependencies:**
```powershell
npm install
```

2. **Check Node/npm Versions:**
```powershell
node --version  # Node 20+ recommended (18+ may work depending on tooling)
npm --version   # Should be 8.0.0 or higher
```

3. **Clear npm Cache:**
```powershell
npm cache clean --force
Remove-Item node_modules -Recurse -Force
npm install
```

4. **Test Frontend Build Separately:**
```powershell
npm run build
# If this fails, fix frontend issues before building Tauri
```

---

### C.1.3 "could not find `Cargo.toml`"

**Error Message:**
```
error: could not find `Cargo.toml` in `C:\path\to\project` or any parent directory
```

**Cause:** Running cargo commands from wrong directory.

**Solution:**
```powershell
# Navigate to src-tauri directory
cd src-tauri

# OR run from project root with proper cargo commands
cargo build --manifest-path src-tauri/Cargo.toml
```

---

### C.1.4 "unresolved import `windows::Win32`"

**Error Message:**
```
error[E0432]: unresolved import `windows::Win32`
  --> src\lib.rs:10:5
```

**Cause:** Missing Windows features in Cargo.toml.

**Solution:**

Add required features to `Cargo.toml`:
```toml
[dependencies]
windows = { version = "0.52", features = [
    "Win32_Foundation",
    "Win32_Security_Credentials",
    "Win32_UI_Shell",
    "Win32_System_Registry",
    # Add other required features
] }
```

**Finding Required Features:**
```rust
// If you see error like:
// error[E0433]: failed to resolve: could not find `Credentials` in `Security`

// The feature name is usually the path after Win32_
// In this case: Win32_Security_Credentials
```

---

### C.1.5 "LINK : fatal error LNK1181: cannot open input file 'libcrypto.lib'"

**Error Message:**
```
LINK : fatal error LNK1181: cannot open input file 'libcrypto.lib'
```

**Cause:** Missing OpenSSL or incorrect OpenSSL configuration.

**Solution:**

**Option 1: Use vendored OpenSSL (Recommended)**
```toml
[dependencies]
openssl = { version = "0.10", features = ["vendored"] }
```

**Option 2: Install OpenSSL**
```powershell
# Install via Chocolatey
choco install openssl

# Set environment variables
$env:OPENSSL_DIR = "C:\Program Files\OpenSSL-Win64"
```

---

### C.1.6 Frontend TypeScript Errors

**Error Message:**
```
ERROR in src/main.ts:5:23
TS2307: Cannot find module '@tauri-apps/api/core' or its corresponding type declarations.
```

**Cause:** Tauri API packages not installed.

**Solution:**
```powershell
npm install @tauri-apps/api
npm install @tauri-apps/plugin-shell  # If using shell plugin
npm install @tauri-apps/plugin-global-shortcut  # If using shortcuts
```

---

## C.2 Runtime Issues

### C.2.1 "Failed to load window: file:// protocol not allowed"

**Error Message:**
Console shows: `Failed to load URL: file:// protocol not allowed in production`

**Cause:** Incorrect window configuration in `tauri.conf.json`.

**Solution:**

**Development:**
```json
{
  "build": {
    "devUrl": "http://localhost:1420"
  }
}
```

**Production:**
```json
{
  "build": {
    "frontendDist": "../dist"
  }
}
```

**Verify Build Output:**
```powershell
# Check that dist folder exists and has content
ls dist/
# Should contain: index.html, assets/, etc.
```

---

### C.2.2 "TypeError: invoke is not a function"

**Error Message:**
Browser console: `Uncaught TypeError: invoke is not a function`

**Cause:** Not importing invoke correctly or Tauri API not loaded.

**Solution:**

**Correct Import:**
```typescript
// Tauri 2.x
import { invoke } from '@tauri-apps/api/core';

// NOT this (Tauri 1.x)
import { invoke } from '@tauri-apps/api/tauri';
```

**Check script type in HTML:**
```html
<!-- Must be module -->
<script type="module" src="/src/main.ts"></script>
```

**Verify Tauri is initialized:**
```typescript
import { invoke } from '@tauri-apps/api/core';

// Wait for Tauri to be ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const result = await invoke('some_command');
    } catch (error) {
        console.error('Invoke failed:', error);
    }
});
```

---

### C.2.3 Command Not Found Error

**Error Message:**
Console: `Command 'my_command' not found`

**Cause:** Command not registered or typo in command name.

**Solution:**

1. **Verify command is registered:**
```rust
// src-tauri/src/lib.rs (QuickConnect) or src-tauri/src/main.rs (some templates)
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        my_command,  // Make sure this matches function name exactly
    ])
```

2. **Check function signature:**
```rust
#[tauri::command]  // Don't forget this attribute!
fn my_command() -> Result<String, String> {
    Ok("Hello".to_string())
}
```

3. **Verify command name matches:**
```typescript
// Frontend - must match Rust function name exactly
await invoke('my_command');  // Not 'myCommand' or 'MyCommand'
```

---

### C.2.4 "Window 'main' not found"

**Error Message:**
```
Error: Window with label 'main' not found
```

**Cause:** Window label doesn't match configuration or window hasn't been created.

**Solution:**

1. **Check tauri.conf.json:**
```json
{
  "app": {
    "windows": [
      {
        "label": "main",  // This label must match
        // ...
      }
    ]
  }
}
```

2. **Access window correctly:**
```rust
#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Window 'main' not found".to_string())
    }
}
```

---

### C.2.5 CORS Errors

**Error Message:**
```
Access to fetch at 'http://api.example.com' from origin 'tauri://localhost' 
has been blocked by CORS policy
```

**Cause:** CORS restrictions when making HTTP requests.

**Solution:**

**Option 1: Use Backend for HTTP Requests (Recommended)**
```rust
use reqwest;

#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?;
    
    response.text()
        .await
        .map_err(|e| e.to_string())
}
```

**Option 2: Configure CSP (if you later enable it)**

QuickConnect currently **disables CSP** (this matches the current implementation):

```json
// src-tauri/tauri.conf.json
{
    "app": {
        "security": {
            "csp": null
        }
    }
}
```

If you add HTTP requests to your app in the future and decide to enable CSP, you'd configure it here (example):

```json
// src-tauri/tauri.conf.json (example if enabling CSP)
{
    "app": {
        "security": {
            "csp": "default-src 'self'; connect-src 'self' https://api.example.com"
        }
    }
}
```

---

### C.2.6 "Failed to execute command: access denied"

**Error Message:**
```
Failed to execute command: access denied (os error 5)
```

**Cause:** Insufficient permissions to access file, registry, or system resource.

**Solution:**

1. **Run as Administrator (temporary test):**
```powershell
# Right-click app.exe → Run as administrator
```

2. **Request elevation in manifest:**
```xml
<!-- src-tauri/src/app.manifest -->
<requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
```

3. **Check file permissions:**
```rust
use std::fs;

// Check if file is readable
match fs::metadata(&path) {
    Ok(metadata) => {
        if metadata.permissions().readonly() {
            return Err("File is read-only".to_string());
        }
    }
    Err(e) => {
        return Err(format!("Cannot access file: {}", e));
    }
}
```

4. **Use AppData instead of Program Files:**
```rust
// ✅ Good - user has write access
let appdata = std::env::var("APPDATA")?;
let config_path = PathBuf::from(appdata).join("MyApp").join("config.json");

// ❌ Bad - requires admin rights
let config_path = PathBuf::from("C:\\Program Files\\MyApp\\config.json");
```

---

## C.3 Platform-Specific Problems

### C.3.1 Windows Credential Manager Errors

**Error Message:**
```
Failed to save credentials: Os { code: 1312, kind: Uncategorized, 
message: "A specified logon session does not exist" }
```

**Cause:** Credential Manager access issue or invalid credential data.

**Solution:**

1. **Verify Credential Manager is accessible:**
```powershell
# Open Credential Manager
control /name Microsoft.CredentialManager
```

2. **Check credential format:**
```rust
// Ensure strings are properly null-terminated
let target_name: Vec<u16> = OsStr::new("MyApp")
    .encode_wide()
    .chain(std::iter::once(0))  // Add null terminator
    .collect();
```

3. **Use CRED_PERSIST_LOCAL_MACHINE:**
```rust
let cred = CREDENTIALW {
    Persist: CRED_PERSIST_LOCAL_MACHINE,  // Not ENTERPRISE or SESSION
    // ...
};
```

---

### C.3.2 RDP Launch Issues

**Error Message:**
```
Failed to open RDP file. Error code: 31
```

**Cause:** ShellExecuteW error codes 0-32 indicate failure.

**Common Error Codes:**
- `2` - File not found
- `3` - Path not found
- `5` - Access denied
- `8` - Out of memory
- `31` - No association for file type

**Solution:**

1. **Verify file exists:**
```rust
if !rdp_path.exists() {
    return Err(format!("RDP file not found: {:?}", rdp_path));
}
```

2. **Check file association:**
```powershell
# Verify .rdp files open with mstsc
assoc .rdp
# Should show: .rdp=RDP.File

ftype RDP.File
# Should show: RDP.File="C:\Windows\System32\mstsc.exe" "%1"
```

3. **Use explicit path to mstsc:**
```rust
unsafe {
    let operation = HSTRING::from("open");
    let file = HSTRING::from("C:\\Windows\\System32\\mstsc.exe");
    let params = HSTRING::from(format!("\"{}\"", rdp_path.to_string_lossy()));
    
    ShellExecuteW(
        None,
        &operation,
        &file,
        Some(&params),  // Pass RDP file as parameter
        None,
        SW_SHOWNORMAL,
    );
}
```

---

### C.3.3 LDAP Connection Failures

**Error Message:**
```
Failed to connect to LDAP server: Connection refused (os error 10061)
```

**Troubleshooting Steps:**

1. **Test basic connectivity:**
```powershell
Test-NetConnection -ComputerName dc.domain.com -Port 389
```

2. **Check DNS resolution:**
```powershell
nslookup dc.domain.com
```

3. **Verify LDAP service is running:**
```powershell
# On domain controller
Get-Service NTDS
```

4. **Test with ldp.exe (Windows LDAP client):**
```powershell
# Start → Run → ldp.exe
# Connection → Connect → Enter server name and port 389
```

5. **Check firewall:**
```powershell
# Test from client machine
Test-NetConnection -ComputerName dc.domain.com -Port 389

# On domain controller, ensure port 389 is open
New-NetFirewallRule -DisplayName "LDAP" -Direction Inbound -Protocol TCP -LocalPort 389 -Action Allow
```

---

### C.3.4 High DPI Display Issues

**Problem:** UI elements appear blurry or improperly scaled on 4K monitors.

**Solution:**

1. **Add manifest for DPI awareness:**
```xml
<!-- src-tauri/src/app.manifest -->
<application xmlns="urn:schemas-microsoft-com:asm.v3">
  <windowsSettings>
    <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true</dpiAware>
    <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
  </windowsSettings>
</application>
```

2. **Test on different DPI settings:**
```powershell
# Change display scaling
# Settings → System → Display → Scale
# Test at 100%, 125%, 150%, 200%
```

---

## C.4 Performance Issues

### C.4.1 Slow Application Startup

**Symptom:** Application takes 5+ seconds to launch.

**Solutions:**

1. **Profile startup time:**
```rust
use std::time::Instant;

pub fn run() {
    let start = Instant::now();
    
    // Setup code...
    
    println!("Setup took: {:?}", start.elapsed());
}
```

2. **Lazy load resources:**
```rust
// ❌ Bad - loads everything at startup
fn setup() {
    load_all_hosts();
    connect_to_database();
    initialize_ldap();
}

// ✅ Good - load on demand
fn setup() {
    // Minimal initialization
}

#[tauri::command]
async fn get_hosts() -> Result<Vec<Host>, String> {
    // Load only when needed
    load_hosts_from_csv()
}
```

3. **Optimize dependencies:**
```toml
# Use default features = false
[dependencies]
serde = { version = "1", default-features = false, features = ["derive"] }
```

---

### C.4.2 High Memory Usage

**Symptom:** Application uses 100MB+ of RAM.

**Solutions:**

1. **Profile memory usage:**
```rust
// Add to Cargo.toml
[profile.release]
debug = true  # Enable symbols for profiling

# Run with profiler
# cargo build --release
# Run app and profile with Windows Performance Analyzer
```

2. **Avoid caching large datasets:**
```rust
// ❌ Bad - keeps everything in memory
static HOSTS_CACHE: Mutex<Vec<Host>> = Mutex::new(Vec::new());

// ✅ Good - read from disk when needed
fn get_hosts() -> Result<Vec<Host>, String> {
    read_hosts_from_csv()  // Fresh data each time
}
```

3. **Use streaming for large files:**
```rust
use tokio::io::{AsyncBufReadExt, BufReader};

async fn process_large_file(path: &str) -> Result<(), String> {
    let file = tokio::fs::File::open(path).await?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();
    
    while let Some(line) = lines.next_line().await? {
        process_line(line);  // Process one line at a time
    }
    
    Ok(())
}
```

---

### C.4.3 UI Freezing/Stuttering

**Symptom:** UI becomes unresponsive during operations.

**Solutions:**

1. **Move heavy operations to async:**
```rust
// ❌ Bad - blocks UI
#[tauri::command]
fn heavy_operation() -> Result<String, String> {
    // Long-running synchronous work
    std::thread::sleep(Duration::from_secs(5));
    Ok("Done".to_string())
}

// ✅ Good - async
#[tauri::command]
async fn heavy_operation() -> Result<String, String> {
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    Ok("Done".to_string())
}
```

2. **Spawn blocking tasks:**
```rust
#[tauri::command]
async fn cpu_intensive() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        // CPU-intensive work that can't be async
        compute_something_expensive()
    })
    .await
    .map_err(|e| e.to_string())
}
```

3. **Send progress updates:**
```rust
#[tauri::command]
async fn long_operation(window: tauri::Window) -> Result<(), String> {
    for i in 0..100 {
        // Work...
        window.emit("progress", i).ok();
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    Ok(())
}
```

---

## C.5 Deployment Problems

### C.5.1 "Windows protected your PC" SmartScreen Warning

**Problem:** Users see SmartScreen warning when running unsigned app.

**Solutions:**

1. **Sign your application (Recommended):**
   - Purchase code signing certificate
   - Sign all executables and installers
   - See Chapter 21 for details

2. **Tell users how to bypass (temporary):**
   - Click "More info"
   - Click "Run anyway"

3. **Build reputation:**
   - Signed apps from known publishers get fewer warnings
   - Takes 3-6 months of downloads to build reputation

---

### C.5.2 Antivirus False Positives

**Problem:** Antivirus software flags application as malware.

**Solutions:**

1. **Submit to antivirus vendors:**
   - Windows Defender: https://www.microsoft.com/wdsi/filesubmission
   - VirusTotal: https://www.virustotal.com

2. **Sign your code:**
   - Signed applications are less likely to be flagged

3. **Use VirusTotal to check:**
```powershell
# Upload your .exe to https://www.virustotal.com
# Check which vendors flag it
# Submit false positive reports
```

---

### C.5.3 DLL Not Found Errors

**Error Message:**
```
The code execution cannot proceed because VCRUNTIME140.dll was not found
```

**Cause:** Visual C++ Runtime not installed on user's machine.

**Solution:**

**Option 1: Static linking (Recommended)**
```toml
# Cargo.toml
[profile.release]
target-feature = ["+crt-static"]
```

**Option 2: Include redistributable in installer**
```
Download Visual C++ Redistributable from Microsoft:
https://aka.ms/vs/17/release/vc_redist.x64.exe

Include in your installer
```

---

## C.6 Debugging Techniques

### C.6.1 Enable Tauri Development Console

```typescript
// Check if in development mode
import { window as tauriWindow } from '@tauri-apps/api';

if (import.meta.env.DEV) {
    // Development mode - console available
    console.log('Development mode');
}
```

**Access DevTools:**
- Development: Right-click → "Inspect Element"
- Production: Add debug build or enable devtools

---

### C.6.2 Rust Debugging with Logging

```rust
use log::{info, warn, error, debug};

// In Cargo.toml
[dependencies]
log = "0.4"
env_logger = "0.11"

// In main.rs
fn main() {
    env_logger::init();
    
    debug!("Starting application");
    info!("Configuration loaded");
    warn!("Low disk space");
    error!("Failed to connect");
    
    quickconnect_lib::run();
}
```

**Run with logging:**
```powershell
$env:RUST_LOG = "debug"
.\QuickConnect.exe
```

---

### C.6.3 Network Request Debugging

```typescript
// Intercept all invoke calls
const originalInvoke = window.__TAURI__.invoke;
window.__TAURI__.invoke = async function(cmd, args) {
    console.log(`[INVOKE] ${cmd}`, args);
    const start = performance.now();
    
    try {
        const result = await originalInvoke(cmd, args);
        console.log(`[INVOKE] ${cmd} completed in ${performance.now() - start}ms`, result);
        return result;
    } catch (error) {
        console.error(`[INVOKE] ${cmd} failed in ${performance.now() - start}ms`, error);
        throw error;
    }
};
```

---

### C.6.4 File System Debugging

```rust
// Debug file operations
fn debug_file_operation(operation: &str, path: &Path) {
    eprintln!("[FILE] {}: {:?}", operation, path);
    
    if let Ok(metadata) = std::fs::metadata(path) {
        eprintln!("  Size: {} bytes", metadata.len());
        eprintln!("  Modified: {:?}", metadata.modified());
        eprintln!("  Readonly: {}", metadata.permissions().readonly());
    }
}

// Usage
debug_file_operation("Reading", &hosts_path);
let contents = std::fs::read_to_string(&hosts_path)?;
```

---

## C.7 Quick Reference: Common Error Codes

### Windows Error Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 2 | File not found | Path is wrong or file doesn't exist |
| 3 | Path not found | Directory doesn't exist |
| 5 | Access denied | Insufficient permissions |
| 32 | Sharing violation | File is locked by another process |
| 87 | Invalid parameter | Bad parameter passed to API |
| 1312 | Logon session doesn't exist | Credential Manager issue |

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | Request successful |
| 401 | Unauthorized | Check credentials |
| 403 | Forbidden | Check permissions |
| 404 | Not found | Check URL/endpoint |
| 500 | Server error | Check server logs |
| 503 | Service unavailable | Server down or overloaded |

---

## C.8 Getting Help

### When Stack Overflow Doesn't Help

1. **Check Tauri Discord:**
   - https://discord.gg/tauri

2. **Search GitHub Issues:**
   - https://github.com/tauri-apps/tauri/issues

3. **Create Minimal Reproduction:**
```bash
# Create new project to isolate issue
npm create tauri-app
# Reproduce problem in minimal setup
```

4. **Include Relevant Information:**
   - OS version (Windows 10/11)
   - Tauri version
   - Node.js version
   - Rust version
   - Full error message
   - Steps to reproduce
   - What you've tried

---

## Conclusion

This troubleshooting guide covers the most common issues encountered in Tauri development. Remember:

- **Read error messages carefully** - They usually tell you exactly what's wrong
- **Google the exact error message** - Someone has likely encountered it before
- **Check your versions** - Ensure all tools are up to date
- **Test incrementally** - Add features one at a time
- **Use logging extensively** - Makes debugging much easier

When in doubt, create a minimal reproduction and ask for help in the Tauri community!

---

[← Appendix B](Appendix_B_Common_Patterns_and_Recipes.md) | [Appendix D: Resources →](Appendix_D_Resources_and_Further_Learning.md)

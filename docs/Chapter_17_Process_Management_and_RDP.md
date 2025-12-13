# Chapter 17: Process Management and RDP Launch

**Focus:** Launching external processes, creating dynamic RDP files, and managing Windows Remote Desktop connections

**What You'll Learn:**
- Creating temporary/persistent configuration files dynamically
- RDP file format specification and parameters
- Launching external applications with `ShellExecuteW`
- Windows process management and error handling
- Working with environment variables and file paths
- TERMSRV credential integration for SSO
- Connection file persistence patterns

---

## 17.1 Introduction to Process Management

One of the core features of QuickConnect is launching Remote Desktop Protocol (RDP) connections to remote servers. Unlike simply storing connection information, QuickConnect must:

1. **Create RDP files dynamically** based on host information
2. **Integrate with Windows Credential Manager** for Single Sign-On (SSO)
3. **Launch the external RDP client** (`mstsc.exe`)
4. **Manage connection file persistence** for reusability
5. **Handle various username formats** (domain\user, user@domain.com, or just username)

This chapter explores how to launch external processes from Rust/Tauri applications, with a focus on the real-world example of RDP connection management.

### Why Launch External Processes?

While Tauri applications can implement most functionality internally, sometimes you need to leverage existing system tools:

- **RDP Client (mstsc.exe):** Windows built-in Remote Desktop client
- **Web Browsers:** Opening URLs in the default browser
- **File Managers:** Opening folders in Windows Explorer
- **Command-Line Tools:** Running system utilities or scripts
- **Third-Party Applications:** Integrating with other installed software

### Process Launch Approaches

**1. Standard Library (`std::process::Command`):**
```rust
use std::process::Command;

// Simple approach - works for most cases
let output = Command::new("mstsc.exe")
    .arg("/v:server.example.com")
    .spawn()?;
```

**2. Windows API (`ShellExecuteW`):**
```rust
use windows::Win32::UI::Shell::ShellExecuteW;

// Opens files with their associated applications
// Like double-clicking in Windows Explorer
ShellExecuteW(None, &operation, &file, None, None, SW_SHOWNORMAL);
```

**Key Differences:**
- `std::process::Command`: Direct process execution, requires full executable path
- `ShellExecuteW`: Uses Windows file associations, opens documents naturally
- QuickConnect uses `ShellExecuteW` to "open" `.rdp` files, letting Windows handle the launch

---

## 17.2 The RDP File Format

Remote Desktop Protocol (RDP) uses `.rdp` configuration files to store connection settings. These are plain text files with a simple key-value format.

### Basic RDP File Structure

```
screen mode id:i:2
desktopwidth:i:1920
desktopheight:i:1080
full address:s:server.example.com
username:s:administrator
domain:s:DOMAIN
authentication level:i:2
prompt for credentials:i:0
```

### Format Specification

**Line Format:** `key:type:value`

**Data Types:**
- `i:` - Integer value
- `s:` - String value
- `b:` - Binary/hex value (rare)

**Line Endings:** Must use Windows CRLF (`\r\n`), not just LF (`\n`)

**Important:** RDP files are sensitive to formatting. Incorrect line endings or extra spaces can cause Windows RDP client to reject the file.

### Essential RDP Parameters

Let's break down the key parameters QuickConnect uses:

#### Display Settings
```
screen mode id:i:2           # 2=fullscreen, 1=windowed
desktopwidth:i:1920          # Width in pixels
desktopheight:i:1080         # Height in pixels
session bpp:i:32             # Bits per pixel (color depth)
```

#### Connection Settings
```
full address:s:server.example.com    # Target hostname or IP
username:s:john.doe                  # Username (without domain)
domain:s:CONTOSO                     # Domain name
```

#### Authentication & Security
```
authentication level:i:2              # 0=No auth, 2=Server auth required
prompt for credentials:i:0            # 0=Don't prompt, 1=Prompt
enablecredsspsupport:i:1             # Enable CredSSP (SSO)
cert ignore:i:1                       # 1=Ignore cert warnings
```

#### Performance Settings
```
compression:i:1                       # Enable compression
networkautodetect:i:1                # Auto-detect bandwidth
bandwidthautodetect:i:1              # Auto bandwidth detection
connection type:i:2                   # 2=Broadband
disable wallpaper:i:0                # 1=Disable wallpaper
disable full window drag:i:1          # 1=Disable window dragging
disable menu anims:i:1                # 1=Disable menu animations
bitmapcachepersistenable:i:1         # Persistent bitmap caching
```

#### Resource Redirection
```
redirectprinters:i:1                 # Redirect printers
redirectclipboard:i:1                # Redirect clipboard
redirectsmartcards:i:1               # Redirect smart cards
redirectcomports:i:0                 # Don't redirect COM ports
```

### Creating RDP Files from Rust

Here's how QuickConnect builds the RDP file content:

```rust
fn create_rdp_content(hostname: &str, username: &str, domain: &str) -> String {
    format!(
        "screen mode id:i:2\r\n\
desktopwidth:i:1920\r\n\
desktopheight:i:1080\r\n\
session bpp:i:32\r\n\
full address:s:{}\r\n\
compression:i:1\r\n\
keyboardhook:i:2\r\n\
audiocapturemode:i:1\r\n\
videoplaybackmode:i:1\r\n\
connection type:i:2\r\n\
networkautodetect:i:1\r\n\
bandwidthautodetect:i:1\r\n\
enableworkspacereconnect:i:1\r\n\
disable wallpaper:i:0\r\n\
allow desktop composition:i:0\r\n\
allow font smoothing:i:0\r\n\
disable full window drag:i:1\r\n\
disable menu anims:i:1\r\n\
disable themes:i:0\r\n\
disable cursor setting:i:0\r\n\
bitmapcachepersistenable:i:1\r\n\
audiomode:i:0\r\n\
redirectprinters:i:1\r\n\
redirectcomports:i:0\r\n\
redirectsmartcards:i:1\r\n\
redirectclipboard:i:1\r\n\
redirectposdevices:i:0\r\n\
autoreconnection enabled:i:1\r\n\
authentication level:i:2\r\n\
prompt for credentials:i:0\r\n\
negotiate security layer:i:1\r\n\
remoteapplicationmode:i:0\r\n\
alternate shell:s:\r\n\
shell working directory:s:\r\n\
gatewayhostname:s:\r\n\
gatewayusagemethod:i:4\r\n\
gatewaycredentialssource:i:4\r\n\
gatewayprofileusagemethod:i:0\r\n\
promptcredentialonce:i:1\r\n\
use redirection server name:i:0\r\n\
rdgiskdcproxy:i:0\r\n\
kdcproxyname:s:\r\n\
username:s:{}\r\n\
domain:s:{}\r\n\
enablecredsspsupport:i:1\r\n\
public mode:i:0\r\n\
cert ignore:i:1\r\n",
        hostname, username, domain
    )
}
```

**Key Points:**
1. **`\r\n` line endings** are critical for Windows compatibility
2. **No leading spaces** - format! macro output must start directly with the content
3. **Empty values** (like `alternate shell:s:`) are allowed and expected
4. **Order doesn't strictly matter**, but grouping logically helps maintainability

---

## 17.3 Managing File Paths and AppData

Windows applications should store user data in standard locations, not the application directory. This ensures proper permissions and roaming support.

### Windows Special Folders

**AppData\Roaming** (`%APPDATA%`):
- User-specific data that roams with the user profile
- Backed up with user profiles
- Appropriate for configuration and connection files

**AppData\Local** (`%LOCALAPPDATA%`):
- User-specific data that stays on the machine
- Not roamed between computers
- Appropriate for caches and temporary data

**ProgramData** (`%PROGRAMDATA%`):
- Machine-wide data (all users)
- Requires admin rights to write
- Appropriate for shared configurations

### Getting AppData Path in Rust

```rust
use std::path::PathBuf;

fn get_appdata_path() -> Result<PathBuf, String> {
    std::env::var("APPDATA")
        .map(PathBuf::from)
        .map_err(|_| "Failed to get APPDATA directory".to_string())
}
```

### Creating Application Directories

QuickConnect creates a structured directory for connection files:

```rust
fn get_connections_directory() -> Result<PathBuf, String> {
    let appdata_dir = std::env::var("APPDATA")
        .map_err(|_| "Failed to get APPDATA directory".to_string())?;
    
    let connections_dir = PathBuf::from(&appdata_dir)
        .join("QuickConnect")
        .join("Connections");
    
    // Create directory if it doesn't exist
    std::fs::create_dir_all(&connections_dir)
        .map_err(|e| format!("Failed to create connections directory: {}", e))?;
    
    Ok(connections_dir)
}
```

**Result:** `C:\Users\YourName\AppData\Roaming\QuickConnect\Connections\`

### Why Use AppData?

1. **Proper Permissions:** Users always have write access to their AppData
2. **No Admin Required:** Application directory may be read-only
3. **Profile Roaming:** Files follow the user across machines (if roaming profiles are used)
4. **Clean Uninstall:** Application directory can be deleted without losing user data
5. **Windows Standards:** Expected location for user configuration

---

## 17.4 Username Format Parsing

RDP credentials can be provided in several formats. QuickConnect must parse and extract the components correctly.

### Supported Username Formats

1. **Domain\Username** (UPN format): `CONTOSO\john.doe`
2. **Username@Domain** (Email format): `john.doe@contoso.com`
3. **Username Only** (No domain): `john.doe`

### Parsing Implementation

```rust
fn parse_username(full_username: &str) -> (String, String) {
    if full_username.contains('\\') {
        // Format: DOMAIN\username
        let parts: Vec<&str> = full_username.splitn(2, '\\').collect();
        if parts.len() == 2 {
            (parts[0].to_string(), parts[1].to_string())
        } else {
            (String::new(), full_username.to_string())
        }
    } else if full_username.contains('@') {
        // Format: username@domain.com
        let parts: Vec<&str> = full_username.splitn(2, '@').collect();
        if parts.len() == 2 {
            (parts[1].to_string(), parts[0].to_string())
        } else {
            (String::new(), full_username.to_string())
        }
    } else {
        // Format: just username (no domain)
        (String::new(), full_username.to_string())
    }
}
```

**Usage:**
```rust
let full_username = "CONTOSO\\john.doe";
let (domain, username) = parse_username(full_username);
// domain = "CONTOSO"
// username = "john.doe"

let full_username2 = "jane.smith@example.com";
let (domain2, username2) = parse_username(full_username2);
// domain2 = "example.com"
// username2 = "jane.smith"
```

### Why Parse Before Storing?

The RDP file format requires **separate fields** for username and domain:
```
username:s:john.doe
domain:s:CONTOSO
```

But Windows Credential Manager stores them in **TERMSRV format** as a single string:
```
Target: TERMSRV/server.example.com
Username: CONTOSO\john.doe
```

QuickConnect must:
1. Parse the combined format from credentials
2. Store to TERMSRV with the full format for SSO
3. Split into separate fields for the RDP file

---

## 17.5 Integrating TERMSRV Credentials

Chapter 13 covered Windows Credential Manager. Here we see how it integrates with RDP launching.

### TERMSRV Naming Convention

Windows Remote Desktop uses a special credential target name format:
```
TERMSRV/{hostname}
```

**Example:**
```
TERMSRV/server01.contoso.com
TERMSRV/192.168.1.100
TERMSRV/fileserver
```

When `mstsc.exe` (RDP client) connects to a server, it automatically looks for credentials at `TERMSRV/{hostname}`. This enables **Single Sign-On (SSO)** - no credential prompt appears.

### Saving Credentials for RDP SSO

QuickConnect stores credentials in two places:

1. **Global Credentials** (`QuickConnect`): Used for LDAP and as fallback
2. **Per-Host Credentials** (`TERMSRV/{hostname}`): Used by RDP client

```rust
async fn save_rdp_credentials(
    hostname: &str,
    username: &str,
    password: &str
) -> Result<(), String> {
    unsafe {
        // Convert password to UTF-16 (Windows native format)
        let password_wide: Vec<u16> = OsStr::new(password)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Build TERMSRV target name
        let target_name: Vec<u16> = OsStr::new(&format!("TERMSRV/{}", hostname))
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Username in TERMSRV should be full format (DOMAIN\username)
        let username_wide: Vec<u16> = OsStr::new(username)
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

        CredWriteW(&cred, 0)
            .map_err(|e| format!("Failed to save RDP credentials: {:?}", e))?;
    }
    
    Ok(())
}
```

### Credential Priority in QuickConnect

When launching an RDP connection, QuickConnect follows this priority:

1. **Check for per-host credentials** (`TERMSRV/{hostname}`)
   - If found, use them (already in TERMSRV, no action needed)
2. **If not found, check global credentials** (`QuickConnect`)
   - If found, copy them to `TERMSRV/{hostname}` for SSO
3. **If neither found, return error**
   - User must save credentials first

```rust
async fn get_credentials_for_rdp(hostname: &str) -> Result<StoredCredentials, String> {
    // First try per-host credentials
    if let Some(creds) = get_host_credentials(hostname).await? {
        return Ok(creds);
    }
    
    // Fallback to global credentials
    if let Some(creds) = get_stored_credentials().await? {
        // Copy to TERMSRV for this host
        save_rdp_credentials(hostname, &creds.username, &creds.password).await?;
        return Ok(creds);
    }
    
    Err("No credentials found".to_string())
}
```

---

## 17.6 QuickConnect RDP Launch Flow

Now let's examine the complete RDP launch process from QuickConnect's `launch_rdp` command.

### Complete Launch Flow

```rust
#[tauri::command]
async fn launch_rdp(host: Host) -> Result<(), String> {
    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!("Starting RDP launch for host: {}", host.hostname),
        None,
    );

    // STEP 1: Get credentials (per-host or global)
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
                "No per-host credentials, using global credentials",
                None,
            );
            match get_stored_credentials().await? {
                Some(creds) => creds,
                None => {
                    return Err(
                        "No credentials found. Please save credentials first.".to_string()
                    );
                }
            }
        }
    };

    // STEP 2: Parse username to extract domain and username
    let (domain, username) = if credentials.username.contains('\\') {
        let parts: Vec<&str> = credentials.username.splitn(2, '\\').collect();
        if parts.len() == 2 {
            (parts[0].to_string(), parts[1].to_string())
        } else {
            (String::new(), credentials.username.clone())
        }
    } else if credentials.username.contains('@') {
        let parts: Vec<&str> = credentials.username.splitn(2, '@').collect();
        if parts.len() == 2 {
            (parts[1].to_string(), parts[0].to_string())
        } else {
            (String::new(), credentials.username.clone())
        }
    } else {
        (String::new(), credentials.username.clone())
    };

    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!("Parsed credentials - Domain: '{}', Username: '{}'", domain, username),
        None,
    );

    // STEP 3: If using global credentials, save to TERMSRV for SSO
    if get_host_credentials(host.hostname.clone()).await?.is_none() {
        debug_log(
            "INFO",
            "RDP_LAUNCH",
            &format!("Saving global credentials to TERMSRV/{}", host.hostname),
            None,
        );

        unsafe {
            let password_wide: Vec<u16> = OsStr::new(&credentials.password)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let target_name: Vec<u16> = OsStr::new(&format!("TERMSRV/{}", host.hostname))
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            // Use FULL username including domain for TERMSRV
            let termsrv_username = if !domain.is_empty() {
                format!("{}\\{}", domain, username)
            } else {
                username.clone()
            };

            let username_wide: Vec<u16> = OsStr::new(&termsrv_username)
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

            CredWriteW(&cred, 0)
                .map_err(|e| format!("Failed to save RDP credentials: {:?}", e))?;
        }
    }

    // STEP 4: Create connections directory in AppData
    let appdata_dir = std::env::var("APPDATA")
        .map_err(|_| "Failed to get APPDATA directory".to_string())?;
    let connections_dir = PathBuf::from(&appdata_dir)
        .join("QuickConnect")
        .join("Connections");

    std::fs::create_dir_all(&connections_dir)
        .map_err(|e| format!("Failed to create connections directory: {}", e))?;

    // STEP 5: Create RDP file
    let rdp_filename = format!("{}.rdp", host.hostname);
    let rdp_path = connections_dir.join(&rdp_filename);

    let rdp_content = format!(
        "screen mode id:i:2\r\n\
desktopwidth:i:1920\r\n\
desktopheight:i:1080\r\n\
session bpp:i:32\r\n\
full address:s:{}\r\n\
compression:i:1\r\n\
keyboardhook:i:2\r\n\
audiocapturemode:i:1\r\n\
videoplaybackmode:i:1\r\n\
connection type:i:2\r\n\
networkautodetect:i:1\r\n\
bandwidthautodetect:i:1\r\n\
enableworkspacereconnect:i:1\r\n\
disable wallpaper:i:0\r\n\
allow desktop composition:i:0\r\n\
allow font smoothing:i:0\r\n\
disable full window drag:i:1\r\n\
disable menu anims:i:1\r\n\
disable themes:i:0\r\n\
disable cursor setting:i:0\r\n\
bitmapcachepersistenable:i:1\r\n\
audiomode:i:0\r\n\
redirectprinters:i:1\r\n\
redirectcomports:i:0\r\n\
redirectsmartcards:i:1\r\n\
redirectclipboard:i:1\r\n\
redirectposdevices:i:0\r\n\
autoreconnection enabled:i:1\r\n\
authentication level:i:2\r\n\
prompt for credentials:i:0\r\n\
negotiate security layer:i:1\r\n\
remoteapplicationmode:i:0\r\n\
alternate shell:s:\r\n\
shell working directory:s:\r\n\
gatewayhostname:s:\r\n\
gatewayusagemethod:i:4\r\n\
gatewaycredentialssource:i:4\r\n\
gatewayprofileusagemethod:i:0\r\n\
promptcredentialonce:i:1\r\n\
use redirection server name:i:0\r\n\
rdgiskdcproxy:i:0\r\n\
kdcproxyname:s:\r\n\
username:s:{}\r\n\
domain:s:{}\r\n\
enablecredsspsupport:i:1\r\n\
public mode:i:0\r\n\
cert ignore:i:1\r\n",
        host.hostname, username, domain
    );

    std::fs::write(&rdp_path, rdp_content.as_bytes())
        .map_err(|e| format!("Failed to write RDP file: {}", e))?;

    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!("RDP file written successfully to {:?}", rdp_path),
        None,
    );

    // STEP 6: Launch RDP file using ShellExecuteW
    unsafe {
        let operation = HSTRING::from("open");
        let file = HSTRING::from(rdp_path.to_string_lossy().as_ref());

        let result = ShellExecuteW(
            None,          // hwnd
            &operation,    // lpOperation
            &file,         // lpFile
            None,          // lpParameters
            None,          // lpDirectory
            SW_SHOWNORMAL, // nShowCmd
        );

        if result.0 as i32 <= 32 {
            return Err(format!("Failed to open RDP file. Error code: {}", result.0));
        }
    }

    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!("Successfully launched RDP connection to {}", host.hostname),
        None,
    );

    // STEP 7: Update recent connections and timestamp
    if let Ok(mut recent) = load_recent_connections() {
        recent.add_connection(host.hostname.clone(), host.description.clone());
        let _ = save_recent_connections(&recent);
    }

    if let Err(e) = update_last_connected(&host.hostname) {
        debug_log(
            "WARN",
            "RDP_LAUNCH",
            &format!("Failed to update timestamp: {}", e),
            None,
        );
    }

    Ok(())
}
```

### Flow Visualization

```
User clicks "Connect" button
         ↓
[launch_rdp command invoked]
         ↓
Check for per-host credentials (TERMSRV/{hostname})
         ↓
    ┌────┴────┐
    │ Found?  │
    └────┬────┘
         │
    Yes  │  No
    ↓    │   ↓
  Use    │   Check global credentials (QuickConnect)
  them   │        ↓
         │   ┌────┴────┐
         │   │ Found?  │
         │   └────┬────┘
         │        │
         │   Yes  │  No
         │   ↓    │   ↓
         │  Copy  │  Return
         │  to    │  error
         │  TERMSRV
         │   ↓
         └───┴─── Parse username (domain\user or user@domain.com)
                ↓
         Create AppData\Roaming\QuickConnect\Connections directory
                ↓
         Generate RDP file content with parsed credentials
                ↓
         Write {hostname}.rdp file
                ↓
         Launch RDP file with ShellExecuteW
                ↓
         Windows opens mstsc.exe with the RDP file
                ↓
         mstsc.exe reads TERMSRV/{hostname} credentials
                ↓
         Connection established without credential prompt
                ↓
         Update recent connections and last connected timestamp
```

---

## 17.7 Launching with ShellExecuteW

The Windows `ShellExecuteW` API provides a high-level way to "open" files, similar to double-clicking them in Windows Explorer.

### Why ShellExecuteW Over std::process::Command?

**ShellExecuteW Advantages:**
1. **Respects file associations:** `.rdp` files automatically open with `mstsc.exe`
2. **Handles paths naturally:** No need to find `mstsc.exe` location
3. **Supports verbs:** Can "open", "edit", "print", etc.
4. **Works with URLs:** Opens http:// links in default browser
5. **Windows-native behavior:** Exactly like Explorer double-click

**Example Comparison:**

```rust
// Using std::process::Command - must know mstsc.exe location
let output = Command::new("C:\\Windows\\System32\\mstsc.exe")
    .arg("/edit")
    .arg(&rdp_path)
    .spawn()?;

// Using ShellExecuteW - Windows handles everything
let result = ShellExecuteW(
    None,
    &HSTRING::from("open"),
    &HSTRING::from(&rdp_path),
    None,
    None,
    SW_SHOWNORMAL,
);
```

### ShellExecuteW Parameters

```rust
use windows::core::HSTRING;
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

unsafe {
    let operation = HSTRING::from("open");  // Verb: "open", "edit", "print", etc.
    let file = HSTRING::from("C:\\Users\\John\\AppData\\Roaming\\QuickConnect\\Connections\\server01.rdp");
    
    let result = ShellExecuteW(
        None,          // Parent window handle (None = no parent)
        &operation,    // Operation verb
        &file,         // File to open
        None,          // Command-line parameters (None for RDP)
        None,          // Working directory (None = use default)
        SW_SHOWNORMAL, // Show window normally
    );
    
    // Check result
    if result.0 as i32 <= 32 {
        // Error occurred
        println!("ShellExecuteW failed with code: {}", result.0);
    }
}
```

### Return Value Handling

`ShellExecuteW` returns an `HINSTANCE` handle. The value indicates success or error:

- **> 32:** Success (handle to launched application instance)
- **≤ 32:** Error code

**Common Error Codes:**
- `0` - Out of memory or resources
- `2` - File not found
- `3` - Path not found
- `5` - Access denied
- `8` - Out of memory
- `26` - Sharing violation
- `27` - File association incomplete/invalid
- `28` - DDE timeout
- `29` - DDE failed
- `30` - DDE busy
- `31` - No file association

```rust
unsafe {
    let result = ShellExecuteW(
        None,
        &operation,
        &file,
        None,
        None,
        SW_SHOWNORMAL,
    );
    
    let code = result.0 as i32;
    
    if code <= 32 {
        let error_message = match code {
            0 | 8 => "Out of memory",
            2 => "File not found",
            3 => "Path not found",
            5 => "Access denied",
            27 => "File association incomplete or invalid",
            31 => "No file association found",
            _ => "Unknown error",
        };
        
        return Err(format!(
            "Failed to launch RDP: {} (code: {})",
            error_message, code
        ));
    }
}
```

### Alternative: Using std::process::Command

For completeness, here's how you would launch RDP with `std::process::Command`:

```rust
use std::process::Command;

fn launch_rdp_with_command(rdp_file_path: &str) -> Result<(), String> {
    // Find mstsc.exe in System32
    let system_root = std::env::var("SystemRoot")
        .unwrap_or_else(|_| "C:\\Windows".to_string());
    let mstsc_path = format!("{}\\System32\\mstsc.exe", system_root);
    
    // Launch with /edit flag to use the RDP file
    let result = Command::new(&mstsc_path)
        .arg(rdp_file_path)
        .spawn();
    
    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to launch mstsc.exe: {}", e)),
    }
}
```

**QuickConnect uses ShellExecuteW** because it's simpler and more Windows-native.

---

## 17.8 Connection File Persistence

QuickConnect stores RDP files persistently in `AppData\Roaming\QuickConnect\Connections\`. This provides several benefits:

### Benefits of Persistent Files

1. **Reusability:** Files can be opened directly from Explorer
2. **Manual Editing:** Users can customize RDP settings
3. **Backup Friendly:** Easy to backup/restore connections
4. **Portable:** Files can be copied to other machines
5. **Transparent:** Users can see exactly what settings are used

### Alternative: Temporary Files

Many applications create temporary RDP files and delete them after use:

```rust
use std::env;

fn create_temp_rdp(hostname: &str) -> Result<PathBuf, String> {
    let temp_dir = env::temp_dir();
    let rdp_path = temp_dir.join(format!("QuickConnect_{}.rdp", hostname));
    
    // Write RDP content
    std::fs::write(&rdp_path, rdp_content)?;
    
    // Launch
    launch_rdp_file(&rdp_path)?;
    
    // Delete after launch
    std::fs::remove_file(&rdp_path)?;
    
    Ok(rdp_path)
}
```

**Pros of Temporary Files:**
- No disk clutter
- Automatically cleaned up
- More secure (credentials not in long-term files)

**Cons of Temporary Files:**
- Can't be reused
- Can't be edited by users
- Lost if application crashes before cleanup

**QuickConnect's Approach:**
- Uses persistent files for convenience
- Relies on TERMSRV for credential storage (not in RDP file)
- Users can manually launch RDP files from Explorer

### File Naming Strategy

QuickConnect uses the hostname as the filename:

```rust
let rdp_filename = format!("{}.rdp", host.hostname);
// Examples:
// server01.contoso.com.rdp
// 192.168.1.100.rdp
// FILESERVER.rdp
```

**Considerations:**
- **Invalid characters:** Hostnames are generally safe, but IP addresses and FQDNs work fine
- **Overwriting:** Same hostname = same file (updates connection settings)
- **Uniqueness:** Each host gets its own file

### Security Considerations

**Credentials are NOT stored in RDP files.** QuickConnect sets:
```
username:s:john.doe
domain:s:CONTOSO
prompt for credentials:i:0
```

But no password. The password is stored securely in Windows Credential Manager at `TERMSRV/{hostname}`.

**Why this is secure:**
1. RDP files can be shared without exposing passwords
2. Credential Manager encrypts passwords
3. Only works on the machine where credentials were saved
4. Follows Windows security model

---

## 17.9 Debugging Process Launch Issues

Process launching can fail for various reasons. Here are common issues and debugging techniques.

### Common Issues

**1. File Not Found**
```rust
// Error: RDP file path doesn't exist
// Check if file was actually created
if !rdp_path.exists() {
    return Err("RDP file was not created".to_string());
}
```

**2. Permission Denied**
```rust
// Error: Can't write to directory
// Verify AppData path is accessible
let appdata = std::env::var("APPDATA")?;
let test_file = PathBuf::from(appdata).join("test.txt");
std::fs::write(&test_file, "test")?;
std::fs::remove_file(&test_file)?;
```

**3. Invalid RDP File**
```rust
// Error: RDP client rejects file
// Check line endings (must be \r\n)
let rdp_content = "full address:s:server\r\n";  // ✓ Correct
let rdp_content = "full address:s:server\n";   // ✗ Wrong
```

**4. mstsc.exe Not Found**
```rust
// ShellExecuteW error 31: No file association
// Verify .rdp files are associated with mstsc.exe
// Check registry: HKEY_CLASSES_ROOT\.rdp
```

### Debugging Techniques

**Add Debug Logging:**
```rust
debug_log("INFO", "RDP_LAUNCH", 
    &format!("RDP file path: {:?}", rdp_path), None);
debug_log("INFO", "RDP_LAUNCH",
    &format!("File exists: {}", rdp_path.exists()), None);
debug_log("INFO", "RDP_LAUNCH",
    &format!("File size: {} bytes", 
        std::fs::metadata(&rdp_path)?.len()), None);
```

**Validate File Content:**
```rust
// Read back the file to verify it was written correctly
let written_content = std::fs::read_to_string(&rdp_path)?;
debug_log("INFO", "RDP_LAUNCH",
    &format!("RDP content:\n{}", written_content), None);

// Check for correct line endings
if !written_content.contains("\r\n") {
    return Err("RDP file has incorrect line endings".to_string());
}
```

**Test Manual Launch:**
```rust
// After creating the file, wait and let user manually double-click it
println!("RDP file created at: {:?}", rdp_path);
println!("Press Enter to launch...");
std::io::stdin().read_line(&mut String::new())?;
// Then try ShellExecuteW
```

---

## 17.10 Key Takeaways

**Process Management:**
1. Use `ShellExecuteW` for Windows-native file opening behavior
2. Check return values carefully (≤ 32 = error)
3. Use appropriate show window flags (`SW_SHOWNORMAL`, `SW_HIDE`, etc.)

**RDP File Format:**
1. Must use Windows CRLF (`\r\n`) line endings
2. Format: `key:type:value` where type is `i:` (int) or `s:` (string)
3. No password in RDP file - use TERMSRV credentials for SSO

**Credential Integration:**
1. Parse username formats (domain\user, user@domain.com, user)
2. Store full format to TERMSRV (`TERMSRV/{hostname}`)
3. Split domain and username for RDP file fields

**File Persistence:**
1. Use `AppData\Roaming` for user-specific data
2. Create structured directories (`QuickConnect\Connections`)
3. Name files meaningfully (hostname.rdp)
4. Handle directory creation errors gracefully

**Security:**
1. Never store passwords in configuration files
2. Use Windows Credential Manager for password storage
3. Follow TERMSRV naming for RDP SSO
4. Encrypt sensitive data at rest

---

## 17.11 Practice Exercises

### Exercise 1: Create a Generic File Launcher

Create a Tauri command that can launch any file with its associated application:

```rust
#[tauri::command]
fn open_file(file_path: String) -> Result<(), String> {
    // TODO: Implement using ShellExecuteW
    // Should work with:
    // - .txt files (open in Notepad)
    // - .pdf files (open in default PDF viewer)
    // - .xlsx files (open in Excel)
    // - URLs (open in browser)
    todo!()
}
```

**Requirements:**
- Use `ShellExecuteW` with "open" verb
- Handle errors and return appropriate messages
- Test with different file types

<details>
<summary>Solution</summary>

```rust
use windows::core::HSTRING;
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

#[tauri::command]
fn open_file(file_path: String) -> Result<(), String> {
    unsafe {
        let operation = HSTRING::from("open");
        let file = HSTRING::from(&file_path);
        
        let result = ShellExecuteW(
            None,
            &operation,
            &file,
            None,
            None,
            SW_SHOWNORMAL,
        );
        
        let code = result.0 as i32;
        
        if code <= 32 {
            let error_message = match code {
                0 | 8 => "Out of memory",
                2 => "File not found",
                3 => "Path not found",
                5 => "Access denied",
                27 => "File association incomplete or invalid",
                31 => "No file association found",
                _ => "Unknown error",
            };
            
            return Err(format!(
                "Failed to open file: {} (code: {})",
                error_message, code
            ));
        }
    }
    
    Ok(())
}
```
</details>

### Exercise 2: Enhanced RDP File Generator

Create a function that generates RDP files with customizable settings:

```rust
struct RdpSettings {
    hostname: String,
    username: String,
    domain: String,
    screen_mode: RdpScreenMode,  // Fullscreen or Windowed
    resolution: RdpResolution,    // Resolution settings
    redirect_printers: bool,
    redirect_clipboard: bool,
}

enum RdpScreenMode {
    Windowed,
    Fullscreen,
}

struct RdpResolution {
    width: u32,
    height: u32,
}

fn create_rdp_file(settings: RdpSettings, output_path: &Path) -> Result<(), String> {
    // TODO: Generate RDP file with custom settings
    todo!()
}
```

**Requirements:**
- Support both windowed and fullscreen modes
- Allow custom resolutions
- Toggle printer/clipboard redirection
- Proper CRLF line endings

<details>
<summary>Solution</summary>

```rust
fn create_rdp_file(settings: RdpSettings, output_path: &Path) -> Result<(), String> {
    let screen_mode_id = match settings.screen_mode {
        RdpScreenMode::Windowed => 1,
        RdpScreenMode::Fullscreen => 2,
    };
    
    let rdp_content = format!(
        "screen mode id:i:{}\r\n\
desktopwidth:i:{}\r\n\
desktopheight:i:{}\r\n\
session bpp:i:32\r\n\
full address:s:{}\r\n\
username:s:{}\r\n\
domain:s:{}\r\n\
redirectprinters:i:{}\r\n\
redirectclipboard:i:{}\r\n\
authentication level:i:2\r\n\
prompt for credentials:i:0\r\n\
enablecredsspsupport:i:1\r\n",
        screen_mode_id,
        settings.resolution.width,
        settings.resolution.height,
        settings.hostname,
        settings.username,
        settings.domain,
        if settings.redirect_printers { 1 } else { 0 },
        if settings.redirect_clipboard { 1 } else { 0 },
    );
    
    std::fs::write(output_path, rdp_content.as_bytes())
        .map_err(|e| format!("Failed to write RDP file: {}", e))?;
    
    Ok(())
}
```
</details>

### Exercise 3: Process Launch with Timeout

Create a command that launches a process and waits for it to complete, with a timeout:

```rust
#[tauri::command]
async fn launch_and_wait(
    file_path: String,
    timeout_seconds: u64
) -> Result<String, String> {
    // TODO: Launch process and wait up to timeout_seconds
    // Return "Completed" if process exits before timeout
    // Return "Timeout" if timeout is reached
    todo!()
}
```

**Hint:** Use `tokio::time::timeout` for async timeout handling.

<details>
<summary>Solution</summary>

```rust
use tokio::time::{timeout, Duration};
use std::process::Command;

#[tauri::command]
async fn launch_and_wait(
    file_path: String,
    timeout_seconds: u64
) -> Result<String, String> {
    let duration = Duration::from_secs(timeout_seconds);
    
    let result = timeout(duration, async {
        Command::new(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to spawn process: {}", e))?
            .wait()
            .map_err(|e| format!("Failed to wait for process: {}", e))
    }).await;
    
    match result {
        Ok(Ok(_exit_status)) => Ok("Completed".to_string()),
        Ok(Err(e)) => Err(format!("Process error: {}", e)),
        Err(_) => Ok("Timeout".to_string()),
    }
}
```
</details>

---

## 17.12 Further Reading

**Official Documentation:**
- [ShellExecuteW Documentation](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shellexecutew)
- [RDP File Format Reference](https://learn.microsoft.com/en-us/windows-server/remote/remote-desktop-services/clients/rdp-files)
- [Windows Credential Manager API](https://learn.microsoft.com/en-us/windows/win32/api/wincred/)
- [Rust std::process Documentation](https://doc.rust-lang.org/std/process/)

**Related Topics:**
- Chapter 11: Windows API Integration
- Chapter 13: Windows Credential Manager
- Chapter 14: Advanced Error Handling and Logging

**Community Resources:**
- [windows-rs GitHub Repository](https://github.com/microsoft/windows-rs)
- [Tauri Process Plugin](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/shell)

---

**Next Chapter:** [Chapter 18: Configuration and Settings](Chapter_18_Configuration_and_Settings.md) - Managing application preferences, registry settings, and persistent configuration.

---

*Chapter 17 complete! You now understand how to launch external processes, create dynamic configuration files, and integrate with Windows system features like RDP and Credential Manager.*

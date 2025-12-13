# Chapter 13: Windows Credential Manager Integration

## Introduction

One of the most critical aspects of any application that handles authentication is **secure credential storage**. Storing passwords in plain text files, environment variables, or application memory is a security nightmare. Instead, Windows provides a built-in, encrypted credential storage system called **Windows Credential Manager**.

In this chapter, we'll explore how QuickConnect uses the Windows Credential Manager to securely store and retrieve user credentials. We'll work with the `windows-rs` crate to interact with Windows APIs, handle UTF-16 string conversions, and implement secure credential operations.

---

## 13.1 Understanding Windows Credential Manager

### What is Windows Credential Manager?

**Windows Credential Manager** is a secure storage system built into Windows that stores credentials (usernames and passwords) in an encrypted vault. You can access it manually through:

```
Control Panel → User Accounts → Credential Manager
```

There you'll see two categories:
- **Web Credentials**: Used by web browsers and web applications
- **Windows Credentials**: Used by Windows services, RDP, and desktop applications

### Why Use Credential Manager?

1. **Security**: Credentials are encrypted using Windows Data Protection API (DPAPI)
2. **System Integration**: Works with native Windows authentication systems
3. **RDP Integration**: Credentials stored with `TERMSRV/*` prefix automatically work with Remote Desktop
4. **User Isolation**: Each Windows user has their own encrypted credential store
5. **No Plain Text**: Never need to store passwords in configuration files

### Credential Types

Windows supports several credential types:

```rust
// From Windows API
CRED_TYPE_GENERIC         // General purpose credentials
CRED_TYPE_DOMAIN_PASSWORD // Domain/network credentials
CRED_TYPE_DOMAIN_CERTIFICATE // Certificate-based credentials
CRED_TYPE_DOMAIN_VISIBLE_PASSWORD // Visible password (less secure)
```

QuickConnect uses `CRED_TYPE_GENERIC` for flexibility and simplicity.

---

## 13.2 The CREDENTIALW Structure

When working with Windows credentials, we use the `CREDENTIALW` structure (the "W" suffix indicates Wide character/UTF-16 encoding).

### Structure Definition

```rust
use windows::Win32::Security::Credentials::CREDENTIALW;
use windows::Win32::Foundation::FILETIME;
use windows::core::PWSTR;

pub struct CREDENTIALW {
    pub Flags: CRED_FLAGS,              // Reserved, must be 0
    pub Type: CRED_TYPE,                // Type of credential
    pub TargetName: PWSTR,              // Name/identifier for credential
    pub Comment: PWSTR,                 // Optional comment
    pub LastWritten: FILETIME,          // Last modified time
    pub CredentialBlobSize: u32,        // Size of password in bytes
    pub CredentialBlob: *mut u8,        // Pointer to password data
    pub Persist: CRED_PERSIST,          // Persistence level
    pub AttributeCount: u32,            // Number of custom attributes
    pub Attributes: *mut CREDENTIAL_ATTRIBUTE, // Custom attributes
    pub TargetAlias: PWSTR,             // Alias for target
    pub UserName: PWSTR,                // Username
}
```

### Key Fields Explained

| Field | Purpose | QuickConnect Usage |
|-------|---------|----------------|
| `Type` | Defines credential type | `CRED_TYPE_GENERIC` |
| `TargetName` | Unique identifier | `"QuickConnect"` or `"TERMSRV/{hostname}"` |
| `UserName` | Account username | Domain username |
| `CredentialBlob` | Password bytes | UTF-16 encoded password |
| `CredentialBlobSize` | Size in bytes | `password_length * 2` (UTF-16) |
| `Persist` | Where to store | `CRED_PERSIST_LOCAL_MACHINE` |

---

## 13.3 Saving Credentials with CredWriteW

Let's examine how QuickConnect saves credentials to Windows Credential Manager.

### The save_credentials Command

```rust
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use windows::core::PWSTR;
use windows::Win32::Security::Credentials::{
    CredWriteW, CREDENTIALW, CRED_FLAGS, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
};
use windows::Win32::Foundation::FILETIME;

#[derive(serde::Deserialize)]
struct Credentials {
    username: String,
    password: String,
}

#[tauri::command]
async fn save_credentials(credentials: Credentials) -> Result<(), String> {
    // Validate input
    if credentials.username.is_empty() {
        return Err("Username cannot be empty".to_string());
    }

    unsafe {
        // Convert strings to UTF-16 (wide character format)
        let target_name: Vec<u16> = OsStr::new("QuickConnect")
            .encode_wide()
            .chain(std::iter::once(0))  // Add null terminator
            .collect();
        
        let username: Vec<u16> = OsStr::new(&credentials.username)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        
        let password_wide: Vec<u16> = OsStr::new(&credentials.password)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Build the CREDENTIALW structure
        let cred = CREDENTIALW {
            Flags: CRED_FLAGS(0),
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(target_name.as_ptr() as *mut u16),
            Comment: PWSTR::null(),
            LastWritten: FILETIME::default(),
            CredentialBlobSize: (password_wide.len() * 2) as u32, // Bytes!
            CredentialBlob: password_wide.as_ptr() as *mut u8,
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: std::ptr::null_mut(),
            TargetAlias: PWSTR::null(),
            UserName: PWSTR(username.as_ptr() as *mut u16),
        };

        // Write to Credential Manager
        match CredWriteW(&cred, 0) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to save credentials: {:?}", e)),
        }
    }
}
```

### Understanding the Code

**1. UTF-16 Conversion**

Windows APIs use UTF-16 encoding (wide characters). We convert Rust strings using:

```rust
let wide_string: Vec<u16> = OsStr::new("MyString")
    .encode_wide()              // Convert to UTF-16
    .chain(std::iter::once(0))  // Add null terminator
    .collect();
```

**Why UTF-16?**
- Windows was designed for international markets
- UTF-16 efficiently represents most Unicode characters
- All Windows "W" APIs expect UTF-16 strings

**2. Password Size Calculation**

```rust
CredentialBlobSize: (password_wide.len() * 2) as u32
```

The size is in **bytes**, not characters. Since each UTF-16 character is 2 bytes:
- A 10-character password = 20 bytes (plus null terminator = 22 bytes)

**3. Unsafe Code**

Why is this `unsafe`?

```rust
unsafe {
    // Working with raw pointers and Windows APIs
    CredentialBlob: password_wide.as_ptr() as *mut u8,
}
```

- We're creating raw pointers (`*mut u16`, `*mut u8`)
- Windows API could potentially access invalid memory
- Rust can't guarantee memory safety across FFI boundary
- **Our responsibility** to ensure pointers remain valid

**4. Persistence Level**

```rust
Persist: CRED_PERSIST_LOCAL_MACHINE
```

Options:
- `CRED_PERSIST_SESSION`: Deleted when user logs out
- `CRED_PERSIST_LOCAL_MACHINE`: Persists across reboots
- `CRED_PERSIST_ENTERPRISE`: Roaming profile (domain users)

---

## 13.4 Retrieving Credentials with CredReadW

Now let's see how to read credentials back from the Credential Manager.

### The get_stored_credentials Command

```rust
use windows::Win32::Security::Credentials::{CredReadW, CREDENTIALW, CRED_TYPE_GENERIC};
use windows::core::PCWSTR;

#[derive(serde::Serialize)]
struct StoredCredentials {
    username: String,
    password: String,
}

#[tauri::command]
async fn get_stored_credentials() -> Result<Option<StoredCredentials>, String> {
    unsafe {
        // Convert target name to UTF-16
        let target_name: Vec<u16> = OsStr::new("QuickConnect")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Pointer to receive credential data
        let mut pcred = std::ptr::null_mut();

        match CredReadW(
            PCWSTR::from_raw(target_name.as_ptr()),
            CRED_TYPE_GENERIC,
            0,  // Reserved flags
            &mut pcred,
        ) {
            Ok(_) => {
                // Dereference the pointer to get the credential
                let cred = &*(pcred as *const CREDENTIALW);
                
                // Extract username
                let username = if !cred.UserName.is_null() {
                    match PWSTR::from_raw(cred.UserName.0).to_string() {
                        Ok(u) => u,
                        Err(e) => return Err(format!("Failed to read username: {:?}", e)),
                    }
                } else {
                    String::new()
                };

                // Extract password (stored as UTF-16)
                let password_bytes = std::slice::from_raw_parts(
                    cred.CredentialBlob,
                    cred.CredentialBlobSize as usize,
                );

                // Convert bytes back to UTF-16 characters
                let password_wide: Vec<u16> = password_bytes
                    .chunks_exact(2)
                    .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                    .collect();

                // Decode UTF-16 to String
                let password = match String::from_utf16(&password_wide) {
                    Ok(p) => p.trim_end_matches('\0').to_string(),
                    Err(e) => {
                        return Err(format!("Failed to decode password: {:?}", e));
                    }
                };

                Ok(Some(StoredCredentials { username, password }))
            }
            Err(_) => {
                // No credentials found - this is not an error
                Ok(None)
            }
        }
    }
}
```

### Understanding Password Retrieval

**1. Byte Array to UTF-16 Conversion**

The password is stored as raw bytes:

```rust
let password_bytes = std::slice::from_raw_parts(
    cred.CredentialBlob,
    cred.CredentialBlobSize as usize,
);
```

**2. Reconstructing UTF-16 Characters**

Each UTF-16 character is 2 bytes (little-endian):

```rust
let password_wide: Vec<u16> = password_bytes
    .chunks_exact(2)  // Split into 2-byte chunks
    .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
    .collect();
```

**3. Removing Null Terminator**

```rust
password.trim_end_matches('\0').to_string()
```

The null terminator was added when we saved the credential - remove it.

### Error Handling

```rust
match CredReadW(...) {
    Ok(_) => { /* Process credential */ }
    Err(_) => Ok(None)  // Return None, not an error!
}
```

**Important**: `CredReadW` fails if no credential exists. This is **not an error condition** - it just means the user hasn't saved credentials yet.

---

## 13.5 Deleting Credentials with CredDeleteW

When users want to remove stored credentials, we use `CredDeleteW`.

### The delete_credentials Command

```rust
use windows::Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC};

#[tauri::command]
async fn delete_credentials() -> Result<(), String> {
    unsafe {
        let target_name: Vec<u16> = OsStr::new("QuickConnect")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        CredDeleteW(
            PCWSTR::from_raw(target_name.as_ptr()),
            CRED_TYPE_GENERIC,
            0,  // Reserved
        ).map_err(|e| format!("Failed to delete credentials: {:?}", e))?;
    }
    
    Ok(())
}
```

### Simple and Straightforward

- Takes the target name
- Specifies the credential type
- Returns `Ok(())` on success or an error

**Use Cases:**
- User clicks "Logout" button
- Application reset/reinstall
- Security requirement to clear credentials

---

## 13.6 Per-Host Credentials (TERMSRV Integration)

QuickConnect has a powerful feature: **per-host credentials**. You can save different usernames/passwords for each RDP host.

### Why TERMSRV?

The `TERMSRV/{hostname}` prefix is special:
- **Windows RDP client** (`mstsc.exe`) automatically looks for credentials stored with this prefix
- When connecting to a host, RDP checks `TERMSRV/{hostname}` for credentials
- Enables **Single Sign-On (SSO)** - no manual password entry

### Saving Per-Host Credentials

```rust
#[tauri::command]
async fn save_host_credentials(
    hostname: String,
    credentials: Credentials
) -> Result<(), String> {
    // Parse username (remove domain prefix if present)
    let username = if credentials.username.contains('\\') {
        let parts: Vec<&str> = credentials.username.splitn(2, '\\').collect();
        parts[1].to_string()
    } else {
        credentials.username.clone()
    };

    unsafe {
        let password_wide: Vec<u16> = OsStr::new(&credentials.password)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Target name includes hostname
        let target_name: Vec<u16> = OsStr::new(&format!("TERMSRV/{}", hostname))
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

        CredWriteW(&cred, 0).map_err(|e| {
            format!("Failed to save credentials for {}: {:?}", hostname, e)
        })?;
    }
    
    Ok(())
}
```

### Retrieving Per-Host Credentials

```rust
#[tauri::command]
async fn get_host_credentials(
    hostname: String
) -> Result<Option<StoredCredentials>, String> {
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
                    PWSTR::from_raw(cred.UserName.0)
                        .to_string()
                        .map_err(|e| format!("Failed to read username: {:?}", e))?
                } else {
                    String::new()
                };

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

### Credential Fallback Strategy

QuickConnect uses a smart fallback:

```rust
// Try per-host credentials first
let credentials = match get_host_credentials(hostname.clone()).await? {
    Some(creds) => creds,
    None => {
        // Fall back to global credentials
        match get_stored_credentials().await? {
            Some(creds) => creds,
            None => return Err("No credentials found".to_string()),
        }
    }
};
```

**Benefits:**
1. **Flexibility**: Different credentials for different hosts
2. **Convenience**: Default credentials for most hosts
3. **Security**: Isolate credentials per destination

---

## 13.7 Security Best Practices

### 1. Never Log Passwords

```rust
// ❌ NEVER DO THIS
debug_log("INFO", "CREDENTIALS", &format!("Password: {}", password), None);

// ✅ DO THIS
debug_log(
    "INFO", 
    "CREDENTIALS", 
    &format!("Password length: {} characters", password.len()), 
    None
);
```

### 2. Clear Sensitive Data from Memory

```rust
// Use drop to clear credentials when done
{
    let credentials = get_stored_credentials().await?;
    // Use credentials...
} // credentials dropped here - memory freed
```

Rust automatically handles this, but be aware:
- Sensitive data should have minimal lifetime
- Avoid cloning credentials unnecessarily

### 3. Validate Before Storing

```rust
if credentials.username.is_empty() {
    return Err("Username cannot be empty".to_string());
}

if credentials.password.len() < 8 {
    return Err("Password must be at least 8 characters".to_string());
}
```

### 4. Handle Encoding Errors Gracefully

```rust
let username = match PWSTR::from_raw(cred.UserName.0).to_string() {
    Ok(u) => u,
    Err(e) => {
        // Don't expose internal error details to user
        return Err("Failed to retrieve username".to_string());
    }
};
```

### 5. Use CRED_PERSIST_LOCAL_MACHINE Appropriately

```rust
// For single-user machines
Persist: CRED_PERSIST_LOCAL_MACHINE

// For shared computers - consider session-only
Persist: CRED_PERSIST_SESSION  // Cleared on logout
```

---

## 13.8 QuickConnect Credential System Architecture

Let's see how QuickConnect uses all these pieces together.

### Credential Flow Diagram

```
┌─────────────────┐
│  Login Window   │
│  (user input)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  save_credentials()         │
│  ↓                          │
│  Convert to UTF-16          │
│  ↓                          │
│  CredWriteW()               │
│  ↓                          │
│  "QuickConnect" credential      │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  RDP Connection Request     │
│  ↓                          │
│  get_host_credentials()?    │
│  ├─ Found: Use per-host     │
│  └─ Not found:              │
│      get_stored_credentials()│
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Parse Username             │
│  (extract domain/user)      │
│  ↓                          │
│  Save to TERMSRV/{host}     │
│  ↓                          │
│  Launch RDP with SSO        │
└─────────────────────────────┘
```

### The Complete Picture

**Step 1: User Login**
```rust
// User enters credentials in login window
// Frontend calls save_credentials
invoke('save_credentials', {
    credentials: {
        username: 'DOMAIN\\user',
        password: 'SecurePass123'
    }
});
```

**Step 2: Credential Storage**
```rust
// Backend saves to Credential Manager
save_credentials(credentials).await?;
// Stored as: Target="QuickConnect", User="DOMAIN\user"
```

**Step 3: RDP Connection**
```rust
// User clicks "Connect" on a host
invoke('launch_rdp', { host: hostData });
```

**Step 4: Credential Retrieval**
```rust
// Check for per-host credentials
let creds = match get_host_credentials(hostname).await? {
    Some(c) => c,
    None => get_stored_credentials().await?.unwrap(),
};
```

**Step 5: TERMSRV Storage**
```rust
// Save to TERMSRV/{hostname} for RDP SSO
let target = format!("TERMSRV/{}", hostname);
CredWriteW(&cred_for_rdp, 0)?;
```

**Step 6: RDP Launch**
```rust
// Create .rdp file with username/domain
// Windows RDP automatically uses TERMSRV/* credentials
ShellExecuteW(&rdp_file)?;
```

---

## 13.9 Common Pitfalls and Solutions

### Pitfall 1: Forgetting Null Terminators

```rust
// ❌ WRONG - Missing null terminator
let target: Vec<u16> = OsStr::new("QuickConnect")
    .encode_wide()
    .collect();

// ✅ CORRECT - Include null terminator
let target: Vec<u16> = OsStr::new("QuickConnect")
    .encode_wide()
    .chain(std::iter::once(0))
    .collect();
```

**Result without null terminator**: Memory corruption, crashes, or garbage data.

### Pitfall 2: Wrong Size Calculation

```rust
// ❌ WRONG - Size is number of characters
CredentialBlobSize: password_wide.len() as u32

// ✅ CORRECT - Size is in BYTES (chars × 2)
CredentialBlobSize: (password_wide.len() * 2) as u32
```

### Pitfall 3: Not Handling Missing Credentials

```rust
// ❌ WRONG - Treating missing credentials as error
let creds = get_stored_credentials().await?
    .ok_or("Error: No credentials")?;

// ✅ CORRECT - Missing credentials is expected
let creds = match get_stored_credentials().await? {
    Some(c) => c,
    None => {
        // Show login window or use alternate source
        return show_login_window();
    }
};
```

### Pitfall 4: Username Format Issues

```rust
// Username might be in different formats:
// - "username"
// - "DOMAIN\\username"
// - "username@domain.com"

// ✅ Handle all formats
fn parse_username(input: &str) -> (String, String) {
    if input.contains('\\') {
        // DOMAIN\username
        let parts: Vec<&str> = input.splitn(2, '\\').collect();
        (parts[0].to_string(), parts[1].to_string())
    } else if input.contains('@') {
        // username@domain.com
        let parts: Vec<&str> = input.splitn(2, '@').collect();
        (parts[1].to_string(), parts[0].to_string())
    } else {
        // Just username
        (String::new(), input.to_string())
    }
}
```

---

## 13.10 Testing Your Implementation

### Manual Testing

**Test 1: Save and Retrieve**
```rust
// 1. Save credentials
save_credentials(Credentials {
    username: "testuser".to_string(),
    password: "TestPass123".to_string(),
}).await?;

// 2. Retrieve and verify
let creds = get_stored_credentials().await?
    .expect("Should have credentials");
assert_eq!(creds.username, "testuser");
assert_eq!(creds.password, "TestPass123");

// 3. Clean up
delete_credentials().await?;
```

**Test 2: Per-Host Credentials**
```rust
// Save host-specific credentials
save_host_credentials(
    "server01.domain.com".to_string(),
    Credentials { /* ... */ }
).await?;

// Verify retrieval
let host_creds = get_host_credentials("server01.domain.com").await?;
assert!(host_creds.is_some());
```

**Test 3: Verify in Windows Credential Manager**
1. Run your application
2. Save credentials
3. Open Windows Credential Manager
4. Navigate to **Windows Credentials**
5. Look for entries named `QuickConnect` or `TERMSRV/*`
6. Verify username is correct (password will be hidden)

### Debugging Tips

**Enable Debug Logging**
```rust
debug_log(
    "INFO",
    "CREDENTIALS",
    "Saving credentials",
    Some(&format!("Username: {}, PW Length: {}", 
        username, password.len()))
);
```

**Check Windows Event Viewer**
- Open Event Viewer
- Navigate to Windows Logs → Application
- Look for Credential Manager events

**Common Error Codes**
- `ERROR_NOT_FOUND`: Credential doesn't exist
- `ERROR_NO_SUCH_LOGON_SESSION`: Permission denied
- `ERROR_INVALID_PARAMETER`: Invalid structure or data

---

## 13.11 Key Takeaways

### What We Learned

1. **Windows Credential Manager** provides secure, encrypted credential storage
2. **UTF-16 encoding** is required for all Windows wide-character APIs
3. **CREDENTIALW** structure holds credential data and metadata
4. **CredWriteW**, **CredReadW**, **CredDeleteW** are the three main APIs
5. **TERMSRV/{hostname}** prefix enables RDP Single Sign-On
6. **Unsafe code** is necessary but manageable with proper patterns
7. **Size calculations** must account for bytes, not characters
8. **Null terminators** are critical for C-style strings

### Best Practices Checklist

- ✅ Always include null terminators in UTF-16 strings
- ✅ Calculate sizes in bytes (chars × 2 for UTF-16)
- ✅ Never log sensitive data (passwords)
- ✅ Handle missing credentials gracefully (not as errors)
- ✅ Validate input before storing
- ✅ Use `CRED_PERSIST_LOCAL_MACHINE` for persistent storage
- ✅ Support multiple username formats (user, DOMAIN\\user, user@domain)
- ✅ Test with Windows Credential Manager UI
- ✅ Implement proper error handling and user feedback
- ✅ Document your credential storage strategy

---

## 13.12 Practice Exercises

### Exercise 1: Basic Credential Storage

Create a simple Tauri application that:
1. Has a login form (username + password)
2. Saves credentials to Windows Credential Manager
3. Has a "Check Credentials" button that retrieves and displays the username (NOT password)
4. Has a "Clear" button to delete credentials

**Bonus**: Add validation that password must be at least 8 characters.

### Exercise 2: Multiple Credential Sets

Extend Exercise 1 to support multiple credential sets:
- Users can save credentials with different identifiers
- Example: "Work Account", "Personal Account", "Admin Account"
- Display a dropdown to select which credential set to load

### Exercise 3: RDP Credential Helper

Build a utility that:
1. Takes a hostname as input
2. Takes username and password
3. Saves credentials to `TERMSRV/{hostname}`
4. Displays all saved TERMSRV credentials in a list
5. Allows deleting specific TERMSRV entries

**Hint**: You'll need to implement `CredEnumerateW` to list all credentials.

### Exercise 4: Credential Import/Export

Create a secure credential backup system:
1. Export credentials to an **encrypted** file
2. Import credentials from the encrypted file
3. Use a master password to encrypt/decrypt the export file

**Security Note**: Research encryption libraries like `aes-gcm` or `chacha20poly1305`.

---

## 13.13 Further Reading

### Official Documentation
- [Credential Manager API](https://docs.microsoft.com/en-us/windows/win32/api/wincred/)
- [CREDENTIALW Structure](https://docs.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw)
- [Windows Data Protection API (DPAPI)](https://docs.microsoft.com/en-us/windows/win32/api/dpapi/)

### Rust Crates
- [windows-rs Documentation](https://microsoft.github.io/windows-rs/)
- [windows::Win32::Security::Credentials](https://microsoft.github.io/windows-rs/doc/windows/Win32/Security/Credentials/)

### Security Best Practices
- [OWASP Credential Storage Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [CWE-256: Plaintext Storage of a Password](https://cwe.mitre.org/data/definitions/256.html)

---

## Summary

In this chapter, we explored **Windows Credential Manager** integration, learning how to:

- Use `CredWriteW` to securely save credentials
- Use `CredReadW` to retrieve stored credentials
- Use `CredDeleteW` to remove credentials
- Handle UTF-16 string conversions properly
- Implement per-host credential storage with `TERMSRV/*`
- Follow security best practices for credential handling
- Debug common issues with credential operations

Windows Credential Manager provides a production-ready, secure storage solution that integrates seamlessly with Windows authentication systems. By leveraging this system, QuickConnect ensures user credentials are never stored in plain text while providing a smooth, secure user experience.

In the next chapter, we'll dive into **Advanced Error Handling and Logging**, exploring how QuickConnect implements a comprehensive debugging and error reporting system.

---

**Chapter 13 Complete** | **Next**: Chapter 14 - Advanced Error Handling and Logging


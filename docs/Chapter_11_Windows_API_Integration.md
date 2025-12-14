# Chapter 11: Windows API Integration

**Duration:** 2-3 hours  
**Difficulty:** Advanced  
**Prerequisites:** Chapters 1-10  

---

## Introduction

One of Rust's greatest strengths is its ability to safely interface with low-level system APIs. In this chapter, we'll explore how to integrate with the Windows API using the `windows` crate (formerly `windows-rs`), enabling our Tauri applications to leverage native Windows functionality.

We'll learn how to:
- Work with the `windows` crate for Win32 API access
- Handle Windows API error codes (HRESULT)
- Convert between Rust strings and Windows UTF-16 strings
- Launch processes using `ShellExecuteW`
- Access the Windows Registry
- Write safe wrappers around `unsafe` code

### Why Windows API Integration?

While Tauri provides many cross-platform features, sometimes you need to access platform-specific functionality:
- Launch applications with specific parameters
- Access the Windows Registry for settings
- Use Windows Credential Manager for secure storage
- Integrate with Windows shell features
- Access system information not exposed by Tauri

---

## 11.1 Introduction to the `windows` Crate

The `windows` crate provides Rust bindings for all Windows APIs. It's maintained by Microsoft and generates safe Rust code from Windows metadata.

### Adding the Dependency

First, add the `windows` crate to your `Cargo.toml`:

```toml
[dependencies]
windows = { version = "0.58", features = [
    "Win32_Foundation",
    "Win32_System_Registry",
    "Win32_UI_Shell",
    "Win32_Security_Credentials",
] }
```

The `features` array controls which Windows APIs are included. This keeps compilation times reasonable by only including what you need.

### Common Feature Categories

```toml
# Foundation types (HRESULT, BOOL, etc.)
"Win32_Foundation"

# Registry access
"Win32_System_Registry"

# Shell operations (ShellExecuteW)
"Win32_UI_Shell"

# Credential Manager
"Win32_Security_Credentials"

# Process and threading
"Win32_System_Threading"

# File system
"Win32_Storage_FileSystem"
```

### Basic Import Pattern

```rust
use windows::{
    core::*, // Common types: HSTRING, Error, Result
    Win32::Foundation::*, // BOOL, HWND, etc.
};
```

---

## 11.2 Win32 API Fundamentals

### Understanding HRESULT

Many Windows APIs return an `HRESULT`, which is a 32-bit error code. The `windows` crate provides convenient error handling:

```rust
use windows::core::{Result, HSTRING};

fn windows_operation() -> Result<()> {
    // Windows API call that returns HRESULT
    unsafe {
        // If the operation fails, ? will convert HRESULT to windows::core::Error
        SomeWindowsFunction()?;
    }
    Ok(())
}

// Usage
match windows_operation() {
    Ok(()) => println!("Success!"),
    Err(e) => eprintln!("Windows error: {}", e),
}
```

### Common Windows Types

```rust
// Boolean (not the same as Rust bool!)
use windows::Win32::Foundation::BOOL;

let success: BOOL = TRUE; // or FALSE

// Convert to Rust bool
let rust_bool: bool = success.as_bool();
```

```rust
// Window handles
use windows::Win32::Foundation::HWND;

let window_handle: HWND = HWND(0); // Null window
```

```rust
// Win32 error codes
use windows::Win32::Foundation::WIN32_ERROR;

let error_code = WIN32_ERROR(5); // Access denied
println!("Error: {:?}", error_code);
```

### The Result Pattern

The `windows` crate provides its own `Result` type:

```rust
use windows::core::Result; // Not std::result::Result

fn my_windows_function() -> Result<String> {
    // This returns windows::core::Result<String>
    Ok("Success".to_string())
}
```

To integrate with Tauri commands that use `std::result::Result`, convert the error:

```rust
#[tauri::command]
fn my_command() -> Result<String, String> {
    match my_windows_function() {
        Ok(value) => Ok(value),
        Err(e) => Err(format!("Windows error: {}", e)),
    }
}
```

---

## 11.3 Working with HRESULT and Error Codes

### Checking for Success

```rust
use windows::core::{Result, HSTRING};
use windows::Win32::Foundation::{S_OK, S_FALSE};

fn check_result() -> Result<()> {
    let hr = unsafe { SomeWindowsFunction() };
    
    if hr == S_OK {
        println!("Complete success");
    } else if hr == S_FALSE {
        println!("Success with warning");
    }
    
    hr.ok()?; // Convert to Result
    Ok(())
}
```

### Getting Error Messages

```rust
use windows::core::Error;

fn handle_windows_error(error: Error) {
    println!("Error code: 0x{:08X}", error.code().0);
    println!("Error message: {}", error.message());
}

// Example usage
match windows_operation() {
    Ok(_) => println!("Success"),
    Err(e) => handle_windows_error(e),
}
```

### Common Error Codes

```rust
use windows::Win32::Foundation::{
    ERROR_SUCCESS,
    ERROR_FILE_NOT_FOUND,
    ERROR_ACCESS_DENIED,
    ERROR_INVALID_PARAMETER,
};

fn check_error_code(code: u32) {
    match code {
        ERROR_SUCCESS => println!("Success"),
        ERROR_FILE_NOT_FOUND => println!("File not found"),
        ERROR_ACCESS_DENIED => println!("Access denied"),
        ERROR_INVALID_PARAMETER => println!("Invalid parameter"),
        _ => println!("Unknown error: {}", code),
    }
}
```

---

## 11.4 String Conversions (UTF-16)

Windows APIs use UTF-16 encoded strings (wide characters), while Rust uses UTF-8. The `windows` crate provides the `HSTRING` type for this.

### Rust String → Windows String

```rust
use windows::core::HSTRING;

fn rust_to_windows() {
    let rust_string = "Hello, Windows!";
    
    // Convert to HSTRING (UTF-16)
    let windows_string = HSTRING::from(rust_string);
    
    println!("Windows string created: {:?}", windows_string);
}
```

### Windows String → Rust String

```rust
use windows::core::HSTRING;

fn windows_to_rust(windows_string: &HSTRING) -> String {
    // HSTRING implements Display, so we can use to_string()
    windows_string.to_string()
}

// Alternative: handle potential errors
fn windows_to_rust_safe(windows_string: &HSTRING) -> Result<String, String> {
    Ok(windows_string.to_string_lossy())
}
```

### Working with PCWSTR (Pointer to Const Wide String)

Some older Windows APIs use raw pointers to wide strings:

```rust
use windows::core::PCWSTR;

fn create_pcwstr(text: &str) -> HSTRING {
    HSTRING::from(text)
}

fn use_pcwstr_api() {
    let text = create_pcwstr("C:\\Windows\\System32");
    
    unsafe {
        // PCWSTR is created from HSTRING reference
        let ptr = PCWSTR::from_raw(text.as_ptr());
        SomeOldWindowsAPI(ptr);
    }
}
```

### Practical Example: File Paths

```rust
use windows::core::HSTRING;
use std::path::PathBuf;

fn path_to_windows_string(path: &PathBuf) -> HSTRING {
    HSTRING::from(path.to_string_lossy().as_ref())
}

fn example_usage() {
    let path = PathBuf::from("C:\\Users\\Public\\Documents\\file.txt");
    let windows_path = path_to_windows_string(&path);
    
    println!("Windows path: {}", windows_path);
}
```

---

## 11.5 Unsafe Code and Safety Patterns

Most Windows API calls require `unsafe` blocks because they involve FFI (Foreign Function Interface).

### Understanding `unsafe`

```rust
// This is safe Rust
fn safe_function() {
    let x = 42;
    println!("{}", x);
}

// This requires unsafe because we're calling a Windows API
fn windows_function() {
    unsafe {
        // Windows API call
        MessageBoxW(None, w!("Hello"), w!("Title"), MB_OK);
    }
}
```

### Why is it `unsafe`?

The `unsafe` keyword acknowledges:
1. **Foreign Function Interface**: Rust can't verify the behavior of Windows code
2. **Invariants**: Windows APIs may have requirements Rust can't enforce
3. **Memory Safety**: Windows APIs might access memory in ways Rust doesn't track

### Safety Wrapper Pattern

Always wrap `unsafe` calls in safe functions:

```rust
use windows::Win32::UI::WindowsAndMessaging::*;
use windows::core::PCWSTR;

/// Safe wrapper for MessageBoxW
/// 
/// # Arguments
/// * `message` - The message to display
/// * `title` - The title of the message box
/// 
/// # Returns
/// * `Ok(button_clicked)` - The button that was clicked
/// * `Err(error)` - If the operation failed
pub fn show_message_box(message: &str, title: &str) -> windows::core::Result<i32> {
    let message_hstring = windows::core::HSTRING::from(message);
    let title_hstring = windows::core::HSTRING::from(title);
    
    unsafe {
        Ok(MessageBoxW(
            None,
            &message_hstring,
            &title_hstring,
            MB_OK | MB_ICONINFORMATION,
        ))
    }
}

// Usage - no unsafe needed!
fn main() {
    match show_message_box("Hello from Rust!", "Information") {
        Ok(_) => println!("Message box shown"),
        Err(e) => eprintln!("Error: {}", e),
    }
}
```

### Safety Documentation

Always document the safety requirements:

```rust
/// Launches a Windows application
/// 
/// # Safety
/// 
/// This function is unsafe because:
/// - It calls the Windows API ShellExecuteW
/// - The caller must ensure the path is a valid Windows path
/// - The caller must ensure the parameters are valid
/// 
/// # Arguments
/// * `path` - Valid Windows file path
/// * `params` - Command line parameters (can be empty)
unsafe fn launch_application_unchecked(path: &str, params: &str) -> windows::core::Result<()> {
    // Implementation
    Ok(())
}

// Safe wrapper
pub fn launch_application(path: &str, params: &str) -> Result<(), String> {
    // Validate inputs
    if path.is_empty() {
        return Err("Path cannot be empty".to_string());
    }
    
    // Call unsafe function
    unsafe {
        launch_application_unchecked(path, params)
            .map_err(|e| format!("Failed to launch application: {}", e))
    }
}
```

---

## 11.6 ShellExecuteW for Process Launching

`ShellExecuteW` is the Windows API function for launching applications, opening documents, and executing shell operations.

### Basic ShellExecuteW

```rust
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::Foundation::HWND;
use windows::core::HSTRING;

fn launch_notepad() -> windows::core::Result<()> {
    let operation = HSTRING::from("open");
    let file = HSTRING::from("notepad.exe");
    let parameters = HSTRING::from("");
    let directory = HSTRING::from("");
    
    unsafe {
        let result = ShellExecuteW(
            HWND(0),              // Parent window (none)
            &operation,           // Operation: "open", "edit", "print", etc.
            &file,                // File to open
            &parameters,          // Parameters
            &directory,           // Working directory
            SW_SHOW,              // Show command
        );
        
        // ShellExecuteW returns an HINSTANCE
        // Values <= 32 indicate an error
        if result.0 <= 32 {
            return Err(windows::core::Error::from_win32());
        }
    }
    
    Ok(())
}
```

### Show Commands

```rust
use windows::Win32::UI::WindowsAndMessaging::*;

// Common show commands
const SW_HIDE: i32 = 0;           // Hide window
const SW_SHOW: i32 = 5;           // Show window normally
const SW_MINIMIZE: i32 = 6;       // Minimize window
const SW_MAXIMIZE: i32 = 3;       // Maximize window
const SW_SHOWDEFAULT: i32 = 10;   // Show as application prefers
```

### QuickConnect Launch Implementation

Here's how QuickConnect launches RDP sessions:

```rust
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOW;
use windows::core::HSTRING;

/// Launches an RDP session using an RDP file
/// 
/// # Arguments
/// * `rdp_file_path` - Full path to the .rdp file
/// 
/// # Returns
/// * `Ok(())` if launched successfully
/// * `Err(String)` with error message if failed
pub fn launch_rdp_session(rdp_file_path: &str) -> Result<(), String> {
    let operation = HSTRING::from("open");
    let file = HSTRING::from(rdp_file_path);
    let parameters = HSTRING::from("");
    let directory = HSTRING::from("");
    
    unsafe {
        let result = ShellExecuteW(
            HWND(0),
            &operation,
            &file,
            &parameters,
            &directory,
            SW_SHOW,
        );
        
        // Check if successful (result > 32)
        if result.0 <= 32 {
            return Err(format!(
                "Failed to launch RDP session. Error code: {}",
                result.0
            ));
        }
    }
    
    Ok(())
}

// Tauri command wrapper
#[tauri::command]
pub fn start_rdp_session(rdp_file: String) -> Result<(), String> {
    launch_rdp_session(&rdp_file)
}
```

### Opening URLs in Default Browser

```rust
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOW;
use windows::core::HSTRING;

pub fn open_url(url: &str) -> Result<(), String> {
    let operation = HSTRING::from("open");
    let file = HSTRING::from(url);
    let empty = HSTRING::from("");
    
    unsafe {
        let result = ShellExecuteW(
            HWND(0),
            &operation,
            &file,
            &empty,
            &empty,
            SW_SHOW,
        );
        
        if result.0 <= 32 {
            return Err("Failed to open URL".to_string());
        }
    }
    
    Ok(())
}

// Usage
fn main() {
    open_url("https://github.com").unwrap();
}
```

### Opening File Explorer

```rust
pub fn open_file_explorer(path: &str) -> Result<(), String> {
    let operation = HSTRING::from("open");
    let file = HSTRING::from("explorer.exe");
    let parameters = HSTRING::from(path);
    let empty = HSTRING::from("");
    
    unsafe {
        let result = ShellExecuteW(
            HWND(0),
            &operation,
            &file,
            &parameters,
            &empty,
            SW_SHOW,
        );
        
        if result.0 <= 32 {
            return Err("Failed to open explorer".to_string());
        }
    }
    
    Ok(())
}

// Usage
fn main() {
    open_file_explorer("C:\\Users\\Public\\Documents").unwrap();
}
```

---

## 11.7 Registry Access

The Windows Registry stores system and application settings. Let's learn how to read and write registry values safely.

### Reading Registry Values

```rust
use windows::Win32::System::Registry::*;
use windows::Win32::Foundation::ERROR_SUCCESS;
use windows::core::HSTRING;

/// Reads a string value from the registry
/// 
/// # Arguments
/// * `key_path` - Registry key path (e.g., "SOFTWARE\\MyApp")
/// * `value_name` - Name of the value to read
/// 
/// # Returns
/// * `Ok(String)` - The value if found
/// * `Err(String)` - Error message if not found or other error
pub fn read_registry_string(key_path: &str, value_name: &str) -> Result<String, String> {
    let key_hstring = HSTRING::from(key_path);
    let value_hstring = HSTRING::from(value_name);
    
    unsafe {
        let mut h_key = HKEY::default();
        
        // Open the registry key
        let result = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            &key_hstring,
            0,
            KEY_READ,
            &mut h_key,
        );
        
        if result != ERROR_SUCCESS {
            return Err(format!("Failed to open registry key: {}", result.0));
        }
        
        // Query the value size
        let mut data_size: u32 = 0;
        let result = RegQueryValueExW(
            h_key,
            &value_hstring,
            None,
            None,
            None,
            Some(&mut data_size),
        );
        
        if result != ERROR_SUCCESS {
            RegCloseKey(h_key);
            return Err(format!("Failed to query value size: {}", result.0));
        }
        
        // Read the value
        let mut buffer = vec![0u16; (data_size / 2) as usize];
        let result = RegQueryValueExW(
            h_key,
            &value_hstring,
            None,
            None,
            Some(buffer.as_mut_ptr() as *mut u8),
            Some(&mut data_size),
        );
        
        RegCloseKey(h_key);
        
        if result != ERROR_SUCCESS {
            return Err(format!("Failed to read value: {}", result.0));
        }
        
        // Convert UTF-16 to String
        let value = String::from_utf16_lossy(&buffer);
        Ok(value.trim_end_matches('\0').to_string())
    }
}
```

### Writing Registry Values

```rust
use windows::Win32::System::Registry::*;
use windows::Win32::Foundation::ERROR_SUCCESS;
use windows::core::HSTRING;

/// Writes a string value to the registry
/// 
/// # Arguments
/// * `key_path` - Registry key path
/// * `value_name` - Name of the value to write
/// * `value` - The string value to write
pub fn write_registry_string(
    key_path: &str,
    value_name: &str,
    value: &str,
) -> Result<(), String> {
    let key_hstring = HSTRING::from(key_path);
    let value_hstring = HSTRING::from(value_name);
    
    unsafe {
        let mut h_key = HKEY::default();
        
        // Create or open the registry key
        let result = RegCreateKeyExW(
            HKEY_CURRENT_USER,
            &key_hstring,
            0,
            None,
            REG_OPTION_NON_VOLATILE,
            KEY_WRITE,
            None,
            &mut h_key,
            None,
        );
        
        if result != ERROR_SUCCESS {
            return Err(format!("Failed to create/open key: {}", result.0));
        }
        
        // Convert string to UTF-16
        let value_wide: Vec<u16> = value.encode_utf16().chain(Some(0)).collect();
        let data_size = (value_wide.len() * 2) as u32;
        
        // Write the value
        let result = RegSetValueExW(
            h_key,
            &value_hstring,
            0,
            REG_SZ,
            Some(value_wide.as_ptr() as *const u8),
            data_size,
        );
        
        RegCloseKey(h_key);
        
        if result != ERROR_SUCCESS {
            return Err(format!("Failed to write value: {}", result.0));
        }
        
        Ok(())
    }
}
```

### QuickConnect Theme Storage Example

```rust
/// Saves the current theme to the registry
#[tauri::command]
pub fn save_theme(theme: String) -> Result<(), String> {
    write_registry_string(
        "SOFTWARE\\QuickConnect",
        "Theme",
        &theme,
    )
}

/// Loads the saved theme from the registry
#[tauri::command]
pub fn load_theme() -> Result<String, String> {
    match read_registry_string("SOFTWARE\\QuickConnect", "Theme") {
        Ok(theme) => Ok(theme),
        Err(_) => Ok("light".to_string()), // Default theme
    }
}
```

### Reading DWORD Values

```rust
use windows::Win32::System::Registry::*;
use windows::Win32::Foundation::ERROR_SUCCESS;
use windows::core::HSTRING;

pub fn read_registry_dword(key_path: &str, value_name: &str) -> Result<u32, String> {
    let key_hstring = HSTRING::from(key_path);
    let value_hstring = HSTRING::from(value_name);
    
    unsafe {
        let mut h_key = HKEY::default();
        
        let result = RegOpenKeyExW(
            HKEY_CURRENT_USER,
            &key_hstring,
            0,
            KEY_READ,
            &mut h_key,
        );
        
        if result != ERROR_SUCCESS {
            return Err(format!("Failed to open key: {}", result.0));
        }
        
        let mut value: u32 = 0;
        let mut data_size = std::mem::size_of::<u32>() as u32;
        
        let result = RegQueryValueExW(
            h_key,
            &value_hstring,
            None,
            None,
            Some(&mut value as *mut u32 as *mut u8),
            Some(&mut data_size),
        );
        
        RegCloseKey(h_key);
        
        if result != ERROR_SUCCESS {
            return Err(format!("Failed to read value: {}", result.0));
        }
        
        Ok(value)
    }
}
```

### Writing DWORD Values

```rust
pub fn write_registry_dword(
    key_path: &str,
    value_name: &str,
    value: u32,
) -> Result<(), String> {
    let key_hstring = HSTRING::from(key_path);
    let value_hstring = HSTRING::from(value_name);
    
    unsafe {
        let mut h_key = HKEY::default();
        
        let result = RegCreateKeyExW(
            HKEY_CURRENT_USER,
            &key_hstring,
            0,
            None,
            REG_OPTION_NON_VOLATILE,
            KEY_WRITE,
            None,
            &mut h_key,
            None,
        );
        
        if result != ERROR_SUCCESS {
            return Err(format!("Failed to create/open key: {}", result.0));
        }
        
        let result = RegSetValueExW(
            h_key,
            &value_hstring,
            0,
            REG_DWORD,
            Some(&value as *const u32 as *const u8),
            4,
        );
        
        RegCloseKey(h_key);
        
        if result != ERROR_SUCCESS {
            return Err(format!("Failed to write value: {}", result.0));
        }
        
        Ok(())
    }
}
```

---

## 11.8 QuickConnect Windows Integration Examples

Let's examine real Windows API usage from the QuickConnect application.

### Example 1: Launching RDP (QuickConnect approach)

QuickConnect writes a `.rdp` file under `%APPDATA%\QuickConnect\Connections\` and launches the built-in RDP client by spawning `mstsc.exe` with the `.rdp` file path.

```rust
use std::path::PathBuf;
use std::process::Command;

/// Writes an RDP file and launches it.
///
/// Note: In the real app, credential selection and TERMSRV storage are handled
/// separately (see the credential manager and RDP launcher chapters). This snippet
/// focuses on the file + process launch portion.
pub fn write_and_launch_rdp(hostname: &str, rdp_content: &str) -> Result<(), String> {
    let appdata_dir = std::env::var("APPDATA")
        .map_err(|_| "Failed to get APPDATA directory".to_string())?;

    let connections_dir = PathBuf::from(appdata_dir)
        .join("QuickConnect")
        .join("Connections");

    std::fs::create_dir_all(&connections_dir)
        .map_err(|e| format!("Failed to create connections directory: {}", e))?;

    let rdp_path = connections_dir.join(format!("{}.rdp", hostname));
    std::fs::write(&rdp_path, rdp_content)
        .map_err(|e| format!("Failed to write RDP file: {}", e))?;

    Command::new("mstsc.exe")
        .arg(&rdp_path)
        .spawn()
        .map_err(|e| format!("Failed to launch mstsc.exe: {}", e))?;

    Ok(())
}
```

### Example 2: Checking Windows Startup Registry

```rust
use crate::adapters::{RegistryAdapter, WindowsRegistry};

const REGISTRY_RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const APP_NAME: &str = "QuickConnect";

/// Checks if QuickConnect is set to start with Windows.
///
/// QuickConnect reads/writes this via a small registry adapter.
#[tauri::command]
pub fn check_autostart() -> Result<bool, String> {
    let registry = WindowsRegistry::new();
    match registry.read_string(REGISTRY_RUN_KEY, APP_NAME) {
        Ok(Some(_)) => Ok(true),
        Ok(None) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Toggles autostart and returns the new enabled state.
#[tauri::command]
pub fn toggle_autostart() -> Result<bool, String> {
    let is_enabled = check_autostart()?;

    let registry = WindowsRegistry::new();
    if is_enabled {
        registry
            .delete_value(REGISTRY_RUN_KEY, APP_NAME)
            .map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;
        let exe_path_str = exe_path.to_string_lossy().to_string();

        registry
            .write_string(REGISTRY_RUN_KEY, APP_NAME, &exe_path_str)
            .map_err(|e| e.to_string())?;
        Ok(true)
    }
}
```

### Example 3: Getting Windows Username

```rust
use windows::Win32::System::SystemInformation::*;
use windows::core::HSTRING;

/// Gets the current Windows username
#[tauri::command]
pub fn get_windows_username() -> Result<String, String> {
    unsafe {
        let mut buffer = vec![0u16; 256];
        let mut size = buffer.len() as u32;
        
        let result = GetUserNameW(Some(&mut buffer), &mut size);
        
        if result.as_bool() {
            let username = String::from_utf16_lossy(&buffer[..size as usize - 1]);
            Ok(username)
        } else {
            Err("Failed to get username".to_string())
        }
    }
}
```

---

## 11.9 Key Takeaways

### Essential Concepts

1. **The `windows` Crate**
   - Official Microsoft bindings for Windows APIs
   - Feature-based to control compilation size
   - Generates safe Rust types from Windows metadata

2. **String Conversions**
   - Use `HSTRING` for Windows API strings
   - Windows uses UTF-16, Rust uses UTF-8
   - Always null-terminate when required

3. **Error Handling**
   - `HRESULT` for most modern APIs
   - Win32 error codes for older APIs
   - Convert to Rust `Result` types for Tauri commands

4. **Safety**
   - Most Windows API calls require `unsafe`
   - Always wrap in safe functions
   - Document safety requirements
   - Validate inputs before calling unsafe code

5. **Common Patterns**
   - `ShellExecuteW` for launching applications
   - Registry for persistent settings
   - Always close handles (HKEY, HANDLE, etc.)

### Best Practices

```rust
// ✅ GOOD: Safe wrapper with validation
pub fn safe_windows_operation(input: &str) -> Result<String, String> {
    // Validate input
    if input.is_empty() {
        return Err("Input cannot be empty".to_string());
    }
    
    // Convert to Windows types
    let input_hstring = HSTRING::from(input);
    
    // Call unsafe Windows API
    unsafe {
        let result = WindowsAPI(&input_hstring);
        
        // Handle errors
        if !result.is_ok() {
            return Err(format!("Windows API failed: {}", result.message()));
        }
        
        // Convert result back to Rust types
        Ok(result.to_string())
    }
}

// ❌ BAD: Exposing unsafe to callers
pub unsafe fn unsafe_windows_operation(input: &str) -> String {
    let input_hstring = HSTRING::from(input);
    WindowsAPI(&input_hstring).to_string()
}
```

### Performance Considerations

- **String Conversions**: UTF-8 ↔ UTF-16 conversions have overhead
- **Registry Access**: Can be slow, cache values when possible
- **ShellExecuteW**: Launches processes, inherently async
- **Error Handling**: Getting error messages allocates strings

### Common Pitfalls

1. **Forgetting to Check Return Values**
   ```rust
   // ❌ BAD
   unsafe { ShellExecuteW(/*...*/) };
   
   // ✅ GOOD
   let result = unsafe { ShellExecuteW(/*...*/) };
   if result.0 <= 32 { /* handle error */ }
   ```

2. **Not Closing Handles**
   ```rust
   // ❌ BAD
   let mut h_key = HKEY::default();
   RegOpenKeyExW(/*...*/, &mut h_key);
   // ... use h_key but never close it
   
   // ✅ GOOD
   let mut h_key = HKEY::default();
   RegOpenKeyExW(/*...*/, &mut h_key);
   // ... use h_key
   RegCloseKey(h_key); // Always close!
   ```

3. **Incorrect String Null Termination**
   ```rust
   // ❌ BAD
   let value: Vec<u16> = "text".encode_utf16().collect();
   
   // ✅ GOOD
   let value: Vec<u16> = "text".encode_utf16().chain(Some(0)).collect();
   ```

---

## 11.10 Practice Exercises

### Exercise 1: System Information
Create a command that retrieves Windows system information:
- Computer name
- Windows version
- User's home directory

```rust
#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    // Your implementation here
    todo!()
}

#[derive(serde::Serialize)]
pub struct SystemInfo {
    computer_name: String,
    windows_version: String,
    home_directory: String,
}
```

<details>
<summary>Solution</summary>

```rust
use windows::Win32::System::SystemInformation::*;
use windows::core::HSTRING;

#[derive(serde::Serialize)]
pub struct SystemInfo {
    computer_name: String,
    windows_version: String,
    home_directory: String,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    unsafe {
        // Get computer name
        let mut name_buffer = vec![0u16; 256];
        let mut name_size = name_buffer.len() as u32;
        GetComputerNameW(Some(&mut name_buffer), &mut name_size);
        let computer_name = String::from_utf16_lossy(&name_buffer[..name_size as usize]);
        
        // Get Windows version
        let mut version_info = OSVERSIONINFOEXW::default();
        version_info.dwOSVersionInfoSize = std::mem::size_of::<OSVERSIONINFOEXW>() as u32;
        RtlGetVersion(&mut version_info as *mut _ as *mut _);
        let windows_version = format!(
            "{}.{}.{}",
            version_info.dwMajorVersion,
            version_info.dwMinorVersion,
            version_info.dwBuildNumber
        );
        
        // Get home directory
        let home_directory = std::env::var("USERPROFILE")
            .unwrap_or_else(|_| "Unknown".to_string());
        
        Ok(SystemInfo {
            computer_name,
            windows_version,
            home_directory,
        })
    }
}
```
</details>

### Exercise 2: File Association
Create a command that opens a file with its default Windows application:

```rust
#[tauri::command]
pub fn open_with_default_app(file_path: String) -> Result<(), String> {
    // Your implementation here
    todo!()
}
```

<details>
<summary>Solution</summary>

```rust
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOW;
use windows::core::HSTRING;

#[tauri::command]
pub fn open_with_default_app(file_path: String) -> Result<(), String> {
    // Validate file exists
    if !std::path::Path::new(&file_path).exists() {
        return Err(format!("File not found: {}", file_path));
    }
    
    let operation = HSTRING::from("open");
    let file = HSTRING::from(&file_path);
    let empty = HSTRING::from("");
    
    unsafe {
        let result = ShellExecuteW(
            HWND(0),
            &operation,
            &file,
            &empty,
            &empty,
            SW_SHOW,
        );
        
        if result.0 <= 32 {
            return Err(format!(
                "Failed to open file. Error code: {}",
                result.0
            ));
        }
    }
    
    Ok(())
}
```
</details>

### Exercise 3: Registry Settings Manager
Create a settings manager that saves and loads application preferences:

```rust
#[derive(serde::Serialize, serde::Deserialize)]
pub struct AppSettings {
    theme: String,
    auto_connect: bool,
    last_host: String,
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    // Your implementation here
    todo!()
}

#[tauri::command]
pub fn load_settings() -> Result<AppSettings, String> {
    // Your implementation here
    todo!()
}
```

<details>
<summary>Solution</summary>

```rust
const SETTINGS_KEY: &str = "SOFTWARE\\MyTauriApp";

#[derive(serde::Serialize, serde::Deserialize)]
pub struct AppSettings {
    theme: String,
    auto_connect: bool,
    last_host: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
            auto_connect: false,
            last_host: String::new(),
        }
    }
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    write_registry_string(SETTINGS_KEY, "Theme", &settings.theme)?;
    write_registry_dword(SETTINGS_KEY, "AutoConnect", if settings.auto_connect { 1 } else { 0 })?;
    write_registry_string(SETTINGS_KEY, "LastHost", &settings.last_host)?;
    Ok(())
}

#[tauri::command]
pub fn load_settings() -> Result<AppSettings, String> {
    let theme = read_registry_string(SETTINGS_KEY, "Theme")
        .unwrap_or_else(|_| "light".to_string());
    
    let auto_connect = read_registry_dword(SETTINGS_KEY, "AutoConnect")
        .unwrap_or(0) != 0;
    
    let last_host = read_registry_string(SETTINGS_KEY, "LastHost")
        .unwrap_or_default();
    
    Ok(AppSettings {
        theme,
        auto_connect,
        last_host,
    })
}
```
</details>

---

## Summary

In this chapter, you learned how to integrate Windows APIs into your Tauri applications:

- **Windows Crate**: Using Microsoft's official Rust bindings
- **String Handling**: Converting between UTF-8 and UTF-16
- **Error Handling**: Working with HRESULT and Win32 error codes
- **Safety**: Writing safe wrappers around unsafe Windows API calls
- **ShellExecuteW**: Launching applications and opening files
- **Registry Access**: Reading and writing application settings

These skills enable you to create Windows-native functionality in your Tauri applications, accessing features not available through cross-platform APIs.

In the next chapter, we'll explore **File I/O and Data Persistence**, learning how to read and write files, work with CSV and JSON data, and manage application data directories.

---

**Chapter 11 Complete** ✅  
**Next:** Chapter 12 - File I/O and Data Persistence

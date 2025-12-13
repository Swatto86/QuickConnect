# Chapter 12: File I/O and Data Persistence

**Learning Objectives:**
- Master file operations using Rust's `std::fs` module
- Understand path handling with `PathBuf` and platform differences
- Implement CSV and JSON serialization/deserialization
- Learn proper error handling for file operations
- Discover Windows AppData directory patterns
- Analyze QuickConnect's hosts.csv implementation
- Build a complete data persistence layer

**Time Required:** 90 minutes  
**Prerequisites:** Chapters 1, 10, 11

---

## 12.1 Rust std::fs Module

The standard library's `fs` module provides all the building blocks for file system operations. Unlike languages with blocking I/O by default, Rust makes you explicit about your choices.

### Basic File Operations

```rust
use std::fs;
use std::io::{self, Write, Read};
use std::path::Path;

// Reading entire file to string
fn read_config_file() -> io::Result<String> {
    fs::read_to_string("config.txt")
}

// Writing string to file (overwrites)
fn write_config_file(content: &str) -> io::Result<()> {
    fs::write("config.txt", content)
}

// Appending to a file
fn log_message(message: &str) -> io::Result<()> {
    use std::fs::OpenOptions;
    
    let mut file = OpenOptions::new()
        .create(true)      // Create if doesn't exist
        .append(true)      // Append mode
        .open("app.log")?;
    
    writeln!(file, "{}", message)?;
    Ok(())
}

// Reading file in chunks (for large files)
fn read_large_file(path: &str) -> io::Result<Vec<u8>> {
    use std::fs::File;
    
    let mut file = File::open(path)?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;
    Ok(buffer)
}
```

### Checking File Existence and Metadata

```rust
use std::fs;
use std::path::Path;

fn check_file_info(path: &str) {
    let path = Path::new(path);
    
    // Check if exists
    if path.exists() {
        println!("File exists!");
        
        // Check if it's a file or directory
        if path.is_file() {
            println!("It's a file");
        } else if path.is_dir() {
            println!("It's a directory");
        }
        
        // Get metadata
        if let Ok(metadata) = fs::metadata(path) {
            println!("File size: {} bytes", metadata.len());
            println!("Read-only: {}", metadata.permissions().readonly());
            
            if let Ok(modified) = metadata.modified() {
                println!("Last modified: {:?}", modified);
            }
        }
    } else {
        println!("File doesn't exist");
    }
}
```

### Creating and Removing Files/Directories

```rust
use std::fs;
use std::io;

// Create a directory (fails if parent doesn't exist)
fn create_dir() -> io::Result<()> {
    fs::create_dir("data")?;
    Ok(())
}

// Create directory and all parent directories (like mkdir -p)
fn create_dir_all() -> io::Result<()> {
    fs::create_dir_all("data/backups/2024/november")?;
    Ok(())
}

// Remove an empty directory
fn remove_dir() -> io::Result<()> {
    fs::remove_dir("data")?;
    Ok(())
}

// Remove directory and all contents (dangerous!)
fn remove_dir_all() -> io::Result<()> {
    fs::remove_dir_all("data")?;
    Ok(())
}

// Remove a file
fn remove_file() -> io::Result<()> {
    fs::remove_file("config.txt")?;
    Ok(())
}

// Copy a file
fn copy_file() -> io::Result<()> {
    fs::copy("source.txt", "destination.txt")?;
    Ok(())
}

// Rename/move a file
fn rename_file() -> io::Result<()> {
    fs::rename("old_name.txt", "new_name.txt")?;
    Ok(())
}
```

### Directory Listing

```rust
use std::fs;
use std::io;

fn list_directory(path: &str) -> io::Result<()> {
    let entries = fs::read_dir(path)?;
    
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name();
        
        println!("{:?} - Is dir: {}", file_name, path.is_dir());
    }
    
    Ok(())
}

// Recursive directory walk
fn walk_directory(path: &str) -> io::Result<()> {
    fn walk_recursive(path: &Path, depth: usize) -> io::Result<()> {
        if path.is_dir() {
            let indent = "  ".repeat(depth);
            println!("{}{}/", indent, path.file_name().unwrap().to_string_lossy());
            
            for entry in fs::read_dir(path)? {
                let entry = entry?;
                walk_recursive(&entry.path(), depth + 1)?;
            }
        } else {
            let indent = "  ".repeat(depth);
            println!("{}{}", indent, path.file_name().unwrap().to_string_lossy());
        }
        Ok(())
    }
    
    walk_recursive(Path::new(path), 0)
}
```

---

## 12.2 Path Handling and PathBuf

Cross-platform path handling is crucial. Windows uses `\` while Unix uses `/`. Rust's `Path` and `PathBuf` abstract these differences.

### Path vs PathBuf: The String vs String Analogy

```rust
use std::path::{Path, PathBuf};

// Path is like &str (borrowed, immutable)
fn take_path(path: &Path) {
    println!("Path: {}", path.display());
}

// PathBuf is like String (owned, mutable)
fn create_pathbuf() -> PathBuf {
    let mut path = PathBuf::from("C:\\Users");
    path.push("Documents");
    path.push("app_data");
    path
}

fn path_basics() {
    // Creating paths
    let path1 = Path::new("/home/user/file.txt");
    let path2 = PathBuf::from("C:\\Users\\User\\file.txt");
    
    // Converting between them
    let path_ref: &Path = &path2;  // PathBuf -> &Path
    let path_owned: PathBuf = path1.to_path_buf();  // &Path -> PathBuf
}
```

### Path Components and Manipulation

```rust
use std::path::{Path, PathBuf};

fn analyze_path(path: &Path) {
    // Get file name
    if let Some(file_name) = path.file_name() {
        println!("File name: {:?}", file_name);
    }
    
    // Get file stem (name without extension)
    if let Some(stem) = path.file_stem() {
        println!("Stem: {:?}", stem);
    }
    
    // Get extension
    if let Some(ext) = path.extension() {
        println!("Extension: {:?}", ext);
    }
    
    // Get parent directory
    if let Some(parent) = path.parent() {
        println!("Parent: {:?}", parent);
    }
    
    // Check if absolute or relative
    println!("Is absolute: {}", path.is_absolute());
    println!("Is relative: {}", path.is_relative());
}

fn path_manipulation() {
    let path = Path::new("/home/user/documents/file.txt");
    
    analyze_path(path);
    // Output:
    // File name: "file.txt"
    // Stem: "file"
    // Extension: "txt"
    // Parent: "/home/user/documents"
    // Is absolute: true
    // Is relative: false
}
```

### Building Paths Safely

```rust
use std::path::PathBuf;

fn build_data_path(app_name: &str, file_name: &str) -> PathBuf {
    let mut path = PathBuf::new();
    
    // Platform-specific app data directory
    #[cfg(target_os = "windows")]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            path.push(app_data);
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            path.push(home);
            path.push("Library");
            path.push("Application Support");
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            path.push(home);
            path.push(".local");
            path.push("share");
        }
    }
    
    path.push(app_name);
    path.push(file_name);
    path
}

// Usage
fn example() {
    let config_path = build_data_path("MyApp", "config.json");
    println!("Config will be at: {}", config_path.display());
    // Windows: C:\Users\Username\AppData\Roaming\MyApp\config.json
    // macOS: /Users/username/Library/Application Support/MyApp/config.json
    // Linux: /home/username/.local/share/MyApp/config.json
}
```

### Path Joining and Normalization

```rust
use std::path::PathBuf;

fn path_joining() {
    // The join method is safer than string concatenation
    let base = PathBuf::from("C:\\Users\\User");
    let full = base.join("Documents").join("file.txt");
    println!("{}", full.display());
    // Output: C:\Users\User\Documents\file.txt
    
    // Push modifies in place
    let mut path = PathBuf::from("/home/user");
    path.push("documents");
    path.push("file.txt");
    println!("{}", path.display());
    // Output: /home/user/documents/file.txt
    
    // Pop removes last component
    path.pop();
    println!("{}", path.display());
    // Output: /home/user/documents
}

// Canonicalize converts to absolute path and resolves symlinks
fn normalize_path(path: &str) -> std::io::Result<PathBuf> {
    use std::path::Path;
    Path::new(path).canonicalize()
}
```

### Converting Paths to Strings

```rust
use std::path::Path;

fn path_to_string_conversions(path: &Path) {
    // For display purposes (lossy conversion)
    println!("Display: {}", path.display());
    
    // To &str (might fail with invalid UTF-8)
    if let Some(s) = path.to_str() {
        println!("As str: {}", s);
    } else {
        println!("Path contains invalid UTF-8");
    }
    
    // To String (lossy, replaces invalid UTF-8)
    let s = path.to_string_lossy();
    println!("Lossy: {}", s);
    
    // To OsString (preserves all bytes)
    let os_string = path.as_os_str().to_os_string();
}
```

---

## 12.3 CSV File Operations

CSV is a simple, human-readable format perfect for storing tabular data. QuickConnect uses it for the hosts list.

### Adding the csv Crate

```toml
# Cargo.toml
[dependencies]
csv = "1.3"
serde = { version = "1.0", features = ["derive"] }
```

### Reading CSV Files

```rust
use serde::Deserialize;
use std::error::Error;

#[derive(Debug, Deserialize)]
struct Host {
    name: String,
    address: String,
    username: String,
    #[serde(default)]  // Use default value if missing
    group: String,
}

fn read_hosts_csv(path: &str) -> Result<Vec<Host>, Box<dyn Error>> {
    let mut reader = csv::Reader::from_path(path)?;
    let mut hosts = Vec::new();
    
    for result in reader.deserialize() {
        let host: Host = result?;
        hosts.push(host);
    }
    
    Ok(hosts)
}

// Alternative: collect directly
fn read_hosts_csv_collect(path: &str) -> Result<Vec<Host>, Box<dyn Error>> {
    let mut reader = csv::Reader::from_path(path)?;
    
    reader
        .deserialize()
        .collect::<Result<Vec<Host>, csv::Error>>()
        .map_err(|e| e.into())
}
```

### Writing CSV Files

```rust
use serde::Serialize;
use std::error::Error;

#[derive(Debug, Serialize)]
struct Host {
    name: String,
    address: String,
    username: String,
    group: String,
}

fn write_hosts_csv(path: &str, hosts: &[Host]) -> Result<(), Box<dyn Error>> {
    let mut writer = csv::Writer::from_path(path)?;
    
    for host in hosts {
        writer.serialize(host)?;
    }
    
    writer.flush()?;
    Ok(())
}

// Writing with custom delimiter
fn write_tsv(path: &str, hosts: &[Host]) -> Result<(), Box<dyn Error>> {
    let mut writer = csv::WriterBuilder::new()
        .delimiter(b'\t')
        .from_path(path)?;
    
    for host in hosts {
        writer.serialize(host)?;
    }
    
    writer.flush()?;
    Ok(())
}
```

### Handling Missing or Optional Fields

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
struct Host {
    name: String,
    address: String,
    
    // Optional field (empty string becomes None)
    #[serde(default, deserialize_with = "deserialize_empty_string")]
    username: Option<String>,
    
    // Field with default value
    #[serde(default = "default_port")]
    port: u16,
    
    // Skip if empty when serializing
    #[serde(skip_serializing_if = "String::is_empty", default)]
    group: String,
}

fn default_port() -> u16 {
    3389
}

fn deserialize_empty_string<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    if s.is_empty() {
        Ok(None)
    } else {
        Ok(Some(s))
    }
}
```

### CSV with Headers

```rust
use csv::StringRecord;
use std::error::Error;

fn read_csv_with_headers(path: &str) -> Result<(), Box<dyn Error>> {
    let mut reader = csv::Reader::from_path(path)?;
    
    // Get headers
    let headers = reader.headers()?.clone();
    println!("Headers: {:?}", headers);
    
    // Read records
    for result in reader.records() {
        let record = result?;
        
        // Access by index
        if let Some(field) = record.get(0) {
            println!("First field: {}", field);
        }
        
        // Iterate over fields
        for (i, field) in record.iter().enumerate() {
            println!("  Column {}: {}", i, field);
        }
    }
    
    Ok(())
}

// Writing with custom headers
fn write_csv_custom_headers(path: &str) -> Result<(), Box<dyn Error>> {
    let mut writer = csv::Writer::from_path(path)?;
    
    // Write custom headers
    writer.write_record(&["Name", "IP Address", "User", "Category"])?;
    
    // Write data
    writer.write_record(&["Server1", "192.168.1.10", "admin", "Production"])?;
    writer.write_record(&["Server2", "192.168.1.11", "user", "Development"])?;
    
    writer.flush()?;
    Ok(())
}
```

---

## 12.4 JSON Serialization with serde

JSON is more flexible than CSV and supports nested structures. It's ideal for configuration files.

### Basic JSON Serialization

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::error::Error;

#[derive(Debug, Serialize, Deserialize)]
struct AppConfig {
    window_width: u32,
    window_height: u32,
    theme: String,
    recent_connections: Vec<String>,
    settings: Settings,
}

#[derive(Debug, Serialize, Deserialize)]
struct Settings {
    auto_start: bool,
    check_updates: bool,
    log_level: String,
}

// Writing JSON
fn save_config(path: &str, config: &AppConfig) -> Result<(), Box<dyn Error>> {
    let json = serde_json::to_string_pretty(config)?;
    fs::write(path, json)?;
    Ok(())
}

// Reading JSON
fn load_config(path: &str) -> Result<AppConfig, Box<dyn Error>> {
    let json = fs::read_to_string(path)?;
    let config = serde_json::from_str(&json)?;
    Ok(config)
}

// Example usage
fn example() -> Result<(), Box<dyn Error>> {
    let config = AppConfig {
        window_width: 800,
        window_height: 600,
        theme: "dark".to_string(),
        recent_connections: vec![
            "server1.example.com".to_string(),
            "server2.example.com".to_string(),
        ],
        settings: Settings {
            auto_start: true,
            check_updates: true,
            log_level: "info".to_string(),
        },
    };
    
    save_config("config.json", &config)?;
    
    let loaded = load_config("config.json")?;
    println!("Loaded config: {:#?}", loaded);
    
    Ok(())
}
```

### Handling Missing Fields with Defaults

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Config {
    // Required field
    app_name: String,
    
    // Optional field (None if missing)
    #[serde(default)]
    theme: Option<String>,
    
    // Field with default value
    #[serde(default = "default_timeout")]
    timeout: u64,
    
    // Field with Default trait implementation
    #[serde(default)]
    retries: u32,
}

fn default_timeout() -> u64 {
    30
}

// This JSON works even with missing fields:
// {
//   "app_name": "MyApp"
// }
// theme will be None, timeout will be 30, retries will be 0
```

### Renaming Fields

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct User {
    // Rust uses snake_case, JSON uses camelCase
    #[serde(rename = "firstName")]
    first_name: String,
    
    #[serde(rename = "lastName")]
    last_name: String,
    
    #[serde(rename = "emailAddress")]
    email_address: String,
}

// JSON will look like:
// {
//   "firstName": "John",
//   "lastName": "Doe",
//   "emailAddress": "john@example.com"
// }
```

### Working with Dynamic JSON

```rust
use serde_json::{Value, json};
use std::error::Error;

fn dynamic_json_example() -> Result<(), Box<dyn Error>> {
    // Create JSON dynamically
    let data = json!({
        "name": "QuickConnect",
        "version": "1.0.0",
        "features": ["multi-window", "themes", "rdp"],
        "config": {
            "width": 800,
            "height": 600
        }
    });
    
    // Access nested values
    if let Some(name) = data["name"].as_str() {
        println!("App name: {}", name);
    }
    
    if let Some(width) = data["config"]["width"].as_u64() {
        println!("Width: {}", width);
    }
    
    // Iterate over array
    if let Some(features) = data["features"].as_array() {
        for feature in features {
            if let Some(f) = feature.as_str() {
                println!("Feature: {}", f);
            }
        }
    }
    
    // Convert to pretty string
    let json_string = serde_json::to_string_pretty(&data)?;
    println!("{}", json_string);
    
    Ok(())
}

// Parsing unknown JSON
fn parse_unknown_json(json_str: &str) -> Result<(), Box<dyn Error>> {
    let value: Value = serde_json::from_str(json_str)?;
    
    match value {
        Value::Object(map) => {
            for (key, val) in map {
                println!("{}: {:?}", key, val);
            }
        }
        Value::Array(arr) => {
            for item in arr {
                println!("{:?}", item);
            }
        }
        _ => println!("Other type: {:?}", value),
    }
    
    Ok(())
}
```

---

## 12.5 AppData Directory Patterns

Applications should store user data in platform-specific directories, not in the installation folder.

### Windows AppData Locations

```rust
use std::path::PathBuf;
use std::env;

fn get_app_data_dir() -> Option<PathBuf> {
    // APPDATA = C:\Users\Username\AppData\Roaming
    // For settings that roam with the user profile
    env::var("APPDATA").ok().map(PathBuf::from)
}

fn get_local_app_data_dir() -> Option<PathBuf> {
    // LOCALAPPDATA = C:\Users\Username\AppData\Local
    // For machine-specific data, caches
    env::var("LOCALAPPDATA").ok().map(PathBuf::from)
}

fn get_program_data_dir() -> Option<PathBuf> {
    // PROGRAMDATA = C:\ProgramData
    // For data shared between all users (requires admin rights)
    env::var("PROGRAMDATA").ok().map(PathBuf::from)
}
```

### Cross-Platform Directory Discovery

```rust
use std::path::PathBuf;

fn get_app_config_dir(app_name: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|path| PathBuf::from(path).join(app_name))
    }
    
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .ok()
            .map(|path| {
                PathBuf::from(path)
                    .join("Library")
                    .join("Application Support")
                    .join(app_name)
            })
    }
    
    #[cfg(target_os = "linux")]
    {
        // Try XDG_CONFIG_HOME first, fallback to ~/.config
        std::env::var("XDG_CONFIG_HOME")
            .ok()
            .map(|path| PathBuf::from(path).join(app_name))
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|path| PathBuf::from(path).join(".config").join(app_name))
            })
    }
}

fn get_app_data_dir(app_name: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|path| PathBuf::from(path).join(app_name))
    }
    
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .ok()
            .map(|path| {
                PathBuf::from(path)
                    .join("Library")
                    .join("Application Support")
                    .join(app_name)
            })
    }
    
    #[cfg(target_os = "linux")]
    {
        // Try XDG_DATA_HOME first, fallback to ~/.local/share
        std::env::var("XDG_DATA_HOME")
            .ok()
            .map(|path| PathBuf::from(path).join(app_name))
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|path| {
                        PathBuf::from(path)
                            .join(".local")
                            .join("share")
                            .join(app_name)
                    })
            })
    }
}
```

### Creating Application Directories

```rust
use std::fs;
use std::path::PathBuf;
use std::io;

struct AppDirs {
    config: PathBuf,
    data: PathBuf,
    cache: PathBuf,
    logs: PathBuf,
}

impl AppDirs {
    fn new(app_name: &str) -> io::Result<Self> {
        let base = get_app_data_dir(app_name)
            .ok_or_else(|| io::Error::new(
                io::ErrorKind::NotFound,
                "Could not determine app data directory"
            ))?;
        
        let config = base.join("config");
        let data = base.join("data");
        let cache = base.join("cache");
        let logs = base.join("logs");
        
        // Create all directories
        fs::create_dir_all(&config)?;
        fs::create_dir_all(&data)?;
        fs::create_dir_all(&cache)?;
        fs::create_dir_all(&logs)?;
        
        Ok(AppDirs {
            config,
            data,
            cache,
            logs,
        })
    }
    
    fn config_file(&self, name: &str) -> PathBuf {
        self.config.join(name)
    }
    
    fn data_file(&self, name: &str) -> PathBuf {
        self.data.join(name)
    }
    
    fn log_file(&self, name: &str) -> PathBuf {
        self.logs.join(name)
    }
}

// Usage
fn example() -> io::Result<()> {
    let dirs = AppDirs::new("QuickConnect")?;
    
    let config_path = dirs.config_file("settings.json");
    let hosts_path = dirs.data_file("hosts.csv");
    let log_path = dirs.log_file("app.log");
    
    println!("Config: {}", config_path.display());
    println!("Hosts: {}", hosts_path.display());
    println!("Log: {}", log_path.display());
    
    Ok(())
}
```

---

## 12.6 Error Handling for File Operations

File operations can fail in many ways: file not found, permission denied, disk full, etc.

### Common File Errors

```rust
use std::fs;
use std::io::{self, ErrorKind};

fn handle_file_errors(path: &str) -> io::Result<String> {
    match fs::read_to_string(path) {
        Ok(content) => Ok(content),
        Err(e) => match e.kind() {
            ErrorKind::NotFound => {
                println!("File not found: {}", path);
                // Maybe create with defaults?
                Err(e)
            }
            ErrorKind::PermissionDenied => {
                println!("Permission denied: {}", path);
                Err(e)
            }
            ErrorKind::InvalidData => {
                println!("File contains invalid data");
                Err(e)
            }
            _ => {
                println!("Unexpected error: {}", e);
                Err(e)
            }
        }
    }
}
```

### Creating Files with Defaults

```rust
use std::fs;
use std::io::{self, ErrorKind};
use std::path::Path;

fn read_or_create_config(path: &Path) -> io::Result<String> {
    match fs::read_to_string(path) {
        Ok(content) => Ok(content),
        Err(e) if e.kind() == ErrorKind::NotFound => {
            // Create with default content
            let default_config = r#"{
    "theme": "light",
    "window_width": 800,
    "window_height": 600
}"#;
            
            // Create parent directories if needed
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            
            fs::write(path, default_config)?;
            Ok(default_config.to_string())
        }
        Err(e) => Err(e),
    }
}
```

### Custom Error Types for Better Context

```rust
use std::fmt;
use std::io;

#[derive(Debug)]
enum DataError {
    IoError(io::Error),
    ParseError(String),
    ValidationError(String),
}

impl fmt::Display for DataError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            DataError::IoError(e) => write!(f, "IO error: {}", e),
            DataError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            DataError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl std::error::Error for DataError {}

impl From<io::Error> for DataError {
    fn from(error: io::Error) -> Self {
        DataError::IoError(error)
    }
}

impl From<csv::Error> for DataError {
    fn from(error: csv::Error) -> Self {
        DataError::ParseError(error.to_string())
    }
}

// Usage
fn load_and_validate_hosts(path: &str) -> Result<Vec<Host>, DataError> {
    let hosts = read_hosts_csv(path)?;
    
    // Validate
    for host in &hosts {
        if host.address.is_empty() {
            return Err(DataError::ValidationError(
                format!("Host '{}' has no address", host.name)
            ));
        }
    }
    
    Ok(hosts)
}
```

### Atomic File Writes

Writing to a file can fail midway, corrupting it. Use atomic writes for critical data.

```rust
use std::fs;
use std::io::{self, Write};
use std::path::Path;

fn write_file_atomic(path: &Path, content: &str) -> io::Result<()> {
    // Write to temporary file first
    let temp_path = path.with_extension("tmp");
    
    {
        let mut file = fs::File::create(&temp_path)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?;  // Ensure data is written to disk
    }
    
    // Rename is atomic on most filesystems
    fs::rename(&temp_path, path)?;
    
    Ok(())
}

// Usage for JSON config
fn save_config_atomic(path: &Path, config: &AppConfig) -> Result<(), Box<dyn std::error::Error>> {
    let json = serde_json::to_string_pretty(config)?;
    write_file_atomic(path, &json)?;
    Ok(())
}
```

---

## 12.7 File Watching and Updates

Sometimes you need to react when files change on disk.

### Manual Polling Approach

```rust
use std::fs;
use std::time::SystemTime;
use std::path::Path;

struct FileWatcher {
    path: String,
    last_modified: Option<SystemTime>,
}

impl FileWatcher {
    fn new(path: String) -> Self {
        FileWatcher {
            path,
            last_modified: None,
        }
    }
    
    fn check_for_changes(&mut self) -> bool {
        let path = Path::new(&self.path);
        
        if let Ok(metadata) = fs::metadata(path) {
            if let Ok(modified) = metadata.modified() {
                if let Some(last) = self.last_modified {
                    if modified > last {
                        self.last_modified = Some(modified);
                        return true;
                    }
                } else {
                    // First time
                    self.last_modified = Some(modified);
                }
            }
        }
        
        false
    }
}

// Usage
fn example() {
    use std::thread;
    use std::time::Duration;
    
    let mut watcher = FileWatcher::new("hosts.csv".to_string());
    
    loop {
        if watcher.check_for_changes() {
            println!("File changed! Reloading...");
            // Reload your data
        }
        
        thread::sleep(Duration::from_secs(5));
    }
}
```

### Using notify Crate (Advanced)

For production use, the `notify` crate provides efficient file watching.

```toml
[dependencies]
notify = "6.0"
```

```rust
use notify::{Watcher, RecursiveMode, Result as NotifyResult};
use std::path::Path;
use std::sync::mpsc::channel;

fn watch_file(path: &str) -> NotifyResult<()> {
    let (tx, rx) = channel();
    
    let mut watcher = notify::recommended_watcher(tx)?;
    
    // Watch the file
    watcher.watch(Path::new(path), RecursiveMode::NonRecursive)?;
    
    println!("Watching for changes...");
    
    for res in rx {
        match res {
            Ok(event) => {
                println!("File changed: {:?}", event);
                // Reload your data here
            }
            Err(e) => println!("Watch error: {:?}", e),
        }
    }
    
    Ok(())
}
```

---

## 12.8 QuickConnect hosts.csv Implementation

Let's analyze how QuickConnect implements its host persistence layer.

### The Host Structure

```rust
// From QuickConnect src-tauri/src/lib.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Host {
    pub name: String,
    pub address: String,
    pub username: String,
    #[serde(default)]
    pub group: String,
}
```

**Key Design Decisions:**
- Simple flat structure (no nested objects)
- `#[serde(default)]` on group means it's optional in CSV
- All fields are owned `String` (not `&str`) for easy manipulation
- `Clone` allows easy copying of host data
- `Debug` for development/logging

### Getting the Hosts File Path

```rust
use std::path::PathBuf;

fn get_hosts_file_path() -> Option<PathBuf> {
    std::env::var("APPDATA")
        .ok()
        .map(|appdata| {
            let mut path = PathBuf::from(appdata);
            path.push("QuickConnect");
            path.push("hosts.csv");
            path
        })
}
```

**Why APPDATA?**
- User-specific data that roams with Windows profiles
- No admin rights required
- Survives application updates
- Standard Windows practice

### Reading Hosts

```rust
use csv::Reader;
use std::fs::File;
use std::io;

fn read_hosts() -> Result<Vec<Host>, Box<dyn std::error::Error>> {
    let path = get_hosts_file_path()
        .ok_or("Could not determine hosts file path")?;
    
    // File not existing is not an error - return empty list
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let file = File::open(&path)?;
    let mut reader = Reader::from_reader(file);
    
    let mut hosts = Vec::new();
    for result in reader.deserialize() {
        match result {
            Ok(host) => hosts.push(host),
            Err(e) => {
                // Log error but continue with other hosts
                eprintln!("Failed to parse host: {}", e);
            }
        }
    }
    
    Ok(hosts)
}
```

**Error Handling Strategy:**
- Missing file returns empty list (not an error)
- Individual parse errors are logged but don't stop loading
- Critical errors (no permission, corrupted file) are returned

### Writing Hosts

```rust
use csv::Writer;
use std::fs::{create_dir_all, File};

fn write_hosts(hosts: &[Host]) -> Result<(), Box<dyn std::error::Error>> {
    let path = get_hosts_file_path()
        .ok_or("Could not determine hosts file path")?;
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        create_dir_all(parent)?;
    }
    
    let file = File::create(&path)?;
    let mut writer = Writer::from_writer(file);
    
    for host in hosts {
        writer.serialize(host)?;
    }
    
    writer.flush()?;
    Ok(())
}
```

**Important Details:**
- `create_dir_all` ensures `C:\Users\User\AppData\Roaming\QuickConnect` exists
- `serialize` writes headers automatically on first write
- `flush` ensures data is written before function returns

### Tauri Commands

```rust
#[tauri::command]
async fn get_hosts() -> Result<Vec<Host>, String> {
    read_hosts().map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_host(host: Host) -> Result<(), String> {
    let mut hosts = read_hosts().map_err(|e| e.to_string())?;
    
    // Update if exists, add if new
    if let Some(existing) = hosts.iter_mut().find(|h| h.name == host.name) {
        *existing = host;
    } else {
        hosts.push(host);
    }
    
    write_hosts(&hosts).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_host(name: String) -> Result<(), String> {
    let mut hosts = read_hosts().map_err(|e| e.to_string())?;
    hosts.retain(|h| h.name != name);
    write_hosts(&hosts).map_err(|e| e.to_string())
}
```

### Complete Example: Host Manager

Here's a complete, production-ready host management module:

```rust
use csv::{Reader, Writer};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs::{create_dir_all, File};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Host {
    pub name: String,
    pub address: String,
    pub username: String,
    #[serde(default)]
    pub group: String,
}

pub struct HostManager {
    file_path: PathBuf,
}

impl HostManager {
    pub fn new() -> Result<Self, Box<dyn Error>> {
        let file_path = std::env::var("APPDATA")
            .map(|appdata| {
                PathBuf::from(appdata)
                    .join("QuickConnect")
                    .join("hosts.csv")
            })
            .ok_or("Could not determine APPDATA directory")?;
        
        // Ensure directory exists
        if let Some(parent) = file_path.parent() {
            create_dir_all(parent)?;
        }
        
        Ok(HostManager { file_path })
    }
    
    pub fn load(&self) -> Result<Vec<Host>, Box<dyn Error>> {
        if !self.file_path.exists() {
            return Ok(Vec::new());
        }
        
        let file = File::open(&self.file_path)?;
        let mut reader = Reader::from_reader(file);
        
        let mut hosts = Vec::new();
        for result in reader.deserialize() {
            match result {
                Ok(host) => hosts.push(host),
                Err(e) => eprintln!("Failed to parse host: {}", e),
            }
        }
        
        Ok(hosts)
    }
    
    pub fn save(&self, hosts: &[Host]) -> Result<(), Box<dyn Error>> {
        let file = File::create(&self.file_path)?;
        let mut writer = Writer::from_writer(file);
        
        for host in hosts {
            writer.serialize(host)?;
        }
        
        writer.flush()?;
        Ok(())
    }
    
    pub fn add_host(&self, host: Host) -> Result<(), Box<dyn Error>> {
        let mut hosts = self.load()?;
        
        // Check for duplicates
        if hosts.iter().any(|h| h.name == host.name) {
            return Err("Host with this name already exists".into());
        }
        
        hosts.push(host);
        self.save(&hosts)
    }
    
    pub fn update_host(&self, name: &str, updated: Host) -> Result<(), Box<dyn Error>> {
        let mut hosts = self.load()?;
        
        let host = hosts
            .iter_mut()
            .find(|h| h.name == name)
            .ok_or("Host not found")?;
        
        *host = updated;
        self.save(&hosts)
    }
    
    pub fn delete_host(&self, name: &str) -> Result<(), Box<dyn Error>> {
        let mut hosts = self.load()?;
        let original_len = hosts.len();
        
        hosts.retain(|h| h.name != name);
        
        if hosts.len() == original_len {
            return Err("Host not found".into());
        }
        
        self.save(&hosts)
    }
    
    pub fn get_host(&self, name: &str) -> Result<Option<Host>, Box<dyn Error>> {
        let hosts = self.load()?;
        Ok(hosts.into_iter().find(|h| h.name == name))
    }
    
    pub fn get_hosts_by_group(&self, group: &str) -> Result<Vec<Host>, Box<dyn Error>> {
        let hosts = self.load()?;
        Ok(hosts.into_iter().filter(|h| h.group == group).collect())
    }
}

// Tauri commands using the manager
#[tauri::command]
async fn get_all_hosts() -> Result<Vec<Host>, String> {
    let manager = HostManager::new().map_err(|e| e.to_string())?;
    manager.load().map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_new_host(host: Host) -> Result<(), String> {
    let manager = HostManager::new().map_err(|e| e.to_string())?;
    manager.add_host(host).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_existing_host(name: String, host: Host) -> Result<(), String> {
    let manager = HostManager::new().map_err(|e| e.to_string())?;
    manager.update_host(&name, host).map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_host(name: String) -> Result<(), String> {
    let manager = HostManager::new().map_err(|e| e.to_string())?;
    manager.delete_host(&name).map_err(|e| e.to_string())
}
```

---

## 12.9 Key Takeaways

1. **Use `std::fs` for basic operations** - It's simple and synchronous, perfect for most file I/O
2. **PathBuf for platform independence** - Never concatenate path strings manually
3. **CSV for tabular data** - Perfect for simple, human-readable data storage
4. **JSON for complex config** - Better for nested structures and flexibility
5. **AppData for user data** - Store user files in `%APPDATA%`, not installation folder
6. **Handle missing files gracefully** - Not existing often isn't an error
7. **Atomic writes for critical data** - Write to temp file, then rename
8. **Create directories proactively** - Use `create_dir_all` to ensure paths exist

---

## 12.10 Practice Exercises

### Exercise 1: Contact Manager

Build a simple contact manager that stores contacts in CSV format.

```rust
#[derive(Debug, Serialize, Deserialize)]
struct Contact {
    name: String,
    email: String,
    phone: String,
    notes: String,
}

// Implement these functions:
// 1. Load contacts from CSV
// 2. Save contacts to CSV
// 3. Add a new contact
// 4. Search contacts by name
// 5. Delete a contact by email
```

**Solution:**

```rust
use csv::{Reader, Writer};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs::File;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Contact {
    name: String,
    email: String,
    phone: String,
    notes: String,
}

fn load_contacts(path: &Path) -> Result<Vec<Contact>, Box<dyn Error>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let file = File::open(path)?;
    let mut reader = Reader::from_reader(file);
    
    let contacts: Result<Vec<Contact>, csv::Error> = reader
        .deserialize()
        .collect();
    
    Ok(contacts?)
}

fn save_contacts(path: &Path, contacts: &[Contact]) -> Result<(), Box<dyn Error>> {
    let file = File::create(path)?;
    let mut writer = Writer::from_writer(file);
    
    for contact in contacts {
        writer.serialize(contact)?;
    }
    
    writer.flush()?;
    Ok(())
}

fn add_contact(path: &Path, contact: Contact) -> Result<(), Box<dyn Error>> {
    let mut contacts = load_contacts(path)?;
    
    // Check for duplicate email
    if contacts.iter().any(|c| c.email == contact.email) {
        return Err("Contact with this email already exists".into());
    }
    
    contacts.push(contact);
    save_contacts(path, &contacts)
}

fn search_by_name(path: &Path, name: &str) -> Result<Vec<Contact>, Box<dyn Error>> {
    let contacts = load_contacts(path)?;
    let name_lower = name.to_lowercase();
    
    Ok(contacts
        .into_iter()
        .filter(|c| c.name.to_lowercase().contains(&name_lower))
        .collect())
}

fn delete_by_email(path: &Path, email: &str) -> Result<(), Box<dyn Error>> {
    let mut contacts = load_contacts(path)?;
    let original_len = contacts.len();
    
    contacts.retain(|c| c.email != email);
    
    if contacts.len() == original_len {
        return Err("Contact not found".into());
    }
    
    save_contacts(path, &contacts)
}

// Test it
fn main() -> Result<(), Box<dyn Error>> {
    let path = Path::new("contacts.csv");
    
    // Add contacts
    add_contact(path, Contact {
        name: "Alice Smith".to_string(),
        email: "alice@example.com".to_string(),
        phone: "555-0101".to_string(),
        notes: "Friend from college".to_string(),
    })?;
    
    add_contact(path, Contact {
        name: "Bob Jones".to_string(),
        email: "bob@example.com".to_string(),
        phone: "555-0102".to_string(),
        notes: "Coworker".to_string(),
    })?;
    
    // Search
    let results = search_by_name(path, "alice")?;
    println!("Found {} contacts", results.len());
    
    // Delete
    delete_by_email(path, "bob@example.com")?;
    
    // List all
    let all = load_contacts(path)?;
    println!("Remaining contacts:");
    for contact in all {
        println!("  {} - {}", contact.name, contact.email);
    }
    
    Ok(())
}
```

### Exercise 2: Application Settings

Create a settings system with JSON that includes defaults and validation.

```rust
#[derive(Debug, Serialize, Deserialize)]
struct AppSettings {
    window_width: u32,
    window_height: u32,
    theme: String,  // "light" or "dark"
    auto_start: bool,
    update_check_interval: u32,  // hours
}

// Implement:
// 1. Load settings (with defaults if file doesn't exist)
// 2. Save settings
// 3. Validate settings (width/height > 0, valid theme, etc.)
// 4. Reset to defaults
```

**Solution:**

```rust
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AppSettings {
    window_width: u32,
    window_height: u32,
    theme: String,
    auto_start: bool,
    update_check_interval: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            window_width: 800,
            window_height: 600,
            theme: "light".to_string(),
            auto_start: false,
            update_check_interval: 24,
        }
    }
}

impl AppSettings {
    fn validate(&self) -> Result<(), String> {
        if self.window_width < 400 {
            return Err("Window width must be at least 400".to_string());
        }
        if self.window_height < 300 {
            return Err("Window height must be at least 300".to_string());
        }
        if self.theme != "light" && self.theme != "dark" {
            return Err("Theme must be 'light' or 'dark'".to_string());
        }
        if self.update_check_interval == 0 {
            return Err("Update check interval must be > 0".to_string());
        }
        Ok(())
    }
}

struct SettingsManager {
    path: PathBuf,
}

impl SettingsManager {
    fn new(app_name: &str) -> Result<Self, Box<dyn Error>> {
        let path = std::env::var("APPDATA")
            .map(|appdata| {
                PathBuf::from(appdata)
                    .join(app_name)
                    .join("settings.json")
            })
            .ok_or("Could not determine APPDATA")?;
        
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        Ok(SettingsManager { path })
    }
    
    fn load(&self) -> Result<AppSettings, Box<dyn Error>> {
        if !self.path.exists() {
            // Return defaults if file doesn't exist
            return Ok(AppSettings::default());
        }
        
        let json = fs::read_to_string(&self.path)?;
        let settings: AppSettings = serde_json::from_str(&json)?;
        
        // Validate
        settings.validate().map_err(|e| e)?;
        
        Ok(settings)
    }
    
    fn save(&self, settings: &AppSettings) -> Result<(), Box<dyn Error>> {
        // Validate before saving
        settings.validate().map_err(|e| e)?;
        
        let json = serde_json::to_string_pretty(settings)?;
        
        // Atomic write
        let temp_path = self.path.with_extension("tmp");
        fs::write(&temp_path, json)?;
        fs::rename(&temp_path, &self.path)?;
        
        Ok(())
    }
    
    fn reset_to_defaults(&self) -> Result<(), Box<dyn Error>> {
        let defaults = AppSettings::default();
        self.save(&defaults)
    }
}

// Tauri commands
#[tauri::command]
async fn get_settings() -> Result<AppSettings, String> {
    let manager = SettingsManager::new("MyApp").map_err(|e| e.to_string())?;
    manager.load().map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_settings(settings: AppSettings) -> Result<(), String> {
    let manager = SettingsManager::new("MyApp").map_err(|e| e.to_string())?;
    manager.save(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
async fn reset_settings() -> Result<(), String> {
    let manager = SettingsManager::new("MyApp").map_err(|e| e.to_string())?;
    manager.reset_to_defaults().map_err(|e| e.to_string())
}
```

### Exercise 3: File Backup System

Create a backup system that maintains multiple versions of a file.

```rust
// Requirements:
// 1. Keep last N backups (e.g., 5)
// 2. Name backups with timestamps
// 3. Restore from specific backup
// 4. Clean up old backups
```

**Solution:**

```rust
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Local;

struct BackupManager {
    backup_dir: PathBuf,
    max_backups: usize,
}

impl BackupManager {
    fn new(file_path: &Path, max_backups: usize) -> Result<Self, Box<dyn Error>> {
        let backup_dir = file_path.parent()
            .ok_or("Invalid file path")?
            .join("backups");
        
        fs::create_dir_all(&backup_dir)?;
        
        Ok(BackupManager {
            backup_dir,
            max_backups,
        })
    }
    
    fn create_backup(&self, file_path: &Path) -> Result<PathBuf, Box<dyn Error>> {
        if !file_path.exists() {
            return Err("File to backup doesn't exist".into());
        }
        
        let file_name = file_path.file_name()
            .ok_or("Invalid file name")?
            .to_string_lossy();
        
        let timestamp = Local::now().format("%Y%m%d_%H%M%S");
        let backup_name = format!("{}_{}", timestamp, file_name);
        let backup_path = self.backup_dir.join(backup_name);
        
        fs::copy(file_path, &backup_path)?;
        
        // Clean up old backups
        self.cleanup_old_backups(&file_name)?;
        
        Ok(backup_path)
    }
    
    fn list_backups(&self, file_name: &str) -> Result<Vec<PathBuf>, Box<dyn Error>> {
        let mut backups: Vec<PathBuf> = fs::read_dir(&self.backup_dir)?
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.ends_with(file_name))
                    .unwrap_or(false)
            })
            .collect();
        
        // Sort by modification time (newest first)
        backups.sort_by(|a, b| {
            let a_time = fs::metadata(a).and_then(|m| m.modified()).ok();
            let b_time = fs::metadata(b).and_then(|m| m.modified()).ok();
            b_time.cmp(&a_time)
        });
        
        Ok(backups)
    }
    
    fn cleanup_old_backups(&self, file_name: &str) -> Result<(), Box<dyn Error>> {
        let backups = self.list_backups(file_name)?;
        
        // Remove old backups beyond max_backups
        for backup in backups.iter().skip(self.max_backups) {
            fs::remove_file(backup)?;
            println!("Removed old backup: {}", backup.display());
        }
        
        Ok(())
    }
    
    fn restore_backup(&self, backup_path: &Path, target_path: &Path) -> Result<(), Box<dyn Error>> {
        if !backup_path.exists() {
            return Err("Backup file doesn't exist".into());
        }
        
        // Create backup of current file before restoring
        if target_path.exists() {
            let pre_restore_backup = target_path.with_extension("pre-restore");
            fs::copy(target_path, &pre_restore_backup)?;
        }
        
        fs::copy(backup_path, target_path)?;
        Ok(())
    }
}

// Example usage
fn main() -> Result<(), Box<dyn Error>> {
    let file_path = Path::new("data.csv");
    let manager = BackupManager::new(file_path, 5)?;
    
    // Create backup
    let backup_path = manager.create_backup(file_path)?;
    println!("Created backup: {}", backup_path.display());
    
    // List backups
    let backups = manager.list_backups("data.csv")?;
    println!("Available backups:");
    for (i, backup) in backups.iter().enumerate() {
        println!("  {}. {}", i + 1, backup.display());
    }
    
    // Restore from backup (example)
    if let Some(latest) = backups.first() {
        manager.restore_backup(latest, file_path)?;
        println!("Restored from: {}", latest.display());
    }
    
    Ok(())
}
```

---

## Summary

In this chapter, you've learned:

✅ **File Operations** - Reading, writing, copying, and deleting files with `std::fs`  
✅ **Path Handling** - Platform-independent path manipulation with `Path` and `PathBuf`  
✅ **CSV Serialization** - Using the csv crate for tabular data  
✅ **JSON Configuration** - Flexible config files with serde_json  
✅ **AppData Directories** - Storing user data in the correct platform locations  
✅ **Error Handling** - Graceful handling of file operation failures  
✅ **QuickConnect Analysis** - Real-world implementation patterns  
✅ **Production Patterns** - Atomic writes, backups, and validation

File I/O is fundamental to most applications. The patterns you've learned here - especially the host manager example - form the foundation for any data persistence needs in your Tauri applications.

In the next chapter, we'll explore **Windows Credential Manager** for securely storing passwords and sensitive data.

---

**Next Chapter:** [Chapter 13: Windows Credential Manager →](Chapter_13_Windows_Credential_Manager.md)  
**Previous Chapter:** [← Chapter 11: Windows API Integration](Chapter_11_Windows_API_Integration.md)

**Estimated Reading Time:** 90 minutes  
**Hands-on Exercises:** 45 minutes  
**Total Chapter Time:** 2 hours 15 minutes

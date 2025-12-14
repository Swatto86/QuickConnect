# Chapter 1: Introduction to Rust Programming

## Learning Objectives

By the end of this chapter, you will:
- Understand why Rust is ideal for desktop applications
- Write basic Rust programs with variables, functions, and control flow
- Grasp Rust's ownership system and why it matters
- Work with structs and enums to model data
- Handle errors using Result<T, E>
- Use common collections like Vec and HashMap
- Be ready to start building with Tauri

---

## 1.1 Why Rust for Desktop Applications?

When building desktop applications, you need a language that offers:

- **Performance**: Native speed without garbage collection overhead
- **Safety**: Memory safety without runtime costs
- **Reliability**: Catch bugs at compile time, not in production
- **Concurrency**: Fearless concurrent programming
- **Modern tooling**: Excellent package manager (Cargo) and ecosystem

### The Problem with Traditional Approaches

**C/C++**: Fast but prone to memory bugs, buffer overflows, and undefined behavior.
```cpp
// C++ - Easy to write, easy to crash
char* data = new char[100];
// ... forgot to delete? Memory leak!
// ... use after delete? Crash!
```

**JavaScript/Electron**: Easy to write but heavy on resources.
```
Simple Electron app: ~150MB memory
Equivalent Tauri app: ~15MB memory
```

**C#/.NET**: Good balance but requires runtime and is Windows-focused.

### Rust's Solution

Rust provides C++-level performance with compile-time memory safety guarantees:

```rust
// Rust - Safe by default
fn process_data() {
    let data = vec![1, 2, 3, 4, 5];
    // Compiler tracks ownership
    // Automatic cleanup when data goes out of scope
    // No possibility of use-after-free
} // data is automatically freed here
```

### QuickConnect's Choice

QuickConnect uses Rust because:
1. **Windows API Integration**: Safe FFI (Foreign Function Interface) to Windows APIs
2. **Performance**: Instant startup, minimal memory footprint
3. **Reliability**: Credential management requires zero tolerance for memory bugs
4. **Maintainability**: Refactoring is safe thanks to the type system

---

## 1.2 Rust Basics: Variables and Types

### Variables and Mutability

In Rust, variables are **immutable by default**:

```rust
fn main() {
    let x = 5;
    // x = 6;  // ❌ Error! Cannot mutate immutable variable
    println!("x = {}", x);
}
```

Use `mut` to make variables mutable:

```rust
fn main() {
    let mut count = 0;
    count += 1;  // ✅ OK
    println!("count = {}", count);
}
```

**Why immutable by default?**
- Prevents accidental mutations
- Makes concurrent code safer
- Easier to reason about program flow

### Basic Types

```rust
fn main() {
    // Integers
    let age: u32 = 25;           // Unsigned 32-bit
    let temperature: i32 = -10;   // Signed 32-bit
    
    // Floating point
    let price: f64 = 19.99;
    
    // Boolean
    let is_admin: bool = true;
    
    // Character (Unicode scalar value)
    let letter: char = 'A';
    
    // String types
    let name: String = String::from("QuickConnect");  // Owned string
    let greeting: &str = "Hello";                 // String slice (borrowed)
    
    println!("Name: {}, Age: {}", name, age);
}
```

### Type Inference

Rust can infer types in most cases:

```rust
fn main() {
    let count = 5;        // Inferred as i32
    let name = "Alice";   // Inferred as &str
    let items = vec![1, 2, 3];  // Inferred as Vec<i32>
}
```

### Constants

Constants are always immutable and must have explicit types:

```rust
const MAX_CONNECTIONS: u32 = 100;
const APP_NAME: &str = "QuickConnect";

fn main() {
    println!("Max connections: {}", MAX_CONNECTIONS);
}
```

**QuickConnect Example:**
```rust
// From QuickConnect - global state guarded by Mutex
// src-tauri/src/commands/windows.rs
pub static LAST_HIDDEN_WINDOW: Mutex<String> = Mutex::new(String::new());

// src-tauri/src/infra/logging.rs
static DEBUG_MODE: Mutex<bool> = Mutex::new(false);
```

---

## 1.3 Ownership and Borrowing Fundamentals

This is Rust's most unique and important concept. It's what makes Rust both safe and fast.

### The Three Rules of Ownership

1. Each value in Rust has a single owner
2. There can only be one owner at a time
3. When the owner goes out of scope, the value is dropped (freed)

### Ownership in Action

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;  // Ownership moved to s2
    
    // println!("{}", s1);  // ❌ Error! s1 is no longer valid
    println!("{}", s2);     // ✅ OK
}
```

Why does this happen? Because `String` owns heap data. Moving prevents double-free bugs.

### Copying vs Moving

Types that implement `Copy` (simple types stored entirely on the stack) are copied:

```rust
fn main() {
    let x = 5;
    let y = x;  // Copied, not moved
    
    println!("x = {}, y = {}", x, y);  // ✅ Both are valid
}
```

Types like `i32`, `bool`, `char`, and tuples of Copy types implement Copy.

### Borrowing

Instead of transferring ownership, you can **borrow** a reference:

```rust
fn main() {
    let s1 = String::from("hello");
    
    let len = calculate_length(&s1);  // Borrow s1
    
    println!("Length of '{}' is {}", s1, len);  // ✅ s1 still valid
}

fn calculate_length(s: &String) -> usize {
    s.len()  // Read-only access
}  // s goes out of scope, but doesn't own the data, so nothing is dropped
```

### Mutable Borrowing

You can have a mutable reference, but with restrictions:

```rust
fn main() {
    let mut s = String::from("hello");
    
    change(&mut s);  // Mutable borrow
    
    println!("{}", s);  // Prints "hello, world"
}

fn change(s: &mut String) {
    s.push_str(", world");
}
```

**Key Rule**: You can have either:
- One mutable reference, OR
- Any number of immutable references

But NOT both at the same time!

```rust
fn main() {
    let mut s = String::from("hello");
    
    let r1 = &s;      // ✅ Immutable borrow
    let r2 = &s;      // ✅ Another immutable borrow
    println!("{} and {}", r1, r2);
    
    // r1 and r2 are no longer used after this point
    
    let r3 = &mut s;  // ✅ Mutable borrow (previous borrows are done)
    r3.push_str(" world");
    println!("{}", r3);
}
```

**QuickConnect Example:**
```rust
// From QuickConnect - borrowing the AppHandle (src-tauri/src/commands/windows.rs)
#[tauri::command]
pub async fn show_hosts_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        // First hide main window
        if let Some(main_window) = app_handle.get_webview_window("main") {
            main_window.hide().map_err(|e| e.to_string())?;
        }

        // Make sure login window is also hidden
        if let Some(login_window) = app_handle.get_webview_window("login") {
            login_window.hide().map_err(|e| e.to_string())?;
        }

        // Now show hosts window
        hosts_window.unminimize().map_err(|e| e.to_string())?;
        hosts_window.show().map_err(|e| e.to_string())?;
        hosts_window.set_focus().map_err(|e| e.to_string())?;

        // Update LAST_HIDDEN_WINDOW
        if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
            *last_hidden = "hosts".to_string();
        }

        Ok(())
    } else {
        Err("Hosts window not found".to_string())
    }
}
```

---

## 1.4 Functions and Control Flow

### Functions

Functions use `fn` keyword and snake_case naming:

```rust
fn main() {
    let result = add(5, 3);
    println!("5 + 3 = {}", result);
    
    greet("Alice");
}

fn add(a: i32, b: i32) -> i32 {
    a + b  // No semicolon = return value
}

fn greet(name: &str) {
    println!("Hello, {}!", name);
}  // No return value = returns ()
```

**Note**: In Rust, the last expression without a semicolon is the return value.

### If Expressions

`if` is an expression in Rust, meaning it returns a value:

```rust
fn main() {
    let number = 6;
    
    if number % 2 == 0 {
        println!("even");
    } else {
        println!("odd");
    }
    
    // if as an expression
    let description = if number < 5 {
        "small"
    } else if number < 10 {
        "medium"
    } else {
        "large"
    };
    
    println!("Number is {}", description);
}
```

### Loops

**loop** - infinite loop:
```rust
fn main() {
    let mut count = 0;
    
    loop {
        count += 1;
        
        if count == 5 {
            break;  // Exit loop
        }
    }
    
    println!("Final count: {}", count);
}
```

**while** - conditional loop:
```rust
fn main() {
    let mut number = 3;
    
    while number != 0 {
        println!("{}!", number);
        number -= 1;
    }
    
    println!("LIFTOFF!");
}
```

**for** - iterate over collections:
```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    
    for num in numbers.iter() {
        println!("Number: {}", num);
    }
    
    // Range
    for i in 0..5 {
        println!("Count: {}", i);
    }
}
```

**QuickConnect Example:**
```rust
// From QuickConnect - iterating and filtering (src-tauri/src/core/hosts.rs)
pub fn search_hosts(query: &str) -> Result<Vec<Host>, AppError> {
    let hosts = get_all_hosts()?;
    let query = query.to_lowercase();

    let filtered: Vec<Host> = hosts
        .into_iter()
        .filter(|host| {
            host.hostname.to_lowercase().contains(&query)
                || host.description.to_lowercase().contains(&query)
        })
        .collect();

    Ok(filtered)
}
```

### Match Expressions

`match` is like switch but more powerful:

```rust
fn main() {
    let number = 7;
    
    match number {
        1 => println!("One"),
        2 | 3 | 5 | 7 | 11 => println!("Prime"),
        13..=19 => println!("Teen"),
        _ => println!("Other"),  // _ is catch-all
    }
}
```

Match is **exhaustive** - you must handle all cases:

```rust
fn describe_optional(x: Option<i32>) {
    match x {
        Some(val) => println!("Got a value: {}", val),
        None => println!("Got nothing"),
    }
}
```

---

## 1.5 Structs and Enums

### Structs

Structs group related data:

```rust
struct User {
    username: String,
    email: String,
    active: bool,
    sign_in_count: u64,
}

fn main() {
    let user1 = User {
        username: String::from("alice123"),
        email: String::from("alice@example.com"),
        active: true,
        sign_in_count: 1,
    };
    
    println!("Username: {}", user1.username);
}
```

Structs can have methods:

```rust
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    // Method (takes &self)
    fn area(&self) -> u32 {
        self.width * self.height
    }
    
    // Associated function (like static method)
    fn square(size: u32) -> Rectangle {
        Rectangle {
            width: size,
            height: size,
        }
    }
}

fn main() {
    let rect = Rectangle { width: 30, height: 50 };
    println!("Area: {}", rect.area());
    
    let sq = Rectangle::square(10);
    println!("Square area: {}", sq.area());
}
```

**QuickConnect Example:**
```rust
// From QuickConnect (src-tauri/src/core/types.rs)
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Host {
    pub hostname: String,
    pub description: String,
    pub last_connected: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredCredentials {
    pub username: String,
    pub password: String,
}
```

### Enums

Enums represent a type that can be one of several variants:

```rust
enum IpAddress {
    V4(u8, u8, u8, u8),
    V6(String),
}

fn main() {
    let home = IpAddress::V4(127, 0, 0, 1);
    let loopback = IpAddress::V6(String::from("::1"));
    
    print_ip(home);
    print_ip(loopback);
}

fn print_ip(ip: IpAddress) {
    match ip {
        IpAddress::V4(a, b, c, d) => {
            println!("IPv4: {}.{}.{}.{}", a, b, c, d);
        }
        IpAddress::V6(addr) => {
            println!("IPv6: {}", addr);
        }
    }
}
```

### Option Enum

Rust doesn't have null. Instead, it has `Option<T>`:

```rust
fn divide(a: f64, b: f64) -> Option<f64> {
    if b == 0.0 {
        None
    } else {
        Some(a / b)
    }
}

fn main() {
    let result = divide(10.0, 2.0);
    
    match result {
        Some(val) => println!("Result: {}", val),
        None => println!("Cannot divide by zero"),
    }
    
    // Or use if let
    if let Some(val) = divide(10.0, 2.0) {
        println!("Result: {}", val);
    }
}
```

---

## 1.6 Error Handling with Result<T, E>

Rust uses `Result<T, E>` for operations that can fail:

```rust
use std::fs::File;
use std::io::Read;

fn read_file(path: &str) -> Result<String, std::io::Error> {
    let mut file = File::open(path)?;  // ? propagates errors
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}

fn main() {
    match read_file("data.txt") {
        Ok(contents) => println!("File contents: {}", contents),
        Err(e) => eprintln!("Error reading file: {}", e),
    }
}
```

### The ? Operator

The `?` operator is shorthand for error propagation:

```rust
// Without ?
fn read_file_verbose(path: &str) -> Result<String, std::io::Error> {
    let file = File::open(path);
    let mut file = match file {
        Ok(f) => f,
        Err(e) => return Err(e),
    };
    
    let mut contents = String::new();
    match file.read_to_string(&mut contents) {
        Ok(_) => Ok(contents),
        Err(e) => Err(e),
    }
}

// With ?
fn read_file(path: &str) -> Result<String, std::io::Error> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}
```

### Custom Errors

```rust
fn parse_port(s: &str) -> Result<u16, String> {
    match s.parse::<u16>() {
        Ok(port) if port > 0 => Ok(port),
        Ok(_) => Err("Port must be greater than 0".to_string()),
        Err(_) => Err(format!("'{}' is not a valid port number", s)),
    }
}

fn main() {
    match parse_port("8080") {
        Ok(port) => println!("Valid port: {}", port),
        Err(e) => eprintln!("Error: {}", e),
    }
}
```

**QuickConnect Example:**
```rust
// From QuickConnect - command-layer error handling (src-tauri/src/commands/credentials.rs)
#[tauri::command]
pub async fn save_credentials(credentials: Credentials) -> Result<(), String> {
    debug_log("INFO", "CREDENTIALS", "Attempting to save credentials", None);

    if credentials.username.is_empty() {
        let error = "Username cannot be empty";
        debug_log(
            "ERROR",
            "CREDENTIALS",
            error,
            Some("Username parameter was empty"),
        );
        return Err(error.to_string());
    }

    CREDENTIAL_MANAGER
        .save("QuickConnect", &credentials.username, &credentials.password)
        .map_err(|e| {
            debug_log(
                "ERROR",
                "CREDENTIALS",
                &format!("Failed to save credentials: {}", e),
                None,
            );
            e.to_string()
        })?;

    debug_log("INFO", "CREDENTIALS", "Credentials saved successfully", None);
    Ok(())
}
```

---

## 1.7 Basic Collections

### Vec<T> - Growable Arrays

```rust
fn main() {
    // Creating vectors
    let mut numbers: Vec<i32> = Vec::new();
    let mut items = vec![1, 2, 3];  // vec! macro
    
    // Adding elements
    numbers.push(1);
    numbers.push(2);
    numbers.push(3);
    
    // Accessing elements
    let first = numbers[0];  // Panics if out of bounds
    
    match numbers.get(0) {   // Returns Option
        Some(val) => println!("First: {}", val),
        None => println!("No first element"),
    }
    
    // Iterating
    for num in &numbers {
        println!("{}", num);
    }
    
    // Mapping and filtering
    let doubled: Vec<i32> = numbers.iter()
        .map(|x| x * 2)
        .collect();
    
    let evens: Vec<i32> = numbers.into_iter()
        .filter(|x| x % 2 == 0)
        .collect();
}
```

### HashMap<K, V> - Key-Value Storage

```rust
use std::collections::HashMap;

fn main() {
    let mut scores = HashMap::new();
    
    // Inserting
    scores.insert(String::from("Blue"), 10);
    scores.insert(String::from("Red"), 50);
    
    // Accessing
    let team_name = String::from("Blue");
    match scores.get(&team_name) {
        Some(score) => println!("Score: {}", score),
        None => println!("Team not found"),
    }
    
    // Updating
    scores.insert(String::from("Blue"), 25);  // Overwrites
    
    // Insert if not present
    scores.entry(String::from("Yellow")).or_insert(50);
    
    // Iterating
    for (key, value) in &scores {
        println!("{}: {}", key, value);
    }
}
```

### String vs &str

```rust
fn main() {
    // String - owned, mutable, heap-allocated
    let mut s1 = String::from("hello");
    s1.push_str(", world");
    
    // &str - borrowed string slice, immutable
    let s2: &str = "hello";
    let s3: &str = &s1[0..5];  // Slice of s1
    
    println!("{} and {}", s1, s2);
}
```

**QuickConnect Example:**
```rust
// From QuickConnect - using Vec to store hosts (src-tauri/src/core/csv_reader.rs)
pub fn read_hosts_from_csv(csv_path: &Path) -> Result<Vec<Host>, AppError> {
    use tracing::{debug, error};

    debug!(
        path = ?csv_path,
        "Reading hosts from CSV file"
    );

    // If file doesn't exist, return empty list (not an error)
    if !csv_path.exists() {
        debug!(
            path = ?csv_path,
            "CSV file does not exist, returning empty host list"
        );
        return Ok(Vec::new());
    }

    let contents = std::fs::read_to_string(csv_path).map_err(|e| {
        error!(
            path = ?csv_path,
            error = %e,
            "Failed to read CSV file"
        );
        AppError::IoError {
            path: csv_path.to_string_lossy().to_string(),
            source: e,
        }
    })?;

    let mut hosts = Vec::new();
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_reader(contents.as_bytes());

    // Parse each CSV record into a Host struct
    // CSV format: hostname, description, last_connected (optional, added in v1.2.0)
    for result in reader.records() {
        match result {
            Ok(record) => {
                // Minimum 2 columns required (hostname, description)
                if record.len() >= 2 {
                    // last_connected column is optional for backwards compatibility
                    // with v1.1.0 CSV files that didn't have this column
                    let last_connected = if record.len() >= 3 && !record[2].is_empty() {
                        Some(record[2].to_string())
                    } else {
                        None
                    };
                    hosts.push(Host {
                        hostname: record[0].to_string(),
                        description: record[1].to_string(),
                        last_connected,
                    });
                }
            }
            Err(e) => {
                error!(
                    path = ?csv_path,
                    error = %e,
                    "Failed to parse CSV record"
                );
                return Err(AppError::CsvError {
                    operation: "parse CSV record".to_string(),
                    source: e,
                });
            }
        }
    }

    Ok(hosts)
}
```

---

## 1.8 Practice Exercises

### Exercise 1: Temperature Converter
Write a program that converts between Fahrenheit and Celsius.

```rust
fn fahrenheit_to_celsius(f: f64) -> f64 {
    // TODO: Implement this
    // Formula: C = (F - 32) * 5/9
}

fn celsius_to_fahrenheit(c: f64) -> f64 {
    // TODO: Implement this
    // Formula: F = C * 9/5 + 32
}

fn main() {
    let temp_f = 98.6;
    let temp_c = fahrenheit_to_celsius(temp_f);
    println!("{}°F = {:.1}°C", temp_f, temp_c);
}
```

### Exercise 2: Host Manager
Create a simple host manager similar to QuickConnect:

```rust
#[derive(Debug)]
struct Host {
    hostname: String,
    description: String,
    last_connected: Option<String>,
}

fn main() {
    let mut hosts: Vec<Host> = Vec::new();
    
    // TODO: 
    // 1. Add 3 hosts to the vector
    // 2. Print all hosts
    // 3. Search for a host by hostname
    // 4. Remove a host by hostname
}
```

### Exercise 3: Result Error Handling
Write a function that parses a configuration string:

```rust
#[derive(Debug)]
struct Config {
    hostname: String,
    port: u16,
}

fn parse_config(input: &str) -> Result<Config, String> {
    // TODO: Parse "hostname:port" format
    // Return error if format is invalid or port is out of range
    // Example: "localhost:8080" -> Ok(Config { hostname: "localhost", port: 8080 })
}

fn main() {
    let configs = vec!["localhost:8080", "example.com:443", "invalid", "host:99999"];
    
    for config_str in configs {
        match parse_config(config_str) {
            Ok(config) => println!("Valid: {:?}", config),
            Err(e) => eprintln!("Error: {}", e),
        }
    }
}
```

### Exercise 4: Option Handling
Create a function that finds a host by hostname:

```rust
struct Host {
    hostname: String,
    description: String,
}

fn find_host(hosts: &Vec<Host>, hostname: &str) -> Option<&Host> {
    // TODO: Return Some(&host) if found, None if not found
}

fn main() {
    let hosts = vec![
        Host { hostname: "server1.contoso.com".to_string(), description: "Web server".to_string() },
        Host { hostname: "server2.contoso.com".to_string(), description: "DB server".to_string() },
    ];
    
    if let Some(host) = find_host(&hosts, "server1.contoso.com") {
        println!("Found: {} - {}", host.hostname, host.description);
    } else {
        println!("Host not found");
    }
}
```

### Exercise 5: String Manipulation
Create a function that validates and formats hostnames:

```rust
fn format_hostname(hostname: &str) -> Result<String, String> {
    // TODO:
    // 1. Trim whitespace
    // 2. Convert to lowercase
    // 3. Check if it contains only valid characters (alphanumeric, dots, hyphens)
    // 4. Check if it's not empty
    // 5. Return formatted hostname or error message
}

fn main() {
    let hostnames = vec![
        "  SERVER.DOMAIN.COM  ",
        "valid-server.com",
        "invalid@server",
        "",
        "192.168.1.1",
    ];
    
    for hostname in hostnames {
        match format_hostname(hostname) {
            Ok(formatted) => println!("'{}' -> '{}'", hostname, formatted),
            Err(e) => println!("'{}' -> Error: {}", hostname, e),
        }
    }
}
```

---

## Solutions

<details>
<summary>Click to reveal solutions</summary>

### Solution 1: Temperature Converter
```rust
fn fahrenheit_to_celsius(f: f64) -> f64 {
    (f - 32.0) * 5.0 / 9.0
}

fn celsius_to_fahrenheit(c: f64) -> f64 {
    c * 9.0 / 5.0 + 32.0
}

fn main() {
    let temp_f = 98.6;
    let temp_c = fahrenheit_to_celsius(temp_f);
    println!("{}°F = {:.1}°C", temp_f, temp_c);
    
    let temp_c2 = 37.0;
    let temp_f2 = celsius_to_fahrenheit(temp_c2);
    println!("{}°C = {:.1}°F", temp_c2, temp_f2);
}
```

### Solution 2: Host Manager
```rust
#[derive(Debug, Clone)]
struct Host {
    hostname: String,
    description: String,
    last_connected: Option<String>,
}

fn main() {
    let mut hosts: Vec<Host> = Vec::new();
    
    // 1. Add hosts
    hosts.push(Host {
        hostname: "web-server.contoso.com".to_string(),
        description: "Production web server".to_string(),
        last_connected: None,
    });
    
    hosts.push(Host {
        hostname: "db-server.contoso.com".to_string(),
        description: "Database server".to_string(),
        last_connected: None,
    });
    
    hosts.push(Host {
        hostname: "backup-server.contoso.com".to_string(),
        description: "Backup storage".to_string(),
        last_connected: None,
    });
    
    // 2. Print all hosts
    println!("All hosts:");
    for host in &hosts {
        println!("  {} - {}", host.hostname, host.description);
    }
    
    // 3. Search for host
    let search_hostname = "db-server.contoso.com";
    if let Some(host) = hosts.iter().find(|h| h.hostname == search_hostname) {
        println!("\nFound: {:?}", host);
    }
    
    // 4. Remove host
    let remove_hostname = "backup-server.contoso.com";
    hosts.retain(|h| h.hostname != remove_hostname);
    println!("\nAfter removing {}:", remove_hostname);
    for host in &hosts {
        println!("  {}", host.hostname);
    }
}
```

### Solution 3: Result Error Handling
```rust
#[derive(Debug)]
struct Config {
    hostname: String,
    port: u16,
}

fn parse_config(input: &str) -> Result<Config, String> {
    let parts: Vec<&str> = input.split(':').collect();
    
    if parts.len() != 2 {
        return Err(format!("Invalid format. Expected 'hostname:port', got '{}'", input));
    }
    
    let hostname = parts[0].to_string();
    if hostname.is_empty() {
        return Err("Hostname cannot be empty".to_string());
    }
    
    let port = parts[1].parse::<u16>()
        .map_err(|_| format!("Invalid port number: '{}'", parts[1]))?;
    
    if port == 0 {
        return Err("Port must be greater than 0".to_string());
    }
    
    Ok(Config { hostname, port })
}

fn main() {
    let configs = vec!["localhost:8080", "example.com:443", "invalid", "host:99999"];
    
    for config_str in configs {
        match parse_config(config_str) {
            Ok(config) => println!("Valid: {:?}", config),
            Err(e) => eprintln!("Error: {}", e),
        }
    }
}
```

### Solution 4: Option Handling
```rust
struct Host {
    hostname: String,
    description: String,
}

fn find_host<'a>(hosts: &'a Vec<Host>, hostname: &str) -> Option<&'a Host> {
    hosts.iter().find(|h| h.hostname == hostname)
}

fn main() {
    let hosts = vec![
        Host { hostname: "server1.contoso.com".to_string(), description: "Web server".to_string() },
        Host { hostname: "server2.contoso.com".to_string(), description: "DB server".to_string() },
    ];
    
    // Test finding existing host
    if let Some(host) = find_host(&hosts, "server1.contoso.com") {
        println!("Found: {} - {}", host.hostname, host.description);
    } else {
        println!("Host not found");
    }
    
    // Test finding non-existent host
    match find_host(&hosts, "server3.contoso.com") {
        Some(host) => println!("Found: {} - {}", host.hostname, host.description),
        None => println!("Host 'server3.contoso.com' not found"),
    }
}
```

### Solution 5: String Manipulation
```rust
fn format_hostname(hostname: &str) -> Result<String, String> {
    // Trim whitespace
    let trimmed = hostname.trim();
    
    // Check if empty
    if trimmed.is_empty() {
        return Err("Hostname cannot be empty".to_string());
    }
    
    // Convert to lowercase
    let lowercase = trimmed.to_lowercase();
    
    // Validate characters (alphanumeric, dots, hyphens)
    let is_valid = lowercase.chars().all(|c| {
        c.is_ascii_alphanumeric() || c == '.' || c == '-'
    });
    
    if !is_valid {
        return Err(format!("Hostname '{}' contains invalid characters", hostname));
    }
    
    // Additional validation: can't start or end with dot or hyphen
    if lowercase.starts_with('.') || lowercase.starts_with('-') 
        || lowercase.ends_with('.') || lowercase.ends_with('-') {
        return Err("Hostname cannot start or end with '.' or '-'".to_string());
    }
    
    Ok(lowercase)
}

fn main() {
    let hostnames = vec![
        "  SERVER.DOMAIN.COM  ",
        "valid-server.com",
        "invalid@server",
        "",
        "192.168.1.1",
        "-invalid.com",
    ];
    
    for hostname in hostnames {
        match format_hostname(hostname) {
            Ok(formatted) => println!("'{}' -> '{}'", hostname, formatted),
            Err(e) => println!("'{}' -> Error: {}", hostname, e),
        }
    }
}
```

</details>

---

## Key Takeaways

✅ **Rust prioritizes safety without sacrificing performance**
- Memory safety without garbage collection
- Prevent bugs at compile time

✅ **Ownership is Rust's superpower**
- Each value has one owner
- Borrowing allows temporary access
- Prevents memory leaks and data races

✅ **Error handling is explicit**
- `Result<T, E>` for recoverable errors
- `Option<T>` for nullable values
- No hidden exceptions

✅ **Type system is your friend**
- Strong static typing
- Type inference reduces boilerplate
- Compiler catches mistakes early

✅ **Collections are powerful and safe**
- Vec<T> for dynamic arrays
- HashMap<K, V> for key-value storage
- Iterators for functional-style programming

---

## Next Steps

In **Chapter 2: Setting Up Your Development Environment**, we'll:
- Install Rust, Node.js, and all necessary tools
- Set up Visual Studio Code with Rust extensions
- Create our first Tauri project
- Understand the complete build toolchain

**You now have the Rust foundation needed to build desktop applications!**

The concepts covered here will appear throughout QuickConnect's codebase. As we progress through the guide, you'll see how these fundamentals combine to create a full-featured Windows application.

---

## Additional Resources

- [The Rust Programming Language Book](https://doc.rust-lang.org/book/) - Official Rust book
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/) - Learn through examples
- [Rustlings](https://github.com/rust-lang/rustlings) - Interactive exercises
- [QuickConnect Source Code](../src-tauri/src/) - Real-world examples


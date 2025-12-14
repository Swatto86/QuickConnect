# Appendix B: Common Patterns and Recipes

This appendix provides reusable code patterns and recipes for common tasks in Tauri application development. Each pattern includes complete, working code that you can adapt for your own projects.

---

## Table of Contents

- [B.1 File Dialog Patterns](#b1-file-dialog-patterns)
- [B.2 Notification Systems](#b2-notification-systems)
- [B.3 Database Integration](#b3-database-integration)
- [B.4 HTTP Requests](#b4-http-requests)
- [B.5 Background Tasks](#b5-background-tasks)
- [B.6 Configuration Management](#b6-configuration-management)
- [B.7 Window Communication](#b7-window-communication)
- [B.8 Custom Protocols](#b8-custom-protocols)
- [B.9 Progress Indicators](#b9-progress-indicators)
- [B.10 Auto-Update Implementation](#b10-auto-update-implementation)
- [B.11 Clipboard Operations](#b11-clipboard-operations)
- [B.12 Keyboard Shortcuts](#b12-keyboard-shortcuts)
- [B.13 QuickConnect Command and Event Catalog](#b13-quickconnect-command-and-event-catalog)

---

## B.1 File Dialog Patterns

### B.1.1 Open File Dialog

```rust
use tauri::api::dialog::FileDialogBuilder;

#[tauri::command]
async fn select_file(window: tauri::Window) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    
    FileDialogBuilder::new()
        .add_filter("Text Files", &["txt", "md"])
        .add_filter("All Files", &["*"])
        .set_title("Select a file")
        .pick_file(move |file_path| {
            tx.send(file_path).ok();
        });
    
    match rx.recv() {
        Ok(Some(path)) => Ok(path.to_string_lossy().to_string()),
        Ok(None) => Err("No file selected".to_string()),
        Err(e) => Err(format!("Dialog error: {}", e)),
    }
}
```

**TypeScript Usage:**
```typescript
const filePath = await invoke<string>('select_file');
console.log('Selected:', filePath);
```

### B.1.2 Save File Dialog

```rust
#[tauri::command]
async fn save_file_as(window: tauri::Window, content: String) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    
    FileDialogBuilder::new()
        .add_filter("Text Files", &["txt"])
        .set_title("Save As")
        .set_file_name("document.txt")
        .save_file(move |file_path| {
            tx.send(file_path).ok();
        });
    
    match rx.recv() {
        Ok(Some(path)) => {
            std::fs::write(&path, content)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(path.to_string_lossy().to_string())
        }
        Ok(None) => Err("Save cancelled".to_string()),
        Err(e) => Err(format!("Dialog error: {}", e)),
    }
}
```

### B.1.3 Select Folder Dialog

```rust
#[tauri::command]
async fn select_folder() -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    
    FileDialogBuilder::new()
        .set_title("Select Folder")
        .pick_folder(move |folder_path| {
            tx.send(folder_path).ok();
        });
    
    match rx.recv() {
        Ok(Some(path)) => Ok(path.to_string_lossy().to_string()),
        Ok(None) => Err("No folder selected".to_string()),
        Err(e) => Err(format!("Dialog error: {}", e)),
    }
}
```

### B.1.4 Multiple File Selection

```rust
#[tauri::command]
async fn select_multiple_files() -> Result<Vec<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    
    FileDialogBuilder::new()
        .add_filter("Images", &["png", "jpg", "jpeg", "gif"])
        .set_title("Select Images")
        .pick_files(move |file_paths| {
            tx.send(file_paths).ok();
        });
    
    match rx.recv() {
        Ok(Some(paths)) => {
            Ok(paths.iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect())
        }
        Ok(None) => Err("No files selected".to_string()),
        Err(e) => Err(format!("Dialog error: {}", e)),
    }
}
```

---

## B.2 Notification Systems

### B.2.1 Toast Notifications (Frontend)

```typescript
class ToastNotification {
    private container: HTMLElement;
    
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
        `;
        document.body.appendChild(this.container);
    }
    
    show(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500'
        };
        
        toast.className = `
            ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg
            mb-2 transform transition-all duration-300
            hover:scale-105
        `;
        toast.textContent = message;
        
        // Add to container
        this.container.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.style.opacity = '1', 10);
        
        // Remove after duration
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    success(message: string, duration?: number) {
        this.show(message, 'success', duration);
    }
    
    error(message: string, duration?: number) {
        this.show(message, 'error', duration);
    }
    
    info(message: string, duration?: number) {
        this.show(message, 'info', duration);
    }
}

// Usage
const toast = new ToastNotification();
toast.success('Operation completed!');
toast.error('Something went wrong!');
toast.info('Processing...');
```

### B.2.2 System Notifications (Native)

```rust
use tauri::api::notification::Notification;

#[tauri::command]
fn show_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    Notification::new(&app.config().tauri.bundle.identifier)
        .title(title)
        .body(body)
        .icon("icon.png")
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))
}
```

**TypeScript Usage:**
```typescript
await invoke('show_notification', {
    title: 'Task Complete',
    body: 'Your export has finished successfully.'
});
```

### B.2.3 Progress Notifications

```rust
#[derive(Clone, serde::Serialize)]
struct ProgressUpdate {
    current: u32,
    total: u32,
    message: String,
}

#[tauri::command]
async fn long_running_task(window: tauri::Window) -> Result<(), String> {
    let total = 100;
    
    for i in 0..=total {
        // Simulate work
        std::thread::sleep(std::time::Duration::from_millis(50));
        
        // Send progress update
        window.emit("progress", ProgressUpdate {
            current: i,
            total,
            message: format!("Processing item {} of {}", i, total),
        }).ok();
    }
    
    Ok(())
}
```

**TypeScript Usage:**
```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for progress
await listen<ProgressUpdate>('progress', (event) => {
    const { current, total, message } = event.payload;
    const percent = (current / total) * 100;
    
    progressBar.style.width = `${percent}%`;
    progressText.textContent = message;
});

// Start task
await invoke('long_running_task');
```

---

## B.3 Database Integration

### B.3.1 SQLite Setup

**Cargo.toml:**
```toml
[dependencies]
sqlx = { version = "0.7", features = ["runtime-tokio-native-tls", "sqlite"] }
tokio = { version = "1", features = ["full"] }
```

**Database Connection:**
```rust
use sqlx::{sqlite::SqlitePool, Pool, Sqlite};
use std::sync::Arc;
use tauri::State;

pub struct Database {
    pool: Arc<Pool<Sqlite>>,
}

impl Database {
    pub async fn new(db_path: &str) -> Result<Self, sqlx::Error> {
        let pool = SqlitePool::connect(db_path).await?;
        
        // Create tables
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )"
        )
        .execute(&pool)
        .await?;
        
        Ok(Database {
            pool: Arc::new(pool),
        })
    }
}
```

### B.3.2 CRUD Operations

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
struct User {
    id: i64,
    name: String,
    email: String,
}

#[tauri::command]
async fn create_user(
    db: State<'_, Database>,
    name: String,
    email: String,
) -> Result<i64, String> {
    let result = sqlx::query("INSERT INTO users (name, email) VALUES (?, ?)")
        .bind(&name)
        .bind(&email)
        .execute(&*db.pool)
        .await
        .map_err(|e| format!("Failed to create user: {}", e))?;
    
    Ok(result.last_insert_rowid())
}

#[tauri::command]
async fn get_user(db: State<'_, Database>, id: i64) -> Result<User, String> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(id)
        .fetch_one(&*db.pool)
        .await
        .map_err(|e| format!("User not found: {}", e))
}

#[tauri::command]
async fn get_all_users(db: State<'_, Database>) -> Result<Vec<User>, String> {
    sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY created_at DESC")
        .fetch_all(&*db.pool)
        .await
        .map_err(|e| format!("Failed to fetch users: {}", e))
}

#[tauri::command]
async fn update_user(
    db: State<'_, Database>,
    id: i64,
    name: String,
    email: String,
) -> Result<(), String> {
    sqlx::query("UPDATE users SET name = ?, email = ? WHERE id = ?")
        .bind(&name)
        .bind(&email)
        .bind(id)
        .execute(&*db.pool)
        .await
        .map_err(|e| format!("Failed to update user: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn delete_user(db: State<'_, Database>, id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(id)
        .execute(&*db.pool)
        .await
        .map_err(|e| format!("Failed to delete user: {}", e))?;
    
    Ok(())
}
```

**Setup in main:**
```rust
#[tokio::main]
async fn main() {
    let db = Database::new("app.db").await
        .expect("Failed to initialize database");
    
    tauri::Builder::default()
        .manage(db)
        .invoke_handler(tauri::generate_handler![
            create_user,
            get_user,
            get_all_users,
            update_user,
            delete_user,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## B.4 HTTP Requests

### B.4.1 Simple GET Request

```rust
use reqwest;

#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    Ok(body)
}
```

### B.4.2 POST with JSON

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginResponse {
    token: String,
    user_id: i64,
}

#[tauri::command]
async fn login(username: String, password: String) -> Result<LoginResponse, String> {
    let client = reqwest::Client::new();
    
    let request_body = LoginRequest { username, password };
    
    let response = client
        .post("https://api.example.com/login")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Login failed: {}", response.status()));
    }
    
    let login_response = response
        .json::<LoginResponse>()
        .await
        .map_err(|e| format!("Invalid response: {}", e))?;
    
    Ok(login_response)
}
```

### B.4.3 Download File with Progress

```rust
use futures_util::StreamExt;

#[tauri::command]
async fn download_file(
    window: tauri::Window,
    url: String,
    dest_path: String,
) -> Result<(), String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;
    
    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    
    let mut file = tokio::fs::File::create(&dest_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        
        tokio::io::copy(&mut chunk.as_ref(), &mut file)
            .await
            .map_err(|e| format!("Write error: {}", e))?;
        
        downloaded += chunk.len() as u64;
        
        let progress = if total_size > 0 {
            (downloaded as f64 / total_size as f64) * 100.0
        } else {
            0.0
        };
        
        window.emit("download-progress", progress).ok();
    }
    
    Ok(())
}
```

---

## B.5 Background Tasks

### B.5.1 Spawning Background Task

```rust
use tokio::task;

#[tauri::command]
async fn start_background_task(window: tauri::Window) -> Result<(), String> {
    task::spawn(async move {
        loop {
            // Do background work
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            
            // Send update to frontend
            window.emit("background-update", "Task completed").ok();
        }
    });
    
    Ok(())
}
```

### B.5.2 Cancellable Background Task

```rust
use tokio::sync::mpsc;
use std::sync::Arc;
use tokio::sync::Mutex;

struct BackgroundTask {
    cancel_tx: Option<mpsc::Sender<()>>,
}

impl BackgroundTask {
    fn new() -> Self {
        BackgroundTask { cancel_tx: None }
    }
    
    async fn start(&mut self, window: tauri::Window) {
        let (cancel_tx, mut cancel_rx) = mpsc::channel(1);
        self.cancel_tx = Some(cancel_tx);
        
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = cancel_rx.recv() => {
                        window.emit("task-cancelled", ()).ok();
                        break;
                    }
                    _ = tokio::time::sleep(tokio::time::Duration::from_secs(1)) => {
                        window.emit("task-tick", ()).ok();
                    }
                }
            }
        });
    }
    
    async fn cancel(&mut self) {
        if let Some(tx) = self.cancel_tx.take() {
            tx.send(()).await.ok();
        }
    }
}

#[tauri::command]
async fn start_task(
    state: State<'_, Arc<Mutex<BackgroundTask>>>,
    window: tauri::Window,
) -> Result<(), String> {
    let mut task = state.lock().await;
    task.start(window).await;
    Ok(())
}

#[tauri::command]
async fn cancel_task(state: State<'_, Arc<Mutex<BackgroundTask>>>) -> Result<(), String> {
    let mut task = state.lock().await;
    task.cancel().await;
    Ok(())
}
```

---

## B.6 Configuration Management

### B.6.1 JSON Config File

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppConfig {
    theme: String,
    language: String,
    auto_update: bool,
    window_width: u32,
    window_height: u32,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            theme: "dark".to_string(),
            language: "en".to_string(),
            auto_update: true,
            window_width: 800,
            window_height: 600,
        }
    }
}

fn get_config_path() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| "Failed to get APPDATA".to_string())?;
    
    let config_dir = PathBuf::from(appdata).join("MyApp");
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    
    Ok(config_dir.join("config.json"))
}

#[tauri::command]
fn load_config() -> Result<AppConfig, String> {
    let path = get_config_path()?;
    
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    
    let contents = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    
    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse config: {}", e))
}

#[tauri::command]
fn save_config(config: AppConfig) -> Result<(), String> {
    let path = get_config_path()?;
    
    let contents = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    std::fs::write(&path, contents)
        .map_err(|e| format!("Failed to write config: {}", e))
}
```

### B.6.2 Environment Variables

```rust
#[tauri::command]
fn get_env_var(key: String) -> Result<String, String> {
    std::env::var(&key)
        .map_err(|_| format!("Environment variable {} not found", key))
}

#[tauri::command]
fn set_env_var(key: String, value: String) -> Result<(), String> {
    std::env::set_var(&key, &value);
    Ok(())
}
```

---

## B.7 Window Communication

### B.7.1 Event System

```rust
// Emit event from backend
#[tauri::command]
fn notify_all_windows(app: tauri::AppHandle, message: String) -> Result<(), String> {
    app.emit_all("global-message", message)
        .map_err(|e| format!("Failed to emit: {}", e))
}

// Send to specific window
#[tauri::command]
fn notify_window(
    app: tauri::AppHandle,
    window_label: String,
    message: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        window.emit("message", message)
            .map_err(|e| format!("Failed to emit: {}", e))
    } else {
        Err(format!("Window {} not found", window_label))
    }
}
```

**TypeScript:**
```typescript
import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';

// Listen for events
await listen<string>('global-message', (event) => {
    console.log('Received:', event.payload);
});

// Emit events to backend or other windows
await emit('user-action', { action: 'save', data: {...} });
```

### B.7.2 Window-to-Window Communication

```typescript
// In window A
import { emit } from '@tauri-apps/api/event';

await emit('window-a-event', { message: 'Hello from A' });

// In window B
import { listen } from '@tauri-apps/api/event';

await listen('window-a-event', (event) => {
    console.log('Window B received:', event.payload);
});
```

---

## B.8 Custom Protocols

### B.8.1 Register Custom Protocol

**tauri.conf.json:**
```json
{
  "tauri": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": ["**"]
      }
    }
  }
}
```

**Rust:**
```rust
use tauri::http::{Request, Response};

pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("myapp", |app, request| {
            let uri = request.uri();
            let path = uri.path();
            
            // Handle custom protocol
            match path {
                "/data" => {
                    let data = r#"{"status": "ok"}"#;
                    Response::builder()
                        .status(200)
                        .header("Content-Type", "application/json")
                        .body(data.as_bytes().to_vec())
                }
                _ => {
                    Response::builder()
                        .status(404)
                        .body("Not Found".as_bytes().to_vec())
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Usage in Frontend:**
```typescript
const response = await fetch('myapp://data');
const json = await response.json();
```

---

## B.9 Progress Indicators

### B.9.1 Determinate Progress Bar

```rust
#[derive(Clone, serde::Serialize)]
struct Progress {
    current: u32,
    total: u32,
    percentage: f32,
}

#[tauri::command]
async fn process_items(window: tauri::Window, items: Vec<String>) -> Result<(), String> {
    let total = items.len() as u32;
    
    for (index, item) in items.iter().enumerate() {
        // Process item
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        let current = (index + 1) as u32;
        let percentage = (current as f32 / total as f32) * 100.0;
        
        window.emit("progress", Progress {
            current,
            total,
            percentage,
        }).ok();
    }
    
    Ok(())
}
```

**TypeScript:**
```typescript
await listen<Progress>('progress', (event) => {
    const { current, total, percentage } = event.payload;
    
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${current} / ${total}`;
});
```

### B.9.2 Indeterminate Spinner

```typescript
class LoadingSpinner {
    private spinner: HTMLElement;
    
    constructor() {
        this.spinner = document.createElement('div');
        this.spinner.className = 'loading-spinner hidden';
        this.spinner.innerHTML = `
            <div class="spinner-border animate-spin" role="status">
                <span class="sr-only">Loading...</span>
            </div>
        `;
        document.body.appendChild(this.spinner);
    }
    
    show() {
        this.spinner.classList.remove('hidden');
    }
    
    hide() {
        this.spinner.classList.add('hidden');
    }
}

// Usage
const spinner = new LoadingSpinner();

spinner.show();
await invoke('long_operation');
spinner.hide();
```

---

## B.10 Auto-Update Implementation

### B.10.1 Setup Auto-Updater

**Cargo.toml:**
```toml
[dependencies]
tauri-plugin-updater = "2.0"
```

**tauri.conf.json:**
```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://releases.myapp.com/{{target}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

### B.10.2 Check for Updates

```rust
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<bool, String> {
    match app.updater() {
        Some(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    println!("Update available: {}", update.version);
                    Ok(true)
                }
                Ok(None) => {
                    println!("No update available");
                    Ok(false)
                }
                Err(e) => Err(format!("Update check failed: {}", e)),
            }
        }
        None => Err("Updater not configured".to_string()),
    }
}
```

**TypeScript:**
```typescript
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

async function checkAndUpdate() {
    try {
        const update = await check();
        
        if (update?.available) {
            const yes = confirm(
                `Update to ${update.version} is available!\n\n` +
                `Release notes: ${update.body}\n\n` +
                'Download and install now?'
            );
            
            if (yes) {
                await update.downloadAndInstall();
                await relaunch();
            }
        }
    } catch (error) {
        console.error('Update check failed:', error);
    }
}
```

---

## B.11 Clipboard Operations

### B.11.1 Copy to Clipboard

```rust
use tauri_plugin_clipboard::ClipboardExt;

#[tauri::command]
fn copy_to_clipboard(app: tauri::AppHandle, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(text)
        .map_err(|e| format!("Failed to copy: {}", e))
}
```

### B.11.2 Read from Clipboard

```rust
#[tauri::command]
fn read_from_clipboard(app: tauri::AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|e| format!("Failed to read clipboard: {}", e))
}
```

---

## B.12 Keyboard Shortcuts

### B.12.1 Global Hotkeys

```rust
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

pub fn register_shortcuts(app: &tauri::AppHandle) -> Result<(), String> {
    let app_handle = app.clone();
    
    app.global_shortcut()
        .register("Ctrl+Shift+A", move || {
            // Handle shortcut
            if let Some(window) = app_handle.get_webview_window("main") {
                window.show().ok();
                window.set_focus().ok();
            }
        })
        .map_err(|e| format!("Failed to register shortcut: {}", e))?;
    
    Ok(())
}
```

### B.12.2 Window-Level Shortcuts

```typescript
document.addEventListener('keydown', async (e) => {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        await invoke('save_data');
    }
    
    // Ctrl+F to search
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInput.focus();
    }
    
    // Escape to close
    if (e.key === 'Escape') {
        await invoke('close_window');
    }
});
```

---

## B.13 QuickConnect Command and Event Catalog

This section is a **coverage matrix** for the QuickConnect implementation.

Important notes:
- If a command takes `tauri::AppHandle`, it is **injected by Tauri** automatically when invoked from TypeScript. You do not pass it from `invoke()`.
- Some commands show `Frontend uses` as `—` because they are triggered from Rust-only entry points (system tray, global hotkeys, internal orchestration) rather than direct TypeScript calls.

### Registered Commands (authoritative)

| Command | Rust signature (as implemented) | Source | Frontend uses |
|---|---|---|---|
| `check_autostart` | `pub fn check_autostart() -> Result<bool, String>` | src-tauri/src/commands/system.rs | — |
| `check_host_status` | `pub async fn check_host_status(hostname: String) -> Result<String, String>` | src-tauri/src/commands/hosts.rs | — |
| `close_login_and_prepare_main` | `pub async fn close_login_and_prepare_main(app_handle: tauri::AppHandle) -> Result<(), String>` | src-tauri/src/commands/windows.rs | src/main.ts |
| `close_login_window` | `pub async fn close_login_window(app_handle: tauri::AppHandle) -> Result<(), String>` | src-tauri/src/commands/windows.rs | — |
| `delete_all_hosts` | `pub async fn delete_all_hosts(app_handle: tauri::AppHandle) -> Result<(), String>` | src-tauri/src/commands/hosts.rs | src/__tests__/ui-hosts.test.ts, src/hosts.ts |
| `delete_credentials` | `pub async fn delete_credentials() -> Result<(), String>` | src-tauri/src/commands/credentials.rs | src/__tests__/integration.test.ts, src/__tests__/ui-login.test.ts, src/main.ts |
| `delete_host` | `pub fn delete_host(app_handle: tauri::AppHandle, hostname: String) -> Result<(), String>` | src-tauri/src/commands/hosts.rs | src/__tests__/integration.test.ts, src/__tests__/ui-hosts.test.ts, src/hosts.ts |
| `delete_host_credentials` | `pub async fn delete_host_credentials(hostname: String) -> Result<(), String>` | src-tauri/src/commands/credentials.rs | — |
| `get_all_hosts` | `pub async fn get_all_hosts() -> Result<Vec<Host>, String>` | src-tauri/src/commands/hosts.rs | src/__tests__/integration.test.ts |
| `get_host_credentials` | `pub async fn get_host_credentials(hostname: String) -> Result<Option<StoredCredentials>, String>` | src-tauri/src/commands/credentials.rs | — |
| `get_hosts` | `pub fn get_hosts() -> Result<Vec<Host>, String>` | src-tauri/src/commands/hosts.rs | — |
| `get_login_window` | `pub async fn get_login_window(app_handle: tauri::AppHandle) -> Result<(), String>` | src-tauri/src/commands/windows.rs | — |
| `get_recent_connections` | `pub fn get_recent_connections() -> Result<Vec<RecentConnection>, String>` | src-tauri/src/commands/system.rs | — |
| `get_stored_credentials` | `pub async fn get_stored_credentials() -> Result<Option<StoredCredentials>, String>` | src-tauri/src/commands/credentials.rs | src/__tests__/integration.test.ts, src/__tests__/ui-login.test.ts |
| `get_theme` | `pub fn get_theme(app_handle: tauri::AppHandle) -> Result<String, String>` | src-tauri/src/commands/theme.rs | src/__tests__/integration.test.ts |
| `get_windows_theme` | `pub fn get_windows_theme() -> Result<String, String>` | src-tauri/src/commands/theme.rs | — |
| `hide_hosts_window` | `pub async fn hide_hosts_window(app_handle: tauri::AppHandle) -> Result<(), String>` | src-tauri/src/commands/windows.rs | src/__tests__/ui-hosts.test.ts, src/hosts.ts |
| `hide_main_window` | `pub async fn hide_main_window(app_handle: tauri::AppHandle) -> Result<(), String>` | src-tauri/src/commands/windows.rs | src/__tests__/ui-main.test.ts, src/main.ts |
| `launch_rdp` | `pub async fn launch_rdp(app_handle: tauri::AppHandle, host: Host) -> Result<(), String>` | src-tauri/src/commands/system.rs | src/__tests__/integration.test.ts, src/__tests__/ui-main.test.ts, src/main.ts |
| `list_hosts_with_credentials` | `pub async fn list_hosts_with_credentials() -> Result<Vec<String>, String>` | src-tauri/src/commands/credentials.rs | — |
| `quit_app` | `pub async fn quit_app(app_handle: tauri::AppHandle)` | src-tauri/src/commands/windows.rs | src/__tests__/ui-login.test.ts, src/about.ts, src/hosts.ts, src/main.ts |
| `reset_application` | `pub async fn reset_application(app_handle: tauri::AppHandle) -> Result<String, String>` | src-tauri/src/commands/system.rs | — |
| `save_credentials` | `pub async fn save_credentials(credentials: Credentials) -> Result<(), String>` | src-tauri/src/commands/credentials.rs | src/__tests__/integration.test.ts, src/__tests__/ui-login.test.ts, src/main.ts |
| `save_host` | `pub fn save_host(app_handle: tauri::AppHandle, host: Host) -> Result<(), String>` | src-tauri/src/commands/hosts.rs | src/__tests__/integration.test.ts, src/__tests__/ui-hosts.test.ts, src/hosts.ts |
| `save_host_credentials` | `pub async fn save_host_credentials(host: crate::Host, credentials: Credentials,) -> Result<(), String>` | src-tauri/src/commands/credentials.rs | src/__tests__/ui-hosts.test.ts, src/hosts.ts |
| `scan_domain` | `pub async fn scan_domain(app_handle: tauri::AppHandle, domain: String, server: String,) -> Result<String, String>` | src-tauri/src/commands/system.rs | — |
| `search_hosts` | `pub async fn search_hosts(query: String) -> Result<Vec<Host>, String>` | src-tauri/src/commands/hosts.rs | — |
| `set_theme` | `pub fn set_theme(app_handle: tauri::AppHandle, theme: String) -> Result<(), String>` | src-tauri/src/commands/theme.rs | — |
| `show_about` | `pub fn show_about(app_handle: tauri::AppHandle) -> Result<(), String>` | src-tauri/src/commands/windows.rs | — |
| `show_error` | `pub fn show_error(app_handle: tauri::AppHandle, message: String, category: Option<String>, details: Option<String>,) -> Result<(), String>` | src-tauri/src/commands/windows.rs | src/hosts.ts, src/main.ts |
| `show_hosts_window` | `pub async fn show_hosts_window(app_handle: tauri::AppHandle) -> Result<(), String>` | src-tauri/src/commands/windows.rs | src/__tests__/ui-main.test.ts, src/main.ts |
| `show_login_window` | `pub async fn show_login_window(app_handle: tauri::AppHandle) -> Result<(), String>` | src-tauri/src/commands/windows.rs | src/__tests__/ui-main.test.ts, src/main.ts |
| `switch_to_main_window` | `pub async fn switch_to_main_window(app_handle: tauri::AppHandle) -> Result<(), tauri::Error>` | src-tauri/src/commands/windows.rs | src/__tests__/ui-login.test.ts, src/main.ts |
| `toggle_autostart` | `pub fn toggle_autostart() -> Result<bool, String>` | src-tauri/src/commands/system.rs | — |
| `toggle_error_window` | `pub async fn toggle_error_window(app_handle: tauri::AppHandle) -> Result<(), String>` | src-tauri/src/commands/windows.rs | — |
| `toggle_visible_window` | `pub async fn toggle_visible_window(app_handle: tauri::AppHandle) -> Result<(), tauri::Error>` | src-tauri/src/commands/windows.rs | — |

### QuickConnect Events (emitted by the backend)

These are the events the real app uses for cross-window coordination:
- `hosts-updated`: emitted after host mutations and after `scan_domain` completes
- `host-connected`: emitted after successful `launch_rdp` (payload is hostname string)
- `theme-changed`: emitted after `set_theme` (payload is theme string)
- `show-error`: emitted by `show_error` to drive the error window

---

## Conclusion

These patterns provide a solid foundation for building feature-rich Tauri applications. Each recipe is production-ready and follows best practices. Adapt them to your specific needs and combine them to create powerful desktop applications.

**Key Takeaways:**
- Always handle errors gracefully
- Use async/await for I/O operations
- Provide user feedback for long operations
- Follow platform conventions
- Keep code modular and reusable

---

[← Appendix A](Appendix_A_Complete_QuickConnect_Walkthrough.md) | [Appendix C: Troubleshooting →](Appendix_C_Troubleshooting_Guide.md)

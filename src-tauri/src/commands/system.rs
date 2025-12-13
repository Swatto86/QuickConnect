//! System commands
//!
//! Handles system-level operations including autostart, application reset,
//! RDP connections, domain scanning, and tray menu management.

use crate::{AppError, Host, RecentConnection, RecentConnections};
use crate::adapters::{CredentialManager, RegistryAdapter, WindowsCredentialManager, WindowsRegistry};
use crate::commands;
use crate::core;
use crate::infra::debug_log;
use std::path::PathBuf;
use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

const REGISTRY_RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const APP_NAME: &str = "QuickConnect";

/// Gets the full path to the recent connections JSON file.
///
/// Returns `%APPDATA%\Roaming\QuickConnect\recent_connections.json`.
///
/// # Returns
/// * `Ok(PathBuf)` - The recent connections file path
/// * `Err(String)` - If the QuickConnect directory cannot be accessed
fn get_recent_connections_file() -> Result<PathBuf, String> {
    crate::infra::get_recent_connections_path()
}

/// Saves recent connections to disk.
///
/// Serializes the RecentConnections structure to pretty-printed JSON and writes
/// it to the recent connections file.
///
/// # Arguments
/// * `recent` - Reference to the RecentConnections structure to save
///
/// # Returns
/// * `Ok(())` - If save was successful
/// * `Err(String)` - If serialization or file write fails
#[allow(dead_code)]
fn save_recent_connections(recent: &RecentConnections) -> Result<(), String> {
    let file_path = get_recent_connections_file()?;
    let json = serde_json::to_string_pretty(recent)
        .map_err(|e| format!("Failed to serialize recent connections: {}", e))?;
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write recent connections: {}", e))?;
    Ok(())
}

/// Loads recent connections from disk.
///
/// If the file doesn't exist, returns an empty RecentConnections structure.
/// Otherwise, reads and deserializes the JSON file.
///
/// # Returns
/// * `Ok(RecentConnections)` - The loaded connections (or empty if file doesn't exist)
/// * `Err(String)` - If file read or JSON parsing fails
fn load_recent_connections() -> Result<RecentConnections, String> {
    let file_path = get_recent_connections_file()?;
    if !file_path.exists() {
        return Ok(RecentConnections::new());
    }
    let json = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read recent connections: {}", e))?;
    let recent: RecentConnections = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse recent connections: {}", e))?;
    Ok(recent)
}

/// Tauri command to retrieve the recent connections list.
///
/// Returns the list of up to 5 most recently accessed servers, ordered with
/// most recent first.
///
/// # Returns
/// * `Ok(Vec<RecentConnection>)` - The list of recent connections
/// * `Err(String)` - If loading from disk fails
#[tauri::command]
pub fn get_recent_connections() -> Result<Vec<RecentConnection>, String> {
    let recent = load_recent_connections()?;
    Ok(recent.connections)
}

/// Tauri command to launch an RDP connection to a host.
///
/// This is a thin wrapper that delegates to the core RDP launcher and handles UI events.
///
/// # Side Effects
/// - Writes RDP credentials to Windows Credential Manager (TERMSRV/{hostname})
/// - Creates RDP file in %APPDATA%\QuickConnect\Connections
/// - Spawns mstsc.exe process
/// - Updates recent connections list
/// - Updates last connected timestamp in hosts.csv
/// - Emits "host-connected" event to refresh UI
/// - Rebuilds system tray menu
#[tauri::command]
pub async fn launch_rdp(app_handle: tauri::AppHandle, host: Host) -> Result<(), String> {
    // Call the core RDP launcher using function injection for testability
    core::rdp_launcher::launch_rdp_connection(
        &host,
        |hostname| async move {
            commands::get_host_credentials(hostname)
                .await
                .map_err(|e| AppError::CredentialManagerError {
                    operation: "get host credentials".to_string(),
                    source: Some(anyhow::anyhow!(e)),
                })
        },
        || async {
            commands::get_stored_credentials()
                .await
                .map_err(|e| AppError::CredentialManagerError {
                    operation: "get stored credentials".to_string(),
                    source: Some(anyhow::anyhow!(e)),
                })
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    // Update last connected timestamp and emit UI events
    if let Err(e) = commands::hosts::update_last_connected(&host.hostname) {
        debug_log(
            "WARN",
            "RDP_LAUNCH",
            &format!("Failed to update last connected timestamp: {}", e),
            None,
        );
    } else {
        // Emit event to refresh UI
        if let Some(main_window) = app_handle.get_webview_window("main") {
            let _ = main_window.emit("host-connected", &host.hostname);
        }

        // Rebuild tray menu to update recent connections
        if let Some(tray) = app_handle.tray_by_id("main") {
            let current_theme = super::theme::get_theme_or_default(app_handle.clone());
            if let Ok(new_menu) = build_tray_menu(&app_handle, &current_theme) {
                let _ = tray.set_menu(Some(new_menu));
            }
        }
    }

    Ok(())
}

/// Tauri command to scan Active Directory for Windows Servers via LDAP.
///
/// This is a thin wrapper that delegates to the core LDAP scanner and handles CSV writing and UI events.
///
/// # Side Effects
/// - Connects to LDAP server (port 389)
/// - Authenticates with stored credentials
/// - Searches Active Directory
/// - Writes results to hosts.csv
/// - Emits "hosts-updated" event to refresh UI
/// - Sets hosts window to always-on-top during scan
#[tauri::command]
pub async fn scan_domain(
    app_handle: tauri::AppHandle,
    domain: String,
    server: String,
) -> Result<String, String> {
    // Set hosts window to always on top during scan
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.set_always_on_top(true);
    }

    // Get credentials
    let credentials = commands::get_stored_credentials().await?.ok_or_else(|| {
        "No stored credentials found. Please save your domain credentials in the login window first."
            .to_string()
    })?;

    // Perform LDAP scan using core module
    let result = core::ldap::scan_domain_for_servers(&domain, &server, &credentials)
        .await
        .map_err(|e| e.to_string());

    // Reset window always on top
    if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
        let _ = hosts_window.set_always_on_top(false);
    }

    // Write results to CSV if successful
    if let Ok(scan_result) = &result {
        let csv_path = crate::infra::get_hosts_csv_path()?;
        core::csv_writer::write_hosts_to_csv(&csv_path, &scan_result.hosts)
            .map_err(|e| e.to_string())?;

        // Emit UI events
        if let Some(main_window) = app_handle.get_webview_window("main") {
            let _ = main_window.emit("hosts-updated", ());
        }
        if let Some(hosts_window) = app_handle.get_webview_window("hosts") {
            let _ = hosts_window.emit("hosts-updated", ());
        }

        Ok(format!(
            "Successfully found {} Windows Server(s).",
            scan_result.count
        ))
    } else {
        result.map(|r| format!("Successfully found {} Windows Server(s).", r.count))
    }
}

/// Tauri command to reset the application to factory defaults.
///
/// This is a thin wrapper that uses the WindowsCredentialManager adapter to delete credentials safely.
///
/// # Side Effects
/// - Deletes all QuickConnect credentials from Windows Credential Manager
/// - Deletes all TERMSRV/* credentials
/// - Deletes all RDP files in %APPDATA%\QuickConnect\Connections
/// - Clears hosts.csv
/// - Deletes recent_connections.json
#[tauri::command]
pub async fn reset_application(app_handle: tauri::AppHandle) -> Result<String, String> {
    debug_log(
        "WARN",
        "RESET",
        "Application reset initiated - deleting all credentials and data",
        None,
    );

    let mut report = String::from("=== QuickConnect Application Reset ===\n\n");
    let cred_manager = WindowsCredentialManager::new();

    // 1. Delete global credentials
    match commands::delete_credentials().await {
        Ok(_) => {
            report.push_str("✓ Deleted global QuickConnect credentials\n");
            debug_log("INFO", "RESET", "Deleted global credentials", None);
        }
        Err(e) => {
            report.push_str(&format!("✗ Failed to delete global credentials: {}\n", e));
        }
    }

    // 2. Delete all TERMSRV/* credentials using adapter
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

    // 3. Delete all RDP files
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

    // 4. Delete hosts.csv
    match commands::delete_all_hosts(app_handle).await {
        Ok(_) => report.push_str("\n✓ Cleared hosts.csv\n"),
        Err(e) => report.push_str(&format!("\n✗ Failed to clear hosts.csv: {}\n", e)),
    }

    // 5. Delete recent_connections.json
    if let Ok(appdata_dir) = std::env::var("APPDATA") {
        let recent_file = PathBuf::from(appdata_dir)
            .join("QuickConnect")
            .join("recent_connections.json");
        if recent_file.exists() {
            match std::fs::remove_file(&recent_file) {
                Ok(_) => report.push_str("✓ Deleted recent connections history\n"),
                Err(e) => report.push_str(&format!("✗ Failed to delete recent connections: {}\n", e)),
            }
        }
    }

    report.push_str("\n=== Reset Complete ===\n");
    report.push_str("The application has been reset to its initial state.\n");
    report.push_str("Please restart the application.\n");

    Ok(report)
}

/// Tauri command to check if autostart is enabled.
///
/// Uses WindowsRegistry adapter to safely check registry without unsafe blocks.
#[tauri::command]
pub fn check_autostart() -> Result<bool, String> {
    let registry = WindowsRegistry::new();
    match registry.read_string(REGISTRY_RUN_KEY, APP_NAME) {
        Ok(Some(_)) => Ok(true),
        Ok(None) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Toggles autostart on/off.
#[tauri::command]
pub fn toggle_autostart() -> Result<bool, String> {
    let is_enabled = check_autostart()?;

    if is_enabled {
        // Disable autostart - remove from registry
        disable_autostart()?;
        Ok(false)
    } else {
        // Enable autostart - add to registry
        enable_autostart()?;
        Ok(true)
    }
}

/// Enables autostart using WindowsRegistry adapter.
///
/// # Side Effects
/// - Writes executable path to HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
fn enable_autostart() -> Result<(), String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    let exe_path_str = exe_path.to_string_lossy().to_string();

    debug_log(
        "INFO",
        "AUTOSTART",
        &format!("Enabling autostart with path: {}", exe_path_str),
        None,
    );

    let registry = WindowsRegistry::new();
    registry
        .write_string(REGISTRY_RUN_KEY, APP_NAME, &exe_path_str)
        .map_err(|e| e.to_string())?;

    debug_log("INFO", "AUTOSTART", "Autostart enabled successfully", None);
    Ok(())
}

/// Disables autostart using WindowsRegistry adapter.
///
/// # Side Effects
/// - Deletes value from HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
fn disable_autostart() -> Result<(), String> {
    debug_log("INFO", "AUTOSTART", "Disabling autostart", None);

    let registry = WindowsRegistry::new();
    registry
        .delete_value(REGISTRY_RUN_KEY, APP_NAME)
        .map_err(|e| e.to_string())?;

    debug_log("INFO", "AUTOSTART", "Autostart disabled successfully", None);
    Ok(())
}

/// Helper function to build tray menu with theme awareness
pub fn build_tray_menu(
    app: &tauri::AppHandle,
    current_theme: &str,
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    // Check autostart status
    let autostart_enabled = check_autostart().unwrap_or(false);
    let autostart_text = if autostart_enabled {
        "✓ Autostart with Windows"
    } else {
        "✗ Autostart with Windows"
    };
    let autostart_item =
        MenuItem::with_id(app, "toggle_autostart", autostart_text, true, None::<&str>)?;

    // Create theme menu items with checkmarks
    let theme_light = MenuItem::with_id(
        app,
        "theme_light",
        if current_theme == "light" {
            "✓ Light"
        } else {
            "✗ Light"
        },
        true,
        None::<&str>,
    )?;
    let theme_dark = MenuItem::with_id(
        app,
        "theme_dark",
        if current_theme == "dark" {
            "✓ Dark"
        } else {
            "✗ Dark"
        },
        true,
        None::<&str>,
    )?;

    let theme_submenu = Submenu::with_items(app, "Theme", true, &[&theme_light, &theme_dark])?;

    // Create recent connections submenu
    let recent_connections = load_recent_connections().unwrap_or_else(|_| RecentConnections::new());

    let recent_submenu = if recent_connections.connections.is_empty() {
        let no_recent = MenuItem::with_id(
            app,
            "no_recent",
            "No recent connections",
            false,
            None::<&str>,
        )?;
        Submenu::with_items(app, "Recent Connections", true, &[&no_recent])?
    } else {
        // Build submenu with actual recent items
        let items: Vec<_> = recent_connections
            .connections
            .iter()
            .map(|conn| {
                let label = if conn.description.is_empty() {
                    conn.hostname.clone()
                } else {
                    format!("{} - {}", conn.hostname, conn.description)
                };
                let menu_id = format!("recent_{}", conn.hostname);
                MenuItem::with_id(app, &menu_id, &label, true, None::<&str>)
            })
            .collect::<Result<Vec<_>, _>>()?;

        let item_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = items
            .iter()
            .map(|item| item as &dyn tauri::menu::IsMenuItem<tauri::Wry>)
            .collect();
        Submenu::with_items(app, "Recent Connections", true, &item_refs)?
    };

    let about_item = MenuItem::with_id(app, "about", "About QuickConnect", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &recent_submenu,
            &theme_submenu,
            &autostart_item,
            &about_item,
            &separator,
            &quit_item,
        ],
    )
    .map_err(|e| e.into())
}

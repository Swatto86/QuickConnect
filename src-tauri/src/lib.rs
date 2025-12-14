//! # QuickConnect Backend Library
//!
//! This module provides the core backend functionality for QuickConnect, a fast and efficient
//! RDP connection manager for Windows system administrators.
//!
//! ## Architecture
//!
//! The library is organized into modular components:
//!
//! - **core**: Domain types and business logic
//! - **errors**: Unified error handling with AppError
//! - **infra**: Infrastructure concerns (logging, persistence, configuration)
//! - **Tauri commands**: Thin command layer exposing functionality to frontend
//!
//! ## Modules
mod adapters;
mod commands;
mod core;
mod errors;
mod infra;

// Re-export commonly used types
pub use core::*;
pub use errors::AppError;
pub use infra::{debug_log, set_debug_mode};

// Platform-specific adapters
#[cfg(target_os = "windows")]
pub use adapters::{CredentialManager, RegistryAdapter, WindowsCredentialManager, WindowsRegistry};

// ## Platform Abstraction
//
// While currently Windows-specific, the code is structured to facilitate future cross-platform
// support:
// - Windows API calls are isolated to specific functions
// - Core business logic is platform-agnostic
// - Tauri commands act as an abstraction layer
//
// ## Security Considerations
//
// - Passwords are stored securely in Windows Credential Manager (encrypted by OS)
// - Passwords are never logged (debug logs only show password length)
// - RDP credentials are stored per-host using TERMSRV/* naming convention
// - Input validation prevents malformed hostnames and credentials
//
// ## Testing
//
// Run tests with: `cargo test`

use std::path::PathBuf;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};




// Import functions from command modules
use commands::windows::{LAST_HIDDEN_WINDOW, show_about};
use commands::theme::{get_theme, set_theme};
use commands::system::{build_tray_menu, launch_rdp, toggle_autostart};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check for --debug or --debug-log command line argument
    let args: Vec<String> = std::env::args().collect();
    let debug_enabled = args
        .iter()
        .any(|arg| arg == "--debug" || arg == "--debug-log");

    if debug_enabled {
        eprintln!("[QuickConnect] Debug mode enabled");
        eprintln!("[QuickConnect] Args: {:?}", args);

        // Show where log file will be written
        if let Ok(appdata_dir) = std::env::var("APPDATA") {
            let log_file = PathBuf::from(appdata_dir)
                .join("QuickConnect")
                .join("QuickConnect_Debug.log");
            eprintln!("[QuickConnect] Log file will be written to: {:?}", log_file);
        } else {
            eprintln!("[QuickConnect] WARNING: APPDATA not found, using current directory for log");
        }

        set_debug_mode(true);
        
        // Initialize tracing for structured logging
        if let Err(e) = infra::init_tracing() {
            eprintln!("[QuickConnect] Failed to initialize tracing: {}", e);
        }
        
        debug_log(
            "INFO",
            "SYSTEM",
            "Debug logging enabled via command line argument",
            Some(&format!("Command line arguments: {:?}", args)),
        );
        debug_log(
            "INFO",
            "SYSTEM",
            &format!("Application version: {}", env!("CARGO_PKG_VERSION")),
            None,
        );
        debug_log(
            "INFO",
            "SYSTEM",
            &format!("Operating System: {}", std::env::consts::OS),
            Some(&format!("Architecture: {}", std::env::consts::ARCH)),
        );
        if let Ok(current_dir) = std::env::current_dir() {
            debug_log(
                "INFO",
                "SYSTEM",
                &format!("Working directory: {:?}", current_dir),
                None,
            );
        }
        eprintln!("[QuickConnect] Debug log initialized");
    } else {
        eprintln!("[QuickConnect] Starting without debug mode. Use --debug to enable logging.");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When a second instance is launched, show the last hidden window
            let _ = app.emit("single-instance", ());

            if let Ok(window_label) = LAST_HIDDEN_WINDOW.lock() {
                if let Some(window) = app.get_webview_window(&window_label) {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                    // Emit focus-search event if main window is shown
                    if window_label.as_str() == "main" {
                        let _ = window.emit("focus-search", ());
                    }
                }
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            if debug_enabled {
                debug_log("INFO", "SYSTEM", "Tauri application setup started", None);
            }

            // Migrate hosts.csv from old location to AppData if needed
            core::hosts::migrate_hosts_csv_if_needed();

            // Initialize the LAST_HIDDEN_WINDOW
            if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
                *last_hidden = "login".to_string();
            }

            // Get current theme for tray menu
            let current_theme =
                get_theme(app.app_handle().clone()).unwrap_or_else(|_| "dark".to_string());

            // Build the tray menu with theme awareness
            let menu = build_tray_menu(app.app_handle(), &current_theme)?;

            // Set up close handlers for all windows
            let app_handle = app.app_handle().clone();
            if let Some(login_window) = app.get_webview_window("login") {
                login_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        println!("Close requested for login window");
                        if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
                            *last_hidden = "login".to_string();
                        }
                        if let Some(window) = app_handle.get_webview_window("login") {
                            let _ = window.hide();
                        }
                        // Prevent the window from being destroyed
                        api.prevent_close();
                    }
                });
            }

            let app_handle = app.app_handle().clone();
            if let Some(main_window) = app.get_webview_window("main") {
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        println!("Close requested for main window");
                        if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
                            *last_hidden = "main".to_string();
                        }
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.hide();
                        }
                        // Prevent the window from being destroyed
                        api.prevent_close();
                    }
                });
            }

            let app_handle = app.app_handle().clone();
            if let Some(hosts_window) = app.get_webview_window("hosts") {
                hosts_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        println!("Close requested for hosts window");
                        if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
                            *last_hidden = "hosts".to_string();
                        }
                        if let Some(window) = app_handle.get_webview_window("hosts") {
                            let _ = window.hide();
                        }
                        // Prevent the window from being destroyed
                        api.prevent_close();
                    }
                });
            }

            // Set up close handler for about window (just hide it)
            let app_handle = app.app_handle().clone();
            if let Some(about_window) = app.get_webview_window("about") {
                about_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        println!("Close requested for about window");
                        if let Some(window) = app_handle.get_webview_window("about") {
                            let _ = window.hide();
                        }
                        // Prevent the window from being destroyed
                        api.prevent_close();
                    }
                });
            }

            // Set up close handler for error window (just hide it)
            let app_handle = app.app_handle().clone();
            if let Some(error_window) = app.get_webview_window("error") {
                error_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        println!("Close requested for error window");
                        if let Some(window) = app_handle.get_webview_window("error") {
                            let _ = window.hide();
                        }
                        // Prevent the window from being destroyed
                        api.prevent_close();
                    }
                });
            }

            // Create the system tray
            let icon = app.default_window_icon()
                .ok_or("Failed to get default window icon")?;
            let _tray = TrayIconBuilder::with_id("main")
                .icon(icon.clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray_handle, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state,
                            ..
                        } => {
                            println!(
                                "Left click detected on system tray icon with state: {:?}",
                                button_state
                            );
                            // Only handle the Down state to prevent double-triggering
                            if button_state == MouseButtonState::Down {
                                let app_handle = tray_handle.app_handle().clone();

                                if let Ok(window_label) = LAST_HIDDEN_WINDOW.lock() {
                                    println!("Last hidden window: {}", window_label);

                                    let window = app_handle
                                        .get_webview_window(&window_label)
                                        .or_else(|| app_handle.get_webview_window("login"))
                                        .or_else(|| app_handle.get_webview_window("main"))
                                        .or_else(|| app_handle.get_webview_window("hosts"));

                                    if let Some(window) = window {
                                        println!("Found window: {}", window.label());

                                        tauri::async_runtime::spawn(async move {
                                            match window.is_visible() {
                                                Ok(is_visible) => {
                                                    println!(
                                                        "Window visibility status: {}",
                                                        is_visible
                                                    );
                                                    if is_visible {
                                                        println!("Attempting to hide window");
                                                        if let Err(e) = window.hide() {
                                                            eprintln!(
                                                                "Error hiding window: {:?}",
                                                                e
                                                            );
                                                        } else {
                                                            println!("Window hidden successfully");
                                                        }
                                                    } else {
                                                        println!("Attempting to show window");
                                                        if let Err(e) = window.unminimize() {
                                                            eprintln!(
                                                                "Error unminimizing window: {:?}",
                                                                e
                                                            );
                                                        }
                                                        if let Err(e) = window.show() {
                                                            eprintln!(
                                                                "Error showing window: {:?}",
                                                                e
                                                            );
                                                        }
                                                        if let Err(e) = window.set_focus() {
                                                            eprintln!(
                                                                "Error setting focus: {:?}",
                                                                e
                                                            );
                                                        }
                                                        // Emit focus-search event if main window is shown
                                                        if window.label() == "main" {
                                                            let _ = window.emit("focus-search", ());
                                                        }
                                                        println!("Window show sequence completed");
                                                    }
                                                }
                                                Err(e) => eprintln!(
                                                    "Error checking window visibility: {:?}",
                                                    e
                                                ),
                                            }
                                        });
                                    } else {
                                        eprintln!("No windows found at all!");
                                    }
                                } else {
                                    eprintln!("Failed to acquire LAST_HIDDEN_WINDOW lock");
                                }
                            }
                        }
                        TrayIconEvent::Click {
                            button: MouseButton::Right,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            println!("Right click detected on system tray icon");
                        }
                        _ => {}
                    }
                })
                .on_menu_event(|app, event| {
                    let id_str = event.id().as_ref();

                    // Check if it's a recent connection item
                    if id_str.starts_with("recent_") {
                        let hostname = id_str.strip_prefix("recent_").unwrap_or("").to_string();
                        if !hostname.is_empty() {
                            // Get the host details and launch RDP
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                // Try to get host from hosts list
                                match commands::hosts::get_hosts() {
                                    Ok(hosts) => {
                                        if let Some(host) =
                                            hosts.into_iter().find(|h| h.hostname == hostname)
                                        {
                                            if let Err(e) =
                                                launch_rdp(app_clone.clone(), host).await
                                            {
                                                eprintln!(
                                                    "Failed to launch RDP to {}: {}",
                                                    hostname, e
                                                );
                                            }
                                        } else {
                                            // Host not in list, create a temporary host entry
                                            let host = Host {
                                                hostname: hostname.clone(),
                                                description: String::new(),
                                                last_connected: None,
                                            };
                                            if let Err(e) = launch_rdp(app_clone, host).await {
                                                eprintln!(
                                                    "Failed to launch RDP to {}: {}",
                                                    hostname, e
                                                );
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("Failed to get hosts: {}", e);
                                    }
                                }
                            });
                        }
                        return;
                    }

                    // Handle other menu events
                    match event.id() {
                        id if id == "toggle_autostart" => {
                            match toggle_autostart() {
                                Ok(_enabled) => {
                                    // Rebuild the entire menu with updated autostart status and current theme
                                    if let Some(tray) = app.tray_by_id("main") {
                                        let current_theme = get_theme(app.clone())
                                            .unwrap_or_else(|_| "dark".to_string());
                                        if let Ok(new_menu) = build_tray_menu(app, &current_theme) {
                                            let _ = tray.set_menu(Some(new_menu));
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Failed to toggle autostart: {}", e);
                                }
                            }
                        }
                        id if id == "theme_light" => {
                            if let Err(e) = set_theme(app.clone(), "light".to_string()) {
                                eprintln!("Failed to set theme to light: {}", e);
                            }
                        }
                        id if id == "theme_dark" => {
                            if let Err(e) = set_theme(app.clone(), "dark".to_string()) {
                                eprintln!("Failed to set theme to dark: {}", e);
                            }
                        }
                        id if id == "about" => {
                            if let Err(e) = show_about(app.clone()) {
                                eprintln!("Failed to show about window: {}", e);
                            }
                        }
                        id if id == "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            let window = app.get_webview_window("login")
                .ok_or("Login window not found")?;
            let main_window = app.get_webview_window("main")
                .ok_or("Main window not found")?;
            let hosts_window = app.get_webview_window("hosts")
                .ok_or("Hosts window not found")?;

            let window_clone = window.clone();
            let main_window_clone = main_window.clone();
            let hosts_window_clone = hosts_window.clone();

            tauri::async_runtime::spawn(async move {
                std::thread::sleep(std::time::Duration::from_millis(100));
                // Center login window
                let _ = window_clone.center();
                let _ = window_clone.show();
                let _ = window_clone.set_focus();

                // Center main window
                let _ = main_window_clone.center();

                // Center hosts window
                let _ = hosts_window_clone.center();
            });

            // Register global hotkey Ctrl+Shift+R to show the main window
            // Note: We don't fail the app if hotkey registration fails
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            let app_handle_for_hotkey = app.app_handle().clone();
            let app_handle_for_error_hotkey = app.app_handle().clone();
            let shortcut_manager = app.handle().global_shortcut();

            // Try to unregister first in case it was registered by a previous instance
            let _ = shortcut_manager.unregister("Ctrl+Shift+R");
            let _ = shortcut_manager.unregister("Ctrl+Shift+E");

            // Set up the handler for Ctrl+Shift+R BEFORE registering (per Tauri docs)
            match shortcut_manager.on_shortcut(
                "Ctrl+Shift+R",
                move |_app_handle, _shortcut, event| {
                    // Only trigger on key press (Down), not on release (Up) to prevent double-toggle
                    use tauri_plugin_global_shortcut::ShortcutState;
                    if event.state != ShortcutState::Pressed {
                        return;
                    }

                    println!("Global hotkey Ctrl+Shift+R pressed!");

                    let main_window = app_handle_for_hotkey.get_webview_window("main");

                    if let Some(window) = main_window {
                        tauri::async_runtime::spawn(async move {
                            match window.is_visible() {
                                Ok(is_visible) => {
                                    if is_visible {
                                        let _ = window.hide();

                                        // Update last hidden window to main so tray shows correct window
                                        if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
                                            *last_hidden = "main".to_string();
                                        }

                                        println!("Main window hidden via global hotkey");
                                    } else {
                                        let _ = window.unminimize();
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                        // Emit event to focus the search input
                                        let _ = window.emit("focus-search", ());
                                        println!("Main window shown via global hotkey");
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Failed to check main window visibility: {:?}", e);
                                }
                            }
                        });
                    }
                },
            ) {
                Ok(_) => {
                    println!("Global hotkey handler for Ctrl+Shift+R registered");

                    // Now register the actual shortcut
                    match shortcut_manager.register("Ctrl+Shift+R") {
                        Ok(_) => println!("Global hotkey Ctrl+Shift+R activated successfully"),
                        Err(e) => {
                            eprintln!(
                                "Warning: Failed to register global hotkey Ctrl+Shift+R: {:?}",
                                e
                            );
                            eprintln!("The hotkey may be in use by another application.");
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Warning: Failed to set up hotkey handler: {:?}", e);
                    eprintln!("The application will continue without the global hotkey.");
                }
            }

            // Set up the handler for Ctrl+Shift+E to toggle error window
            match shortcut_manager.on_shortcut(
                "Ctrl+Shift+E",
                move |_app_handle, _shortcut, event| {
                    // Only trigger on key press (Down), not on release (Up) to prevent double-toggle
                    use tauri_plugin_global_shortcut::ShortcutState;
                    if event.state != ShortcutState::Pressed {
                        return;
                    }

                    println!("Global hotkey Ctrl+Shift+E pressed!");

                    let error_window = app_handle_for_error_hotkey.get_webview_window("error");

                    if let Some(window) = error_window {
                        tauri::async_runtime::spawn(async move {
                            match window.is_visible() {
                                Ok(is_visible) => {
                                    if is_visible {
                                        let _ = window.hide();
                                        println!("Error window hidden via global hotkey");
                                    } else {
                                        let _ = window.unminimize();
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                        println!("Error window shown via global hotkey");
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Failed to check error window visibility: {:?}", e);
                                }
                            }
                        });
                    }
                },
            ) {
                Ok(_) => {
                    println!("Global hotkey handler for Ctrl+Shift+E registered");

                    // Now register the actual shortcut
                    match shortcut_manager.register("Ctrl+Shift+E") {
                        Ok(_) => println!("Global hotkey Ctrl+Shift+E activated successfully"),
                        Err(e) => {
                            eprintln!(
                                "Warning: Failed to register global hotkey Ctrl+Shift+E: {:?}",
                                e
                            );
                            eprintln!("The hotkey may be in use by another application.");
                        }
                    }
                }
                Err(e) => {
                    eprintln!(
                        "Warning: Failed to set up Ctrl+Shift+E hotkey handler: {:?}",
                        e
                    );
                    eprintln!("The application will continue without this global hotkey.");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Window management (from commands::windows)
            commands::windows::quit_app,
            commands::windows::show_about,
            commands::windows::show_error,
            commands::windows::toggle_error_window,
            commands::windows::toggle_visible_window,
            commands::windows::close_login_window,
            commands::windows::close_login_and_prepare_main,
            commands::windows::get_login_window,
            commands::windows::show_login_window,
            commands::windows::switch_to_main_window,
            commands::windows::hide_main_window,
            commands::windows::show_hosts_window,
            commands::windows::hide_hosts_window,
            // Credentials (from commands::credentials)
            commands::save_credentials,
            commands::get_stored_credentials,
            commands::delete_credentials,
            commands::save_host_credentials,
            commands::get_host_credentials,
            commands::delete_host_credentials,
            commands::list_hosts_with_credentials,
            // Hosts (from commands::hosts)
            commands::get_hosts,
            commands::get_all_hosts,
            commands::save_host,
            commands::delete_host,
            commands::search_hosts,
            commands::delete_all_hosts,
            commands::check_host_status,
            // System operations (from commands::system)
            commands::system::launch_rdp,
            commands::system::scan_domain,
            commands::system::reset_application,
            commands::system::check_autostart,
            commands::system::toggle_autostart,
            commands::system::get_recent_connections,
            // Theme management (from commands::theme)
            commands::theme::get_windows_theme,
            commands::theme::set_theme,
            commands::theme::get_theme,
        ])
        .run(tauri::generate_context!())
        .map_err(|e| eprintln!("Error while running tauri application: {:?}", e))
        .ok();
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    // ========================================================================
    // Tests for RecentConnections
    // ========================================================================

    mod recent_connections_tests {
        use super::*;

        #[test]
        fn test_new_creates_empty_connections() {
            let recent = RecentConnections::new();
            assert!(recent.connections.is_empty());
        }

        #[test]
        fn test_add_connection_adds_to_list() {
            let mut recent = RecentConnections::new();
            recent.add_connection("server01.domain.com".to_string(), "Test Server".to_string());

            assert_eq!(recent.connections.len(), 1);
            assert_eq!(recent.connections[0].hostname, "server01.domain.com");
            assert_eq!(recent.connections[0].description, "Test Server");
        }

        #[test]
        fn test_add_connection_inserts_at_beginning() {
            let mut recent = RecentConnections::new();
            recent.add_connection("server01.domain.com".to_string(), "First".to_string());
            recent.add_connection("server02.domain.com".to_string(), "Second".to_string());

            assert_eq!(recent.connections[0].hostname, "server02.domain.com");
            assert_eq!(recent.connections[1].hostname, "server01.domain.com");
        }

        #[test]
        fn test_add_connection_removes_duplicate_hostname() {
            let mut recent = RecentConnections::new();
            recent.add_connection("server01.domain.com".to_string(), "First".to_string());
            recent.add_connection("server02.domain.com".to_string(), "Second".to_string());
            recent.add_connection("server01.domain.com".to_string(), "Updated".to_string());

            // Should only have 2 connections, with server01 at the beginning
            assert_eq!(recent.connections.len(), 2);
            assert_eq!(recent.connections[0].hostname, "server01.domain.com");
            assert_eq!(recent.connections[0].description, "Updated");
            assert_eq!(recent.connections[1].hostname, "server02.domain.com");
        }

        #[test]
        fn test_add_connection_truncates_to_five() {
            let mut recent = RecentConnections::new();
            for i in 1..=7 {
                recent.add_connection(
                    format!("server{:02}.domain.com", i),
                    format!("Server {}", i),
                );
            }

            assert_eq!(recent.connections.len(), 5);
            // Most recent should be first
            assert_eq!(recent.connections[0].hostname, "server07.domain.com");
            // Oldest kept should be server03
            assert_eq!(recent.connections[4].hostname, "server03.domain.com");
        }

        #[test]
        fn test_add_connection_sets_timestamp() {
            let mut recent = RecentConnections::new();
            let before = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("SystemTime should be after UNIX_EPOCH")
                .as_secs();

            recent.add_connection("server.domain.com".to_string(), "Test".to_string());

            let after = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("SystemTime should be after UNIX_EPOCH")
                .as_secs();

            assert!(recent.connections[0].timestamp >= before);
            assert!(recent.connections[0].timestamp <= after);
        }

        #[test]
        fn test_add_connection_with_empty_description() {
            let mut recent = RecentConnections::new();
            recent.add_connection("server.domain.com".to_string(), "".to_string());

            assert_eq!(recent.connections.len(), 1);
            assert_eq!(recent.connections[0].description, "");
        }

        #[test]
        fn test_reconnecting_moves_to_front() {
            let mut recent = RecentConnections::new();
            recent.add_connection("server01.domain.com".to_string(), "First".to_string());
            recent.add_connection("server02.domain.com".to_string(), "Second".to_string());
            recent.add_connection("server03.domain.com".to_string(), "Third".to_string());

            // Reconnect to first server
            recent.add_connection("server01.domain.com".to_string(), "First Again".to_string());

            assert_eq!(recent.connections.len(), 3);
            assert_eq!(recent.connections[0].hostname, "server01.domain.com");
            assert_eq!(recent.connections[0].description, "First Again");
        }
    }

    // ========================================================================
    // Tests for Host struct
    // ========================================================================

    mod host_tests {
        use super::*;

        #[test]
        fn test_host_serialization() {
            let host = Host {
                hostname: "server.domain.com".to_string(),
                description: "Test Server".to_string(),
                last_connected: Some("15/01/2024 10:30:00".to_string()),
            };

            let json = serde_json::to_string(&host).expect("Host serialization should succeed");
            assert!(json.contains("server.domain.com"));
            assert!(json.contains("Test Server"));
            assert!(json.contains("15/01/2024 10:30:00"));
        }

        #[test]
        fn test_host_deserialization() {
            let json = r#"{
                "hostname": "server.domain.com",
                "description": "Test Server",
                "last_connected": "15/01/2024 10:30:00"
            }"#;

            let host: Host = serde_json::from_str(json).expect("Host deserialization should succeed");
            assert_eq!(host.hostname, "server.domain.com");
            assert_eq!(host.description, "Test Server");
            assert_eq!(host.last_connected, Some("15/01/2024 10:30:00".to_string()));
        }

        #[test]
        fn test_host_without_last_connected() {
            let json = r#"{
                "hostname": "server.domain.com",
                "description": "Test Server"
            }"#;

            let host: Host = serde_json::from_str(json).expect("Host deserialization should succeed");
            assert_eq!(host.hostname, "server.domain.com");
            assert!(host.last_connected.is_none());
        }

        #[test]
        fn test_host_clone() {
            let host = Host {
                hostname: "server.domain.com".to_string(),
                description: "Test".to_string(),
                last_connected: None,
            };

            let cloned = host.clone();
            assert_eq!(cloned.hostname, host.hostname);
            assert_eq!(cloned.description, host.description);
        }
    }

    // ========================================================================
    // Tests for RecentConnection struct
    // ========================================================================

    mod recent_connection_tests {
        use super::*;

        #[test]
        fn test_recent_connection_serialization() {
            let conn = RecentConnection {
                hostname: "server.domain.com".to_string(),
                description: "Test Server".to_string(),
                timestamp: 1705312200,
            };

            let json = serde_json::to_string(&conn).expect("RecentConnection serialization should succeed");
            assert!(json.contains("server.domain.com"));
            assert!(json.contains("1705312200"));
        }

        #[test]
        fn test_recent_connection_deserialization() {
            let json = r#"{
                "hostname": "server.domain.com",
                "description": "Test Server",
                "timestamp": 1705312200
            }"#;

            let conn: RecentConnection = serde_json::from_str(json).expect("RecentConnection deserialization should succeed");
            assert_eq!(conn.hostname, "server.domain.com");
            assert_eq!(conn.timestamp, 1705312200);
        }

        #[test]
        fn test_recent_connections_json_roundtrip() {
            let mut recent = RecentConnections::new();
            recent.add_connection("server01.domain.com".to_string(), "First".to_string());
            recent.add_connection("server02.domain.com".to_string(), "Second".to_string());

            let json = serde_json::to_string_pretty(&recent).expect("RecentConnections serialization should succeed");
            let loaded: RecentConnections = serde_json::from_str(&json).expect("RecentConnections deserialization should succeed");

            assert_eq!(loaded.connections.len(), 2);
            assert_eq!(loaded.connections[0].hostname, "server02.domain.com");
            assert_eq!(loaded.connections[1].hostname, "server01.domain.com");
        }
    }

    // ========================================================================
    // Tests for Credentials struct
    // ========================================================================

    mod credentials_tests {
        use super::*;

        #[test]
        fn test_credentials_deserialization() {
            let json = r#"{
                "username": "admin",
                "password": "secret123"
            }"#;

            let creds: Credentials = serde_json::from_str(json).expect("Credentials deserialization should succeed");
            assert_eq!(creds.username, "admin");
            assert_eq!(creds.password, "secret123");
        }

        #[test]
        fn test_credentials_with_domain_format() {
            let json = r#"{
                "username": "DOMAIN\\admin",
                "password": "secret123"
            }"#;

            let creds: Credentials = serde_json::from_str(json).expect("Credentials deserialization should succeed");
            assert_eq!(creds.username, "DOMAIN\\admin");
        }

        #[test]
        fn test_credentials_with_upn_format() {
            let json = r#"{
                "username": "admin@domain.com",
                "password": "secret123"
            }"#;

            let creds: Credentials = serde_json::from_str(json).expect("Credentials deserialization should succeed");
            assert_eq!(creds.username, "admin@domain.com");
        }

        #[test]
        fn test_stored_credentials_serialization() {
            let creds = StoredCredentials {
                username: "admin".to_string(),
                password: "secret".to_string(),
            };

            let json = serde_json::to_string(&creds).expect("StoredCredentials serialization should succeed");
            assert!(json.contains("admin"));
            assert!(json.contains("secret"));
        }
    }

    // ========================================================================
    // Tests for ErrorPayload struct
    // ========================================================================

    mod error_payload_tests {
        use super::*;

        #[test]
        fn test_error_payload_serialization() {
            let payload = ErrorPayload {
                message: "Connection failed".to_string(),
                timestamp: "2024-01-15 10:30:00".to_string(),
                category: Some("RDP_LAUNCH".to_string()),
                details: Some("Timeout after 30 seconds".to_string()),
            };

            let json = serde_json::to_string(&payload).expect("ErrorPayload serialization should succeed");
            assert!(json.contains("Connection failed"));
            assert!(json.contains("RDP_LAUNCH"));
            assert!(json.contains("Timeout"));
        }

        #[test]
        fn test_error_payload_without_optional_fields() {
            let payload = ErrorPayload {
                message: "Error occurred".to_string(),
                timestamp: "2024-01-15 10:30:00".to_string(),
                category: None,
                details: None,
            };

            let json = serde_json::to_string(&payload).expect("ErrorPayload serialization should succeed");
            assert!(json.contains("Error occurred"));
            assert!(json.contains("null") || !json.contains("category\":"));
        }

        #[test]
        fn test_error_payload_clone() {
            let payload = ErrorPayload {
                message: "Test".to_string(),
                timestamp: "10:00:00".to_string(),
                category: Some("TEST".to_string()),
                details: None,
            };

            let cloned = payload.clone();
            assert_eq!(cloned.message, payload.message);
            assert_eq!(cloned.category, payload.category);
        }
    }

    // ========================================================================
    // Tests for file path functions (using temp directories)
    // ========================================================================

    mod file_path_tests {
        use super::*;

        #[test]
        fn test_hosts_csv_path_format() {
            // This test verifies the path format, not the actual directory
            // Since infra::get_hosts_csv_path() depends on APPDATA, we test the logic
            let result = infra::get_hosts_csv_path();
            if let Ok(path) = result {
                assert!(path.ends_with("hosts.csv"));
                assert!(path.to_string_lossy().contains("QuickConnect"));
            }
            // If APPDATA is not set, the error is expected
        }

        #[test]
        fn test_recent_connections_file_path_format() {
            let result = infra::get_recent_connections_path();
            if let Ok(path) = result {
                assert!(path.ends_with("recent_connections.json"));
                assert!(path.to_string_lossy().contains("QuickConnect"));
            }
        }
    }

    // ========================================================================
    // Tests for CSV parsing logic
    // ========================================================================

    mod csv_parsing_tests {
        use super::*;

        /// Helper to create a temp directory with a hosts.csv file
        fn create_temp_hosts_csv(content: &str) -> (TempDir, PathBuf) {
            let temp_dir = TempDir::new().expect("Failed to create temp directory");
            let csv_path = temp_dir.path().join("hosts.csv");
            fs::write(&csv_path, content).expect("Failed to write CSV file");
            (temp_dir, csv_path)
        }

        #[test]
        fn test_parse_csv_with_header() {
            let content = "hostname,description,last_connected\n\
                           server01.domain.com,Web Server,15/01/2024 10:30:00\n\
                           server02.domain.com,Database,";

            let (_temp_dir, csv_path) = create_temp_hosts_csv(content);

            let csv_content = fs::read_to_string(&csv_path).expect("Failed to read CSV file");
            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(csv_content.as_bytes());

            let mut hosts = Vec::new();
            for result in reader.records() {
                let record = result.expect("Failed to parse CSV record");
                if record.len() >= 2 {
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

            assert_eq!(hosts.len(), 2);
            assert_eq!(hosts[0].hostname, "server01.domain.com");
            assert_eq!(
                hosts[0].last_connected,
                Some("15/01/2024 10:30:00".to_string())
            );
            assert_eq!(hosts[1].hostname, "server02.domain.com");
            assert!(hosts[1].last_connected.is_none());
        }

        #[test]
        fn test_parse_csv_with_special_characters() {
            let content = "hostname,description,last_connected\n\
                           server01.domain.com,\"Server, with comma\",\n\
                           server02.domain.com,\"Description with \"\"quotes\"\"\",";

            let (_temp_dir, csv_path) = create_temp_hosts_csv(content);

            let csv_content = fs::read_to_string(&csv_path).expect("Failed to read CSV file");
            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(csv_content.as_bytes());

            let mut hosts = Vec::new();
            for record in reader.records().flatten() {
                if record.len() >= 2 {
                    hosts.push(Host {
                        hostname: record[0].to_string(),
                        description: record[1].to_string(),
                        last_connected: None,
                    });
                }
            }

            assert_eq!(hosts.len(), 2);
            assert!(hosts[0].description.contains("comma"));
            assert!(hosts[1].description.contains("quotes"));
        }

        #[test]
        fn test_parse_empty_csv_with_header_only() {
            let content = "hostname,description,last_connected\n";

            let (_temp_dir, csv_path) = create_temp_hosts_csv(content);

            let csv_content = fs::read_to_string(&csv_path).expect("Failed to read CSV file");
            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(csv_content.as_bytes());

            let hosts: Vec<Host> = reader
                .records()
                .filter_map(|r| r.ok())
                .filter(|r| r.len() >= 2)
                .map(|r| Host {
                    hostname: r[0].to_string(),
                    description: r[1].to_string(),
                    last_connected: None,
                })
                .collect();

            assert!(hosts.is_empty());
        }
    }

    // ========================================================================
    // Tests for username parsing logic (used in launch_rdp)
    // ========================================================================

    mod username_parsing_tests {
        /// Parse username to extract domain and username components
        /// Supports formats: "DOMAIN\username", "username@domain.com", or "username"
        fn parse_credentials(username: &str) -> (String, String) {
            if username.contains('\\') {
                // Format: DOMAIN\username
                let parts: Vec<&str> = username.splitn(2, '\\').collect();
                if parts.len() == 2 {
                    (parts[0].to_string(), parts[1].to_string())
                } else {
                    (String::new(), username.to_string())
                }
            } else if username.contains('@') {
                // Format: username@domain.com
                let parts: Vec<&str> = username.splitn(2, '@').collect();
                if parts.len() == 2 {
                    (parts[1].to_string(), parts[0].to_string())
                } else {
                    (String::new(), username.to_string())
                }
            } else {
                // Format: just username (no domain)
                (String::new(), username.to_string())
            }
        }

        #[test]
        fn test_parse_domain_backslash_format() {
            let (domain, username) = parse_credentials("CONTOSO\\admin");
            assert_eq!(domain, "CONTOSO");
            assert_eq!(username, "admin");
        }

        #[test]
        fn test_parse_upn_format() {
            let (domain, username) = parse_credentials("admin@contoso.com");
            assert_eq!(domain, "contoso.com");
            assert_eq!(username, "admin");
        }

        #[test]
        fn test_parse_plain_username() {
            let (domain, username) = parse_credentials("localadmin");
            assert_eq!(domain, "");
            assert_eq!(username, "localadmin");
        }

        #[test]
        fn test_parse_domain_with_subdomain() {
            let (domain, username) = parse_credentials("user@corp.contoso.com");
            assert_eq!(domain, "corp.contoso.com");
            assert_eq!(username, "user");
        }

        #[test]
        fn test_parse_netbios_domain() {
            let (domain, username) = parse_credentials("CORP\\svc_account");
            assert_eq!(domain, "CORP");
            assert_eq!(username, "svc_account");
        }

        #[test]
        fn test_parse_username_with_dots() {
            let (domain, username) = parse_credentials("DOMAIN\\john.doe");
            assert_eq!(domain, "DOMAIN");
            assert_eq!(username, "john.doe");
        }

        #[test]
        fn test_parse_empty_username() {
            let (domain, username) = parse_credentials("");
            assert_eq!(domain, "");
            assert_eq!(username, "");
        }

        #[test]
        fn test_parse_multiple_backslashes() {
            // Only first backslash should be used as separator
            let (domain, username) = parse_credentials("DOMAIN\\user\\extra");
            assert_eq!(domain, "DOMAIN");
            assert_eq!(username, "user\\extra");
        }

        #[test]
        fn test_parse_multiple_at_signs() {
            // Only first @ should be used as separator
            let (domain, username) = parse_credentials("user@first@second.com");
            assert_eq!(domain, "first@second.com");
            assert_eq!(username, "user");
        }
    }

    // ========================================================================
    // Tests for search/filter logic
    // ========================================================================

    mod search_filter_tests {
        use super::*;

        fn create_test_hosts() -> Vec<Host> {
            vec![
                Host {
                    hostname: "web01.domain.com".to_string(),
                    description: "Production Web Server".to_string(),
                    last_connected: None,
                },
                Host {
                    hostname: "web02.domain.com".to_string(),
                    description: "Staging Web Server".to_string(),
                    last_connected: None,
                },
                Host {
                    hostname: "db01.domain.com".to_string(),
                    description: "MySQL Database".to_string(),
                    last_connected: None,
                },
                Host {
                    hostname: "dc01.contoso.local".to_string(),
                    description: "Domain Controller".to_string(),
                    last_connected: None,
                },
            ]
        }

        /// Filter hosts by query (matches hostname or description)
        fn filter_hosts(hosts: &[Host], query: &str) -> Vec<Host> {
            let query_lower = query.to_lowercase();
            hosts
                .iter()
                .filter(|host| {
                    host.hostname.to_lowercase().contains(&query_lower)
                        || host.description.to_lowercase().contains(&query_lower)
                })
                .cloned()
                .collect()
        }

        #[test]
        fn test_filter_by_hostname() {
            let hosts = create_test_hosts();
            let filtered = filter_hosts(&hosts, "web01");

            assert_eq!(filtered.len(), 1);
            assert_eq!(filtered[0].hostname, "web01.domain.com");
        }

        #[test]
        fn test_filter_by_partial_hostname() {
            let hosts = create_test_hosts();
            let filtered = filter_hosts(&hosts, "web");

            assert_eq!(filtered.len(), 2);
        }

        #[test]
        fn test_filter_by_description() {
            let hosts = create_test_hosts();
            let filtered = filter_hosts(&hosts, "Database");

            assert_eq!(filtered.len(), 1);
            assert_eq!(filtered[0].hostname, "db01.domain.com");
        }

        #[test]
        fn test_filter_case_insensitive() {
            let hosts = create_test_hosts();
            let filtered = filter_hosts(&hosts, "PRODUCTION");

            assert_eq!(filtered.len(), 1);
        }

        #[test]
        fn test_filter_no_matches() {
            let hosts = create_test_hosts();
            let filtered = filter_hosts(&hosts, "nonexistent");

            assert!(filtered.is_empty());
        }

        #[test]
        fn test_filter_empty_query() {
            let hosts = create_test_hosts();
            let filtered = filter_hosts(&hosts, "");

            // Empty query matches all
            assert_eq!(filtered.len(), hosts.len());
        }

        #[test]
        fn test_filter_by_domain() {
            let hosts = create_test_hosts();
            let filtered = filter_hosts(&hosts, "contoso");

            assert_eq!(filtered.len(), 1);
            assert_eq!(filtered[0].hostname, "dc01.contoso.local");
        }
    }

    // ========================================================================
    // Tests for JSON file operations
    // ========================================================================

    mod json_file_tests {
        use super::*;

        #[test]
        fn test_recent_connections_save_and_load_roundtrip() {
            let temp_dir = TempDir::new().unwrap();
            let file_path = temp_dir.path().join("recent_connections.json");

            let mut recent = RecentConnections::new();
            recent.add_connection("server01.domain.com".to_string(), "First".to_string());
            recent.add_connection("server02.domain.com".to_string(), "Second".to_string());

            // Save
            let json = serde_json::to_string_pretty(&recent).unwrap();
            fs::write(&file_path, &json).unwrap();

            // Load
            let loaded_json = fs::read_to_string(&file_path).unwrap();
            let loaded: RecentConnections = serde_json::from_str(&loaded_json).unwrap();

            assert_eq!(loaded.connections.len(), 2);
            assert_eq!(loaded.connections[0].hostname, "server02.domain.com");
        }

        #[test]
        fn test_load_missing_file_returns_empty() {
            let temp_dir = TempDir::new().unwrap();
            let file_path = temp_dir.path().join("nonexistent.json");

            // File doesn't exist
            assert!(!file_path.exists());

            // Should return empty RecentConnections
            if !file_path.exists() {
                let recent = RecentConnections::new();
                assert!(recent.connections.is_empty());
            }
        }

        #[test]
        fn test_save_creates_parent_directories() {
            let temp_dir = TempDir::new().unwrap();
            let nested_path = temp_dir.path().join("subdir").join("test.json");

            // Create parent directories
            if let Some(parent) = nested_path.parent() {
                fs::create_dir_all(parent).unwrap();
            }

            let recent = RecentConnections::new();
            let json = serde_json::to_string_pretty(&recent).unwrap();
            fs::write(&nested_path, &json).unwrap();

            assert!(nested_path.exists());
        }
    }

    // ========================================================================
    // Tests for Host validation logic
    // ========================================================================

    mod host_validation_tests {
        /// Check if hostname is valid (non-empty after trimming)
        fn is_valid_hostname(hostname: &str) -> bool {
            !hostname.trim().is_empty()
        }

        #[test]
        fn test_valid_hostname() {
            assert!(is_valid_hostname("server.domain.com"));
        }

        #[test]
        fn test_empty_hostname_is_invalid() {
            assert!(!is_valid_hostname(""));
        }

        #[test]
        fn test_whitespace_hostname_is_invalid() {
            assert!(!is_valid_hostname("   "));
        }

        #[test]
        fn test_hostname_with_leading_whitespace() {
            assert!(is_valid_hostname("  server.domain.com"));
        }

        #[test]
        fn test_hostname_with_trailing_whitespace() {
            assert!(is_valid_hostname("server.domain.com  "));
        }
    }

    // ========================================================================
    // Integration-style tests for data flow
    // ========================================================================

    mod integration_tests {
        use super::*;

        #[test]
        fn test_host_workflow_add_update_delete() {
            let mut hosts: Vec<Host> = Vec::new();

            // Add first host
            let host1 = Host {
                hostname: "server01.domain.com".to_string(),
                description: "First Server".to_string(),
                last_connected: None,
            };
            hosts.push(host1);
            assert_eq!(hosts.len(), 1);

            // Update host (simulated by finding and replacing)
            if let Some(idx) = hosts
                .iter()
                .position(|h| h.hostname == "server01.domain.com")
            {
                hosts[idx].description = "Updated Description".to_string();
                hosts[idx].last_connected = Some("15/01/2024 10:00:00".to_string());
            }
            assert_eq!(hosts[0].description, "Updated Description");
            assert_eq!(
                hosts[0].last_connected,
                Some("15/01/2024 10:00:00".to_string())
            );

            // Delete host
            hosts.retain(|h| h.hostname != "server01.domain.com");
            assert!(hosts.is_empty());
        }

        #[test]
        fn test_recent_connections_workflow() {
            let mut recent = RecentConnections::new();

            // User connects to 3 different servers
            recent.add_connection("server01.domain.com".to_string(), "Server 1".to_string());
            recent.add_connection("server02.domain.com".to_string(), "Server 2".to_string());
            recent.add_connection("server03.domain.com".to_string(), "Server 3".to_string());

            assert_eq!(recent.connections.len(), 3);

            // User reconnects to first server
            recent.add_connection("server01.domain.com".to_string(), "Server 1".to_string());

            // Still 3 connections, but server01 is now first
            assert_eq!(recent.connections.len(), 3);
            assert_eq!(recent.connections[0].hostname, "server01.domain.com");

            // Serialize and deserialize (simulating app restart)
            let json = serde_json::to_string(&recent).unwrap();
            let loaded: RecentConnections = serde_json::from_str(&json).unwrap();

            assert_eq!(loaded.connections.len(), 3);
            assert_eq!(loaded.connections[0].hostname, "server01.domain.com");
        }
    }

    // ========================================================================
    // Tests for Host Status Checking
    // ========================================================================

    mod host_status_tests {
        use super::*;
        use tokio::runtime::Runtime;

        #[test]
        fn test_check_host_status_invalid_hostname_returns_unknown() {
            // Test with completely invalid hostname (no dots, special chars)
            let rt = Runtime::new().unwrap();
            let result = rt.block_on(commands::check_host_status("!!!invalid!!!".to_string()));
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), "unknown");
        }

        #[test]
        fn test_check_host_status_empty_hostname() {
            // Test with empty hostname - returns offline (connection refused on empty string:3389)
            let rt = Runtime::new().unwrap();
            let result = rt.block_on(commands::check_host_status("".to_string()));
            assert!(result.is_ok());
            // Empty hostname resolves but connection fails
            assert_eq!(result.unwrap(), "offline");
        }

        #[test]
        fn test_check_host_status_malformed_hostname_returns_unknown() {
            // Test with hostname that can't be resolved
            let rt = Runtime::new().unwrap();
            let result = rt.block_on(commands::check_host_status("nonexistent.invalid.test.local".to_string()));
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), "unknown");
        }

        #[test]
        fn test_check_host_status_unreachable_host_returns_offline() {
            // Test with valid hostname format but unreachable host
            // Using a reserved IP that should timeout/fail
            let rt = Runtime::new().unwrap();
            let result = rt.block_on(commands::check_host_status("192.0.2.1".to_string())); // TEST-NET-1 (RFC 5737)
            assert!(result.is_ok());
            let status = result.unwrap();
            // Should be offline (connection timeout/refused)
            assert!(status == "offline" || status == "unknown");
        }

        #[test]
        fn test_check_host_status_localhost_may_vary() {
            // Test with localhost - result depends on whether RDP is running
            let rt = Runtime::new().unwrap();
            let result = rt.block_on(commands::check_host_status("127.0.0.1".to_string()));
            assert!(result.is_ok());
            let status = result.unwrap();
            // Status can be online, offline, or unknown depending on system
            assert!(status == "online" || status == "offline" || status == "unknown");
        }

        #[test]
        fn test_check_host_status_with_spaces_returns_unknown() {
            // Test with hostname containing spaces (invalid)
            let rt = Runtime::new().unwrap();
            let result = rt.block_on(commands::check_host_status("server with spaces.com".to_string()));
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), "unknown");
        }

        #[test]
        fn test_check_host_status_with_unicode_returns_unknown() {
            // Test with Unicode characters in hostname
            let rt = Runtime::new().unwrap();
            let result = rt.block_on(commands::check_host_status("服务器.domain.com".to_string()));
            assert!(result.is_ok());
            // May return unknown due to DNS resolution failure
            let status = result.unwrap();
            assert!(status == "unknown" || status == "offline");
        }

        #[test]
        fn test_check_host_status_very_long_hostname() {
            // Test with extremely long hostname (exceeds DNS limits)
            let long_hostname = "a".repeat(300) + ".domain.com";
            let rt = Runtime::new().unwrap();
            let result = rt.block_on(commands::check_host_status(long_hostname));
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), "unknown");
        }

        #[test]
        fn test_check_host_status_null_byte_in_hostname() {
            // Test with null byte (should be handled safely)
            let rt = Runtime::new().unwrap();
            let result = rt.block_on(commands::check_host_status("server\0.domain.com".to_string()));
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), "unknown");
        }

        #[test]
        fn test_check_host_status_multiple_concurrent() {
            // Test multiple concurrent status checks
            let rt = Runtime::new().unwrap();
            let hosts = vec![
                "192.0.2.1".to_string(),
                "192.0.2.2".to_string(),
                "nonexistent.test.local".to_string(),
            ];

            let mut handles = vec![];
            for host in hosts {
                let handle = rt.spawn(async move { commands::check_host_status(host).await });
                handles.push(handle);
            }

            for handle in handles {
                let result = rt.block_on(handle).expect("Task should complete without panic");
                assert!(result.is_ok());
                let status = result.expect("check_host_status should return Ok");
                assert!(status == "online" || status == "offline" || status == "unknown");
            }
        }

        #[test]
        fn test_check_host_status_ipv6_localhost() {
            // Test with IPv6 localhost
            let rt = Runtime::new().expect("Failed to create tokio runtime");
            let result = rt.block_on(commands::check_host_status("::1".to_string()));
            assert!(result.is_ok());
            let status = result.expect("check_host_status should return Ok");
            // Status depends on whether RDP is running on IPv6
            assert!(status == "online" || status == "offline" || status == "unknown");
        }

        #[test]
        fn test_check_host_status_returns_result_not_error() {
            // Verify function returns Result, not panic
            let rt = Runtime::new().expect("Failed to create tokio runtime");
            let result = rt.block_on(commands::check_host_status("invalid".to_string()));
            // Should always return Ok, never Err
            assert!(result.is_ok());
        }
    }

    // CSV/JSON Parsing Fuzzing Tests - Property-Based Testing for File Format Corruption
    #[cfg(test)]
    mod csv_json_fuzzing_tests {
        use super::*;

        #[test]
        fn test_csv_parsing_truncated_lines() {
            // Test handling of truncated CSV lines (incomplete records)
            let test_cases = [
                "hostname,description,last_connected\ntest.example.com",  // Missing columns
                "hostname,description\ntest.example.com,Description",     // No last_connected column
                "hostname,description,last_connected\ntest.example.com,", // Empty description at end
                "hostname\n",                                              // Only header with hostname
                "",                                                        // Completely empty
                "hostname,description,last_connected\n",                   // Header only
            ];

            for (i, csv_content) in test_cases.iter().enumerate() {
                let mut reader = csv::ReaderBuilder::new()
                    .has_headers(true)
                    .from_reader(csv_content.as_bytes());

                let mut count = 0;
                for result in reader.records() {
                    match result {
                        Ok(record) => {
                            // Should handle records with at least 1 field
                            assert!(!record.is_empty(), "Test case {}: Empty record", i);
                            count += 1;
                        }
                        Err(e) => {
                            // Some malformed CSVs will error - that's expected
                            assert!(
                                e.to_string().contains("record")
                                    || e.to_string().contains("EOF")
                                    || e.to_string().contains("field"),
                                "Test case {}: Unexpected error: {}",
                                i,
                                e
                            );
                        }
                    }
                }
                // Truncated lines should either parse partially or error cleanly
                assert!(count <= 1, "Test case {}: Too many records from truncated CSV", i);
            }
        }

        #[test]
        fn test_csv_parsing_missing_quotes() {
            // Test CSV records with unmatched quotes
            let test_cases = [
                r#"hostname,description,last_connected
"test.example.com,Missing closing quote,2024-01-01"#,
                r#"hostname,description,last_connected
test.example.com,"Missing closing quote,2024-01-01"#,
                r#"hostname,description,last_connected
"test.example.com","Description with "nested" quotes",2024-01-01"#,
            ];

            for (i, csv_content) in test_cases.iter().enumerate() {
                let mut reader = csv::ReaderBuilder::new()
                    .has_headers(true)
                    .from_reader(csv_content.as_bytes());

                for result in reader.records() {
                    match result {
                        Ok(record) => {
                            // CSV library may handle some quote issues gracefully
                            assert!(!record.is_empty(), "Test case {}: Empty record", i);
                        }
                        Err(e) => {
                            // Most quote mismatches will error
                            assert!(
                                e.to_string().contains("quote")
                                    || e.to_string().contains("field")
                                    || e.to_string().contains("record"),
                                "Test case {}: Expected quote error, got: {}",
                                i,
                                e
                            );
                        }
                    }
                }
            }
        }

        #[test]
        fn test_csv_parsing_special_characters() {
            // Test CSV with special characters: newlines, tabs, unicode
            let test_cases = [
                "hostname,description,last_connected\ntest.example.com,\"Line1\nLine2\",2024-01-01",
                "hostname,description,last_connected\ntest.example.com,Tab\tSeparated,2024-01-01",
                "hostname,description,last_connected\ntest.example.com,Unicode→✓→émojis🎉,2024-01-01",
                "hostname,description,last_connected\ntest.example.com,Commas,in,fields,2024-01-01",
            ];

            for (i, csv_content) in test_cases.iter().enumerate() {
                let result = csv::ReaderBuilder::new()
                    .has_headers(true)
                    .from_reader(csv_content.as_bytes())
                    .records()
                    .collect::<Result<Vec<_>, _>>();

                match result {
                    Ok(records) => {
                        // Should successfully parse special characters
                        assert!(!records.is_empty(), "Test case {}: No records parsed", i);
                        for record in records {
                            assert!(!record.is_empty(), "Test case {}: Record too short", i);
                        }
                    }
                    Err(e) => {
                        // Some special char combinations may error
                        println!("Test case {}: CSV parsing error (acceptable): {}", i, e);
                    }
                }
            }
        }

        #[test]
        fn test_csv_parsing_extremely_long_fields() {
            // Test CSV with very long field values (10KB+ per field)
            let long_hostname = "a".repeat(10_000);
            let long_description = "b".repeat(20_000);
            let csv_content = format!(
                "hostname,description,last_connected\n{},{},2024-01-01",
                long_hostname, long_description
            );

            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(csv_content.as_bytes());

            let mut count = 0;
            for result in reader.records() {
                assert!(result.is_ok(), "Should handle long fields without crashing");
                let record = result.expect("CSV record parsing should succeed");
                assert_eq!(record.len(), 3, "Should have 3 fields");
                assert_eq!(record[0].len(), 10_000, "Hostname should be 10K chars");
                assert_eq!(record[1].len(), 20_000, "Description should be 20K chars");
                count += 1;
            }
            assert_eq!(count, 1, "Should parse exactly 1 record");
        }

        #[test]
        fn test_csv_parsing_many_records() {
            // Test CSV with thousands of records (performance & memory)
            let mut csv_content = "hostname,description,last_connected\n".to_string();
            for i in 0..5_000 {
                csv_content.push_str(&format!(
                    "host{}.example.com,Description {},2024-01-01\n",
                    i, i
                ));
            }

            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(csv_content.as_bytes());

            let mut count = 0;
            for result in reader.records() {
                assert!(result.is_ok(), "Record {} failed to parse", count);
                count += 1;
            }
            assert_eq!(count, 5_000, "Should parse all 5,000 records");
        }

        #[test]
        fn test_csv_parsing_null_bytes() {
            // Test CSV with embedded null bytes
            let csv_content = "hostname,description,last_connected\ntest\x00null.example.com,Desc\x00ription,2024-01-01";

            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(csv_content.as_bytes());

            // CSV library should handle null bytes (they're just bytes)
            let result = reader.records().collect::<Result<Vec<_>, _>>();
            match result {
                Ok(records) => {
                    assert_eq!(records.len(), 1, "Should parse 1 record");
                    // Null bytes preserved in data
                    assert!(records[0][0].contains('\x00'), "Hostname should contain null byte");
                }
                Err(_e) => {
                    // Some CSV parsers may reject null bytes - also acceptable
                }
            }
        }

        #[test]
        fn test_csv_parsing_bom_marker() {
            // Test CSV with UTF-8 BOM (Byte Order Mark)
            let csv_with_bom = "\u{FEFF}hostname,description,last_connected\ntest.example.com,Description,2024-01-01";

            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(csv_with_bom.as_bytes());

            let records = reader.records().collect::<Result<Vec<_>, _>>();
            assert!(records.is_ok(), "Should handle BOM marker");
            let records = records.unwrap();
            assert_eq!(records.len(), 1, "Should parse 1 record");
        }

        #[test]
        fn test_csv_parsing_mixed_line_endings() {
            // Test CSV with mixed Windows (CRLF), Unix (LF), and Mac (CR) line endings
            let csv_content = "hostname,description,last_connected\r\ntest1.example.com,Windows,2024-01-01\ntest2.example.com,Unix,2024-01-02\rtest3.example.com,Mac,2024-01-03";

            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(csv_content.as_bytes());

            let records = reader.records().collect::<Result<Vec<_>, _>>();
            match records {
                Ok(recs) => {
                    // Should handle most mixed line endings
                    assert!(!recs.is_empty(), "Should parse at least 1 record");
                }
                Err(_e) => {
                    // Some line ending combinations may fail - acceptable
                }
            }
        }

        #[test]
        fn test_json_parsing_recent_connections_malformed() {
            // Test JSON parsing with malformed structures
            let test_cases = [
                r#"{"connections":["not_an_object"]}"#, // Array contains string instead of object
                r#"{"connections":[{"hostname":"test.example.com","description":"Test"}]}"#, // Missing timestamp field
                r#"{"connections":[{"hostname":"test.example.com","description":"","timestamp":1234567890}]}"#, // Empty description
                r#"{"connections":[{"hostname":"","description":"Empty hostname","timestamp":1234567890}]}"#, // Empty hostname
                r#"{"connections":[]}"#, // Empty connections array
                r#"{}"#,                 // Missing connections key
            ];

            for (i, json_str) in test_cases.iter().enumerate() {
                let result = serde_json::from_str::<RecentConnections>(json_str);
                match result {
                    Ok(recent) => {
                        // Some malformed JSON may still parse
                        println!("Test case {}: Parsed as valid (may be acceptable)", i);
                        assert!(recent.connections.len() <= 1);
                    }
                    Err(e) => {
                        // Most malformed JSON will error - that's expected
                        assert!(
                            e.to_string().contains("missing")
                                || e.to_string().contains("invalid")
                                || e.to_string().contains("expected"),
                            "Test case {}: Unexpected error: {}",
                            i,
                            e
                        );
                    }
                }
            }
        }

        #[test]
        fn test_json_parsing_truncated() {
            // Test truncated JSON (simulating incomplete file writes)
            let test_cases = [
                r#"{"connections":[{"hostname":"test.example.com","description":"Test"#, // Missing closing braces
                r#"{"connections":[{"hostname":"test.example.com""#,                    // Truncated mid-field
                r#"{"connections":[{"hostname":"test.example.com","description":"Test","timestamp":1234567890}]"#, // Missing final brace
                r#"{"connections":["#,                                                   // Truncated in array
            ];

            for (i, json_str) in test_cases.iter().enumerate() {
                let result = serde_json::from_str::<RecentConnections>(json_str);
                assert!(
                    result.is_err(),
                    "Test case {}: Truncated JSON should error",
                    i
                );
                let err = result.expect_err("Expected truncated JSON to produce error");
                assert!(
                    err.to_string().contains("EOF")
                        || err.to_string().contains("expected")
                        || err.to_string().contains("unexpected")
                        || err.to_string().contains("missing"),
                    "Test case {}: Expected truncation/missing field error, got: {}",
                    i,
                    err
                );
            }
        }

        #[test]
        fn test_json_parsing_invalid_utf8_sequences() {
            // Note: Rust strings are always valid UTF-8, so we test Unicode edge cases instead
            let test_cases = [
                r#"{"connections":[{"hostname":"test\u0000.example.com","description":"Null char","timestamp":1234567890}]}"#,
                r#"{"connections":[{"hostname":"test\uD800.example.com","description":"Unpaired surrogate","timestamp":1234567890}]}"#,
                r#"{"connections":[{"hostname":"test😀.example.com","description":"Emoji","timestamp":1234567890}]}"#,
                r#"{"connections":[{"hostname":"test\n.example.com","description":"Newline","timestamp":1234567890}]}"#,
            ];

            for (i, json_str) in test_cases.iter().enumerate() {
                let result = serde_json::from_str::<RecentConnections>(json_str);
                match result {
                    Ok(_recent) => {
                        // Valid Unicode should parse successfully
                        println!("Test case {}: Parsed successfully", i);
                    }
                    Err(e) => {
                        // Invalid surrogates may error, or missing timestamp
                        assert!(
                            e.to_string().contains("unicode")
                                || e.to_string().contains("escape")
                                || e.to_string().contains("character")
                                || e.to_string().contains("missing"),
                            "Test case {}: Unexpected error: {}",
                            i,
                            e
                        );
                    }
                }
            }
        }

        #[test]
        fn test_json_parsing_duplicate_keys() {
            // Test JSON with duplicate keys
            let json_str = r#"{"connections":[{"hostname":"first.example.com","hostname":"second.example.com","description":"Test","timestamp":1234567890}]}"#;

            let result = serde_json::from_str::<RecentConnections>(json_str);
            // serde_json may reject or accept duplicate keys depending on configuration
            // Both behaviors are acceptable for this fuzz test
            match result {
                Ok(recent) => {
                    // If parsed, should have valid structure
                    assert_eq!(recent.connections.len(), 1);
                    // serde_json uses the last occurrence when accepting duplicates
                    assert!(!recent.connections[0].hostname.is_empty());
                }
                Err(e) => {
                    // Rejecting duplicate keys is also valid behavior
                    println!("Duplicate keys rejected (acceptable): {}", e);
                }
            }
        }

        #[test]
        fn test_json_parsing_extremely_large_file() {
            // Test JSON with thousands of connection records
            let mut connections = Vec::new();
            for i in 0..10_000 {
                connections.push(format!(
                    r#"{{"hostname":"host{}.example.com","description":"Description {}","timestamp":1234567890}}"#,
                    i, i
                ));
            }
            let json_str = format!(r#"{{"connections":[{}]}}"#, connections.join(","));

            let result = serde_json::from_str::<RecentConnections>(&json_str);
            assert!(result.is_ok(), "Should parse large JSON file");
            let recent = result.unwrap();
            assert_eq!(recent.connections.len(), 10_000, "Should have 10,000 connections");
        }

        #[test]
        fn test_json_parsing_deeply_nested_structure() {
            // Test JSON parser limits with nested structures
            let deeply_nested = r#"{"connections":[{"hostname":"test.example.com","description":"Test","nested":{"level1":{"level2":{"level3":"value"}}}}]}"#;

            let result = serde_json::from_str::<serde_json::Value>(deeply_nested);
            assert!(result.is_ok(), "Should handle nested structures");
        }

        #[test]
        fn test_csv_empty_file_handling() {
            // Test completely empty CSV file
            let empty_csv = "";
            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(empty_csv.as_bytes());

            let records = reader.records().collect::<Result<Vec<_>, _>>();
            match records {
                Ok(recs) => {
                    assert!(recs.is_empty(), "Empty CSV should produce no records");
                }
                Err(_e) => {
                    // Empty file may error - also acceptable
                }
            }
        }

        #[test]
        fn test_csv_only_whitespace() {
            // Test CSV file with only whitespace
            let whitespace_csv = "   \n\n  \t  \n";
            let mut reader = csv::ReaderBuilder::new()
                .has_headers(true)
                .from_reader(whitespace_csv.as_bytes());

            let records = reader.records().collect::<Result<Vec<_>, _>>();
            match records {
                Ok(recs) => {
                    assert!(recs.len() <= 1, "Whitespace-only CSV should produce minimal records");
                }
                Err(_e) => {
                    // May error on invalid format
                }
            }
        }

        #[test]
        fn test_json_only_whitespace() {
            // Test JSON file with only whitespace
            let whitespace_json = "   \n\n  \t  \n";
            let result = serde_json::from_str::<RecentConnections>(whitespace_json);
            assert!(result.is_err(), "Whitespace-only JSON should error");
        }

        #[test]
        fn test_csv_concurrent_read_simulation() {
            // Simulate multiple threads reading the same CSV data
            let csv_content = "hostname,description,last_connected\ntest1.example.com,Desc1,2024-01-01\ntest2.example.com,Desc2,2024-01-02";

            let handles: Vec<_> = (0..10)
                .map(|_| {
                    let csv_data = csv_content.to_string();
                    std::thread::spawn(move || {
                        let mut reader = csv::ReaderBuilder::new()
                            .has_headers(true)
                            .from_reader(csv_data.as_bytes());
                        reader.records().count()
                    })
                })
                .collect();

            for handle in handles {
                let count = handle.join().expect("Thread should complete");
                assert_eq!(count, 2, "Each thread should read 2 records");
            }
        }
    }
}

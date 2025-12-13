//! Theme management commands
//!
//! Handles application theme operations including Windows system theme detection,
//! theme persistence, and theme change event propagation.

use crate::adapters::{RegistryAdapter, WindowsRegistry};
use tauri::{Emitter, Manager};

/// Tauri command to get the Windows system theme.
///
/// Uses WindowsRegistry adapter to read theme setting without unsafe blocks.
#[tauri::command]
pub fn get_windows_theme() -> Result<String, String> {
    let registry = WindowsRegistry::new();
    let key_path = "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize";
    
    match registry.read_dword(key_path, "AppsUseLightTheme") {
        Ok(Some(value)) => {
            // Value is 0 for dark, 1 for light
            if value == 0 {
                Ok("dark".to_string())
            } else {
                Ok("light".to_string())
            }
        }
        _ => Ok("dark".to_string()), // Default to dark
    }
}

/// Sets the application theme and notifies all windows.
///
/// Thin wrapper that:
/// 1. Saves theme preference to disk
/// 2. Emits theme-changed events to all windows
/// 3. Rebuilds tray menu with new theme
#[tauri::command]
pub fn set_theme(app_handle: tauri::AppHandle, theme: String) -> Result<(), String> {
    // Save the theme preference in the app's data directory
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let theme_file = app_dir.join("theme.txt");
    std::fs::write(&theme_file, &theme)
        .map_err(|e| format!("Failed to write theme preference: {}", e))?;

    // Emit an event to all windows to update their theme
    for window_label in ["login", "main", "hosts", "about", "error"] {
        if let Some(window) = app_handle.get_webview_window(window_label) {
            let _ = window.emit("theme-changed", theme.clone());
        }
    }

    // Rebuild tray menu with new theme
    if let Some(tray) = app_handle.tray_by_id("main") {
        if let Ok(menu) = super::system::build_tray_menu(&app_handle, &theme) {
            let _ = tray.set_menu(Some(menu));
        }
    }

    Ok(())
}

/// Gets the current theme with a guaranteed fallback to "dark"
///
/// This function ensures a theme is always returned, falling back to:
/// 1. Saved app preference
/// 2. Windows system theme
/// 3. "dark" as ultimate fallback
pub fn get_theme_or_default(app_handle: tauri::AppHandle) -> String {
    get_theme(app_handle).unwrap_or_else(|_| "dark".to_string())
}

/// Gets the currently saved theme preference.
///
/// Falls back to Windows system theme if no preference is saved.
#[tauri::command]
pub fn get_theme(app_handle: tauri::AppHandle) -> Result<String, String> {
    // Try to read the saved theme preference
    let app_dir = match app_handle.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => return get_windows_theme(), // Fallback to Windows theme
    };

    let theme_file = app_dir.join("theme.txt");

    if theme_file.exists() {
        match std::fs::read_to_string(&theme_file) {
            Ok(theme) => Ok(theme.trim().to_string()),
            Err(_) => get_windows_theme(), // Fallback to Windows theme
        }
    } else {
        get_windows_theme() // Fallback to Windows theme
    }
}

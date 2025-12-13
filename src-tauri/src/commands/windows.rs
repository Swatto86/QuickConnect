//! Window management commands
//!
//! Thin command wrappers for window visibility, focus, and state management.
//! Commands handle window show/hide operations and maintain window state tracking.

use crate::ErrorPayload;
use crate::infra::debug_log;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

/// Global state tracking the last hidden window for restoration purposes.
/// Used by the system tray to restore the most recently hidden window.
pub static LAST_HIDDEN_WINDOW: Mutex<String> = Mutex::new(String::new());

/// Tauri command to exit the application gracefully.
///
/// This command is typically called from the system tray menu or when the user
/// explicitly chooses to quit the application.
///
/// # Arguments
/// * `app_handle` - The Tauri application handle
#[tauri::command]
pub async fn quit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

/// Tauri command to show and focus the About window.
///
/// If the About window already exists, it will be shown and focused. Returns an error
/// if the window is not found.
///
/// # Arguments
/// * `app_handle` - The Tauri application handle
///
/// # Returns
/// * `Ok(())` if successful
/// * `Err(String)` if the window is not found or cannot be shown
#[tauri::command]
pub fn show_about(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(about_window) = app_handle.get_webview_window("about") {
        about_window.show().map_err(|e| e.to_string())?;
        about_window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("About window not found".to_string())
    }
}

/// Tauri command to show an error in the dedicated error window.
///
/// This command creates an error payload and emits it to the error window. The window
/// will automatically show, unminimize, and focus itself when an error is received.
///
/// # Arguments
/// * `app_handle` - The Tauri application handle
/// * `message` - User-friendly error message
/// * `category` - Optional error category for classification
/// * `details` - Optional technical details for debugging
///
/// # Returns
/// * `Ok(())` if the error was successfully displayed
/// * `Err(String)` if there was a problem showing the error window
#[tauri::command]
pub fn show_error(
    app_handle: tauri::AppHandle,
    message: String,
    category: Option<String>,
    details: Option<String>,
) -> Result<(), String> {
    use chrono::Local;

    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let payload = ErrorPayload {
        message,
        timestamp,
        category,
        details,
    };

    debug_log(
        "INFO",
        "ERROR_WINDOW",
        &format!("Showing error in error window: {}", payload.message),
        payload.details.as_deref(),
    );

    // Emit the error event to the error window (this will work even if window is hidden)
    if let Some(error_window) = app_handle.get_webview_window("error") {
        let _ = error_window.emit("show-error", &payload);
        // Always show and focus the window when a new error occurs
        error_window.show().map_err(|e| e.to_string())?;
        error_window.unminimize().map_err(|e| e.to_string())?;
        error_window.set_focus().map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Tauri command to toggle the visibility of the error window.
///
/// If the error window is currently visible, it will be hidden. If it's hidden,
/// it will be shown, unminimized, and focused.
///
/// # Arguments
/// * `app_handle` - The Tauri application handle
///
/// # Returns
/// * `Ok(())` if the window was successfully toggled
/// * `Err(String)` if the window is not found or visibility could not be changed
#[tauri::command]
pub async fn toggle_error_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(error_window) = app_handle.get_webview_window("error") {
        match error_window.is_visible() {
            Ok(is_visible) => {
                if is_visible {
                    error_window.hide().map_err(|e| e.to_string())?;
                } else {
                    error_window.unminimize().map_err(|e| e.to_string())?;
                    error_window.show().map_err(|e| e.to_string())?;
                    error_window.set_focus().map_err(|e| e.to_string())?;
                }
                Ok(())
            }
            Err(e) => Err(format!("Failed to check window visibility: {}", e)),
        }
    } else {
        Err("Error window not found".to_string())
    }
}

/// Toggles visibility of login/main windows.
#[tauri::command]
pub async fn toggle_visible_window(app_handle: tauri::AppHandle) -> Result<(), tauri::Error> {
    let login_window = app_handle
        .get_webview_window("login")
        .ok_or_else(|| tauri::Error::WindowNotFound)?;
    let main_window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| tauri::Error::WindowNotFound)?;

    let login_visible = login_window.is_visible()?;
    let main_visible = main_window.is_visible()?;

    // First, determine which window should be shown
    if login_visible {
        // If login is visible, hide it
        login_window.hide()?;
    } else if main_visible {
        // If main is visible, hide it
        main_window.hide()?;
    } else {
        // If neither is visible, show login window
        // Make sure main window is hidden first
        main_window.hide()?;
        login_window.unminimize()?; // First unminimize if needed
        login_window.show()?; // Then show
        login_window.set_focus()?; // Finally bring to front
    }

    Ok(())
}

/// Closes the login window and updates tracking state.
#[tauri::command]
pub async fn close_login_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    debug_log("DEBUG", "WINDOW", "Closing login window", None);
    if let Some(window) = app_handle.get_webview_window("login") {
        // Update LAST_HIDDEN_WINDOW before hiding
        if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
            *last_hidden = "login".to_string();
        }
        window.hide().map_err(|e| e.to_string())?;
        debug_log("DEBUG", "WINDOW", "Login window closed successfully", None);
    }
    Ok(())
}

/// Closes login window and prepares to show main window.
#[tauri::command]
pub async fn close_login_and_prepare_main(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("login") {
        // Update LAST_HIDDEN_WINDOW to "main" so tray click shows main window
        if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
            *last_hidden = "main".to_string();
        }
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Gets and hides the login window.
#[tauri::command]
pub async fn get_login_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("login") {
        window.hide().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Login window not found".to_string())
    }
}

/// Shows and focuses the login window.
#[tauri::command]
pub async fn show_login_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    debug_log("DEBUG", "WINDOW", "Showing login window", None);
    if let Some(login_window) = app_handle.get_webview_window("login") {
        // First hide main window if it's visible
        if let Some(main_window) = app_handle.get_webview_window("main") {
            main_window.hide().map_err(|e| e.to_string())?;
        }

        // Update LAST_HIDDEN_WINDOW to "login"
        if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
            *last_hidden = "login".to_string();
        }

        login_window.unminimize().map_err(|e| e.to_string())?;
        login_window.show().map_err(|e| e.to_string())?;
        login_window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Login window not found".to_string())
    }
}

/// Switches from login to main window.
#[tauri::command]
pub async fn switch_to_main_window(app_handle: tauri::AppHandle) -> Result<(), tauri::Error> {
    let login_window = app_handle.get_webview_window("login").ok_or_else(|| tauri::Error::WindowNotFound)?;
    let main_window = app_handle.get_webview_window("main").ok_or_else(|| tauri::Error::WindowNotFound)?;

    // First show main window, then hide login window to prevent flicker
    main_window.unminimize()?;
    main_window.show()?;
    main_window.set_focus()?;

    // Emit focus-search event to focus the search input
    let _ = main_window.emit("focus-search", ());

    // Update LAST_HIDDEN_WINDOW before hiding login window
    if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
        *last_hidden = "main".to_string();
    }

    login_window.hide()?;

    Ok(())
}

/// Hides the main window.
#[tauri::command]
pub async fn hide_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

/// Shows the hosts management window.
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

/// Hides the hosts window and shows main window.
#[tauri::command]
pub async fn hide_hosts_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("hosts") {
        window.hide().map_err(|e| e.to_string())?;

        // Show main window again and update LAST_HIDDEN_WINDOW
        if let Some(main_window) = app_handle.get_webview_window("main") {
            if let Ok(mut last_hidden) = LAST_HIDDEN_WINDOW.lock() {
                *last_hidden = "main".to_string();
            }
            main_window.show().map_err(|e| e.to_string())?;
            main_window.set_focus().map_err(|e| e.to_string())?;
        }
        Ok(())
    } else {
        Err("Hosts window not found".to_string())
    }
}

//! Credential management commands
//!
//! Thin command layer for credential operations.
//! All business logic is delegated to the credential manager adapter.

use crate::{Credentials, StoredCredentials};
use crate::adapters::{CredentialManager, WindowsCredentialManager};
use crate::infra::debug_log;

/// Global credential manager instance using singleton pattern
/// 
/// Uses once_cell::Lazy for thread-safe lazy initialization.
/// The WindowsCredentialManager is created only once on first access
/// and reused for all subsequent credential operations.
static CREDENTIAL_MANAGER: once_cell::sync::Lazy<WindowsCredentialManager> =
    once_cell::sync::Lazy::new(|| WindowsCredentialManager::new());

/// Saves global QuickConnect credentials
///
/// # Arguments
/// * `credentials` - Username and password to store
///
/// # Returns
/// * `Ok(())` - Credentials saved successfully
/// * `Err(String)` - Error message for frontend
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

/// Retrieves stored global QuickConnect credentials
///
/// # Returns
/// * `Ok(Some(credentials))` - If credentials exist
/// * `Ok(None)` - If no credentials are stored
/// * `Err(String)` - Error message for frontend
#[tauri::command]
pub async fn get_stored_credentials() -> Result<Option<StoredCredentials>, String> {
    debug_log(
        "INFO",
        "CREDENTIALS",
        "Attempting to retrieve stored credentials",
        None,
    );

    match CREDENTIAL_MANAGER.read("QuickConnect") {
        Ok(Some((username, password))) => {
            // SECURITY: Never log actual password, only metadata
            // Log password length for debugging without exposing sensitive data
            debug_log(
                "INFO",
                "CREDENTIALS",
                &format!("Successfully retrieved stored credentials for user: {}", username),
                Some(&format!("Password length: {} characters", password.len())),
            );
            Ok(Some(StoredCredentials { username, password }))
        }
        Ok(None) => {
            debug_log("INFO", "CREDENTIALS", "No stored credentials found", None);
            Ok(None)
        }
        Err(e) => {
            debug_log(
                "ERROR",
                "CREDENTIALS",
                &format!("Error retrieving credentials: {}", e),
                None,
            );
            Err(e.to_string())
        }
    }
}

/// Deletes stored global QuickConnect credentials
///
/// # Returns
/// * `Ok(())` - Credentials deleted successfully
/// * `Err(String)` - Error message for frontend
#[tauri::command]
pub async fn delete_credentials() -> Result<(), String> {
    debug_log("INFO", "CREDENTIALS", "Deleting stored credentials", None);

    CREDENTIAL_MANAGER
        .delete("QuickConnect")
        .map_err(|e| {
            debug_log(
                "ERROR",
                "CREDENTIALS",
                &format!("Failed to delete credentials: {}", e),
                None,
            );
            e.to_string()
        })?;

    debug_log("INFO", "CREDENTIALS", "Credentials deleted successfully", None);
    Ok(())
}

/// Saves per-host credentials for RDP connections
///
/// Stores credentials under TERMSRV/{hostname} for Windows RDP SSO.
///
/// # Arguments
/// * `host` - Host information (we use hostname from this)
/// * `credentials` - Username and password to store
///
/// # Returns
/// * `Ok(())` - Credentials saved successfully
/// * `Err(String)` - Error message for frontend
#[tauri::command]
pub async fn save_host_credentials(
    host: crate::Host,
    credentials: Credentials,
) -> Result<(), String> {
    let hostname = host.hostname;
    debug_log(
        "INFO",
        "HOST_CREDENTIALS",
        &format!("Saving per-host credentials for {}", hostname),
        None,
    );

    if credentials.username.is_empty() {
        return Err("Username cannot be empty".to_string());
    }

    // TERMSRV/* naming convention enables Windows RDP Single Sign-On (SSO)
    // The Windows RDP client automatically uses credentials stored under
    // TERMSRV/{hostname} when connecting, eliminating manual login prompts
    let target = format!("TERMSRV/{}", hostname);

    CREDENTIAL_MANAGER
        .save(&target, &credentials.username, &credentials.password)
        .map_err(|e| {
            debug_log(
                "ERROR",
                "HOST_CREDENTIALS",
                &format!("Failed to save host credentials: {}", e),
                None,
            );
            e.to_string()
        })?;

    debug_log(
        "INFO",
        "HOST_CREDENTIALS",
        &format!("Successfully saved per-host credentials for {}", hostname),
        None,
    );
    Ok(())
}

/// Retrieves per-host credentials for RDP connections
///
/// # Arguments
/// * `hostname` - Server hostname
///
/// # Returns
/// * `Ok(Some(credentials))` - If per-host credentials exist
/// * `Ok(None)` - If no per-host credentials are stored
/// * `Err(String)` - Error message for frontend
#[tauri::command]
pub async fn get_host_credentials(hostname: String) -> Result<Option<StoredCredentials>, String> {
    let target = format!("TERMSRV/{}", hostname);

    match CREDENTIAL_MANAGER.read(&target) {
        Ok(Some((username, password))) => {
            debug_log(
                "INFO",
                "HOST_CREDENTIALS",
                &format!("Found per-host credentials for {}", hostname),
                None,
            );
            Ok(Some(StoredCredentials { username, password }))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Deletes per-host credentials
///
/// # Arguments
/// * `hostname` - Server hostname
///
/// # Returns
/// * `Ok(())` - Credentials deleted successfully
/// * `Err(String)` - Error message for frontend
#[tauri::command]
pub async fn delete_host_credentials(hostname: String) -> Result<(), String> {
    let target = format!("TERMSRV/{}", hostname);

    CREDENTIAL_MANAGER
        .delete(&target)
        .map_err(|e| {
            debug_log(
                "ERROR",
                "HOST_CREDENTIALS",
                &format!("Failed to delete host credentials: {}", e),
                None,
            );
            e.to_string()
        })?;

    debug_log(
        "INFO",
        "HOST_CREDENTIALS",
        &format!("Deleted per-host credentials for {}", hostname),
        None,
    );
    Ok(())
}

/// Lists all hosts with saved per-host credentials
///
/// # Returns
/// * Vector of hostnames that have saved credentials
#[tauri::command]
pub async fn list_hosts_with_credentials() -> Result<Vec<String>, String> {
    // Query Windows Credential Manager for all credentials starting with "TERMSRV/"
    // This prefix filter returns only per-host RDP credentials, excluding global ones
    match CREDENTIAL_MANAGER.list_with_prefix("TERMSRV/") {
        Ok(targets) => {
            // Strip "TERMSRV/" prefix from each target to get just the hostname
            // e.g., "TERMSRV/server1.example.com" -> "server1.example.com"
            let hostnames: Vec<String> = targets
                .iter()
                .filter_map(|t| t.strip_prefix("TERMSRV/").map(|s| s.to_string()))
                .collect();
            Ok(hostnames)
        }
        Err(e) => Err(e.to_string()),
    }
}

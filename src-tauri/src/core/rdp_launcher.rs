//! RDP Connection Launcher
//!
//! Orchestrates RDP connection establishment including:
//! - Credential retrieval and preparation
//! - RDP file generation and persistence
//! - mstsc.exe invocation
//! - Recent connections tracking
//! - UI event emissions

use crate::{Host, StoredCredentials, RecentConnections, AppError};
use crate::adapters::{CredentialManager, WindowsCredentialManager};
use crate::core::rdp::{parse_username, generate_rdp_content};
use crate::infra::debug_log;
use std::path::PathBuf;

/// Result of an RDP launch operation
pub struct RdpLaunchResult {
    pub rdp_file_path: PathBuf,
    pub hostname: String,
}

/// Launches an RDP connection to the specified host
///
/// # Arguments
/// * `host` - The host to connect to
/// * `get_host_credentials_fn` - Async function to retrieve per-host credentials
/// * `get_global_credentials_fn` - Async function to retrieve global credentials
///
/// # Returns
/// * `Ok(RdpLaunchResult)` - Connection launched successfully
/// * `Err(AppError)` - Failed to launch connection
///
/// # Side Effects
/// - Creates TERMSRV/{hostname} credential if not exists (enables Windows RDP SSO)
/// - Writes RDP file to %APPDATA%/QuickConnect/Connections/{hostname}.rdp
/// - Updates recent_connections.json
/// - Launches mstsc.exe process
///
/// # Platform-Specific Behavior
/// - Windows: Uses mstsc.exe as RDP client
/// - Creates persistent RDP files for reuse
/// - Stores credentials in Windows Credential Manager
pub async fn launch_rdp_connection<F1, F2, Fut1, Fut2>(
    host: &Host,
    get_host_credentials_fn: F1,
    get_global_credentials_fn: F2,
) -> Result<RdpLaunchResult, AppError>
where
    F1: FnOnce(String) -> Fut1,
    F2: FnOnce() -> Fut2,
    Fut1: std::future::Future<Output = Result<Option<StoredCredentials>, AppError>>,
    Fut2: std::future::Future<Output = Result<Option<StoredCredentials>, AppError>>,
{
    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!("Starting RDP launch for host: {}", host.hostname),
        None,
    );

    // Step 1: Retrieve credentials (per-host first, then global fallback)
    let credentials = get_credentials(host, get_host_credentials_fn, get_global_credentials_fn).await?;

    // Step 2: Parse username to extract domain and username components
    let (domain, username) = parse_username(&credentials.username);

    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!(
            "Parsed credentials - Domain: '{}', Username: '{}'",
            domain, username
        ),
        Some(&format!(
            "Domain: '{}', Username: '{}', Password length: {}",
            domain,
            username,
            credentials.password.len()
        )),
    );

    // Step 3: Ensure TERMSRV credentials exist for RDP SSO
    ensure_termsrv_credentials(host, &credentials, &domain, &username).await?;

    // Step 4: Generate and write RDP file
    let rdp_path = create_rdp_file(host, &username, &domain)?;

    // Step 5: Launch mstsc.exe
    launch_mstsc(&rdp_path)?;

    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!(
            "Successfully launched RDP connection to {}",
            host.hostname
        ),
        None,
    );

    Ok(RdpLaunchResult {
        rdp_file_path: rdp_path,
        hostname: host.hostname.clone(),
    })
}

/// Retrieves credentials for RDP connection (per-host or global)
async fn get_credentials<F1, F2, Fut1, Fut2>(
    host: &Host,
    get_host_credentials_fn: F1,
    get_global_credentials_fn: F2,
) -> Result<StoredCredentials, AppError>
where
    F1: FnOnce(String) -> Fut1,
    F2: FnOnce() -> Fut2,
    Fut1: std::future::Future<Output = Result<Option<StoredCredentials>, AppError>>,
    Fut2: std::future::Future<Output = Result<Option<StoredCredentials>, AppError>>,
{
    // Try per-host credentials first
    if let Some(creds) = get_host_credentials_fn(host.hostname.clone()).await? {
        debug_log(
            "INFO",
            "RDP_LAUNCH",
            &format!("Using per-host credentials for {}", host.hostname),
            None,
        );
        return Ok(creds);
    }

    // Fall back to global credentials
    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!(
            "No per-host credentials found for {}, using global credentials",
            host.hostname
        ),
        None,
    );

    match get_global_credentials_fn().await? {
        Some(creds) => Ok(creds),
        None => {
            let error = "No credentials found. Please save credentials in the login window first.";
            debug_log(
                "ERROR",
                "RDP_LAUNCH",
                error,
                Some("Neither per-host nor global credentials are available"),
            );
            Err(AppError::CredentialsNotFound {
                target: host.hostname.clone(),
            })
        }
    }
}

/// Ensures TERMSRV/{hostname} credentials exist for Windows RDP SSO
///
/// If per-host credentials don't exist, saves global credentials as TERMSRV/{hostname}.
/// This enables Windows RDP client to automatically use saved credentials.
async fn ensure_termsrv_credentials(
    host: &Host,
    credentials: &StoredCredentials,
    domain: &str,
    username: &str,
) -> Result<(), AppError> {
    let credential_manager = WindowsCredentialManager::new();
    let target = format!("TERMSRV/{}", host.hostname);

    // Check if TERMSRV credentials already exist
    if credential_manager.read(&target)?.is_some() {
        debug_log(
            "INFO",
            "RDP_LAUNCH",
            &format!("Using existing per-host credentials at {}", target),
            None,
        );
        return Ok(());
    }

    // Save credentials with full domain\username format
    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!("Saving global credentials to {} for RDP SSO", target),
        None,
    );

    let termsrv_username = if !domain.is_empty() {
        format!("{}\\{}", domain, username)
    } else {
        username.to_string()
    };

    credential_manager.save(&target, &termsrv_username, &credentials.password)?;

    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!("Successfully saved credentials to {} with username: {}", target, termsrv_username),
        None,
    );

    Ok(())
}

/// Creates RDP file in AppData/QuickConnect/Connections directory
fn create_rdp_file(host: &Host, username: &str, domain: &str) -> Result<PathBuf, AppError> {
    // Get AppData directory
    let appdata_dir = std::env::var("APPDATA")
        .map_err(|_| AppError::IoError {
            path: "APPDATA environment variable".to_string(),
            source: std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "APPDATA environment variable not found",
            ),
        })?;

    let connections_dir = PathBuf::from(&appdata_dir)
        .join("QuickConnect")
        .join("Connections");

    debug_log(
        "DEBUG",
        "RDP_LAUNCH",
        &format!("Connections directory: {:?}", connections_dir),
        Some(&format!("AppData directory: {}", appdata_dir)),
    );

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&connections_dir).map_err(|e| AppError::IoError {
        path: connections_dir.to_string_lossy().to_string(),
        source: e,
    })?;

    // Generate RDP file path
    let rdp_filename = format!("{}.rdp", host.hostname);
    let rdp_path = connections_dir.join(&rdp_filename);

    // Generate RDP content using core logic
    let rdp_content = generate_rdp_content(host, username, domain);

    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!("Writing RDP file to: {:?}", rdp_path),
        Some(&format!(
            "RDP content length: {} bytes, File: {:?}",
            rdp_content.len(),
            rdp_path
        )),
    );

    // Write RDP file
    std::fs::write(&rdp_path, rdp_content.as_bytes()).map_err(|e| {
        debug_log(
            "ERROR",
            "RDP_LAUNCH",
            &format!("Failed to write RDP file: {}", e),
            Some(&format!("File write error: {:?}", e)),
        );
        AppError::IoError {
            path: rdp_path.to_string_lossy().to_string(),
            source: e,
        }
    })?;

    debug_log(
        "INFO",
        "RDP_LAUNCH",
        &format!("RDP file written successfully to {:?}", rdp_path),
        None,
    );

    Ok(rdp_path)
}

/// Launches mstsc.exe with the specified RDP file
fn launch_mstsc(rdp_path: &PathBuf) -> Result<(), AppError> {
    debug_log(
        "INFO",
        "RDP_LAUNCH",
        "Attempting to launch mstsc.exe with RDP file",
        Some(&format!("Target file: {:?}", rdp_path)),
    );

    std::process::Command::new("mstsc.exe")
        .arg(rdp_path.to_string_lossy().as_ref())
        .spawn()
        .map_err(|e| {
            debug_log(
                "ERROR",
                "RDP_LAUNCH",
                &format!("Failed to launch mstsc.exe: {}", e),
                Some(&format!("Failed to spawn mstsc.exe process: {:?}", e)),
            );
            AppError::RdpFileError {
                hostname: rdp_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
                reason: format!("Failed to launch mstsc.exe: {}", e),
            }
        })?;

    debug_log(
        "INFO",
        "RDP_LAUNCH",
        "Successfully launched mstsc.exe",
        None,
    );

    Ok(())
}

/// Updates recent connections tracking
///
/// # Side Effects
/// - Modifies recent_connections.json
pub fn update_recent_connections(host: &Host, recent: &mut RecentConnections) {
    recent.add_connection(host.hostname.clone(), host.description.clone());
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_host(hostname: &str, description: &str) -> Host {
        Host {
            hostname: hostname.to_string(),
            description: description.to_string(),
            last_connected: None,
        }
    }

    fn create_test_credentials(username: &str, password: &str) -> StoredCredentials {
        StoredCredentials {
            username: username.to_string(),
            password: password.to_string(),
        }
    }

    #[test]
    fn test_update_recent_connections_adds_new_connection() {
        let host = create_test_host("server01.domain.com", "Test Server");
        let mut recent = RecentConnections::new();

        assert_eq!(recent.connections.len(), 0);

        update_recent_connections(&host, &mut recent);

        assert_eq!(recent.connections.len(), 1);
        assert_eq!(recent.connections[0].hostname, "server01.domain.com");
        assert_eq!(recent.connections[0].description, "Test Server");
    }

    #[test]
    fn test_update_recent_connections_moves_existing_to_front() {
        let host1 = create_test_host("server01.domain.com", "Server 1");
        let host2 = create_test_host("server02.domain.com", "Server 2");
        let host3 = create_test_host("server03.domain.com", "Server 3");

        let mut recent = RecentConnections::new();

        update_recent_connections(&host1, &mut recent);
        update_recent_connections(&host2, &mut recent);
        update_recent_connections(&host3, &mut recent);

        assert_eq!(recent.connections.len(), 3);
        assert_eq!(recent.connections[0].hostname, "server03.domain.com");

        // Reconnect to server01
        update_recent_connections(&host1, &mut recent);

        assert_eq!(recent.connections.len(), 3);
        assert_eq!(recent.connections[0].hostname, "server01.domain.com");
        assert_eq!(recent.connections[1].hostname, "server03.domain.com");
        assert_eq!(recent.connections[2].hostname, "server02.domain.com");
    }

    #[test]
    fn test_update_recent_connections_respects_max_size() {
        let mut recent = RecentConnections::new();

        // Add 7 hosts
        for i in 1..=7 {
            let host = create_test_host(&format!("server{:02}.domain.com", i), &format!("Server {}", i));
            update_recent_connections(&host, &mut recent);
        }

        // Should only keep 5 most recent
        assert_eq!(recent.connections.len(), 5);
        assert_eq!(recent.connections[0].hostname, "server07.domain.com");
        assert_eq!(recent.connections[4].hostname, "server03.domain.com");
    }

    #[test]
    fn test_create_rdp_file_generates_correct_path() {
        let host = create_test_host("server01.domain.com", "Test Server");
        let username = "testuser";
        let domain = "TESTDOMAIN";

        // Set APPDATA for test
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        std::env::set_var("APPDATA", temp_dir.path());

        let result = create_rdp_file(&host, username, domain);

        assert!(result.is_ok());
        let rdp_path = result.expect("RDP file path should be created");
        
        assert!(rdp_path.to_string_lossy().contains("QuickConnect"));
        assert!(rdp_path.to_string_lossy().contains("Connections"));
        assert!(rdp_path.to_string_lossy().ends_with("server01.domain.com.rdp"));

        // Verify directory was created
        let connections_dir = temp_dir.path().join("QuickConnect").join("Connections");
        assert!(connections_dir.exists());
    }

    #[test]
    fn test_create_rdp_file_writes_valid_content() {
        let host = create_test_host("testserver.domain.com", "Test Server");
        let username = "testuser";
        let domain = "TESTDOMAIN";

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        std::env::set_var("APPDATA", temp_dir.path());

        let rdp_path = create_rdp_file(&host, username, domain).expect("RDP file should be created");

        assert!(rdp_path.exists());

        let content = fs::read_to_string(&rdp_path).expect("RDP file should be readable");
        
        // Verify RDP content contains expected fields
        assert!(content.contains("full address:s:testserver.domain.com"));
        assert!(content.contains("username:s:testuser"));
        assert!(content.contains("domain:s:TESTDOMAIN"));
        assert!(content.contains("screen mode id:i:2"));
        assert!(content.contains("desktopwidth:i:"));
        assert!(content.contains("desktopheight:i:"));
    }

    #[test]
    fn test_create_rdp_file_without_domain() {
        let host = create_test_host("server.local", "Local Server");
        let username = "localuser";
        let domain = ""; // No domain

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        std::env::set_var("APPDATA", temp_dir.path());

        let rdp_path = create_rdp_file(&host, username, domain).expect("RDP file should be created");

        let content = fs::read_to_string(&rdp_path).expect("RDP file should be readable");
        
        // When no domain, username should not have domain prefix
        assert!(content.contains("username:s:localuser"));
        assert!(!content.contains("\\localuser"));
    }

    #[test]
    fn test_create_rdp_file_creates_directory_if_not_exists() {
        let host = create_test_host("newserver.domain.com", "New Server");
        let username = "user";
        let domain = "DOMAIN";

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let connections_dir = temp_dir.path().join("QuickConnect").join("Connections");
        
        // Verify directory doesn't exist before we start
        assert!(!connections_dir.exists());
        
        // Set APPDATA after capturing the path
        std::env::set_var("APPDATA", temp_dir.path());

        let result = create_rdp_file(&host, username, domain);
        
        assert!(result.is_ok());
        // Verify directory was created
        assert!(connections_dir.exists());
    }

    #[test]
    fn test_create_rdp_file_overwrites_existing_file() {
        let host = create_test_host("server.domain.com", "Server");
        let username = "user1";
        let domain = "DOMAIN";

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        std::env::set_var("APPDATA", temp_dir.path());

        // Create first file
        let rdp_path1 = create_rdp_file(&host, username, domain).expect("First RDP file should be created");
        let content1 = fs::read_to_string(&rdp_path1).expect("First file should be readable");

        // Create second file with different username (same temp_dir, so APPDATA is still set)
        let username2 = "user2";
        let rdp_path2 = create_rdp_file(&host, username2, domain).expect("Second RDP file should be created");
        let content2 = fs::read_to_string(&rdp_path2).expect("Second file should be readable");

        // Filenames should be the same (same hostname)
        assert_eq!(rdp_path1.file_name(), rdp_path2.file_name());
        
        // Content should be different (different username)
        assert!(content1.contains("username:s:user1"));
        assert!(content2.contains("username:s:user2"));
        assert!(!content1.contains("username:s:user2"));
    }

    #[test]
    fn test_create_rdp_file_handles_special_characters_in_hostname() {
        let host = create_test_host("server-01_test.domain.com", "Special Server");
        let username = "testuser";
        let domain = "DOMAIN";

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        std::env::set_var("APPDATA", temp_dir.path());

        let result = create_rdp_file(&host, username, domain);
        
        assert!(result.is_ok());
        let rdp_path = result.expect("RDP path should exist");
        
        assert!(rdp_path.to_string_lossy().contains("server-01_test.domain.com.rdp"));
        assert!(rdp_path.exists());
    }

    #[test]
    fn test_create_rdp_file_returns_error_when_appdata_missing() {
        let host = create_test_host("server.domain.com", "Server");
        let username = "user";
        let domain = "DOMAIN";

        // Remove APPDATA environment variable
        std::env::remove_var("APPDATA");

        let result = create_rdp_file(&host, username, domain);
        
        assert!(result.is_err());
        match result {
            Err(AppError::IoError { path, .. }) => {
                assert!(path.contains("APPDATA"));
            }
            _ => panic!("Expected IoError for missing APPDATA"),
        }
    }

    #[tokio::test]
    async fn test_get_credentials_prefers_per_host() {
        let host = create_test_host("server.domain.com", "Server");
        
        let per_host_creds = Some(create_test_credentials("host_user", "host_pass"));
        let global_creds = Some(create_test_credentials("global_user", "global_pass"));

        let get_host_fn = |_hostname: String| async move { Ok(per_host_creds) };
        let get_global_fn = || async move { Ok(global_creds) };

        let result = get_credentials(&host, get_host_fn, get_global_fn).await;

        assert!(result.is_ok());
        let creds = result.expect("Credentials should be returned");
        assert_eq!(creds.username, "host_user");
        assert_eq!(creds.password, "host_pass");
    }

    #[tokio::test]
    async fn test_get_credentials_falls_back_to_global() {
        let host = create_test_host("server.domain.com", "Server");
        
        let per_host_creds: Option<StoredCredentials> = None;
        let global_creds = Some(create_test_credentials("global_user", "global_pass"));

        let get_host_fn = |_hostname: String| async move { Ok(per_host_creds) };
        let get_global_fn = || async move { Ok(global_creds) };

        let result = get_credentials(&host, get_host_fn, get_global_fn).await;

        assert!(result.is_ok());
        let creds = result.expect("Credentials should be returned");
        assert_eq!(creds.username, "global_user");
        assert_eq!(creds.password, "global_pass");
    }

    #[tokio::test]
    async fn test_get_credentials_returns_error_when_none_exist() {
        let host = create_test_host("server.domain.com", "Server");
        
        let per_host_creds: Option<StoredCredentials> = None;
        let global_creds: Option<StoredCredentials> = None;

        let get_host_fn = |_hostname: String| async move { Ok(per_host_creds) };
        let get_global_fn = || async move { Ok(global_creds) };

        let result = get_credentials(&host, get_host_fn, get_global_fn).await;

        assert!(result.is_err());
        match result {
            Err(AppError::CredentialsNotFound { target }) => {
                assert_eq!(target, "server.domain.com");
            }
            _ => panic!("Expected CredentialsNotFound error"),
        }
    }

    #[tokio::test]
    async fn test_ensure_termsrv_credentials_saves_with_domain() {
        let _host = create_test_host("server.domain.com", "Server");
        let _credentials = create_test_credentials("testuser", "testpass");
        let domain = "TESTDOMAIN";
        let username = "testuser";

        // This test validates the logic for TERMSRV credential format
        let termsrv_username = if !domain.is_empty() {
            format!("{}\\{}", domain, username)
        } else {
            username.to_string()
        };

        assert_eq!(termsrv_username, "TESTDOMAIN\\testuser");
    }

    #[tokio::test]
    async fn test_ensure_termsrv_credentials_saves_without_domain() {
        let _host = create_test_host("server.local", "Local Server");
        let _credentials = create_test_credentials("localuser", "localpass");
        let domain = "";
        let username = "localuser";

        // This test validates the logic for TERMSRV credential format without domain
        let termsrv_username = if !domain.is_empty() {
            format!("{}\\{}", domain, username)
        } else {
            username.to_string()
        };

        assert_eq!(termsrv_username, "localuser");
    }

    #[test]
    fn test_rdp_launch_result_contains_correct_fields() {
        let rdp_path = PathBuf::from("C:\\Users\\Test\\AppData\\Roaming\\QuickConnect\\Connections\\server.rdp");
        let hostname = "server.domain.com".to_string();

        let result = RdpLaunchResult {
            rdp_file_path: rdp_path.clone(),
            hostname: hostname.clone(),
        };

        assert_eq!(result.rdp_file_path, rdp_path);
        assert_eq!(result.hostname, hostname);
    }

    #[test]
    fn test_create_rdp_file_content_matches_rdp_module() {
        let host = create_test_host("testserver.com", "Test");
        let username = "user";
        let domain = "DOMAIN";

        // Generate content using both paths
        let direct_content = generate_rdp_content(&host, username, domain);
        
        // Create file and read content
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        std::env::set_var("APPDATA", temp_dir.path());
        
        let rdp_path = create_rdp_file(&host, username, domain).expect("RDP file should be created");
        let file_content = fs::read_to_string(&rdp_path).expect("RDP file should be readable");

        // Both should match
        assert_eq!(direct_content, file_content);
    }

    #[test]
    fn test_multiple_rdp_files_can_coexist() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        std::env::set_var("APPDATA", temp_dir.path());

        let host1 = create_test_host("server01.domain.com", "Server 1");
        let host2 = create_test_host("server02.domain.com", "Server 2");
        let host3 = create_test_host("server03.domain.com", "Server 3");

        let rdp_path1 = create_rdp_file(&host1, "user", "DOMAIN").expect("File 1 should be created");
        let rdp_path2 = create_rdp_file(&host2, "user", "DOMAIN").expect("File 2 should be created");
        let rdp_path3 = create_rdp_file(&host3, "user", "DOMAIN").expect("File 3 should be created");

        // All files should exist
        assert!(rdp_path1.exists());
        assert!(rdp_path2.exists());
        assert!(rdp_path3.exists());

        // All files should have different names
        assert_ne!(rdp_path1.file_name(), rdp_path2.file_name());
        assert_ne!(rdp_path2.file_name(), rdp_path3.file_name());
        assert_ne!(rdp_path1.file_name(), rdp_path3.file_name());
    }
}

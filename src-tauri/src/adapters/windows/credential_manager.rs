//! Windows Credential Manager adapter
//!
//! Provides a safe Rust interface to the Windows Credential Manager API.
//! This module isolates all unsafe Windows API calls and provides a clean,
//! testable interface for credential storage.

use crate::errors::AppError;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::FILETIME;
use windows::Win32::Security::Credentials::{
    CredDeleteW, CredReadW, CredWriteW, CREDENTIALW, CRED_ENUMERATE_FLAGS, CRED_FLAGS,
    CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
};

/// Trait for credential storage operations
///
/// This trait abstracts credential storage to enable:
/// - Testing with mock implementations
/// - Future support for other platforms (keyring on Linux, Keychain on macOS)
/// - Easier reasoning about credential operations
pub trait CredentialManager: Send + Sync {
    /// Saves credentials to secure storage
    ///
    /// # Arguments
    /// * `target` - Unique identifier for the credentials (e.g., "QuickConnect" or "TERMSRV/hostname")
    /// * `username` - Username to store
    /// * `password` - Password to store securely
    fn save(&self, target: &str, username: &str, password: &str) -> Result<(), AppError>;

    /// Retrieves credentials from secure storage
    ///
    /// # Arguments
    /// * `target` - Unique identifier for the credentials
    ///
    /// # Returns
    /// * `Ok(Some((username, password)))` - If credentials exist
    /// * `Ok(None)` - If credentials don't exist
    /// * `Err(AppError)` - If an error occurred during retrieval
    fn read(&self, target: &str) -> Result<Option<(String, String)>, AppError>;

    /// Deletes credentials from secure storage
    ///
    /// # Arguments
    /// * `target` - Unique identifier for the credentials
    fn delete(&self, target: &str) -> Result<(), AppError>;

    /// Lists all credential targets matching a prefix
    ///
    /// # Arguments
    /// * `prefix` - Prefix to filter credentials (e.g., "TERMSRV/" for all RDP credentials)
    ///
    /// # Returns
    /// * Vector of target names
    fn list_with_prefix(&self, prefix: &str) -> Result<Vec<String>, AppError>;
}

/// Windows implementation of CredentialManager
///
/// Uses Windows Credential Manager (CredRead/CredWrite/CredDelete APIs) to
/// securely store credentials encrypted by the OS.
pub struct WindowsCredentialManager;

impl WindowsCredentialManager {
    /// Creates a new Windows credential manager instance
    pub fn new() -> Self {
        WindowsCredentialManager
    }
}

impl Default for WindowsCredentialManager {
    fn default() -> Self {
        Self::new()
    }
}

impl CredentialManager for WindowsCredentialManager {
    fn save(&self, target: &str, username: &str, password: &str) -> Result<(), AppError> {
        unsafe {
            // Convert strings to UTF-16 (wide) format required by Windows APIs
            // Windows uses UTF-16 internally, so all strings must be converted
            // The chain(std::iter::once(0)) adds a null terminator
            let password_wide: Vec<u16> = OsStr::new(password)
                .encode_wide()  // Convert to UTF-16
                .chain(std::iter::once(0))  // Add null terminator
                .collect();

            let target_name: Vec<u16> = OsStr::new(target)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let username_wide: Vec<u16> = OsStr::new(username)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            // Build CREDENTIALW structure for Windows Credential Manager
            // This structure defines all aspects of the stored credential
            let cred = CREDENTIALW {
                Flags: CRED_FLAGS(0),  // No special flags
                Type: CRED_TYPE_GENERIC,  // Generic credentials (not domain/cert-based)
                TargetName: PWSTR(target_name.as_ptr() as *mut u16),  // Unique identifier
                Comment: PWSTR::null(),  // Optional comment field (unused)
                LastWritten: FILETIME::default(),  // OS manages this timestamp
                CredentialBlobSize: (password_wide.len() * 2) as u32,  // Size in bytes (u16 * 2)
                CredentialBlob: password_wide.as_ptr() as *mut u8,  // Password data
                Persist: CRED_PERSIST_LOCAL_MACHINE,  // Persists across logins
                AttributeCount: 0,  // No custom attributes
                Attributes: std::ptr::null_mut(),  // No custom attributes
                TargetAlias: PWSTR::null(),  // Optional alias (unused)
                UserName: PWSTR(username_wide.as_ptr() as *mut u16),  // Username
            };

            CredWriteW(&cred, 0).map_err(|e| AppError::CredentialManagerError {
                operation: format!("save credentials for target '{}'", target),
                source: Some(e.into()),
            })?;
        }

        Ok(())
    }

    fn read(&self, target: &str) -> Result<Option<(String, String)>, AppError> {
        unsafe {
            let target_name: Vec<u16> = OsStr::new(target)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let mut pcred = std::ptr::null_mut();

            match CredReadW(
                PCWSTR::from_raw(target_name.as_ptr()),
                CRED_TYPE_GENERIC,
                0,
                &mut pcred,
            ) {
                Ok(_) => {
                    let cred = &*(pcred as *const CREDENTIALW);

                    // Read username
                    let username = if !cred.UserName.is_null() {
                        PWSTR::from_raw(cred.UserName.0)
                            .to_string()
                            .map_err(|e| AppError::CredentialManagerError {
                                operation: format!("decode username for target '{}'", target),
                                source: Some(e.into()),
                            })?
                    } else {
                        String::new()
                    };

                    // Extract password from credential blob
                    // Password is stored as UTF-16 (wide string) in the blob
                    let password_bytes = std::slice::from_raw_parts(
                        cred.CredentialBlob,
                        cred.CredentialBlobSize as usize,
                    );

                    // Convert byte pairs to u16 values (UTF-16 characters)
                    // Each UTF-16 character is 2 bytes in little-endian format
                    let password_wide: Vec<u16> = password_bytes
                        .chunks_exact(2)  // Group bytes into pairs
                        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))  // Convert to u16
                        .collect();

                    // Decode UTF-16 to Rust String and remove null terminator
                    // The null terminator may be present from Windows API
                    let password = String::from_utf16(&password_wide)
                        .map_err(|e| AppError::CredentialManagerError {
                            operation: format!("decode password for target '{}'", target),
                            source: Some(e.into()),
                        })?
                        .trim_end_matches('\0')  // Remove null terminator if present
                        .to_string();

                    Ok(Some((username, password)))
                }
                Err(_) => {
                    // Credential not found is not an error, just return None
                    Ok(None)
                }
            }
        }
    }

    fn delete(&self, target: &str) -> Result<(), AppError> {
        unsafe {
            let target_name: Vec<u16> = OsStr::new(target)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            // Call Windows CredDeleteW API to remove the credential
            // If the credential doesn't exist, this returns an error,
            // but we treat that as success (idempotent delete)
            CredDeleteW(
                PCWSTR::from_raw(target_name.as_ptr()),
                CRED_TYPE_GENERIC,  // Must match the type used when saving
                0,  // Reserved parameter, must be 0
            )
            .map_err(|e| AppError::CredentialManagerError {
                operation: format!("delete credentials for target '{}'", target),
                source: Some(e.into()),
            })?;
        }

        Ok(())
    }

    fn list_with_prefix(&self, prefix: &str) -> Result<Vec<String>, AppError> {
        use windows::Win32::Security::Credentials::{CredEnumerateW, CredFree};

        unsafe {
            // Build wildcard filter for Windows API (e.g., "TERMSRV/*")
            // The asterisk wildcard matches any characters after the prefix
            let filter: Vec<u16> = OsStr::new(&format!("{}*", prefix))
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            // Variables to receive results from CredEnumerateW
            let mut count = 0u32;  // Number of credentials found
            let mut pcredentials = std::ptr::null_mut();  // Pointer to array of CREDENTIALW pointers

            // Call Windows CredEnumerateW API to list credentials matching filter
            match CredEnumerateW(
                PCWSTR::from_raw(filter.as_ptr()),
                CRED_ENUMERATE_FLAGS(0),  // No special flags
                &mut count,  // Receives count of credentials
                &mut pcredentials,  // Receives pointer to array
            ) {
                Ok(_) => {
                    // Convert raw pointer to slice of credential pointers
                    // CredEnumerateW returns an array of pointers to CREDENTIALW structs
                    let credentials =
                        std::slice::from_raw_parts(pcredentials, count as usize);

                    let mut results = Vec::new();
                    // Extract target name from each credential
                    for cred_ptr in credentials {
                        let cred = &**cred_ptr;  // Dereference twice: *CREDENTIALW* -> CREDENTIALW
                        if !cred.TargetName.is_null() {
                            // Convert UTF-16 target name to Rust String
                            if let Ok(target_name) = PWSTR::from_raw(cred.TargetName.0).to_string()
                            {
                                results.push(target_name);
                            }
                        }
                    }

                    // CRITICAL: Free the credential list to prevent memory leak
                    // Windows API allocates this memory, we must free it
                    CredFree(pcredentials as *const _);

                    Ok(results)
                }
                Err(_) => {
                    // No credentials found, return empty list
                    Ok(Vec::new())
                }
            }
        }
    }
}

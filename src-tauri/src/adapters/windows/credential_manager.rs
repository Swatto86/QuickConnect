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
            // Convert strings to wide (UTF-16) format for Windows API
            let password_wide: Vec<u16> = OsStr::new(password)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let target_name: Vec<u16> = OsStr::new(target)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let username_wide: Vec<u16> = OsStr::new(username)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let cred = CREDENTIALW {
                Flags: CRED_FLAGS(0),
                Type: CRED_TYPE_GENERIC,
                TargetName: PWSTR(target_name.as_ptr() as *mut u16),
                Comment: PWSTR::null(),
                LastWritten: FILETIME::default(),
                CredentialBlobSize: (password_wide.len() * 2) as u32, // Size in bytes
                CredentialBlob: password_wide.as_ptr() as *mut u8,
                Persist: CRED_PERSIST_LOCAL_MACHINE,
                AttributeCount: 0,
                Attributes: std::ptr::null_mut(),
                TargetAlias: PWSTR::null(),
                UserName: PWSTR(username_wide.as_ptr() as *mut u16),
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

                    // Read password (stored as UTF-16 wide string)
                    let password_bytes = std::slice::from_raw_parts(
                        cred.CredentialBlob,
                        cred.CredentialBlobSize as usize,
                    );

                    // Convert bytes to u16 array for UTF-16 decoding
                    let password_wide: Vec<u16> = password_bytes
                        .chunks_exact(2)
                        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                        .collect();

                    // Decode UTF-16, removing null terminator
                    let password = String::from_utf16(&password_wide)
                        .map_err(|e| AppError::CredentialManagerError {
                            operation: format!("decode password for target '{}'", target),
                            source: Some(e.into()),
                        })?
                        .trim_end_matches('\0')
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

            CredDeleteW(
                PCWSTR::from_raw(target_name.as_ptr()),
                CRED_TYPE_GENERIC,
                0,
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
            let filter: Vec<u16> = OsStr::new(&format!("{}*", prefix))
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let mut count = 0u32;
            let mut pcredentials = std::ptr::null_mut();

            match CredEnumerateW(
                PCWSTR::from_raw(filter.as_ptr()),
                CRED_ENUMERATE_FLAGS(0),
                &mut count,
                &mut pcredentials,
            ) {
                Ok(_) => {
                    let credentials =
                        std::slice::from_raw_parts(pcredentials, count as usize);

                    let mut results = Vec::new();
                    for cred_ptr in credentials {
                        let cred = &**cred_ptr;
                        if !cred.TargetName.is_null() {
                            if let Ok(target_name) = PWSTR::from_raw(cred.TargetName.0).to_string()
                            {
                                results.push(target_name);
                            }
                        }
                    }

                    // Free the credential list
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

//! Error types for QuickConnect
//!
//! This module defines a unified error type hierarchy for the entire application,
//! providing structured error handling with context and user-friendly messages.

use std::io;
use thiserror::Error;

/// Main error type for QuickConnect application
///
/// All functions across command, core, and adapter layers should return this error type
/// for consistent error handling and reporting.
///
/// # Architecture Notes
/// - Uses thiserror for automatic Display and Error trait implementations
/// - Each variant includes contextual information for debugging
/// - #[source] attribute enables error chain traversal
/// - Frontend-facing commands convert AppError to String for Tauri
#[derive(Debug, Error)]
pub enum AppError {
    /// Credentials not found in Windows Credential Manager
    /// This is a normal case when no credentials are saved, not a true error
    #[error("Credentials not found for target: {target}")]
    CredentialsNotFound {
        target: String,
    },

    /// Failed to access Windows Credential Manager
    #[error("Windows Credential Manager error: {operation}")]
    CredentialManagerError {
        operation: String,
        #[source]
        source: Option<anyhow::Error>,
    },

    /// Failed to parse or validate credentials
    #[error("Invalid credentials: {reason}")]
    InvalidCredentials {
        reason: String,
    },

    /// Invalid hostname format
    #[error("Invalid hostname '{hostname}': {reason}")]
    InvalidHostname {
        hostname: String,
        reason: String,
    },

    /// Host not found in database
    #[error("Host not found: {hostname}")]
    HostNotFound {
        hostname: String,
    },

    /// CSV file operation failed
    #[error("CSV operation failed: {operation}")]
    CsvError {
        operation: String,
        #[source]
        source: csv::Error,
    },

    /// JSON serialization/deserialization failed
    #[error("JSON error: {context}")]
    JsonError {
        context: String,
        #[source]
        source: serde_json::Error,
    },

    /// File I/O error
    #[error("File I/O error: {path}")]
    IoError {
        path: String,
        #[source]
        source: io::Error,
    },

    /// Failed to connect to LDAP server
    #[error("LDAP connection failed to server '{server}:{port}'")]
    LdapConnectionError {
        server: String,
        port: u16,
        #[source]
        source: anyhow::Error,
    },

    /// LDAP bind (authentication) failed
    #[error("LDAP authentication failed for user '{username}'")]
    LdapBindError {
        username: String,
        #[source]
        source: anyhow::Error,
    },

    /// LDAP search operation failed
    #[error("LDAP search failed in base DN '{base_dn}'")]
    LdapSearchError {
        base_dn: String,
        #[source]
        source: anyhow::Error,
    },

    /// RDP file generation failed
    #[error("Failed to generate RDP file for host '{hostname}'")]
    RdpFileError {
        hostname: String,
        reason: String,
    },

    /// Failed to launch RDP client (mstsc.exe)
    #[error("Failed to launch RDP client")]
    RdpLaunchError {
        #[source]
        source: io::Error,
    },

    /// Windows Registry operation failed
    #[error("Registry operation failed: {operation}")]
    RegistryError {
        operation: String,
        #[source]
        source: Option<anyhow::Error>,
    },

    /// Tauri window not found
    #[error("Window not found: {window_name}")]
    WindowNotFound {
        window_name: String,
    },

    /// Tauri window operation failed
    #[error("Window operation failed: {operation}")]
    WindowOperationError {
        operation: String,
        #[source]
        source: tauri::Error,
    },

    /// Generic error with context
    #[error("{message}")]
    Other {
        message: String,
        #[source]
        source: Option<anyhow::Error>,
    },
}

impl AppError {
    /// Returns an error code for categorization
    pub fn code(&self) -> &'static str {
        match self {
            AppError::CredentialsNotFound { .. } => "CRED_NOT_FOUND",
            AppError::CredentialManagerError { .. } => "CRED_MANAGER",
            AppError::InvalidCredentials { .. } => "CRED_INVALID",
            AppError::InvalidHostname { .. } => "INVALID_HOSTNAME",
            AppError::HostNotFound { .. } => "HOST_NOT_FOUND",
            AppError::CsvError { .. } => "CSV_ERROR",
            AppError::JsonError { .. } => "JSON_ERROR",
            AppError::IoError { .. } => "IO_ERROR",
            AppError::LdapConnectionError { .. } => "LDAP_CONNECTION",
            AppError::LdapBindError { .. } => "LDAP_BIND",
            AppError::LdapSearchError { .. } => "LDAP_SEARCH",
            AppError::RdpFileError { .. } => "RDP_FILE",
            AppError::RdpLaunchError { .. } => "RDP_LAUNCH",
            AppError::RegistryError { .. } => "REGISTRY",
            AppError::WindowNotFound { .. } => "WINDOW_NOT_FOUND",
            AppError::WindowOperationError { .. } => "WINDOW_OP",
            AppError::Other { .. } => "GENERAL",
        }
    }

    /// Returns a user-friendly error message suitable for display
    pub fn user_message(&self) -> String {
        match self {
            AppError::CredentialsNotFound { target } => {
                if target.starts_with("TERMSRV/") {
                    format!("No credentials saved for host '{}'", target.trim_start_matches("TERMSRV/"))
                } else {
                    "No credentials found. Please save your credentials in the login window first.".to_string()
                }
            }
            AppError::CredentialManagerError { operation, .. } => {
                format!("Failed to access Windows Credential Manager: {}", operation)
            }
            AppError::InvalidCredentials { reason } => {
                format!("Invalid credentials: {}", reason)
            }
            AppError::InvalidHostname { hostname, reason } => {
                format!("Invalid hostname '{}': {}", hostname, reason)
            }
            AppError::HostNotFound { hostname } => {
                format!("Host '{}' not found", hostname)
            }
            AppError::CsvError { operation, .. } => {
                format!("Failed to {} hosts database", operation)
            }
            AppError::JsonError { context, .. } => {
                format!("Failed to process {}", context)
            }
            AppError::IoError { path, .. } => {
                format!("Failed to access file: {}", path)
            }
            AppError::LdapConnectionError { server, .. } => {
                format!("Could not connect to domain controller '{}'. Please verify the server name and network connectivity.", server)
            }
            AppError::LdapBindError { username, .. } => {
                format!("Authentication failed for user '{}'. Please verify your credentials.", username)
            }
            AppError::LdapSearchError { .. } => {
                "Failed to search Active Directory. Please verify your permissions.".to_string()
            }
            AppError::RdpFileError { hostname, reason } => {
                format!("Failed to create RDP connection file for '{}': {}", hostname, reason)
            }
            AppError::RdpLaunchError { .. } => {
                "Failed to launch Remote Desktop Connection. Please ensure mstsc.exe is available.".to_string()
            }
            AppError::RegistryError { operation, .. } => {
                format!("Registry operation failed: {}", operation)
            }
            AppError::WindowNotFound { window_name } => {
                format!("Window '{}' not found", window_name)
            }
            AppError::WindowOperationError { operation, .. } => {
                format!("Window operation failed: {}", operation)
            }
            AppError::Other { message, .. } => message.clone(),
        }
    }

    /// Returns optional remediation steps for the error
    pub fn remediation(&self) -> Option<String> {
        match self {
            AppError::CredentialsNotFound { .. } => {
                Some("Please save your credentials in the login window.".to_string())
            }
            AppError::LdapConnectionError { .. } => {
                Some("Check network connectivity and verify the server name is correct.".to_string())
            }
            AppError::LdapBindError { .. } => {
                Some("Verify your username and password are correct. Try using DOMAIN\\username format.".to_string())
            }
            AppError::RdpLaunchError { .. } => {
                Some("Ensure Remote Desktop Connection (mstsc.exe) is available on your system.".to_string())
            }
            _ => None,
        }
    }

    /// Returns the category for error logging
    pub fn category(&self) -> &'static str {
        match self {
            AppError::CredentialsNotFound { .. } |
            AppError::CredentialManagerError { .. } |
            AppError::InvalidCredentials { .. } => "CREDENTIALS",
            
            AppError::InvalidHostname { .. } |
            AppError::HostNotFound { .. } => "HOSTS",
            
            AppError::CsvError { .. } |
            AppError::JsonError { .. } |
            AppError::IoError { .. } => "FILE_SYSTEM",
            
            AppError::LdapConnectionError { .. } |
            AppError::LdapBindError { .. } |
            AppError::LdapSearchError { .. } => "LDAP",
            
            AppError::RdpFileError { .. } |
            AppError::RdpLaunchError { .. } => "RDP",
            
            AppError::RegistryError { .. } => "REGISTRY",
            
            AppError::WindowNotFound { .. } |
            AppError::WindowOperationError { .. } => "WINDOW",
            
            AppError::Other { .. } => "GENERAL",
        }
    }
}

// Implement Serialize for sending errors to frontend
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 4)?;
        state.serialize_field("message", &self.user_message())?;
        state.serialize_field("code", &self.code())?;
        state.serialize_field("category", &self.category())?;
        state.serialize_field("remediation", &self.remediation())?;
        state.end()
    }
}

// Convert AppError to String for Tauri command compatibility
impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.user_message()
    }
}

// Convenience conversions from common error types
impl From<io::Error> for AppError {
    fn from(err: io::Error) -> Self {
        AppError::Other {
            message: format!("I/O error: {}", err),
            source: Some(err.into()),
        }
    }
}

impl From<csv::Error> for AppError {
    fn from(err: csv::Error) -> Self {
        AppError::CsvError {
            operation: "read".to_string(),
            source: err,
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::JsonError {
            context: "serialization".to_string(),
            source: err,
        }
    }
}

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        AppError::WindowOperationError {
            operation: "unknown".to_string(),
            source: err,
        }
    }
}

//! Core domain types for QuickConnect

use serde::{Deserialize, Serialize};

/// RDP Host structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Host {
    /// Fully Qualified Domain Name (e.g., "server.domain.com")
    pub hostname: String,
    /// Optional user-provided description of the server
    pub description: String,
    /// ISO 8601 formatted timestamp of last successful connection (optional)
    pub last_connected: Option<String>,
}

/// Stored credentials
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredCredentials {
    /// Username in any supported format
    pub username: String,
    /// Password (stored securely in Windows Credential Manager)
    pub password: String,
}

/// Credentials for saving
#[derive(Debug, Deserialize)]
pub struct Credentials {
    /// Username in any supported format
    pub username: String,
    /// Password to store securely
    pub password: String,
}

/// Recent connection entry
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentConnection {
    /// Hostname of the connected server
    pub hostname: String,
    /// Description of the server
    pub description: String,
    /// Unix timestamp (seconds since epoch) of the connection
    pub timestamp: u64,
}

/// Collection of recent connections
#[derive(Debug, Serialize, Deserialize)]
pub struct RecentConnections {
    /// Ordered list of connections (most recent first)
    pub connections: Vec<RecentConnection>,
}

impl RecentConnections {
    /// Creates a new empty recent connections collection
    pub fn new() -> Self {
        Self {
            connections: Vec::new(),
        }
    }

    /// Adds a new connection to the recent connections list
    ///
    /// Removes duplicates, keeps only 5 most recent
    pub fn add_connection(&mut self, hostname: String, description: String) {
        use std::time::{SystemTime, UNIX_EPOCH};
        
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Remove existing entry for this hostname
        self.connections.retain(|c| c.hostname != hostname);

        // Add new connection at the beginning
        self.connections.insert(
            0,
            RecentConnection {
                hostname,
                description,
                timestamp,
            },
        );

        // Keep only the 5 most recent
        if self.connections.len() > 5 {
            self.connections.truncate(5);
        }
    }
}

impl Default for RecentConnections {
    fn default() -> Self {
        Self::new()
    }
}

/// Error payload for the error window
#[derive(Clone, Serialize)]
pub struct ErrorPayload {
    /// The main error message (user-friendly)
    pub message: String,
    /// ISO 8601 formatted timestamp
    pub timestamp: String,
    /// Optional category for error classification
    pub category: Option<String>,
    /// Optional detailed technical information
    pub details: Option<String>,
}

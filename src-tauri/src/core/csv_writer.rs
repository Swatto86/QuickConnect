//! CSV Writer
//!
//! Handles CSV file generation for host lists.
//! Isolated from command layer to enable testing and reuse.

use crate::{Host, AppError};
use std::path::Path;

/// Writes a list of hosts to a CSV file
///
/// # Arguments
/// * `csv_path` - Path to the CSV file to create/overwrite
/// * `hosts` - Slice of Host structs to write
///
/// # Returns
/// * `Ok(())` - Successfully wrote CSV file
/// * `Err(AppError)` - Failed to write CSV
///
/// # Side Effects
/// - Creates or overwrites the file at `csv_path`
/// - Creates parent directories if they don't exist
///
/// # CSV Format
/// ```csv
/// hostname,description,last_connected
/// server01.domain.com,Web Server,13/12/2025 14:30:00
/// server02.domain.com,Database Server,
/// ```
pub fn write_hosts_to_csv(csv_path: &Path, hosts: &[Host]) -> Result<(), AppError> {
    use tracing::{debug, error};

    debug!(
        path = ?csv_path,
        host_count = hosts.len(),
        "Writing hosts to CSV file"
    );

    let mut wtr = csv::WriterBuilder::new()
        .from_path(csv_path)
        .map_err(|e| {
            error!(
                path = ?csv_path,
                error = %e,
                "Failed to create CSV writer"
            );
            AppError::IoError {
                path: csv_path.to_string_lossy().to_string(),
                source: std::io::Error::other(e),
            }
        })?;

    // Write header (includes last_connected for v1.2.0+ compatibility)
    wtr.write_record(["hostname", "description", "last_connected"]).map_err(|e| {
        error!(
            path = ?csv_path,
            error = %e,
            "Failed to write CSV header"
        );
        AppError::IoError {
            path: csv_path.to_string_lossy().to_string(),
            source: std::io::Error::other(e),
        }
    })?;

    // Write records (includes last_connected timestamp)
    for host in hosts {
        wtr.write_record([
            &host.hostname,
            &host.description,
            host.last_connected.as_deref().unwrap_or(""),
        ])
        .map_err(|e| {
            error!(
                path = ?csv_path,
                hostname = %host.hostname,
                error = %e,
                "Failed to write CSV record"
            );
            AppError::IoError {
                path: csv_path.to_string_lossy().to_string(),
                source: std::io::Error::other(e),
            }
        })?;
    }

    wtr.flush().map_err(|e| {
        error!(
            path = ?csv_path,
            error = %e,
            "Failed to flush CSV writer"
        );
        AppError::IoError {
            path: csv_path.to_string_lossy().to_string(),
            source: std::io::Error::other(e),
        }
    })?;

    debug!(
        path = ?csv_path,
        host_count = hosts.len(),
        "Successfully wrote hosts to CSV"
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_write_hosts_to_csv_success() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("hosts.csv");

        let hosts = vec![
            Host {
                hostname: "server01.domain.com".to_string(),
                description: "Web Server".to_string(),
                last_connected: None,
            },
            Host {
                hostname: "server02.domain.com".to_string(),
                description: "Database Server".to_string(),
                last_connected: None,
            },
        ];

        let result = write_hosts_to_csv(&csv_path, &hosts);
        assert!(result.is_ok());

        let content = std::fs::read_to_string(&csv_path).unwrap();
        assert!(content.contains("hostname,description"));
        assert!(content.contains("server01.domain.com,Web Server"));
        assert!(content.contains("server02.domain.com,Database Server"));
    }

    #[test]
    fn test_write_empty_hosts_list() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("empty.csv");

        let hosts: Vec<Host> = vec![];
        let result = write_hosts_to_csv(&csv_path, &hosts);
        assert!(result.is_ok());

        let content = std::fs::read_to_string(&csv_path).unwrap();
        assert_eq!(content.trim(), "hostname,description,last_connected");
    }

    #[test]
    fn test_write_hosts_with_special_characters() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("special.csv");

        let hosts = vec![Host {
            hostname: "server-01.domain.com".to_string(),
            description: "Server with \"quotes\" and, commas".to_string(),
            last_connected: None,
        }];

        let result = write_hosts_to_csv(&csv_path, &hosts);
        assert!(result.is_ok());

        let content = std::fs::read_to_string(&csv_path).unwrap();
        assert!(content.contains("server-01.domain.com"));
        // CSV library should properly escape the description
        assert!(content.contains("Server with"));
    }
}

//! CSV Reader
//!
//! Handles reading and parsing CSV files containing host lists.
//! Isolated from command layer to enable testing and reuse.
//!
//! # Why this exists
//! Separates CSV parsing logic from the command layer, adhering to the principle
//! that commands should be thin and delegate all business logic to core modules.
//!
//! # Why separate
//! CSV parsing involves multiple steps (file reading, parsing, validation) that
//! belong in the core domain, not in the command layer. This enables:
//! - Unit testing without Tauri context
//! - Reuse across different command contexts
//! - Clear separation between I/O and command handling

use crate::{Host, AppError};
use std::path::Path;

/// Reads hosts from a CSV file
///
/// # Why this exists
/// Provides a single, testable function for reading host data from CSV files.
/// Encapsulates all CSV parsing logic away from the command layer.
///
/// # Arguments
/// * `csv_path` - Path to the CSV file to read
///
/// # Returns
/// * `Ok(Vec<Host>)` - Successfully parsed hosts (empty vec if file doesn't exist)
/// * `Err(AppError)` - Failed to read or parse CSV
///
/// # Side Effects
/// - Reads file from disk at `csv_path`
///
/// # Failure Modes
/// - File cannot be read (permission denied, etc.)
/// - CSV is malformed (invalid format, missing columns)
/// - Records cannot be parsed into Host structs
///
/// # CSV Format
/// Expected format with optional last_connected column:
/// ```csv
/// hostname,description,last_connected
/// server01.domain.com,Web Server,13/12/2025 14:30:00
/// server02.domain.com,Database Server,
/// ```
pub fn read_hosts_from_csv(csv_path: &Path) -> Result<Vec<Host>, AppError> {
    use tracing::{debug, error};

    debug!(
        path = ?csv_path,
        "Reading hosts from CSV file"
    );

    // If file doesn't exist, return empty list (not an error)
    if !csv_path.exists() {
        debug!(
            path = ?csv_path,
            "CSV file does not exist, returning empty host list"
        );
        return Ok(Vec::new());
    }

    let contents = std::fs::read_to_string(csv_path).map_err(|e| {
        error!(
            path = ?csv_path,
            error = %e,
            "Failed to read CSV file"
        );
        AppError::IoError {
            path: csv_path.to_string_lossy().to_string(),
            source: e,
        }
    })?;

    let mut hosts = Vec::new();
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_reader(contents.as_bytes());

    // Parse each CSV record into a Host struct
    // CSV format: hostname, description, last_connected (optional, added in v1.2.0)
    for result in reader.records() {
        match result {
            Ok(record) => {
                // Minimum 2 columns required (hostname, description)
                if record.len() >= 2 {
                    // last_connected column is optional for backwards compatibility
                    // with v1.1.0 CSV files that didn't have this column
                    let last_connected = if record.len() >= 3 && !record[2].is_empty() {
                        Some(record[2].to_string())
                    } else {
                        None
                    };
                    hosts.push(Host {
                        hostname: record[0].to_string(),
                        description: record[1].to_string(),
                        last_connected,
                    });
                }
            }
            Err(e) => {
                error!(
                    path = ?csv_path,
                    error = %e,
                    "Failed to parse CSV record"
                );
                return Err(AppError::CsvError {
                    operation: "parse CSV record".to_string(),
                    source: e,
                });
            }
        }
    }

    debug!(
        path = ?csv_path,
        host_count = hosts.len(),
        "Successfully loaded hosts from CSV"
    );

    Ok(hosts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_read_nonexistent_file_returns_empty() {
        let path = Path::new("nonexistent_file.csv");
        let result = read_hosts_from_csv(path);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_read_valid_csv() {
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "hostname,description,last_connected").unwrap();
        writeln!(file, "server01.local,Web Server,13/12/2025 14:30:00").unwrap();
        writeln!(file, "server02.local,DB Server,").unwrap();

        let hosts = read_hosts_from_csv(file.path()).unwrap();
        assert_eq!(hosts.len(), 2);
        assert_eq!(hosts[0].hostname, "server01.local");
        assert_eq!(hosts[0].description, "Web Server");
        assert_eq!(hosts[0].last_connected, Some("13/12/2025 14:30:00".to_string()));
        assert_eq!(hosts[1].hostname, "server02.local");
        assert_eq!(hosts[1].last_connected, None);
    }

    #[test]
    fn test_read_csv_without_last_connected_column() {
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "hostname,description").unwrap();
        writeln!(file, "server01.local,Web Server").unwrap();

        let hosts = read_hosts_from_csv(file.path()).unwrap();
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].hostname, "server01.local");
        assert_eq!(hosts[0].last_connected, None);
    }
}

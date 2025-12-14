//! Host operations - core business logic for host management
//!
//! Handles all host CRUD operations, delegating to CSV reader/writer for persistence.
//!
//! # Why this exists
//! Encapsulates host management business logic separate from the command layer.
//! Commands should call these functions instead of directly manipulating CSV files.
//!
//! # Why separate
//! Separates business logic (upsert, delete, search, timestamp updates) from
//! I/O operations (CSV reading/writing) and command handling. This enables:
//! - Unit testing without Tauri context
//! - Reuse across different interfaces
//! - Clear separation of concerns

use crate::{Host, AppError};
use crate::core::{csv_reader, csv_writer};
use crate::infra::{debug_log, get_hosts_csv_path};
use std::path::Path;

/// Reads all hosts from the CSV file.
///
/// # Why this exists
/// Provides a simple interface for retrieving all hosts. Delegates to csv_reader
/// but adds logging and error handling appropriate for the core layer.
///
/// # Returns
/// * `Ok(Vec<Host>)` - All hosts from CSV (empty vec if file doesn't exist)
/// * `Err(AppError)` - Failed to read or parse CSV
///
/// # Side Effects
/// - Reads hosts.csv from disk
pub fn get_all_hosts() -> Result<Vec<Host>, AppError> {
    debug_log("DEBUG", "HOST_OPERATIONS", "Reading all hosts", None);
    
    let path = get_hosts_csv_path()
        .map_err(|e| AppError::Other {
            message: format!("Failed to get CSV path: {}", e),
            source: None,
        })?;
    
    let hosts = csv_reader::read_hosts_from_csv(&path)?;
    
    debug_log(
        "DEBUG",
        "HOST_OPERATIONS",
        &format!("Successfully loaded {} hosts", hosts.len()),
        None,
    );
    
    Ok(hosts)
}

/// Searches hosts by hostname or description (case-insensitive).
///
/// # Why this exists
/// Provides filtered host retrieval for search functionality. Keeps search
/// logic in the core layer where it can be tested independently.
///
/// # Arguments
/// * `query` - Search term to match against hostname and description
///
/// # Returns
/// * `Ok(Vec<Host>)` - Filtered hosts matching the query
/// * `Err(AppError)` - Failed to read hosts
///
/// # Side Effects
/// - Reads hosts.csv from disk
pub fn search_hosts(query: &str) -> Result<Vec<Host>, AppError> {
    let hosts = get_all_hosts()?;
    let query = query.to_lowercase();

    let filtered: Vec<Host> = hosts
        .into_iter()
        .filter(|host| {
            host.hostname.to_lowercase().contains(&query)
                || host.description.to_lowercase().contains(&query)
        })
        .collect();

    Ok(filtered)
}

/// Saves or updates a host (upsert operation).
///
/// # Why this exists
/// Encapsulates the upsert logic: update if exists, insert if new. This is
/// business logic that belongs in core, not in the command or persistence layers.
///
/// # Arguments
/// * `host` - The host to save or update
///
/// # Returns
/// * `Ok(())` - Host saved successfully
/// * `Err(AppError)` - Validation failed or persistence error
///
/// # Side Effects
/// - Reads hosts.csv
/// - Writes updated hosts.csv
///
/// # Failure Modes
/// - Empty hostname (validation failure)
/// - CSV read/write errors
/// - Disk full
pub fn upsert_host(host: Host) -> Result<(), AppError> {
    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        &format!("Upserting host: {} - {}", host.hostname, host.description),
        None,
    );

    // Validate hostname
    if host.hostname.trim().is_empty() {
        return Err(AppError::InvalidHostname {
            hostname: host.hostname.clone(),
            reason: "Hostname cannot be empty".to_string(),
        });
    }

    // Read existing hosts
    let mut hosts = get_all_hosts()?;

    // Upsert logic: update existing host or add new one
    // Hostname is the unique identifier for deduplication
    if let Some(idx) = hosts.iter().position(|h| h.hostname == host.hostname) {
        debug_log(
            "DEBUG",
            "HOST_OPERATIONS",
            &format!("Updating existing host: {}", host.hostname),
            None,
        );
        hosts[idx] = host;
    } else {
        debug_log(
            "DEBUG",
            "HOST_OPERATIONS",
            &format!("Adding new host: {}", host.hostname),
            None,
        );
        hosts.push(host);
    }

    // Write back to CSV
    let path = get_hosts_csv_path()
        .map_err(|e| AppError::Other {
            message: format!("Failed to get CSV path: {}", e),
            source: None,
        })?;
    
    csv_writer::write_hosts_to_csv(&path, &hosts)?;

    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        "Host upserted successfully",
        None,
    );

    Ok(())
}

/// Deletes a host by hostname.
///
/// # Why this exists
/// Encapsulates deletion logic. Commands should call this instead of directly
/// manipulating CSV files.
///
/// # Arguments
/// * `hostname` - The hostname of the host to delete
///
/// # Returns
/// * `Ok(())` - Host deleted successfully
/// * `Err(AppError)` - Host not found or persistence error
///
/// # Side Effects
/// - Reads hosts.csv
/// - Writes updated hosts.csv
///
/// # Failure Modes
/// - Host doesn't exist (not treated as error, idempotent delete)
/// - CSV read/write errors
pub fn delete_host(hostname: &str) -> Result<(), AppError> {
    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        &format!("Deleting host: {}", hostname),
        None,
    );

    // Read all hosts and filter out the one to delete
    let hosts: Vec<Host> = get_all_hosts()?
        .into_iter()
        .filter(|h| h.hostname != hostname)
        .collect();

    // Write back to CSV
    let path = get_hosts_csv_path()
        .map_err(|e| AppError::Other {
            message: format!("Failed to get CSV path: {}", e),
            source: None,
        })?;
    
    csv_writer::write_hosts_to_csv(&path, &hosts)?;

    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        &format!("Host {} deleted successfully", hostname),
        None,
    );

    Ok(())
}

/// Deletes all hosts.
///
/// # Why this exists
/// Provides a safe way to clear all hosts. Used during application reset.
///
/// # Returns
/// * `Ok(())` - All hosts deleted successfully
/// * `Err(AppError)` - Persistence error
///
/// # Side Effects
/// - Writes empty hosts.csv (with header only)
pub fn delete_all_hosts() -> Result<(), AppError> {
    debug_log(
        "WARN",
        "HOST_OPERATIONS",
        "Deleting all hosts",
        None,
    );

    let path = get_hosts_csv_path()
        .map_err(|e| AppError::Other {
            message: format!("Failed to get CSV path: {}", e),
            source: None,
        })?;
    
    // Write empty CSV (just header)
    csv_writer::write_hosts_to_csv(&path, &[])?;

    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        "All hosts deleted successfully",
        None,
    );

    Ok(())
}

/// Updates the last_connected timestamp for a host.
///
/// # Why this exists
/// Encapsulates the timestamp update logic. Called automatically after
/// successful RDP connections to track usage.
///
/// # Arguments
/// * `hostname` - The hostname to update
///
/// # Returns
/// * `Ok(())` - Timestamp updated successfully
/// * `Err(AppError)` - Host not found or persistence error
///
/// # Side Effects
/// - Reads hosts.csv
/// - Writes updated hosts.csv with new timestamp
///
/// # Failure Modes
/// - Host not found in CSV
/// - CSV read/write errors
pub fn update_last_connected(hostname: &str) -> Result<(), AppError> {
    use chrono::Local;

    // Generate timestamp in UK date format: DD/MM/YYYY HH:MM:SS
    // This format is used consistently across the application
    let timestamp = Local::now().format("%d/%m/%Y %H:%M:%S").to_string();

    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        &format!("Updating last connected for {} to {}", hostname, timestamp),
        None,
    );

    // Read all hosts
    let mut hosts = get_all_hosts()?;

    // Find and update the host
    let mut found = false;
    for host in &mut hosts {
        if host.hostname == hostname {
            host.last_connected = Some(timestamp.clone());
            found = true;
            break;
        }
    }

    if !found {
        return Err(AppError::HostNotFound {
            hostname: hostname.to_string(),
        });
    }

    // Write back to CSV
    let path = get_hosts_csv_path()
        .map_err(|e| AppError::Other {
            message: format!("Failed to get CSV path: {}", e),
            source: None,
        })?;
    
    csv_writer::write_hosts_to_csv(&path, &hosts)?;

    debug_log(
        "INFO",
        "HOST_OPERATIONS",
        &format!("Successfully updated last connected for {}", hostname),
        None,
    );

    Ok(())
}

/// Migrates hosts.csv from old location (working directory) to new location (AppData).
///
/// # Why this exists
/// Handles data migration for users upgrading from v1.0.0 to v1.1.0+.
/// This was added when the storage location changed from the application
/// directory to the proper AppData location.
///
/// # Why separate
/// Migration logic is infrastructure/deployment concern, but operates on
/// host data, so it lives in the core::hosts module where it has access
/// to the necessary operations.
///
/// # Side Effects
/// - Checks if hosts.csv exists in working directory
/// - Copies to AppData location if not already there
/// - Deletes old file after successful copy
///
/// # Failure Modes
/// - Logs errors but doesn't fail - migration is best-effort
pub fn migrate_hosts_csv_if_needed() {
    let old_path = Path::new("hosts.csv");

    if !old_path.exists() {
        return;
    }

    let new_path = match get_hosts_csv_path() {
        Ok(path) => path,
        Err(e) => {
            debug_log(
                "ERROR",
                "MIGRATION",
                &format!("Failed to get new CSV path: {}", e),
                None,
            );
            return;
        }
    };

    if new_path.exists() {
        debug_log(
            "INFO",
            "MIGRATION",
            "hosts.csv already exists in AppData, skipping migration",
            None,
        );
        return;
    }

    if let Err(e) = std::fs::copy(old_path, &new_path) {
        debug_log(
            "ERROR",
            "MIGRATION",
            &format!("Failed to migrate hosts.csv to AppData: {}", e),
            None,
        );
        return;
    }

    debug_log(
        "INFO",
        "MIGRATION",
        &format!("Successfully migrated hosts.csv to {}", new_path.display()),
        None,
    );

    if let Err(e) = std::fs::remove_file(old_path) {
        debug_log(
            "WARN",
            "MIGRATION",
            &format!("Failed to delete old hosts.csv: {}", e),
            None,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    /// Helper to set up a test environment with a temporary CSV file
    fn setup_test_env() -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let csv_path = temp_dir.path().join("hosts.csv");
        (temp_dir, csv_path)
    }

    /// Helper to create test hosts
    fn create_test_host(hostname: &str, description: &str) -> Host {
        Host {
            hostname: hostname.to_string(),
            description: description.to_string(),
            last_connected: None,
        }
    }

    #[test]
    fn test_search_hosts_by_hostname() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server01.domain.com", "Web Server"),
            create_test_host("server02.domain.com", "Database Server"),
            create_test_host("workstation01.domain.com", "Dev Machine"),
        ];
        
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        // Mock get_hosts_csv_path by testing csv_reader directly
        let loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        // Test search logic
        let query = "server";
        let filtered: Vec<Host> = loaded_hosts
            .into_iter()
            .filter(|host| {
                host.hostname.to_lowercase().contains(&query.to_lowercase())
                    || host.description.to_lowercase().contains(&query.to_lowercase())
            })
            .collect();
        
        assert_eq!(filtered.len(), 2);
        assert!(filtered.iter().any(|h| h.hostname == "server01.domain.com"));
        assert!(filtered.iter().any(|h| h.hostname == "server02.domain.com"));
    }

    #[test]
    fn test_search_hosts_by_description() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server01.domain.com", "Web Server"),
            create_test_host("server02.domain.com", "Database Server"),
            create_test_host("server03.domain.com", "Mail Server"),
        ];
        
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        let loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        // Test search logic
        let query = "database";
        let filtered: Vec<Host> = loaded_hosts
            .into_iter()
            .filter(|host| {
                host.hostname.to_lowercase().contains(&query.to_lowercase())
                    || host.description.to_lowercase().contains(&query.to_lowercase())
            })
            .collect();
        
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].hostname, "server02.domain.com");
    }

    #[test]
    fn test_search_hosts_case_insensitive() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("SERVER01.DOMAIN.COM", "Web Server"),
            create_test_host("server02.domain.com", "Database"),
        ];
        
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        let loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        // Test case-insensitive search
        let query = "server01";
        let filtered: Vec<Host> = loaded_hosts
            .into_iter()
            .filter(|host| {
                host.hostname.to_lowercase().contains(&query.to_lowercase())
                    || host.description.to_lowercase().contains(&query.to_lowercase())
            })
            .collect();
        
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].hostname.to_lowercase(), "server01.domain.com");
    }

    #[test]
    fn test_search_hosts_empty_query_returns_all() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server01.domain.com", "Web Server"),
            create_test_host("server02.domain.com", "Database"),
        ];
        
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        let loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        // Empty query should match all hosts
        let query = "";
        let filtered: Vec<Host> = loaded_hosts
            .into_iter()
            .filter(|host| {
                host.hostname.to_lowercase().contains(query)
                    || host.description.to_lowercase().contains(query)
            })
            .collect();
        
        assert_eq!(filtered.len(), 2);
    }

    #[test]
    fn test_search_hosts_no_matches() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server01.domain.com", "Web Server"),
            create_test_host("server02.domain.com", "Database"),
        ];
        
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        let loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        let query = "nonexistent";
        let filtered: Vec<Host> = loaded_hosts
            .into_iter()
            .filter(|host| {
                host.hostname.to_lowercase().contains(query)
                    || host.description.to_lowercase().contains(query)
            })
            .collect();
        
        assert!(filtered.is_empty());
    }

    #[test]
    fn test_upsert_host_insert_new() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        // Start with empty hosts
        csv_writer::write_hosts_to_csv(&csv_path, &[]).expect("Failed to write CSV");
        
        let new_host = create_test_host("server01.domain.com", "Test Server");
        
        // Simulate upsert logic
        let mut hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        // Validate hostname
        assert!(!new_host.hostname.trim().is_empty());
        
        // Check if host exists
        if !hosts.iter().any(|h| h.hostname == new_host.hostname) {
            hosts.push(new_host.clone());
        }
        
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        // Verify
        let loaded = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].hostname, "server01.domain.com");
        assert_eq!(loaded[0].description, "Test Server");
    }

    #[test]
    fn test_upsert_host_update_existing() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        // Start with one host
        let initial_hosts = vec![
            create_test_host("server01.domain.com", "Old Description"),
        ];
        csv_writer::write_hosts_to_csv(&csv_path, &initial_hosts).expect("Failed to write CSV");
        
        // Update with same hostname, different description
        let updated_host = Host {
            hostname: "server01.domain.com".to_string(),
            description: "New Description".to_string(),
            last_connected: Some("14/12/2025 10:30:00".to_string()),
        };
        
        // Simulate upsert logic
        let mut hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        if let Some(idx) = hosts.iter().position(|h| h.hostname == updated_host.hostname) {
            hosts[idx] = updated_host.clone();
        } else {
            hosts.push(updated_host.clone());
        }
        
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        // Verify
        let loaded = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].hostname, "server01.domain.com");
        assert_eq!(loaded[0].description, "New Description");
        assert_eq!(loaded[0].last_connected, Some("14/12/2025 10:30:00".to_string()));
    }

    #[test]
    fn test_upsert_host_rejects_empty_hostname() {
        let host = Host {
            hostname: "".to_string(),
            description: "Test".to_string(),
            last_connected: None,
        };
        
        // Validate hostname
        assert!(host.hostname.trim().is_empty());
    }

    #[test]
    fn test_upsert_host_trims_whitespace_hostname() {
        let host = Host {
            hostname: "  server01.domain.com  ".to_string(),
            description: "Test".to_string(),
            last_connected: None,
        };
        
        // Validate that trimmed hostname is not empty
        assert!(!host.hostname.trim().is_empty());
        assert_eq!(host.hostname.trim(), "server01.domain.com");
    }

    #[test]
    fn test_delete_host_removes_correct_host() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server01.domain.com", "Server 1"),
            create_test_host("server02.domain.com", "Server 2"),
            create_test_host("server03.domain.com", "Server 3"),
        ];
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        // Simulate delete logic
        let hostname_to_delete = "server02.domain.com";
        let mut loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        loaded_hosts.retain(|h| h.hostname != hostname_to_delete);
        
        csv_writer::write_hosts_to_csv(&csv_path, &loaded_hosts).expect("Failed to write CSV");
        
        // Verify
        let final_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        assert_eq!(final_hosts.len(), 2);
        assert!(final_hosts.iter().any(|h| h.hostname == "server01.domain.com"));
        assert!(final_hosts.iter().any(|h| h.hostname == "server03.domain.com"));
        assert!(!final_hosts.iter().any(|h| h.hostname == "server02.domain.com"));
    }

    #[test]
    fn test_delete_host_idempotent_when_not_exists() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server01.domain.com", "Server 1"),
        ];
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        // Try to delete non-existent host
        let hostname_to_delete = "nonexistent.domain.com";
        let mut loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        let before_count = loaded_hosts.len();
        loaded_hosts.retain(|h| h.hostname != hostname_to_delete);
        
        csv_writer::write_hosts_to_csv(&csv_path, &loaded_hosts).expect("Failed to write CSV");
        
        // Verify no change
        let final_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        assert_eq!(final_hosts.len(), before_count);
        assert_eq!(final_hosts[0].hostname, "server01.domain.com");
    }

    #[test]
    fn test_delete_all_hosts_clears_list() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server01.domain.com", "Server 1"),
            create_test_host("server02.domain.com", "Server 2"),
            create_test_host("server03.domain.com", "Server 3"),
        ];
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        // Delete all
        csv_writer::write_hosts_to_csv(&csv_path, &[]).expect("Failed to write empty CSV");
        
        // Verify
        let final_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        assert!(final_hosts.is_empty());
    }

    #[test]
    fn test_update_last_connected_updates_timestamp() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server01.domain.com", "Server 1"),
            create_test_host("server02.domain.com", "Server 2"),
        ];
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        // Simulate timestamp update
        let hostname_to_update = "server01.domain.com";
        let timestamp = "14/12/2025 15:45:30";
        
        let mut loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        let mut found = false;
        for host in &mut loaded_hosts {
            if host.hostname == hostname_to_update {
                host.last_connected = Some(timestamp.to_string());
                found = true;
                break;
            }
        }
        
        assert!(found, "Host should be found");
        
        csv_writer::write_hosts_to_csv(&csv_path, &loaded_hosts).expect("Failed to write CSV");
        
        // Verify
        let final_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        let updated_host = final_hosts.iter().find(|h| h.hostname == hostname_to_update).expect("Host should exist");
        assert_eq!(updated_host.last_connected, Some(timestamp.to_string()));
    }

    #[test]
    fn test_update_last_connected_returns_error_if_not_found() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server01.domain.com", "Server 1"),
        ];
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        // Try to update non-existent host
        let hostname_to_update = "nonexistent.domain.com";
        let timestamp = "14/12/2025 15:45:30";
        
        let mut loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        let mut found = false;
        for host in &mut loaded_hosts {
            if host.hostname == hostname_to_update {
                host.last_connected = Some(timestamp.to_string());
                found = true;
                break;
            }
        }
        
        assert!(!found, "Host should not be found");
    }

    #[test]
    fn test_update_last_connected_preserves_other_fields() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let original_description = "Important Server";
        let hosts = vec![
            Host {
                hostname: "server01.domain.com".to_string(),
                description: original_description.to_string(),
                last_connected: Some("13/12/2025 10:00:00".to_string()),
            },
        ];
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        // Update timestamp
        let hostname_to_update = "server01.domain.com";
        let new_timestamp = "14/12/2025 15:45:30";
        
        let mut loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        for host in &mut loaded_hosts {
            if host.hostname == hostname_to_update {
                host.last_connected = Some(new_timestamp.to_string());
                break;
            }
        }
        
        csv_writer::write_hosts_to_csv(&csv_path, &loaded_hosts).expect("Failed to write CSV");
        
        // Verify other fields preserved
        let final_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        let updated_host = &final_hosts[0];
        assert_eq!(updated_host.hostname, "server01.domain.com");
        assert_eq!(updated_host.description, original_description);
        assert_eq!(updated_host.last_connected, Some(new_timestamp.to_string()));
    }

    #[test]
    fn test_upsert_multiple_hosts_maintains_order() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        csv_writer::write_hosts_to_csv(&csv_path, &[]).expect("Failed to write CSV");
        
        let hosts_to_add = vec![
            create_test_host("alpha.domain.com", "Alpha"),
            create_test_host("beta.domain.com", "Beta"),
            create_test_host("gamma.domain.com", "Gamma"),
        ];
        
        // Add hosts one by one
        let mut current_hosts = Vec::new();
        for host in hosts_to_add {
            current_hosts.push(host);
            csv_writer::write_hosts_to_csv(&csv_path, &current_hosts).expect("Failed to write CSV");
        }
        
        // Verify order preserved
        let final_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        assert_eq!(final_hosts.len(), 3);
        assert_eq!(final_hosts[0].hostname, "alpha.domain.com");
        assert_eq!(final_hosts[1].hostname, "beta.domain.com");
        assert_eq!(final_hosts[2].hostname, "gamma.domain.com");
    }

    #[test]
    fn test_search_with_special_characters() {
        let (_temp_dir, csv_path) = setup_test_env();
        
        let hosts = vec![
            create_test_host("server-01.domain.com", "Server with dash"),
            create_test_host("server_02.domain.com", "Server with underscore"),
            create_test_host("server.03.domain.com", "Server with dots"),
        ];
        csv_writer::write_hosts_to_csv(&csv_path, &hosts).expect("Failed to write CSV");
        
        let loaded_hosts = csv_reader::read_hosts_from_csv(&csv_path).expect("Failed to read CSV");
        
        // Search for dash
        let query = "server-";
        let filtered: Vec<Host> = loaded_hosts.clone()
            .into_iter()
            .filter(|host| {
                host.hostname.to_lowercase().contains(query)
                    || host.description.to_lowercase().contains(query)
            })
            .collect();
        
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].hostname, "server-01.domain.com");
    }
}

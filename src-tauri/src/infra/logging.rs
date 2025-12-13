//! Logging infrastructure for QuickConnect
//!
//! Provides a simple debug logging system that writes structured logs to a file
//! when debug mode is enabled via command-line arguments.

use chrono::Local;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

/// Global flag indicating whether debug logging is enabled.
static DEBUG_MODE: Mutex<bool> = Mutex::new(false);

/// Sets the debug mode flag
pub fn set_debug_mode(enabled: bool) {
    if let Ok(mut flag) = DEBUG_MODE.lock() {
        *flag = enabled;
    }
}

/// Writes a debug log entry to the log file
///
/// # Arguments
/// * `level` - Log level: "INFO", "WARN", "ERROR", "DEBUG"
/// * `category` - Log category for grouping related messages
/// * `message` - The main log message
/// * `error_details` - Optional additional details for debugging
pub fn debug_log(level: &str, category: &str, message: &str, error_details: Option<&str>) {
    let debug_enabled = DEBUG_MODE.lock().map(|flag| *flag).unwrap_or(false);

    if !debug_enabled {
        return;
    }

    // Use AppData\Roaming\QuickConnect for reliable write permissions
    let log_file = if let Ok(appdata_dir) = std::env::var("APPDATA") {
        let quick_connect_dir = PathBuf::from(appdata_dir).join("QuickConnect");
        // Create directory if it doesn't exist
        let _ = std::fs::create_dir_all(&quick_connect_dir);
        quick_connect_dir.join("QuickConnect_Debug.log")
    } else {
        // Fallback to current directory if APPDATA not available
        PathBuf::from("QuickConnect_Debug.log")
    };

    // Check if file is new (to add header)
    let is_new_file = !log_file.exists();

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_file) {
        // Write header if this is a new file
        if is_new_file {
            let _ = write_log_header(&mut file);
        }

        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
        let level_indicator = get_level_indicator(level);

        let mut log_entry = format!(
            "\n{} {} [{:8}] [{}]\n",
            timestamp, level_indicator, level, category
        );
        log_entry.push_str(&format!("Message: {}\n", message));

        if let Some(details) = error_details {
            log_entry.push_str(&format!("Details: {}\n", details));
        }

        // Add context information based on category
        add_category_context(&mut log_entry, category);

        // Add troubleshooting info for errors
        if level == "ERROR" {
            add_error_troubleshooting(&mut log_entry, category);
        }

        // Add warning context
        if level == "WARN" {
            log_entry.push_str("\nRecommendation: This warning may not prevent operation but should be investigated.\n");
        }

        log_entry.push_str(&format!("{}\n", "-".repeat(80)));

        if let Err(e) = write!(file, "{}", log_entry) {
            eprintln!("Failed to write to debug log file: {}", e);
        }
    } else {
        eprintln!("Failed to open debug log file: {:?}", log_file);
    }
}

fn write_log_header(file: &mut std::fs::File) -> std::io::Result<()> {
    writeln!(file, "{}", "=".repeat(80))?;
    writeln!(file, "QuickConnect Debug Log")?;
    writeln!(file, "{}", "=".repeat(80))?;
    writeln!(file, "This file contains detailed application logs and debugging information.")?;
    writeln!(file, "Generated when running QuickConnect with --debug or --debug-log argument.")?;
    writeln!(file)?;
    writeln!(file, "To enable debug logging, run: QuickConnect.exe --debug")?;
    writeln!(file)?;
    writeln!(file, "Log Levels:")?;
    writeln!(file, "  - INFO:  General informational messages")?;
    writeln!(file, "  - WARN:  Warning messages that may require attention")?;
    writeln!(file, "  - ERROR: Error messages indicating failures")?;
    writeln!(file, "  - DEBUG: Detailed debugging information")?;
    writeln!(file)?;
    writeln!(file, "{}", "=".repeat(80))?;
    writeln!(file)?;
    Ok(())
}

fn get_level_indicator(level: &str) -> &'static str {
    match level {
        "ERROR" => "[!]",
        "WARN" => "[*]",
        "INFO" => "[i]",
        "DEBUG" => "[d]",
        _ => "[?]",
    }
}

fn add_category_context(log_entry: &mut String, category: &str) {
    match category {
        "RDP_LAUNCH" => {
            if let Ok(appdata_dir) = std::env::var("APPDATA") {
                let connections_dir = PathBuf::from(appdata_dir)
                    .join("QuickConnect")
                    .join("Connections");
                log_entry.push_str(&format!("RDP Files Directory: {:?}\n", connections_dir));
            }
        }
        "CREDENTIALS" => {
            log_entry.push_str("Credential Storage: Windows Credential Manager\n");
        }
        "LDAP_CONNECTION" | "LDAP_BIND" | "LDAP_SEARCH" => {
            log_entry.push_str("LDAP Port: 389\n");
        }
        _ => {}
    }
}

fn add_error_troubleshooting(log_entry: &mut String, category: &str) {
    log_entry.push_str("\nPossible Causes:\n");
    match category {
        "LDAP_CONNECTION" => {
            log_entry.push_str("  • LDAP server is not reachable or incorrect server name\n");
            log_entry.push_str("  • Port 389 is blocked by firewall\n");
            log_entry.push_str("  • Network connectivity issues\n");
            log_entry.push_str("  • DNS resolution failure for server name\n");
            log_entry.push_str("\nTroubleshooting Steps:\n");
            log_entry.push_str("  1. Verify server name is correct\n");
            log_entry.push_str("  2. Test network connectivity: ping <server>\n");
            log_entry.push_str("  3. Check firewall rules for port 389\n");
            log_entry.push_str("  4. Verify DNS resolution: nslookup <server>\n");
        }
        "LDAP_BIND" => {
            log_entry.push_str("  • Invalid credentials (username or password)\n");
            log_entry.push_str("  • Account is locked or disabled\n");
            log_entry.push_str("  • Username format is incorrect\n");
            log_entry.push_str("  • Insufficient permissions for LDAP queries\n");
            log_entry.push_str("  • Anonymous bind is disabled on the domain controller\n");
            log_entry.push_str("\nTroubleshooting Steps:\n");
            log_entry.push_str("  1. Verify credentials are correct\n");
            log_entry.push_str("  2. Try different username formats: DOMAIN\\username or username@domain.com\n");
            log_entry.push_str("  3. Check if account is locked or disabled in Active Directory\n");
            log_entry.push_str("  4. Verify account has permission to query AD\n");
        }
        "LDAP_SEARCH" => {
            log_entry.push_str("  • Base DN is incorrect or domain name is wrong\n");
            log_entry.push_str("  • LDAP filter syntax error\n");
            log_entry.push_str("  • Insufficient permissions to search the directory\n");
            log_entry.push_str("  • No Windows Server computers found in the domain\n");
            log_entry.push_str("  • Connection was lost during search\n");
            log_entry.push_str("\nTroubleshooting Steps:\n");
            log_entry.push_str("  1. Verify domain name is correct\n");
            log_entry.push_str("  2. Check LDAP filter syntax\n");
            log_entry.push_str("  3. Verify account has read permissions on computer objects\n");
        }
        "CREDENTIALS" => {
            log_entry.push_str("  • Windows Credential Manager access denied\n");
            log_entry.push_str("  • Credential storage is corrupted\n");
            log_entry.push_str("  • Insufficient permissions to access credentials\n");
            log_entry.push_str("\nTroubleshooting Steps:\n");
            log_entry.push_str("  1. Run application as administrator\n");
            log_entry.push_str("  2. Check Windows Credential Manager (Control Panel > Credential Manager)\n");
            log_entry.push_str("  3. Try removing and re-adding credentials\n");
        }
        "RDP_LAUNCH" => {
            log_entry.push_str("  • mstsc.exe (RDP client) is not available or corrupted\n");
            log_entry.push_str("  • RDP file creation failed (permissions or disk space)\n");
            log_entry.push_str("  • RDP file directory is not accessible\n");
            log_entry.push_str("  • Malformed RDP file content\n");
            log_entry.push_str("\nTroubleshooting Steps:\n");
            log_entry.push_str("  1. Verify mstsc.exe exists in System32\n");
            log_entry.push_str("  2. Check disk space in AppData folder\n");
            log_entry.push_str("  3. Verify file permissions in %APPDATA%\\QuickConnect\\Connections\n");
            log_entry.push_str("  4. Try running as administrator\n");
        }
        "CSV_OPERATIONS" => {
            log_entry.push_str("  • File permissions issue\n");
            log_entry.push_str("  • Disk space is full\n");
            log_entry.push_str("  • File is locked by another process\n");
            log_entry.push_str("  • Invalid CSV format or corrupted file\n");
            log_entry.push_str("\nTroubleshooting Steps:\n");
            log_entry.push_str("  1. Close any programs that may have hosts.csv open\n");
            log_entry.push_str("  2. Check disk space\n");
            log_entry.push_str("  3. Verify file permissions\n");
            log_entry.push_str("  4. Check if antivirus is blocking file access\n");
        }
        "HOST_CREDENTIALS" => {
            log_entry.push_str("  • Failed to save/retrieve per-host credentials\n");
            log_entry.push_str("  • Credential format is invalid\n");
            log_entry.push_str("  • Permission denied\n");
            log_entry.push_str("\nTroubleshooting Steps:\n");
            log_entry.push_str("  1. Check Windows Credential Manager for TERMSRV/* entries\n");
            log_entry.push_str("  2. Try running as administrator\n");
            log_entry.push_str("  3. Verify hostname is valid\n");
        }
        _ => {
            log_entry.push_str("  • Check system event logs for more details\n");
            log_entry.push_str("  • Verify application has necessary permissions\n");
            log_entry.push_str("  • Try running as administrator\n");
        }
    }
}

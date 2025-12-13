//! LDAP Domain Scanner
//!
//! Scans Active Directory domains to discover Windows Server hosts.
//! Supports authenticated LDAP queries against domain controllers.

use crate::{Host, StoredCredentials, AppError};
use crate::infra::debug_log;
use ldap3::{LdapConnAsync, Scope, SearchEntry};

/// Result of a domain scan operation
pub struct DomainScanResult {
    pub hosts: Vec<Host>,
    pub count: usize,
}

/// Scans an Active Directory domain for Windows Server computers
///
/// # Arguments
/// * `domain` - Domain name (e.g., "contoso.com")
/// * `server` - Domain controller hostname/IP
/// * `credentials` - Domain credentials for authentication
///
/// # Returns
/// * `Ok(DomainScanResult)` - Successfully scanned domain
/// * `Err(AppError)` - Connection, authentication, or search failed
///
/// # Side Effects
/// - None (read-only LDAP query)
///
/// # LDAP Query Details
/// - Filter: `(&(objectClass=computer)(operatingSystem=Windows Server*)(dNSHostName=*))`
/// - Attributes: dNSHostName, description, operatingSystem
/// - Scope: Subtree (searches entire domain hierarchy)
/// - Port: 389 (standard LDAP)
///
/// # Authentication
/// - Requires domain user credentials
/// - Supports formats: username, DOMAIN\username, username@domain.com
/// - Uses simple bind authentication
///
/// # Security Considerations
/// - Credentials transmitted over LDAP (port 389) - not encrypted
/// - For production, consider LDAPS (port 636) or StartTLS
/// - Requires domain user with read permissions
pub async fn scan_domain_for_servers(
    domain: &str,
    server: &str,
    credentials: &StoredCredentials,
) -> Result<DomainScanResult, AppError> {
    debug_log(
        "INFO",
        "LDAP_SCAN",
        &format!("Starting LDAP scan for domain: {} on server: {}", domain, server),
        Some(&format!("Domain: {}, Server: {}", domain, server)),
    );

    // Validate inputs
    validate_inputs(domain, server)?;

    // Connect to LDAP server
    let (conn, mut ldap) = connect_to_ldap(server).await?;

    // Drive connection in background
    ldap3::drive!(conn);

    // Authenticate with domain credentials
    authenticate_ldap(&mut ldap, domain, credentials).await?;

    // Search for Windows Server computers
    let hosts = search_windows_servers(&mut ldap, domain).await?;

    // Cleanup: unbind from LDAP
    let _ = ldap.unbind().await;
    debug_log("INFO", "LDAP_CONNECTION", "LDAP connection closed", None);

    if hosts.is_empty() {
        debug_log(
            "ERROR",
            "LDAP_SEARCH",
            "No Windows Servers found in the domain",
            Some("Search completed but no hosts matched filter"),
        );
        return Err(AppError::LdapSearchError {
            base_dn: format_base_dn(domain),
            source: anyhow::anyhow!("No Windows Servers found matching search criteria"),
        });
    }

    let count = hosts.len();
    debug_log(
        "INFO",
        "LDAP_SCAN",
        &format!("Successfully completed scan, found {} hosts", count),
        Some(&format!("Total hosts found: {}", count)),
    );

    Ok(DomainScanResult { hosts, count })
}

/// Validates domain and server inputs
fn validate_inputs(domain: &str, server: &str) -> Result<(), AppError> {
    if domain.trim().is_empty() {
        debug_log(
            "ERROR",
            "LDAP_SCAN",
            "Domain name is empty",
            Some("Domain parameter was empty or whitespace"),
        );
        return Err(AppError::InvalidHostname {
            hostname: domain.to_string(),
            reason: "Domain name cannot be empty".to_string(),
        });
    }

    if server.trim().is_empty() {
        debug_log(
            "ERROR",
            "LDAP_SCAN",
            "Server name is empty",
            Some("Server parameter was empty or whitespace"),
        );
        return Err(AppError::InvalidHostname {
            hostname: server.to_string(),
            reason: "Server name cannot be empty".to_string(),
        });
    }

    Ok(())
}

/// Connects to LDAP server
async fn connect_to_ldap(
    server: &str,
) -> Result<(ldap3::LdapConnAsync, ldap3::Ldap), AppError> {
    let ldap_url = format!("ldap://{}:389", server);
    
    debug_log(
        "INFO",
        "LDAP_CONNECTION",
        &format!("Attempting to connect to: {}", ldap_url),
        None,
    );

    let (conn, ldap) = LdapConnAsync::new(&ldap_url)
        .await
        .map_err(|e| {
            debug_log(
                "ERROR",
                "LDAP_CONNECTION",
                &format!("Failed to connect to LDAP server {}", server),
                Some(&format!(
                    "Connection error: {:?}. Check if server is reachable and port 389 is open.",
                    e
                )),
            );
            AppError::LdapConnectionError {
                server: server.to_string(),
                port: 389,
                source: anyhow::Error::from(e),
            }
        })?;

    debug_log(
        "INFO",
        "LDAP_CONNECTION",
        "LDAP connection established successfully",
        None,
    );

    Ok((conn, ldap))
}

/// Authenticates with LDAP server using domain credentials
async fn authenticate_ldap(
    ldap: &mut ldap3::Ldap,
    domain: &str,
    credentials: &StoredCredentials,
) -> Result<(), AppError> {
    debug_log(
        "INFO",
        "LDAP_BIND",
        "Authenticating with LDAP server",
        None,
    );

    // Format username for LDAP binding
    // Support multiple formats: username, DOMAIN\username, or username@domain.com
    let bind_dn = if credentials.username.contains('@') || credentials.username.contains('\\') {
        credentials.username.clone()
    } else {
        // If just username, append @domain
        format!("{}@{}", credentials.username, domain)
    };

    debug_log(
        "INFO",
        "LDAP_BIND",
        &format!("Attempting authenticated LDAP bind with username: {}", bind_dn),
        Some(&format!("Bind DN: {}", bind_dn)),
    );

    // Perform authenticated bind
    ldap.simple_bind(&bind_dn, &credentials.password)
        .await
        .map_err(|e| {
            debug_log(
                "ERROR",
                "LDAP_BIND",
                "Authenticated LDAP bind failed",
                Some(&format!(
                    "Bind error: {:?}. Check username format (try DOMAIN\\username or username@domain.com) and password.",
                    e
                )),
            );
            AppError::LdapBindError {
                username: bind_dn.clone(),
                source: anyhow::Error::from(e),
            }
        })?;

    debug_log(
        "INFO",
        "LDAP_BIND",
        "Authenticated LDAP bind successful",
        None,
    );

    Ok(())
}

/// Searches for Windows Server computers in the domain
async fn search_windows_servers(
    ldap: &mut ldap3::Ldap,
    domain: &str,
) -> Result<Vec<Host>, AppError> {
    // Build the search base DN from domain
    // e.g., "domain.com" -> "DC=domain,DC=com"
    let base_dn = format_base_dn(domain);

    debug_log(
        "INFO",
        "LDAP_SEARCH",
        &format!("Searching base DN: {}", base_dn),
        Some(&format!(
            "Base DN: {}, Filter: (&(objectClass=computer)(operatingSystem=Windows Server*)(dNSHostName=*))",
            base_dn
        )),
    );

    // LDAP filter for Windows Server computers with DNS hostnames
    let filter = "(&(objectClass=computer)(operatingSystem=Windows Server*)(dNSHostName=*))";
    let attrs = vec!["dNSHostName", "description", "operatingSystem"];

    debug_log(
        "INFO",
        "LDAP_SEARCH",
        &format!("Using LDAP filter: {}", filter),
        None,
    );

    // Execute search
    let (rs, _res) = ldap
        .search(&base_dn, Scope::Subtree, filter, attrs)
        .await
        .map_err(|e| {
            debug_log(
                "ERROR",
                "LDAP_SEARCH",
                "Failed to execute LDAP search",
                Some(&format!("Search execution error: {:?}", e)),
            );
            AppError::LdapSearchError {
                base_dn: base_dn.clone(),
                source: anyhow::Error::from(e),
            }
        })?
        .success()
        .map_err(|e| {
            debug_log(
                "ERROR",
                "LDAP_SEARCH",
                "LDAP search returned error",
                Some(&format!("Search result error: {:?}", e)),
            );
            AppError::LdapSearchError {
                base_dn: base_dn.clone(),
                source: anyhow::Error::from(e),
            }
        })?;

    debug_log(
        "INFO",
        "LDAP_SEARCH",
        &format!("Found {} entries from LDAP", rs.len()),
        Some(&format!("Entry count: {}", rs.len())),
    );

    // Parse search results into Host objects
    let mut hosts = Vec::new();
    for entry in rs {
        let search_entry = SearchEntry::construct(entry);

        // Extract dNSHostName attribute
        if let Some(hostname_values) = search_entry.attrs.get("dNSHostName") {
            if let Some(hostname) = hostname_values.first() {
                // Extract description if available
                let description = search_entry
                    .attrs
                    .get("description")
                    .and_then(|v| v.first())
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                debug_log(
                    "INFO",
                    "LDAP_SEARCH",
                    &format!("Found host: {} - {}", hostname, description),
                    Some(&format!("Hostname: {}, Description: {}", hostname, description)),
                );

                hosts.push(Host {
                    hostname: hostname.to_string(),
                    description,
                    last_connected: None,
                });
            }
        } else {
            debug_log(
                "WARN",
                "LDAP_SEARCH",
                "LDAP entry found but missing dNSHostName attribute",
                None,
            );
        }
    }

    Ok(hosts)
}

/// Formats domain name into LDAP base DN
///
/// # Examples
/// - "contoso.com" -> "DC=contoso,DC=com"
/// - "sub.domain.com" -> "DC=sub,DC=domain,DC=com"
fn format_base_dn(domain: &str) -> String {
    domain
        .split('.')
        .map(|part| format!("DC={}", part))
        .collect::<Vec<String>>()
        .join(",")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_base_dn() {
        assert_eq!(format_base_dn("contoso.com"), "DC=contoso,DC=com");
        assert_eq!(
            format_base_dn("sub.domain.com"),
            "DC=sub,DC=domain,DC=com"
        );
        assert_eq!(format_base_dn("local"), "DC=local");
    }
}

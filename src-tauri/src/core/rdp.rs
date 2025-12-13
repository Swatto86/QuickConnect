//! RDP file generation
//!
//! Platform-agnostic RDP file content generation.
//! RDP files use a standard text format that works across platforms.

use crate::core::Host;

/// Parses a username to extract domain and username components
///
/// Supports multiple formats:
/// - "DOMAIN\username" -> ("DOMAIN", "username")
/// - "username@domain.com" -> ("domain.com", "username")
/// - "username" -> ("", "username")
///
/// # Arguments
/// * `username` - The username string to parse
///
/// # Returns
/// * `(domain, username)` tuple
pub fn parse_username(username: &str) -> (String, String) {
    if username.contains('\\') {
        // Format: DOMAIN\username
        let parts: Vec<&str> = username.splitn(2, '\\').collect();
        if parts.len() == 2 {
            (parts[0].to_string(), parts[1].to_string())
        } else {
            (String::new(), username.to_string())
        }
    } else if username.contains('@') {
        // Format: username@domain.com
        let parts: Vec<&str> = username.splitn(2, '@').collect();
        if parts.len() == 2 {
            (parts[1].to_string(), parts[0].to_string())
        } else {
            (String::new(), username.to_string())
        }
    } else {
        // Format: just username (no domain)
        (String::new(), username.to_string())
    }
}

/// Generates RDP file content for a host connection
///
/// Creates a standard RDP file with optimal settings for Windows Server connections.
///
/// # Arguments
/// * `host` - The host to connect to
/// * `username` - Username for authentication (without domain)
/// * `domain` - Domain for authentication (empty string if none)
///
/// # Returns
/// * RDP file content as a string
pub fn generate_rdp_content(host: &Host, username: &str, domain: &str) -> String {
    format!(
        "screen mode id:i:2\r\n\
desktopwidth:i:1920\r\n\
desktopheight:i:1080\r\n\
session bpp:i:32\r\n\
full address:s:{}\r\n\
compression:i:1\r\n\
keyboardhook:i:2\r\n\
audiocapturemode:i:1\r\n\
videoplaybackmode:i:1\r\n\
connection type:i:2\r\n\
networkautodetect:i:1\r\n\
bandwidthautodetect:i:1\r\n\
enableworkspacereconnect:i:1\r\n\
disable wallpaper:i:0\r\n\
allow desktop composition:i:0\r\n\
allow font smoothing:i:0\r\n\
disable full window drag:i:1\r\n\
disable menu anims:i:1\r\n\
disable themes:i:0\r\n\
disable cursor setting:i:0\r\n\
bitmapcachepersistenable:i:1\r\n\
audiomode:i:0\r\n\
redirectprinters:i:1\r\n\
redirectcomports:i:0\r\n\
redirectsmartcards:i:1\r\n\
redirectclipboard:i:1\r\n\
redirectposdevices:i:0\r\n\
autoreconnection enabled:i:1\r\n\
authentication level:i:0\r\n\
prompt for credentials:i:0\r\n\
negotiate security layer:i:1\r\n\
remoteapplicationmode:i:0\r\n\
alternate shell:s:\r\n\
shell working directory:s:\r\n\
gatewayhostname:s:\r\n\
gatewayusagemethod:i:4\r\n\
gatewaycredentialssource:i:4\r\n\
gatewayprofileusagemethod:i:0\r\n\
promptcredentialonce:i:1\r\n\
use redirection server name:i:0\r\n\
rdgiskdcproxy:i:0\r\n\
kdcproxyname:s:\r\n\
username:s:{}\r\n\
domain:s:{}\r\n\
enablecredsspsupport:i:1\r\n\
public mode:i:0\r\n\
cert ignore:i:1\r\n\
prompt for credentials on client:i:0\r\n\
disableconnectionsharing:i:0\r\n",
        host.hostname, username, domain
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_username_domain_backslash() {
        let (domain, username) = parse_username("CONTOSO\\john.doe");
        assert_eq!(domain, "CONTOSO");
        assert_eq!(username, "john.doe");
    }

    #[test]
    fn test_parse_username_upn() {
        let (domain, username) = parse_username("john.doe@contoso.com");
        assert_eq!(domain, "contoso.com");
        assert_eq!(username, "john.doe");
    }

    #[test]
    fn test_parse_username_no_domain() {
        let (domain, username) = parse_username("john.doe");
        assert_eq!(domain, "");
        assert_eq!(username, "john.doe");
    }

    #[test]
    fn test_generate_rdp_content() {
        let host = Host {
            hostname: "server.contoso.com".to_string(),
            description: "Test Server".to_string(),
            last_connected: None,
        };

        let content = generate_rdp_content(&host, "john.doe", "CONTOSO");

        assert!(content.contains("full address:s:server.contoso.com"));
        assert!(content.contains("username:s:john.doe"));
        assert!(content.contains("domain:s:CONTOSO"));
        assert!(content.contains("\r\n")); // Windows line endings
    }
}

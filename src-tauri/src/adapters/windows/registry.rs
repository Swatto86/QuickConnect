//! Windows Registry adapter
//!
//! Provides a safe Rust interface to the Windows Registry API.
//! This module isolates all unsafe Windows API calls for registry operations.

use crate::errors::AppError;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use windows::core::PCWSTR;
use windows::Win32::System::Registry::{
    RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW, HKEY,
    HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_SZ, REG_VALUE_TYPE,
};

/// Trait for registry operations
///
/// This trait abstracts registry access to enable:
/// - Testing with mock implementations
/// - Future support for other platforms (config files on Linux/macOS)
pub trait RegistryAdapter: Send + Sync {
    /// Reads a string value from the registry
    ///
    /// # Arguments
    /// * `key_path` - Registry key path (e.g., "Software\\QuickConnect")
    /// * `value_name` - Name of the value to read
    ///
    /// # Returns
    /// * `Ok(Some(value))` - If value exists
    /// * `Ok(None)` - If value doesn't exist
    /// * `Err(AppError)` - If an error occurred
    fn read_string(&self, key_path: &str, value_name: &str) -> Result<Option<String>, AppError>;

    /// Writes a string value to the registry
    ///
    /// # Arguments
    /// * `key_path` - Registry key path
    /// * `value_name` - Name of the value to write
    /// * `value` - String value to write
    fn write_string(&self, key_path: &str, value_name: &str, value: &str) -> Result<(), AppError>;

    /// Deletes a value from the registry
    ///
    /// # Arguments
    /// * `key_path` - Registry key path
    /// * `value_name` - Name of the value to delete
    fn delete_value(&self, key_path: &str, value_name: &str) -> Result<(), AppError>;
}

/// Windows implementation of RegistryAdapter
pub struct WindowsRegistry;

impl WindowsRegistry {
    /// Creates a new Windows registry adapter instance
    pub fn new() -> Self {
        WindowsRegistry
    }
}

impl Default for WindowsRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl RegistryAdapter for WindowsRegistry {
    fn read_string(&self, key_path: &str, value_name: &str) -> Result<Option<String>, AppError> {
        unsafe {
            let key_path_wide: Vec<u16> = OsStr::new(key_path)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let mut hkey = HKEY::default();

            // Open registry key
            match RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR::from_raw(key_path_wide.as_ptr()),
                0,
                KEY_READ,
                &mut hkey,
            ) {
                Ok(_) => {
                    let value_name_wide: Vec<u16> = OsStr::new(value_name)
                        .encode_wide()
                        .chain(std::iter::once(0))
                        .collect();

                    let mut buffer = vec![0u8; 512]; // Buffer for reading value
                    let mut buffer_size = buffer.len() as u32;
                    let mut reg_type = REG_VALUE_TYPE::default();

                    match RegQueryValueExW(
                        hkey,
                        PCWSTR::from_raw(value_name_wide.as_ptr()),
                        None,
                        Some(&mut reg_type),
                        Some(buffer.as_mut_ptr()),
                        Some(&mut buffer_size),
                    ) {
                        Ok(_) => {
                            let _ = RegCloseKey(hkey);

                            // Convert buffer to string
                            let string_data: Vec<u16> = buffer
                                .chunks_exact(2)
                                .take((buffer_size / 2) as usize)
                                .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                                .collect();

                            let value = String::from_utf16(&string_data)
                                .map_err(|e| AppError::RegistryError {
                                    operation: format!("decode registry value '{}'", value_name),
                                    source: Some(e.into()),
                                })?
                                .trim_end_matches('\0')
                                .to_string();

                            Ok(Some(value))
                        }
                        Err(_) => {
                            let _ = RegCloseKey(hkey);
                            // Value not found
                            Ok(None)
                        }
                    }
                }
                Err(_) => {
                    // Key not found
                    Ok(None)
                }
            }
        }
    }

    fn write_string(&self, key_path: &str, value_name: &str, value: &str) -> Result<(), AppError> {
        unsafe {
            let key_path_wide: Vec<u16> = OsStr::new(key_path)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let mut hkey = HKEY::default();

            // Open or create registry key
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR::from_raw(key_path_wide.as_ptr()),
                0,
                KEY_WRITE,
                &mut hkey,
            )
            .map_err(|e| AppError::RegistryError {
                operation: format!("open registry key '{}'", key_path),
                source: Some(e.into()),
            })?;

            let value_name_wide: Vec<u16> = OsStr::new(value_name)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let value_wide: Vec<u16> = OsStr::new(value)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            // Convert to bytes for RegSetValueExW
            let value_bytes: Vec<u8> = value_wide.iter()
                .flat_map(|&word| word.to_le_bytes())
                .collect();

            RegSetValueExW(
                hkey,
                PCWSTR::from_raw(value_name_wide.as_ptr()),
                0,
                REG_SZ,
                Some(&value_bytes),
            )
            .map_err(|e| {
                let _ = RegCloseKey(hkey);
                AppError::RegistryError {
                    operation: format!("write registry value '{}'", value_name),
                    source: Some(e.into()),
                }
            })?;

            let _ = RegCloseKey(hkey);
            Ok(())
        }
    }

    fn delete_value(&self, key_path: &str, value_name: &str) -> Result<(), AppError> {
        unsafe {
            let key_path_wide: Vec<u16> = OsStr::new(key_path)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let mut hkey = HKEY::default();

            // Open registry key
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR::from_raw(key_path_wide.as_ptr()),
                0,
                KEY_WRITE,
                &mut hkey,
            )
            .map_err(|e| AppError::RegistryError {
                operation: format!("open registry key '{}'", key_path),
                source: Some(e.into()),
            })?;

            let value_name_wide: Vec<u16> = OsStr::new(value_name)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            RegDeleteValueW(hkey, PCWSTR::from_raw(value_name_wide.as_ptr())).map_err(|e| {
                let _ = RegCloseKey(hkey);
                AppError::RegistryError {
                    operation: format!("delete registry value '{}'", value_name),
                    source: Some(e.into()),
                }
            })?;

            let _ = RegCloseKey(hkey);
            Ok(())
        }
    }
}

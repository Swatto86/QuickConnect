//! Windows-specific adapters
//!
//! This module contains platform-specific implementations for Windows.
//! All Windows API calls are isolated here to enable future cross-platform support.

pub mod credential_manager;
pub mod registry;

pub use credential_manager::{CredentialManager, WindowsCredentialManager};
pub use registry::{RegistryAdapter, WindowsRegistry};

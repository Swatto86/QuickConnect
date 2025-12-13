//! Tauri command layer
//!
//! This module contains thin command wrappers that expose functionality to the frontend.
//! Commands should be kept simple, delegating work to core/adapters/infra modules.

pub mod credentials;
pub mod hosts;

// Re-export commands for easier registration
pub use credentials::*;
pub use hosts::*;

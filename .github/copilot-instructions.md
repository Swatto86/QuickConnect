# QuickConnect - AI Agent Instructions

## Project Overview
QuickConnect is a **Windows-specific RDP connection manager** built with Tauri 2.0 (Rust backend + TypeScript/Vite frontend). Architecture is designed for eventual cross-platform support but currently targets Windows only.

**Key Technologies**: Tauri 2.0, Rust (windows-rs crate), TypeScript, Vite (multi-page), Tailwind CSS, DaisyUI, Vitest

## Architecture & Critical Patterns

### Multi-Window Tauri Architecture
Five separate windows defined in [tauri.conf.json](../src-tauri/tauri.conf.json):
- `login` (index.html) - Credential entry, first window shown
- `main` (main.html) - Primary host search/connection interface
- `hosts` (hosts.html) - Host management
- `about` (about.html) - About dialog (always-on-top modal)
- `error` (error.html) - Error viewer (always-on-top)

**Multi-page Vite configuration**: [vite.config.ts](../vite.config.ts) builds 5 separate entry points. Each HTML file has its own TypeScript module (e.g., `main.ts`, `hosts.ts`).

### Rust Backend Organization
```
src-tauri/src/
├── core/         # Domain logic, platform-agnostic business logic
├── commands/     # Tauri command handlers (thin layer, all #[tauri::command])
├── adapters/     # Platform-specific implementations (Windows API wrappers)
├── infra/        # Logging, persistence, configuration
└── errors.rs     # Unified AppError type using thiserror
```

**Key Pattern**: Platform-specific code isolated behind traits:
- `CredentialManager` trait ([adapters/windows/credential_manager.rs](../src-tauri/src/adapters/windows/credential_manager.rs)) abstracts Windows Credential Manager
- `RegistryAdapter` trait abstracts Windows Registry access
- Core business logic never directly calls Windows APIs

### Frontend-Backend Communication
**Tauri IPC**: Frontend calls backend via `invoke()` from `@tauri-apps/api/core`:
```typescript
// Example from main.ts
const hosts = await invoke<Host[]>("get_all_hosts");
await invoke("launch_rdp", { host });
```

**Command naming convention**: snake_case Rust functions exposed as-is to TypeScript. See [src/main.ts](../src/main.ts) for all invoke calls.

### Error Handling Philosophy
**Unified AppError type**: All backend functions return `Result<T, AppError>` ([src-tauri/src/errors.rs](../src-tauri/src/errors.rs)).
- Tauri commands convert `AppError` to `String` for frontend display
- `CredentialsNotFound` is a *normal case*, not an error (user hasn't saved credentials yet)
- Frontend handles errors via catch blocks with user-friendly messages

### TypeScript Utility Organization
All utilities in `src/utils/` are **pure functions** exported through [index.ts](../src/utils/index.ts):
- `validation.ts` - Input sanitization (FQDN, hostname, credential validation)
- `hosts.ts` - Host filtering, sorting, UK date parsing
- `errors.ts` - Error formatting, severity categorization
- `ui.ts` - Toast notifications, DOM manipulation helpers

**Pattern**: Export types alongside functions (e.g., `type Host`, `type ErrorData`).

## Development Workflows

### Build & Run
```bash
# Development (hot reload)
npm run dev  # Frontend only
cargo tauri dev  # Full stack with Rust backend

# Testing
npm test              # Vitest watch mode
npm run test:run      # CI mode (single run)
npm run test:coverage # Coverage report
cargo test            # Rust tests

# Production build
npm run build         # TypeScript + Vite build
cargo tauri build     # Full Windows installer
```

### Debug Logging
**Critical**: Use `--debug` flag to enable file logging:
```bash
cargo tauri dev -- --debug
# Logs to: %APPDATA%\QuickConnect\QuickConnect_Debug.log
```

Backend logging: `debug_log()` function from [src-tauri/src/infra/](../src-tauri/src/infra/) writes timestamped entries. **Never log passwords** - log password *length* only.

### Testing Requirements (From README.md)
**Zero tolerance for mock-only tests**. All tests must use **real data structures**:
- Property-based tests: Use `fast-check` library (see [validation.property.test.ts](../src/__tests__/validation.property.test.ts))
- Regression tests: Format `test_regression_<issue>_<description>`
- UI tests: Use `@testing-library/dom` with jsdom environment ([setup.ts](../src/__tests__/setup.ts))
- **Target: 80%+ code coverage**

## Project-Specific Conventions

### Credential Storage
**Windows Credential Manager** stores credentials using TERMSRV prefix:
- Global: `"QuickConnect"` target (domain credentials)
- Per-host: `"TERMSRV/hostname"` target (server-specific credentials)

**Security**: Passwords encrypted by Windows OS, never appear in logs.

### Host Data Format
CSV format with UK-style dates (DD/MM/YYYY). Key fields:
- `hostname` - FQDN or NetBIOS name
- `domain` - Windows domain
- `lastConnected` - UK date string

See [src-tauri/src/core/csv_reader.rs](../src-tauri/src/core/csv_reader.rs) for parsing logic.

### Styling Conventions
**DaisyUI + Tailwind**: Theme switching via `data-theme` attribute:
```typescript
// See main.ts for theme switching
document.documentElement.setAttribute("data-theme", theme);
```

**DaisyUI components**: Use `.btn`, `.input`, `.modal` classes. Configured themes: `light`, `dark` only ([tailwind.config.js](../tailwind.config.js)).

### Window Management
**Critical pattern**: Windows start `visible: false` in tauri.conf.json. Backend shows them programmatically:
```rust
// Example from commands/windows.rs
#[tauri::command]
pub async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.show()?;
    Ok(())
}
```

Track last hidden window via `LAST_HIDDEN_WINDOW` global for restore functionality.

## Integration Points

### Windows API Dependencies
- **Credential Manager**: `windows::Win32::Security::Credentials`
- **Registry**: `windows::Win32::System::Registry` (autostart configuration)
- **RDP Launch**: Shell execution of `mstsc.exe` with `.rdp` files

### LDAP/Active Directory Integration
**Primary host import workflow** via `ldap3` crate ([src-tauri/src/core/ldap.rs](../src-tauri/src/core/ldap.rs)):
- Hosts are **imported from Active Directory**, not just manually entered
- LDAP queries scan domain controllers for Windows Server computers
- Filter: `(&(objectClass=computer)(operatingSystem=Windows Server*)(dNSHostName=*))`
- Requires domain credentials for authenticated bind
- Returns dNSHostName, description, operatingSystem attributes

### System Tray
**Tray icon menu** ([src-tauri/src/lib.rs](../src-tauri/src/lib.rs)): Right-click shows custom menu built with `build_tray_menu()`. Single-click behavior defined in `TrayIconEvent` handler.

## Key Files Reference
- [README.md](../README.md) - **13 Development Principles** (read these first!)
- [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) - Application entry point, window/tray setup
- [src-tauri/src/errors.rs](../src-tauri/src/errors.rs) - All error types
- [src/utils/index.ts](../src/utils/index.ts) - All frontend utilities
- [docs/TABLE_OF_CONTENTS.md](../docs/TABLE_OF_CONTENTS.md) - 22 tutorial chapters on Tauri development

## Critical Development Principles (From README.md)

**All 13 principles apply**, but these are most critical for code changes:

### Principle #2: Professional-Grade Code Quality
- **Zero tolerance for compiler errors and warnings** - Rust: `cargo build` must be clean. TypeScript: `tsc` must pass without errors.
- Fix warnings immediately - they indicate real problems or technical debt.

### Principle #3: Comprehensive Real-World Testing
- **Every public function tested with REAL data** - No mock-only tests.
- Add property-based tests for validation (use `fast-check` - see [validation.property.test.ts](../src/__tests__/validation.property.test.ts)).
- Regression test format: `test_regression_<issue>_<description>`.
- **Target: 80%+ code coverage** with real-world test data.

### Principle #8: GUI-First Development
- **Every backend feature must have GUI accessibility** - If users can't access it through UI, it doesn't exist.
- Implement UI alongside backend - no "backend-only" features.

### Principle #11: Error Recovery & Graceful Degradation
- Handle failures without crashing - use `Result<T, AppError>` everywhere.
- Provide meaningful error messages (not stack traces) - see `AppError::user_message()`.
- Never lose user data due to errors.

### Principle #12: Security & Privacy First
- **Never log passwords** - log password *length* only (e.g., `password.len()`).
- Validate and sanitize all external inputs (FQDN, credentials, CSV data).
- Use Windows Credential Manager for all credential storage.

## When Modifying Code

1. **Never break Windows API calls**: All unsafe Windows code lives in `adapters/`. Don't bypass traits.
2. **Multi-page awareness**: Changes to one window (e.g., main.html) don't affect others. Each has separate TS module.
3. **IPC contract**: Adding/changing Tauri commands requires updates in both Rust (`#[tauri::command]`) and TypeScript (`invoke()` calls).
4. **Test real scenarios**: Add property-based tests for validation, regression tests for bugs. Mock only I/O, not data structures.
5. **Zero compiler warnings**: Run `cargo build` and `tsc` - both must be clean before committing.
6. **Debug logging**: For new features, add `debug_log()` calls with category tags (e.g., "CREDENTIAL", "WINDOW", "RDP", "LDAP").

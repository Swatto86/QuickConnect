# QuickConnect

A fast and efficient RDP connection manager for Windows system administrators. QuickConnect provides secure credential storage, Active Directory integration, and quick server search capabilities.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.0-brightgreen.svg)

---

## 📋 Development Principles

These requirements guide all development decisions and must be maintained throughout the project:

### 1. Cross-Platform Extensibility
- Platform-specific code isolated behind traits and interfaces
- New platform support added by implementing existing abstractions
- Core business logic completely platform-agnostic
- Domain-specific components (parsers, processors) work on any platform
- Use inherently cross-platform frameworks and libraries
- **Goal:** Adding a new platform = minimal implementation of platform layer only

### 2. Professional-Grade Code Quality
- Production-ready, maintainable, idiomatic code in chosen language
- Clear separation of concerns with single-responsibility functions
- No code smells, no technical debt
- Consistent naming conventions and project structure
- Proper error handling - no unhandled exceptions in production paths
- Safe abstractions - minimize unsafe operations with thorough documentation when needed
- **Zero tolerance for compiler errors and warnings** - All code must compile/build cleanly before being considered complete

### 3. **Comprehensive Real-World Testing**
- **Every public function tested with REAL data** - Mock data allowed only for I/O isolation, not for data structures
- **Property-based/fuzz testing** - Test with thousands of random/malformed inputs to catch edge cases and crashes
- **Regression tests for every bug fix** - Each bug gets a test that would have caught it (format: `test_regression_<issue>_<description>`)
- **Integration tests with real artifacts** - Use actual files, databases, API responses captured from production/staging
- **UI/E2E automated testing** - Test complete user workflows programmatically, not just manually
- **Corruption/failure scenarios** - Test with invalid inputs, malformed data, partial failures, error recovery
- **Performance/load testing** - Verify memory usage, speed benchmarks with production-scale data volumes
- **Real production data structures** - Capture actual data from real systems as test fixtures (anonymized if needed)
- **Goal**: Tests catch bugs that affect real users, not just toy scenarios
- **Target**: 80%+ code coverage with real-world test data, zero tolerance for mock-data-only tests
- **Anti-patterns**: Mock-only testing, happy-path-only testing, no fuzz testing, manual-only E2E, no regression tests

### 4. Heavy In-Code Documentation
- Every module has documentation explaining its purpose
- Every public function/class/struct has detailed documentation
- Complex algorithms have inline comments explaining logic
- Non-obvious decisions documented with rationale
- Examples in documentation where helpful
- Documentation tooling generates complete, navigable reference

### 5. Single Source of Truth: README.md
- README.md is the living specification and project documentation
- All architectural decisions documented here
- Development phases, progress tracking, and roadmap in README
- No external wiki, no scattered docs - everything in one place
- Updated immediately when requirements or design changes
- Serves as AI assistant prompt and human developer guide

### 6. No Ambiguity - Clarify Before Implementation
- Never guess user intent or requirements
- When uncertain, present options and ask for clarification
- Discuss architectural approaches before coding
- Validate assumptions before proceeding
- Better to ask than implement the wrong thing
- Talk through trade-offs (performance vs. simplicity, speed vs. safety)

### 7. Version Control Discipline
- **Commit Early, Commit Often:** When satisfied with changes, commit immediately
- Create atomic commits that represent complete, working features
- Write clear commit messages describing what changed and why
- Never leave working code uncommitted at end of session
- Commits serve as project checkpoints and rollback points
- Clean working directory = ready for next feature

### 8. GUI-First Development (For GUI Applications)
- **Expose All Features:** Every backend feature must have GUI accessibility
- **Implement UI Alongside Backend:** When adding new functionality, create GUI controls immediately
- **No Hidden Features:** Users should access all capabilities through the interface
- **Feature Parity:** GUI completeness is as important as backend implementation
- **User-Centric Design:** If users can't access it, it doesn't exist
- **Keyboard Navigation:** Implement proper tab order between controls, Enter/Space for activation, arrow keys for selection
- **Document GUI Gaps:** README tracks which features lack GUI exposure

### 9. Additional Best Practices
- **Safety First:** Appropriate safeguards for destructive operations
- **Modularity:** Each module is independently testable and reusable
- **Progressive Enhancement:** Start simple, add complexity incrementally
- **Semantic Versioning:** Version numbers reflect feature completeness
- **Continuous Integration:** All tests pass before committing
- **Logging:** Comprehensive logging for debugging and diagnostics
- **User Experience:** Clear error messages, intuitive interface, helpful guidance

### 10. Debug Logging to File
- **Debug builds produce log files** - All debug builds write to application-specific log file in appropriate directory
- **Timestamped entries** - Format: `[YYYY-MM-DD HH:MM:SS.mmm] LEVEL - message`
- **Comprehensive logging** - Log all application functionality, actions, and state changes
- **Release builds optional** - Release builds can use console logging or no logging
- **Benefits:** Easy troubleshooting, persistent logs survive app restart, clean console output
- **Real-time monitoring** - Use appropriate tools to tail/monitor log files during development
- **All phases logged** - Log major operations, state changes, and user actions with cancellation tracking

### 11. Error Recovery & Graceful Degradation
- Handle failures without crashing the application
- Provide meaningful error messages to users (not stack traces)
- Implement fallback mechanisms when primary features fail
- Log errors comprehensively for debugging
- Recover from partial failures (continue what's possible)
- Never lose user data due to errors
- **Goal:** Application remains usable even when things go wrong

### 12. Security & Privacy First
- Validate and sanitize all external inputs
- Use secure defaults (fail closed, not open)
- Never log sensitive information (passwords, tokens, PII)
- Follow principle of least privilege
- Keep dependencies updated for security patches
- Document security considerations in README
- **Goal:** Safe by default, secure in production

### 13. Configuration Management
- Configuration separate from code (no hardcoded values)
- Environment-specific settings (dev/test/prod)
- Sensible defaults that work out of the box
- Clear documentation of all configuration options
- Configuration validation on startup
- Version configuration format for backward compatibility
- **Goal:** Easy to configure, hard to misconfigure

---

## Features

### 🔐 Secure Credential Management
- Store credentials securely using Windows Credential Manager
- Support for per-host credentials or global credentials
- Credentials persist across sessions without storing in plain text

### 🚀 Fast Server Access
- Quick search and filter through your RDP hosts
- One-click connection to saved servers
- System tray integration for quick access
- Automatically saves connection files for faster subsequent connections

### 📋 Active Directory Integration
- Scan your Active Directory domain for Windows servers
- Automatically discover and import server information
- Filter and add servers directly from AD scan results

### 🎨 Modern UI
- Clean, responsive interface built with Tailwind CSS and DaisyUI
- Multiple theme options
- Intuitive host management with descriptions
- Modal-based host editing
- Custom styled dialogs for confirmations and alerts (no browser popups)
- Smooth animations and transitions
- Keyboard-accessible dialogs (ESC to dismiss)

### 🔧 Advanced Features
- **Per-host credentials**: Set different credentials for specific servers
- **Host status monitoring**: Real-time online/offline indicators for all hosts
  - Green dot: Host is online (RDP port accessible)
  - Red dot: Host is offline (connection timeout/refused)
  - Gray dot: Status unknown (resolution failed)
  - Yellow dot: Status checking in progress
  - Auto-check on window load and after host updates
  - Manual refresh button to re-check all hosts
- **Autostart support**: Launch QuickConnect on Windows startup
- **Debug logging**: Enable detailed logging with `--debug` flag
- **Application reset**: Secret keyboard shortcut (Ctrl+Shift+Alt+R) to completely reset the app
- **RDP file management**: Persistent connection files stored in AppData

## Installation

### Prerequisites
- Windows 10/11 (x64)
- Node.js (LTS version recommended)
- Rust toolchain

### Building from Source

1. **Clone the repository**
   ```powershell
   git clone <repository-url>
   cd QuickConnect-main
   ```

2. **Install dependencies**
   ```powershell
   npm install
   ```

3. **Run in development mode**
   ```powershell
   npm run tauri dev
   ```

4. **Build for production**
   ```powershell
   npm run tauri build
   ```

   The installer will be created in `src-tauri/target/release/bundle/`

## Usage

### First Launch
1. Launch QuickConnect
2. Enter your domain credentials (format: `DOMAIN\username` or `username@domain.com`)
3. Click OK to save credentials

### Adding Hosts Manually
1. Click "Manage Hosts" from the main window
2. Click "Add Host" button
3. Enter hostname (FQDN format: `server.domain.com`)
4. Add optional description
5. Click Save

### Scanning Active Directory
1. Click "Manage Hosts"
2. Click "Scan Domain"
3. Enter your domain name (e.g., `example.com`)
4. Enter your domain controller (e.g., `dc01.example.com`)
5. Click Scan to discover Windows servers
6. Select servers and click "Add Selected" to import

### Connecting to Hosts
1. Search for a host in the main window
2. Click on the host card to connect
3. RDP connection will launch automatically

### Per-Host Credentials
1. Right-click on a host (or use the host context menu)
2. Select "Set Credentials"
3. Enter specific credentials for that host
4. These override global credentials for that server

### Theme Selection
1. Right-click the system tray icon
2. Select "Theme" from the menu
3. Choose "Light" or "Dark"
4. Theme changes apply to all windows immediately

### Autostart Configuration
1. Right-click the system tray icon
2. Click "Autostart with Windows" to toggle
3. ✓ indicates autostart is enabled
4. ✗ indicates autostart is disabled

### Debug Mode
Enable detailed logging for troubleshooting:
```powershell
QuickConnect.exe --debug
```

Debug log is written to: `%APPDATA%\Roaming\QuickConnect\QuickConnect_Debug.log`

The debug log uses **structured logging** via the `tracing` crate, providing:
- Human-readable timestamps for each event
- Structured fields (category, details, path, error) for easy parsing
- Thread IDs, file locations, and line numbers for precise debugging
- Detailed error information with context
- Category-specific troubleshooting steps
- Operation traces (RDP connections, credential operations, LDAP queries, CSV operations, window lifecycle)
- Structured log levels: ERROR (!), WARNING (*), INFO (i), DEBUG (d)
- Configurable via `RUST_LOG` environment variable (defaults to INFO)

### Error Display
Errors are displayed in a dedicated, always-on-top error window that:
- Automatically appears when errors occur
- Maintains a scrollable list of all errors for easy review
- Persists across window closures (errors remain until explicitly dismissed)
- Shows timestamp, category, and detailed context for each error
- Re-opens automatically if new errors occur after being closed
- Works across all application windows

### Application Reset
Press **Ctrl+Shift+Alt+R** from any window (Login, Main, Hosts Management, or About) to completely reset the application:

**What Gets Deleted:**
- ✓ Global QuickConnect credentials (from Windows Credential Manager)
- ✓ All per-host RDP credentials (TERMSRV/* entries)
- ✓ All RDP connection files (*.rdp files in AppData)
- ✓ Complete hosts list (hosts.csv)
- ✓ Recent connection history

**Important Notes:**
- This action is **irreversible** - all data will be permanently deleted
- You will be prompted twice for confirmation before the reset proceeds
- The reset works from **all windows** in the application for convenience
- After reset, you'll return to the initial "Enter Credentials" screen
- It's recommended to restart the application after a reset
- Debug logs (if enabled) will document the reset operation

**When to Use Reset:**
- Troubleshooting credential or connection issues
- Preparing to hand off the system to another user
- Starting fresh with a clean configuration
- Testing the application setup process
- Security requirement to clear all stored data

## Technical Details

### Tech Stack
- **Frontend**: Vite + TypeScript + Tailwind CSS + DaisyUI
- **Backend**: Rust with Tauri 2.0
- **Windows Integration**: Win32 APIs for credentials and RDP
- **Logging**: Structured logging with `tracing` ecosystem (tracing, tracing-subscriber, tracing-appender)
- **Data Processing**: Modular CSV writer with proper error handling and testing

### Platform Abstraction Strategy

QuickConnect currently targets Windows exclusively but is architected to facilitate future cross-platform support:

#### Platform-Agnostic Components (Reusable)
- **CSV Parsing & Host Management**: Pure Rust logic for reading/writing hosts.csv
- **Search & Filter Logic**: Business logic for host filtering, sorting, duplicate detection
- **Data Serialization**: JSON and CSV handling for hosts and recent connections
- **Frontend UI**: TypeScript/HTML/CSS components work on any platform
- **Validation Logic**: FQDN, domain, and credential format validation

#### Platform-Specific Components (Windows-Only)
- **Credential Storage**: Windows Credential Manager (`CredWriteW`, `CredReadW`, `CredDeleteW`)
- **RDP Launching**: Windows `mstsc.exe` process spawning with `.rdp` files
- **LDAP/Active Directory**: LDAP queries for domain server discovery
- **Registry Access**: Autostart functionality via Windows Registry
- **System Tray**: Windows system tray integration

#### Path to Cross-Platform Support

To add macOS/Linux support in the future:

1. **Abstract Credential Storage**:
   - Create a `trait CredentialStore` with methods: `save()`, `get()`, `delete()`
   - Implement `WindowsCredentialStore` (current implementation)
   - Add `MacOSKeychainStore` and `LinuxSecretServiceStore`

2. **Abstract Remote Desktop Launching**:
   - Create a `trait RemoteDesktopClient` with method: `connect(host, username, password)`
   - Implement `WindowsRdpClient` (current `mstsc.exe` implementation)
   - Add `MacOSRdpClient` (Microsoft Remote Desktop), `LinuxRdpClient` (Remmina/FreeRDP)

3. **Configuration Path Abstraction**:
   - Already partially abstracted via `get_QuickConnect_dir()` using `APPDATA` env var
   - Extend to use `XDG_CONFIG_HOME` on Linux, `~/Library/Application Support` on macOS

4. **Conditional Compilation**:
   - Use `#[cfg(target_os = "windows")]` for Windows-specific code
   - Use `#[cfg(target_os = "macos")]` for macOS-specific code
   - Use `#[cfg(target_os = "linux")]` for Linux-specific code

**Current Architecture**: ~70% platform-agnostic, ~30% Windows-specific

### Security Architecture

QuickConnect follows security best practices to protect sensitive credentials:

#### Credential Security
- **Encrypted Storage**: All passwords stored in Windows Credential Manager (encrypted by OS)
- **No Plaintext**: Passwords never written to disk in plaintext
- **No Logging**: Passwords never appear in logs (only password length logged for debugging)
- **Per-Host Isolation**: Per-host credentials stored separately (`TERMSRV/*` namespace)
- **Memory Safety**: Rust's ownership system prevents memory leaks and buffer overflows

#### Input Validation & Sanitization
- **FQDN Validation**: Regex-based validation prevents malformed hostnames
- **XSS Prevention**: HTML escaping via `escapeHtml()` for all user-provided text
- **Command Injection Prevention**: No shell command construction with user input
- **CSV Injection Prevention**: Proper CSV parsing with quoted field support

#### Network Security
- **LDAP Connection**: Uses ldap3 crate with proper connection handling
- **No Credential Transmission**: RDP credentials passed via Windows Credential Manager, not network
- **Domain Validation**: Active Directory domain names validated before LDAP queries

#### Principle of Least Privilege
- **No Admin Required**: Application runs as normal user (no UAC elevation)
- **File Permissions**: Uses user's AppData directory (user-level permissions only)
- **Registry Access**: Only reads/writes HKEY_CURRENT_USER (user-level, not system-level)

#### Secure Defaults
- **Fail Closed**: Invalid credentials rejected, invalid hostnames rejected
- **No Anonymous Access**: All LDAP queries require authenticated credentials
- **HTTPS Ready**: Can be extended to use HTTPS for credential synchronization (future feature)

### Configuration Management

QuickConnect uses a distributed configuration approach for different types of settings:

#### Configuration Storage Locations

| Setting Type | Storage Location | Format | Scope |
|-------------|------------------|--------|-------|
| Global Credentials | Windows Credential Manager | Encrypted Binary | Machine-wide |
| Per-Host Credentials | Windows Credential Manager (`TERMSRV/*`) | Encrypted Binary | Machine-wide |
| Host List | `%APPDATA%\Roaming\QuickConnect\hosts.csv` | CSV | User-specific |
| Recent Connections | `%APPDATA%\Roaming\QuickConnect\recent_connections.json` | JSON | User-specific |
| Theme Preference | `%APPDATA%\Roaming\QuickConnect\theme.txt` | Plain text | User-specific |
| RDP Connection Files | `%APPDATA%\Roaming\QuickConnect\Connections\*.rdp` | RDP Format | User-specific |
| Debug Logs | `%APPDATA%\Roaming\QuickConnect\QuickConnect_Debug.log` | Plain text | User-specific |
| Autostart Setting | `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run` | Registry | User-specific |

#### Configuration Validation

- **Startup Validation**: Directory creation at startup (`get_QuickConnect_dir()`)
- **CSV Format**: Automatic header detection and migration
- **JSON Format**: Graceful handling of missing or corrupt files (creates new)
- **Credential Validation**: Username/password validated before storage
- **FQDN Validation**: Hostnames validated before adding to host list

#### Defaults and Fallbacks

- **Default Theme**: Dark mode if no preference saved
- **Empty Host List**: Application works with zero hosts configured
- **Missing RDP Files**: Regenerated on connection (not required to exist)
- **No Recent Connections**: Empty list if file doesn't exist or is corrupt

#### Configuration Versioning

- **Current Version**: 1.2.1 (no migration needed yet)
- **Future Migrations**: Handled via version detection in CSV/JSON files
- **Backward Compatibility**: New fields added with optional/default values

### Project Structure
```
QuickConnect/
├── src/                    # Frontend TypeScript source
│   ├── __tests__/         # Test files (Vitest)
│   │   ├── mocks/         # Tauri API mocks
│   │   ├── *.test.ts      # Test files (647 tests)
│   │   ├── *.property.test.ts  # Property-based/fuzz tests (42 tests)
│   │   └── setup.ts       # Test environment setup
│   ├── utils/             # Shared utility functions
│   │   ├── validation.ts  # FQDN, domain, credential validation
│   │   ├── hosts.ts       # Host filtering, sorting, searching
│   │   ├── errors.ts      # Error formatting, categorization
│   │   ├── ui.ts          # DOM utilities, notifications
│   │   └── index.ts       # Utility exports
│   ├── main.ts            # Main window logic
│   ├── hosts.ts           # Host management window logic
│   ├── error.ts           # Error window logic
│   ├── about.ts           # About window logic
│   └── styles.css         # Global styles
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── adapters/      # Platform-specific adapters (credentials, registry)
│   │   ├── commands/      # Tauri command implementations
│   │   ├── core/          # Core business logic
│   │   │   ├── csv_writer.rs  # CSV file generation (3 tests)
│   │   │   ├── ldap.rs    # Active Directory integration
│   │   │   ├── rdp.rs     # RDP file generation
│   │   │   └── types.rs   # Domain types
│   │   ├── errors/        # Error handling (AppError)
│   │   ├── infra/         # Infrastructure (logging with tracing)
│   │   ├── main.rs        # Entry point
│   │   └── lib.rs         # Application setup + tests (88 tests)
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── index.html             # Login window
├── main.html              # Main window
├── hosts.html             # Host management window
├── error.html             # Error display window
├── about.html             # About window
├── vitest.config.ts       # Test configuration
└── package.json           # Node.js dependencies
```

### Data Storage
- **Credentials**: Windows Credential Manager (`TERMSRV/*` and `QuickConnect`)
- **Hosts**: `%APPDATA%\Roaming\QuickConnect\hosts.csv`
- **RDP Files**: `%APPDATA%\Roaming\QuickConnect\Connections\`
- **Recent Connections**: `%APPDATA%\Roaming\QuickConnect\recent_connections.json`
- **Logs**: `%APPDATA%\Roaming\QuickConnect\QuickConnect_Debug.log` (when debug enabled)

**Note**: All of the above can be completely cleared using the application reset feature (Ctrl+Shift+Alt+R from any window).

## Testing

QuickConnect includes a comprehensive test suite covering both the TypeScript frontend and Rust backend. The tests focus on **unit testing core business logic and UI component behavior**, with Windows-specific functionality requiring manual testing.

### Running All Tests

```powershell
# Run both frontend and backend tests
npm run test:run && cd src-tauri && cargo test
```

### Frontend Tests (TypeScript/Vitest)

```powershell
# Run tests once
npm run test:run

# Run tests in watch mode (re-runs on file changes)
npm test

# Run tests with coverage report
npm run test:coverage
```

**Test Coverage:**
- **647 tests** across 9 test files
- ~96% code coverage on utility modules
- **42 property-based/fuzz tests** testing thousands of random inputs
- Comprehensive edge case coverage (Unicode, XSS, SQL injection, path traversal)

**What's Tested:**
| Test File | Tests | Coverage |
|-----------|-------|----------|
| `validation.test.ts` | 101 | Hostname validation, FQDN checks, credential validation, input sanitization |
| `validation.property.test.ts` | 42 | Property-based/fuzz testing with Unicode, emoji, XSS payloads, SQL injection, path traversal, extreme lengths (10K chars), rapid-fire performance (10,000 validations) |
| `hosts.test.ts` | 73 | Host filtering, sorting, searching, date parsing, duplicate detection, **parallel host status checking**, error handling, performance (100 hosts < 1s) |
| `errors.test.ts` | 85 | Error formatting, categorization, severity classification, error state management |
| `ui.test.ts` | 74 | Notification display, toast messages, button states, DOM utilities |
| `integration.test.ts` | 55 | Tauri event handling, window state tracking, credential/RDP/host management flows |
| `ui-login.test.ts` | 51 | Login form validation, button states, credential input, auto-close timer |
| `ui-main.test.ts` | 56 | Server list rendering, search/filter, host highlighting, navigation |
| `ui-hosts.test.ts` | 76 | Hosts table, add/edit/delete modals, domain scanning, credentials modal |
| `about.test.ts` | 34 | About page rendering, navigation links |

### Backend Tests (Rust/Cargo)

```powershell
cd src-tauri
cargo test
```

**Test Coverage:**
- **91 tests** (88 in `src/lib.rs` + 3 in `src/core/csv_writer.rs`)
- **18 CSV/JSON fuzzing tests** testing malformed file formats
- Comprehensive corruption and edge case coverage

**What's Tested:**
| Test Module | Coverage |
|-------------|----------|
| `credentials_tests` | Credential serialization, UPN/domain formats |
| `host_tests` | Host serialization, cloning, optional fields |
| `host_validation_tests` | Hostname validation, whitespace handling |
| `csv_writer::tests` | CSV file writing with hosts, empty lists, special characters |
| `host_status_tests` | **Host status checking** (invalid hostnames, empty strings, malformed input, Unicode, null bytes, extreme lengths, concurrent execution, IPv6, unreachable hosts) |
| `csv_json_fuzzing_tests` | **CSV/JSON corruption testing** (truncated lines, missing quotes, special chars, extremely long fields (10KB+), 5,000+ records, null bytes, BOM markers, mixed line endings, concurrent reads, malformed JSON, missing fields, truncated JSON, invalid UTF-8, duplicate keys, 10,000+ records, deeply nested structures, whitespace-only files) |
| `error_payload_tests` | Error serialization, optional fields |
| `file_path_tests` | CSV and JSON file path formats |
| `csv_parsing_tests` | CSV parsing with headers, special characters |
| `json_file_tests` | JSON save/load, missing file handling |
| `recent_connection_tests` | Connection serialization, JSON roundtrip |
| `recent_connections_tests` | Add, remove, truncate, duplicate handling |
| `search_filter_tests` | Filtering by hostname, domain, description |
| `username_parsing_tests` | UPN, NetBIOS, domain\user formats |
| `integration_tests` | End-to-end data workflows |

### Expected Test Output

When running tests, you may see `stderr` output like:
```
stderr | src/__tests__/ui.test.ts > showNotification > should not display error type notifications visually
Error message
```

This is **expected behavior** - these are tests verifying that error handling works correctly, and the error messages are intentionally logged during the test.

### Test Architecture

The test suite uses:
- **Vitest** - Fast TypeScript test runner with native ESM support
- **jsdom** - DOM simulation for UI tests
- **Tauri API mocks** - Simulated Tauri APIs (`@tauri-apps/api/*`) for testing without the native runtime

Tests are located in:
- `src/__tests__/*.test.ts` - Frontend test files
- `src/__tests__/mocks/` - Tauri API mock implementations
- `src/__tests__/setup.ts` - Test environment configuration
- `src-tauri/src/lib.rs` - Rust tests (in `#[cfg(test)]` module)

### What the Tests Cover

The automated tests thoroughly verify the following application functionality:

**✅ Input Validation & Sanitization:**
- FQDN validation (proper hostname.domain.com format)
- Domain validation for AD scanning
- Credential format validation (DOMAIN\user, user@domain.com)
- XSS prevention through HTML escaping
- Edge cases (empty strings, special characters, max lengths)

**✅ Security Testing (Property-Based/Fuzz):**
- **XSS Attack Vectors** - 8 real-world XSS payloads tested (script tags, event handlers, data URIs)
- **SQL Injection Attempts** - 5 common SQL injection patterns verified as safe
- **Path Traversal Attacks** - 4 directory traversal patterns tested (..\\.., /../, encoded variants)
- **Unicode & Control Characters** - Emoji, null bytes, escape sequences handled correctly
- **Extreme Input Lengths** - 10,000+ character inputs without crashes
- **HTML Entity Escaping** - Proper handling of <, >, & characters
- **Rapid-Fire Performance** - 10,000 validation calls tested for performance

**✅ Business Logic:**
- Host filtering by hostname and description
- Search with case-insensitive matching
- Host sorting (alphabetical, by last connected date)
- Recent connections management (ordering, duplicate handling, max limit)
- Date formatting (UK format DD/MM/YYYY)
- Error categorization and severity levels
- **Host status checking** - Parallel checking, error handling, performance (100 hosts < 1 second)

**✅ UI Component Behavior (via jsdom simulation):**
- Form submission and validation feedback
- Button enable/disable states based on input
- Modal open/close behavior
- Search input with real-time filtering
- Toast and notification display
- Keyboard shortcuts (Enter, Escape, Ctrl+Shift+Alt+R)
- Loading states and empty state messages
- Performance with 1000+ hosts

**✅ Data Serialization & File Format Corruption:**
- Host, credentials, and error data structures
- **CSV Corruption Testing** - Truncated lines, missing quotes, special characters, null bytes, BOM markers, mixed line endings, extremely long fields (10KB+), 5,000+ records, concurrent reads
- **JSON Corruption Testing** - Missing fields, truncated files, invalid UTF-8, duplicate keys, 10,000+ records, deeply nested structures, whitespace-only files
- Username parsing for different credential formats

**✅ Event Handling:**
- Theme change events
- Host update events
- Error display events
- Window focus events
- Multiple event listeners

### What Requires Manual Testing

The following Windows-specific functionality is **not covered by automated tests** and should be verified manually:

**⚠️ Windows Integration:**
- Windows Credential Manager read/write operations
- Actual RDP file creation and persistence
- RDP connection launch (mstsc.exe)
- System tray icon behavior
- Window management (minimize, restore, focus)
- Autostart registry entries

**⚠️ Active Directory Integration:**
- LDAP connection to domain controllers
- Server discovery via AD queries
- Domain authentication

**⚠️ End-to-End Workflows:**
- Complete login → connect → RDP session flow
- Credential persistence across app restarts
- Host data persistence (hosts.csv)
- Application reset functionality

**⚠️ Error Scenarios:**
- Network connectivity issues
- Invalid/expired credentials
- Unreachable servers
- Permission denied errors

### Manual Testing Checklist

Before releasing, verify these scenarios work correctly:

1. **First Launch:** App prompts for credentials, saves to Windows Credential Manager
2. **Add Host:** New host appears in list, persists after restart
3. **Connect to Host:** RDP session launches with correct credentials
4. **Per-Host Credentials:** Override global credentials for specific server
5. **Search:** Filter hosts in real-time, highlighting works
6. **Host Status:** Check online/offline indicators (green/red dots), manual refresh works
7. **AD Scan:** Discovers servers from Active Directory (requires domain environment)
8. **Application Reset:** Ctrl+Shift+Alt+R clears all data
9. **System Tray:** App minimizes to tray, double-click restores
10. **Autostart:** App launches on Windows startup when enabled
11. **Debug Mode:** `--debug` flag creates log file with detailed output

### UI Test Details

The UI tests simulate real user interactions using jsdom:

**Login Page (`ui-login.test.ts`):**
- Form validation (empty fields, valid credentials)
- Button state management (enable/disable based on input)
- Username formats (domain\user, user@domain.com)
- Auto-close timer behavior
- Keyboard shortcuts (Escape, Ctrl+Shift+Alt+R)

**Main Page (`ui-main.test.ts`):**
- Server list rendering with host data
- Search functionality with real-time filtering
- Highlight matching text in search results
- Navigation between windows
- Connect button interactions
- Performance with large host lists (1000+ hosts)

**Hosts Management (`ui-hosts.test.ts`):**
- Hosts table rendering and updates
- Add/Edit/Delete host modals
- Domain scan modal with validation
- Per-host credentials modal
- FQDN, domain, and server name validation
- Search/filter functionality
- Toast notifications
- Form reset and accessibility

## Development

### Development Mode
```powershell
npm run tauri dev
```
- Hot reload enabled
- Debug mode on by default
- Console logging available

### Building Release
```powershell
npm run tauri build
```
- Optimized binary
- No logging unless `--debug` flag is used
- Creates installer in `src-tauri/target/release/bundle/`

### Code Structure
- **Tauri Commands**: Rust functions exposed to frontend via `#[tauri::command]`
- **Windows API Integration**: Direct Win32 calls for credential management
- **LDAP Support**: ldap3 crate for Active Directory queries

## Troubleshooting

### RDP Connection Fails
- Verify credentials are correct
- Check server hostname is reachable (look for red dot in status indicator)
- Ensure RDP is enabled on target server (port 3389)
- Try with `--debug` flag and check logs

### Host Status Shows Unknown (Gray Dot)
- Verify hostname can be resolved (ping hostname)
- Check DNS settings
- Ensure firewall allows outbound connections on port 3389
- Try clicking the refresh button to re-check status

### "Invalid Password" Errors
- Username format matters: try both `DOMAIN\user` and `user@domain.com`
- Verify credentials in Windows Credential Manager
- Check debug logs for credential parsing issues

### Active Directory Scan Fails
- Ensure domain controller is reachable
- Verify credentials have read access to AD
- Check that port 389 (LDAP) is not blocked
- Anonymous bind must be disabled on DC

### Application Won't Start
- Check Windows Event Viewer for errors
- Verify all dependencies are installed
- Try running with `--debug` flag
- Reset application with Ctrl+Shift+Alt+R (works from any window)
- If reset doesn't help, manually delete: `%APPDATA%\Roaming\QuickConnect` folder

### Credential or Connection Issues
- Verify credentials are correct and not expired
- Try resetting the application (Ctrl+Shift+Alt+R) to clear all stored credentials
- Re-enter credentials after reset
- Check debug logs for detailed error information

---

## Development Status & Compliance

### Principle #3: Comprehensive Real-World Testing - Status

**Current Implementation:** ✅ **9/10** - Strong compliance with comprehensive property-based testing

**Test Coverage Summary:**
- **Total Tests:** 738 tests (91 backend + 647 frontend)
- **Property-Based/Fuzz Tests:** 42 tests running 3,000+ random inputs
- **CSV/JSON Corruption Tests:** 18 tests covering malformed file formats
- **Code Coverage:** ~96% on utility modules
- **Security Testing:** XSS, SQL injection, path traversal verified

**What We Excel At:**
- ✅ **Property-based/fuzz testing** - 42 tests with thousands of random inputs (Unicode, emoji, extreme lengths)
- ✅ **Security testing** - Real XSS payloads, SQL injection attempts, path traversal vectors tested
- ✅ **Edge case coverage** - Null bytes, control characters, 10K+ char inputs, 10,000 rapid-fire validations
- ✅ **File corruption testing** - Truncated CSV/JSON, missing quotes, malformed data, concurrent reads
- ✅ **Performance testing** - 100 hosts checked < 1 second, 5,000+ CSV records, 10,000+ JSON records
- ✅ **Real-world scenarios** - Host status checking, parallel execution, error handling

**What's Pending (Future Phases):**
- ⏳ **Corruption/failure scenarios** - Disk full during write, power loss simulation (planned for Phase 5b)
- ⏳ **UI/E2E automated testing** - Complete user workflows with Playwright/Tauri WebDriver
- ⏳ **Integration tests with real artifacts** - Actual RDP files, real AD queries (requires test infrastructure)

**Recent Improvements (v1.2.1):**
- **Custom Dialog System**: Replaced all browser confirm()/alert() calls with DaisyUI-themed custom dialogs featuring icons, animations, and keyboard support
- **Enhanced Notification Centering**: Improved banner positioning with better vertical centering (top-8/bottom-8) and enhanced styling
- **15 New Dialog Tests**: Comprehensive test coverage for custom dialog functionality (660 total tests passing)

**Previous Improvements (v1.2.0):**
- **Structured Logging Migration**: Migrated to `tracing` ecosystem for enhanced observability with structured fields, thread tracking, and file/line precision
- **CSV Writer Extraction**: Moved CSV writing from command layer to `core/csv_writer.rs` module with proper error handling and 3 comprehensive tests
- **Error Handling Enhancement**: Eliminated last `unwrap_or_else` in production code with explicit `get_theme_or_default()` helper
- Added 12 backend tests for `check_host_status` command
- Added 12 frontend tests for `checkAllHostsStatus` function
- Added 22 property-based validation fuzzing tests
- Added 18 CSV/JSON corruption fuzzing tests
- Increased total test count from 686 → 738 (+52 tests, 7.6% increase)
- Property test coverage: 20 → 42 tests (110% increase)
- Backend test coverage: 83 → 91 tests (+8 tests, 9.6% increase)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

**Swatto**

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Built with [Tauri](https://tauri.app/)
- UI components from [DaisyUI](https://daisyui.com/)
- Icons and styling with [Tailwind CSS](https://tailwindcss.com/)

# Chapter 2: Setting Up Your Development Environment

## Learning Objectives

By the end of this chapter, you will:
- Install Rust and Cargo on Windows
- Set up Node.js and npm for frontend development
- Install and configure Visual Studio Build Tools
- Set up VS Code with essential extensions
- Verify your complete Tauri development environment
- Understand the role of each tool in the stack
- Troubleshoot common installation issues

---

## 2.1 Overview: What We're Installing and Why

Building a Tauri application requires several tools working together:

```
┌─────────────────────────────────────────────────┐
│           Your Tauri Application                │
├─────────────────────────────────────────────────┤
│  Frontend (TypeScript/HTML/CSS)                 │
│  └─ Node.js + npm                               │
│  └─ Vite (build tool)                           │
│  └─ Tailwind CSS + DaisyUI                      │
├─────────────────────────────────────────────────┤
│  Backend (Rust)                                 │
│  └─ Rust + Cargo                                │
│  └─ Tauri CLI                                   │
│  └─ Windows crates                              │
├─────────────────────────────────────────────────┤
│  Platform Layer                                 │
│  └─ WebView2 (Windows)                          │
│  └─ Visual Studio Build Tools (C++ compiler)   │
└─────────────────────────────────────────────────┘
```

### The Stack Explained

**Rust + Cargo**
- Rust is the programming language for the backend
- Cargo is Rust's build system and package manager
- Compiles your backend code to native Windows executable

**Node.js + npm**
- Node.js runs JavaScript build tools
- npm (Node Package Manager) installs frontend dependencies
- Not included in the final app (build-time only)

**Visual Studio Build Tools**
- Provides C++ compiler and Windows SDK
- Required for Rust to compile Windows-specific code
- Links against Windows APIs

**Tauri CLI**
- Command-line tool to build and run Tauri apps
- Coordinates between Rust backend and frontend
- Bundles everything into a single executable

**WebView2**
- Microsoft Edge's rendering engine
- Displays your HTML/CSS/JavaScript UI
- Comes pre-installed on Windows 11, downloadable for Windows 10

---

## 2.2 Installing Rust and Cargo

### Step 1: Download Rustup

Rustup is the official Rust installer and version manager.

1. Open your web browser and go to: **https://rustup.rs/**
2. Click **"Download rustup-init.exe (64-bit)"**
3. Save the file to your Downloads folder

### Step 2: Run the Installer

1. Double-click `rustup-init.exe`
2. You'll see a console window with installation options
3. Press **Enter** to proceed with default installation

```
Welcome to Rust!

This will download and install the official compiler for the Rust
programming language, and its package manager, Cargo.

Current installation options:

   default host triple: x86_64-pc-windows-msvc
     default toolchain: stable (default)
               profile: default
  modify PATH variable: yes

1) Proceed with standard installation (default - just press enter)
2) Customize installation
3) Cancel installation
>
```

4. Wait for the installation to complete (5-10 minutes)

### Step 3: Verify Installation

Open a **new** PowerShell window and run:

```powershell
rustc --version
```

You should see output like:
```
rustc 1.75.0 (82e1608df 2024-12-21)
```

Check Cargo:
```powershell
cargo --version
```

Expected output:
```
cargo 1.75.0 (1d8b05cdd 2024-11-28)
```

### Understanding What Was Installed

Rustup installed:
- **rustc**: The Rust compiler
- **cargo**: Package manager and build tool
- **rust-std**: Standard library
- **rust-docs**: Offline documentation

Installation locations:
- Rust toolchain: `C:\Users\YourName\.rustup\`
- Cargo binaries: `C:\Users\YourName\.cargo\bin\`
- Added to PATH automatically

### Common Issue: Missing C++ Build Tools

If you see errors about missing MSVC or link.exe, you need Visual Studio Build Tools (covered in Section 2.4).

---

## 2.3 Installing Node.js and npm

Node.js provides the runtime for frontend build tools.

### Step 1: Download Node.js

1. Visit: **https://nodejs.org/**
2. Download the **LTS (Long Term Support)** version
   - As of writing: Node.js 20.x LTS
   - Choose the Windows Installer (.msi) 64-bit
3. Save to your Downloads folder

### Step 2: Run the Installer

1. Double-click the downloaded `.msi` file
2. Click **Next** through the welcome screen
3. Accept the license agreement
4. Keep the default installation location: `C:\Program Files\nodejs\`
5. In "Custom Setup", ensure these are selected:
   - ✅ Node.js runtime
   - ✅ npm package manager
   - ✅ Add to PATH
6. Click **Next** and then **Install**
7. Wait for installation (2-3 minutes)
8. Click **Finish**

### Step 3: Verify Installation

Open a **new** PowerShell window:

```powershell
node --version
```

Expected output:
```
v20.10.0
```

Check npm:
```powershell
npm --version
```

Expected output:
```
10.2.3
```

### Optional: Configure npm

Set npm to use a faster registry mirror (optional):

```powershell
# Use default registry (recommended for most users)
npm config get registry

# Check installation directory
npm config get prefix
```

### What Gets Installed

- **node.exe**: JavaScript runtime
- **npm**: Package manager
- **npx**: Package runner (for running CLI tools)
- Global packages go to: `C:\Users\YourName\AppData\Roaming\npm\`

---

## 2.4 Installing Visual Studio Build Tools

This is the most critical step for Windows development. Without it, Rust cannot compile Windows-specific code.

### Why You Need This

Rust uses the Microsoft C++ compiler (MSVC) to:
- Link Windows API calls
- Compile native Windows libraries
- Generate optimized machine code

### Step 1: Download Build Tools

1. Visit: **https://visualstudio.microsoft.com/downloads/**
2. Scroll down to **"Tools for Visual Studio"**
3. Download **"Build Tools for Visual Studio 2022"**
4. Save the installer

### Step 2: Run the Installer

1. Run the downloaded `vs_BuildTools.exe`
2. The Visual Studio Installer will launch
3. In the **Workloads** tab, select:
   - ✅ **Desktop development with C++**

4. In the right panel, ensure these are checked:
   - ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)
   - ✅ Windows 11 SDK (10.0.22621.0 or later)
   - ✅ C++ CMake tools for Windows

5. Click **Install**
6. Wait for installation (10-30 minutes, ~7GB download)
7. Restart your computer when prompted

### Step 3: Verify Installation

After restarting, open PowerShell and check:

```powershell
# Check if MSVC is accessible
& "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
```

If the path exists, you're good to go!

### Alternative: Full Visual Studio

If you plan to do more Windows development, you can install the full Visual Studio Community Edition (free) instead:

1. Download from: **https://visualstudio.microsoft.com/**
2. Select **"Desktop development with C++"** workload
3. This gives you an IDE plus the build tools

### Troubleshooting Build Tools

**Problem**: `link.exe not found` when compiling Rust

**Solution**:
```powershell
# Add MSVC to PATH (adjust version if needed)
$env:Path += ";C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.38.33130\bin\Hostx64\x64"
```

**Problem**: Windows SDK not found

**Solution**: Run the installer again and verify Windows 11 SDK is selected.

---

## 2.5 Installing Tauri CLI

Now that we have Rust, Node.js, and build tools, we can install Tauri.

### Method 1: Install via Cargo (Recommended)

```powershell
cargo install tauri-cli
```

This will:
- Download and compile Tauri CLI from source
- Take 5-10 minutes (one-time compilation)
- Install to: `C:\Users\YourName\.cargo\bin\cargo-tauri.exe`

### Method 2: Install via npm (Alternative)

```powershell
npm install -g @tauri-apps/cli
```

> **Note**: We'll use the Cargo version in this guide as it's more integrated with Rust tooling.

### Verify Tauri Installation

```powershell
cargo tauri --version
```

Expected output:
```
tauri-cli 2.0.0
```

### What Tauri CLI Does

The `cargo tauri` command provides:
- `cargo tauri init` - Create new Tauri project
- `cargo tauri dev` - Run in development mode with hot-reload
- `cargo tauri build` - Build production executable
- `cargo tauri info` - Show system information

---

## 2.6 Installing WebView2 (Windows)

WebView2 is Microsoft's modern web rendering engine, based on Chromium/Edge.

### Check if Already Installed

Windows 11 comes with WebView2 pre-installed. To verify:

```powershell
# Check registry for WebView2
Get-ItemProperty -Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
```

If you see version information, you're all set!

### Install WebView2 (If Missing)

1. Download from: **https://developer.microsoft.com/microsoft-edge/webview2/**
2. Choose **"Evergreen Bootstrapper"**
3. Run the installer
4. Installation is automatic and silent

### For QuickConnect Users

QuickConnect's installer can bundle WebView2, so end-users don't need to install it separately. We'll cover this in Chapter 20.

---

## 2.7 Setting Up Visual Studio Code

VS Code is the recommended editor for Tauri development.

### Step 1: Install VS Code

1. Download from: **https://code.visualstudio.com/**
2. Run the installer
3. Important: Check these boxes during installation:
   - ✅ Add "Open with Code" action to Windows Explorer file context menu
   - ✅ Add "Open with Code" action to Windows Explorer directory context menu
   - ✅ Add to PATH

### Step 2: Install Essential Extensions

Open VS Code and install these extensions:

**Required Extensions:**

1. **rust-analyzer** (rust-lang.rust-analyzer)
   - Intelligent code completion
   - Real-time error checking
   - Go to definition, documentation
   - Press `Ctrl+Shift+X`, search "rust-analyzer", click Install

2. **Tauri** (tauri-apps.tauri-vscode)
   - Tauri commands and snippets
   - Project templates

3. **Even Better TOML** (tamasfe.even-better-toml)
   - Syntax highlighting for Cargo.toml
   - TOML validation

**Recommended Extensions:**

4. **Error Lens** (usernamehw.errorlens)
   - Shows errors inline in your code
   - Improves debugging experience

5. **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss)
   - For QuickConnect's Tailwind styling
   - Auto-completion for CSS classes

6. **ES7+ React/Redux/React-Native snippets** (dsznajder.es7-react-js-snippets)
   - TypeScript snippets

7. **Prettier** (esbenp.prettier-vscode)
   - Code formatting for TypeScript/HTML

8. **GitLens** (eamodio.gitlens)
   - Enhanced Git integration

### Step 3: Configure VS Code Settings

Open settings (`Ctrl+,`) and add these configurations:

Press `Ctrl+Shift+P`, type "Preferences: Open Settings (JSON)", and add:

```json
{
    // Rust settings
    "rust-analyzer.checkOnSave.command": "clippy",
    "rust-analyzer.cargo.features": "all",
    
    // Editor settings
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    
    // File associations
    "[rust]": {
        "editor.defaultFormatter": "rust-lang.rust-analyzer",
        "editor.formatOnSave": true
    },
    
    // Terminal
    "terminal.integrated.defaultProfile.windows": "PowerShell",
    
    // Auto-save
    "files.autoSave": "afterDelay",
    "files.autoSaveDelay": 1000
}
```

### Step 4: Install PowerShell Extension (Optional)

If you prefer PowerShell scripting:

1. Search for "PowerShell" extension
2. Install the official Microsoft PowerShell extension

---

## 2.8 Creating Your First Project

Let's verify everything works by creating a test project.

### Create a New Tauri Project

```powershell
# Create a directory for your projects
mkdir C:\Projects
cd C:\Projects

# Create new Tauri project
npm create tauri-app@latest
```

Follow the prompts:
```
✔ Project name · test-tauri-app
✔ Choose which language to use for your frontend · TypeScript / JavaScript
✔ Choose your package manager · npm
✔ Choose your UI template · Vanilla
✔ Choose your UI flavor · TypeScript
```

### Navigate and Install Dependencies

```powershell
cd test-tauri-app
npm install
```

### Run the Development Server

```powershell
npm run tauri dev
```

Expected behavior:
1. Frontend builds with Vite
2. Rust backend compiles (takes 2-5 minutes first time)
3. A window opens showing your app
4. You see "Welcome to Tauri!" in the window

**Success!** Your development environment is fully configured.

### Project Structure

Let's examine what was created:

```
test-tauri-app/
├── src/                  # Frontend source
│   ├── main.ts          # TypeScript entry point
│   ├── style.css        # Styles
│   └── vite-env.d.ts    # TypeScript definitions
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── main.rs      # Rust entry point
│   │   └── lib.rs       # Tauri commands
│   ├── Cargo.toml       # Rust dependencies
│   ├── tauri.conf.json  # Tauri configuration
│   └── icons/           # App icons
├── index.html           # Main HTML file
├── package.json         # npm dependencies
└── vite.config.ts       # Vite configuration
```

This is the same structure QuickConnect uses!

---

## 2.9 Verifying the Complete Setup

Run this comprehensive check:

```powershell
# Create a verification script
@"
Write-Host "=== Tauri Development Environment Check ===" -ForegroundColor Cyan

Write-Host "`nRust:" -ForegroundColor Yellow
rustc --version
cargo --version

Write-Host "`nNode.js:" -ForegroundColor Yellow
node --version
npm --version

Write-Host "`nTauri:" -ForegroundColor Yellow
cargo tauri --version

Write-Host "`nVisual Studio Build Tools:" -ForegroundColor Yellow
if (Test-Path "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools") {
    Write-Host "✓ Build Tools installed" -ForegroundColor Green
} else {
    Write-Host "✗ Build Tools not found" -ForegroundColor Red
}

Write-Host "`nWebView2:" -ForegroundColor Yellow
`$webview2 = Get-ItemProperty -Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
if (`$webview2) {
    Write-Host "✓ WebView2 version: `$(`$webview2.pv)" -ForegroundColor Green
} else {
    Write-Host "✗ WebView2 not found" -ForegroundColor Red
}

Write-Host "`n=== Check Complete ===" -ForegroundColor Cyan
"@ | Out-File -FilePath check-env.ps1

# Run the check
powershell -ExecutionPolicy Bypass -File .\check-env.ps1
```

Expected output:
```
=== Tauri Development Environment Check ===

Rust:
rustc 1.75.0 (82e1608df 2024-12-21)
cargo 1.75.0 (1d8b05cdd 2024-11-28)

Node.js:
v20.10.0
10.2.3

Tauri:
tauri-cli 2.0.0

Visual Studio Build Tools:
✓ Build Tools installed

WebView2:
✓ WebView2 version: 120.0.2210.144

=== Check Complete ===
```

---

## 2.10 Understanding the Build Process

When you run `npm run tauri dev`, here's what happens:

```
1. Vite starts the frontend dev server (port 1420)
   └─ Watches for file changes
   └─ Hot-reloads on changes

2. Cargo builds the Rust backend
   └─ Compiles with debug symbols
   └─ Links Windows APIs
   └─ Creates executable in src-tauri/target/debug/

3. Tauri launches the window
   └─ Creates WebView2 instance
   └─ Loads frontend from dev server
   └─ Establishes IPC bridge

4. Your app runs!
   └─ Frontend can call Rust functions
   └─ Rust can emit events to frontend
```

### First Build vs Subsequent Builds

**First build** (2-5 minutes):
- Downloads all Rust dependencies
- Compiles everything from scratch
- Creates target directory with compiled artifacts

**Subsequent builds** (5-15 seconds):
- Reuses cached dependencies
- Only recompiles changed files
- Much faster!

### Build Artifacts

After building, check these locations:

```powershell
# Development build
ls .\src-tauri\target\debug\

# You'll see:
# - test-tauri-app.exe (your app)
# - test-tauri-app.pdb (debug symbols)
# - build/ (build scripts)
# - deps/ (dependencies)
```

---

## 2.11 Troubleshooting Common Issues

### Issue 1: "rustc not found"

**Symptom**: `cargo: command not found` or `rustc: command not found`

**Solution**:
1. Close and reopen PowerShell (PATH needs to refresh)
2. If still not working, manually add to PATH:
```powershell
$env:Path += ";C:\Users\$env:USERNAME\.cargo\bin"
```

3. Make it permanent:
```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path, [EnvironmentVariableTarget]::User)
```

### Issue 2: "link.exe not found"

**Symptom**: Rust compilation fails with MSVC linker errors

**Solution**:
1. Verify Build Tools installation:
```powershell
& "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
```

2. If missing, reinstall Build Tools (Section 2.4)

### Issue 3: Slow First Build

**Symptom**: `cargo build` takes 10+ minutes

**Explanation**: This is normal! The first build compiles all dependencies.

**Optimization**:
```powershell
# Use more CPU cores for compilation
$env:CARGO_BUILD_JOBS = 8

# Or add to Cargo config
mkdir C:\Users\$env:USERNAME\.cargo -Force
@"
[build]
jobs = 8
"@ | Out-File -FilePath C:\Users\$env:USERNAME\.cargo\config.toml
```

### Issue 4: npm install fails

**Symptom**: `EACCES` or permission errors

**Solution**:
```powershell
# Clear npm cache
npm cache clean --force

# Run with different permissions
npm install --no-optional
```

### Issue 5: Port 1420 already in use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::1420`

**Solution**:
```powershell
# Find process using port 1420
Get-NetTCPConnection -LocalPort 1420 | Select-Object OwningProcess

# Kill the process (replace PID with actual process ID)
Stop-Process -Id <PID> -Force

# Or change the port in vite.config.ts
```

### Issue 6: WebView2 not loading

**Symptom**: Blank window or "WebView2 not found" error

**Solution**:
1. Install WebView2 Runtime manually (Section 2.6)
2. Restart your computer
3. Check Windows Update for Edge updates

### Issue 7: "error: could not compile" with cryptic messages

**Symptom**: Rust compilation errors

**Solution**:
```powershell
# Clean build artifacts and rebuild
cd src-tauri
cargo clean
cargo build

# Check for conflicting dependencies
cargo tree --duplicates
```

---

## 2.12 QuickConnect Environment Setup

Let's examine what QuickConnect specifically requires:

### QuickConnect's package.json

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.1.1",
    "@tauri-apps/plugin-global-shortcut": "^2.3.1",
    "@tauri-apps/plugin-shell": "^2.0.0"
  },
  "devDependencies": {
    "@tailwindcss/forms": "^0.5.9",
    "@tauri-apps/cli": "^2.0.0",
    "autoprefixer": "^10.4.20",
    "daisyui": "^4.12.14",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.2.2",
    "vite": "^7.1.12"
  }
}
```

### QuickConnect's Cargo.toml

```toml
[dependencies]
tauri = { version = "2.0.0", features = [ "tray-icon" ] }
tauri-plugin-shell = "2"
tauri-plugin-single-instance = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1.0"
windows = { version = "0.52", features = [
    "Win32_Foundation",
    "Win32_Security_Credentials",
    "Win32_System_Memory",
    "Win32_UI_Shell",
    "Win32_UI_WindowsAndMessaging",
    "Win32_System_Registry",
    "Win32_Storage_FileSystem"
] }
csv = "1.3"
ldap3 = "0.11"
tokio = { version = "1", features = ["rt", "macros"] }
chrono = "0.4"

[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-global-shortcut = "2"
```

### To Clone and Run QuickConnect

```powershell
# Clone the repository
git clone https://github.com/Swatto86/QuickConnect.git
cd QuickConnect

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev
```

First build will take several minutes as it downloads and compiles:
- Tauri framework
- Windows API bindings
- LDAP client library
- CSV parser
- Async runtime (Tokio)

---

## 2.13 Development Workflow

Now that everything is set up, here's your typical workflow:

### Daily Development

```powershell
# 1. Navigate to your project
cd C:\Projects\my-tauri-app

# 2. Open in VS Code
code .

# 3. Start development server
npm run tauri dev

# 4. Edit files - changes auto-reload
# - Frontend (src/*.ts, *.html, *.css) - instant reload
# - Backend (src-tauri/src/*.rs) - recompile on save (5-15 seconds)

# 5. Check for errors
# - rust-analyzer shows errors inline
# - Console shows runtime errors
```

### Building for Production

```powershell
# Create optimized production build
npm run tauri build

# Output location:
# src-tauri/target/release/bundle/nsis/
#   └─ my-tauri-app_1.0.0_x64-setup.exe  (installer)
```

### Updating Dependencies

```powershell
# Update npm packages
npm update

# Update Rust crates
cargo update

# Update Tauri CLI
cargo install tauri-cli --force
```

---

## 2.14 Key Takeaways

✅ **Complete Rust toolchain installed**
- rustc, cargo, and standard library
- Automatic updates via rustup

✅ **Node.js ecosystem ready**
- Node.js runtime for build tools
- npm for package management
- npx for running CLI tools

✅ **Windows build tools configured**
- MSVC compiler for native code
- Windows SDK for API access
- Required for all Windows development

✅ **Tauri CLI operational**
- Create, build, and run Tauri apps
- Integrated with Cargo and npm

✅ **VS Code optimized for Tauri**
- rust-analyzer for intelligent Rust editing
- Extensions for TypeScript, Tailwind, and more
- Proper formatting and linting

✅ **Development workflow established**
- Fast iteration with hot-reload
- Clear build process understanding
- Production build capability

---

## 2.15 Practice Exercises

### Exercise 1: Environment Verification Script

Create a comprehensive PowerShell script that checks all components and generates a report:

```powershell
# TODO: Create check-tauri-environment.ps1 that:
# 1. Checks Rust version
# 2. Checks Node.js version
# 3. Checks for MSVC
# 4. Checks for WebView2
# 5. Checks for VS Code extensions
# 6. Generates a report.txt file
```

### Exercise 2: Create a Build Script

Create a script that automates the build process:

```powershell
# TODO: Create build-release.ps1 that:
# 1. Cleans previous builds
# 2. Updates dependencies
# 3. Runs tests
# 4. Creates production build
# 5. Copies installer to a "releases" folder
```

### Exercise 3: Project Template

Create your own Tauri project template:

```powershell
# TODO: Create new-tauri-project.ps1 that:
# 1. Creates a new Tauri project
# 2. Adds your favorite dependencies (Tailwind, etc.)
# 3. Sets up a basic project structure
# 4. Initializes git repository
# 5. Creates README.md
```

### Exercise 4: Dependency Updater

Write a script to check for outdated dependencies:

```powershell
# TODO: Create check-updates.ps1 that:
# 1. Checks npm outdated packages
# 2. Checks cargo outdated crates
# 3. Displays what can be updated
# 4. Optionally updates all with user confirmation
```

### Exercise 5: QuickConnect Clone and Build

Clone and build QuickConnect from source:

```powershell
# TODO:
# 1. Clone QuickConnect repository
# 2. Install all dependencies
# 3. Build in debug mode
# 4. Run the application
# 5. Document any issues encountered
# 6. Create your own development branch
```

---

## Solutions

<details>
<summary>Click to reveal solutions</summary>

### Solution 1: Environment Verification Script

```powershell
# check-tauri-environment.ps1

$report = @()

Write-Host "=== Tauri Development Environment Check ===" -ForegroundColor Cyan
Write-Host ""

# Check Rust
Write-Host "Checking Rust..." -ForegroundColor Yellow
try {
    $rustVersion = (rustc --version) 2>&1
    $cargoVersion = (cargo --version) 2>&1
    Write-Host "✓ Rust: $rustVersion" -ForegroundColor Green
    Write-Host "✓ Cargo: $cargoVersion" -ForegroundColor Green
    $report += "Rust: OK - $rustVersion"
    $report += "Cargo: OK - $cargoVersion"
} catch {
    Write-Host "✗ Rust not found" -ForegroundColor Red
    $report += "Rust: NOT FOUND"
}

Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = (node --version) 2>&1
    $npmVersion = (npm --version) 2>&1
    Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "✓ npm: $npmVersion" -ForegroundColor Green
    $report += "Node.js: OK - $nodeVersion"
    $report += "npm: OK - $npmVersion"
} catch {
    Write-Host "✗ Node.js not found" -ForegroundColor Red
    $report += "Node.js: NOT FOUND"
}

Write-Host ""

# Check Tauri
Write-Host "Checking Tauri..." -ForegroundColor Yellow
try {
    $tauriVersion = (cargo tauri --version) 2>&1
    Write-Host "✓ Tauri CLI: $tauriVersion" -ForegroundColor Green
    $report += "Tauri: OK - $tauriVersion"
} catch {
    Write-Host "✗ Tauri CLI not found" -ForegroundColor Red
    $report += "Tauri: NOT FOUND"
}

Write-Host ""

# Check Visual Studio Build Tools
Write-Host "Checking Build Tools..." -ForegroundColor Yellow
$buildToolsPaths = @(
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools",
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\Community",
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\Professional"
)

$buildToolsFound = $false
foreach ($path in $buildToolsPaths) {
    if (Test-Path $path) {
        Write-Host "✓ Build Tools found at: $path" -ForegroundColor Green
        $report += "Build Tools: OK - $path"
        $buildToolsFound = $true
        break
    }
}

if (-not $buildToolsFound) {
    Write-Host "✗ Build Tools not found" -ForegroundColor Red
    $report += "Build Tools: NOT FOUND"
}

Write-Host ""

# Check WebView2
Write-Host "Checking WebView2..." -ForegroundColor Yellow
try {
    $webview2 = Get-ItemProperty -Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
    if ($webview2) {
        Write-Host "✓ WebView2: $($webview2.pv)" -ForegroundColor Green
        $report += "WebView2: OK - $($webview2.pv)"
    } else {
        Write-Host "✗ WebView2 not found" -ForegroundColor Red
        $report += "WebView2: NOT FOUND"
    }
} catch {
    Write-Host "✗ WebView2 check failed" -ForegroundColor Red
    $report += "WebView2: CHECK FAILED"
}

Write-Host ""

# Check VS Code Extensions (if VS Code is installed)
Write-Host "Checking VS Code Extensions..." -ForegroundColor Yellow
if (Get-Command code -ErrorAction SilentlyContinue) {
    $extensions = code --list-extensions
    $requiredExtensions = @(
        "rust-lang.rust-analyzer",
        "tauri-apps.tauri-vscode",
        "tamasfe.even-better-toml"
    )
    
    foreach ($ext in $requiredExtensions) {
        if ($extensions -contains $ext) {
            Write-Host "✓ $ext installed" -ForegroundColor Green
            $report += "Extension $ext: OK"
        } else {
            Write-Host "✗ $ext not installed" -ForegroundColor Yellow
            $report += "Extension $ext: NOT INSTALLED"
        }
    }
} else {
    Write-Host "! VS Code not found or not in PATH" -ForegroundColor Yellow
    $report += "VS Code: NOT IN PATH"
}

Write-Host ""
Write-Host "=== Check Complete ===" -ForegroundColor Cyan
Write-Host ""

# Generate report file
$reportPath = "environment-report.txt"
$report += ""
$report += "Generated: $(Get-Date)"
$report | Out-File -FilePath $reportPath

Write-Host "Report saved to: $reportPath" -ForegroundColor Green
```

### Solution 2: Build Script

```powershell
# build-release.ps1

param(
    [switch]$Clean = $false,
    [switch]$UpdateDeps = $false,
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"

Write-Host "=== QuickConnect Release Build Script ===" -ForegroundColor Cyan
Write-Host ""

# Clean previous builds
if ($Clean) {
    Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
    if (Test-Path "src-tauri\target") {
        Remove-Item -Recurse -Force "src-tauri\target"
        Write-Host "✓ Cleaned target directory" -ForegroundColor Green
    }
    if (Test-Path "node_modules") {
        Remove-Item -Recurse -Force "node_modules"
        Write-Host "✓ Cleaned node_modules" -ForegroundColor Green
    }
}

# Update dependencies
if ($UpdateDeps) {
    Write-Host "Updating dependencies..." -ForegroundColor Yellow
    npm update
    Set-Location src-tauri
    cargo update
    Set-Location ..
    Write-Host "✓ Dependencies updated" -ForegroundColor Green
}

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "✓ npm dependencies installed" -ForegroundColor Green
}

# Run tests (if not skipped)
if (-not $SkipTests) {
    Write-Host "Running tests..." -ForegroundColor Yellow
    Set-Location src-tauri
    cargo test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Tests failed!" -ForegroundColor Red
        exit 1
    }
    Set-Location ..
    Write-Host "✓ Tests passed" -ForegroundColor Green
}

# Build release
Write-Host "Building release..." -ForegroundColor Yellow
npm run tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build completed successfully" -ForegroundColor Green

# Create releases directory and copy installer
$releasesDir = "releases"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$releaseSubDir = Join-Path $releasesDir $timestamp

if (-not (Test-Path $releasesDir)) {
    New-Item -ItemType Directory -Path $releasesDir | Out-Null
}

New-Item -ItemType Directory -Path $releaseSubDir | Out-Null

# Find and copy the installer
$installerPath = Get-ChildItem -Path "src-tauri\target\release\bundle\nsis" -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($installerPath) {
    Copy-Item $installerPath.FullName -Destination $releaseSubDir
    Write-Host "✓ Installer copied to: $releaseSubDir" -ForegroundColor Green
    Write-Host ""
    Write-Host "Release location: $($installerPath.FullName)" -ForegroundColor Cyan
} else {
    Write-Host "! Installer not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Cyan
```

### Solution 3: Project Template

```powershell
# new-tauri-project.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectName
)

$ErrorActionPreference = "Stop"

Write-Host "=== Creating New Tauri Project: $ProjectName ===" -ForegroundColor Cyan
Write-Host ""

# Create project with Tauri
Write-Host "Creating Tauri project..." -ForegroundColor Yellow
npm create tauri-app@latest $ProjectName -- --template vanilla-ts --manager npm --yes

Set-Location $ProjectName

# Install additional dependencies
Write-Host "Installing additional dependencies..." -ForegroundColor Yellow
npm install -D tailwindcss postcss autoprefixer daisyui @tailwindcss/forms
npx tailwindcss init -p

# Create Tailwind config
Write-Host "Configuring Tailwind CSS..." -ForegroundColor Yellow
@"
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
    require('@tailwindcss/forms'),
  ],
  daisyui: {
    themes: ["light", "dark", "cupcake"],
  },
}
"@ | Out-File -FilePath "tailwind.config.js" -Encoding UTF8

# Update styles
Write-Host "Setting up styles..." -ForegroundColor Yellow
@"
@tailwind base;
@tailwind components;
@tailwind utilities;
"@ | Out-File -FilePath "src/style.css" -Encoding UTF8

# Initialize git
Write-Host "Initializing git repository..." -ForegroundColor Yellow
git init
git add .
git commit -m "Initial commit: Tauri project with Tailwind CSS"

# Create README
Write-Host "Creating README..." -ForegroundColor Yellow
@"
# $ProjectName

A Tauri application built with TypeScript, Tailwind CSS, and DaisyUI.

## Development

\`\`\`bash
npm install
npm run tauri dev
\`\`\`

## Build

\`\`\`bash
npm run tauri build
\`\`\`

## Tech Stack

- **Frontend**: TypeScript, Vite, Tailwind CSS, DaisyUI
- **Backend**: Rust, Tauri
- **Platform**: Windows (with WebView2)

## Project Structure

\`\`\`
$ProjectName/
├── src/                # Frontend source
├── src-tauri/          # Rust backend
├── index.html          # Main HTML
└── package.json        # Dependencies
\`\`\`

"@ | Out-File -FilePath "README.md" -Encoding UTF8

Write-Host ""
Write-Host "✓ Project created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  cd $ProjectName" -ForegroundColor White
Write-Host "  code ." -ForegroundColor White
Write-Host "  npm run tauri dev" -ForegroundColor White
Write-Host ""
```

### Solution 4: Dependency Updater

```powershell
# check-updates.ps1

param(
    [switch]$Update = $false
)

Write-Host "=== Dependency Update Check ===" -ForegroundColor Cyan
Write-Host ""

# Check npm packages
Write-Host "Checking npm packages..." -ForegroundColor Yellow
npm outdated

Write-Host ""

# Check cargo crates
Write-Host "Checking cargo crates..." -ForegroundColor Yellow

# First, install cargo-outdated if not present
if (-not (cargo outdated --version 2>$null)) {
    Write-Host "Installing cargo-outdated..." -ForegroundColor Yellow
    cargo install cargo-outdated
}

Set-Location src-tauri
cargo outdated
Set-Location ..

Write-Host ""

if ($Update) {
    $confirm = Read-Host "Do you want to update all dependencies? (yes/no)"
    
    if ($confirm -eq "yes") {
        Write-Host "Updating npm packages..." -ForegroundColor Yellow
        npm update
        
        Write-Host "Updating cargo crates..." -ForegroundColor Yellow
        Set-Location src-tauri
        cargo update
        Set-Location ..
        
        Write-Host "✓ All dependencies updated" -ForegroundColor Green
    } else {
        Write-Host "Update cancelled" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Check Complete ===" -ForegroundColor Cyan
```

### Solution 5: QuickConnect Clone and Build

```powershell
# clone-and-build-QuickConnect.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== QuickConnect Clone and Build ===" -ForegroundColor Cyan
Write-Host ""

# Clone repository
Write-Host "Cloning QuickConnect repository..." -ForegroundColor Yellow
if (Test-Path "QuickConnect") {
    Write-Host "! Directory 'QuickConnect' already exists" -ForegroundColor Yellow
    $overwrite = Read-Host "Remove existing directory? (yes/no)"
    if ($overwrite -eq "yes") {
        Remove-Item -Recurse -Force "QuickConnect"
    } else {
        Write-Host "Aborted" -ForegroundColor Red
        exit 1
    }
}

git clone https://github.com/Swatto86/QuickConnect.git
Set-Location QuickConnect

# Install dependencies
Write-Host ""
Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
npm install

# Build in debug mode
Write-Host ""
Write-Host "Building in debug mode..." -ForegroundColor Yellow
Write-Host "(This may take several minutes on first build)" -ForegroundColor Gray
npm run tauri build -- --debug

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build successful!" -ForegroundColor Green
    
    # Create development branch
    Write-Host ""
    Write-Host "Creating development branch..." -ForegroundColor Yellow
    $branchName = "dev-" + $env:USERNAME
    git checkout -b $branchName
    Write-Host "✓ Created branch: $branchName" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To run QuickConnect:" -ForegroundColor Cyan
    Write-Host "  npm run tauri dev" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✗ Build failed" -ForegroundColor Red
    Write-Host "Check the error messages above for details" -ForegroundColor Yellow
}
```

</details>

---

## Next Steps

In **Chapter 3: Understanding Tauri Architecture**, we'll explore:
- How Tauri bridges Rust and JavaScript
- The IPC (Inter-Process Communication) system
- Security model and sandboxing
- Build process in detail
- Comparing Tauri to other frameworks

**Your development environment is now complete and ready for building Tauri applications!**

---

## Additional Resources

- [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) - Official setup guide
- [Rust Installation](https://www.rust-lang.org/tools/install) - Official Rust setup
- [VS Code Rust Development](https://code.visualstudio.com/docs/languages/rust) - VS Code Rust guide
- [Cargo Book](https://doc.rust-lang.org/cargo/) - Complete Cargo documentation
- [Node.js Documentation](https://nodejs.org/docs/) - Node.js official docs


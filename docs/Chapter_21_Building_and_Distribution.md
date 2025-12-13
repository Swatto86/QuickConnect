# Chapter 21: Building and Distribution

## Introduction

You've built a fully functional Tauri application. Now it's time to package and distribute it to end users. This chapter covers everything you need to know about building production-ready installers, optimizing for release, managing versions, and distributing your application professionally.

By the end of this chapter, you'll be able to:
- Configure release builds with optimizations
- Create professional Windows installers (MSI and NSIS)
- Understand code signing and its importance
- Implement version management strategies
- Prepare documentation and deployment checklists
- Distribute your application through various channels

---

## 21.1 Release Build Configuration

### Understanding Build Profiles

Rust uses build profiles to control compilation settings. The two main profiles are:
- **`dev`** - Fast compilation, larger binaries, includes debug symbols
- **`release`** - Slower compilation, optimized binaries, smaller size

### Cargo.toml Release Profile

QuickConnect uses an optimized release profile in `Cargo.toml`:

```toml
[profile.release]
opt-level = "z"       # Optimize for size
lto = true            # Enable Link Time Optimization
codegen-units = 1     # Reduce codegen units for better optimization
panic = "abort"       # Use abort for panics to reduce binary size
```

**Let's understand each option:**

#### 1. `opt-level = "z"`

Controls optimization level:
- `0` = No optimizations (fast compile)
- `1` = Basic optimizations
- `2` = Default release optimizations
- `3` = Aggressive optimizations for speed
- `s` = Optimize for size
- `z` = Optimize aggressively for size

**QuickConnect uses "z"** because:
- Smaller installer size (important for distribution)
- Faster download times for users
- Minimal performance difference for GUI applications
- Modern CPUs handle optimized code efficiently

#### 2. `lto = true`

Link Time Optimization (LTO) analyzes the entire program during linking:
- Removes unused code across crate boundaries
- Inlines functions more aggressively
- Significantly reduces binary size
- Increases compile time (but only for release builds)

**Trade-off:**
```
Without LTO: QuickConnect.exe = ~4.5 MB, Build time = 2 minutes
With LTO:    QuickConnect.exe = ~3.2 MB, Build time = 5 minutes
```

For production releases, the smaller size is worth the extra build time.

#### 3. `codegen-units = 1`

Controls parallel code generation:
- Higher values = faster compilation (default is 16)
- Lower values = better optimization
- `1` = all code compiled together, maximum optimization

**Why use 1?**
- Allows LLVM to see the entire codebase at once
- Enables better optimization decisions
- Reduces binary size by ~5-10%
- Only affects release builds (dev still uses 256 for speed)

#### 4. `panic = "abort"`

Controls panic behavior:
- `"unwind"` (default) = Cleans up stack, larger binary
- `"abort"` = Terminates immediately, smaller binary

**For desktop applications:**
- Panics should be rare (most errors use `Result<T, E>`)
- Users benefit more from smaller downloads
- Crash reports still work with abort

**Note:** If you're building a library that others will use, keep `"unwind"` as it allows calling code to catch panics.

### Frontend Build Optimization

The TypeScript/Vite build is configured in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

**What happens during `npm run build`:**

1. **`tsc`** - TypeScript compiler checks types
   - Catches type errors before build
   - Doesn't generate JS (Vite handles that)
   - Ensures type safety

2. **`vite build`** - Bundles and optimizes frontend
   - Minifies JavaScript
   - Optimizes CSS with PostCSS
   - Tree-shakes unused code
   - Generates source maps (optional)
   - Outputs to `dist/` folder

### Tauri Build Configuration

The `tauri.conf.json` controls how Tauri builds your app:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  }
}
```

**Build process:**
1. Tauri runs `npm run build` (frontend)
2. Frontend outputs to `dist/`
3. Tauri embeds `dist/` into the Rust binary
4. Compiles Rust with release profile
5. Creates installers in `src-tauri/target/release/bundle/`

---

## 21.2 Building Your Application

### Method 1: Command Line

The simplest way to build:

```powershell
npm run tauri build
```

**What this does:**
1. Runs TypeScript compilation
2. Builds frontend with Vite
3. Compiles Rust in release mode
4. Creates all configured installers

**Output location:**
```
src-tauri/target/release/
  ├── bundle/
  │   ├── msi/         # Windows Installer
  │   └── nsis/        # NSIS Installer
  └── QuickConnect.exe     # Standalone executable
```

### Method 2: QuickConnect's Build Script

QuickConnect includes `build.bat` for easier building:

```batch
@echo off
REM Build script for QuickConnect Tauri application

echo Setting up Visual Studio Build Tools environment...
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64

if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio Build Tools environment
    echo Please ensure Visual Studio 2022 Build Tools is installed.
    pause
    exit /b 1
)

echo.
echo Building QuickConnect...
echo.

npm run tauri build

if errorlevel 1 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo Build completed successfully!
echo Output files are in: src-tauri\target\release\bundle\
pause
```

**Why this script?**
- Ensures Visual Studio Build Tools are loaded
- Provides clear error messages
- Shows output location
- Pauses on completion so you can see results

**To use:**
```powershell
.\build.bat
```

### Build Times

Typical build times for QuickConnect on a modern machine:

| Component | First Build | Incremental Build |
|-----------|-------------|-------------------|
| Frontend  | 10-15 sec   | 5-10 sec          |
| Rust (dev)| 2-3 min     | 30-60 sec         |
| Rust (release) | 5-8 min | 3-5 min          |
| **Total** | **6-10 min** | **4-6 min**      |

**Tips for faster builds:**
- Use `--target` to build only one installer type
- Keep dependencies up to date
- Use `cargo clean` if builds become slow
- Ensure antivirus excludes `target/` directory

---

## 21.3 Understanding Bundle Formats

Tauri can generate multiple installer formats. Let's examine what QuickConnect creates.

### Bundle Configuration

In `tauri.conf.json`:

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "publisher": "Swatto",
    "copyright": "Copyright © 2025 Swatto. All rights reserved.",
    "category": "Utility",
    "shortDescription": "Fast RDP connection manager for system administrators",
    "longDescription": "QuickConnect is a fast and efficient RDP connection manager...",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "wix": {
        "language": "en-US"
      }
    }
  }
}
```

### MSI Installer (WiX)

**What is it?**
- Windows Installer format (`.msi`)
- Created using WiX Toolset
- Preferred by enterprise IT departments
- Supports Group Policy deployment

**Features:**
- Professional installation experience
- Add/Remove Programs integration
- Uninstaller included
- Can be deployed via Active Directory
- Digitally signable

**Output:**
```
src-tauri/target/release/bundle/msi/
  └── QuickConnect_1.1.0_x64_en-US.msi
```

**File size:** ~3-4 MB

**Best for:**
- Corporate/enterprise distribution
- IT department deployments
- Installations requiring admin rights

### NSIS Installer

**What is it?**
- Nullsoft Scriptable Install System
- Creates `.exe` installers
- More flexible than MSI
- Common for consumer software

**Features:**
- Custom branding and UI
- Multiple compression options
- Can include additional files/documentation
- Portable installation option
- Silent install support

**Output:**
```
src-tauri/target/release/bundle/nsis/
  └── QuickConnect_1.1.0_x64-setup.exe
```

**File size:** ~3-4 MB

**Best for:**
- Consumer/end-user distribution
- Custom installation workflows
- Websites and download portals

### Standalone Executable

**What is it?**
- Single `.exe` file
- No installer required
- Portable application

**Location:**
```
src-tauri/target/release/QuickConnect.exe
```

**Features:**
- Run from anywhere
- No installation needed
- Useful for testing
- Can be zipped for distribution

**File size:** ~3.5 MB

**Best for:**
- USB drive deployment
- Quick testing
- Network share distribution
- Users who prefer portable apps

### Choosing the Right Format

| Scenario | Recommended Format |
|----------|-------------------|
| Enterprise deployment | MSI |
| Public website download | NSIS |
| Internal testing | Standalone .exe |
| GitHub releases | All three (let users choose) |
| USB/portable | Standalone .exe in zip |

**QuickConnect builds all formats** because different users have different needs.

---

## 21.4 Application Icons

Icons are crucial for professional appearance. Tauri requires multiple formats and sizes.

### Required Icon Files

```
src-tauri/icons/
  ├── 32x32.png           # Windows taskbar
  ├── 128x128.png         # Windows Start menu
  ├── 128x128@2x.png      # High DPI displays
  ├── icon.ico            # Windows executable icon
  ├── icon.icns           # macOS (if cross-platform)
  └── android/            # Mobile (if needed)
```

### Creating Icons

**Option 1: Tauri Icon Generator**

Tauri provides a built-in icon generator:

```powershell
npm run tauri icon path/to/source-icon.png
```

**Requirements:**
- Source image must be at least 1024x1024 PNG
- Square aspect ratio
- Transparent background (optional)
- High quality (will be downscaled)

**What it generates:**
- All required sizes for all platforms
- Optimized for each platform
- Placed in `src-tauri/icons/`

**Example workflow:**
```powershell
# 1. Create a high-res icon (1024x1024)
# Use tool like Photoshop, GIMP, or Figma

# 2. Generate all sizes
npm run tauri icon app-icon-1024.png

# 3. Verify outputs
ls src-tauri/icons/
```

**Option 2: Manual Creation**

If you need precise control:

1. **Create ICO file** (Windows)
   - Use tool like IcoFX or GIMP
   - Include multiple resolutions: 16, 32, 48, 64, 128, 256
   - Save as `icon.ico`

2. **Create PNG files**
   - Export at exact sizes: 32x32, 128x128, 256x256
   - Use high-quality PNG with transparency
   - Optimize with tools like TinyPNG

### Icon Design Best Practices

**1. Scalability**
- Icons will be shown at many sizes (16px to 256px)
- Test at small sizes (32x32) to ensure readability
- Avoid fine details that disappear when scaled down

**2. Contrast**
- Works well on light and dark backgrounds
- Consider adding a subtle outline or shadow
- Test on Windows light/dark themes

**3. Simplicity**
- Simple shapes scale better than complex ones
- Limit color palette (3-5 colors)
- Avoid text (won't be readable at small sizes)

**4. Platform Guidelines**
- Windows: Flat, colorful, simple
- macOS: Rounded, gradient, 3D
- Linux: Varies by desktop environment

**QuickConnect Icon Strategy:**
- Simple computer/RDP symbol
- Blue color scheme (professional, trustworthy)
- Works at all sizes
- Recognizable in taskbar

---

## 21.5 Code Signing (Windows)

Code signing proves your application comes from you and hasn't been tampered with.

### Why Code Sign?

**Without signing:**
- Windows SmartScreen warnings
- "Unknown publisher" dialogs
- Users hesitant to install
- Looks unprofessional

**With signing:**
- Shows your company/name
- "Verified publisher" badge
- Builds user trust
- Required for some distribution channels

### Obtaining a Certificate

**Option 1: Commercial Certificate Authority**

Popular providers:
- DigiCert
- GlobalSign
- Sectigo (formerly Comodo)

**Cost:** $100-$400/year

**Process:**
1. Purchase certificate
2. Verify your identity (business verification)
3. Receive certificate file (`.pfx` or `.p12`)
4. Install on signing machine

**Option 2: Self-Signed Certificate (Testing Only)**

For internal testing, create a self-signed cert:

```powershell
# Create self-signed certificate (PowerShell as Admin)
New-SelfSignedCertificate `
    -Subject "CN=YourCompany, O=YourCompany Inc., C=US" `
    -Type CodeSigning `
    -KeyUsage DigitalSignature `
    -FriendlyName "YourApp Code Signing" `
    -CertStoreLocation Cert:\CurrentUser\My `
    -NotAfter (Get-Date).AddYears(2)

# Export to PFX
$cert = Get-ChildItem -Path Cert:\CurrentUser\My -CodeSigningCert | Select-Object -First 1
$pwd = ConvertTo-SecureString -String "YourPassword" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "signing-cert.pfx" -Password $pwd
```

**⚠️ Warning:** Self-signed certificates still trigger SmartScreen warnings. They're only useful for:
- Internal company distribution
- Testing the signing process
- Development builds

### Configuring Tauri for Code Signing

**Method 1: Environment Variables**

Set before building:

```powershell
# PowerShell
$env:TAURI_SIGNING_PRIVATE_KEY = "path/to/certificate.pfx"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-cert-password"

# Then build
npm run tauri build
```

**Method 2: tauri.conf.json**

Add to configuration:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

**Finding your certificate thumbprint:**

```powershell
# List all code signing certificates
Get-ChildItem -Path Cert:\CurrentUser\My -CodeSigningCert

# Shows thumbprint, subject, expiration
```

**Timestamp URL:**
- Ensures signature remains valid after cert expires
- Required for long-term validity
- Use CA's timestamp server

Popular timestamp servers:
- DigiCert: `http://timestamp.digicert.com`
- GlobalSign: `http://timestamp.globalsign.com/scripts/timstamp.dll`
- Sectigo: `http://timestamp.sectigo.com`

### Signing Process

**Automatic signing (Tauri):**

When configured, Tauri automatically signs:
1. Main executable (`QuickConnect.exe`)
2. Installer files (`.msi`, `.exe`)
3. Any bundled DLLs

**Manual signing (if needed):**

```powershell
# Using signtool (included with Windows SDK)
signtool sign /f "certificate.pfx" /p "password" /fd sha256 /tr "http://timestamp.digicert.com" /td sha256 QuickConnect.exe
```

### Verifying Signatures

**Method 1: Windows Properties**

Right-click `.exe` → Properties → Digital Signatures tab

Should show:
- Your name/company
- Certificate issuer
- Timestamp
- "This digital signature is OK"

**Method 2: signtool**

```powershell
signtool verify /pa QuickConnect.exe
```

**Method 3: PowerShell**

```powershell
Get-AuthenticodeSignature QuickConnect.exe
```

### Best Practices

**1. Protect Your Certificate**
- Store `.pfx` securely (encrypted drive)
- Never commit to version control
- Use strong password
- Limit access to signing machine

**2. Automate Signing in CI/CD**
- Store certificate in secure secrets
- Sign as part of build pipeline
- Different cert for dev/prod

**3. Certificate Renewal**
- Monitor expiration dates
- Renew 1-2 months before expiry
- Update all build scripts

**4. Security**
- Use Hardware Security Module (HSM) for high-value certs
- Enable two-factor authentication on CA account
- Audit certificate usage

---

## 21.6 Version Management

Proper versioning is crucial for updates, bug tracking, and user communication.

### Semantic Versioning

Tauri uses **SemVer** (Semantic Versioning): `MAJOR.MINOR.PATCH`

```
1.2.3
│ │ │
│ │ └─ PATCH: Bug fixes, no new features
│ └─── MINOR: New features, backward compatible
└───── MAJOR: Breaking changes
```

**Examples:**
- `1.0.0` → `1.0.1`: Fixed a crash bug
- `1.0.1` → `1.1.0`: Added LDAP scanning feature
- `1.1.0` → `2.0.0`: Changed config file format (breaking change)

### Version Synchronization

**The version must match in three places:**

#### 1. Cargo.toml
```toml
[package]
name = "QuickConnect"
version = "1.1.0"
```

#### 2. tauri.conf.json
```json
{
  "productName": "QuickConnect",
  "version": "1.1.0"
}
```

#### 3. package.json
```json
{
  "name": "QuickConnect",
  "version": "1.1.0"
}
```

**Note:** Keep `package.json` version synchronized with the other version files for consistency.

### Updating Versions

**Manual approach:**
1. Edit `Cargo.toml`
2. Edit `tauri.conf.json`
3. Commit with message: `chore: bump version to 1.2.0`
4. Tag the commit: `git tag v1.2.0`

**Automated approach:**

Create a script `bump-version.ps1`:

```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$NewVersion
)

# Update Cargo.toml
$cargoToml = Get-Content "src-tauri/Cargo.toml"
$cargoToml = $cargoToml -replace 'version = "\d+\.\d+\.\d+"', "version = `"$NewVersion`""
$cargoToml | Set-Content "src-tauri/Cargo.toml"

# Update tauri.conf.json
$tauriConf = Get-Content "src-tauri/tauri.conf.json" | ConvertFrom-Json
$tauriConf.version = $NewVersion
$tauriConf | ConvertTo-Json -Depth 10 | Set-Content "src-tauri/tauri.conf.json"

# Git operations
git add .
git commit -m "chore: bump version to $NewVersion"
git tag "v$NewVersion"

Write-Host "Version bumped to $NewVersion"
Write-Host "Don't forget to: git push && git push --tags"
```

**Usage:**
```powershell
.\bump-version.ps1 -NewVersion "1.2.0"
```

### Version Information in Code

**Display version in your app:**

```rust
// src/lib.rs

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
```

```typescript
// src/about.ts

import { invoke } from '@tauri-apps/api/core';

const version = await invoke<string>('get_app_version');
document.getElementById('version')!.textContent = `Version ${version}`;
```

**QuickConnect About Window:**
```html
<!-- about.html -->
<div class="text-center">
  <h1 class="text-2xl font-bold">QuickConnect</h1>
  <p class="text-gray-600">Version <span id="version">1.2.0</span></p>
  <p class="mt-2">Fast RDP Connection Manager</p>
</div>
```

### Changelogs

Maintain a `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/):

```markdown
# Changelog

All notable changes to QuickConnect will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-15

### Added
- LDAP domain scanning for automatic server discovery
- Recent connections in system tray menu
- Per-host credential management
- Debug logging system

### Changed
- Improved error messages with detailed context
- Updated UI theme system

### Fixed
- Crash when hosts.csv was empty
- Memory leak in credential manager
- Window focus issues on startup

## [1.0.0] - 2024-12-01

### Added
- Initial release
- Basic RDP connection management
- Host storage in CSV
- Windows Credential Manager integration
- Multi-window interface
```

**Update changelog with each release** before tagging the version.

---

## 21.7 Documentation and Help Files

Good documentation improves user experience and reduces support burden.

### Essential Documentation

**1. README.md**
- What the app does
- Installation instructions
- Basic usage
- System requirements
- License information

**2. User Guide (optional)**
- Detailed feature explanations
- Screenshots
- Common workflows
- Troubleshooting

**3. Developer Documentation (if open source)**
- Building from source
- Architecture overview
- Contributing guidelines
- API documentation

### QuickConnect README Example

```markdown
# QuickConnect

Fast RDP connection manager for Windows system administrators.

## Features

- 🚀 Quick RDP connections with one click
- 💾 Save and organize multiple hosts
- 🔒 Secure credential storage with Windows Credential Manager
- 🔍 Real-time search and filtering
- 🌐 LDAP domain scanning
- 🎨 Dark/Light theme support
- ⌨️ Global keyboard shortcuts

## Installation

### Installer (Recommended)

1. Download the latest installer from [Releases](https://github.com/Swatto86/QuickConnect/releases)
2. Run `QuickConnect_1.1.0_x64-setup.exe`
3. Follow the installation wizard
4. Launch from Start Menu or desktop shortcut

### Portable Version

1. Download `QuickConnect-portable.zip`
2. Extract to any folder
3. Run `QuickConnect.exe`

## System Requirements

- Windows 10 or later (64-bit)
- .NET Framework 4.8+ (usually pre-installed)
- 50 MB free disk space

## Quick Start

1. Launch QuickConnect
2. Click "Manage Hosts" to add servers
3. Enter hostname and optional credentials
4. Click "Connect" to launch RDP

## Keyboard Shortcuts

- `Ctrl+Alt+R` - Show QuickConnect window
- `Ctrl+D` - Reset/Debug mode
- `Enter` - Connect to selected host
- `Escape` - Close window

## Support

- Report bugs: [GitHub Issues](https://github.com/Swatto86/QuickConnect/issues)
- Feature requests: [Discussions](https://github.com/Swatto86/QuickConnect/discussions)

## License

Copyright © 2025 Swatto. All rights reserved.
```

### In-App Help

**Add help to your UI:**

```html
<!-- main.html -->
<div class="tooltip" data-tip="Enter hostname or IP address">
  <input type="text" placeholder="Server..." />
</div>
```

**DaisyUI tooltips** make it easy to add contextual help.

**Help menu or About dialog:**

```typescript
// Add to system tray menu
{
  id: 'help',
  text: 'Help',
  action: () => {
    // Open help documentation
    invoke('open_url', { url: 'https://github.com/Swatto86/QuickConnect/wiki' });
  }
}
```

---

## 21.8 Deployment Checklist

Before releasing, go through this checklist:

### Pre-Build Checklist

- [ ] All tests passing
- [ ] No compiler warnings
- [ ] Version numbers updated in `Cargo.toml` and `tauri.conf.json`
- [ ] `CHANGELOG.md` updated
- [ ] Documentation reviewed and updated
- [ ] Dependencies updated to latest stable versions
- [ ] Security audit run (`cargo audit`)

### Build Checklist

- [ ] Clean build (`npm run tauri build`)
- [ ] All bundle formats generated (MSI, NSIS, standalone)
- [ ] Code signing successful (if applicable)
- [ ] File sizes reasonable
- [ ] Build artifacts copied to safe location

### Testing Checklist

- [ ] Install MSI on clean Windows VM
- [ ] Install NSIS on clean Windows VM
- [ ] Run portable executable without installation
- [ ] All features work after installation
- [ ] Uninstaller removes all files
- [ ] No errors in Event Viewer
- [ ] Works on Windows 10 and 11
- [ ] High DPI displays tested

### Release Checklist

- [ ] Git tag created: `git tag v1.1.0`
- [ ] Tag pushed: `git push --tags`
- [ ] GitHub Release created with notes
- [ ] Installers uploaded to release
- [ ] SHA256 checksums provided
- [ ] Release notes match changelog
- [ ] Social media announcement (if applicable)
- [ ] Documentation website updated

### Post-Release Checklist

- [ ] Monitor for bug reports
- [ ] Check download statistics
- [ ] Collect user feedback
- [ ] Plan next version features

---

## 21.9 Distribution Platforms

### 1. GitHub Releases

**Best for:** Open source projects, free distribution

**Process:**
1. Create release on GitHub
2. Upload installers
3. Write release notes
4. Publish

**Example:**
```bash
# Create release with GitHub CLI
gh release create v1.1.0 \
  --title "QuickConnect v1.1.0" \
  --notes "See CHANGELOG.md for details" \
  src-tauri/target/release/bundle/msi/*.msi \
  src-tauri/target/release/bundle/nsis/*.exe
```

### 2. Company Website

**Best for:** Commercial software, branded distribution

**Requirements:**
- Web hosting
- Download page
- Update notifications (optional)

**Example download page:**
```html
<h1>Download QuickConnect</h1>
<div class="download-options">
  <a href="QuickConnect-setup.exe" class="btn">
    Download Installer (3.5 MB)
  </a>
  <a href="QuickConnect-portable.zip" class="btn-secondary">
    Download Portable (3.2 MB)
  </a>
</div>
```

### 3. Microsoft Store (Future)

**Best for:** Maximum reach, automatic updates

**Requirements:**
- Developer account ($19 one-time)
- MSIX packaging
- Store policies compliance
- App certification

**Note:** Tauri doesn't generate MSIX directly yet, but you can convert:
```powershell
# Convert MSI to MSIX (requires MSIX Packaging Tool)
# https://docs.microsoft.com/windows/msix/packaging-tool/tool-overview
```

### 4. Chocolatey (Package Manager)

**Best for:** Developer/IT admin audience

**Create a Chocolatey package:**

```powershell
# nuspec file
<?xml version="1.0"?>
<package>
  <metadata>
    <id>QuickConnect</id>
    <version>1.1.0</version>
    <title>QuickConnect</title>
    <authors>Swatto</authors>
    <description>Fast RDP connection manager</description>
    <projectUrl>https://github.com/Swatto86/QuickConnect</projectUrl>
  </metadata>
  <files>
    <file src="tools\**" target="tools" />
  </files>
</package>
```

**Users install with:**
```powershell
choco install QuickConnect
```

### 5. Winget (Windows Package Manager)

**Best for:** Modern Windows users

**Create manifest:**
```yaml
# QuickConnect.yaml
PackageIdentifier: Swatto.QuickConnect
PackageVersion: 1.1.0
PackageLocale: en-US
Publisher: Swatto
PackageName: QuickConnect
License: Proprietary
ShortDescription: Fast RDP connection manager
Installers:
  - Architecture: x64
    InstallerType: msi
    InstallerUrl: https://github.com/Swatto86/QuickConnect/releases/download/v1.1.0/QuickConnect_1.1.0_x64_en-US.msi
    InstallerSha256: <SHA256_HASH>
```

**Users install with:**
```powershell
winget install Swatto.QuickConnect
```

---

## 21.10 Auto-Update Implementation (Future Enhancement)

While not implemented in QuickConnect currently, auto-updates are a valuable feature.

### Tauri Updater Plugin

Tauri provides an updater plugin:

```toml
# Cargo.toml
[dependencies]
tauri-plugin-updater = "2.0"
```

```json
// tauri.conf.json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://yourdomain.com/updates/{{target}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

### Update Server

Host a JSON file with update info:

```json
{
  "version": "1.2.0",
  "notes": "Bug fixes and improvements",
  "pub_date": "2025-02-01T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "BASE64_SIGNATURE",
      "url": "https://yourdomain.com/QuickConnect_1.2.0_x64-setup.exe"
    }
  }
}
```

### Frontend Integration

```typescript
import { check } from '@tauri-apps/plugin-updater';

async function checkForUpdates() {
  const update = await check();
  if (update?.available) {
    console.log(`Update to ${update.version} available`);
    await update.downloadAndInstall();
    // Restart app
  }
}
```

**Benefits:**
- Seamless user experience
- Automatic security patches
- Reduced support burden
- Version adoption tracking

---

## 21.11 Security Considerations

### Pre-Release Security Audit

**1. Dependency Audit**
```powershell
# Check for known vulnerabilities
cargo audit
npm audit
```

**2. Code Review**
- Review all `unsafe` blocks
- Check for SQL injection (if using DB)
- Validate all user inputs
- Review file path handling

**3. Permissions Review**
- Minimize requested permissions
- Document why each permission is needed
- Consider user privacy

### Installer Security

**1. Download Security**
- Host on HTTPS only
- Provide SHA256 checksums
- Sign installers (code signing)

**2. Installation Process**
- Request minimal privileges
- Clear installation path
- No bundled adware/bloatware

**Example checksum file:**
```
# QuickConnect v1.1.0 Checksums (SHA256)

8A3F9E... QuickConnect_1.1.0_x64-setup.exe
7B2D1C... QuickConnect_1.1.0_x64_en-US.msi
9C4E8A... QuickConnect-portable.zip

# Verify with PowerShell:
# Get-FileHash -Algorithm SHA256 filename
```

---

## 21.12 Continuous Integration / Continuous Deployment (CI/CD)

### GitHub Actions Example

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node
      uses: actions/setup-node@v4
      with:
        node-version: 20
    
    - name: Setup Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
    
    - name: Install dependencies
      run: npm install
    
    - name: Build
      run: npm run tauri build
    
    - name: Create Release
      uses: softprops/action-gh-release@v1
      with:
        files: |
          src-tauri/target/release/bundle/msi/*.msi
          src-tauri/target/release/bundle/nsis/*.exe
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**What this does:**
1. Triggers on git tag push
2. Sets up Node and Rust
3. Installs dependencies
4. Builds release
5. Creates GitHub Release
6. Uploads installers

**To use:**
```bash
git tag v1.2.0
git push --tags
# GitHub Actions automatically builds and releases
```

---

## 21.13 Real-World Example: QuickConnect Release Process

Let's walk through a complete release of QuickConnect version 1.2.0.

### Step 1: Prepare Release

```powershell
# 1. Update version numbers
.\bump-version.ps1 -NewVersion "1.2.0"

# 2. Update CHANGELOG.md
# Add new section for 1.2.0

# 3. Commit changes
git add .
git commit -m "chore: release v1.2.0"
git push
```

### Step 2: Build Release

```powershell
# 1. Clean previous builds
npm run tauri build -- --clean

# 2. Run build script
.\build.bat

# Wait 5-8 minutes for build to complete
```

### Step 3: Test Installers

```powershell
# 1. Create test VM or use clean Windows install

# 2. Test MSI
cd src-tauri\target\release\bundle\msi
# Copy to test machine and install

# 3. Test NSIS
cd ..\nsis
# Copy to test machine and install

# 4. Verify all features work
```

### Step 4: Create Release

```powershell
# 1. Tag the release
git tag v1.2.0
git push --tags

# 2. Generate checksums
cd src-tauri\target\release\bundle
Get-FileHash -Algorithm SHA256 msi\*.msi
Get-FileHash -Algorithm SHA256 nsis\*.exe

# 3. Create GitHub Release
# - Go to GitHub Releases
# - Click "Draft a new release"
# - Select tag v1.2.0
# - Copy changelog for release notes
# - Upload MSI and NSIS files
# - Add checksums to description
# - Publish release
```

### Step 5: Announce

```markdown
# QuickConnect v1.2.0 Released! 🎉

We're excited to announce QuickConnect v1.2.0 with several new features:

✨ New Features:
- Advanced search filtering
- Bulk host import
- Connection history

🐛 Bug Fixes:
- Fixed crash on empty hosts file
- Improved error messages

📥 Download: https://github.com/Swatto86/QuickConnect/releases/tag/v1.2.0

Full changelog: https://github.com/Swatto86/QuickConnect/blob/main/CHANGELOG.md
```

---

## 21.14 Key Takeaways

### Build Configuration
- Use optimized release profile for smaller binaries
- LTO and `codegen-units = 1` significantly reduce size
- Frontend and backend build separately

### Bundle Formats
- MSI for enterprise/IT departments
- NSIS for consumer distribution
- Standalone executable for portable use
- Generate all formats to maximize reach

### Code Signing
- Essential for professional appearance
- Removes SmartScreen warnings
- Requires certificate from trusted CA
- Self-signed certs only for testing

### Version Management
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Keep versions synchronized across files
- Maintain detailed changelog
- Tag releases in git

### Distribution
- GitHub Releases for open source
- Consider package managers (Chocolatey, Winget)
- Provide multiple download options
- Include SHA256 checksums

### Security
- Run dependency audits before release
- Sign all installers
- Provide secure download channels
- Document security practices

### Process
- Use deployment checklist
- Test on clean systems
- Automate with CI/CD when possible
- Monitor post-release metrics

---

## 21.15 Practice Exercises

### Exercise 1: Optimize Build Size

**Task:** Measure the effect of different optimization settings.

**Steps:**
1. Build with default settings, note size
2. Enable LTO, measure difference
3. Try different `opt-level` values
4. Document findings

**Expected learning:** Understanding trade-offs between build time, binary size, and performance.

---

### Exercise 2: Create Branded Installer

**Task:** Customize the installer appearance.

**Steps:**
1. Create custom application icons
2. Generate all required sizes with `tauri icon`
3. Build and verify icons appear correctly
4. Test on Windows 10 and 11

**Bonus:** Add custom installer graphics for NSIS.

---

### Exercise 3: Implement Version Display

**Task:** Show version in your app's About dialog.

**Steps:**
1. Create `get_app_version()` command
2. Add About window to your app
3. Display version from Cargo.toml
4. Include build date and commit hash

**Hint:**
```rust
fn get_build_info() -> BuildInfo {
    BuildInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        build_date: env!("BUILD_DATE").to_string(), // Set in build.rs
    }
}
```

---

### Exercise 4: Create Release Automation

**Task:** Automate your release process.

**Steps:**
1. Create `bump-version.ps1` script
2. Create `release.ps1` script that:
   - Runs tests
   - Builds release
   - Generates checksums
   - Creates git tag
3. Test on a feature branch

**Goal:** One-command release process.

---

### Exercise 5: Setup GitHub Actions

**Task:** Automate building with CI/CD.

**Steps:**
1. Create `.github/workflows/build.yml`
2. Configure to build on every commit
3. Upload artifacts for download
4. Add status badge to README

**Advanced:** Automatically create releases on tag push.

---

## 21.16 Further Reading

### Official Documentation
- [Tauri Bundle Configuration](https://v2.tauri.app/reference/config/#bundle)
- [Tauri Building Guide](https://v2.tauri.app/develop/build/)
- [Cargo Profiles](https://doc.rust-lang.org/cargo/reference/profiles.html)

### Code Signing
- [Microsoft Code Signing Guide](https://docs.microsoft.com/windows/win32/seccrypto/cryptography-tools)
- [DigiCert Code Signing](https://www.digecert.com/signing/code-signing-certificates)

### Distribution
- [Windows Package Manager (Winget)](https://docs.microsoft.com/windows/package-manager/)
- [Chocolatey Package Creation](https://docs.chocolatey.org/en-us/create/create-packages)

### CI/CD
- [GitHub Actions for Rust](https://github.com/actions-rs)
- [Tauri Action](https://github.com/tauri-apps/tauri-action)

### Best Practices
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [The Twelve-Factor App](https://12factor.net/)

---

## Conclusion

Congratulations! You now know how to:
- Build optimized release binaries
- Create professional installers
- Sign your applications
- Manage versions properly
- Distribute through multiple channels
- Automate your release process

**Building and distribution is the final step** in delivering your Tauri application to users. A smooth, professional release process builds trust and ensures users have the best experience with your software.

**Next steps:**
- Review Appendix A for complete QuickConnect source code walkthrough
- Explore common patterns in Appendix B
- Reference troubleshooting guide in Appendix C

**You've completed the main guide!** You're now equipped to build, package, and distribute professional Windows applications with Rust and Tauri. 🎉

---

**Chapter 21 Complete** | [Back to Chapter 20](Chapter_20_Testing_Debugging_and_Performance.md) | [Appendix A →](Appendix_A_Complete_QuickConnect_Walkthrough.md)

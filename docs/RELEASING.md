# Releasing QuickConnect

## Prerequisites

- Push access to `main`
- Repository secrets configured:
  - `TAURI_SIGNING_PRIVATE_KEY` — Tauri update signing key
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — Signing key password

## Release Process

### 1. Update version numbers

Use the `update-application.ps1` script to automate version updates:

```powershell
.\update-application.ps1 -Version "X.Y.Z" -Notes "Release notes here"
```

This script will:
- Update `src-tauri/Cargo.toml` → `version = "X.Y.Z"`
- Update `src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
- Update `about.html` → Version display
- Create a Git commit with the version bump
- Create an annotated Git tag with release notes
- Push the commit and tag to GitHub

### 2. Alternative: Manual release process

If you prefer to manually manage the release:

#### 2a. Update version files

Update the version in:
- `src-tauri/Cargo.toml` → `version = "X.Y.Z"`
- `src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
- `about.html` → `<p class="text-base-content/70 text-sm">Version X.Y.Z</p>`

#### 2b. Run verification

```powershell
pwsh -File scripts/verify.ps1
```

All 4 steps must pass.

#### 2c. Commit and push

```powershell
git add -A
git commit -m "chore: bump version to X.Y.Z"
git push origin main
```

#### 2d. Create an annotated tag

```powershell
git tag -a vX.Y.Z -m "QuickConnect vX.Y.Z

## What's New
- Feature 1
- Feature 2

## Fixes
- Fix 1
"
git push origin vX.Y.Z
```

The tag message becomes the GitHub Release body.

### 3. Wait for CI

The `release.yml` workflow will:
1. Run `scripts/verify.ps1` (quality gate)
2. Build the Tauri app (NSIS installer)
3. Generate SHA256 checksums for all artifacts
4. Create a draft GitHub Release with artifacts attached
5. Publish the release automatically

Monitor progress at: https://github.com/Swatto86/QuickConnect/actions

### 4. Verify the release

- Check the [Releases page](https://github.com/Swatto86/QuickConnect/releases)
- Download and verify the installer
- Confirm SHA256 checksums match

## Rollback

If a release has critical issues:

1. **Remove the tag** (stops further downloads from that version):
   ```powershell
   git tag -d vX.Y.Z
   git push origin :refs/tags/vX.Y.Z
   ```

2. **Delete the GitHub Release** from the Releases page.

3. **Fix the issue** on `main`, then re-release with a patch version bump.

## Versioning

QuickConnect follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (X): Breaking changes to user-facing behavior
- **MINOR** (Y): New features, backward compatible
- **PATCH** (Z): Bug fixes, backward compatible

## Artifacts Produced

| Artifact | Description |
|----------|-------------|
| `QuickConnect_X.Y.Z_x64-setup.exe` | NSIS installer for Windows |
| `QuickConnect_X.Y.Z_x64-setup.nsis.zip` | Compressed installer |
| `SHA256SUMS.txt` | SHA256 checksums for all artifacts |
| `latest.json` | Tauri auto-update manifest |

## Using update-application.ps1

### Basic Usage

```powershell
# Interactive mode (prompts for version and notes)
.\update-application.ps1

# Command-line mode
.\update-application.ps1 -Version "1.2.3" -Notes "Bug fixes and improvements"
```

### Advanced Options

```powershell
# Force mode - overwrites existing tag/release
.\update-application.ps1 -Version "1.2.3" -Notes "Hotfix" -Force

# Multi-line release notes
.\update-application.ps1 -Version "1.3.0" -Notes @"
Added new features:
- Feature A
- Feature B

Fixed bugs:
- Bug 1
- Bug 2
"@
```

### What the script does

1. Validates version format (semantic versioning)
2. Checks if version is newer than current
3. Optionally cleans up old version tags
4. Updates all version references
5. Commits changes
6. Creates annotated Git tag with release notes
7. Pushes to GitHub
8. Triggers automated release workflow

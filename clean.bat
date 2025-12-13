@echo off
REM QuickConnect Build Artifact Cleanup Script
REM This script removes ALL build artifacts, caches, and dependencies for a completely fresh start
REM Use this before a clean rebuild or when troubleshooting build issues

echo ====================================
echo QuickConnect Deep Clean Script
echo ====================================
echo.
echo WARNING: This will remove ALL build artifacts,
echo          caches, and installed dependencies!
echo.
echo Press Ctrl+C to cancel, or
pause

REM Change to the project root directory
cd /d "%~dp0"

echo.
echo Starting deep clean...
echo.

echo [1/16] Cleaning Node.js build outputs...
if exist "dist" (
    rmdir /s /q "dist" 2>nul
    if not exist "dist" (
        echo   - Removed dist/
    ) else (
        echo   - Warning: Could not remove dist/
    )
)
if exist "dist-ssr" (
    rmdir /s /q "dist-ssr" 2>nul
    if not exist "dist-ssr" (
        echo   - Removed dist-ssr/
    ) else (
        echo   - Warning: Could not remove dist-ssr/
    )
)

echo [2/16] Cleaning Vite cache...
if exist ".vite" (
    rmdir /s /q ".vite" 2>nul
    echo   - Removed .vite/
)
if exist ".vite-inspect" (
    rmdir /s /q ".vite-inspect" 2>nul
    echo   - Removed .vite-inspect/
)
del /q "vite.config.*.timestamp-*" 2>nul

echo [3/16] Cleaning Node.js dependencies...
if exist "node_modules" (
    echo   - Removing node_modules/ ^(this may take a moment^)...
    rmdir /s /q "node_modules" 2>nul
    if not exist "node_modules" (
        echo   - Removed node_modules/
    ) else (
        echo   - Warning: Could not remove node_modules/ ^(may be in use^)
    )
)
if exist "package-lock.json" (
    del /q "package-lock.json" 2>nul
    echo   - Removed package-lock.json
)

echo [4/16] Cleaning test coverage reports...
if exist "coverage" (
    rmdir /s /q "coverage" 2>nul
    echo   - Removed coverage/
)
if exist ".nyc_output" (
    rmdir /s /q ".nyc_output" 2>nul
    echo   - Removed .nyc_output/
)
del /s /q "lcov.info" 2>nul
del /s /q "coverage-final.json" 2>nul
echo   - Removed test coverage files

echo [5/16] Running Cargo clean...
cd src-tauri
where cargo >nul 2>nul
if %errorlevel% equ 0 (
    echo   - Running 'cargo clean' ^(this may take a moment^)...
    cargo clean
    if %errorlevel% equ 0 (
        echo   - Cargo clean completed successfully
    ) else (
        echo   - Warning: Cargo clean encountered an error
    )
) else (
    echo   - Warning: Cargo not found in PATH, skipping cargo clean
)
cd ..

echo [6/16] Cleaning remaining Rust/Tauri build artifacts...
if exist "src-tauri\target\.rustc_info.json" (
    del /q "src-tauri\target\.rustc_info.json" 2>nul
    echo   - Removed .rustc_info.json
)
if exist "src-tauri\target\CACHEDIR.TAG" (
    del /q "src-tauri\target\CACHEDIR.TAG" 2>nul
    echo   - Removed CACHEDIR.TAG
)
del /s /q "src-tauri\src\*.rs.bk" 2>nul
echo   - Removed Rust backup files

echo [7/16] Cleaning Tauri generated files...
if exist "src-tauri\gen" (
    rmdir /s /q "src-tauri\gen" 2>nul
    echo   - Removed src-tauri\gen/
)
if exist "src-tauri\.cargo" (
    rmdir /s /q "src-tauri\.cargo" 2>nul
    echo   - Removed src-tauri\.cargo/
)

echo [8/16] Cleaning WiX Toolset temporary files...
if exist "src-tauri\WixTools" (
    rmdir /s /q "src-tauri\WixTools" 2>nul
    echo   - Removed src-tauri\WixTools/
)
del /s /q "*.wixobj" 2>nul
del /s /q "*.wixpdb" 2>nul
del /s /q "*.wixlib" 2>nul
echo   - Removed WiX temporary files

echo [9/16] Cleaning installer artifacts...
del /q "*.msi" 2>nul
echo   - Removed *.msi files

echo [10/16] Cleaning log files...
del /s /q "*.log" 2>nul
del /s /q "npm-debug.log*" 2>nul
del /s /q "yarn-debug.log*" 2>nul
del /s /q "yarn-error.log*" 2>nul
if exist "logs" (
    rmdir /s /q "logs" 2>nul
    echo   - Removed logs/
)
echo   - Removed log files

echo [11/16] Cleaning TypeScript build info...
del /s /q "*.tsbuildinfo" 2>nul
echo   - Removed *.tsbuildinfo files

echo [12/16] Cleaning cache directories...
if exist ".cache" (
    rmdir /s /q ".cache" 2>nul
    echo   - Removed .cache/
)
if exist ".eslintcache" (
    del /q ".eslintcache" 2>nul
    echo   - Removed .eslintcache
)
if exist ".stylelintcache" (
    del /q ".stylelintcache" 2>nul
    echo   - Removed .stylelintcache
)
if exist ".turbo" (
    rmdir /s /q ".turbo" 2>nul
    echo   - Removed .turbo/
)
if exist ".parcel-cache" (
    rmdir /s /q ".parcel-cache" 2>nul
    echo   - Removed .parcel-cache/
)

echo [13/16] Cleaning OS temporary files...
del /s /q "Thumbs.db" 2>nul
del /s /q ".DS_Store" 2>nul
del /s /q "desktop.ini" 2>nul
echo   - Removed OS temporary files

echo [14/16] Cleaning editor temporary files...
del /q "*.tmp" 2>nul
del /q "*.temp" 2>nul
del /q "*.swp" 2>nul
del /q "*.swo" 2>nul
del /s /q "*.bak" 2>nul
del /s /q "*~" 2>nul
echo   - Removed editor temporary files

echo [15/16] Cleaning debug files...
del /q "*.pdb" 2>nul
del /q "*.dmp" 2>nul
if exist "debug_output.txt" (
    del /q "debug_output.txt" 2>nul
    echo   - Removed debug_output.txt
)
echo   - Removed debug files

echo [16/16] Cleaning environment files...
del /q ".env.local" 2>nul
del /q ".env.*.local" 2>nul
echo   - Removed local environment files

echo.
echo ====================================
echo Deep Clean Complete!
echo ====================================
echo.
echo All build artifacts, caches, and dependencies removed.
echo.
echo Preserved:
echo   + Source code (src/, src-tauri/src/)
echo   + Configuration files (*.json, *.toml, *.config.*)
echo   + Icons and static assets
echo   + Git repository (.git/)
echo   + Documentation (docs/, README.md)
echo.
echo Removed:
echo   - node_modules/ and package-lock.json
echo   - All Rust build outputs (via cargo clean)
echo   - All frontend build outputs (dist/, .vite)
echo   - All caches and temporary files
echo   - Test coverage reports
echo   - Log files
echo   - Installer artifacts
echo.
echo ====================================
echo Next Steps for Clean Rebuild:
echo ====================================
echo   1. npm install          (reinstall dependencies)
echo   2. build.bat            (build the application)
echo.

pause

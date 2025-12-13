@echo off
REM Build script for QuickConnect Tauri application
REM This script sets up the Visual Studio Build Tools environment and builds the app
REM
REM Usage: build.bat [options]
REM Options:
REM   /debug     - Build in debug mode (default: release)
REM   /clean     - Clean build artifacts before building
REM   /nopause   - Don't pause at the end

setlocal enabledelayedexpansion

REM Parse command line arguments
set BUILD_MODE=release
set CLEAN_BUILD=0
set PAUSE_AT_END=1

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="/debug" (
    set BUILD_MODE=debug
    shift
    goto :parse_args
)
if /i "%~1"=="/clean" (
    set CLEAN_BUILD=1
    shift
    goto :parse_args
)
if /i "%~1"=="/nopause" (
    set PAUSE_AT_END=0
    shift
    goto :parse_args
)
echo Warning: Unknown option "%~1"
shift
goto :parse_args

:args_done

echo ====================================
echo QuickConnect Build Script
echo ====================================
echo Build Mode: %BUILD_MODE%
echo.

REM Clean build if requested
if %CLEAN_BUILD%==1 (
    echo Running cleanup before build...
    call "%~dp0clean.bat"
    echo.
)

REM Try to find Visual Studio Build Tools
set VS_FOUND=0
set "VS_PATH_2022=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
set "VS_PATH_2022_ENTERPRISE=C:\Program Files\Microsoft Visual Studio\2022\Enterprise\Common7\Tools\VsDevCmd.bat"
set "VS_PATH_2022_PROFESSIONAL=C:\Program Files\Microsoft Visual Studio\2022\Professional\Common7\Tools\VsDevCmd.bat"
set "VS_PATH_2022_COMMUNITY=C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
set "VS_PATH_2019=C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\Common7\Tools\VsDevCmd.bat"

echo Setting up Visual Studio Build Tools environment...

if exist "%VS_PATH_2022%" (
    call "%VS_PATH_2022%" -arch=x64 -host_arch=x64
    set VS_FOUND=1
) else if exist "%VS_PATH_2022_ENTERPRISE%" (
    call "%VS_PATH_2022_ENTERPRISE%" -arch=x64 -host_arch=x64
    set VS_FOUND=1
) else if exist "%VS_PATH_2022_PROFESSIONAL%" (
    call "%VS_PATH_2022_PROFESSIONAL%" -arch=x64 -host_arch=x64
    set VS_FOUND=1
) else if exist "%VS_PATH_2022_COMMUNITY%" (
    call "%VS_PATH_2022_COMMUNITY%" -arch=x64 -host_arch=x64
    set VS_FOUND=1
) else if exist "%VS_PATH_2019%" (
    call "%VS_PATH_2019%" -arch=x64 -host_arch=x64
    set VS_FOUND=1
)

if %VS_FOUND%==0 (
    echo.
    echo ========================================
    echo ERROR: Visual Studio Build Tools not found!
    echo ========================================
    echo.
    echo Please install one of the following:
    echo   - Visual Studio 2022 Build Tools
    echo   - Visual Studio 2022 Community/Professional/Enterprise
    echo   - Visual Studio 2019 Build Tools
    echo.
    echo Download from: https://visualstudio.microsoft.com/downloads/
    echo.
    echo Required components:
    echo   - MSVC v142+ x64/x86 build tools
    echo   - Windows 10 SDK
    echo.
    if %PAUSE_AT_END%==1 pause
    exit /b 1
)

if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio Build Tools environment
    echo Please ensure Visual Studio Build Tools is properly installed.
    if %PAUSE_AT_END%==1 pause
    exit /b 1
)

echo Visual Studio Build Tools environment configured successfully!
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Warning: node_modules not found. Running npm install...
    npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed!
        if %PAUSE_AT_END%==1 pause
        exit /b 1
    )
    echo.
)

REM Run the appropriate build command
echo Building QuickConnect in %BUILD_MODE% mode...
echo.

if "%BUILD_MODE%"=="debug" (
    npm run tauri dev -- --no-watch
) else (
    npm run tauri build
)

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Build failed!
    echo ========================================
    echo.
    echo Common solutions:
    echo   1. Run with /clean option to do a clean build
    echo   2. Check that all dependencies are installed (npm install)
    echo   3. Ensure Rust toolchain is up to date (rustup update)
    echo   4. Check for any error messages above
    echo.
    if %PAUSE_AT_END%==1 pause
    exit /b 1
)

echo.
echo ====================================
echo Build completed successfully!
echo ====================================
echo.
if "%BUILD_MODE%"=="release" (
    echo Output files are in: src-tauri\target\release\bundle\
    echo.
    echo Installers:
    for %%f in (src-tauri\target\release\bundle\nsis\*.exe) do (
        echo   NSIS: %%f
    )
    for %%f in (src-tauri\target\release\bundle\msi\*.msi) do (
        echo   MSI:  %%f
    )
    echo.
    echo Executable: src-tauri\target\release\QuickConnect.exe
) else (
    echo Debug executable: src-tauri\target\debug\QuickConnect.exe
)
echo.

if %PAUSE_AT_END%==1 pause
endlocal


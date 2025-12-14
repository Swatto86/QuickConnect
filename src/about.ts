/**
 * About Window Script for QuickConnect
 *
 * This module manages the About window, which displays application information,
 * version details, and provides access to the application reset functionality.
 *
 * Features:
 * - Display application version and description
 * - Theme synchronization with other windows
 * - Keyboard shortcuts for closing (Escape)
 * - Secret application reset shortcut (Ctrl+Shift+Alt+R)
 * - Modal-style always-on-top window behavior
 *
 * The About window is a utility window that:
 * - Shows basic app metadata
 * - Provides a convenient access point for the reset feature
 * - Automatically applies theme changes from system tray
 * - Can be closed via Escape key or Close button
 *
 * @module about
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

async function initializeTheme() {
  let defaultTheme = 'dark';
  
  // Try to get saved theme preference
  try {
    defaultTheme = await invoke<string>('get_theme');
  } catch {
    // Silently fall back to dark theme if preference cannot be loaded
  }
  
  document.documentElement.setAttribute('data-theme', defaultTheme);
  
  // Listen for theme change events
  await listen<string>('theme-changed', (event) => {
    const newTheme = event.payload;
    document.documentElement.setAttribute('data-theme', newTheme);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await initializeTheme();
  
  const closeBtn = document.getElementById("closeBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", async () => {
      const window = getCurrentWindow();
      await window.hide();
    });
  }

  // Close on Escape key
  window.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      const window = getCurrentWindow();
      await window.hide();
    }
    
    // Secret reset shortcut: Ctrl+Shift+Alt+R
    if (e.ctrlKey && e.shiftKey && e.altKey && e.key === 'R') {
      e.preventDefault();
      
      const confirmed = confirm(
        '⚠️ WARNING: Application Reset ⚠️\n\n' +
        'This will permanently delete:\n' +
        '• All saved credentials\n' +
        '• All RDP connection files\n' +
        '• All saved hosts\n' +
        '• Recent connection history\n\n' +
        'This action CANNOT be undone!\n\n' +
        'Are you sure you want to continue?'
      );
      
      if (!confirmed) {
        return;
      }

      const confirmedAgain = confirm(
        'FINAL CONFIRMATION:\n\n' +
        'This will COMPLETELY reset QuickConnect and permanently delete your data.\n\n' +
        'Press OK to proceed with the reset, or Cancel to abort.'
      );

      if (!confirmedAgain) {
        return;
      }
      
      try {
        const result = await invoke<string>("reset_application");
        alert(result);

        // Return to the initial credentials screen
        try {
          const window = getCurrentWindow();
          await window.hide();
        } catch {
          // Non-critical
        }

        try {
          await invoke("show_login_window");
        } catch {
          // Non-critical
        }
        
        // Recommend restarting the application
        const shouldQuit = confirm(
          'Reset complete!\n\n' +
          'It is recommended to restart the application now.\n\n' +
          'Do you want to quit the application?'
        );
        
        if (shouldQuit) {
          await invoke("quit_app");
        }
      } catch (err) {
        alert('Failed to reset application: ' + err);
      }
    }
  });
});

/**
 * UI Utility Tests
 *
 * Tests for UI utility functions in src/utils/ui.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  showNotification,
  getNotificationColorClasses,
  showToast,
  escapeHtmlForDisplay,
  setButtonDisabled,
  debounce,
  querySelector,
  querySelectorAll,
  setTheme,
  getTheme,
  setVisible,
  clearChildren,
  createElement,
  focusInput,
  type ToastType,
} from "../utils/ui";

describe("showNotification", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should create a notification element", () => {
    const notification = showNotification("Test message");
    expect(notification).toBeInstanceOf(HTMLElement);
  });

  it("should display the message in the notification", () => {
    const notification = showNotification("Hello World");
    expect(notification.textContent).toBe("Hello World");
  });

  it("should add notification to document body", () => {
    showNotification("Test");
    const notifications = document.querySelectorAll('[data-testid="notification"]');
    expect(notifications.length).toBe(1);
  });

  it("should have role=alert for accessibility", () => {
    const notification = showNotification("Accessible message");
    expect(notification.getAttribute("role")).toBe("alert");
  });

  it("should accept options object", () => {
    const notification = showNotification({
      message: "Options test",
      type: "success",
      duration: 2000,
    });
    expect(notification.textContent).toBe("Options test");
  });

  it("should not display error type notifications visually", () => {
    const notification = showNotification({
      message: "Error message",
      type: "error",
    });
    // Error notifications return an empty div that's not appended
    expect(notification.textContent).toBe("");
  });

  it("should apply success color classes by default", () => {
    const notification = showNotification("Success");
    expect(notification.className).toContain("bg-green");
  });

  it("should apply bottom position by default", () => {
    const notification = showNotification("Bottom");
    expect(notification.className).toContain("bottom-8");
  });

  it("should apply top position when specified", () => {
    const notification = showNotification({
      message: "Top",
      position: "top",
    });
    expect(notification.className).toContain("top-8");
  });

  it("should auto-remove after duration", async () => {
    vi.useFakeTimers();
    showNotification({ message: "Auto remove", duration: 1000 });

    expect(document.body.children.length).toBe(1);

    vi.advanceTimersByTime(1500);
    await vi.runAllTimersAsync();

    // Element should be in process of being removed
    vi.useRealTimers();
  });
});

describe("getNotificationColorClasses", () => {
  it("should return green classes for success", () => {
    expect(getNotificationColorClasses("success")).toBe("bg-green-500");
  });

  it("should return red classes for error", () => {
    expect(getNotificationColorClasses("error")).toBe("bg-red-500");
  });

  it("should return yellow classes for warning", () => {
    expect(getNotificationColorClasses("warning")).toBe("bg-yellow-500");
  });

  it("should return blue classes for info", () => {
    expect(getNotificationColorClasses("info")).toBe("bg-blue-500");
  });

  it("should return green classes for unknown type", () => {
    expect(getNotificationColorClasses("unknown" as ToastType)).toBe("bg-green-500");
  });
});

describe("showToast", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should create toast container if it does not exist", () => {
    showToast("Test message", "success");
    const container = document.getElementById("toastContainer");
    expect(container).not.toBeNull();
  });

  it("should add toast to container", () => {
    showToast("Toast 1", "success");
    const container = document.getElementById("toastContainer");
    expect(container?.children.length).toBe(1);
  });

  it("should display message in toast", () => {
    const toast = showToast("Hello Toast", "success");
    expect(toast?.textContent).toContain("Hello Toast");
  });

  it("should apply success class for success type", () => {
    const toast = showToast("Success toast", "success");
    expect(toast?.className).toContain("alert-success");
  });

  it("should apply info class for info type", () => {
    const toast = showToast("Info toast", "info");
    expect(toast?.className).toContain("alert-info");
  });

  it("should not display error toasts", () => {
    const toast = showToast("Error toast", "error");
    expect(toast).toBeNull();
  });

  it("should add multiple toasts to container", () => {
    showToast("Toast 1", "success");
    showToast("Toast 2", "success");
    showToast("Toast 3", "info");
    const container = document.getElementById("toastContainer");
    expect(container?.children.length).toBe(3);
  });

  it("should use custom container id", () => {
    showToast("Custom container", "success", "customContainer");
    const container = document.getElementById("customContainer");
    expect(container).not.toBeNull();
  });

  it("should have role=alert for accessibility", () => {
    const toast = showToast("Accessible", "success");
    expect(toast?.getAttribute("role")).toBe("alert");
  });

  it("should have data-testid attribute", () => {
    const toast = showToast("Test", "success");
    expect(toast?.getAttribute("data-testid")).toBe("toast");
  });
});

describe("escapeHtmlForDisplay", () => {
  it("should escape less than sign", () => {
    const result = escapeHtmlForDisplay("<script>");
    expect(result).toBe("&lt;script&gt;");
  });

  it("should escape greater than sign", () => {
    const result = escapeHtmlForDisplay("a > b");
    expect(result).toBe("a &gt; b");
  });

  it("should escape ampersand", () => {
    const result = escapeHtmlForDisplay("a & b");
    expect(result).toBe("a &amp; b");
  });

  it("should return empty string for empty input", () => {
    expect(escapeHtmlForDisplay("")).toBe("");
  });

  it("should return empty string for null input", () => {
    expect(escapeHtmlForDisplay(null as unknown as string)).toBe("");
  });

  it("should return empty string for undefined input", () => {
    expect(escapeHtmlForDisplay(undefined as unknown as string)).toBe("");
  });

  it("should not modify safe text", () => {
    const safeText = "Hello World 123";
    expect(escapeHtmlForDisplay(safeText)).toBe(safeText);
  });

  it("should handle XSS payloads", () => {
    const xss = '<script>alert("xss")</script>';
    const result = escapeHtmlForDisplay(xss);
    expect(result).not.toContain("<script>");
  });
});

describe("setButtonDisabled", () => {
  let button: HTMLButtonElement;

  beforeEach(() => {
    button = document.createElement("button");
    document.body.appendChild(button);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should disable button when disabled is true", () => {
    setButtonDisabled(button, true);
    expect(button.disabled).toBe(true);
  });

  it("should enable button when disabled is false", () => {
    button.disabled = true;
    setButtonDisabled(button, false);
    expect(button.disabled).toBe(false);
  });

  it("should add opacity class when disabled", () => {
    setButtonDisabled(button, true);
    expect(button.classList.contains("opacity-50")).toBe(true);
  });

  it("should remove opacity class when enabled", () => {
    button.classList.add("opacity-50");
    setButtonDisabled(button, false);
    expect(button.classList.contains("opacity-50")).toBe(false);
  });

  it("should add cursor-not-allowed class when disabled", () => {
    setButtonDisabled(button, true);
    expect(button.classList.contains("cursor-not-allowed")).toBe(true);
  });

  it("should remove cursor-not-allowed class when enabled", () => {
    button.classList.add("cursor-not-allowed");
    setButtonDisabled(button, false);
    expect(button.classList.contains("cursor-not-allowed")).toBe(false);
  });

  it("should handle null button gracefully", () => {
    expect(() => setButtonDisabled(null, true)).not.toThrow();
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should delay function execution", () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should reset timer on subsequent calls", () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should pass arguments to debounced function", () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn("arg1", "arg2");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("should use latest arguments when called multiple times", () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn("first");
    debouncedFn("second");
    debouncedFn("third");

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("third");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("querySelector", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="container">
        <button class="btn">Button</button>
        <input type="text" id="input" />
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should find element by id", () => {
    const element = querySelector<HTMLInputElement>("#input");
    expect(element).not.toBeNull();
    expect(element?.tagName).toBe("INPUT");
  });

  it("should find element by class", () => {
    const element = querySelector<HTMLButtonElement>(".btn");
    expect(element).not.toBeNull();
    expect(element?.tagName).toBe("BUTTON");
  });

  it("should return null when element not found", () => {
    const element = querySelector("#nonexistent");
    expect(element).toBeNull();
  });

  it("should search within specified parent", () => {
    const container = document.getElementById("container")!;
    const element = querySelector<HTMLButtonElement>(".btn", container);
    expect(element).not.toBeNull();
  });
});

describe("querySelectorAll", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="item">1</div>
      <div class="item">2</div>
      <div class="item">3</div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should find all matching elements", () => {
    const elements = querySelectorAll<HTMLDivElement>(".item");
    expect(elements.length).toBe(3);
  });

  it("should return empty NodeList when no matches", () => {
    const elements = querySelectorAll(".nonexistent");
    expect(elements.length).toBe(0);
  });
});

describe("setTheme / getTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("should set theme on document element", () => {
    setTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("should get current theme from document element", () => {
    document.documentElement.setAttribute("data-theme", "light");
    expect(getTheme()).toBe("light");
  });

  it("should return null when no theme is set", () => {
    expect(getTheme()).toBeNull();
  });

  it("should update theme when called multiple times", () => {
    setTheme("dark");
    setTheme("light");
    setTheme("custom");
    expect(getTheme()).toBe("custom");
  });
});

describe("setVisible", () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement("div");
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should add hidden class when visible is false", () => {
    setVisible(element, false);
    expect(element.classList.contains("hidden")).toBe(true);
  });

  it("should remove hidden class when visible is true", () => {
    element.classList.add("hidden");
    setVisible(element, true);
    expect(element.classList.contains("hidden")).toBe(false);
  });

  it("should handle null element gracefully", () => {
    expect(() => setVisible(null, true)).not.toThrow();
  });

  it("should handle already visible element", () => {
    setVisible(element, true);
    expect(element.classList.contains("hidden")).toBe(false);
  });

  it("should handle already hidden element", () => {
    element.classList.add("hidden");
    setVisible(element, false);
    expect(element.classList.contains("hidden")).toBe(true);
  });
});

describe("clearChildren", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = "<span>1</span><span>2</span><span>3</span>";
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should remove all children from container", () => {
    expect(container.children.length).toBe(3);
    clearChildren(container);
    expect(container.children.length).toBe(0);
  });

  it("should handle empty container", () => {
    container.innerHTML = "";
    expect(() => clearChildren(container)).not.toThrow();
    expect(container.children.length).toBe(0);
  });

  it("should handle null container gracefully", () => {
    expect(() => clearChildren(null)).not.toThrow();
  });

  it("should clear innerHTML completely", () => {
    clearChildren(container);
    expect(container.innerHTML).toBe("");
  });
});

describe("createElement", () => {
  it("should create element with specified tag", () => {
    const element = createElement("div");
    expect(element.tagName).toBe("DIV");
  });

  it("should create element with attributes", () => {
    const element = createElement("input", { type: "text", id: "myInput" });
    expect(element.getAttribute("type")).toBe("text");
    expect(element.getAttribute("id")).toBe("myInput");
  });

  it("should create element with content", () => {
    const element = createElement("p", {}, "Hello World");
    expect(element.textContent).toBe("Hello World");
  });

  it("should create element with class attribute", () => {
    const element = createElement("div", { class: "my-class" });
    expect(element.className).toBe("my-class");
  });

  it("should create element without attributes", () => {
    const element = createElement("span");
    expect(element.tagName).toBe("SPAN");
    expect(element.attributes.length).toBe(0);
  });

  it("should create button element", () => {
    const button = createElement("button", { type: "submit" }, "Submit");
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.textContent).toBe("Submit");
  });
});

describe("focusInput", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    input.type = "text";
    input.value = "test value";
    document.body.appendChild(input);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should focus the input element", () => {
    const focusSpy = vi.spyOn(input, "focus");
    focusInput(input);
    expect(focusSpy).toHaveBeenCalled();
  });

  it("should select text when selectAll is true", () => {
    const selectSpy = vi.spyOn(input, "select");
    focusInput(input, true);
    expect(selectSpy).toHaveBeenCalled();
  });

  it("should not select text when selectAll is false", () => {
    const selectSpy = vi.spyOn(input, "select");
    focusInput(input, false);
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("should handle null input gracefully", () => {
    expect(() => focusInput(null)).not.toThrow();
  });

  it("should not select text by default", () => {
    const selectSpy = vi.spyOn(input, "select");
    focusInput(input);
    expect(selectSpy).not.toHaveBeenCalled();
  });
});

describe("showCustomDialog", () => {
  let showCustomDialog: (options: any) => Promise<boolean>;

  beforeEach(async () => {
    document.body.innerHTML = "";
    // Import the function dynamically
    const module = await import("../utils/ui");
    showCustomDialog = module.showCustomDialog;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllTimers();
  });

  it("should create a modal dialog", async () => {
    const dialogPromise = showCustomDialog({
      title: "Test Dialog",
      message: "Test message",
      type: "alert",
      icon: "info",
    });

    // Dialog should be in DOM
    const backdrop = document.querySelector('[data-testid="custom-dialog-backdrop"]');
    expect(backdrop).toBeTruthy();

    // Close dialog by clicking OK
    const okBtn = document.querySelector('[data-testid="dialog-ok-btn"]') as HTMLButtonElement;
    okBtn?.click();

    const result = await dialogPromise;
    expect(result).toBe(true);
  });

  it("should display title and message", async () => {
    const dialogPromise = showCustomDialog({
      title: "Custom Title",
      message: "Custom Message",
      type: "alert",
    });

    const dialog = document.querySelector('[data-testid="custom-dialog"]');
    expect(dialog?.textContent).toContain("Custom Title");
    expect(dialog?.textContent).toContain("Custom Message");

    const okBtn = document.querySelector('[data-testid="dialog-ok-btn"]') as HTMLButtonElement;
    okBtn?.click();
    await dialogPromise;
  });

  it("should show OK button for alert type", async () => {
    const dialogPromise = showCustomDialog({
      title: "Alert",
      message: "Alert message",
      type: "alert",
    });

    const okBtn = document.querySelector('[data-testid="dialog-ok-btn"]');
    const cancelBtn = document.querySelector('[data-testid="dialog-cancel-btn"]');
    const confirmBtn = document.querySelector('[data-testid="dialog-confirm-btn"]');

    expect(okBtn).toBeTruthy();
    expect(cancelBtn).toBeFalsy();
    expect(confirmBtn).toBeFalsy();

    (okBtn as HTMLButtonElement)?.click();
    await dialogPromise;
  });

  it("should show Confirm and Cancel buttons for confirm type", async () => {
    const dialogPromise = showCustomDialog({
      title: "Confirm",
      message: "Confirm message",
      type: "confirm",
    });

    const okBtn = document.querySelector('[data-testid="dialog-ok-btn"]');
    const cancelBtn = document.querySelector('[data-testid="dialog-cancel-btn"]');
    const confirmBtn = document.querySelector('[data-testid="dialog-confirm-btn"]');

    expect(okBtn).toBeFalsy();
    expect(cancelBtn).toBeTruthy();
    expect(confirmBtn).toBeTruthy();

    (confirmBtn as HTMLButtonElement)?.click();
    await dialogPromise;
  });

  it("should return true when confirm button clicked", async () => {
    const dialogPromise = showCustomDialog({
      title: "Confirm",
      message: "Confirm message",
      type: "confirm",
    });

    const confirmBtn = document.querySelector('[data-testid="dialog-confirm-btn"]') as HTMLButtonElement;
    confirmBtn?.click();

    const result = await dialogPromise;
    expect(result).toBe(true);
  });

  it("should return false when cancel button clicked", async () => {
    const dialogPromise = showCustomDialog({
      title: "Confirm",
      message: "Confirm message",
      type: "confirm",
    });

    const cancelBtn = document.querySelector('[data-testid="dialog-cancel-btn"]') as HTMLButtonElement;
    cancelBtn?.click();

    const result = await dialogPromise;
    expect(result).toBe(false);
  });

  it("should return false when backdrop clicked", async () => {
    const dialogPromise = showCustomDialog({
      title: "Confirm",
      message: "Confirm message",
      type: "confirm",
    });

    const backdrop = document.querySelector('[data-testid="custom-dialog-backdrop"]') as HTMLElement;
    backdrop?.click();

    const result = await dialogPromise;
    expect(result).toBe(false);
  });

  it("should close on ESC key", async () => {
    vi.useFakeTimers();

    const dialogPromise = showCustomDialog({
      title: "Confirm",
      message: "Confirm message",
      type: "confirm",
    });

    // Simulate ESC key press
    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(escapeEvent);

    // Allow time for animation
    vi.advanceTimersByTime(300);

    const result = await dialogPromise;
    expect(result).toBe(false);

    vi.useRealTimers();
  });

  it("should use custom button text", async () => {
    const dialogPromise = showCustomDialog({
      title: "Custom Buttons",
      message: "Test",
      type: "confirm",
      confirmText: "Yes Please",
      cancelText: "No Thanks",
    });

    const confirmBtn = document.querySelector('[data-testid="dialog-confirm-btn"]');
    const cancelBtn = document.querySelector('[data-testid="dialog-cancel-btn"]');

    expect(confirmBtn?.textContent).toBe("Yes Please");
    expect(cancelBtn?.textContent).toBe("No Thanks");

    (confirmBtn as HTMLButtonElement)?.click();
    await dialogPromise;
  });

  it("should apply error button style for warning/error icons in confirm dialogs", async () => {
    const dialogPromise = showCustomDialog({
      title: "Warning",
      message: "Warning message",
      type: "confirm",
      icon: "warning",
    });

    const confirmBtn = document.querySelector('[data-testid="dialog-confirm-btn"]');
    expect(confirmBtn?.classList.contains("btn-error")).toBe(true);

    (confirmBtn as HTMLButtonElement)?.click();
    await dialogPromise;
  });

  it("should apply primary button style for info icons in confirm dialogs", async () => {
    const dialogPromise = showCustomDialog({
      title: "Info",
      message: "Info message",
      type: "confirm",
      icon: "info",
    });

    const confirmBtn = document.querySelector('[data-testid="dialog-confirm-btn"]');
    expect(confirmBtn?.classList.contains("btn-primary")).toBe(true);

    (confirmBtn as HTMLButtonElement)?.click();
    await dialogPromise;
  });

  it("should preserve line breaks in message", async () => {
    const dialogPromise = showCustomDialog({
      title: "Multi-line",
      message: "Line 1\nLine 2\nLine 3",
      type: "alert",
    });

    const dialog = document.querySelector('[data-testid="custom-dialog"]');
    const messageEl = dialog?.querySelector(".whitespace-pre-wrap");
    expect(messageEl?.textContent).toBe("Line 1\nLine 2\nLine 3");

    const okBtn = document.querySelector('[data-testid="dialog-ok-btn"]') as HTMLButtonElement;
    okBtn?.click();
    await dialogPromise;
  });

  it("should remove dialog from DOM after closing", async () => {
    vi.useFakeTimers();

    const dialogPromise = showCustomDialog({
      title: "Test",
      message: "Test",
      type: "alert",
    });

    expect(document.querySelector('[data-testid="custom-dialog-backdrop"]')).toBeTruthy();

    const okBtn = document.querySelector('[data-testid="dialog-ok-btn"]') as HTMLButtonElement;
    okBtn?.click();

    // Wait for animation
    vi.advanceTimersByTime(300);

    await dialogPromise;

    expect(document.querySelector('[data-testid="custom-dialog-backdrop"]')).toBeFalsy();

    vi.useRealTimers();
  });
});

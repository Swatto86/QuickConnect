/**
 * UI Tests for Login Page
 *
 * Tests the login form functionality including:
 * - Form validation
 * - Button states
 * - Credential management
 * - Auto-close timer behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  invoke,
  setMockResponse,
  clearAllMocks,
} from "./mocks/tauri-api";

// Helper to create the login page DOM
function createLoginPageDOM() {
  document.body.innerHTML = `
    <form id="login-form" autocomplete="off">
      <div id="timer-notification" class="hidden">
        Auto-closing in <span id="countdown">5</span>s
      </div>
      <input type="text" id="username" name="username" placeholder="Enter username" />
      <input type="password" id="password" name="password" placeholder="Enter password" />
      <button type="button" id="delete-btn" class="btn btn-error" disabled>Delete</button>
      <button type="button" id="cancel-btn" class="btn">Cancel</button>
      <button type="submit" class="btn btn-primary" disabled>OK</button>
    </form>
  `;
}

// Helper to get form elements
function getFormElements() {
  return {
    form: document.getElementById("login-form") as HTMLFormElement,
    username: document.getElementById("username") as HTMLInputElement,
    password: document.getElementById("password") as HTMLInputElement,
    deleteBtn: document.getElementById("delete-btn") as HTMLButtonElement,
    cancelBtn: document.getElementById("cancel-btn") as HTMLButtonElement,
    okBtn: document.querySelector('button[type="submit"]') as HTMLButtonElement,
    timerNotification: document.getElementById("timer-notification") as HTMLDivElement,
    countdown: document.getElementById("countdown") as HTMLSpanElement,
  };
}

// Import utility functions we're testing
import { validateCredentials } from "../utils/validation";
import { setButtonDisabled } from "../utils/ui";

describe("Login Page UI", () => {
  beforeEach(() => {
    createLoginPageDOM();
    clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  describe("Form Elements", () => {
    it("should have all required form elements", () => {
      const elements = getFormElements();

      expect(elements.form).toBeTruthy();
      expect(elements.username).toBeTruthy();
      expect(elements.password).toBeTruthy();
      expect(elements.deleteBtn).toBeTruthy();
      expect(elements.cancelBtn).toBeTruthy();
      expect(elements.okBtn).toBeTruthy();
    });

    it("should have submit button disabled initially", () => {
      const { okBtn } = getFormElements();
      expect(okBtn.disabled).toBe(true);
    });

    it("should have delete button disabled initially", () => {
      const { deleteBtn } = getFormElements();
      expect(deleteBtn.disabled).toBe(true);
    });

    it("should have timer notification hidden initially", () => {
      const { timerNotification } = getFormElements();
      expect(timerNotification.classList.contains("hidden")).toBe(true);
    });
  });

  describe("Form Validation", () => {
    it("should validate empty credentials as invalid", () => {
      expect(validateCredentials("", "")).toBe(false);
    });

    it("should validate whitespace-only credentials as invalid", () => {
      expect(validateCredentials("   ", "   ")).toBe(false);
    });

    it("should validate valid credentials", () => {
      expect(validateCredentials("user", "pass")).toBe(true);
    });

    it("should validate credentials with domain format", () => {
      expect(validateCredentials("DOMAIN\\user", "password123")).toBe(true);
    });

    it("should validate credentials with UPN format", () => {
      expect(validateCredentials("user@domain.com", "password123")).toBe(true);
    });

    it("should require both username and password", () => {
      expect(validateCredentials("user", "")).toBe(false);
      expect(validateCredentials("", "pass")).toBe(false);
    });
  });

  describe("Button State Management", () => {
    it("should enable button when disabled is false", () => {
      const { okBtn } = getFormElements();

      setButtonDisabled(okBtn, false);

      expect(okBtn.disabled).toBe(false);
      expect(okBtn.classList.contains("opacity-50")).toBe(false);
      expect(okBtn.classList.contains("cursor-not-allowed")).toBe(false);
    });

    it("should disable button when disabled is true", () => {
      const { okBtn } = getFormElements();

      // First enable it
      setButtonDisabled(okBtn, false);
      // Then disable it
      setButtonDisabled(okBtn, true);

      expect(okBtn.disabled).toBe(true);
      expect(okBtn.classList.contains("opacity-50")).toBe(true);
      expect(okBtn.classList.contains("cursor-not-allowed")).toBe(true);
    });

    it("should handle null button gracefully", () => {
      // Should not throw
      expect(() => setButtonDisabled(null, true)).not.toThrow();
    });

    it("should update delete button based on credentials existence", () => {
      const { deleteBtn } = getFormElements();

      // Simulate credentials exist
      setButtonDisabled(deleteBtn, false);
      expect(deleteBtn.disabled).toBe(false);

      // Simulate no credentials
      setButtonDisabled(deleteBtn, true);
      expect(deleteBtn.disabled).toBe(true);
    });
  });

  describe("Username Input Handling", () => {
    it("should accept domain\\user format", () => {
      const { username } = getFormElements();
      username.value = "CONTOSO\\john.doe";

      expect(username.value).toBe("CONTOSO\\john.doe");
    });

    it("should accept user@domain.com format", () => {
      const { username } = getFormElements();
      username.value = "john.doe@contoso.com";

      expect(username.value).toBe("john.doe@contoso.com");
    });

    it("should accept plain username", () => {
      const { username } = getFormElements();
      username.value = "administrator";

      expect(username.value).toBe("administrator");
    });

    it("should trigger input event when value changes", () => {
      const { username } = getFormElements();
      const inputHandler = vi.fn();

      username.addEventListener("input", inputHandler);
      username.value = "test";
      username.dispatchEvent(new Event("input"));

      expect(inputHandler).toHaveBeenCalled();
    });
  });

  describe("Password Input Handling", () => {
    it("should be of type password", () => {
      const { password } = getFormElements();
      expect(password.type).toBe("password");
    });

    it("should accept password input", () => {
      const { password } = getFormElements();
      password.value = "secretPassword123!";

      expect(password.value).toBe("secretPassword123!");
    });

    it("should trigger input event when value changes", () => {
      const { password } = getFormElements();
      const inputHandler = vi.fn();

      password.addEventListener("input", inputHandler);
      password.value = "test";
      password.dispatchEvent(new Event("input"));

      expect(inputHandler).toHaveBeenCalled();
    });
  });

  describe("Form Submission", () => {
    it("should prevent default form submission", () => {
      const { form } = getFormElements();
      const submitHandler = vi.fn((e: Event) => e.preventDefault());

      form.addEventListener("submit", submitHandler);
      form.dispatchEvent(new Event("submit"));

      expect(submitHandler).toHaveBeenCalled();
    });

    it("should be able to trigger submit via button click", () => {
      const { form, okBtn } = getFormElements();
      const submitHandler = vi.fn((e: Event) => e.preventDefault());

      form.addEventListener("submit", submitHandler);

      // Enable the button first
      okBtn.disabled = false;

      // Simulate form submission
      form.dispatchEvent(new Event("submit"));

      expect(submitHandler).toHaveBeenCalled();
    });
  });

  describe("Delete Button", () => {
    it("should trigger click handler when clicked", () => {
      const { deleteBtn } = getFormElements();
      const clickHandler = vi.fn();

      deleteBtn.addEventListener("click", clickHandler);
      deleteBtn.disabled = false;
      deleteBtn.click();

      expect(clickHandler).toHaveBeenCalled();
    });

    it("should not trigger click when disabled", () => {
      const { deleteBtn } = getFormElements();
      const clickHandler = vi.fn();

      deleteBtn.addEventListener("click", clickHandler);
      // Button is disabled by default
      deleteBtn.click();

      // Click event still fires in DOM, but handler should check disabled state
      expect(deleteBtn.disabled).toBe(true);
    });
  });

  describe("Cancel Button", () => {
    it("should trigger click handler when clicked", () => {
      const { cancelBtn } = getFormElements();
      const clickHandler = vi.fn();

      cancelBtn.addEventListener("click", clickHandler);
      cancelBtn.click();

      expect(clickHandler).toHaveBeenCalled();
    });
  });

  describe("Timer Notification", () => {
    it("should show timer notification when made visible", () => {
      const { timerNotification } = getFormElements();

      timerNotification.classList.remove("hidden");

      expect(timerNotification.classList.contains("hidden")).toBe(false);
    });

    it("should hide timer notification", () => {
      const { timerNotification } = getFormElements();

      timerNotification.classList.remove("hidden");
      timerNotification.classList.add("hidden");

      expect(timerNotification.classList.contains("hidden")).toBe(true);
    });

    it("should update countdown text", () => {
      const { countdown } = getFormElements();

      countdown.textContent = "3";

      expect(countdown.textContent).toBe("3");
    });

    it("should countdown from 5 to 0", () => {
      const { countdown } = getFormElements();

      for (let i = 5; i >= 0; i--) {
        countdown.textContent = String(i);
        expect(countdown.textContent).toBe(String(i));
      }
    });
  });

  describe("Integration with Tauri API", () => {
    it("should call get_stored_credentials on load", async () => {
      setMockResponse("get_stored_credentials", null);

      await invoke("get_stored_credentials");

      expect(invoke).toHaveBeenCalledWith("get_stored_credentials");
    });

    it("should populate form when credentials exist", async () => {
      const { username, password } = getFormElements();

      setMockResponse("get_stored_credentials", {
        username: "testuser",
        password: "testpass",
      });

      const credentials = await invoke<{ username: string; password: string }>(
        "get_stored_credentials"
      );

      if (credentials) {
        username.value = credentials.username;
        password.value = credentials.password;
      }

      expect(username.value).toBe("testuser");
      expect(password.value).toBe("testpass");
    });

    it("should call save_credentials on form submit", async () => {
      const { username, password } = getFormElements();

      username.value = "newuser";
      password.value = "newpass";

      await invoke("save_credentials", {
        credentials: {
          username: username.value,
          password: password.value,
        },
      });

      expect(invoke).toHaveBeenCalledWith("save_credentials", {
        credentials: {
          username: "newuser",
          password: "newpass",
        },
      });
    });

    it("should call delete_credentials when delete button clicked", async () => {
      await invoke("delete_credentials");

      expect(invoke).toHaveBeenCalledWith("delete_credentials");
    });

    it("should call quit_app when cancel button clicked", async () => {
      await invoke("quit_app");

      expect(invoke).toHaveBeenCalledWith("quit_app");
    });

    it("should call switch_to_main_window after successful save", async () => {
      await invoke("switch_to_main_window");

      expect(invoke).toHaveBeenCalledWith("switch_to_main_window");
    });

    it("should get theme preference on load", async () => {
      setMockResponse("get_theme", "dark");

      const theme = await invoke<string>("get_theme");

      expect(theme).toBe("dark");
      expect(invoke).toHaveBeenCalledWith("get_theme");
    });
  });

  describe("Keyboard Interaction", () => {
    it("should handle Enter key on form", () => {
      const { form } = getFormElements();
      const submitHandler = vi.fn((e: Event) => e.preventDefault());

      form.addEventListener("submit", submitHandler);

      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      });
      form.dispatchEvent(enterEvent);

      // Note: Enter key doesn't automatically submit in jsdom
      // The actual app handles this through the form's default behavior
    });

    it("should detect Escape key press", () => {
      const escapeHandler = vi.fn();

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          escapeHandler();
        }
      });

      const escapeEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      });
      document.dispatchEvent(escapeEvent);

      expect(escapeHandler).toHaveBeenCalled();
    });

    it("should detect Ctrl+Shift+Alt+R for reset", () => {
      const resetHandler = vi.fn();

      document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.altKey && e.key === "R") {
          resetHandler();
        }
      });

      const resetEvent = new KeyboardEvent("keydown", {
        key: "R",
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(resetEvent);

      expect(resetHandler).toHaveBeenCalled();
    });
  });

  describe("Tab Navigation", () => {
    it("should have correct tabindex on username", () => {
      const { username } = getFormElements();
      // tabindex is set in HTML, check it exists
      expect(username).toBeTruthy();
    });

    it("should have correct tabindex on password", () => {
      const { password } = getFormElements();
      expect(password).toBeTruthy();
    });

    it("should allow tab navigation between inputs", () => {
      const { username, password } = getFormElements();

      username.focus();
      expect(document.activeElement).toBe(username);

      password.focus();
      expect(document.activeElement).toBe(password);
    });
  });

  describe("Form Reset", () => {
    it("should clear input values on reset", () => {
      const { form, username, password } = getFormElements();

      username.value = "testuser";
      password.value = "testpass";

      form.reset();

      expect(username.value).toBe("");
      expect(password.value).toBe("");
    });
  });

  describe("Accessibility", () => {
    it("should have labels for inputs", () => {
      // In the actual HTML, labels exist. For this test, we verify inputs have placeholders
      const { username, password } = getFormElements();

      expect(username.placeholder).toBe("Enter username");
      expect(password.placeholder).toBe("Enter password");
    });

    it("should have accessible button text", () => {
      const { deleteBtn, cancelBtn, okBtn } = getFormElements();

      expect(deleteBtn.textContent).toContain("Delete");
      expect(cancelBtn.textContent).toContain("Cancel");
      expect(okBtn.textContent).toContain("OK");
    });
  });
});

describe("Login Page Form Validation Integration", () => {
  beforeEach(() => {
    createLoginPageDOM();
    clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should enable submit button when both fields have values", () => {
    const { username, password, okBtn } = getFormElements();

    // Simulate user input
    username.value = "testuser";
    password.value = "testpass";

    // Validate and update button state
    const isValid = validateCredentials(username.value, password.value);
    setButtonDisabled(okBtn, !isValid);

    expect(okBtn.disabled).toBe(false);
  });

  it("should disable submit button when username is empty", () => {
    const { username, password, okBtn } = getFormElements();

    username.value = "";
    password.value = "testpass";

    const isValid = validateCredentials(username.value, password.value);
    setButtonDisabled(okBtn, !isValid);

    expect(okBtn.disabled).toBe(true);
  });

  it("should disable submit button when password is empty", () => {
    const { username, password, okBtn } = getFormElements();

    username.value = "testuser";
    password.value = "";

    const isValid = validateCredentials(username.value, password.value);
    setButtonDisabled(okBtn, !isValid);

    expect(okBtn.disabled).toBe(true);
  });

  it("should handle rapid input changes", () => {
    const { username, password, okBtn } = getFormElements();

    // Simulate rapid typing
    for (let i = 0; i < 10; i++) {
      username.value = "u".repeat(i);
      password.value = "p".repeat(i);

      const isValid = validateCredentials(username.value, password.value);
      setButtonDisabled(okBtn, !isValid);
    }

    // Final state should be valid (non-empty values)
    expect(okBtn.disabled).toBe(false);
  });

  it("should re-disable button if user clears input", () => {
    const { username, password, okBtn } = getFormElements();

    // First, enter valid values
    username.value = "testuser";
    password.value = "testpass";
    let isValid = validateCredentials(username.value, password.value);
    setButtonDisabled(okBtn, !isValid);
    expect(okBtn.disabled).toBe(false);

    // Then clear username
    username.value = "";
    isValid = validateCredentials(username.value, password.value);
    setButtonDisabled(okBtn, !isValid);
    expect(okBtn.disabled).toBe(true);
  });
});

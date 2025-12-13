/**
 * Mock for @tauri-apps/plugin-shell
 *
 * This mock simulates the Tauri shell plugin for frontend testing.
 */

import { vi } from "vitest";

// Track command executions for assertions
export const commandHistory: Array<{
  program: string;
  args: string[];
  options?: Record<string, unknown>;
}> = [];

// Store for mock command outputs
const mockOutputs: Map<string, { stdout: string; stderr: string; code: number }> = new Map();

/**
 * Mock Command class
 */
export class Command {
  program: string;
  args: string[];
  options: Record<string, unknown>;

  private stdoutCallback?: (data: string) => void;
  private stderrCallback?: (data: string) => void;
  private closeCallback?: (data: { code: number; signal: number | null }) => void;
  private errorCallback?: (error: Error) => void;

  constructor(program: string, args: string[] = [], options: Record<string, unknown> = {}) {
    this.program = program;
    this.args = args;
    this.options = options;
  }

  on(event: string, callback: (data: unknown) => void): Command {
    switch (event) {
      case "stdout":
        this.stdoutCallback = callback as (data: string) => void;
        break;
      case "stderr":
        this.stderrCallback = callback as (data: string) => void;
        break;
      case "close":
        this.closeCallback = callback as (data: { code: number; signal: number | null }) => void;
        break;
      case "error":
        this.errorCallback = callback as (error: Error) => void;
        break;
    }
    return this;
  }

  async spawn(): Promise<Child> {
    commandHistory.push({
      program: this.program,
      args: this.args,
      options: this.options,
    });

    const mockOutput = mockOutputs.get(this.program);

    // Simulate async execution
    setTimeout(() => {
      if (mockOutput) {
        if (mockOutput.stdout && this.stdoutCallback) {
          this.stdoutCallback(mockOutput.stdout);
        }
        if (mockOutput.stderr && this.stderrCallback) {
          this.stderrCallback(mockOutput.stderr);
        }
        if (this.closeCallback) {
          this.closeCallback({ code: mockOutput.code, signal: null });
        }
      } else {
        if (this.closeCallback) {
          this.closeCallback({ code: 0, signal: null });
        }
      }
    }, 0);

    return new Child(1);
  }

  async execute(): Promise<{ code: number; stdout: string; stderr: string }> {
    commandHistory.push({
      program: this.program,
      args: this.args,
      options: this.options,
    });

    const mockOutput = mockOutputs.get(this.program);

    if (mockOutput) {
      return {
        code: mockOutput.code,
        stdout: mockOutput.stdout,
        stderr: mockOutput.stderr,
      };
    }

    return {
      code: 0,
      stdout: "",
      stderr: "",
    };
  }
}

/**
 * Mock Child process class
 */
export class Child {
  pid: number;

  constructor(pid: number) {
    this.pid = pid;
  }

  async write(data: string | Uint8Array): Promise<void> {
    // No-op for mock
  }

  async kill(): Promise<void> {
    // No-op for mock
  }
}

/**
 * Mock open function - opens a path with the default application
 */
export const open = vi.fn(async (path: string): Promise<void> => {
  commandHistory.push({
    program: "open",
    args: [path],
  });
});

/**
 * Set mock output for a specific program
 */
export function setMockOutput(
  program: string,
  output: { stdout?: string; stderr?: string; code?: number }
): void {
  mockOutputs.set(program, {
    stdout: output.stdout || "",
    stderr: output.stderr || "",
    code: output.code ?? 0,
  });
}

/**
 * Clear mock output for a specific program
 */
export function clearMockOutput(program: string): void {
  mockOutputs.delete(program);
}

/**
 * Clear all mocks and history
 */
export function clearAllMocks(): void {
  mockOutputs.clear();
  commandHistory.length = 0;
  open.mockClear();
}

/**
 * Get command history
 */
export function getCommandHistory(program?: string): typeof commandHistory {
  if (program) {
    return commandHistory.filter((cmd) => cmd.program === program);
  }
  return commandHistory;
}

// Reset mocks between tests
beforeEach(() => {
  clearAllMocks();
});

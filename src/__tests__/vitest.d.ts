/// <reference types="vitest/globals" />

/**
 * Vitest Global Type Declarations
 *
 * This file provides TypeScript type declarations for Vitest globals
 * when using `globals: true` in vitest.config.ts
 */

declare global {
  // Vitest test functions
  const describe: typeof import('vitest')['describe'];
  const it: typeof import('vitest')['it'];
  const test: typeof import('vitest')['test'];
  const expect: typeof import('vitest')['expect'];

  // Vitest hooks
  const beforeAll: typeof import('vitest')['beforeAll'];
  const afterAll: typeof import('vitest')['afterAll'];
  const beforeEach: typeof import('vitest')['beforeEach'];
  const afterEach: typeof import('vitest')['afterEach'];

  // Vitest utilities
  const vi: typeof import('vitest')['vi'];
  const vitest: typeof import('vitest')['vitest'];

  // Additional matchers from @testing-library/jest-dom (if used)
  namespace Vi {
    interface Assertion {
      toBeInTheDocument(): void;
      toHaveClass(className: string): void;
      toHaveTextContent(text: string | RegExp): void;
      toBeVisible(): void;
      toBeDisabled(): void;
      toBeEnabled(): void;
      toHaveAttribute(attr: string, value?: string): void;
      toHaveValue(value: string | number | string[]): void;
      toBeChecked(): void;
      toHaveFocus(): void;
      toBeEmpty(): void;
      toContainElement(element: HTMLElement | null): void;
      toContainHTML(html: string): void;
      toHaveStyle(style: Record<string, unknown>): void;
    }
  }
}

export {};

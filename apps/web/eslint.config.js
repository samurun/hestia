import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  // Output of the Playwright e2e build and its reports.
  { ignores: [".next-e2e/**", "playwright-report/**", "test-results/**"] },
]

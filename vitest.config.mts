import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Testes do frontend: lógica pura (`*.test.ts`, ambiente node) e componentes (`*.test.tsx`, com
// `// @vitest-environment jsdom` no topo do arquivo). `npm test`; cobertura com `npm run test:coverage`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // JSX com o runtime automático do React (sem `import React` em cada componente), como o Next compila
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "fai-*/**", ".claude/**"],
    environment: "node",
    setupFiles: ["./test-utils/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "middleware.ts"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts", "lib/i18n/messages/**"],
      reporter: ["text-summary", "html", "json-summary"],
      reportsDirectory: "coverage",
    },
  },
});

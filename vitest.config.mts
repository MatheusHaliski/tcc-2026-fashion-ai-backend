import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Testes unitários do frontend (lógica pura: geometria do avatar 3D, qualidade da foto). `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["**/*.test.ts"], exclude: ["node_modules/**", ".next/**", "fai-*/**", ".claude/**"], environment: "node" },
});

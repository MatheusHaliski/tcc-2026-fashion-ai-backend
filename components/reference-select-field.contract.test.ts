import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

/**
 * Contrato dos campos de opções dos criadores: todos leem as opções pelo hook compartilhado, que manda a sessão. Um campo
 * novo que voltasse a chamar o próprio endpoint com `anonymous: true` travaria em 401 ("Tentar de novo" para sempre)
 * assim que o GET não estivesse em SecurityConfig.PUBLIC_GET — é isso que este teste impede.
 */
const ROOT = process.cwd();
const HOOK = "lib/hooks/use-reference-options.ts";

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) {
      if (!/node_modules|\.next|messages/.test(name)) sources(path, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(ROOT, join(ROOT, path)));
  }
  return out;
}

/** Só o código: comentários podem citar `anonymous: true` justamente para proibi-lo. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const files = ["app", "components", "lib"].flatMap(dir => sources(dir)).map(file => ({ file, text: code(readFileSync(join(ROOT, file), "utf8")) }));

it("only the shared hook fetches option catalogs (no field calls its endpoint by itself)", () => {
  const direct = files.filter(({ file, text }) => file !== HOOK && /api\.get\s*<\s*ReferenceOption\[\]\s*>/.test(text)).map(f => f.file);
  expect(direct).toEqual([]);
});

it("option catalogs are never read with anonymous: true", () => {
  const hook = files.find(f => f.file === HOOK);
  expect(hook?.text).toBeDefined();
  expect(hook?.text).not.toMatch(/anonymous\s*:/);
  const anonymous = files.filter(({ text }) => /anonymous\s*:\s*true/.test(text) && /\bReferenceOption\b|useReferenceOptions|ReferenceSelectField/.test(text));
  expect(anonymous.map(f => f.file)).toEqual([]);
});

it("creator form fields go through the shared component instead of calling the API", () => {
  const fields = files.filter(({ file }) => /^components\/.*-fields?\.tsx$/.test(file));
  expect(fields.map(f => f.file)).toEqual(expect.arrayContaining(["components/piece-colecao-field.tsx", "components/tipo-lavagem-field.tsx"]));
  const calling = fields.filter(({ text }) => /\bapi\.(get|post|put|patch|delete)\b/.test(text)).map(f => f.file);
  expect(calling).toEqual([]);
  const optionFields = fields.filter(({ text }) => /["'`]\/api\//.test(text));
  for (const { file, text } of optionFields) expect(text, file).toMatch(/ReferenceSelectField/);
});

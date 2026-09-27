import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Links para telas do app, vindos do backend (href/link/route nas respostas) ou escritos no front (href="/…"), têm de
 * apontar para uma rota que existe em app/. Pega a classe de erro de "/profile?tab=looks", "/my-wardrobe/room" e
 * "/add-piece" (404 ao tocar no botão).
 */
const ROOT = join(__dirname, "..");
const walk = (dir: string, ext: string, out: string[] = []): string[] => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === "node_modules" || f === ".next" || f === "target") continue;
    if (statSync(p).isDirectory()) walk(p, ext, out); else if (p.endsWith(ext)) out.push(p);
  }
  return out;
};
const routes = walk(join(ROOT, "app"), "page.tsx").map((p) => "/" + relative(join(ROOT, "app"), p).replace(/\\/g, "/").replace(/(^|\/)\([^)]+\)/g, "").replace(/\/?page\.tsx$/, "")).map((r) => r.replace(/^\/+/, "/") || "/");
const matchers = routes.map((r) => new RegExp("^" + r.replace(/\[[^\]]+\]/g, "[^/]+") + "/?$"));
const exists = (path: string) => matchers.some((m) => m.test(path.split(/[?#]/)[0]));
const IGNORE = /^\/(api|media|icons|assets|_next|_derived|users|defaults|public)\b/;

describe("links para telas do app", () => {
  it("todo href fixo do backend aponta para uma rota existente", () => {
    const bad: string[] = [];
    for (const f of [...walk(join(ROOT, "fai-application/src/main"), ".java"), ...walk(join(ROOT, "fai-web/src/main"), ".java")]) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/"(?:href|link|route)",\s*"(\/[^"]*)"(\s*\+)?/g)) {
          const path = m[1];
          if (IGNORE.test(path) || m[2]) continue;           // concatenado com um id: o prefixo é checado abaixo
          if (!exists(path)) bad.push(`${relative(ROOT, f)}:${i + 1} ${path}`);
        }
        for (const m of line.matchAll(/"(?:href|link|route)",\s*"(\/[^"]*\/)"\s*\+/g)) {
          if (!IGNORE.test(m[1]) && !exists(m[1] + "x")) bad.push(`${relative(ROOT, f)}:${i + 1} ${m[1]}…`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it("todo href fixo do front aponta para uma rota existente", () => {
    const bad: string[] = [];
    for (const f of [...walk(join(ROOT, "app"), ".tsx"), ...walk(join(ROOT, "components"), ".tsx")]) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/href="(\/[^"]*)"/g)) {
          if (!IGNORE.test(m[1]) && !exists(m[1])) bad.push(`${relative(ROOT, f)}:${i + 1} ${m[1]}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });
});

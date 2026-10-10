#!/usr/bin/env node
// Gera os SVGs finais dos ícones da Central FLAIR (public/flair/icons) a partir do catálogo lib/icons/flair-hub-icons.json.
// Um arquivo por modo e por estado (normal, selecionado, indisponível), com as cores do tema claro embutidas.
// Uso: node scripts/assets/flair-hub-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cat = JSON.parse(readFileSync(join(root, "lib/icons/flair-hub-icons.json"), "utf8"));
const out = join(root, "public/flair/icons");
mkdirSync(out, { recursive: true });

const STATES = {
  normal: { ink: "#191A19", bg: "none", ring: "none", dash: "" },
  selected: { ink: "#FFFFFF", bg: "#191A19", ring: "none", dash: "" },
  unavailable: { ink: "#6B6F66", bg: "none", ring: "#D8D6CC", dash: ' stroke-dasharray="3 2.4"' },
};

let n = 0;
for (const [id, icon] of Object.entries(cat.icons)) {
  for (const [state, c] of Object.entries(STATES)) {
    const ring = c.ring === "none" && c.bg === "none" ? "" : `<circle cx="20" cy="20" r="18.5" fill="${c.bg}" stroke="${c.ring}" stroke-width="1.5"${c.dash}/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" role="img" aria-label="${icon.title}">
  <title>${icon.title}</title>
  ${ring}
  <g transform="translate(8 8)" fill="none" stroke="${c.ink}" stroke-width="${cat.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${icon.markup.replaceAll("currentColor", c.ink)}</g>
</svg>
`;
    writeFileSync(join(out, `${id}-${state}.svg`), svg);
    n++;
  }
}
console.log(`${n} ícones escritos em public/flair/icons`);

// Chaves que o código do frontend chama literalmente com t("…") e que não existem no catálogo pt-BR.
// Um merge que resolve conflito nos JSON de tradução pode apagar chaves em uso sem quebrar o build; a tela passa a
// mostrar a chave crua. Esta verificação torna isso um erro do check.js (--fail), junto com a paridade entre idiomas.
const fs = require("fs");
const path = require("path");

const CALL = /\bt\(\s*["'`]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_\-]+)+)["'`]/g;

function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (!/node_modules|\.next|messages/.test(f)) walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(f) && !/\.test\./.test(f)) {
      out.push(p);
    }
  }
  return out;
}

/** Lista "arquivo: chave" para cada t("chave") literal ausente do catálogo. */
function missingReferencedKeys(root, catalog) {
  const missing = [];
  for (const d of ["app", "components", "lib"]) {
    for (const file of walk(path.join(root, d), [])) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(CALL)) {
        if (!(m[1] in catalog)) missing.push(`${path.relative(root, file)}: ${m[1]}`);
      }
    }
  }
  return [...new Set(missing)];
}

module.exports = { missingReferencedKeys };

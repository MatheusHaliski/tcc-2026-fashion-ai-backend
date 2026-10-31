/**
 * Lê uma folha de estilo-índice e devolve o texto com os trechos locais embutidos na ordem.
 * Só linhas inteiras `@import "./…";` (caminho relativo ao próprio arquivo, começando por ./) são substituídas
 * pelo conteúdo do arquivo importado (recursivo); `@import "tailwindcss"` e imports com ../ ficam como estão.
 * Uso: verificadores (check-design) e testes que inspecionam o CSS do site; CLI imprime o CSS embutido.
 */
const fs = require('node:fs');
const path = require('node:path');

const LOCAL_IMPORT = /^@import "(\.\/[^"]+\.css)";\n?$/;

function readCssBundle(file) {
  const text = fs.readFileSync(file, 'utf8');
  return text.split(/(?<=\n)/).map((line) => {
    const match = line.match(LOCAL_IMPORT);
    return match ? readCssBundle(path.join(path.dirname(file), match[1])) : line;
  }).join('');
}

module.exports = { readCssBundle };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('uso: node scripts/ux/css-bundle.cjs <arquivo.css>'); process.exit(2); }
  process.stdout.write(readCssBundle(file));
}

/**
 * Leitura de arquivos fora do alcance do rastreamento do Next (Turbopack/nft). O rastreador trata qualquer
 * `path.join(process.cwd(), "public", <dinâmico>)` como referência a arquivos e copia a pasta inteira para o bundle da
 * função — public/ levava 1,2 GB para cada deployment e engordava o Functions Storage da Vercel. Aqui nem o módulo
 * `fs` nem o diretório de trabalho são visíveis estaticamente; o que cada rota precisa de verdade entra explicitamente
 * por `outputFileTracingIncludes` no next.config.ts.
 */
export const untracedFs = process.getBuiltinModule("node:fs") as typeof import("node:fs");

/** Diretório de trabalho (o mesmo de process.cwd()) obtido em tempo de execução, invisível ao rastreador. */
export const projectRoot: string = untracedFs.realpathSync(".");

/**
 * Pasta public/ resolvida em tempo de execução. Não usar `path.join(projectRoot, "public", …)`: com a raiz opaca e o
 * literal "public" no meio, o rastreador passa a incluir todo caminho do projeto que contenha "public" (1 775 arquivos).
 */
export const publicRoot: string = (() => {
  try {
    return untracedFs.realpathSync("public");
  } catch {
    return [projectRoot, "public"].join("/");
  }
})();

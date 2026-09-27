/*
 * Deploy novo com a página aberta: o HTML e os scripts já carregados são de um build, mas um pedaço pedido depois
 * (import dinâmico, ex.: o visualizador 3D) só existia nesse build e o servidor agora responde 404 ("ChunkLoadError").
 * Recarregar a página busca o build atual. Para não entrar em laço, recarrega no máximo uma vez a cada 30 s.
 */
const KEY = "fai.chunk-reload-at";

export function isChunkLoadError(e: unknown): boolean {
  const err = e as { name?: string; message?: string } | null;
  const text = `${err?.name ?? ""} ${err?.message ?? String(e ?? "")}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(text);
}

/** Recarrega a página uma vez; devolve false se já recarregou há pouco (aí mostra a tela de erro). */
export function reloadOnceForChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* sem sessionStorage: recarrega mesmo assim */ }
  window.location.reload();
  return true;
}

/** Import dinâmico com uma nova tentativa (falha de rede passageira); se o pedaço sumiu, recarrega a página. */
export function retryImport<T>(load: () => Promise<T>, waitMs = 800): Promise<T> {
  return load().catch((e) => new Promise<T>((resolve, reject) => {
    setTimeout(() => load().then(resolve).catch((e2) => {
      if (isChunkLoadError(e2) && typeof window !== "undefined" && reloadOnceForChunk()) return;   // a página recarrega
      reject(e2 ?? e);
    }), waitMs);
  }));
}

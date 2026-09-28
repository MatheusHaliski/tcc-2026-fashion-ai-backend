/**
 * Destino interno seguro para ?next= (gate, login): só caminhos do próprio site. Recusa URL absoluta, "//host",
 * barra invertida e caracteres de controle — o navegador descarta \t, \r e \n ao montar a URL, e "/\t/evil.tld" viraria
 * "//evil.tld" (redirecionamento aberto). Sem dependências: usado no middleware (Edge), nas rotas e no cliente.
 */
const BASE = "https://interno.invalid";

export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return fallback;
  if (/[\u0000-\u001F\u007F\\]/.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

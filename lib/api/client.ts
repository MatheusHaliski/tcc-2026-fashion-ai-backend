/**
 * Cliente HTTP da API Fashion AI: JSON, Bearer JWT, renovação automática do access token e erros tipados.
 * Toda resposta de erro do backend tem o formato {status, code, message, details, path, timestamp, correlationId}.
 */
import { tr } from "@/lib/i18n/core";
import { acceptLanguage, getCurrentLocale } from "@/lib/i18n/state";
import PIECE_THUMBS from "@/lib/assets/piece-thumbs.json";
// NEXT_PUBLIC_API_BASE_URL vazia (definida em branco, não ausente) sem isto virava caminho relativo — a chamada caía
// na própria origem do frontend (Vercel) em vez do backend, com um 404 silencioso e sem pista do que faltava.
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
export const API_BASE = (RAW_API_BASE && RAW_API_BASE.trim() ? RAW_API_BASE : "http://localhost:8080").replace(/\/+$/, "");
if (!RAW_API_BASE?.trim() && process.env.NODE_ENV === "production" && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.error("NEXT_PUBLIC_API_BASE_URL não está configurada em produção: as chamadas à API vão falhar. Defina-a na Vercel e faça um novo deploy (é uma variável de build).");
}

/** Gate pelo Cloudflare Access: o cookie CF_Authorization do domínio da API precisa ir junto nas chamadas. */
const API_CREDENTIALS: RequestCredentials = process.env.NEXT_PUBLIC_GATE_MODE === "cloudflare" ? "include" : "same-origin";

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;
  correlationId?: string;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>, correlationId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details ?? {};
    this.correlationId = correlationId;
  }
  /** Mensagens por campo (erros 400/422 de validação). */
  get fields(): Record<string, string> {
    const f = this.details?.fields ?? this.details;
    return f && typeof f === "object" ? (f as Record<string, string>) : {};
  }
}

const KEYS = { user: "fai.user" } as const;
/** Onde versões antigas guardavam os tokens (migrados e apagados na primeira abertura). */
const LEGACY = { access: "fai.access", refresh: "fai.refresh" } as const;

/**
 * Sessão (RF2): o access token (15 min) vive só na memória desta aba; o refresh token fica num cookie HttpOnly gravado
 * pelo BFF do Next (/bff/auth/*) e nunca é visível ao JavaScript. Ao abrir o app, a sessão volta por /bff/auth/refresh.
 */
let accessToken: string | null = null;
const channel: BroadcastChannel | null = typeof window !== "undefined" && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("fai-auth") : null;
let sharedAt = 0;

export const tokenStore = {
  get access() { return accessToken; },
  set(access: string) {
    accessToken = access;
    sharedAt = Date.now();
    channel?.postMessage({ type: "access", token: access });   // outras abas passam a usar o token novo
  },
  clear() {
    accessToken = null;
    channel?.postMessage({ type: "logout" });
    try { [LEGACY.access, LEGACY.refresh, KEYS.user].forEach((k) => localStorage.removeItem(k)); } catch { /* sem storage */ }
  },
  /** Há sessão para restaurar? (cookie-sinal sem segredo gravado pelo BFF, ou refresh token antigo a migrar) */
  get restorable() {
    if (typeof document === "undefined") return false;
    if (/(?:^|;\s*)fai_rt_h=1/.test(document.cookie)) return true;
    try { return !!localStorage.getItem(LEGACY.refresh); } catch { return false; }
  },
  userKey: KEYS.user,
};

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
/** Chamado quando a sessão não pode ser renovada (logout global). */
export function onUnauthorized(l: Listener) { unauthorizedListeners.add(l); return () => unauthorizedListeners.delete(l); }

channel?.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as { type?: string; token?: string } | null;
  if (msg?.type === "access" && typeof msg.token === "string") { accessToken = msg.token; sharedAt = Date.now(); }
  if (msg?.type === "logout" && accessToken) { accessToken = null; unauthorizedListeners.forEach((l) => l()); }
});

/** Gate de desenvolvedor: o token curto de API (cookie fai_gate_a) vai ao backend no cabeçalho X-Dev-Gate. */
function gateHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const m = document.cookie.match(/(?:^|;\s*)fai_gate_a=([^;]+)/);
  return m ? { "X-Dev-Gate": decodeURIComponent(m[1]) } : {};
}

/** Pede ao Next um token de API novo do gate (vence em 1 h); false = o gate da página venceu ou a pessoa foi revogada. */
let renewingGate: Promise<boolean> | null = null;
function renewGate(): Promise<boolean> {
  if (!renewingGate) {
    renewingGate = fetch("/gate/renew", { method: "POST", cache: "no-store" }).then((r) => r.ok).catch(() => false)
      .finally(() => { renewingGate = null; });
  }
  return renewingGate;
}

/** Serializa a renovação entre abas (a rotação do refresh token invalida o anterior; duas abas juntas derrubariam a sessão). */
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  return locks ? locks.request("fai-auth-refresh", fn) : fn();
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  const startedAt = Date.now();
  refreshing = withRefreshLock(async () => {
    if (sharedAt > startedAt && accessToken) return true;       // outra aba renovou enquanto esperávamos a vez
    let legacy: string | null = null;
    try { legacy = localStorage.getItem(LEGACY.refresh); } catch { /* sem storage */ }
    try {
      const res = await fetch("/bff/auth/refresh", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(legacy ? { migrateRefreshToken: legacy } : {}),
      });
      if (legacy && res.status !== 502) { try { localStorage.removeItem(LEGACY.refresh); localStorage.removeItem(LEGACY.access); } catch { /* ignore */ } }
      if (!res.ok) return false;
      const s = await res.json();
      if (typeof s.accessToken !== "string") return false;
      tokenStore.set(s.accessToken);
      return true;
    } catch { return false; }
  }).finally(() => { refreshing = null; });
  return refreshing;
}

/** Restaura a sessão ao abrir o app (cookie HttpOnly → access token em memória). */
export async function restoreSession(): Promise<boolean> {
  if (accessToken) return true;
  if (!tokenStore.restorable) return false;
  return tryRefresh();
}

export interface RequestOptions {
  /** Não envia Authorization nem tenta renovar (rotas públicas). */
  anonymous?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    return new ApiError(body.status ?? res.status, body.code ?? "ERRO", body.message ?? res.statusText, body.details, body.correlationId);
  } catch {
    return new ApiError(res.status, res.status === 0 ? "OFFLINE" : "ERRO", res.status === 0 ? tr("errors.offline") : res.statusText);
  }
}

/** Caminhos da API vindos de parâmetros de rota: nada de "..", barra invertida ou caractere de controle. */
function checkPath(path: string) {
  const bare = path.split("?")[0];
  if (/[\u0000-\u001F\\]/.test(bare) || /(^|\/)(\.|%2e){2}(\/|$)/i.test(bare) || /%2f/i.test(bare)) {
    throw new ApiError(400, "CAMINHO_INVALIDO", tr("errors.network"));
  }
}

async function request<T>(method: string, path: string, body?: unknown, opts: RequestOptions = {}, retry = true, retryGate = true): Promise<T> {
  checkPath(path);
  const bff = path.startsWith("/bff/");
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": acceptLanguage(getCurrentLocale()), ...(bff ? {} : gateHeader()), ...(opts.headers ?? {}) };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const token = opts.anonymous ? null : tokenStore.access;
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(bff ? path : `${API_BASE}${path}`, {
      method, headers, body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body), signal: opts.signal,
      cache: bff ? "no-store" : undefined, credentials: bff ? "same-origin" : API_CREDENTIALS,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "OFFLINE", tr("errors.network"));
  }
  if (res.status === 401 && !opts.anonymous && retry && (token || tokenStore.restorable)) {
    const ok = await tryRefresh();
    if (ok) return request<T>(method, path, body, opts, false, retryGate);
    tokenStore.clear();
    unauthorizedListeners.forEach((l) => l());
  }
  // gate: o token curto da API venceu → renova pelo cookie da página e repete; se o gate da página venceu, volta a ele
  if (res.status === 403 && res.headers.get("X-Dev-Gate-Required") === "1" && typeof window !== "undefined") {
    if (retryGate && await renewGate()) return request<T>(method, path, body, opts, retry, false);
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    void fetch("/gate/verify", { method: "DELETE" }).finally(() => window.location.assign(`/?next=${next}`));
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.blob()) as T;
}

export const api = {
  get: <T,>(path: string, opts?: RequestOptions) => request<T>("GET", path, undefined, opts),
  post: <T,>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("POST", path, body ?? {}, opts),
  put: <T,>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PUT", path, body ?? {}, opts),
  patch: <T,>(path: string, body?: unknown, opts?: RequestOptions) => request<T>("PATCH", path, body ?? {}, opts),
  delete: <T,>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, undefined, opts),
  upload: <T,>(path: string, form: FormData, method: "POST" | "PUT" = "POST", opts?: RequestOptions) => request<T>(method, path, form, opts),
  /** Busca um binário autenticado (card.png privado, foto) e devolve uma object URL. */
  async blobUrl(path: string): Promise<string> {
    // imagens (card.png, exportações): o Accept padrão é JSON e o servidor responderia 406
    const blob = await request<Blob>("GET", path, undefined, { headers: { Accept: "image/png,image/*;q=0.9,*/*;q=0.8" } });
    return URL.createObjectURL(blob);
  },
};

/** Monta query string ignorando valores vazios. */
export function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)));
    else p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Resolve URLs de mídia/asset: relativas ao /public do frontend ou absolutas do backend. */
export function mediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/media/")) return `${API_BASE}${url}`;
  return url;
}

/**
 * Miniatura para cards: as imagens padrão de peça (PNG de até 2 MB em /public/assets_pecas) têm versões WebP de 320 e
 * 640 px (scripts/assets/piece-thumbs.py). Para as demais imagens devolve a própria URL.
 */
export function thumbUrl(url?: string | null, size: 320 | 640 = 640): string | undefined {
  if (!url) return undefined;
  const hit = (PIECE_THUMBS as Record<string, Record<string, string>>)[decodeURI(url.split("?")[0])];
  return hit?.[String(size)] ?? mediaUrl(url);
}
/** srcSet de 320/640 px quando a miniatura existe (o navegador escolhe pela largura e pela densidade da tela). */
export function thumbSrcSet(url?: string | null): string | undefined {
  if (!url) return undefined;
  const hit = (PIECE_THUMBS as Record<string, Record<string, string>>)[decodeURI(url.split("?")[0])];
  return hit ? `${hit["320"]} 320w, ${hit["640"]} 640w` : undefined;
}

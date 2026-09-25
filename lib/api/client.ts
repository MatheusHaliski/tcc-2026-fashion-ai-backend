/**
 * Cliente HTTP da API Fashion AI: JSON, Bearer JWT, renovação automática do access token e erros tipados.
 * Toda resposta de erro do backend tem o formato {status, code, message, details, path, timestamp, correlationId}.
 */
import { tr } from "@/lib/i18n/core";
import { acceptLanguage, getCurrentLocale } from "@/lib/i18n/state";
import PIECE_THUMBS from "@/lib/assets/piece-thumbs.json";
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");

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

const KEYS = { access: "fai.access", refresh: "fai.refresh", user: "fai.user" } as const;

export const tokenStore = {
  get access() { return typeof window === "undefined" ? null : localStorage.getItem(KEYS.access); },
  get refresh() { return typeof window === "undefined" ? null : localStorage.getItem(KEYS.refresh); },
  set(access: string, refresh?: string | null) {
    localStorage.setItem(KEYS.access, access);
    if (refresh) localStorage.setItem(KEYS.refresh, refresh);
  },
  clear() { [KEYS.access, KEYS.refresh, KEYS.user].forEach((k) => localStorage.removeItem(k)); },
  userKey: KEYS.user,
};

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
/** Chamado quando a sessão não pode ser renovada (logout global). */
export function onUnauthorized(l: Listener) { unauthorizedListeners.add(l); return () => unauthorizedListeners.delete(l); }

/** Gate de desenvolvedor: a cópia legível do token do /gate vai ao backend no cabeçalho X-Dev-Gate. */
function gateHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const m = document.cookie.match(/(?:^|;\s*)fai_gate_h=([^;]+)/);
  return m ? { "X-Dev-Gate": decodeURIComponent(m[1]) } : {};
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refresh = tokenStore.refresh;
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json", ...gateHeader() }, body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      const s = await res.json();
      tokenStore.set(s.accessToken, s.refreshToken);
      return true;
    } catch { return false; } finally { refreshing = null; }
  })();
  return refreshing;
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

async function request<T>(method: string, path: string, body?: unknown, opts: RequestOptions = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": acceptLanguage(getCurrentLocale()), ...gateHeader(), ...(opts.headers ?? {}) };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const token = opts.anonymous ? null : tokenStore.access;
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body), signal: opts.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "OFFLINE", tr("errors.network"));
  }
  if (res.status === 401 && !opts.anonymous && retry && tokenStore.refresh) {
    const ok = await tryRefresh();
    if (ok) return request<T>(method, path, body, opts, false);
    tokenStore.clear();
    unauthorizedListeners.forEach((l) => l());
  }
  // gate expirado ou ausente no backend: volta para o /gate e retorna à página atual depois
  if (res.status === 403 && res.headers.get("X-Dev-Gate-Required") === "1" && typeof window !== "undefined") {
    window.location.assign(`/gate?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
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
  upload: <T,>(path: string, form: FormData, method: "POST" | "PUT" = "POST") => request<T>(method, path, form),
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

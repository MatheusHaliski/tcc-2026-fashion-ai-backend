/**
 * Gate de desenvolvedor (antes do lançamento público): um token HMAC-SHA256 assinado com DEV_GATE_SECRET, no formato
 * `v1.<usuário>.<expira-em-segundos>.<assinatura base64url>`. O mesmo token vai em dois cookies: `fai_gate` (HttpOnly,
 * lido pelo middleware do Next) e `fai_gate_h` (lido pelo cliente da API e enviado ao backend no cabeçalho X-Dev-Gate,
 * que o DevGateFilter confere com o mesmo segredo). Roda no Edge e no Node: só Web Crypto, sem dependências.
 */
export const GATE_COOKIE = "fai_gate";
export const GATE_HEADER_COOKIE = "fai_gate_h";
export const GATE_HEADER = "X-Dev-Gate";
export const GATE_TTL_SECONDS = 12 * 60 * 60;

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Comparação em tempo constante (o tamanho não é segredo: as assinaturas e hashes têm tamanho fixo). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const GATE_GOOGLE_COOKIE = "fai_gate_g";      // 1º fator concluído (conta Google autorizada), 15 min
export const GATE_OAUTH_COOKIE = "fai_gate_oauth";    // state + nonce + PKCE do login Google em andamento, 10 min

export interface GateConfig {
  enabled: boolean; user: string; pinHash: string | null; secret: string | null;
  /** 1º fator: login Google (padrão). DEV_GATE_GOOGLE=false volta para usuário + PIN. */
  google: boolean; googleClientId: string | null; googleClientSecret: string | null;
  /** Contas Google autorizadas (e-mails separados por vírgula). Vazio = ninguém entra. */
  allowedEmails: string[];
  /** URL pública do app (para o redirect do Google); sem ela, usa a origem da requisição. */
  publicUrl: string | null;
}

/**
 * Lê a configuração das variáveis de ambiente do servidor (nunca do navegador). O gate fica LIGADO por padrão: só
 * DEV_GATE_ENABLED=false o desliga. O PIN nunca fica no código: DEV_GATE_PIN_HASH (SHA-256 em hexadecimal, preferido)
 * ou DEV_GATE_PIN. Sem PIN ou sem segredo o gate falha fechado (ninguém entra).
 */
export async function gateConfig(): Promise<GateConfig> {
  const enabled = (process.env.DEV_GATE_ENABLED ?? "true").toLowerCase() !== "false";
  const user = (process.env.DEV_GATE_USER ?? "matheushaliskitcc20233").trim();
  const rawPin = process.env.DEV_GATE_PIN?.trim();
  const pinHash = process.env.DEV_GATE_PIN_HASH?.trim().toLowerCase() || (rawPin ? await sha256Hex(rawPin) : null);
  const secret = process.env.DEV_GATE_SECRET?.trim() || null;
  const google = (process.env.DEV_GATE_GOOGLE ?? "true").toLowerCase() !== "false";
  const allowedEmails = (process.env.DEV_GATE_ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return {
    enabled, user, pinHash, secret, google,
    googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || null,
    googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || null,
    allowedEmails, publicUrl: process.env.DEV_GATE_PUBLIC_URL?.trim().replace(/\/+$/, "") || null,
  };
}

/** Token curto genérico assinado: `<tipo>.<dados base64url>.<expira>.<assinatura>`. */
export async function signValue(kind: string, value: string, secret: string, ttl: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${kind}.${b64url(enc.encode(value).buffer as ArrayBuffer)}.${exp}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyValue(kind: string, token: string | undefined | null, secret: string | null): Promise<string | null> {
  if (!token || !secret) return null;
  const p = token.split(".");
  if (p.length !== 4 || p[0] !== kind) return null;
  const exp = Number(p[2]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  if (!safeEqual(p[3], await hmac(secret, `${p[0]}.${p[1]}.${p[2]}`))) return null;
  try { return new TextDecoder().decode(Uint8Array.from(atob(p[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))); } catch { return null; }
}

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return b64url(a.buffer as ArrayBuffer);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(verifier)));
}

export async function signGate(user: string, secret: string, ttl = GATE_TTL_SECONDS): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = `v1.${user}.${exp}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyGate(token: string | undefined | null, secret: string | null, user: string): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || parts[1] !== user) return false;
  const exp = Number(parts[2]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(parts[3], await hmac(secret, `v1.${parts[1]}.${parts[2]}`));
}

/** Só caminhos internos: evita redirecionamento aberto (//evil.com, https://…). */
export function safeNext(next: unknown): string {
  const n = typeof next === "string" ? next : "/";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/";
}

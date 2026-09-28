/**
 * Gate de desenvolvedor (antes do lançamento público). Dois modos (DEV_GATE_MODE):
 *
 * - "builtin" (padrão): login Google (conta de DEV_GATE_ALLOWED_EMAILS) + PIN. Tokens HMAC-SHA256 assinados com
 *   DEV_GATE_SECRET no formato `<tipo>.<json base64url>.<expira-em-segundos>.<assinatura base64url>`, onde o JSON é
 *   `{"i": identidade, "j": id da entrada}` — a identidade é o e-mail Google (ou DEV_GATE_USER sem Google). Dois tipos:
 *     · "gp" (página): cookie `fai_gate`, HttpOnly, 12 h, lido só pelo middleware e pelas rotas do servidor;
 *     · "ga" (API): cookie `fai_gate_a`, legível pelo cliente, 1 h, vai ao backend no cabeçalho X-Dev-Gate (o
 *       DevGateFilter confere com o mesmo segredo). Um "ga" roubado não abre páginas e vence em até 1 h.
 *   A identidade é conferida contra a lista atual a cada requisição: tirar um e-mail da lista revoga aquela pessoa na
 *   hora, sem trocar o segredo de todo mundo.
 * - "cloudflare": o Cloudflare Access (Zero Trust) faz o login; o middleware e o backend conferem o JWT do Access
 *   (RS256 pelas chaves públicas da equipe, audiência CF_ACCESS_AUD). Sem tela /gate.
 *
 * Roda no Edge e no Node: só Web Crypto, sem dependências.
 */
export { safeNext } from "@/lib/safe-next";

export const GATE_COOKIE = "fai_gate";                // tipo "gp", HttpOnly
export const GATE_API_COOKIE = "fai_gate_a";          // tipo "ga", legível pelo cliente da API
export const GATE_HEADER = "X-Dev-Gate";
export const GATE_TTL_SECONDS = 12 * 60 * 60;
export const GATE_API_TTL_SECONDS = 60 * 60;
/** O middleware renova o token de API quando faltam menos de 20 minutos. */
export const GATE_API_RENEW_BEFORE_SECONDS = 20 * 60;
export const GATE_GOOGLE_COOKIE = "fai_gate_g";      // 1º fator concluído (conta Google autorizada), 15 min
export const GATE_OAUTH_COOKIE = "fai_gate_oauth";    // state + nonce + PKCE do login Google em andamento, 10 min
/** Segredo HMAC mais curto que isto conta como ausente (o gate falha fechado). */
export const MIN_SECRET_LENGTH = 32;
/** PIN em texto (DEV_GATE_PIN) mais curto que isto conta como ausente; com hash, a equipe garante o tamanho. */
export const MIN_PIN_LENGTH = 8;

export type GateKind = "gp" | "ga";
export interface GateIdentity { id: string; jti: string; exp: number }

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA256 em base64url sem padding (mesmo formato do DevGateFilter e do ClientIpResolver do backend). */
export async function hmacB64url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Comparação em tempo constante (o tamanho não é segredo: as assinaturas e hashes têm tamanho fixo). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface GateConfig {
  enabled: boolean; mode: "builtin" | "cloudflare"; user: string; pinHash: string | null; secret: string | null;
  /** 1º fator: login Google (padrão). DEV_GATE_GOOGLE=false volta para usuário + PIN. */
  google: boolean; googleClientId: string | null; googleClientSecret: string | null;
  /** Contas Google autorizadas (e-mails separados por vírgula). Vazio = ninguém entra. */
  allowedEmails: string[];
  /** URL pública do app (para o redirect do Google); sem ela, usa a origem da requisição. */
  publicUrl: string | null;
  /** Modo "cloudflare": domínio da equipe (ex.: fashionai.cloudflareaccess.com) e AUD da aplicação do Access. */
  cloudflare: { teamDomain: string | null; aud: string | null };
}

/**
 * Lê a configuração das variáveis de ambiente do servidor (nunca do navegador). O gate fica LIGADO por padrão: só
 * DEV_GATE_ENABLED=false o desliga. O PIN nunca fica no código: DEV_GATE_PIN_HASH (SHA-256 em hexadecimal, preferido)
 * ou DEV_GATE_PIN (mínimo de 8 caracteres). Sem PIN ou com segredo ausente/curto o gate falha fechado (ninguém entra).
 */
export async function gateConfig(): Promise<GateConfig> {
  const enabled = (process.env.DEV_GATE_ENABLED ?? "true").toLowerCase() !== "false";
  const mode = (process.env.DEV_GATE_MODE ?? "builtin").trim().toLowerCase() === "cloudflare" ? "cloudflare" : "builtin";
  const user = (process.env.DEV_GATE_USER ?? "matheushaliskitcc20233").trim();
  const rawPin = process.env.DEV_GATE_PIN?.trim();
  const pinHash = process.env.DEV_GATE_PIN_HASH?.trim().toLowerCase()
    || (rawPin && rawPin.length >= MIN_PIN_LENGTH ? await sha256Hex(rawPin) : null);
  const rawSecret = process.env.DEV_GATE_SECRET?.trim() ?? "";
  const secret = rawSecret.length >= MIN_SECRET_LENGTH ? rawSecret : null;
  const google = (process.env.DEV_GATE_GOOGLE ?? "true").toLowerCase() !== "false";
  const allowedEmails = (process.env.DEV_GATE_ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return {
    enabled, mode, user, pinHash, secret, google,
    googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || null,
    googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || null,
    allowedEmails, publicUrl: process.env.DEV_GATE_PUBLIC_URL?.trim().replace(/\/+$/, "") || null,
    cloudflare: {
      teamDomain: process.env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") || null,
      aud: process.env.CF_ACCESS_AUD?.trim() || null,
    },
  };
}

/** Identidade que o gate aceita agora: e-mail da lista (modo Google) ou o usuário da equipe (sem Google). */
export function identityAllowed(cfg: GateConfig, id: string): boolean {
  const who = id.trim().toLowerCase();
  if (!who) return false;
  if (cfg.mode === "cloudflare") return cfg.allowedEmails.length === 0 || cfg.allowedEmails.includes(who);
  return cfg.google ? cfg.allowedEmails.includes(who) : who === cfg.user.toLowerCase();
}

/** Token curto genérico assinado: `<tipo>.<dados base64url>.<expira>.<assinatura>`. */
export async function signValue(kind: string, value: string, secret: string, ttl: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${kind}.${b64url(enc.encode(value).buffer as ArrayBuffer)}.${exp}`;
  return `${payload}.${await hmacB64url(secret, payload)}`;
}

async function verifyValueWithExp(kind: string, token: string | undefined | null, secret: string | null): Promise<{ value: string; exp: number } | null> {
  if (!token || !secret) return null;
  const p = token.split(".");
  if (p.length !== 4 || p[0] !== kind) return null;
  const exp = Number(p[2]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  if (!safeEqual(p[3], await hmacB64url(secret, `${p[0]}.${p[1]}.${p[2]}`))) return null;
  try { return { value: new TextDecoder().decode(fromB64url(p[1])), exp }; } catch { return null; }
}

export async function verifyValue(kind: string, token: string | undefined | null, secret: string | null): Promise<string | null> {
  return (await verifyValueWithExp(kind, token, secret))?.value ?? null;
}

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return b64url(a.buffer as ArrayBuffer);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(verifier)));
}

/** Assina um token do gate para uma identidade ("gp" = página, "ga" = API). */
export async function signGate(kind: GateKind, id: string, jti: string, secret: string, ttl = kind === "gp" ? GATE_TTL_SECONDS : GATE_API_TTL_SECONDS): Promise<string> {
  return signValue(kind, JSON.stringify({ i: id.trim().toLowerCase(), j: jti }), secret, ttl);
}

/** Confere tipo, assinatura, validade e se a identidade ainda está autorizada. */
export async function verifyGate(kind: GateKind, token: string | undefined | null, cfg: GateConfig): Promise<GateIdentity | null> {
  const v = await verifyValueWithExp(kind, token, cfg.secret);
  if (!v) return null;
  try {
    const data = JSON.parse(v.value) as { i?: unknown; j?: unknown };
    if (typeof data.i !== "string" || typeof data.j !== "string" || !identityAllowed(cfg, data.i)) return null;
    return { id: data.i, jti: data.j, exp: v.exp };
  } catch { return null; }
}

/** Validade (epoch em segundos) de um token assinado, sem conferir a assinatura — só para decidir a renovação. */
export function tokenExp(token: string | undefined | null): number | null {
  const exp = Number(token?.split(".")[2]);
  return Number.isFinite(exp) ? exp : null;
}

/** Oculta o e-mail nos logs de entrada ("ana@exemplo.com" → "an***@exemplo.com"). */
export function maskIdentity(id: string): string {
  const [name, domain] = id.split("@");
  return domain ? `${name.slice(0, 2)}***@${domain}` : `${id.slice(0, 2)}***`;
}

// ---------------------------------------------------------------------------------------------- Cloudflare Access

interface Jwk { kid?: string; kty: string; n?: string; e?: string; alg?: string }
let jwksCache: { url: string; keys: Jwk[]; at: number } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000;

async function cloudflareKeys(teamDomain: string, forceReload = false): Promise<Jwk[]> {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  if (!forceReload && jwksCache && jwksCache.url === url && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`JWKS ${r.status}`);
  const keys = ((await r.json()) as { keys?: Jwk[] }).keys ?? [];
  jwksCache = { url, keys, at: Date.now() };
  return keys;
}

/** Confere o JWT do Cloudflare Access (Cf-Access-Jwt-Assertion ou cookie CF_Authorization): RS256, emissor, audiência e validade. */
export async function verifyCloudflareAccess(jwt: string | undefined | null, cfg: GateConfig): Promise<GateIdentity | null> {
  const { teamDomain, aud } = cfg.cloudflare;
  if (!jwt || !teamDomain || !aud) return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(fromB64url(parts[0]))) as { alg?: string; kid?: string };
    if (header.alg !== "RS256") return null;
    let jwk = (await cloudflareKeys(teamDomain)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await cloudflareKeys(teamDomain, true)).find((k) => k.kid === header.kid);   // rotação de chave
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(parts[1]))) as { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string; sub?: string };
    const now = Math.floor(Date.now() / 1000);
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!auds.includes(aud) || claims.iss !== `https://${teamDomain}` || !claims.exp || claims.exp < now || (claims.nbf && claims.nbf > now + 60)) return null;
    const id = (claims.email ?? claims.sub ?? "").toLowerCase();
    if (!identityAllowed(cfg, id)) return null;
    return { id, jti: claims.sub ?? id, exp: claims.exp };
  } catch {
    return null;
  }
}

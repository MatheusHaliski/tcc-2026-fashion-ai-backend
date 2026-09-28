import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { apiTokenMatches, gateConfig, identityAllowed, signApiToken, signGate, signLegacyApiToken, signValue, tokenExp, verifyCloudflareAccess, verifyGate, type GateConfig } from "./token";
import { safeNext } from "@/lib/safe-next";

const SECRET = "segredo-de-teste-com-pelo-menos-32-caracteres";
const ENV = { ...process.env };

function cfg(over: Partial<GateConfig> = {}): GateConfig {
  return {
    enabled: true, mode: "builtin", apiToken: "v2", user: "equipe", pinHash: "x", secret: SECRET, google: true,
    googleClientId: null, googleClientSecret: null, allowedEmails: ["ana@exemplo.com"], publicUrl: null,
    cloudflare: { teamDomain: null, aud: null }, ...over,
  };
}

afterEach(() => { process.env = { ...ENV }; vi.unstubAllGlobals(); });

describe("safeNext", () => {
  it("aceita caminhos internos", () => {
    expect(safeNext("/feed")).toBe("/feed");
    expect(safeNext("/u/ana?tab=looks#x")).toBe("/u/ana?tab=looks#x");
  });
  it("recusa destinos externos, barra invertida e caracteres de controle", () => {
    for (const bad of ["https://evil.tld", "//evil.tld", "/\\evil.tld", "/\t/evil.tld", "/%09/evil.tld".replace("%09", "\t"), "/\n/evil.tld", "javascript:alert(1)", "", "feed"]) {
      expect(safeNext(bad)).toBe("/");
    }
    expect(safeNext("https://evil.tld", "/feed")).toBe("/feed");
    expect(safeNext(42)).toBe("/");
  });
});

describe("gateConfig", () => {
  it("segredo ou PIN curtos só geram aviso (não trancam a equipe fora); sem segredo, o gate fica fechado", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.DEV_GATE_SECRET = "curto";
    expect((await gateConfig()).secret).toBe("curto");
    delete process.env.DEV_GATE_SECRET;
    expect((await gateConfig()).secret).toBeNull();
    delete process.env.DEV_GATE_PIN_HASH;
    process.env.DEV_GATE_PIN = "1234";
    expect((await gateConfig()).pinHash).toMatch(/^[0-9a-f]{64}$/);
    warn.mockRestore();
  });
  it("token da API: formato antigo por padrão (transição), por pessoa com DEV_GATE_API_TOKEN=v2", async () => {
    delete process.env.DEV_GATE_API_TOKEN;
    expect((await gateConfig()).apiToken).toBe("legacy");
    process.env.DEV_GATE_API_TOKEN = "v2";
    expect((await gateConfig()).apiToken).toBe("v2");
  });
});

describe("token da API na transição", () => {
  it("formato antigo idêntico ao que a API em produção confere (v1.<usuário>.<expira>.<assinatura>)", async () => {
    vi.useFakeTimers(); vi.setSystemTime((1790345791 - 3600) * 1000);
    try {
      expect(await signLegacyApiToken("matheushaliskitcc20233", "segredo-de-teste"))
        .toBe("v1.matheushaliskitcc20233.1790345791.rCeGXFacw1O6AO8lYXTb4Mymjel43E8btNOyIJe_0ZE");
    } finally { vi.useRealTimers(); }
  });
  it("signApiToken segue o formato configurado e a troca de formato força renovação", async () => {
    const legacy = await signApiToken(cfg({ apiToken: "legacy" }), "ana@exemplo.com", "j");
    const v2 = await signApiToken(cfg({ apiToken: "v2" }), "ana@exemplo.com", "j");
    expect(legacy.startsWith("v1.equipe.")).toBe(true);
    expect(v2.startsWith("ga.")).toBe(true);
    expect(apiTokenMatches(cfg({ apiToken: "legacy" }), v2)).toBe(false);
    expect(apiTokenMatches(cfg({ apiToken: "v2" }), v2)).toBe(true);
  });
});

describe("tokens do gate por pessoa", () => {
  it("assina e confere a identidade e a entrada", async () => {
    const t = await signGate("gp", "Ana@Exemplo.com", "jti-1", SECRET);
    const who = await verifyGate("gp", t, cfg());
    expect(who?.id).toBe("ana@exemplo.com");
    expect(who?.jti).toBe("jti-1");
    expect(tokenExp(t)).toBe(who?.exp);
  });

  it("token de API não abre página e vice-versa", async () => {
    const api = await signGate("ga", "ana@exemplo.com", "j", SECRET);
    const page = await signGate("gp", "ana@exemplo.com", "j", SECRET);
    expect(await verifyGate("gp", api, cfg())).toBeNull();
    expect(await verifyGate("ga", page, cfg())).toBeNull();
    expect(await verifyGate("ga", api, cfg())).not.toBeNull();
  });

  it("tirar o e-mail da lista revoga na hora", async () => {
    const t = await signGate("gp", "ana@exemplo.com", "j", SECRET);
    expect(await verifyGate("gp", t, cfg({ allowedEmails: ["bia@exemplo.com"] }))).toBeNull();
  });

  it("recusa assinatura adulterada, segredo diferente e token vencido", async () => {
    const t = await signGate("gp", "ana@exemplo.com", "j", SECRET);
    const parts = t.split(".");
    expect(await verifyGate("gp", [parts[0], parts[1], String(Number(parts[2]) + 999), parts[3]].join("."), cfg())).toBeNull();
    expect(await verifyGate("gp", t, cfg({ secret: "outro-segredo-com-pelo-menos-32-caracteres!!" }))).toBeNull();
    const vencido = await signValue("gp", JSON.stringify({ i: "ana@exemplo.com", j: "j" }), SECRET, -10);
    expect(await verifyGate("gp", vencido, cfg())).toBeNull();
    expect(await verifyGate("gp", "v1.equipe.9999999999.assinatura", cfg())).toBeNull();
  });

  it("gera exatamente o token que o DevGateFilter (Java) confere", async () => {
    vi.useFakeTimers(); vi.setSystemTime((1790345791 - 3600) * 1000);
    try {
      expect(await signGate("ga", "ana@exemplo.com", "jti-teste", SECRET))
        .toBe("ga.eyJpIjoiYW5hQGV4ZW1wbG8uY29tIiwiaiI6Imp0aS10ZXN0ZSJ9.1790345791.SGqSCKhWgDHjH28hPBtrsFIKvGcVVDuSVKCkkeQcEpg");
    } finally { vi.useRealTimers(); }
  });

  it("sem Google, só o usuário da equipe entra", () => {
    const c = cfg({ google: false, allowedEmails: [] });
    expect(identityAllowed(c, "EQUIPE")).toBe(true);
    expect(identityAllowed(c, "ana@exemplo.com")).toBe(false);
  });
});

describe("Cloudflare Access", () => {
  const TEAM = "fashionai.cloudflareaccess.com";
  const AUD = "aud-da-aplicacao";
  let keys: CryptoKeyPair;
  let jwk: JsonWebKey;

  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  async function jwt(claims: Record<string, unknown>, kid = "k1", key = keys.privateKey): Promise<string> {
    const head = enc({ alg: "RS256", kid, typ: "JWT" }); const body = enc(claims);
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${Buffer.from(sig).toString("base64url")}`;
  }
  const base = () => ({ aud: [AUD], iss: `https://${TEAM}`, email: "ana@exemplo.com", sub: "u-1", exp: Math.floor(Date.now() / 1000) + 600 });

  beforeAll(async () => {   // um par só: as chaves públicas ficam em cache no módulo, como em produção
    keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
    jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "k1" } as JsonWebKey;
  });
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }))); });

  const cf = (over: Partial<GateConfig> = {}) => cfg({ mode: "cloudflare", cloudflare: { teamDomain: TEAM, aud: AUD }, ...over });

  it("aceita o JWT do Access com emissor, audiência e validade corretos", async () => {
    const who = await verifyCloudflareAccess(await jwt(base()), cf());
    expect(who?.id).toBe("ana@exemplo.com");
  });

  it("recusa audiência, emissor, validade, e-mail fora da lista e assinatura de outra chave", async () => {
    expect(await verifyCloudflareAccess(await jwt({ ...base(), aud: ["outra"] }), cf())).toBeNull();
    expect(await verifyCloudflareAccess(await jwt({ ...base(), iss: "https://evil.cloudflareaccess.com" }), cf())).toBeNull();
    expect(await verifyCloudflareAccess(await jwt({ ...base(), exp: 10 }), cf())).toBeNull();
    expect(await verifyCloudflareAccess(await jwt({ ...base(), email: "intruso@exemplo.com" }), cf())).toBeNull();
    const other = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
    expect(await verifyCloudflareAccess(await jwt(base(), "k1", other.privateKey), cf())).toBeNull();
    expect(await verifyCloudflareAccess("a.b", cf())).toBeNull();
    expect(await verifyCloudflareAccess(await jwt(base()), cf({ cloudflare: { teamDomain: TEAM, aud: null } }))).toBeNull();
  });

  it("lista vazia no modo Cloudflare: vale a política do próprio Access", async () => {
    expect(await verifyCloudflareAccess(await jwt({ ...base(), email: "qualquer@exemplo.com" }), cf({ allowedEmails: [] }))).not.toBeNull();
  });
});

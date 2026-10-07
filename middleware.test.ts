/**
 * Middleware (segurança): gate de desenvolvedor e CSP com nonce em toda requisição. Sem o cookie assinado, as páginas
 * voltam para "/" (que é o próprio gate), o BFF responde 403 e, no modo Cloudflare, nada aparece; com o cookie válido,
 * passa, ganha a CSP e o token curto da API é renovado.
 */
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { GATE_API_COOKIE, GATE_COOKIE, signGate } from "@/lib/gate/token";

const ENV = { ...process.env };
const SECRET = "segredo-de-teste-com-mais-de-32-caracteres-ok";
afterEach(() => { process.env = { ...ENV }; });

function gateOn(mode: "builtin" | "cloudflare" = "builtin") {
  Object.assign(process.env, { DEV_GATE_ENABLED: "true", DEV_GATE_MODE: mode, DEV_GATE_SECRET: SECRET, DEV_GATE_GOOGLE: "true", DEV_GATE_ALLOWED_EMAILS: "ana@example.com" });
}
const req = (path: string, cookies: Record<string, string> = {}) =>
  new NextRequest(new URL(path, "http://localhost:3000"), { headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") } });

describe("middleware: gate e CSP", () => {
  it("gate desligado: passa tudo, com CSP de nonce e sem noindex", async () => {
    process.env.DEV_GATE_ENABLED = "false";
    const res = await middleware(req("/closet"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Security-Policy")).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("sem o cookie: página volta para / com o destino, e não é indexada", async () => {
    gateOn();
    const res = await middleware(req("/closet?tab=looks"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/?next=%2Fcloset%3Ftab%3Dlooks");
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("sem o cookie: a raiz e /gate/* mostram o gate sem mudar a URL; o BFF responde 403", async () => {
    gateOn();
    for (const p of ["/", "/gate", "/gate/qualquer"]) {
      const res = await middleware(req(p));
      expect(res.headers.get("x-middleware-rewrite")).toContain("/gate");
    }
    const bff = await middleware(req("/bff/auth/refresh"));
    expect(bff.status).toBe(403);
    expect(bff.headers.get("X-Dev-Gate-Required")).toBe("1");
  });

  it("rotas próprias do gate passam sem cookie (elas mesmas conferem)", async () => {
    gateOn();
    const res = await middleware(req("/gate/verify"));
    expect(res.status).toBe(200);
  });

  it("com o cookie válido: passa, renova o token curto da API e /gate volta para o app", async () => {
    gateOn();
    const cookie = await signGate("gp", "ana@example.com", "jti-1", SECRET);
    const ok = await middleware(req("/closet", { [GATE_COOKIE]: cookie }));
    expect(ok.status).toBe(200);
    expect(ok.cookies.get(GATE_API_COOKIE)?.value).toBeTruthy();
    const back = await middleware(req("/gate", { [GATE_COOKIE]: cookie }));
    expect(back.status).toBe(307);
    expect(back.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("cookie de alguém fora da lista atual não passa (revogação por pessoa)", async () => {
    gateOn();
    const cookie = await signGate("gp", "fora@example.com", "jti-2", SECRET);
    const res = await middleware(req("/closet", { [GATE_COOKIE]: cookie }));
    expect(res.status).toBe(307);
  });

  it("modo Cloudflare sem o JWT do Access: 403 sem nada do produto", async () => {
    gateOn("cloudflare");
    const res = await middleware(req("/closet"));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("403");
  });
});

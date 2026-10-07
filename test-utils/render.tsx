/**
 * Render de componentes e telas nos testes (jsdom), dentro dos mesmos provedores do app (idioma, tema, avisos, toasts,
 * sessão, detalhe). A API é simulada por rota (`mockApi`); `loggedAs` restaura uma sessão como se o cookie existisse.
 * Fica fora de app/, components/ e lib/ para não entrar na conta da cobertura
 */
import type { ReactElement } from "react";
import { vi } from "vitest";
import { render, waitFor, type RenderOptions } from "@testing-library/react";
import { Providers } from "@/app/(site)/providers";
import type { Me, UserCard } from "@/lib/api/types";

export const USER: UserCard = { id: "u1", username: "ana", displayName: "Ana Souza", profileType: "PESSOAL", verified: false, privateAccount: false };
export const ME: Me = { user: USER, email: "ana@example.com", emailVerified: true, status: "ACTIVE", role: "USER", twoFactorEnabled: false };

type Handler = unknown | ((url: URL, init: RequestInit) => unknown);
/** Respostas por "MÉTODO /caminho" (ou só "/caminho" para qualquer método); o que não casar volta 404. */
export function mockApi(routes: Record<string, Handler> = {}) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://localhost");
    const method = (init.method ?? "GET").toUpperCase();
    let body: unknown;
    try { body = typeof init.body === "string" ? JSON.parse(init.body) : init.body; } catch { body = init.body; }
    calls.push({ method, path: url.pathname + url.search, body });
    const key = [`${method} ${url.pathname}${url.search}`, `${method} ${url.pathname}`, url.pathname].find((k) => k in routes);
    if (!key) return new Response(JSON.stringify({ status: 404, code: "NAO_ENCONTRADO", message: "não simulado" }), { status: 404, headers: { "content-type": "application/json" } });
    const h = routes[key];
    const value = typeof h === "function" ? (h as (u: URL, i: RequestInit) => unknown)(url, init) : h;
    if (value instanceof Response) return value;
    if (value === undefined) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

export function loggedAs(me: Me = ME, routes: Record<string, Handler> = {}) {
  document.cookie = "fai_rt_h=1; path=/";
  return mockApi({ "POST /bff/auth/refresh": { accessToken: "test-token" }, "GET /api/me": me, ...routes });
}

export function renderApp(ui: ReactElement, opts?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: ({ children }) => <Providers initialLocale="pt-BR">{children}</Providers>, ...opts });
}

export const settle = () => waitFor(() => new Promise((r) => setTimeout(r, 0)));

export * from "@testing-library/react";

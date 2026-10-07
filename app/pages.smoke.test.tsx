// @vitest-environment jsdom
/// <reference types="vite/client" />
/**
 * Fumaça das telas: cada página do app abre logada, com a API simulada, sem quebrar — e sem sessão, cai no login.
 * Respostas vazias (listas, páginas sem itens) exercitam os estados vazios; o que não é simulado volta 404 e exercita
 * os estados de erro. Os fluxos de cada tela ficam nos testes próprios.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, loggedAs, mockApi, renderApp, waitFor } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { tokenStore } from "@/lib/api/client";
import { PIECE, PIECE_2, SCHEME, page } from "@/test-utils/fixtures";

/** Promessa já resolvida e marcada como tal: o use() do React lê o valor na hora, sem suspender. */
const resolved = <T,>(value: T) => Object.assign(Promise.resolve(value), { status: "fulfilled", value });
import { Suspense, type ComponentType } from "react";

// parênteses são especiais em glob: pega todas as page.tsx e filtra as do grupo (site)
const pages = Object.fromEntries(Object.entries(import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>("./**/page.tsx"))
  .filter(([p]) => p.startsWith("./(site)/")));

const notFound = () => new Response(JSON.stringify({ status: 404, code: "NAO_ENCONTRADO", message: "não simulado" }), { status: 404, headers: { "content-type": "application/json" } });
const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans"] }, colors: { white: "#fff", blue: "#1f4fa0" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"], occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: {} };

/** Só a taxonomia: o resto volta 404 e exercita os estados de erro de cada tela. */
const handler = (url: URL) => (url.pathname === "/api/taxonomy" ? TAXONOMY : notFound());

/**
 * Com dados, só nas rotas cujo formato o código deixa claro (listas paginadas de peças e looks, detalhe de peça e de
 * look): os cards aparecem. O resto continua 404.
 */
const withData = (url: URL) => {
  const p = url.pathname;
  if (/^\/api\/(me|users\/[^/]+)\/closet$/.test(p)) return page([PIECE, PIECE_2]);
  if (p === "/api/me/schemes") return page([SCHEME]);
  if (/^\/api\/pieces\/[^/]+$/.test(p)) return { piece: PIECE, originSchemes: [{ schemeId: "s1", title: SCHEME.title }] };
  if (/^\/api\/schemes\/[^/]+$/.test(p)) return { scheme: SCHEME };
  return handler(url);
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; });

describe("telas do app abrem sem quebrar", () => {
  // a raiz só redireciona e o [...missing] é o "não encontrado": ficam de fora da fumaça de conteúdo
  // a raiz só redireciona, o [...missing] é o "não encontrado" e o /lookbook leva ao perfil: ficam fora da fumaça de
  // conteúdo (o /lookbook tem teste próprio abaixo)
  const entries = Object.entries(pages).filter(([p]) => p !== "./(site)/page.tsx" && !p.includes("[...missing]") && !p.includes("/lookbook/page.tsx"));

  it("há telas para testar", () => { expect(entries.length).toBeGreaterThan(20); });

  for (const [mode, respond] of [["logado", handler], ["com dados", withData]] as const) for (const [path, load] of entries) {
    it(`${mode}: ${path.replace("./(site)/", "")}`, async () => {
      nav.params = { slug: "nike", username: "ana", id: "11111111-1111-1111-1111-111111111111", token: "t" };
      nav.pathname = "/" + path.replace(/^\.\/\(site\)\//, "").replace(/\([^)]+\)\//g, "").replace(/\/?page\.tsx$/, "");
      loggedAs(undefined, { "/api/taxonomy": handler(new URL("http://x/api/taxonomy")) });
      const errors: unknown[] = [];
      // erro de render (a tela quebrou) chega ao console.error do React: conta como falha
      const spy = vi.spyOn(console, "error").mockImplementation((...a) => { const m = a.map(String).join(" "); if (/Uncaught|error occurred in the|Error: /.test(m) && !/not wrapped in act/.test(m)) errors.push(m.slice(0, 300)); });
      const { default: Page } = await load();
      // página de servidor (async) não renderiza no jsdom: só confere que exporta um componente
      if (Page.constructor.name === "AsyncFunction") { expect(typeof Page).toBe("function"); spy.mockRestore(); return; }
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = new URL(String(input instanceof Request ? input.url : input), "http://localhost");
        if (url.pathname === "/bff/auth/refresh") return new Response(JSON.stringify({ accessToken: "t" }), { status: 200, headers: { "content-type": "application/json" } });
        if (url.pathname === "/api/me") return new Response(JSON.stringify({ user: { id: "u1", username: "ana", displayName: "Ana", profileType: "PESSOAL", verified: false, privateAccount: false }, email: "a@x.com", emailVerified: true, status: "ACTIVE", role: "ADMIN", twoFactorEnabled: false }), { status: 200, headers: { "content-type": "application/json" } });
        const r = respond(url);
        void init;
        return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
      }));
      // use(params) suspende até a promessa resolver: como no app, a página fica dentro de um Suspense
      const params = resolved(nav.params); const searchParams = resolved({});
      const { container } = renderApp(<Suspense fallback={<p>carregando</p>}><Page params={params} searchParams={searchParams} /></Suspense>);
      await waitFor(() => expect(container.textContent).not.toBe("carregando"), { timeout: 3000 });
      // tela que quebra é desmontada pelo React e o contêiner fica vazio: exige conteúdo na tela. Espera o conteúdo (até
      // 3 s) em vez de uma pausa fixa: com a suíte inteira em paralelo, telas com import dinâmico demoram mais a pintar
      await waitFor(() => expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0), { timeout: 3000 });
      spy.mockRestore();
      expect(errors).toEqual([]);
    });
  }

  it("sem sessão, tela protegida manda para o login", async () => {
    mockApi({});
    // sem restos das telas anteriores: nem token em memória nem usuário em cache
    tokenStore.clear(); localStorage.clear();
    router.replace.mockClear(); router.push.mockClear();
    const load = entries.find(([p]) => p.includes("/pieces/new/"))![1];
    const { default: Page } = await load();
    renderApp(<Page />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/login\?next=/)), { timeout: 3000 });
  });

  it("/lookbook leva ao perfil do próprio usuário, mantendo a aba", async () => {
    loggedAs();
    window.history.replaceState({}, "", "/lookbook?tab=looks");
    router.replace.mockClear();
    const { default: Page } = await Object.entries(import.meta.glob<{ default: ComponentType }>("./**/lookbook/page.tsx"))[0][1]();
    renderApp(<Page />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/u/ana?tab=looks"), { timeout: 3000 });
  });
});

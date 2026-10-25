// @vitest-environment jsdom
/**
 * Casca do site: layout raiz (idioma da requisição, nonce da CSP, metadados traduzidos), rotas que só redirecionam ou
 * mostram 404, fronteira de erro das páginas, layout das telas de conta e documentos legais.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { notFound, redirect } from "next/navigation";

const store = { cookie: undefined as string | undefined, headers: {} as Record<string, string> };
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "fai.locale" && store.cookie ? { value: store.cookie } : undefined) }),
  headers: async () => ({ get: (n: string) => store.headers[n] ?? null }),
}));
vi.mock("next/font/local", () => ({ default: (o: { variable: string }) => ({ variable: o.variable.replace("--", "v-") }) }));

import RootLayout, { generateMetadata, viewport } from "./layout";
import Home from "./page";
import NotFound from "./not-found";
import ErrorPage from "./error";
import Missing from "./[...missing]/page";
import AuthLayout from "./(auth)/layout";
import LegalDocumentPage, { generateStaticParams } from "./legal/[document]/page";

afterEach(() => { cleanup(); store.cookie = undefined; store.headers = {}; vi.mocked(notFound).mockReset(); vi.mocked(redirect).mockReset(); });

type El = ReactElement<{ children?: unknown; lang?: string; className?: string; nonce?: string; initialLocale?: string; dangerouslySetInnerHTML?: { __html: string } }>;
const kids = (e: El): El[] => ([] as unknown[]).concat(e.props.children ?? []).filter(isValidElement) as El[];

describe("layout raiz", () => {
  it("idioma salvo no cookie vence; nonce da CSP vai no script do tema; fontes no <html>", async () => {
    store.cookie = "en"; store.headers = { "x-nonce": "n0nce", "accept-language": "es-ES,es" };
    const html = (await RootLayout({ children: <p>oi</p> })) as El;
    expect(html.props.lang).toBe("en");
    expect(html.props.className).toContain("v-font-editorial");
    const [head, body] = kids(html);
    const script = kids(head)[0];
    expect(script.props.nonce).toBe("n0nce");
    expect(script.props.dangerouslySetInnerHTML?.__html).toContain("fai.theme");
    expect(kids(body)[0].props.initialLocale).toBe("en");
  });

  it("sem cookie usa o Accept-Language; sem nada, pt-BR; o pseudo-idioma vira pt-BR no <html>", async () => {
    store.headers = { "accept-language": "es-ES,es;q=0.9" };
    expect(((await RootLayout({ children: null })) as El).props.lang).toBe("es");
    store.headers = {};
    expect(((await RootLayout({ children: null })) as El).props.lang).toBe("pt-BR");
    store.cookie = "qps-ploc";
    const html = (await RootLayout({ children: null })) as El;
    expect(html.props.lang).toBe("pt-BR");
    expect(kids(kids(html)[1])[0].props.initialLocale).toBe("qps-ploc");
    expect(kids(kids(html)[0])[0].props.nonce).toBeUndefined();
  });

  it("metadados com a descrição no idioma da requisição", async () => {
    const md = await generateMetadata();
    expect(md.description).toBe("Seu guarda-roupa digital com looks por IA, DNA de Estilo, Hype Score e comunidade.");
    expect(md.title).toEqual({ default: "Fashion AI", template: "%s · Fashion AI" });
    expect(viewport.viewportFit).toBe("cover");
  });
});

describe("rotas de redirecionamento e 404", () => {
  it("a home leva ao feed", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/feed");
  });

  it("endereço sem rota chama o 404 do app", () => {
    Missing();
    expect(notFound).toHaveBeenCalled();
  });

  it("404 do app com volta para o feed", () => {
    renderApp(<NotFound />);
    expect(screen.getByRole("heading").textContent).toBe("Não encontramos esta página");
    expect(screen.getByRole("link", { name: "Voltar ao feed" }).getAttribute("href")).toBe("/feed");
  });

  it("fronteira de erro das páginas mostra a tela de erro e tenta de novo", () => {
    const reset = vi.fn();
    renderApp(<ErrorPage error={new Error("x")} reset={reset} />);
    expect(screen.getByRole("heading").textContent).toBe("Algo deu errado nesta tela");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(reset).toHaveBeenCalled();
  });

  it("layout das telas de conta: logotipo com link ao feed e o conteúdo no meio", () => {
    renderApp(<AuthLayout><p>formulário</p></AuthLayout>);
    expect(screen.getByRole("link", { name: "Fashion AI" }).getAttribute("href")).toBe("/feed");
    expect(screen.getByRole("main").textContent).toBe("formulário");
  });
});

describe("documentos legais", () => {
  it("gera as páginas de termos e privacidade", () => {
    expect(generateStaticParams()).toEqual([{ document: "terms" }, { document: "privacy" }]);
  });

  it("termos: lê o markdown de docs/legal e mostra com o link de volta ao cadastro", async () => {
    const ui = await LegalDocumentPage({ params: Promise.resolve({ document: "terms" }) });
    renderApp(ui);
    expect(screen.getByRole("link", { name: "Voltar ao cadastro" }).getAttribute("href")).toBe("/register");
    expect(screen.getAllByRole("heading").length).toBeGreaterThan(0);
  });

  it("documento desconhecido: 404", async () => {
    vi.mocked(notFound).mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });
    await expect(LegalDocumentPage({ params: Promise.resolve({ document: "outro" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

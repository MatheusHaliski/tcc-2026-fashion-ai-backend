// @vitest-environment jsdom
/**
 * Insights dinâmicos (RF53): a faixa de cada aba com análise — carregando, cards com o número em texto e CTA, vazio,
 * erro com "Tentar de novo", contexto público anônimo, contexto pessoal (só com sessão, "Reescrever com IA") — e os
 * números do look lado a lado (LookScores), com "—" quando não há base, nunca 0.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { tokenStore } from "@/lib/api/client";
import { InsightStrip } from "@/components/insights/insight-strip";
import { LookScores } from "@/components/hype/look-scores";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; });

const RESPONSE = {
  context: "EXPLORER_TRENDING", generatedAt: new Date().toISOString(), algorithmVersion: "HYPE_V2", source: "local",
  items: [
    { code: "CATEGORY_RISING", tone: "POSITIVE", title: "Calçados em crescimento", text: "Calçados cresceram 23% em 7 dias na América do Sul.",
      metric: { label: "Crescimento", value: 23, unit: "%" }, action: { label: "Ver ranking", href: "/explorer?tab=ranking&category=shoes_piece" }, basis: ["HYPE_V2", "PUBLIC_RANKING"] },
    { code: "POPULAR_NOT_GROWING", tone: "ATTENTION", title: "Popular, mas parado", text: "Jeans tem volume alto, mas cresceu 0,5% na semana.",
      metric: { label: "Sem uso", value: 45, unit: "dias" }, action: { label: "Fora do app", href: "javascript:alert(1)" }, basis: ["UNKNOWN_CODE"] },
    { code: "REGION_LEADER", tone: "NEUTRAL", title: "Sem número ainda", text: "A região ainda junta dados.", metric: { label: "Participação", value: null, unit: "%" }, basis: [] },
  ],
};

/** logado de verdade: sessão restaurada (cookie-sinal) e o token em memória */
const freshSession = () => { tokenStore.clear(); localStorage.clear(); };

describe("InsightStrip", () => {
  it("carrega (skeleton) e mostra os cards: tom com ícone + texto, número em texto, CTA interno e rodapé", async () => {
    freshSession();
    const { calls, fetchMock } = mockApi({ "GET /api/insights": RESPONSE });
    renderApp(<InsightStrip context="EXPLORER_TRENDING" params={{ window: "7", category: "shoes_piece", region: "" }} />);
    expect(screen.getByLabelText("Carregando insights…")).toBeTruthy();
    expect(await screen.findByText("Calçados em crescimento")).toBeTruthy();
    expect(screen.getByText("Calçados cresceram 23% em 7 dias na América do Sul.")).toBeTruthy();
    // tom: texto ao lado do ícone (nunca só a cor)
    expect(screen.getByText("Sinal positivo")).toBeTruthy();
    expect(screen.getByText("Atenção")).toBeTruthy();
    expect(screen.getByText("Contexto")).toBeTruthy();
    // métrica em texto, com unidade; sem valor é "—", nunca 0
    expect(screen.getByText("Crescimento").nextElementSibling?.textContent).toBe("23%");
    expect(screen.getByText("Sem uso").nextElementSibling?.textContent).toBe("45 dias");
    expect(screen.getByText("Participação").nextElementSibling?.textContent).toBe("—");
    // CTA interno vira link; href externo (javascript:) não aparece
    expect(screen.getByRole("link", { name: /Ver ranking/ }).getAttribute("href")).toBe("/explorer?tab=ranking&category=shoes_piece");
    expect(screen.queryByText("Fora do app")).toBeNull();
    expect(screen.getByText("Base: HypeScore v2 · ranking público")).toBeTruthy();
    expect(screen.getByText(/Atualizado .* · Algoritmo HYPE_V2 · motor local/)).toBeTruthy();
    // público e sem sessão: anônimo, com o recorte (vazio fica fora) e sem "Reescrever com IA"
    const call = calls.find((c) => c.path.startsWith("/api/insights"))!;
    expect(call.path).toBe("/api/insights?context=EXPLORER_TRENDING&window=7&category=shoes_piece");
    const init = fetchMock.mock.calls.find(([u]) => String(u).includes("/api/insights"))![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(screen.queryByLabelText("Reescrever com IA")).toBeNull();
    expect(screen.getByText(/Só dados públicos e agregados/)).toBeTruthy();
  });

  it("sem itens: 'Ainda sem dados suficientes para um insight'", async () => {
    freshSession();
    mockApi({ "GET /api/insights": { ...RESPONSE, items: [] } });
    renderApp(<InsightStrip context="EXPLORER_GLOBAL" />);
    expect(await screen.findByText("Ainda sem dados suficientes para um insight")).toBeTruthy();
  });

  it("erro com 'Tentar de novo' que busca outra vez", async () => {
    freshSession();
    let n = 0;
    mockApi({ "GET /api/insights": () => (++n === 1 ? new Response(JSON.stringify({ status: 500, code: "ERRO", message: "falhou" }), { status: 500, headers: { "content-type": "application/json" } }) : RESPONSE) });
    renderApp(<InsightStrip context="EXPLORER_MAP" />);
    expect(await screen.findByText("Não foi possível carregar os insights agora.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Calçados em crescimento")).toBeTruthy();
    expect(n).toBe(2);
  });

  it("contexto pessoal sem sessão não aparece nem busca", async () => {
    freshSession();
    const { calls } = mockApi({ "GET /api/insights": RESPONSE });
    const { container } = renderApp(<InsightStrip context="CAPSULE" />);
    await settle();
    expect(container.querySelector(".insight-strip")).toBeNull();
    expect(calls.some((c) => c.path.startsWith("/api/insights"))).toBe(false);
  });

  it("contexto pessoal logado: 'Reescrever com IA' pede withAi=true e mostra a fonte", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/insights": (url: URL) => ({ ...RESPONSE, context: "CAPSULE", source: url.searchParams.get("withAi") === "true" ? "ia" : "local" }) });
    renderApp(<InsightStrip context="CAPSULE" />);
    expect(await screen.findByText("Calçados em crescimento")).toBeTruthy();
    expect(screen.getByText(/O Hype é contexto/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Reescrever com IA"));
    await waitFor(() => expect(screen.getByText(/texto reescrito pela IA/)).toBeTruthy());
    expect(calls.some((c) => c.path === "/api/insights?context=CAPSULE&withAi=true")).toBe(true);
  });

  it("recolhida: só busca ao abrir", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/insights": RESPONSE });
    renderApp(<InsightStrip context="CLOSET" collapsible />);
    await settle();
    expect(calls.some((c) => c.path.startsWith("/api/insights"))).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: "Ver insights" }));
    expect(await screen.findByText("Calçados em crescimento")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ocultar" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("preset (insights que vieram em outra resposta): mostra sem buscar", async () => {
    const { calls } = loggedAs(undefined, {});
    renderApp(<InsightStrip context="AUTOPILOT" preset={RESPONSE.items as never} />);
    expect(await screen.findByText("Calçados em crescimento")).toBeTruthy();
    expect(calls.some((c) => c.path.startsWith("/api/insights"))).toBe(false);
  });
});

describe("LookScores (componente compartilhado: Copilot, Autopiloto, Lens)", () => {
  it("dimensões lado a lado; sem base é '—', nunca 0; só as que vieram", () => {
    mockApi({});
    const { container } = renderApp(<LookScores scores={{ compatibility: 82, hype: null, novelty: 40 }} />);
    expect(screen.getByText("Compatibilidade").nextElementSibling?.textContent).toBe("82");
    expect(screen.getByText("Hype").nextElementSibling?.textContent).toBe("—");
    expect(screen.getByText("Novidade").nextElementSibling?.textContent).toBe("40");
    expect(screen.queryByText("Reutilização")).toBeNull();
    expect([...container.querySelectorAll("dd")].some((d) => d.textContent === "0")).toBe(false);
  });

  it("sem scores não desenha nada", () => {
    mockApi({});
    const { container } = renderApp(<LookScores scores={null} />);
    expect(container.querySelector(".copilot-scores")).toBeNull();
  });
});

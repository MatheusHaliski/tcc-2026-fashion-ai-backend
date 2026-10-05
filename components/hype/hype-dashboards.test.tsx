// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderApp, screen, within } from "@/test-utils/render";
import { AdminHypeLevels, HypeJobStatus, IssuerHypeBlock, type AdminHypeV2, type HypeJobState, type IssuerHype } from "@/components/hype/hype-dashboards";

afterEach(() => cleanup());

const ISSUER: IssuerHype = {
  algorithmVersion: "HYPE_V2", deltaWindowDays: 7, bondedLooks: 7, withHype: 4, insufficient: 1, notPublic: 2,
  avgScore: 62.5, level: "HOT", deltaPoints: 3.2, direction: "UP", calculatedAt: "2026-10-05T09:20:00Z",
  top: [
    { schemeId: "a", title: "Alfa", owner: "ana", score: 80, level: "TRENDING", deltaPoints: 4, direction: "UP" },
    { schemeId: "c", title: "Gama", owner: "bia", score: 70, level: "HOT", deltaPoints: null, direction: null },
  ],
};

const JOB: HypeJobState = { algorithmVersion: "HYPE_V2", lastCalculatedAt: "2026-10-05T09:20:00Z", lastSnapshotDate: "2026-10-05", rows: 24, staleAfterHours: 24, stale: false };
const ADMIN: AdminHypeV2 = {
  algorithmVersion: "HYPE_V2",
  levels: [
    { level: "LOW_SIGNAL", pieces: 0, looks: 0 }, { level: "NICHE", pieces: 2, looks: 1 }, { level: "RELEVANT", pieces: 6, looks: 1 },
    { level: "HOT", pieces: 7, looks: 2 }, { level: "TRENDING", pieces: 2, looks: 1 }, { level: "VIRAL", pieces: 0, looks: 0 },
  ],
  levelTotals: { pieces: 17, looks: 5 },
  coverage: [
    { entityType: "PIECE", total: 18, available: 17, insufficient: 1, notCalculated: 0, publicEligible: 17 },
    { entityType: "SCHEME", total: 6, available: 5, insufficient: 1, notCalculated: 0, publicEligible: 5 },
  ],
  job: JOB,
};

describe("Dashboard do emissor › Hype dos looks vinculados (RF53 · P2-20)", () => {
  it("média v2 com a faixa em texto, Δ7d, cobertura só pública e o top com link", () => {
    renderApp(<IssuerHypeBlock data={ISSUER} />);
    const block = screen.getByRole("region", { name: "Hype dos looks vinculados" });
    expect(within(block).getByRole("img", { name: "Hype médio 63, Em alta" })).toBeTruthy();
    expect(within(block).getAllByText("Em alta").length).toBeGreaterThan(0);          // faixa sempre escrita
    expect(within(block).getByText("subiu 3,2 pontos em 7 dias")).toBeTruthy();       // leitor de tela ouve a frase
    expect(within(block).getByText("4 de 7 looks vinculados com Hype público")).toBeTruthy();
    expect(within(block).getByText(/1 com dados insuficientes · 2 privados/)).toBeTruthy();
    expect(within(block).getByText(/não a qualidade do look/)).toBeTruthy();          // relevância, não juízo
    const link = within(block).getByRole("link", { name: "Alfa: Hype 80, Tendência" });
    expect(link.getAttribute("href")).toBe("/schemes/a");
    expect(within(block).getAllByRole("listitem")).toHaveLength(2);
  });

  it("sem looks públicos com Hype: 'Dados insuficientes', nunca 0", () => {
    renderApp(<IssuerHypeBlock data={{ ...ISSUER, withHype: 0, avgScore: null, level: null, deltaPoints: null, direction: null, calculatedAt: null, top: [] }} />);
    expect(screen.getByText("Dados insuficientes")).toBeTruthy();
    expect(screen.getByText(/Isso não é uma nota zero/)).toBeTruthy();
    expect(screen.getByText("Nenhum look vinculado público com Hype disponível.")).toBeTruthy();
    expect(screen.queryByText(/🔥 0/)).toBeNull();
    expect(screen.getByText("0 de 7 looks vinculados com Hype público")).toBeTruthy();
  });

  it("não renderiza nada sem o bloco no payload (backend antigo)", () => {
    const { container } = renderApp(<IssuerHypeBlock data={undefined} />);
    expect(container.textContent).toBe("");
  });
});

describe("Admin › Conteúdo › widget de faixas v2 (RF53 · P2-21)", () => {
  it("pequenas múltiplas de peças e looks, as 6 faixas em ordem com texto, contagem e percentual", () => {
    renderApp(<AdminHypeLevels data={ADMIN} />);
    const pieces = screen.getByRole("region", { name: "Peças · 17 com Hype público" });
    const names = within(pieces).getAllByRole("listitem").map((li) => li.firstElementChild?.textContent);
    expect(names).toEqual(["Sinal baixo", "Nicho", "Relevante", "Em alta", "Tendência", "Viral"]);
    expect(within(pieces).getByText("Em alta: 7 (41% de peças)")).toBeTruthy();        // texto acessível de cada barra
    const looks = screen.getByRole("region", { name: "Looks · 5 com Hype público" });
    expect(within(looks).getByText("Em alta: 2 (40% de looks)")).toBeTruthy();
    expect(screen.getByText(/só itens públicos com Hype disponível \(publicEligible\)/)).toBeTruthy();
    expect(screen.getByText(/relevância, não de qualidade/)).toBeTruthy();
    expect(screen.queryByText(/Muito estiloso|Arrasando|Ícone de estilo/)).toBeNull(); // faixas de juízo do v1 saíram
  });

  it("cobertura disponível · insuficiente · não calculado e o último cálculo", () => {
    renderApp(<AdminHypeLevels data={ADMIN} />);
    const table = screen.getByRole("table", { name: "Cobertura do cálculo" });
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Tipo", "Disponível", "Dados insuficientes", "Não calculado", "Públicos", "Ativos"]);
    expect(within(table).getByRole("rowheader", { name: "Peças" })).toBeTruthy();
    expect(screen.getByText("HYPE_V2")).toBeTruthy();
    expect(screen.getByText(/· Em dia$/)).toBeTruthy();
  });

  it("sem itens públicos: mensagem em texto e a cobertura continua", () => {
    renderApp(<AdminHypeLevels data={{ ...ADMIN, levels: ADMIN.levels.map((l) => ({ ...l, pieces: 0, looks: 0 })), levelTotals: { pieces: 0, looks: 0 } }} />);
    expect(screen.getByText("Nenhum item público com Hype disponível neste recorte.")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Cobertura do cálculo" })).toBeTruthy();
  });

  it("payload sem hypeV2 (backend antigo): aviso em vez de quebrar", () => {
    renderApp(<AdminHypeLevels data={null} />);
    expect(screen.getByText("Estado do HypeScore indisponível.")).toBeTruthy();
  });
});

describe("Admin › Sistema › estado do job v2 (RF53 · P3-14)", () => {
  it("nunca calculado e desatualizado aparecem em texto", () => {
    renderApp(<HypeJobStatus job={{ ...JOB, lastCalculatedAt: null, lastSnapshotDate: null, stale: null }} />);
    expect(screen.getByText("Nunca calculado")).toBeTruthy();
    cleanup();
    renderApp(<HypeJobStatus job={{ ...JOB, stale: true }} />);
    expect(screen.getByText(/Desatualizado \(mais de 24 h\)/)).toBeTruthy();
  });

  it("detalhado: agenda, recálculo ao vivo e pendência", () => {
    renderApp(<HypeJobStatus job={{ ...JOB, cron: "0 20 */6 * * *", live: { enabled: true, intervalSeconds: 120, pending: true } }} detailed />);
    expect(screen.getByText("0 20 */6 * * *")).toBeTruthy();
    expect(screen.getByText(/Ligado · no máximo a cada 120 s/)).toBeTruthy();
    expect(screen.getByText(/Mudanças aguardando o próximo recálculo/)).toBeTruthy();
    expect(screen.getByText("24 registros no estado atual")).toBeTruthy();
  });
});

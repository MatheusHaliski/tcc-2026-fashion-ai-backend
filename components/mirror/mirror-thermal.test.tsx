// @vitest-environment jsdom
/**
 * Espelho › Vista-me com nível térmico (docs/banco-de-dados/solucoes/04-nivel-termico.md): chips com "Não informado" e os
 * níveis ativos; carregando e erro (com "Tentar de novo") não se confundem com um nível; o pedido só leva nivelTermicoId
 * quando um nível foi escolhido; a recomendação mostra o nível pedido e a evidência das peças.
 */
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { MirrorControls, type MirrorData } from "./mirror-controls";
import { vistaRequest } from "./mirror-vista-section";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const TEE = { id: "a", name: "Camiseta preta", category: "upper_piece", subcategory: "t_shirt", slot: "upper" };
const JEANS = { id: "b", name: "Calça jeans", category: "lower_piece", subcategory: "jeans", slot: "lower" };
const base = (extra: Partial<MirrorData> = {}): MirrorData => ({ slots: { outer_layer: null, upper: TEE, dress: null, lower: null, shoes: null, accessory: [] }, complete: false, missing: [], actions: [], ...extra });
const NIVEIS = [{ id: "n1", codigo: "LEVE", nome: "Leve" }, { id: "n2", codigo: "MODERADO", nome: "Moderado" }];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const LOOK = (nivelTermicoId?: string) => ({ ...base({ origin: "vista_me", prompt: "Trabalho", interpretation: { anchors: [], nivelTermicoId } }),
  slots: { ...base().slots, lower: JEANS }, thermal: nivelTermicoId ? { nivelTermico: "MODERADO", compativeis: 1, divergentes: 0, semDado: 1, base: "INTENSIDADE_DECLARADA_DA_PECA" } : undefined });

function Harness({ initial }: { initial: MirrorData }) {
  const [data, setData] = useState(initial);
  return <MirrorControls data={data} setData={setData} reload={() => undefined} />;
}
const levels = () => within(screen.getByRole("radiogroup", { name: "Nível térmico do look" }));
const trabalho = () => within(screen.getByRole("group", { name: "Para onde é o look" })).getByRole("button", { name: /Trabalho/ });
const vistas = (calls: { method: string; path: string }[]) => calls.filter((c) => c.method === "POST" && c.path === "/api/me/mirror/vista-me");

describe("Vista-me — nível térmico do look", () => {
  it("carregando não mostra nenhum nível; depois 'Não informado' vem marcado e o pedido sai sem nivelTermicoId", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/tipos-look": [], "GET /api/opcoes/niveis-termicos": NIVEIS, "POST /api/me/mirror/vista-me": LOOK() });
    renderApp(<Harness initial={base()} />);
    expect(screen.getByText("Carregando níveis térmicos…")).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Nível térmico do look" })).toBeNull();
    await waitFor(() => expect(levels().getByRole("radio", { name: "Não informado" }).getAttribute("aria-checked")).toBe("true"));
    expect(levels().getByRole("radio", { name: "Leve" }).getAttribute("aria-checked")).toBe("false");
    fireEvent.click(trabalho());
    await waitFor(() => expect(vistas(calls)).toHaveLength(1));
    expect(vistas(calls)[0]).toMatchObject({ body: { prompt: "Trabalho", anchorIds: [] } });
    expect((vistas(calls)[0] as { body: Record<string, unknown> }).body).not.toHaveProperty("nivelTermicoId");
    expect(screen.queryByTestId("mirror-thermal-fit")).toBeNull();
  });

  it("com um nível escolhido, o pedido leva o ID e a recomendação mostra o nível pelo nome e a evidência das peças", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/tipos-look": [], "GET /api/opcoes/niveis-termicos": NIVEIS, "POST /api/me/mirror/vista-me": LOOK("n2") });
    renderApp(<Harness initial={base()} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Moderado" }));
    expect(levels().getByRole("radio", { name: "Moderado" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(trabalho());
    await waitFor(() => expect(vistas(calls)).toHaveLength(1));
    expect(vistas(calls)[0]).toMatchObject({ body: { prompt: "Trabalho", anchorIds: [], nivelTermicoId: "n2" } });
    const fit = await screen.findByTestId("mirror-thermal-fit");
    expect(fit.textContent).toContain("Nível térmico pedido: Moderado");
    expect(fit.textContent).toContain("1 peça(s) compatível(is), 0 divergente(s), 1 sem intensidade declarada");
  });

  it("erro ao carregar vira alerta com 'Tentar de novo' (não um nível) e a nova tentativa mostra os chips", async () => {
    let first = true;
    loggedAs(undefined, { "GET /api/tipos-look": [], "GET /api/opcoes/niveis-termicos": () => { if (first) { first = false; return json(503, { message: "offline" }); } return NIVEIS; } });
    renderApp(<Harness initial={base()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("radio", { name: "Leve" })).toBeTruthy();
    expect(levels().getByRole("radio", { name: "Não informado" }).getAttribute("aria-checked")).toBe("true");
  });

  it("resposta que não é lista não quebra o painel: fica só 'Não informado'", async () => {
    loggedAs(undefined, { "GET /api/tipos-look": [], "GET /api/opcoes/niveis-termicos": {} });
    renderApp(<Harness initial={base()} />);
    expect(await screen.findByRole("radio", { name: "Não informado" })).toBeTruthy();
    expect(levels().getAllByRole("radio")).toHaveLength(1);
  });

  it("sem a rota (404) o Vista-me segue sem o critério, com um aviso curto", async () => {
    loggedAs(undefined, { "GET /api/tipos-look": [] });
    renderApp(<Harness initial={base()} />);
    expect(await screen.findByText(/Níveis térmicos indisponíveis no momento/)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Para onde é o look" })).toBeTruthy();
  });
});

describe("vistaRequest — Outra sugestão com nível térmico", () => {
  const data = base({ origin: "vista_me", prompt: "Trabalho", interpretation: { anchors: ["a"], nivelTermicoId: "n2" } });
  it("mesmas âncoras e mesmo nível: reaproveita o pedido guardado", () => {
    expect(vistaRequest("another", data, ["a"], undefined, "n2")).toEqual({ path: "/api/me/mirror/another" });
  });
  it("nível trocado ou retirado: refaz o Vista-me com o que está na tela", () => {
    expect(vistaRequest("another", data, ["a"], undefined, "n1")).toEqual({ path: "/api/me/mirror/vista-me", body: { prompt: "Trabalho", anchorIds: ["a"], nivelTermicoId: "n1" } });
    expect(vistaRequest("another", data, ["a"], undefined, null)).toEqual({ path: "/api/me/mirror/vista-me", body: { prompt: "Trabalho", anchorIds: ["a"] } });
  });
});

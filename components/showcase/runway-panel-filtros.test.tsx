// @vitest-environment jsdom
/**
 * Passarela (RF33): filtros viram a query da API (ranking ↔ região/país, multi-seleções, manequim), lotes, a tabela que
 * pula para o lote certo, os avisos "você" (saiu / desfila / marcar), o 2D sem WebGL e o 3D lembrado.
 * A FilterBar é simulada: aqui interessa como o painel reage a cada mudança, não o desenho do filtro.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { RunwayPanel } from "@/components/showcase/runway-panel";

const gl = vi.hoisted(() => ({ ok: true as boolean | null }));
vi.mock("@/components/three/common", async (orig) => ({ ...(await orig<object>()), useWebGL: () => gl.ok }));
vi.mock("@/components/filter-bar", () => ({
  FilterBar: ({ quick, filters, values, onChange }: { quick: { options: { value: string; label: string }[] }; filters: { key: string; options: { value: string; label: string }[] }[]; values: Record<string, string>; onChange: (k: string, v: string) => void }) => (
    <div>
      <p data-testid="values">{JSON.stringify(values)}</p>
      <p data-testid="quick">{quick.options.map((o) => o.label).join("|")}</p>
      <p data-testid="opts">{filters.map((f) => `${f.key}:${f.options.map((o) => o.label).join("/")}`).join(";")}</p>
      {[["ranking", "TOP100_PAIS"], ["ranking", ""], ["ranking", "TOP100_REGIONAL"], ["region", "SA"], ["region", ""], ["country", "BR"], ["sex", "MASCULINO"], ["colors", "black,red"], ["occasions", "party"], ["styles", "edgy"], ["styles", ""]].map(([k, v]) =>
        <button key={k + v} type="button" onClick={() => onChange(k, v)}>{`set ${k}=${v}`}</button>)}
    </div>
  ),
}));

const owner = (u: string) => ({ id: u, username: u, displayName: u.toUpperCase(), avatarUrl: null });
const look = (id: string) => ({ schemeId: id, title: `Look ${id}`, owner: owner(`u${id}`), hype: { status: "NOT_CALCULATED" }, likes: 1, mannequin: { sex: "MASCULINO", head: "FOTO" }, pieces: [{ id: "p" + id, name: "Peça", imageUrl: "/m/p.jpg" }, { id: "q" + id, name: "Sem foto", imageUrl: null }] });
const row = (position: number, id: string, o: object = {}) => ({ position, schemeId: id, title: `Look ${id}`, owner: owner(`u${id}`), hype: null, likes: 0, country: null, region: "SA", you: false, ...o });
const base = (o: object = {}) => ({ date: "2026-10-05", nextUpdate: "", total: 30, totalToday: 30, ranking: "TOP100_GLOBAL", rankings: ["TOP100_GLOBAL", "SEGUINDO", "EM_ALTA", "XYZ"],
  looks: [{ position: 1, source: "MANUAL", carriedOver: false, look: look("s1") }, { position: 2, source: "MANUAL", carriedOver: false, look: look("s2") }],
  table: [row(1, "s1", { you: true, country: "BR" }), row(2, "s2"), row(20, "s20")], batch: { offset: 0, limit: 12, from: 1, to: 12, hasNext: true, hasPrev: false },
  facets: { regions: [{ code: "SA", label: "América do Sul", count: 9 }], countries: [{ value: "BR", count: 5 }], colors: [{ value: "black", count: 2 }], occasions: [{ value: "party", count: 1 }], styles: [{ value: "edgy", count: 3 }] }, ...o });
const lastQuery = (calls: { path: string }[]) => new URL("http://x" + calls.filter((c) => c.path.startsWith("/api/explorer/runway")).at(-1)!.path).searchParams;

beforeEach(() => { __resetHypeStore(); gl.ok = true; localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("RunwayPanel — filtros e lotes", () => {
  it("cada filtro vira parâmetro; região troca o ranking global para regional; ranking limpa região/país", async () => {
    const { calls } = mockApi({ "GET /api/explorer/runway": (u: URL) => base({ ranking: u.searchParams.get("ranking") }) });
    renderApp(<RunwayPanel />);
    await screen.findByText(/Desfile de/);
    expect(screen.getByTestId("quick").textContent).toBe("Top 100 Global|Em alta|XYZ");   // sem sessão, sem "Seguindo"
    expect(screen.getByTestId("opts").textContent).toContain("region:América do Sul (9)");
    expect(screen.getByTestId("opts").textContent).toContain("country:BR (5)");
    fireEvent.click(screen.getByText("set region=SA"));
    await waitFor(() => expect(lastQuery(calls).get("ranking")).toBe("TOP100_REGIONAL"));
    expect(lastQuery(calls).get("region")).toBe("SA");
    fireEvent.click(screen.getByText("set country=BR"));
    fireEvent.click(screen.getByText("set sex=MASCULINO"));
    fireEvent.click(screen.getByText("set colors=black,red"));
    fireEvent.click(screen.getByText("set occasions=party"));
    fireEvent.click(screen.getByText("set styles=edgy"));
    await waitFor(() => expect(lastQuery(calls).getAll("colors")).toEqual(["black", "red"]));
    const q = lastQuery(calls);
    expect([q.get("country"), q.get("sex"), q.getAll("occasions"), q.getAll("styles")]).toEqual(["BR", "MASCULINO", ["party"], ["edgy"]]);
    fireEvent.click(screen.getByText("set styles="));
    await waitFor(() => expect(lastQuery(calls).getAll("styles")).toEqual([]));
    fireEvent.click(screen.getByText("set ranking=TOP100_PAIS"));
    await waitFor(() => expect(lastQuery(calls).get("ranking")).toBe("TOP100_PAIS"));
    expect(lastQuery(calls).get("region")).toBeNull();
    expect(lastQuery(calls).get("country")).toBe("BR");
    fireEvent.click(screen.getByText("set ranking="));
    await waitFor(() => expect(lastQuery(calls).get("ranking")).toBe("TOP100_GLOBAL"));
    expect(lastQuery(calls).get("country")).toBeNull();
    fireEvent.click(screen.getByText("set ranking=TOP100_REGIONAL"));
    fireEvent.click(screen.getByText("set region=SA"));
    await waitFor(() => expect(lastQuery(calls).get("region")).toBe("SA"));
    expect(lastQuery(calls).get("ranking")).toBe("TOP100_REGIONAL");
    fireEvent.click(screen.getByText("set region="));
    await waitFor(() => expect(lastQuery(calls).get("region")).toBeNull());
  });

  it("lotes: próximo/anterior mudam o offset; a linha fora do lote pula para o lote dela", async () => {
    const { calls } = mockApi({ "GET /api/explorer/runway": (u: URL) => { const off = Number(u.searchParams.get("offset")); return base({ batch: { offset: off, limit: 12, from: off + 1, to: off + 12, hasNext: off === 0, hasPrev: off > 0 } }); } });
    renderApp(<RunwayPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Próximo lote →" }));
    await waitFor(() => expect(lastQuery(calls).get("offset")).toBe("12"));
    expect(await screen.findByText("Desfilando #13–#24 de 30")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "← Lote anterior" }));
    await waitFor(() => expect(lastQuery(calls).get("offset")).toBe("0"));
    fireEvent.click(await screen.findByRole("button", { name: /#20/ }));
    await waitFor(() => expect(lastQuery(calls).get("offset")).toBe("12"));
  });

  it("tabela escolhe o look no lote; 'você', país ausente e a ordem de Em alta", async () => {
    mockApi({ "GET /api/explorer/runway": base({ ranking: "EM_ALTA" }) });
    renderApp(<RunwayPanel />);
    expect(await screen.findByText(/Ordem: crescimento recente/)).toBeTruthy();
    expect(screen.getByText(/@us1\(você\)/)).toBeTruthy();
    expect(screen.getAllByText("· —", { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText("Look s1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /#2 / }));
    expect(await screen.findByText("Look s2")).toBeTruthy();
    expect(screen.getByText(/manequim masculino.*com foto|manequim .*com foto/)).toBeTruthy();
  });
});

describe("RunwayPanel — você, vazio e 3D", () => {
  it("logado: saiu da passarela, desfila com/sem posição e marcar o Look do Dia", async () => {
    loggedAs(undefined, { "GET /api/explorer/runway": base({ you: { optedOut: true, hasLook: false, position: null } }) });
    renderApp(<RunwayPanel />);
    expect((await screen.findByRole("link", { name: "Você saiu da passarela — voltar" })).getAttribute("href")).toBe("/settings");
    expect(screen.getByTestId("quick").textContent).toContain("Seguindo");
    cleanup();
    loggedAs(undefined, { "GET /api/explorer/runway": base({ you: { optedOut: false, hasLook: true, position: 3 } }) });
    renderApp(<RunwayPanel />);
    expect(await screen.findByText("Você desfila hoje · #3 no Top 100 Global")).toBeTruthy();
    cleanup();
    loggedAs(undefined, { "GET /api/explorer/runway": base({ you: { optedOut: false, hasLook: true, position: null } }) });
    renderApp(<RunwayPanel />);
    expect(await screen.findByText("Você desfila hoje")).toBeTruthy();
    cleanup();
    loggedAs(undefined, { "GET /api/explorer/runway": base({ you: { optedOut: false, hasLook: false, position: null } }) });
    renderApp(<RunwayPanel />);
    expect((await screen.findByRole("link", { name: "Marcar meu Look do Dia" })).getAttribute("href")).toContain("espelho=1");
  });

  it("vazio: sem filtros 'ninguém desfilou'; com filtro 'nenhum look com esses filtros'", async () => {
    mockApi({ "GET /api/explorer/runway": base({ looks: [], table: [] }) });
    renderApp(<RunwayPanel />);
    expect(await screen.findByText("Ninguém desfilou hoje ainda.")).toBeTruthy();
    fireEvent.click(screen.getByText("set sex=MASCULINO"));
    expect(await screen.findByText("Nenhum look com esses filtros hoje.")).toBeTruthy();
  });

  it("2D com WebGL oferece o 3D e lembra a escolha; sem WebGL mostra o aviso", async () => {
    mockApi({ "GET /api/explorer/runway": base() });
    renderApp(<RunwayPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Look #2 de @us2" }));
    expect(await screen.findByText("Look s2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver desfile em 3D" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Look #1 de @us1" })).toBeNull());
    expect(localStorage.getItem("fai.runway3d")).toBe("1");
    cleanup();
    renderApp(<RunwayPanel />);
    await screen.findByText(/Desfile de/);
    expect(screen.queryByRole("button", { name: "Ver desfile em 3D" })).toBeNull();
    cleanup();
    localStorage.clear(); gl.ok = false;
    renderApp(<RunwayPanel />);
    expect(await screen.findByText("3D indisponível: passarela em 2D")).toBeTruthy();
  });

  it("erro na API mostra tentar de novo", async () => {
    mockApi({ "GET /api/explorer/runway": () => new Response(JSON.stringify({ status: 500, message: "Passarela fora" }), { status: 500, headers: { "content-type": "application/json" } }) });
    renderApp(<RunwayPanel />);
    expect(await screen.findByText("Passarela fora")).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { PIECE, PIECE_2 } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { label } from "@/lib/api/taxonomy";
import type { LensDetectionView, LensMatchView, LensReadingView, LensRecreatePlan, LensScanView } from "@/lib/lens/types";
import { LensResult } from "@/components/lens/lens-result";

const det = (over: Partial<LensDetectionView>): LensDetectionView => ({
  id: "d1", ordinal: 1, box: { x: 20, y: 10, w: 40, h: 35 }, label: "Jaqueta jeans", category: "upper_piece", subcategory: "jacket",
  colors: [{ name: "light_blue", hex: "#9ec5f4", share: 0.7 }], material: "DENIM", pattern: "solid", styles: ["casual", "urban"], occasions: ["casual"],
  confidence: 0.86, confidenceBand: "HIGH", status: "DETECTED", wanted: false, ownedItemId: null, topMatch: null, ...over,
});
const D1 = det({});
const D2 = det({ id: "d2", ordinal: 2, box: { x: 25, y: 48, w: 35, h: 35 }, label: "Calça jeans", category: "lower_piece", subcategory: "jeans", confidence: 0.6, confidenceBand: "MEDIUM" });
const D3 = det({ id: "d3", ordinal: 3, box: { x: 30, y: 86, w: 30, h: 12 }, label: "Tênis branco", category: "shoes_piece", subcategory: "sneakers", confidence: 0.4, confidenceBand: "LOW" });
const READING: LensReadingView = {
  styles: [{ key: "casual", share: 60 }, { key: "urban", share: 40 }], palette: [{ name: "light_blue", hex: "#9ec5f4" }, { name: "white", hex: "#ffffff" }],
  occasions: ["casual"], season: "summer",
  fit: { score: 72, parts: { styles: 80, colors: 60, occasions: 70 } },
  trend: { status: "AVAILABLE", key: "cc:upper_piece:light_blue", label: "jaquetas azul-claras", score: 81, level: "HOT", direction: "UP", items: 12 },
  impact: { ownedMatches: 2, gaps: 1, redundancy: 0 },
};
const scanOf = (over: Partial<LensScanView> = {}): LensScanView => ({
  id: "s1", status: "READY", errorCode: null, source: "GALLERY", intent: "IDENTIFY", createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 10 * 86_400_000 - 60_000).toISOString(), savedAt: null, width: 800, height: 1000, facesRedacted: 1,
  aiSource: "ia", algorithmVersion: "LENS_V1", modelVersion: "test", detections: [D1, D2, D3], reading: READING, ...over,
});
const match = (piece = PIECE, similarity = 86): LensMatchView => ({
  scope: "MY_CLOSET", targetType: "PIECE", targetId: piece.id, similarity, components: { visual: 80, attributes: 90, color: 85 },
  reasons: ["SAME_SUBCATEGORY", "COLOR_CLOSE", "STYLE_OVERLAP", "VISUAL_CLOSE"], piece,
});
const TAXONOMY = { subcategories: { upper_piece: ["jacket", "t_shirt"], lower_piece: ["jeans"], shoes_piece: ["sneakers"] }, colors: { light_blue: "#9ec5f4", blue: "#1f4fa0" },
  materials: ["DENIM", "COTTON"], sizes: ["m"], sexes: ["UNISSEX"], occasions: ["casual"], styles: ["casual", "urban", "basic"], allowedOccasionsByCategory: {} };
const PLAN = (mode: string): LensRecreatePlan => ({
  mode: mode as LensRecreatePlan["mode"],
  slots: [
    { slot: "TOP", detectionId: "d1", state: "own", piece: PIECE, alternatives: [{ ...PIECE, id: "p3", name: "Camisa xadrez" }] },
    { slot: "BOTTOM", detectionId: "d2", state: "own", piece: PIECE_2, alternatives: [] },
    { slot: "SHOES", detectionId: "d3", state: "gap", piece: null, alternatives: [] },
  ],
  pieceIds: ["p1", "p2"], scores: { compatibility: 74, hype: 61, novelty: null, reuse: 40, usage: 55, sustainability: 70 }, createHref: "/schemes/new?pieces=p1,p2",
});

type Routes = Record<string, unknown>;
const open = (routes: Routes = {}, scan: LensScanView = scanOf()) => {
  const api = loggedAs(undefined, { "GET /api/taxonomy": TAXONOMY, "GET /api/lens/scans/s1": scan, ...routes });
  renderApp(<LensResult scanId="s1" />);
  return api;
};
const count = (api: ReturnType<typeof loggedAs>, method: string, prefix: string) => api.calls.filter((c) => c.method === method && c.path.startsWith(prefix)).length;

beforeEach(() => { __resetHypeStore(); router.push.mockClear(); router.replace.mockClear(); nav.search = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; nav.search = new URLSearchParams(); });

describe("Lens › resultado: hotspots, foco e abas", () => {
  it("cada peça vira um hotspot acessível, na ordem de leitura, com a confiança em texto", async () => {
    open();
    const hotspots = within(await screen.findByRole("list", { name: "Peças encontradas na foto" })).getAllByRole("button");
    expect(hotspots.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Peça 1 de 3: Jaqueta jeans, alta confiança",
      "Peça 2 de 3: Calça jeans, média confiança",
      "Peça 3 de 3: Tênis branco, baixa confiança, confira esta leitura",
    ]);
    expect(hotspots[2].className).toContain("is-low");
    // o hotspot fica no centro da caixa da roupa
    expect((hotspots[0].parentElement as HTMLElement).style.left).toBe("40%");
    expect((hotspots[0].parentElement as HTMLElement).style.top).toBe("27.5%");
    // avisos: expiração e rostos borrados, em texto
    expect(screen.getByText("Expira em 10 dias. Salve como inspiração para manter.")).toBeTruthy();
    expect(screen.getByText(/1 rosto foi borrado/)).toBeTruthy();
    // Leitura (padrão): o card do look + um card por peça
    expect(screen.getByRole("tab", { name: "Leitura" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("article", { name: "Leitura de Look inteiro" })).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getAllByRole("article", { name: /^Peça \d de 3:/ })).toHaveLength(3);
  });

  it("tocar num hotspot põe a peça em FOCO (URL), e o foco atravessa as abas", async () => {
    const api = open({ "GET /api/lens/scans/s1/reading": { ...READING, impact: { ownedMatches: 1, gaps: 0, redundancy: 0 } }, "GET /api/lens/scans/s1/matches": { items: [match(PIECE_2, 78)] } });
    fireEvent.click(await screen.findByRole("button", { name: "Peça 2 de 3: Calça jeans, média confiança" }));
    expect(router.push).toHaveBeenLastCalledWith("/lens/s1?focus=d2", { scroll: false });
    expect(screen.getByRole("button", { name: "Peça 2 de 3: Calça jeans, média confiança" }).getAttribute("aria-pressed")).toBe("true");
    const focus = screen.getByRole("group", { name: "Foco da leitura" });
    expect(within(focus).getByRole("button", { name: "Calça jeans" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(focus).getByRole("button", { name: "Look inteiro" }).getAttribute("aria-pressed")).toBe("false");
    // Leitura: só a peça em foco
    expect(await screen.findByRole("article", { name: "Leitura de Calça jeans" })).toBeTruthy();
    expect(screen.getAllByRole("article", { name: /^Peça \d de 3:/ })).toHaveLength(1);
    // trocar de aba mantém o foco (URL e consulta)
    fireEvent.click(screen.getByRole("tab", { name: "Seu guarda-roupa" }));
    expect(router.replace).toHaveBeenLastCalledWith("/lens/s1?tab=closet&focus=d2", { scroll: false });
    expect(await screen.findByText("Semelhança 78%")).toBeTruthy();
    expect(api.calls.some((c) => c.path === "/api/lens/scans/s1/matches?detection=d2&scope=MY_CLOSET")).toBe(true);
    expect(screen.getByText("Você já tem 1 peça parecida")).toBeTruthy();
    // "Look inteiro" tira o foco
    fireEvent.click(within(focus).getByRole("button", { name: "Look inteiro" }));
    expect(router.push).toHaveBeenLastCalledWith("/lens/s1?tab=closet", { scroll: false });
  });

  it("?tab= e ?focus= da URL abrem direto na aba e na peça (link do Histórico/Copilot)", async () => {
    nav.search = new URLSearchParams("tab=style&focus=d1");
    const api = open({ "GET /api/lens/scans/s1/reading": READING });
    expect(await screen.findByRole("tab", { name: "Estilo & Hype" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Estilo & Hype" }).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByText(/peças parecidas com “Jaqueta jeans”/)).toBeTruthy();
    expect(api.calls.some((c) => c.path === "/api/lens/scans/s1/reading?detection=d1")).toBe(true);
  });
});

describe("Lens › card da peça (frente e verso)", () => {
  it("só o ↻ vira o card; o verso é a leitura da peça; 'Não é roupa' tira a peça e dá para desfazer", async () => {
    const api = open({
      "GET /api/lens/scans/s1/reading": READING,
      "PATCH /api/lens/scans/s1/detections/d1": D1,
    });
    const front = await screen.findByRole("article", { name: "Peça 1 de 3: Jaqueta jeans" });
    expect(within(front).getByText("alta confiança")).toBeTruthy();
    expect(within(front).getByText("Azul-claro")).toBeTruthy();
    expect(within(front).getByText("Sem correspondência no seu guarda-roupa")).toBeTruthy();
    fireEvent.click(within(front).getByRole("button", { name: "Ver a leitura de Jaqueta jeans" }));
    const back = await screen.findByRole("region", { name: "Leitura de Jaqueta jeans" });
    expect(within(back).getByText("Leitura da peça")).toBeTruthy();
    expect(within(back).getByText("Confiança da leitura")).toBeTruthy();
    expect(within(back).getByText("86%")).toBeTruthy();
    expect(await within(back).findByText("72%")).toBeTruthy();         // compatibilidade, separada
    expect(within(back).getByText("Em alta")).toBeTruthy();            // Hype do grupo
    fireEvent.click(within(back).getByRole("button", { name: "Não é roupa" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Peça \d de 3: Jaqueta jeans/ })).toBeNull());
    expect(api.calls.find((c) => c.method === "PATCH")!.body).toEqual({ dismissed: true });
    expect(screen.getByText("“Jaqueta jeans” saiu da leitura.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    // volta para a mesma posição na ordem de leitura
    expect(await screen.findByRole("button", { name: "Peça 1 de 3: Jaqueta jeans, alta confiança" })).toBeTruthy();
    expect(api.calls.filter((c) => c.method === "PATCH").map((c) => c.body)).toEqual([{ dismissed: true }, { dismissed: false }]);
  });

  it("Quero marca a peça (PUT want) e o botão fica pressionado", async () => {
    const api = open({ "PUT /api/lens/scans/s1/detections/d2/want": { ...D2, wanted: true } });
    const card = await screen.findByRole("article", { name: "Peça 2 de 3: Calça jeans" });
    fireEvent.click(within(card).getByRole("button", { name: "Quero" }));
    expect(await within(card).findByRole("button", { name: "Na lista de desejos" })).toBeTruthy();
    expect(api.calls.find((c) => c.method === "PUT")!.body).toEqual({ wanted: true });
  });
});

describe("Lens › Seu guarda-roupa", () => {
  it("sem correspondência: 'Sem correspondência' + a LACUNA — nunca '0%'", async () => {
    nav.search = new URLSearchParams("tab=closet&focus=d1");
    open({ "GET /api/lens/scans/s1/reading": { ...READING, impact: { ownedMatches: 0, gaps: 1, redundancy: 0 } }, "GET /api/lens/scans/s1/matches": { items: [] } });
    expect(await screen.findByText("Sem correspondência no seu guarda-roupa")).toBeTruthy();
    const gap = screen.getByRole("article", { name: "Lacuna: Jaqueta jeans" });
    expect(within(gap).getByText("Você ainda não tem uma peça assim")).toBeTruthy();
    expect(screen.getByText("Nada parecido no seu guarda-roupa ainda")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\b0\s?%/);
    // "Ver na comunidade" leva à aba Descobrir com o mesmo foco
    fireEvent.click(within(gap).getByRole("button", { name: "Ver na comunidade" }));
    expect(router.push).toHaveBeenLastCalledWith("/lens/s1?tab=discover&focus=d1", { scroll: false });
    expect(await screen.findByText(/ordenadas só pela semelhança/)).toBeTruthy();
  });

  it("corrigir a leitura grava o PATCH e refaz as correspondências sem recarregar a página", async () => {
    nav.search = new URLSearchParams("tab=closet&focus=d1");
    let matchCalls = 0;
    const api = open({
      "GET /api/lens/scans/s1/reading": READING,
      "GET /api/lens/scans/s1/matches": () => (++matchCalls === 1 ? { items: [] } : { items: [match(PIECE, 86)] }),
      "PATCH /api/lens/scans/s1/detections/d1": (_u: URL, init: RequestInit) => ({ ...D1, ...JSON.parse(String(init.body)), status: "CORRECTED", topMatch: { pieceId: "p1", similarity: 86 } }),
    });
    expect(await screen.findByText("Sem correspondência no seu guarda-roupa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Corrigir" }));
    const dialog = await screen.findByRole("dialog", { name: "Corrigir a leitura de Jaqueta jeans" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Subcategoria" })).toBeTruthy());
    fireEvent.click(within(dialog).getByRole("button", { name: "Subcategoria" }));
    fireEvent.click(await within(dialog).findByRole("option", { name: label("t_shirt") }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar correção" }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "PATCH" && c.path === "/api/lens/scans/s1/detections/d1")).toBe(true));
    expect(api.calls.find((c) => c.method === "PATCH")!.body).toEqual({ subcategory: "t_shirt" });
    expect(await screen.findByText("Semelhança 86%")).toBeTruthy();
    expect(screen.getByText("mesma subcategoria · cor próxima · estilo em comum")).toBeTruthy();   // até 3 motivos, em texto
    expect(matchCalls).toBe(2);
    expect(api.calls.filter((c) => c.method === "GET" && c.path === "/api/lens/scans/s1")).toHaveLength(1);   // o scan não foi recarregado
    // o hotspot passa a dizer que a peça foi corrigida
    expect(screen.getByRole("button", { name: "Peça 1 de 3: Jaqueta jeans, alta confiança, corrigida" })).toBeTruthy();
  });
});

describe("Lens › Recriar", () => {
  it("trocar o modo refaz o plano; slot fixado vai como `locked`; Salvar como look usa o createHref", async () => {
    nav.search = new URLSearchParams("tab=recreate");
    const api = open({ "POST /api/lens/scans/s1/recreate": (_u: URL, init: RequestInit) => PLAN(JSON.parse(String(init.body)).mode) });
    expect(await screen.findByRole("region", { name: "Parte de cima" })).toBeTruthy();
    expect(api.calls.filter((c) => c.path === "/api/lens/scans/s1/recreate").map((c) => c.body)).toEqual([{ mode: "SAFE" }]);
    expect(screen.getByRole("link", { name: "Salvar como look" }).getAttribute("href")).toBe("/schemes/new?pieces=p1,p2");
    // lacuna no slot de calçado; seis números lado a lado ("—" = sem base)
    expect(within(screen.getByRole("region", { name: "Calçado" })).getByText("Você ainda não tem uma peça assim")).toBeTruthy();
    expect(screen.getByText("Compatibilidade")).toBeTruthy();
    // alternativa com as setas → o link passa a levar a peça escolhida
    const top = screen.getByRole("region", { name: "Parte de cima" });
    fireEvent.click(within(top).getByRole("button", { name: "Próxima alternativa para Parte de cima" }));
    expect(screen.getByRole("link", { name: "Salvar como look" }).getAttribute("href")).toBe("/schemes/new?pieces=p3,p2");
    fireEvent.click(within(top).getByRole("button", { name: "Fixar" }));
    fireEvent.click(screen.getByRole("radio", { name: "Experimental" }));
    await waitFor(() => expect(api.calls.filter((c) => c.path === "/api/lens/scans/s1/recreate")).toHaveLength(2));
    expect(api.calls.filter((c) => c.path === "/api/lens/scans/s1/recreate")[1].body).toEqual({ mode: "EXPERIMENTAL", locked: { TOP: "p3" } });
    expect(screen.getByRole("link", { name: "Perguntar ao Copilot" }).getAttribute("href")).toMatch(/^\/copilot\?ask=/);
  });
});

describe("Lens › Estilo & Hype", () => {
  it("compatibilidade e Hype do grupo aparecem SEPARADOS, cada um com o próprio rótulo", async () => {
    nav.search = new URLSearchParams("tab=style");
    open();
    const section = await screen.findByRole("region", { name: "Combina com você e está em alta?" });
    const [fit, trend] = Array.from(section.querySelectorAll<HTMLElement>(".lens-tile"));
    expect(within(fit).getByText("Combina com você")).toBeTruthy();
    expect(within(fit).getByText("72%")).toBeTruthy();
    expect(within(fit).queryByText("Em alta")).toBeNull();
    expect(within(trend).getByText("Hype do grupo")).toBeTruthy();
    expect(within(trend).getByText("Em alta")).toBeTruthy();
    expect(within(trend).getByText("subindo")).toBeTruthy();
    expect(within(trend).getByText(/jaquetas azul-claras · 12 peças públicas/)).toBeTruthy();
    expect(within(trend).queryByText("72%")).toBeNull();
    expect(section.textContent).not.toContain("153");   // nunca somados
    expect(screen.getByText(/Os dois números nunca se somam/)).toBeTruthy();
  });

  it("sem DNA convida a criar; grupo com poucos itens = 'Dados insuficientes' (nunca 0)", async () => {
    nav.search = new URLSearchParams("tab=style");
    open({}, scanOf({ reading: { ...READING, fit: null, trend: { status: "INSUFFICIENT_DATA", key: null, label: null, score: null, level: null, direction: null, items: 2 } } }));
    expect(await screen.findByRole("link", { name: "Criar DNA" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Criar DNA" }).getAttribute("href")).toBe("/dna");
    expect(screen.getByText("Dados insuficientes")).toBeTruthy();
    expect(screen.getByText(/menos de 5 peças públicas parecidas/)).toBeTruthy();
  });
});

describe("Lens › estados e ações do scan", () => {
  it("NO_FASHION_FOUND: explica, dá dicas e permite marcar uma peça (nada de '0 peças')", async () => {
    let reloads = 0;
    const api = open({
      "GET /api/lens/scans/s1": () => (++reloads === 1 ? scanOf({ status: "NO_FASHION_FOUND", errorCode: "NO_FASHION_FOUND", detections: [] }) : scanOf({ detections: [D1] })),
      "POST /api/lens/scans/s1/detections": { ...D1, status: "ADDED_BY_USER" },
    });
    expect(await screen.findByText("Não encontramos roupas nesta foto")).toBeTruthy();
    expect(screen.getByText("Prefira luz natural e fundo simples.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tentar outra foto" }).getAttribute("href")).toBe("/lens");
    expect(document.body.textContent).not.toMatch(/\b0 peças/);
    fireEvent.click(screen.getByRole("button", { name: "Marcar uma peça" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Marcar uma peça" })).getByRole("button", { name: "Marcar a foto inteira" }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "POST" && c.path === "/api/lens/scans/s1/detections")).toBe(true));
    expect(api.calls.find((c) => c.path === "/api/lens/scans/s1/detections")!.body).toEqual({ box: { x: 0, y: 0, w: 100, h: 100 }, category: "upper_piece" });
    expect(await screen.findByRole("button", { name: "Peça 1 de 1: Jaqueta jeans, alta confiança" })).toBeTruthy();
  });

  it("FAILED por cota mostra a explicação; leitura local é avisada", async () => {
    open({}, scanOf({ status: "FAILED", errorCode: "QUOTA", detections: [], aiSource: "local" }));
    expect(await screen.findByText("Você usou os scans de hoje")).toBeTruthy();
    expect(screen.getByText(/Leitura local: a IA online não foi usada/)).toBeTruthy();
  });

  it("foto sem a confirmação da proteção dos rostos: a leitura local diz o porquê", async () => {
    open({}, scanOf({ errorCode: "REDACTION_UNCONFIRMED", aiSource: "local" }));
    expect(await screen.findByText(/a foto chegou sem a confirmação de que os rostos foram protegidos/)).toBeTruthy();
    expect(screen.queryByText(/Leitura local: a IA online não foi usada/)).toBeNull();
  });

  it("salvar como inspiração (PATCH saved) tira o aviso de expiração", async () => {
    const api = open({ "PATCH /api/lens/scans/s1": scanOf({ savedAt: new Date().toISOString(), expiresAt: null }) });
    const save = await screen.findByRole("button", { name: "Salvar como inspiração" });
    expect(screen.getByText(/Expira em 10 dias/)).toBeTruthy();
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvo como inspiração" }).getAttribute("aria-pressed")).toBe("true"));
    expect(api.calls.find((c) => c.method === "PATCH" && c.path === "/api/lens/scans/s1")!.body).toEqual({ saved: true });
    expect(screen.queryByText(/Expira em/)).toBeNull();
  });

  it("excluir pede confirmação, chama DELETE e volta para /lens", async () => {
    const api = open({ "DELETE /api/lens/scans/s1": undefined });
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Excluir este scan?" });
    expect(count(api, "DELETE", "/api/lens/scans/s1")).toBe(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir scan" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/lens"));
    expect(count(api, "DELETE", "/api/lens/scans/s1")).toBe(1);
  });

  it("scan de outra pessoa (404) vira 'Scan não encontrado' com saída", async () => {
    loggedAs(undefined, {});
    renderApp(<LensResult scanId="nao-e-meu" />);
    await settle();
    expect(await screen.findByText("Scan não encontrado")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Novo scan" })[0].getAttribute("href")).toBe("/lens");
  });
});

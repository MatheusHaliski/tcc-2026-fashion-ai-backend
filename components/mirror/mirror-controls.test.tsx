// @vitest-environment jsdom
/**
 * Painel do Espelho (RF28) dentro do Meu Quarto: só botões, células e listas — nenhum campo de formulário.
 *  - "Partes do look" na grade de células do Provador; a camada externa do servidor entra na Parte de cima (não existe
 *    "Camada externa" na tela); tocar abre a folha da parte (vestindo agora, guarda-roupa, sugestões).
 *  - "Para quem é o look" em chips; tipos fora do ar viram um aviso curto.
 *  - Vista-me por células de ocasião (+ humor/clima) e peças fixadas como âncoras; "Outra sugestão" depois do Vista-me.
 *  - Salvar em um toque, abrir no editor, provar no Provador, tira uma coisa / limpar com desfazer, GRWM com imagens.
 */
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { MirrorControls, wornOf, type MirrorData } from "./mirror-controls";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const TEE = { id: "a", name: "Camiseta preta", imageUrl: "/media/a.png", thumbnailUrl: "/media/a-thumb.png", addressLabel: "Porta 1", category: "upper_piece", subcategory: "t_shirt", slot: "upper", model3dUrl: "/media/a.glb" };
const JACKET = { id: "j", name: "Jaqueta jeans", imageUrl: "/media/j.png", category: "upper_piece", subcategory: "jacket", slot: "outer_layer" };
const JEANS = { id: "b", name: "Calça jeans", imageUrl: "/media/b.png", category: "lower_piece", subcategory: "jeans", slot: "lower" };
const DRESS = { id: "d", name: "Vestido floral", imageUrl: "/media/d.png", category: "full_body_piece", subcategory: "dress", slot: "dress" };
const RING = (i: number) => ({ id: `r${i}`, name: `Anel ${i}`, category: "accessory_piece", subcategory: "ring", slot: "accessory" });
const EMPTY: MirrorData = { slots: { outer_layer: null, upper: null, dress: null, lower: null, shoes: null, accessory: [] }, complete: false, missing: [{ slot: "upper", action: "Sugerir peça superior", message: "Esse look ainda não possui uma peça superior (ou um vestido)." }], actions: [] };
const state = (slots: Record<string, unknown>, extra: Partial<MirrorData> = {}): MirrorData => ({ ...EMPTY, missing: [], slots: { ...EMPTY.slots, ...slots } as MirrorData["slots"], ...extra });

function Harness({ initial, compact }: { initial: MirrorData; compact?: boolean }) {
  // o estado vive em quem usa o painel (o quarto); aqui um estado simples para observar as trocas
  const [data, setData] = useState(initial);
  return <MirrorControls data={data} setData={setData} reload={() => undefined} compact={compact} />;
}
const cell = (name: RegExp) => screen.getByRole("button", { name });

describe("MirrorControls — sem formulário", () => {
  it("nenhum campo de texto, seleção ou interruptor; tipos de look com 404 viram aviso curto e o resto do painel segue", async () => {
    loggedAs(undefined, {});                                                        // sem a rota: o simulador responde 404
    const { container } = renderApp(<Harness initial={EMPTY} />);
    await screen.findByText(/Tipos de look indisponíveis no momento/);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelectorAll("input, select, textarea, form, [role=switch], [role=combobox]")).toHaveLength(0);
    expect(cell(/^Parte de cima: Falta no look/).className).toContain("is-missing");
  });

  it("Partes do look: cinco células do Provador, camada externa dentro da Parte de cima, peça única cobre cima e baixo, acessórios n de 4", async () => {
    loggedAs(undefined, { "GET /api/tipos-look": [] });
    const { container, unmount } = renderApp(<Harness initial={state({ upper: TEE, outer_layer: JACKET, accessory: [RING(1), RING(2)] })} />);
    const parts = within(screen.getByRole("group", { name: "Partes do look" }));
    expect(parts.getAllByRole("button").map((b) => b.querySelector(".fitting-store-name")?.textContent)).toEqual(["Parte de cima", "Peça única", "Parte de baixo", "Calçado", "Acessório"]);
    expect(container.textContent).not.toMatch(/Camada externa/i);
    const top = cell(/^Parte de cima: Camiseta preta, Jaqueta jeans/);
    expect(top.querySelectorAll("img")).toHaveLength(2);
    expect(within(top).getByText("Camiseta preta + Jaqueta jeans")).toBeTruthy();
    expect(within(top).getByText("3D")).toBeTruthy();                                   // selo do asset real (model3dUrl)
    expect(within(cell(/^Acessório:/)).getByText("2 de 4")).toBeTruthy();
    unmount();
    renderApp(<Harness initial={state({ dress: DRESS })} />);
    expect(within(cell(/^Parte de baixo:/)).getByText("Coberto pela peça única")).toBeTruthy();
    expect(within(cell(/^Peça única: Vestido floral/)).getByText("Vestido floral")).toBeTruthy();
  });

  it("tocar na Parte de cima abre a folha: o guarda-roupa junta camisetas e jaquetas, vestir manda a peça e a vestida tem o card compacto", async () => {
    let current: MirrorData = EMPTY;
    const { calls } = loggedAs(undefined, {
      "GET /api/tipos-look": [{ id: "t1", codigo: "UNISEX", nome: "Unisex" }],
      "GET /api/me/mirror/wardrobe?slot=upper": { slot: "upper", pieces: [TEE] },
      "GET /api/me/mirror/wardrobe?slot=outer_layer": { slot: "outer_layer", pieces: [JACKET] },
      "POST /api/me/mirror/pieces": () => { current = state({ upper: TEE }); return current; },
    });
    renderApp(<Harness initial={EMPTY} />);
    fireEvent.click(cell(/^Parte de cima:/));
    const sheet = within(await screen.findByRole("dialog", { name: "Parte de cima" }));
    const picker = await sheet.findByTestId("mirror-wardrobe-picker");
    expect(within(picker).getAllByRole("button").map((b) => b.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Camiseta preta"), expect.stringContaining("Jaqueta jeans")]));
    fireEvent.click(within(picker).getByRole("button", { name: "Vestir Camiseta preta em Parte de cima" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/api/me/mirror/pieces")?.body).toEqual({ pieceId: "a" }));
    expect(wornOf(current).map((w) => w.slot)).toEqual(["upper"]);
    // vestindo agora: card compacto com o estado do asset (vocabulário do quarto), Tirar, Manter e o menu ⋯
    await waitFor(() => expect(sheet.getByText("Vestindo agora")).toBeTruthy());
    const row = sheet.getByText("Camiseta preta", { selector: ".piece-row-link" }).closest("li")!;
    expect(within(row).getByText("Modelo 3D")).toBeTruthy();
    expect(within(row).getByRole("link", { name: "Camiseta preta" }).getAttribute("href")).toBe("/pieces/a");
    fireEvent.click(within(row).getByRole("button", { name: /Mais ações/ }));
    expect((await screen.findByRole("menuitem", { name: "Provar no provador" })).getAttribute("href")).toBe("/try-on?provar=w.a");
    expect(screen.getByRole("menuitem", { name: "Mostrar no quarto" }).getAttribute("href")).toBe("/room?piece=a");
    expect(calls.some((c) => c.path.includes("/swap"))).toBe(false);
  });

  it("roupas em mãos (vocabulário do quarto): a célula conta as trazidas e a segurada; na folha, tocar veste e 'Tirar da lista' tira só da lista — pelo quarto (host)", async () => {
    loggedAs(undefined, { "GET /api/tipos-look": [], "GET /api/me/mirror/wardrobe?slot=upper": { pieces: [TEE] }, "GET /api/me/mirror/wardrobe?slot=outer_layer": { pieces: [] } });
    const host = { wear: vi.fn(), takeOff: vi.fn(), unlist: vi.fn() };
    const SHIRT = { id: "s", name: "Camisa listrada", category: "upper_piece" };              // lista antiga, sem slot: vai pela categoria
    const HELD = { id: "h", name: "Blusa na mão", category: "upper_piece" };
    renderApp(<MirrorControls data={state({ lower: JEANS }, { rack: [{ ...TEE, worn: false }, SHIRT, { ...JEANS, worn: true }] })} setData={() => undefined} reload={() => undefined} host={host} held={[HELD]} arrivedId="s" />);
    const top = cell(/^Parte de cima:/);
    expect(within(top).getByText("3 em mãos")).toBeTruthy(); expect(top.className).toContain("is-arrived");
    expect(within(cell(/^Parte de baixo:/)).queryByText(/em mãos/)).toBeNull();                 // a calça já está vestida
    fireEvent.click(top);
    const sheet = within(await screen.findByRole("dialog", { name: "Parte de cima" }));
    expect(sheet.getByRole("heading", { name: "Roupas em mãos" })).toBeTruthy();
    expect(sheet.queryByText("Na lista do espelho")).toBeNull();
    const hands = within(sheet.getByTestId("mirror-hands-picker"));
    expect(hands.getAllByRole("button", { name: /^Vestir / }).map((b) => b.getAttribute("aria-label"))).toEqual(["Vestir Blusa na mão em Parte de cima", "Vestir Camiseta preta em Parte de cima", "Vestir Camisa listrada em Parte de cima"]);
    expect(within(hands.getByRole("button", { name: /^Vestir Blusa/ })).getByText("Na mão")).toBeTruthy();
    expect(hands.queryByRole("button", { name: "Tirar Blusa na mão da lista do espelho" })).toBeNull();   // não está na lista
    fireEvent.click(hands.getByRole("button", { name: "Tirar Camisa listrada da lista do espelho" }));
    expect(host.unlist).toHaveBeenCalledWith(expect.objectContaining({ id: "s" }));
    fireEvent.click(hands.getByRole("button", { name: "Vestir Blusa na mão em Parte de cima" }));
    expect(host.wear).toHaveBeenCalledWith(expect.objectContaining({ id: "h" }));
    // no guarda-roupa, a peça já trazida diz que está em mãos
    const picker = within(await sheet.findByTestId("mirror-wardrobe-picker"));
    expect(within(picker.getByRole("button", { name: /Camiseta preta/ })).getByText("Já em mãos")).toBeTruthy();
  });

  it("sugestões mostram o porquê; sem candidatas, o caminho para cadastrar", async () => {
    loggedAs(undefined, {
      "GET /api/tipos-look": [], "GET /api/me/mirror/wardrobe": { pieces: [] },
      "GET /api/me/mirror/suggestions?slot=shoes": { slot: "shoes", alternatives: [{ ...JEANS, id: "s1", name: "Tênis branco", why: "Combina com a ocasião" }] },
      "GET /api/me/mirror/suggestions?slot=lower": () => new Response(JSON.stringify({ status: 422, code: "SEM_CANDIDATAS", message: "Você não tem peça disponível para esse lugar.", details: { href: "/pieces/new" } }), { status: 422, headers: { "content-type": "application/json" } }),
    });
    renderApp(<Harness initial={EMPTY} />);
    fireEvent.click(cell(/^Calçado:/));
    let sheet = within(await screen.findByRole("dialog", { name: "Calçado" }));
    fireEvent.click(sheet.getByRole("button", { name: "Sugerir calçado" }));
    expect(await sheet.findByText("Combina com a ocasião")).toBeTruthy();
    fireEvent.click(sheet.getByRole("button", { name: "Fechar" }));
    fireEvent.click(cell(/^Parte de baixo:/));
    sheet = within(await screen.findByRole("dialog", { name: "Parte de baixo" }));
    fireEvent.click(sheet.getByRole("button", { name: "Sugerir parte de baixo" }));
    expect(await sheet.findByText(/Você não tem peça disponível/)).toBeTruthy();
    expect(sheet.getAllByRole("link", { name: "Adicionar peça" }).some((a) => a.getAttribute("href") === "/pieces/new")).toBe(true);
  });

  it("Para quem é o look: chips de rádio com os nomes do banco; tocar salva o tipo", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/tipos-look": [{ id: "t1", codigo: "FEMININO", nome: "Feminino" }, { id: "t2", codigo: "MASCULINO", nome: "Masculino" }],
      "PUT /api/me/mirror/tipo-look": () => state({}, { tipoLook: { id: "t2", codigo: "MASCULINO", nome: "Masculino" } }),
    });
    renderApp(<Harness initial={EMPTY} />);
    const group = within(await screen.findByRole("radiogroup", { name: "Para quem é o look" }));
    fireEvent.click(await group.findByRole("radio", { name: "Masculino" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ tipoLookId: "t2" }));
    await waitFor(() => expect(group.getByRole("radio", { name: "Masculino" }).getAttribute("aria-checked")).toBe("true"));
  });

  it("Vista-me por ocasião + humor, com a peça fixada como âncora; mostra a sequência e libera Outra sugestão", async () => {
    const LOOK = state({ upper: TEE, lower: JEANS }, { origin: "vista_me", prompt: "Trabalho, Confortável", sequence: [{ pieceId: "a", name: "Camiseta preta", legend: "Camiseta preta — Porta 1" }], fallbackMessage: "Montado sem IA desta vez.", message: "Look para o trabalho" });
    const { calls } = loggedAs(undefined, { "GET /api/tipos-look": [], "GET /api/me/mirror/wardrobe": { pieces: [] }, "POST /api/me/mirror/vista-me": LOOK, "POST /api/me/mirror/another": LOOK });
    renderApp(<Harness initial={state({ upper: TEE })} />);
    expect((screen.getByRole("button", { name: "Outra sugestão" }) as HTMLButtonElement).disabled).toBe(true);
    // fixar a camiseta (Manter) na folha da parte
    fireEvent.click(cell(/^Parte de cima:/));
    const sheet = within(await screen.findByRole("dialog", { name: "Parte de cima" }));
    fireEvent.click(sheet.getByRole("button", { name: "Manter" }));
    fireEvent.click(sheet.getByRole("button", { name: "Fechar" }));
    expect(within(cell(/^Parte de cima:/)).getByText(/Fixada/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confortável" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Para onde é o look" })).getByRole("button", { name: /Trabalho/ }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/mirror/vista-me")?.body).toEqual({ prompt: "Trabalho, Confortável", anchorIds: ["a"] }));
    expect(await screen.findByText("Camiseta preta — Porta 1")).toBeTruthy();
    expect(screen.getByText("Montado sem IA desta vez.")).toBeTruthy();
    expect(screen.getByText("Look para o trabalho")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Outra sugestão" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/me/mirror/another")).toBe(true));
    // o último pedido vira a célula "Repetir"
    expect(screen.getByRole("button", { name: /Repetir último pedido/ })).toBeTruthy();
  });

  it("ações: salvar em um toque (título do servidor), editor e provador por link, usar hoje com um aviso só", async () => {
    const two = state({ upper: TEE, lower: JEANS }, { complete: true });
    const { calls } = loggedAs(undefined, { "GET /api/tipos-look": [], "POST /api/me/mirror/save": { schemeId: "s1", title: "Espelho · 10/10", origin: "SMART_MIRROR" }, "POST /api/me/mirror/use": { schemeId: "s1", message: "Look do Dia registrado!" } });
    const { unmount } = renderApp(<Harness initial={state({ upper: TEE })} />);
    expect((screen.getByRole("button", { name: "Salvar look" }) as HTMLButtonElement).disabled).toBe(true);   // o servidor pede 2 peças
    unmount();
    renderApp(<Harness initial={two} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar look" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/mirror/save")?.body).toEqual({ publish: false }));
    const notice = within(await screen.findByText("Salvo como «Espelho · 10/10»").then((n) => n.closest("[role=status]") as HTMLElement));
    expect(notice.getByRole("link", { name: "Ver look" }).getAttribute("href")).toBe("/schemes/s1");
    expect(notice.getByRole("link", { name: "Renomear" }).getAttribute("href")).toBe("/schemes/s1/edit");
    expect(screen.getByRole("link", { name: "Abrir no editor" }).getAttribute("href")).toBe("/schemes/new?pieces=a,b");
    expect(screen.getByRole("link", { name: /Provar o look no Provador/ }).getAttribute("href")).toBe("/try-on?provar=w.a,w.b");
    fireEvent.click(screen.getByRole("button", { name: /Usar este look hoje/ }));
    expect(await screen.findByText("Look do Dia registrado!")).toBeTruthy();
    expect(screen.getAllByText(/Look do Dia registrado/)).toHaveLength(1);
  });

  it("tira uma coisa (liberado pelo servidor) e limpar têm desfazer; GRWM mostra o roteiro com imagem e legenda", async () => {
    const full = state({ upper: TEE, lower: JEANS, accessory: [RING(1)] }, { complete: true, actions: ["TIRA_UMA_COISA"] });
    const { calls } = loggedAs(undefined, {
      "GET /api/tipos-look": [],
      "POST /api/me/mirror/take-one-off": { ...state({ upper: TEE, lower: JEANS }), removed: RING(1), why: "Menos é mais." },
      "POST /api/me/mirror/pieces": full,
      "DELETE /api/me/mirror": EMPTY,
      "GET /api/me/mirror/grwm": { steps: [{ at: 0, durationMs: 3000, pieceId: "a", imageUrl: "/media/a.png", caption: "Camiseta preta — Porta 1" }, { at: 3000, durationMs: 3000, moduleId: "mirror", caption: "Look pronto" }] },
    });
    renderApp(<Harness initial={full} compact />);
    fireEvent.click(screen.getByRole("button", { name: /Tira uma coisa/ }));
    expect(await screen.findByText("Tirei Anel 1. Menos é mais.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/api/me/mirror/pieces")?.body).toEqual({ pieceId: "r1" }));
    fireEvent.click(screen.getByRole("button", { name: "GRWM" }));
    const story = within(await screen.findByRole("dialog", { name: "GRWM · storyboard" }));
    expect(story.getByText("Camiseta preta — Porta 1")).toBeTruthy();
    expect(story.getByText("Look pronto")).toBeTruthy();
    expect(document.querySelectorAll(".mirror-grwm-card img")).toHaveLength(1);              // a peça tem foto; o fecho não
    fireEvent.click(story.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(await screen.findByText(/Espelho limpo/)).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/me/mirror")).toBe(true);
  });

  it("silhueta mostra letra e regra (não um objeto) e o desafio aparece também no modo compacto", async () => {
    loggedAs(undefined, { "GET /api/tipos-look": [] });
    const { container } = renderApp(<Harness compact initial={state({ upper: TEE, lower: JEANS }, { silhouette: { letter: "A", rule: "1/3 em cima, 2/3 embaixo" }, restriction: { challenge: "Cápsula de 10", allowed: 10 } })} />);
    expect(container.querySelector(".mirror-silhouette b")?.textContent).toBe("A");
    expect(screen.getByText("1/3 em cima, 2/3 embaixo")).toBeTruthy();
    expect(container.textContent).not.toContain("[object Object]");
    expect(screen.getByRole("note").textContent).toContain("Desafio Cápsula de 10 · 10 peças permitidas");
  });
});

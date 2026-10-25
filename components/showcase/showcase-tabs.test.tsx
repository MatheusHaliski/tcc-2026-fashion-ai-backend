// @vitest-environment jsdom
/**
 * Abas Eras (celebridade) e Coleções (marca) da vitrine — RF22: busca com filtros e header da era/coleção, cadastro e
 * ligação de looks/peças por quem administra o perfil, insights com mini palcos 2D e ranking de coleções, My Stage em
 * 2D quando o navegador não tem WebGL (no jsdom nunca tem).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { OWNER, PIECE, SCHEME, page } from "@/test-utils/fixtures";
import { CollectionsTab, ErasTab } from "./showcase-tabs";

/** Escolhe uma opção na lista do Select do FashionAI (botão que abre um listbox). */
async function pick(trigger: HTMLElement, option: string) {
  fireEvent.click(trigger);
  fireEvent.click(within(await screen.findByRole("listbox")).getByRole("option", { name: option }));
}
const chips = () => within(screen.getByRole("radiogroup", { name: /filtrar por/ }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const BASE = "/api/institutional/taylor/showcase";
const fail = () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "servidor caiu" }), { status: 500, headers: { "content-type": "application/json" } });
const g = (id: string, extra: object = {}) => ({ id, type: "ERA", label: `Era ${id}`, accentColor: "#AA0000", schemes: 2, pieces: 1, ...extra });
const LIST = { kind: "eras", owner: OWNER, items: [g("a", { coverUrl: "/media/a.png", period: "2019–2020" }), g("b")], ungrouped: { schemes: 3, pieces: 4 } };
const ITEMS = { header: null, schemes: [{ scheme: SCHEME, grouping: "Era a" }], pieces: [{ piece: PIECE, grouping: "Era b" }], years: [2019, 2020] };
const HEADER = g("a", { type: "TOUR", coverUrl: "/media/a.png", period: "2019–2020", description: "A turnê das luzes", coverSource: "esquema", periodFrom: 2019, periodTo: 2020 });
const itemsBy = (url: URL) => (url.searchParams.get("groupingId") ? { ...ITEMS, header: HEADER } : ITEMS);

const rank = (id: string, n: number, extra: object = {}) => ({
  ...g(id), rank: n, likes: 100 - n, items: 5, comments: 1, shares: 0, score: 90 - n, audience: 30, capacity: 120, audienceFraction: 0.25,
  fireworks: 0, spotlights: 3, hype: { top: 81, avg: 69.6, level: "HOT", items: 2 }, ...extra,
});

describe("Eras › busca por era", () => {
  it("sem filtro mostra o mosaico das capas, os looks e peças com a era de cada um e as opções de ano", async () => {
    const { calls } = mockApi({ [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: itemsBy });
    renderApp(<ErasTab slug="taylor" admin={false} />);
    const mosaic = await screen.findByLabelText("eras de Ana Souza");
    expect(within(mosaic).getAllByRole("button")).toHaveLength(2);
    expect(within(mosaic).getByText("2019–2020")).toBeTruthy();
    expect(await screen.findByText("Looks (1)")).toBeTruthy();
    expect(screen.getByText("Peças (1)")).toBeTruthy();
    expect(screen.getByText("era: Era a")).toBeTruthy();
    expect(screen.getByText("era: Era b")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ano: Qualquer ano" }));
    expect(within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Qualquer ano", "2019", "2020"]);
    expect(calls.every((c) => !c.path.includes("groupingId"))).toBe(true);
    // não administra: sem o cartão de cadastro
    expect(screen.queryByRole("button", { name: "Nova era" })).toBeNull();
  });

  it("escolher a era no mosaico filtra a busca e troca o mosaico pelo header da turnê com descrição e capa do look mais hypado", async () => {
    const { calls } = mockApi({ [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: itemsBy });
    const { container } = renderApp(<ErasTab slug="taylor" admin={false} />);
    const mosaic = await screen.findByLabelText("eras de Ana Souza");
    fireEvent.click(within(mosaic).getAllByRole("button")[0]);
    await waitFor(() => expect(container.querySelector(".showcase-hero h2")?.textContent).toBe("Era a"));
    expect(screen.getByText("turnê · 2019–2020")).toBeTruthy();
    expect(screen.getByText("A turnê das luzes")).toBeTruthy();
    expect(screen.getByText("2 looks · 1 peças· capa: look mais hypado")).toBeTruthy();
    expect(screen.getByAltText("Foto da era Era a")).toBeTruthy();
    expect(calls.some((c) => c.path.includes("groupingId=a"))).toBe(true);
    // com a era escolhida o card não repete a era
    expect(screen.queryByText("era: Era a")).toBeNull();
    // o chip "Todas as eras" volta ao mosaico
    fireEvent.click(screen.getByRole("button", { name: "Todas as eras" }));
    expect(await screen.findByLabelText("eras de Ana Souza")).toBeTruthy();
  });

  it("o chip de uma fase filtra e o header diz fase; uma era sem capa usa o fundo liso", async () => {
    mockApi({
      [`GET ${BASE}/eras`]: LIST,
      [`GET ${BASE}/eras/items`]: (url: URL) => {
        const id = url.searchParams.get("groupingId");
        if (id === "b") return { ...ITEMS, header: g("b", { type: "PHASE" }) };
        if (id === "a") return { ...ITEMS, header: g("a", { type: "ERA", coverUrl: null }) };
        return ITEMS;
      },
    });
    const { container } = renderApp(<ErasTab slug="taylor" admin={false} />);
    await screen.findByLabelText("eras de Ana Souza");
    fireEvent.click(chips().getByRole("button", { name: "Era b" }));
    expect(await screen.findByText("fase")).toBeTruthy();
    expect(container.querySelector(".showcase-hero-fallback")).toBeTruthy();
    fireEvent.click(chips().getByRole("button", { name: /Era a · 2019–2020/ }));
    await waitFor(() => expect(screen.getByText("era")).toBeTruthy());
  });

  it("busca, tipo, ordem e ano viram parâmetros da consulta", async () => {
    const { calls } = mockApi({ [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: itemsBy });
    renderApp(<ErasTab slug="taylor" admin={false} />);
    await screen.findByText("Looks (1)");
    fireEvent.change(screen.getByLabelText("buscar"), { target: { value: "vestido" } });
    await pick(screen.getByRole("button", { name: "tipo: Looks e peças" }), "Só peças");
    await pick(screen.getByRole("button", { name: "ordenar: Maior Hype Score" }), "Em crescimento");
    await pick(screen.getByRole("button", { name: "ano: Qualquer ano" }), "2020");
    await waitFor(() => expect(calls.some((c) => c.path.includes("q=vestido") && c.path.includes("type=PECAS") && c.path.includes("sort=GROWTH") && c.path.includes("year=2020"))).toBe(true));
  });

  it("sem eras cadastradas e sem itens mostra os estados vazios", async () => {
    mockApi({ [`GET ${BASE}/eras`]: { ...LIST, items: [] }, [`GET ${BASE}/eras/items`]: { header: null, schemes: [], pieces: [], years: [] } });
    renderApp(<ErasTab slug="taylor" admin={false} />);
    expect(await screen.findByText("Nenhuma era cadastrada ainda.")).toBeTruthy();
    expect(await screen.findByText("Nada nesta era com esses filtros.")).toBeTruthy();
    expect(screen.getByText("Tente outro ano, outro termo ou todas as opções.")).toBeTruthy();
  });

  it("falha ao listar as eras mostra o erro com Tentar de novo, que busca de novo", async () => {
    let n = 0;
    const { calls } = mockApi({ [`GET ${BASE}/eras`]: () => (n++ === 0 ? fail() : LIST), [`GET ${BASE}/eras/items`]: ITEMS });
    renderApp(<ErasTab slug="taylor" admin={false} />);
    expect(await screen.findByText("Algo deu errado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByLabelText("eras de Ana Souza")).toBeTruthy();
    expect(calls.filter((c) => c.path === `${BASE}/eras`).length).toBe(2);
  });
});

describe("Eras › cadastro por quem administra", () => {
  it("mostra os itens sem era e cria uma era nova com período, cor e capa enviada", async () => {
    const { calls } = mockApi({
      [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: itemsBy,
      "POST /api/era-studio/uploads": { url: "/media/capa.png" }, "POST /api/groupings": { id: "n1" },
    });
    renderApp(<ErasTab slug="taylor" admin />);
    expect(await screen.findByText("3 look(s) e 4 peça(s) ainda sem era.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nova era" }));
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await pick(within(dialog).getByLabelText("Tipo"), "Turnê");
    fireEvent.change(within(dialog).getByLabelText(/^Nome/), { target: { value: "Eras Tour" } });
    fireEvent.change(within(dialog).getByLabelText("Descrição"), { target: { value: "Shows" } });
    fireEvent.change(within(dialog).getByLabelText("De (ano)"), { target: { value: "2023" } });
    fireEvent.change(within(dialog).getByLabelText("Até (ano)"), { target: { value: "2024" } });
    fireEvent.change(within(dialog).getByLabelText("Cor"), { target: { value: "#ff00aa" } });
    const file = new File(["x"], "capa.png", { type: "image/png" });
    fireEvent.change(within(dialog).getByLabelText("Foto da era"), { target: { files: [file] } });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Remover" })).toBeTruthy());
    expect(within(dialog).getByText(/A foto aparece no header da busca por era/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Era salva")).toBeTruthy();
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/groupings")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ type: "TOUR", label: "Eras Tour", description: "Shows", periodFrom: 2023, periodTo: 2024, accentColor: "#FF00AA", coverUrl: "/media/capa.png" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.filter((c) => c.path === `${BASE}/eras`).length).toBeGreaterThanOrEqual(2);
  });

  it("sem período e sem capa manda nulos; tirar a capa enviada limpa a prévia; falha no envio avisa", async () => {
    const { calls } = mockApi({
      [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: itemsBy,
      "POST /api/era-studio/uploads": () => fail(), "POST /api/groupings": { id: "n1" },
    });
    renderApp(<ErasTab slug="taylor" admin />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova era" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Foto da era"), { target: { files: [new File(["x"], "c.png", { type: "image/png" })] } });
    expect(await screen.findByText("servidor caiu")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Remover" })).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Foto da era"), { target: { files: [] } });
    fireEvent.change(within(dialog).getByLabelText(/^Nome/), { target: { value: "Folklore" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/groupings")).toBe(true));
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/groupings")!.body).toMatchObject({ label: "Folklore", periodFrom: null, periodTo: null, coverUrl: null, type: "ERA" });
  });

  it("fechar o diálogo sem salvar não recarrega a lista", async () => {
    const { calls } = mockApi({ [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: itemsBy });
    renderApp(<ErasTab slug="taylor" admin />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova era" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.filter((c) => c.path === `${BASE}/eras`).length).toBe(1);
  });

  it("com uma era escolhida edita (PUT), remove a capa enviada, exclui e mostra o erro do servidor", async () => {
    const uploaded = { ...HEADER, coverSource: "upload" };
    let del = 0;
    const { calls } = mockApi({
      [`GET ${BASE}/eras`]: LIST,
      [`GET ${BASE}/eras/items`]: (url: URL) => (url.searchParams.get("groupingId") ? { ...ITEMS, header: uploaded } : ITEMS),
      "PUT /api/groupings/a": { id: "a" },
      "DELETE /api/groupings/a": () => (del++ === 0 ? fail() : undefined),
    });
    renderApp(<ErasTab slug="taylor" admin />);
    const mosaic = await screen.findByLabelText("eras de Ana Souza");
    fireEvent.click(within(mosaic).getAllByRole("button")[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Editar era" }));
    let dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Era a");
    expect((within(dialog).getByLabelText("De (ano)") as HTMLInputElement).value).toBe("2019");
    expect(within(dialog).getByLabelText("Tipo").textContent).toBe("Turnê");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }));
    expect(within(dialog).queryByRole("button", { name: "Remover" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.path === "/api/groupings/a")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")!.body).toMatchObject({ coverUrl: null, periodFrom: 2019, periodTo: 2020 });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(calls.filter((c) => c.path === `${BASE}/eras`).length).toBe(2));
    await screen.findByText("3 look(s) e 4 peça(s) ainda sem era.");

    fireEvent.click(await screen.findByRole("button", { name: "Editar era" }));
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("servidor caiu")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.filter((c) => c.method === "DELETE").length).toBe(2);
  });

  it("salvar com erro do servidor mantém o diálogo aberto e avisa", async () => {
    mockApi({ [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: itemsBy, "POST /api/groupings": () => fail() });
    renderApp(<ErasTab slug="taylor" admin />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova era" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Nome/), { target: { value: "Reputation" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("servidor caiu")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("liga looks e peças à era escolhida (marca e desmarca antes de enviar)", async () => {
    const S2 = { ...SCHEME, id: "s2", title: "Look de sábado", coverImageUrl: null };
    const P2 = { ...PIECE, id: "p9", name: "Bota", studioThumbUrl: null, thumbnailUrl: null, imageUrl: null };
    let fails = 1;
    const { calls } = mockApi({
      [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: itemsBy,
      "GET /api/me/schemes": page([SCHEME, S2]), "GET /api/me/closet": page([PIECE, P2]),
      "POST /api/groupings/a/items": () => (fails-- > 0 ? fail() : { ok: true }),
    });
    renderApp(<ErasTab slug="taylor" admin />);
    const mosaic = await screen.findByLabelText("eras de Ana Souza");
    fireEvent.click(within(mosaic).getAllByRole("button")[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Ligar looks e peças" }));
    const dialog = await screen.findByRole("dialog", { name: "Ligar à era Era a" });
    const send = within(dialog).getByRole("button", { name: "Ligar 0 item(ns)" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(await within(dialog).findByRole("button", { name: "Look de sexta" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Look de sábado" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Look de sábado" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Bota" }));
    expect(within(dialog).getByRole("button", { name: "Look de sexta" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(dialog).getByRole("button", { name: "Look de sábado" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ligar 2 item(ns)" }));
    expect(await screen.findByText("servidor caiu")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ligar 2 item(ns)" }));
    expect(await screen.findByText("Ligados")).toBeTruthy();
    expect(calls.filter((c) => c.path === "/api/groupings/a/items").pop()!.body).toEqual({ schemeIds: ["s1"], pieceIds: ["p9"] });
  });
});

describe("Eras › insights e My Stage", () => {
  const INSIGHTS = { ranking: [rank("a", 1, { audience: 120, capacity: 120, period: "2019", label: "Uma era com um nome muito comprido demais" }), rank("b", 2, { hype: null, spotlights: 1 })], mostLiked: "Era a", mostHype: null, method: "Ranking por curtidas e volume." };

  it("mostra o mais popular, as curtidas, o maior Hype médio (— quando falta) e o palco lotado do 1º lugar", async () => {
    mockApi({ [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: ITEMS, [`GET ${BASE}/eras/insights`]: INSIGHTS });
    const { container } = renderApp(<ErasTab slug="taylor" admin={false} />);
    fireEvent.click(screen.getByRole("radio", { name: "Insights de eras" }));
    expect(await screen.findByText("popularidade 89")).toBeTruthy();
    expect(screen.getByText("Era a")).toBeTruthy();
    expect(screen.getByLabelText("1º lugar")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Palco da era Uma era com um nome muito comprido demais: 120 de 120/ })).toBeTruthy();
    expect(screen.getByText("Uma era com um nome m…")).toBeTruthy();
    expect(screen.getByText("LOTADO")).toBeTruthy();
    expect(screen.getAllByText("LOTADO")).toHaveLength(1);
    expect(screen.getByText("Ranking por curtidas e volume.")).toBeTruthy();
    expect(screen.getByText("120/120")).toBeTruthy();
    expect(screen.getAllByText("Sem Hype público").length).toBeGreaterThan(0);
    // 30 lugares ocupados no 2º palco: círculos preenchidos
    const second = screen.getByRole("img", { name: /Palco da era Era b: 30 de 120/ });
    expect(second.querySelectorAll("circle[fill^='hsl']")).toHaveLength(30);
    expect(container.querySelectorAll("ellipse").length).toBe(4);
  });

  it("sem eras para ranquear mostra o vazio; erro mostra Tentar de novo", async () => {
    let n = 0;
    mockApi({ [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: ITEMS, [`GET ${BASE}/eras/insights`]: () => (n++ === 0 ? fail() : { ...INSIGHTS, ranking: [] }) });
    renderApp(<ErasTab slug="taylor" admin={false} />);
    fireEvent.click(screen.getByRole("radio", { name: "Insights de eras" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Nenhuma era para ranquear ainda.")).toBeTruthy();
  });

  it("My Stage sem WebGL mostra o palco 2D com a foto oficial, as peças do look e as cores das eras; trocar o look refaz a busca", async () => {
    const STAGE = {
      celebrity: OWNER, photoUrl: "/media/taylor.png",
      look: { schemeId: "s1", title: "Look de sexta", mannequin: { sex: "FEMININO" }, pieces: [{ id: "p1", name: "Camiseta", imageUrl: "/media/p1.png" }, { id: "p2", name: "Calça", imageUrl: null }] },
      eras: [{ id: "a", label: "Era a", accentColor: "#f00" }], looks: [{ id: "s1", title: "Look de sexta" }, { id: "s2", title: "Look de sábado" }],
    };
    const { calls } = mockApi({ [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: ITEMS, "GET /api/institutional/taylor/stage": STAGE });
    renderApp(<ErasTab slug="taylor" admin={false} />);
    fireEvent.click(screen.getByRole("radio", { name: "My Stage 3D" }));
    expect(await screen.findByText("Este navegador não exibe 3D: palco em 2D.")).toBeTruthy();
    expect(screen.getByText("Foto oficial da celebridade no manequim. Manequim feminino.")).toBeTruthy();
    expect(screen.getByAltText("Camiseta")).toBeTruthy();
    expect(screen.queryByAltText("Calça")).toBeNull();
    expect(screen.getByText("Calça")).toBeTruthy();
    expect(screen.getByText("Cores do telão (eras)")).toBeTruthy();
    expect(screen.getByLabelText("Look no palco").textContent).toBe("Look de sexta");
    await pick(screen.getByLabelText("Look no palco"), "Look de sábado");
    await waitFor(() => expect(calls.some((c) => c.path === "/api/institutional/taylor/stage?schemeId=s2")).toBe(true));
  });

  it("My Stage sem look nem foto usa o manequim padrão masculino e sem cores de era", async () => {
    const STAGE = { celebrity: OWNER, photoUrl: null, look: null, mannequin: { sex: "MASCULINO" }, eras: [], looks: [] };
    mockApi({ [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: ITEMS, "GET /api/institutional/taylor/stage": STAGE });
    renderApp(<ErasTab slug="taylor" admin={false} />);
    fireEvent.click(screen.getByRole("radio", { name: "My Stage 3D" }));
    expect(await screen.findByText("Sem foto oficial: manequim padrão. Manequim masculino.")).toBeTruthy();
    expect(screen.queryByText("Cores do telão (eras)")).toBeNull();
  });

  it("My Stage com erro oferece Tentar de novo", async () => {
    mockApi({ [`GET ${BASE}/eras`]: LIST, [`GET ${BASE}/eras/items`]: ITEMS, "GET /api/institutional/taylor/stage": () => fail() });
    renderApp(<ErasTab slug="taylor" admin={false} />);
    fireEvent.click(screen.getByRole("radio", { name: "My Stage 3D" }));
    expect(await screen.findByText("servidor caiu")).toBeTruthy();
  });
});

describe("Coleções", () => {
  const CLIST = { ...LIST, kind: "collections", items: [g("c1", { type: "COLLECTION", label: "Verão 26" })] };
  const CITEMS = (url: URL) => (url.searchParams.get("groupingId") ? { ...ITEMS, header: g("c1", { type: "COLLECTION", label: "Verão 26", coverUrl: "/media/c1.png" }) } : ITEMS);

  it("a busca por coleção usa as palavras da coleção, o header da arte e o cadastro sem o tipo de era", async () => {
    mockApi({ [`GET ${BASE}/collections`]: CLIST, [`GET ${BASE}/collections/items`]: CITEMS });
    renderApp(<CollectionsTab slug="taylor" admin />);
    expect(await screen.findByText("coleção: Era a")).toBeTruthy();
    fireEvent.click(chips().getByRole("button", { name: "Verão 26" }));
    expect(await screen.findByAltText("Arte da coleção Verão 26")).toBeTruthy();
    expect(screen.getByText("coleção")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nova coleção" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Tipo")).toBeNull();
    expect(within(dialog).getByLabelText("Ano")).toBeTruthy();
    expect(within(dialog).getByText("A arte vai para o header da busca e para a vitrine da mini loja 3D.")).toBeTruthy();
    expect(within(dialog).getByLabelText("Arte da coleção")).toBeTruthy();
  });

  it("os insights mostram a coleção escolhida com público, fogos e Hype; clicar no ranking troca a escolhida", async () => {
    const INS = { ranking: [rank("c1", 1, { label: "Verão 26", fireworks: 3, coverUrl: "/media/c1.png", period: "2026" }), rank("c2", 2, { label: "Inverno 26", hype: null, items: 1 })], method: "Popularidade por curtidas." };
    mockApi({ [`GET ${BASE}/collections`]: CLIST, [`GET ${BASE}/collections/items`]: CITEMS, [`GET ${BASE}/collections/insights`]: INS });
    renderApp(<CollectionsTab slug="taylor" admin={false} brand={null} />);
    fireEvent.click(screen.getByRole("radio", { name: "Collections insights" }));
    expect(await screen.findByText("3D indisponível: veja o ranking abaixo.")).toBeTruthy();
    expect(screen.getByText("público 30/120 · fogos ✦✦✦")).toBeTruthy();
    expect(screen.getByText("Popularidade por curtidas.")).toBeTruthy();
    const list = screen.getByRole("list", { name: "ranking de coleções" });
    const rows = within(list).getAllByRole("button").map((b) => b.textContent);
    expect(rows[0]).toContain("♥ 99 · 5 itens · Hype médio · 70 Em alta");
    expect(rows[1]).toContain("♥ 98 · 1 item · Hype médio · —");
    fireEvent.click(within(list).getByRole("button", { name: /Inverno 26/ }));
    expect(await screen.findByText("público 30/120 · fogos —")).toBeTruthy();
    expect(within(list).getByRole("button", { name: /Inverno 26/ }).className).toContain("bg-surface-2");
  });

  it("insights sem coleções mostram o vazio; com erro, o estado de erro", async () => {
    let n = 0;
    mockApi({ [`GET ${BASE}/collections`]: CLIST, [`GET ${BASE}/collections/items`]: CITEMS, [`GET ${BASE}/collections/insights`]: () => (n++ === 0 ? fail() : { ranking: [], method: "" }) });
    renderApp(<CollectionsTab slug="taylor" admin={false} />);
    fireEvent.click(screen.getByRole("radio", { name: "Collections insights" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Nenhuma coleção para ranquear ainda.")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Coleções" }));
    expect(await screen.findByText("coleção: Era a")).toBeTruthy();
  });
});

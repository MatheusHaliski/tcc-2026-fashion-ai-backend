// @vitest-environment jsdom
/**
 * Minhas Fotos (RF12): galeria com filtros em cascata, seleção e exclusão em lote, exclusão de uma foto (com o aviso
 * quando é a imagem da peça), download do original, momento-chave, comparação de duas fotos, linha do tempo, insights e
 * curadoria de quase-duplicatas. O editor Canvas 2D tem testes próprios; aqui ele é um substituto simples.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { PhotoLibrary } from "./photo-library";

vi.mock("@/components/photo-editor", () => ({
  PhotoEditor: ({ title, onClose, onSaved }: { title?: string; onClose: () => void; onSaved: (m: string) => void }) => (
    <div role="dialog" aria-label="editor substituto"><p>editando {title}</p><button type="button" onClick={onClose}>fechar substituto</button><button type="button" onClick={() => onSaved("Edição guardada!")}>salvar substituto</button></div>
  ),
}));

const subject = (extra: object = {}) => ({ kind: "PIECE", id: "p1", title: "Camiseta", activeImage: true, occasion: ["casual"], style: ["basic"], color: "white", ...extra });
const photo = (id: string, extra: object = {}) => ({
  id, origin: "WARDROBE_ITEM", url: `/media/${id}.jpg`, thumbnailUrl: `/media/${id}-t.jpg`, mimeType: "image/jpeg", width: 800, height: 600,
  keyMoment: false, createdAt: "2026-09-01T10:00:00Z", month: "2026-09", subject: subject(), ...extra,
});
const PH1 = photo("ph1");
const PH2 = photo("ph2", { origin: "SCHEME", mimeType: "image/png", subject: subject({ kind: "SCHEME", id: "s1", title: "Look de sexta", activeImage: false, occasion: [], style: [], color: null }), width: null, keyMoment: true });
const PH3 = photo("ph3", { origin: "TRY_ON", subject: null, mimeType: null, thumbnailUrl: null });
const FACETS = { occasion: { casual: 2, work: 1 }, style: { basic: 3 }, color: { white: 2, blue: 1 }, month: { "2026-09": 2, "2026-08": 1 }, origin: {} };
const listing = (items: object[], extra: object = {}) => ({ items, facets: FACETS, counts: { WARDROBE_ITEM: 2, SCHEME: 1 }, page: 0, size: 60, hasMore: false, total: items.length, all: items.length, ...extra });
const fail = (status = 500, code = "ERRO", message = "falhou no servidor") => new Response(JSON.stringify({ status, code, message }), { status, headers: { "content-type": "application/json" } });

let downloads: string[] = [];
beforeEach(() => {
  downloads = [];
  URL.createObjectURL = vi.fn(() => "blob:foto");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

function setup(routes: Record<string, unknown> = {}) {
  return mockApi({ "GET /api/taxonomy": { colors: { white: "#ffffff" } }, "GET /api/me/photos": listing([PH1, PH2, PH3]), ...routes });
}
const mode = (name: string) => fireEvent.click(screen.getByRole("radio", { name }));
const tiles = () => [...document.querySelectorAll("figure.photo-tile")] as HTMLElement[];

describe("Minhas Fotos › galeria", () => {
  it("mostra o total, as fotos com o vínculo de cada uma e os títulos certos", async () => {
    setup();
    renderApp(<PhotoLibrary />);
    expect(await screen.findByText("3 foto(s) das suas peças, looks, provador e DNA. Filtre pelos seletores abaixo.")).toBeTruthy();
    expect(tiles()).toHaveLength(3);
    expect(screen.getByAltText("Camiseta")).toBeTruthy();
    expect(screen.getByAltText("Look de sexta")).toBeTruthy();
    expect(screen.getByAltText("Provador")).toBeTruthy();
    expect(screen.getByTitle("imagem atual da peça").textContent).toBe("● Camiseta");
    expect(screen.getByTitle("foto do look").textContent).toBe("Look de sexta");
    // ph2 é momento-chave
    expect(within(tiles()[1]).getByLabelText("Momento-chave")).toBeTruthy();
    expect(within(tiles()[1]).getByRole("button", { name: "desmarcar momento-chave" })).toBeTruthy();
  });

  it("uma foto de peça que não é a imagem atual tem o título de foto da peça; origem desconhecida ou vazia vira o próprio texto ou 'foto'", async () => {
    setup({ "GET /api/me/photos": listing([photo("a", { subject: subject({ activeImage: false }) }), photo("b", { subject: null, origin: "OUTRA" }), photo("c", { subject: null, origin: "" })]) });
    renderApp(<PhotoLibrary />);
    expect(await screen.findByTitle("foto da peça")).toBeTruthy();
    expect(screen.getByAltText("OUTRA")).toBeTruthy();
    expect(screen.getByAltText("foto")).toBeTruthy();
  });

  it("filtros em cascata: escolher a origem abre a ocasião; o estilo sem informação é pulado; a trilha remove o nível e os seguintes", async () => {
    const { calls } = setup();
    renderApp(<PhotoLibrary />);
    const origin = await screen.findByRole("radiogroup", { name: "Origem" });
    expect(within(origin).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Origem: Todos", "Peças2", "Looks1"]);
    fireEvent.click(within(origin).getByRole("radio", { name: /^Peças/ }));
    await waitFor(() => expect(calls.some((c) => c.path.includes("origin=WARDROBE_ITEM"))).toBe(true));
    const occasion = await screen.findByRole("radiogroup", { name: "Ocasião" });
    fireEvent.click(within(occasion).getByRole("radio", { name: /^Trabalho/ }));
    // estilo tem uma opção só, cobrindo todas as fotos: pula direto para cor
    const color = await screen.findByRole("radiogroup", { name: "Cor" });
    fireEvent.click(within(color).getByRole("radio", { name: /^Azul/ }));
    const month = await screen.findByRole("radiogroup", { name: "Data da publicação" });
    fireEvent.click(within(month).getByRole("radio", { name: /^2026-08/ }));
    const period = await screen.findByRole("radiogroup", { name: "Período" });
    expect(within(period).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Período: Todos", "7 dias", "30 dias", "90 dias", "12 meses"]);
    fireEvent.click(within(period).getByRole("radio", { name: "30 dias" }));
    await waitFor(() => expect(calls.some((c) => c.path.includes("days=30") && c.path.includes("color=blue") && c.path.includes("occasion=work") && c.path.includes("month=2026-08"))).toBe(true));
    const trail = screen.getByRole("list", { name: "Filtros escolhidos" });
    expect(within(trail).getByRole("button", { name: "Remover o filtro Período: 30 dias (e os seguintes)" })).toBeTruthy();
    // tirar a ocasião limpa ocasião, cor, mês e período, mantendo a origem
    fireEvent.click(within(trail).getByRole("button", { name: "Remover o filtro Ocasião: Trabalho (e os seguintes)" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Remover o filtro Cor/ })).toBeNull());
    expect(screen.getByRole("button", { name: "Remover o filtro Origem: Peças (e os seguintes)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Filtros escolhidos" })).toBeNull());
    expect(calls.filter((c) => c.path.startsWith("/api/me/photos?")).pop()!.path).toBe("/api/me/photos?page=0&size=60");
  });

  it("biblioteca vazia explica de onde vêm as fotos; filtro sem resultado oferece limpar os filtros", async () => {
    setup({ "GET /api/me/photos": (url: URL) => (url.searchParams.get("origin") ? listing([], { all: 4 }) : listing([], { all: 0 })) });
    renderApp(<PhotoLibrary />);
    expect(await screen.findByText("As fotos das peças, dos looks, do provador e do DNA ficam aqui.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Origem" })).getByRole("radio", { name: /^Looks/ }));
    expect(await screen.findByText("Nenhuma foto com esses filtros.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" }).pop()!);
    expect(await screen.findByText("As fotos das peças, dos looks, do provador e do DNA ficam aqui.")).toBeTruthy();
  });

  it("falha ao listar mostra o erro; Tentar de novo busca outra vez", async () => {
    let n = 0;
    const { calls } = setup({ "GET /api/me/photos": () => (n++ === 0 ? fail() : listing([PH1])) });
    renderApp(<PhotoLibrary />);
    expect(await screen.findByText("Algo deu errado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(calls.filter((c) => c.path.startsWith("/api/me/photos?")).length).toBe(2);
  });

  it("carregar mais traz a próxima página sem repetir fotos já vistas", async () => {
    const { calls } = setup({ "GET /api/me/photos": (url: URL) => (url.searchParams.get("page") === "1" ? listing([PH2, PH3], { page: 1, total: 3 }) : listing([PH1, PH2], { hasMore: true, total: 3 })) });
    renderApp(<PhotoLibrary />);
    fireEvent.click(await screen.findByRole("button", { name: "Carregar mais (2 de 3)" }));
    await waitFor(() => expect(tiles()).toHaveLength(3));
    expect(calls.some((c) => c.path.includes("page=1"))).toBe(true);
    expect(screen.queryByRole("button", { name: /Carregar mais/ })).toBeNull();
  });

  it("clicar na foto abre o editor; salvar avisa e recarrega; fechar só fecha", async () => {
    const { calls } = setup();
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    fireEvent.click(within(tiles()[0]).getByRole("button", { name: "editar foto" }));
    expect(screen.getByText("editando Camiseta")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "fechar substituto" }));
    expect(screen.queryByText("editando Camiseta")).toBeNull();
    fireEvent.click(within(tiles()[2]).getByRole("button", { name: "editar no Canvas 2D" }));
    expect(screen.getByText("editando Provador")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "salvar substituto" }));
    expect(await screen.findByText("Edição guardada!")).toBeTruthy();
    await waitFor(() => expect(calls.filter((c) => c.path.startsWith("/api/me/photos?")).length).toBe(2));
  });

  it("o vínculo da foto abre o detalhe da peça ou do look", async () => {
    setup();
    renderApp(<PhotoLibrary />);
    fireEvent.click(await screen.findByTitle("imagem atual da peça"));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    cleanup();
    setup();
    renderApp(<PhotoLibrary />);
    fireEvent.click(await screen.findByTitle("foto do look"));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("baixa o original com a extensão do tipo (jpg, png ou jpg padrão) e avisa quando falha", async () => {
    setup({
      "GET /api/photos/ph1/file": () => new Response("bytes", { status: 200, headers: { "content-type": "image/jpeg" } }),
      "GET /api/photos/ph2/file": () => new Response("bytes", { status: 200, headers: { "content-type": "image/png" } }),
      "GET /api/photos/ph3/file": () => fail(),
    });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    fireEvent.click(within(tiles()[0]).getByRole("button", { name: "baixar original" }));
    fireEvent.click(within(tiles()[1]).getByRole("button", { name: "baixar original" }));
    await waitFor(() => expect(downloads).toEqual(["foto-ph1.jpg", "foto-ph2.png"]));
    fireEvent.click(within(tiles()[2]).getByRole("button", { name: "baixar original" }));
    expect(await screen.findByText("falhou no servidor")).toBeTruthy();
  });

  it("um download sem tipo usa jpg", async () => {
    setup({ "GET /api/photos/ph3/file": () => new Response("bytes", { status: 200, headers: { "content-type": "image/jpeg" } }) });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Provador");
    fireEvent.click(within(tiles()[2]).getByRole("button", { name: "baixar original" }));
    await waitFor(() => expect(downloads).toEqual(["foto-ph3.jpg"]));
  });

  it("marca e desmarca o momento-chave na hora; erro do servidor avisa", async () => {
    let n = 0;
    const { calls } = setup({ "PUT /api/photos/ph1/key-moment": () => (n++ === 1 ? fail() : { ok: true }) });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    fireEvent.click(within(tiles()[0]).getByRole("button", { name: "marcar momento-chave" }));
    expect(await within(tiles()[0]).findByLabelText("Momento-chave")).toBeTruthy();
    expect(calls.find((c) => c.method === "PUT")!.body).toEqual({ key: true });
    fireEvent.click(within(tiles()[0]).getByRole("button", { name: "desmarcar momento-chave" }));
    expect(await screen.findByText("falhou no servidor")).toBeTruthy();
    expect(within(tiles()[0]).getByLabelText("Momento-chave")).toBeTruthy();
  });
});

describe("Minhas Fotos › exclusão", () => {
  it("excluir a imagem atual da peça avisa que a peça fica sem imagem e pede 'Excluir mesmo assim'", async () => {
    const { calls } = setup({ "DELETE /api/photos/ph1": undefined });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    fireEvent.click(within(tiles()[0]).getByRole("button", { name: "excluir foto" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir esta foto?" });
    expect(dialog.textContent).toContain("Esta foto é a imagem da peça «Camiseta».");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir mesmo assim" }));
    expect(await screen.findByText("Foto excluída. A peça «Camiseta» ficou sem imagem.")).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/photos/ph1?confirmed=true")).toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Excluir esta foto?" })).toBeNull());
  });

  it("excluir uma foto comum confirma com Excluir; cancelar fecha sem excluir", async () => {
    const { calls } = setup({ "DELETE /api/photos/ph2": undefined });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Look de sexta");
    fireEvent.click(within(tiles()[1]).getByRole("button", { name: "excluir foto" }));
    let dialog = await screen.findByRole("dialog", { name: "Excluir esta foto?" });
    expect(within(dialog).getByText("A foto sai de Minhas Fotos. Esta ação não pode ser desfeita.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(within(tiles()[1]).getByRole("button", { name: "excluir foto" }));
    dialog = await screen.findByRole("dialog", { name: "Excluir esta foto?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Foto excluída.")).toBeTruthy();
    expect(calls.filter((c) => c.method === "DELETE").length).toBe(1);
  });

  it("o servidor pedindo confirmação vira aviso; outro erro vira erro; o diálogo continua aberto", async () => {
    let n = 0;
    setup({ "DELETE /api/photos/ph3": () => (n++ === 0 ? fail(409, "CONFIRMACAO_NECESSARIA", "Confirme de novo, por favor") : fail()) });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Provador");
    fireEvent.click(within(tiles()[2]).getByRole("button", { name: "excluir foto" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir esta foto?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect((await screen.findByText("Confirme de novo, por favor")).getAttribute("role")).toBe("status");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect((await screen.findByText("falhou no servidor")).getAttribute("role")).toBe("alert");
    expect(screen.getByRole("dialog", { name: "Excluir esta foto?" })).toBeTruthy();
  });

  it("seleção em lote: marcar, selecionar todas, excluir com o aviso das peças e limpar", async () => {
    const { calls } = setup({
      "POST /api/photos/bulk-deletion": (_u: URL, init: RequestInit) => (JSON.parse(String(init.body)).confirmed ? { deleted: 3 } : { requiresConfirmation: true, count: 3, linkedToPieces: 1, message: "3 fotos serão excluídas. " }),
    });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    fireEvent.click(screen.getAllByRole("checkbox", { name: "selecionar foto" })[0]);
    const batch = screen.getByRole("region", { name: "seleção" });
    expect(within(batch).getByText("1 selecionada(s)")).toBeTruthy();
    // com seleção ativa, clicar na foto marca em vez de editar
    fireEvent.click(within(tiles()[1]).getAllByRole("button", { name: "selecionar foto" })[0]);
    expect(within(batch).getByText("2 selecionada(s)")).toBeTruthy();
    fireEvent.click(within(tiles()[1]).getAllByRole("button", { name: "selecionar foto" })[0]);
    expect(within(batch).getByText("1 selecionada(s)")).toBeTruthy();
    fireEvent.click(within(batch).getByRole("button", { name: "Selecionar as 3 carregadas" }));
    expect(within(batch).getByText("3 selecionada(s)")).toBeTruthy();
    expect((within(batch).getByRole("button", { name: "Selecionar as 3 carregadas" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(batch).getByRole("button", { name: "Excluir 3" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir 3 foto(s)?" });
    expect(within(dialog).getByText("3 fotos serão excluídas. Essas peças ficarão sem imagem.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir 3" }));
    expect(await screen.findByText("3 foto(s) excluída(s).")).toBeTruthy();
    const posts = calls.filter((c) => c.path === "/api/photos/bulk-deletion").map((c) => c.body);
    expect(posts).toEqual([{ ids: ["ph1", "ph2", "ph3"], confirmed: false }, { ids: ["ph1", "ph2", "ph3"], confirmed: true }]);
    await waitFor(() => expect(screen.queryByRole("region", { name: "seleção" })).toBeNull());
  });

  it("limpar seleção esconde a barra; erro ao pedir o resumo do lote avisa; lote sem peças não mostra o aviso", async () => {
    let n = 0;
    setup({ "POST /api/photos/bulk-deletion": () => (n++ === 0 ? fail() : { count: 1, linkedToPieces: 0, message: "1 foto será excluída." }) });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    fireEvent.click(screen.getAllByRole("checkbox", { name: "selecionar foto" })[2]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir 1" }));
    expect(await screen.findByText("falhou no servidor")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Excluir 1" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir 1 foto(s)?" });
    expect(within(dialog).getByText("1 foto será excluída.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(screen.queryByRole("region", { name: "seleção" })).toBeNull();
  });
});

describe("Minhas Fotos › comparar, linha do tempo, insights e curadoria", () => {
  it("compara duas fotos marcando as diferenças; a terceira troca a mais antiga; clicar de novo tira; limpar zera", async () => {
    setup();
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    mode("Comparar");
    expect(screen.getByText("Escolha duas fotos na grade para comparar (0 de 2).")).toBeTruthy();
    const pickers = () => screen.getAllByRole("button", { name: "escolher para comparar" });
    fireEvent.click(pickers()[0]);
    expect(screen.getByText("Escolha duas fotos na grade para comparar (1 de 2).")).toBeTruthy();
    fireEvent.click(pickers()[1]);
    expect(screen.getByText("Comparando as duas fotos escolhidas.")).toBeTruthy();
    expect(screen.getByText("Foto 1")).toBeTruthy();
    expect(screen.getByText("Foto 2")).toBeTruthy();
    const facts = [...document.querySelectorAll(".c-facts")] as HTMLElement[];
    expect(facts[0].textContent).toContain("Ocasião");
    expect(facts[0].textContent).toContain("Casual");
    expect(facts[0].textContent).toContain("800×600");
    expect(facts[1].textContent).toContain("Looks");
    expect(facts[1].textContent).toContain("—");
    expect(facts[1].textContent).toContain("★");
    expect(screen.getAllByText("diferente").length).toBeGreaterThan(4);
    // a seleção numerada aparece na grade
    expect(within(tiles()[0]).getByText("1")).toBeTruthy();
    fireEvent.click(pickers()[2]);
    expect(within(tiles()[1]).getByText("1")).toBeTruthy();
    expect(within(tiles()[2]).getByText("2")).toBeTruthy();
    fireEvent.click(pickers()[2]);
    expect(screen.getByText("Escolha duas fotos na grade para comparar (1 de 2).")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar comparação" }));
    expect(screen.getByText("Escolha duas fotos na grade para comparar (0 de 2).")).toBeTruthy();
  });

  it("no modo comparar também carrega mais páginas", async () => {
    setup({ "GET /api/me/photos": (url: URL) => (url.searchParams.get("page") === "1" ? listing([PH3], { page: 1 }) : listing([PH1, PH2], { hasMore: true, total: 3 })) });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    mode("Comparar");
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais (2 de 3)" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "escolher para comparar" })).toHaveLength(3));
  });

  it("a linha do tempo agrupa por mês com momentos-chave e origens; vazio e erro têm estado próprio", async () => {
    let n = 0;
    const TL = { moments: [], timeline: [{ month: "2026-09", count: 2, keyMoments: 1, byOrigin: { WARDROBE_ITEM: 1, TRY_ON: 1 }, photos: [PH1, PH3] }, { month: "2026-08", count: 1, keyMoments: 0, byOrigin: { SCHEME: 1 }, photos: [PH2] }] };
    setup({ "GET /api/me/photos/timeline": () => [fail(), TL][n++] });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    mode("Linha do tempo");
    expect(screen.queryByRole("group", { name: "Filtros" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("2 fotos")).toBeTruthy();
    expect(screen.getByText("1 foto")).toBeTruthy();
    expect(screen.getByText("· ★ 1 momento-chave")).toBeTruthy();
    expect(screen.getByText("Peças: 1 · Provador: 1")).toBeTruthy();
    // a linha do tempo não tem as ações da galeria
    expect(screen.getAllByRole("button", { name: "editar foto" })).toHaveLength(3);
  });

  it("linha do tempo sem fotos mostra o vazio", async () => {
    setup({ "GET /api/me/photos/timeline": { moments: [], timeline: [] } });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    mode("Linha do tempo");
    expect(await screen.findByText("Nada por aqui ainda.")).toBeTruthy();
  });

  it("insights mostram as frases e as barras por cor, ocasião, estilo e mês (Sem dados quando falta)", async () => {
    setup({ "GET /api/me/photos/insights": { total: 3, keyMoments: 1, withSubject: 2, sentences: ["Você fotografa mais peças brancas."], occasion: { casual: 2, work: 1 }, style: {}, color: { white: 3, unknown_color: 1 }, month: { "2026-09": 3 }, origin: {} } });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    mode("Insights de IA");
    expect(await screen.findByText("Você fotografa mais peças brancas.")).toBeTruthy();
    expect(screen.getByText("Branco")).toBeTruthy();
    expect(screen.getByText("Trabalho")).toBeTruthy();
    expect(screen.getByText("Sem dados ainda.")).toBeTruthy();
    expect(screen.getByText("Fotos por mês")).toBeTruthy();
    const swatches = [...document.querySelectorAll(".piece-swatch")] as HTMLElement[];
    expect(swatches.map((s) => s.style.background)).toEqual(["rgb(255, 255, 255)", "rgb(204, 204, 204)"]);
  });

  it("insights sem frases explicam; erro tem Tentar de novo", async () => {
    let n = 0;
    setup({ "GET /api/me/photos/insights": () => (n++ === 0 ? fail() : { total: 0, keyMoments: 0, withSubject: 0, sentences: [], occasion: {}, style: {}, color: {}, month: {}, origin: {} }) });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    mode("Insights de IA");
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Ainda não há fotos ligadas a peças ou looks para gerar insights.")).toBeTruthy();
  });

  it("a curadoria mostra os grupos de quase-duplicatas e 'Manter 1, excluir' leva à confirmação do lote", async () => {
    const { calls } = setup({
      "POST /api/me/photos/curation": { duplicateGroups: [{ photos: [PH1, PH3], suggestKeep: "ph1", suggestDiscard: ["ph3"] }], note: "Comparação feita localmente." },
      "POST /api/photos/bulk-deletion": { count: 1, linkedToPieces: 0, message: "1 foto será excluída." },
    });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    fireEvent.click(screen.getByRole("button", { name: "Curadoria (IA)" }));
    const dialog = await screen.findByRole("dialog", { name: "Curadoria de fotos (Photo Curator)" });
    expect(within(dialog).getByText("1 grupo(s) de fotos quase iguais. A de melhor qualidade fica marcada.")).toBeTruthy();
    expect(within(dialog).getByText("Comparação feita localmente.")).toBeTruthy();
    expect(dialog.querySelector("img.ring-2")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Manter 1, excluir 1" }));
    expect(await screen.findByRole("dialog", { name: "Excluir 1 foto(s)?" })).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/photos/bulk-deletion")!.body).toEqual({ ids: ["ph3"], confirmed: false });
  });

  it("curadoria sem duplicatas avisa; erro na curadoria vira aviso de erro", async () => {
    let n = 0;
    setup({ "POST /api/me/photos/curation": () => (n++ === 0 ? fail() : { duplicateGroups: [] }) });
    renderApp(<PhotoLibrary />);
    await screen.findByAltText("Camiseta");
    fireEvent.click(screen.getByRole("button", { name: "Curadoria (IA)" }));
    expect(await screen.findByText("falhou no servidor")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Curadoria (IA)" }));
    const dialog = await screen.findByRole("dialog", { name: "Curadoria de fotos (Photo Curator)" });
    expect(within(dialog).getByText("Nenhuma quase-duplicata encontrada.")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

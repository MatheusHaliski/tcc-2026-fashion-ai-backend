// @vitest-environment jsdom
/**
 * Construtor de looks (RF5 criar / RF9 editar): modo manual e com IA (composições, orientação livre que vira arte,
 * ocasião, estilo, estação e humor; arte de fundo gerada ou recomendada), escolha de uma peça por tipo, sementes por
 * ?pieces=, dados do look com foto, revisão (remover peça, PNG), salvar/publicar com pedidos de selo e a janela de sucesso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { PIECE, PIECE_2, SCHEME } from "@/test-utils/fixtures";
import { label } from "@/lib/api/taxonomy";
import { tokenStore } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { SchemeBuilder, SlotBrand, onePerType } from "./scheme-builder";

const seals = vi.hoisted(() => ({ valid: true, requests: [] as unknown[], pickedArts: [] as unknown[] }));
vi.mock("@/components/look-seal-verification", () => ({ useLookSeals: () => seals, SealSuggestions: () => <p>sugestões de selo</p> }));
vi.mock("@/components/scheme-card", () => ({ SchemeCard: ({ scheme }: { scheme: { title: string; items: unknown[] } }) => <p>prévia: {scheme.title} ({scheme.items.length})</p> }));
vi.mock("@/components/hype/look-hype-preview", () => ({ LookHypePreview: () => null, PieceHypeTag: () => null }));
vi.mock("@/components/insights/insight-strip", () => ({ InsightStrip: () => null }));
vi.mock("@/components/expanded-card", () => ({ CreationSuccess: ({ id, edited }: { id: string; edited?: boolean }) => <p role="status">sucesso {id}{edited ? " editado" : ""}</p> }));
vi.mock("next/dynamic", () => ({ default: () => ({ onChange }: { onChange?: (v: unknown) => void }) => <button onClick={() => onChange?.({ color: "#ffffff" })}>Escolher aparência de teste</button> }));

const TAXONOMY = { subcategories: { upper_piece: ["t_shirt", "jacket"], lower_piece: ["jeans"], shoes_piece: ["sneaker"], full_body_piece: ["dress"] }, colors: { white: "#fff" }, materials: [], sizes: ["m"], sexes: ["UNISSEX"], occasions: ["casual", "work"], styles: ["basic", "minimal"], allowedOccasionsByCategory: {} };
const JACKET = { ...PIECE, id: "p3", name: "Jaqueta de couro", subcategory: "jacket", brandName: null } as PieceView;
const DRESS = { ...PIECE, id: "p4", name: "Vestido longo", category: "full_body_piece", subcategory: "dress" } as PieceView;
const SHOE = { ...PIECE, id: "p5", name: "Tênis branco", category: "shoes_piece", subcategory: "sneaker", brandName: null } as PieceView;
const BUILDER = { totalPieces: 5, eligiblePieces: 5, hiddenPieces: 2, status: "OK", lists: { upper_piece: [PIECE, JACKET], lower_piece: [PIECE_2], full_body_piece: [DRESS], shoes_piece: [SHOE], accessory_piece: [] }, defaultVisibility: "FOLLOWERS" };
const err = (status: number, message: string) => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const setup = (routes: Record<string, unknown> = {}) => loggedAs(undefined, { "GET /api/taxonomy": TAXONOMY, "GET /api/schemes/builder": BUILDER, "GET /api/hype/summaries": { items: {} }, ...routes });
const next = async () => fireEvent.click((await screen.findAllByRole("button", { name: "Avançar", exact: true })).at(-1)!);
const pick = (name: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
/** Select do app é um Dropdown (botão + listbox): abre pelo rótulo do campo e escolhe a opção. */
const choose = (field: string, option: string) => { fireEvent.click(screen.getByLabelText(field)); fireEvent.click(screen.getByRole("option", { name: option })); };
const review = () => fireEvent.click(screen.getAllByRole("button", { name: "Revisar e salvar", exact: true }).find((b) => b.classList.contains("btn-primary"))!);
const step = (name: string) => fireEvent.click(screen.getByRole("button", { name, exact: true }));

beforeEach(() => { seals.valid = true; seals.requests = []; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); tokenStore.clear(); nav.search = new URLSearchParams(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("SchemeBuilder — estados da tela", () => {
  it("poucas peças: estado vazio com o atalho para cadastrar (rota antiga /add-piece vira /pieces/new)", async () => {
    setup({ "GET /api/schemes/builder": { ...BUILDER, status: "INSUFICIENTE", message: "Faltam peças", action: { label: "Cadastrar peça", href: "/add-piece" } } });
    renderApp(<SchemeBuilder />);
    expect(await screen.findByText("Cadastre ao menos 2 peças disponíveis.")).toBeTruthy();
    expect(screen.getByText("Faltam peças")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cadastrar peça" }).getAttribute("href")).toBe("/pieces/new");
  });

  it("poucas peças sem ação: \"Adicionar peça\"; erro de carregamento mostra o alerta", async () => {
    setup({ "GET /api/schemes/builder": { ...BUILDER, status: "INSUFICIENTE" } });
    const { unmount } = renderApp(<SchemeBuilder />);
    expect((await screen.findByRole("link", { name: "Adicionar peça" })).getAttribute("href")).toBe("/pieces/new");
    unmount();
    setup({ "GET /api/schemes/builder": err(500, "Construtor fora do ar") });
    renderApp(<SchemeBuilder />);
    expect((await screen.findByRole("alert")).textContent).toContain("Construtor fora do ar");
  });
});

describe("SchemeBuilder — modo manual", () => {
  it("uma peça por tipo: trocar avisa, desmarcar tira; peça única basta; o título nasce dos nomes", async () => {
    setup();
    renderApp(<SchemeBuilder />);
    await next();
    expect(await screen.findByText(/Peças do seu guarda-roupa: 5/)).toBeTruthy();
    expect(screen.getByText(/2 indisponíveis ou em moderação ficam ocultas/)).toBeTruthy();
    // seções só para listas com peças
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([label("upper_piece"), label("lower_piece"), label("full_body_piece"), label("shoes_piece")]);
    const advance = () => screen.getAllByRole("button", { name: "Avançar", exact: true }).at(-1) as HTMLButtonElement;
    expect(advance().disabled).toBe(true);
    pick("Camiseta branca lisa");
    const slots = screen.getByRole("region", { name: "partes do look" });
    expect(within(slots).getByText("Parte de cima")).toBeTruthy();
    expect(within(slots).getByText("Nike")).toBeTruthy();   // marca vem da peça
    pick("Jaqueta de couro");   // mesmo tipo: troca
    expect(await screen.findByText("Jaqueta de couro substituiu Camiseta branca lisa: o look tem uma peça de cada tipo.")).toBeTruthy();
    expect(within(slots).getByText("Sobreposição")).toBeTruthy();
    expect(within(slots).getByText("sem marca na peça")).toBeTruthy();
    pick("Jaqueta de couro");   // desmarca
    expect(screen.queryByRole("region", { name: "partes do look" })).toBeNull();
    pick("Vestido longo");
    expect(advance().disabled).toBe(false);   // peça única sozinha forma um look
    pick("Calça jeans reta");   // a peça única ocupa cima e baixo: a calça a substitui
    expect(await screen.findByText(/Calça jeans reta substituiu Vestido longo/)).toBeTruthy();
    pick("Tênis branco");
    expect(within(screen.getByRole("region", { name: "partes do look" })).getByText("Calçado")).toBeTruthy();
    advance().click();
    expect(((await screen.findByLabelText(/^Título/)) as HTMLInputElement).value).toBe("Calça jeans reta + Tênis branco");
    expect(screen.getByLabelText("Visibilidade").textContent).toBe("Seguidores");   // padrão da conta
    step("Voltar");
    expect(await screen.findByText(/Peças do seu guarda-roupa/)).toBeTruthy();
    step("Voltar");
    expect(screen.getByText("Modo de geração")).toBeTruthy();
  });

  it("dados do look e foto: enviar (com erro e com sucesso) e remover", async () => {
    let uploads = 0;
    setup({ "POST /api/schemes/photos": () => (++uploads === 1 ? err(415, "Formato não aceito") : { url: "/media/look.png" }) });
    renderApp(<SchemeBuilder />);
    await next(); pick("Camiseta branca lisa"); pick("Calça jeans reta"); await next();
    await screen.findByLabelText(/^Título/);
    expect(screen.getByText("sugestões de selo")).toBeTruthy();
    expect(screen.getByText("sem foto: a capa usa a composição das peças")).toBeTruthy();
    const file = screen.getByLabelText("enviar foto do look");
    fireEvent.change(file, { target: { files: [new File(["x"], "look.png", { type: "image/png" })] } });
    expect(await screen.findByText("Formato não aceito")).toBeTruthy();
    fireEvent.change(file, { target: { files: [new File(["x"], "look.png", { type: "image/png" })] } });
    expect(await screen.findByText("Foto verificada e adicionada ao look.")).toBeTruthy();
    expect(screen.getByRole("img", { name: "foto do look" }).getAttribute("src")).toContain("/media/look.png");
    step("Remover");
    expect(screen.queryByRole("img", { name: "foto do look" })).toBeNull();
    fireEvent.change(file, { target: { files: [] } });   // sem arquivo: nada é enviado
    expect(uploads).toBe(2);
  });

  it("revisão: remover peça, prévia PNG e publicar com os dados escolhidos e os pedidos de selo", async () => {
    seals.requests = [{ targetOwnerId: "m1" }, { targetOwnerId: "m2" }];
    const api = setup({
      "POST /api/schemes/preview": () => new Response("png", { status: 200, headers: { "content-type": "image/png" } }),
      "POST /api/schemes": { scheme: { id: "s9" }, warnings: ["Uma peça está indisponível"] },
      "POST /api/schemes/s9/seal-bonds": (_u: URL, init: RequestInit) => (JSON.parse(String(init.body)).targetOwnerId === "m1" ? undefined : err(400, "Selo recusado")),
    });
    Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:previa"), configurable: true });
    const { container } = renderApp(<SchemeBuilder />);
    await next(); pick("Camiseta branca lisa"); pick("Calça jeans reta"); pick("Tênis branco"); await next();
    fireEvent.change(await screen.findByLabelText(/^Título/), { target: { value: "Meu look" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Para o trabalho" } });
    choose("Estação", label("winter"));
    choose("Humor", label("elegant"));
    choose("Visibilidade", "Privado");
    fireEvent.click(screen.getByRole("switch", { name: "Marcar como Look do Dia" }));
    review();
    expect(await screen.findByText("Peças do look (3)")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Remover" })[2]);
    expect(screen.getByText("Peças do look (2)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pré-visualizar (PNG)" }));
    expect((await screen.findByRole("img", { name: "pré-visualização do card" })).getAttribute("src")).toBe("blob:previa");
    fireEvent.click(screen.getByRole("button", { name: "Publicar", exact: true }));
    expect(await screen.findByText("sucesso s9")).toBeTruthy();
    const body = api.calls.find((c) => c.method === "POST" && c.path === "/api/schemes")!.body as Record<string, unknown>;
    // publicar um look privado o torna público
    expect(body).toMatchObject({ title: "Meu look", description: "Para o trabalho", season: "WINTER", mood: "ELEGANT", lookDoDia: true, publish: true, visibility: "PUBLIC", creationMode: "MANUAL", layoutAnatomy: "LISTA_VERTICAL" });
    expect((body.items as unknown[]).length).toBe(2);
    expect(screen.getByText("Uma peça está indisponível")).toBeTruthy();
    expect(screen.getByText("Selo recusado")).toBeTruthy();
    expect(screen.getByText("1 pedido de selo enviado para aprovação.")).toBeTruthy();
    expect(container.querySelector(".card-preview")?.textContent).toContain("prévia: Meu look (2)");
  });

  it("erro na prévia PNG e no salvar viram aviso; selos inválidos voltam para os dados", async () => {
    setup({ "POST /api/schemes/preview": err(500, "Prévia falhou"), "POST /api/schemes": err(400, "Título repetido") });
    renderApp(<SchemeBuilder />);
    await next(); pick("Camiseta branca lisa"); pick("Calça jeans reta"); await next();
    await screen.findByLabelText(/^Título/);
    review();
    fireEvent.click(await screen.findByRole("button", { name: "Pré-visualizar (PNG)" }));
    expect(await screen.findByText("Prévia falhou")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
    expect(await screen.findByText("Título repetido")).toBeTruthy();
    seals.valid = false;
    fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
    expect(await screen.findByLabelText(/^Título/)).toBeTruthy();   // voltou à etapa de dados
  });

  it("aparência: escolher, desfazer e limpar a arte; voltar da aparência", async () => {
    setup();
    renderApp(<SchemeBuilder />);
    const undo = () => screen.getByRole("button", { name: "Desfazer" }) as HTMLButtonElement;
    const clear = () => screen.getByRole("button", { name: "Limpar arte" }) as HTMLButtonElement;
    await screen.findByText("Modo de geração");
    expect(clear().disabled).toBe(true);
    await next(); pick("Camiseta branca lisa"); pick("Calça jeans reta"); await next();
    await screen.findByLabelText(/^Título/);
    review();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Etapas da criação" })).getByRole("button", { name: /^Aparência/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Escolher aparência de teste" }));
    expect(clear().disabled).toBe(false);
    expect(undo().disabled).toBe(false);
    fireEvent.click(clear());
    expect(clear().disabled).toBe(true);
    fireEvent.click(undo());
    expect(clear().disabled).toBe(false);
    step("Voltar");
    expect(await screen.findByLabelText(/^Título/)).toBeTruthy();
  });

  it("?pieces= chega com as peças escolhidas e abre na etapa de peças", async () => {
    nav.search = new URLSearchParams("pieces=p1,p5,inexistente");
    setup();
    renderApp(<SchemeBuilder />);
    const slots = await screen.findByRole("region", { name: "partes do look" });
    expect(within(slots).getByText("Camiseta branca lisa")).toBeTruthy();
    expect(within(slots).getByText("Tênis branco")).toBeTruthy();
  });

  it("edição: salva com PUT, mantém a visibilidade e mostra o sucesso como edição", async () => {
    const api = setup({ "PUT /api/schemes/s1": {} });
    renderApp(<SchemeBuilder initial={{ ...SCHEME, creationMode: "AI_ASSISTED", visibility: "PRIVATE", background: { pieces: { anatomy: "BENTO" } } }} />);
    await screen.findByText("Modo de geração");
    expect(screen.getByRole("button", { name: /Gerar com IA/ })).toBeTruthy();   // abre no modo IA
    await next(); await next();
    fireEvent.click((await screen.findAllByRole("button", { name: "Revisar e salvar", exact: true })).find((b) => b.classList.contains("btn-primary"))!);
    fireEvent.click(screen.getByRole("button", { name: "Salvar", exact: true }));
    expect(await screen.findByText("sucesso s1 editado")).toBeTruthy();
    const body = api.calls.find((c) => c.method === "PUT")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ visibility: "PRIVATE", publish: false, creationMode: "AI_ASSISTED", background: { pieces: { anatomy: "BENTO" } } });
  });
});

describe("SchemeBuilder — modo com IA", () => {
  const COMPOSITIONS = { compositions: [
    { title: "Casual de sexta", items: [{ wardrobeItemId: "p1", slot: "TOP" }, { wardrobeItemId: "p3", slot: "OUTERWEAR" }, { wardrobeItemId: "p2", slot: "BOTTOM" }], occasions: ["casual"], styles: ["minimal"], why: "Cores neutras" },
    { title: "Sem estilo", items: [{ wardrobeItemId: "p4", slot: "FULL_BODY" }], reason: "Peça única" },
  ], provider: "Gemini", scores: [{ hype: 50 }],
  orientation: { background: { color: "#123456", gradientPresetId: "g1", seasonalPresetId: "frost", aura: { variantId: "v1" }, materialId: "linho", animation: "SNOW", cardSkin: "noir" }, occasions: ["work", "casual", "party", "x"], styles: ["minimal"], season: "WINTER", mood: "ELEGANT" } };

  it("gera conjuntos, entende a orientação e aplica um conjunto com a arte gerada pela IA", async () => {
    const api = setup({
      "POST /api/schemes/compositions": COMPOSITIONS,
      "GET /api/backgrounds/recommendations": { id: "dir1", aura: "aura_x", material: "seda", skin: "noir", label: "Noite" },
      "POST /api/backgrounds/art": { status: "READY", url: "/media/arte.png" },
    });
    renderApp(<SchemeBuilder />);
    fireEvent.click(await screen.findByRole("button", { name: /Com IA/ }));
    fireEvent.change(screen.getByLabelText("Orientação (opcional)"), { target: { value: "linho e tons terrosos" } });
    fireEvent.click(screen.getByRole("button", { name: /Gerar com IA/ }));
    expect(await screen.findByText("Gerado com Gemini")).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/api/schemes/compositions")?.body).toMatchObject({ prompt: "linho e tons terrosos", mood: null, season: null });
    expect(screen.getByText(`Entendi: arte de fundo aplicada · ${label("work")}, ${label("casual")}, ${label("party")}, ${label("x")} · ${label("minimal")} · ${label("winter")} · ${label("elegant")}`)).toBeTruthy();
    expect(screen.getByText("Cores neutras")).toBeTruthy();
    expect(screen.getByText("Peça única")).toBeTruthy();
    // o conjunto mostra uma peça por tipo (a jaqueta sai: a camiseta já é a parte de cima)
    const card = screen.getByRole("button", { name: "Usar o conjunto Casual de sexta" });
    expect(card.querySelectorAll("figure")).toHaveLength(2);
    fireEvent.click(card);
    // o título do conjunto se perde (bug relatado: go(2) usa o form antigo e regrava o título vazio)
    const title = (await screen.findByLabelText(/^Título/)) as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Casual de sexta" } });
    await waitFor(() => expect(api.calls.some((c) => c.path === "/api/backgrounds/art")).toBe(true));
    expect(api.calls.find((c) => c.path.startsWith("/api/backgrounds/recommendations"))?.path).toBe("/api/backgrounds/recommendations?styles=minimal&occasions=casual");
    expect(api.calls.find((c) => c.path === "/api/backgrounds/art")?.body).toMatchObject({ direction: "dir1", passePartout: true });
    fireEvent.click(within(screen.getByRole("navigation", { name: "Etapas da criação" })).getByRole("button", { name: /^Aparência/ }));
    expect(await screen.findByText("Arte de fundo gerada pela IA para este look.")).toBeTruthy();
  });

  it("sem gerador de arte fica o preset recomendado; recomendação indisponível não deixa nota", async () => {
    let rec = 0;
    setup({
      "POST /api/schemes/compositions": { compositions: COMPOSITIONS.compositions, fallbackUsed: true, orientation: { styles: [] } },
      "GET /api/backgrounds/recommendations": () => (++rec === 1 ? { label: "Neutro" } : err(500, "sem recomendação")),
      "POST /api/backgrounds/art": err(503, "sem gerador"),
    });
    renderApp(<SchemeBuilder />);
    fireEvent.click(await screen.findByRole("button", { name: /Com IA/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gerar com IA/ }));
    expect(await screen.findByText("Feito pela IA local (a IA online está indisponível agora).")).toBeTruthy();
    expect(screen.queryByText(/^Entendi:/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Usar o conjunto Sem estilo" }));
    fireEvent.change(await screen.findByLabelText(/^Título/), { target: { value: "Look IA" } });
    review();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Etapas da criação" })).getByRole("button", { name: /^Aparência/ }));
    expect(await screen.findByText("A IA escolheu o fundo \"Neutro\" para este look.")).toBeTruthy();
    // volta ao modo e aplica outro conjunto: a recomendação falha e a nota some
    step("Modo");
    fireEvent.click(screen.getByRole("button", { name: /Gerar com IA/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Usar o conjunto Casual de sexta" }));
    fireEvent.change(await screen.findByLabelText(/^Título/), { target: { value: "Look IA 2" } });
    await waitFor(() => expect(rec).toBe(2));
    review();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Etapas da criação" })).getByRole("button", { name: /^Aparência/ }));
    await settle();
    expect(screen.queryByText(/A IA escolheu o fundo/)).toBeNull();
    expect(screen.queryByText(/Arte de fundo gerada/)).toBeNull();
  });

  it("mensagem própria do motor, orientação só com fundo e erro ao gerar", async () => {
    let n = 0;
    setup({ "POST /api/schemes/compositions": () => (++n === 1 ? { compositions: [], message: "Poucas peças combinam", orientation: { background: { color: "#000000" } } } : n === 2 ? { compositions: [] } : err(500, "IA fora do ar")) });
    renderApp(<SchemeBuilder />);
    fireEvent.click(await screen.findByRole("button", { name: /Com IA/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gerar com IA/ }));
    expect(await screen.findByText("Poucas peças combinam")).toBeTruthy();
    expect(screen.getByText("Entendi: arte de fundo aplicada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Gerar com IA/ }));
    await waitFor(() => expect(screen.queryByText("Poucas peças combinam")).toBeNull());
    expect(screen.queryByText(/^Entendi:/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Gerar com IA/ }));
    expect(await screen.findByText("IA fora do ar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    expect(screen.queryByRole("button", { name: /Gerar com IA/ })).toBeNull();
  });
});

describe("utilitários do construtor", () => {
  it("onePerType guarda a primeira peça de cada tipo (peça única bloqueia cima e baixo)", () => {
    const by = new Map([PIECE, PIECE_2, JACKET, DRESS, SHOE].map((p) => [p.id, p]));
    const ids = (list: string[]) => onePerType(list.map((id) => ({ id })), (id) => by.get(id)).map((x) => x.id);
    expect(ids(["p1", "p3", "p2", "p5"])).toEqual(["p1", "p2", "p5"]);
    expect(ids(["p4", "p1", "p2", "p5", "zz", "yy"])).toEqual(["p4", "p5", "zz"]);
    expect(ids(["p2", "p4"])).toEqual(["p2"]);
  });

  it("SlotBrand: sem peça não mostra nada; com marca mostra o cadeado; sem marca avisa", () => {
    setup();
    const { container } = renderApp(<><SlotBrand piece={null} /><SlotBrand piece={PIECE} /><SlotBrand piece={SHOE} /></>);
    const brands = container.querySelectorAll(".slot-brand");
    expect(brands).toHaveLength(2);
    expect(brands[0].textContent).toContain("Nike");
    expect(brands[0].querySelector(".lock")).not.toBeNull();
    expect(brands[1].textContent).toBe("sem marca na peça");
  });
});

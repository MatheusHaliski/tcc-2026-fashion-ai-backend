// @vitest-environment jsdom
/**
 * Construtor de DNA de estilo (RF13): estados da tela, modo com IA (propostas, mensagens do motor), escolha de 2 a 6
 * looks (época, marco, ordem, marcas das peças), dados, layout/narrativa no painel do Background Studio, revisão,
 * salvar/publicar com pedidos de selo e o sucesso que leva ao perfil.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import { OWNER, PIECE, SCHEME } from "@/test-utils/fixtures";
import type { SchemeView } from "@/lib/api/types";
import type { DnaView } from "./dna-card";
import { DnaBuilder } from "./dna-builder";

vi.mock("@/components/scheme-card", () => ({ SchemeCard: ({ scheme, extra }: { scheme: { title: string }; extra?: ReactNode }) => <section aria-label={`card ${scheme.title}`}>{extra}</section> }));
vi.mock("@/components/look-seal-verification", () => ({
  DnaLookSeals: ({ schemeId, title, onChange }: { schemeId: string; title: string; onChange: (id: string, r: unknown[], v: boolean) => void }) => (
    <span><button onClick={() => onChange(schemeId, [], false)}>selo inválido {title}</button><button onClick={() => onChange(schemeId, [{ targetOwnerId: schemeId }], true)}>pedir selo {title}</button></span>
  ),
}));
vi.mock("@/components/background-studio", async (orig) => ({
  ...(await orig<typeof import("./background-studio")>()),
  BackgroundStudio: ({ layoutPanel, onChange, ownArtLabel, anatomy }: { layoutPanel: (p: { openSeasonal: (enter?: () => void) => void }) => ReactNode; onChange: (v: unknown) => void; ownArtLabel?: string; anatomy: string }) => (
    <div><p>anatomia {anatomy}{ownArtLabel ? ` · arte própria ${ownArtLabel}` : ""}</p><button onClick={() => onChange({ color: "#111111" })}>pintar fundo</button>{layoutPanel({ openSeasonal: (enter) => enter?.() })}</div>
  ),
}));
vi.mock("@/components/dna-card", async (orig) => ({ ...(await orig<typeof import("./dna-card")>()), DnaCard: ({ dna, expanded }: { dna: { title: string }; expanded?: boolean }) => <p>card do dna {dna.title}{expanded ? " ampliado" : ""}</p> }));
vi.mock("@/components/expanded-card", () => ({ CreationSuccess: ({ id, edited, onDone }: { id: string; edited?: boolean; onDone?: () => void }) => <button onClick={onDone}>sucesso {id}{edited ? " editado" : ""}</button> }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockClear(); });

const look = (id: string, title: string, items: SchemeView["items"] = []) => ({ ...SCHEME, id, title, items, createdAt: "2026-03-15T12:00:00Z" }) as SchemeView;
const S1 = { ...SCHEME, items: [...SCHEME.items, { wardrobeItemId: "p9", slot: "shoes", piece: { ...PIECE, id: "p9", brandName: "Adidas" } }] } as SchemeView;   // Nike (2x) e Adidas
const SCHEMES = [S1, look("s2", "Look de domingo"), look("s3", "Look 3"), look("s4", "Look 4"), look("s5", "Look 5"), look("s6", "Look 6"), look("s7", "Look 7")];
const BUILDER = { totalSchemes: 7, status: "OK", schemes: SCHEMES, defaultVisibility: "FOLLOWERS", dna: { archetypeLabel: "Minimalista", palette: [{ color: "black", hex: "#000" }], boldnessIndex: 40 } };
const TAXONOMY = { subcategories: {}, colors: {}, materials: [], sizes: [], sexes: [], occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: {} };
const err = (status: number, message: string) => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const PREVIEW = { id: "preview", title: "Prévia viva" };
const setup = (routes: Record<string, unknown> = {}) => loggedAs(undefined, { "GET /api/taxonomy": TAXONOMY, "GET /api/dna-schemes/builder": BUILDER, "POST /api/dna-schemes/preview": PREVIEW, ...routes });
const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const click = (name: string | RegExp) => fireEvent.click(btn(name));
const nav = () => screen.getByRole("navigation", { name: "Etapas da criação" });
const stepTo = (name: string) => fireEvent.click(within(nav()).getByRole("button", { name }));
/** Select do app é um Dropdown (botão + listbox): abre pelo rótulo do campo e escolhe a opção. */
const choose = (field: string | RegExp, option: string) => { fireEvent.click(screen.getByLabelText(field)); fireEvent.click(screen.getByRole("option", { name: option })); };
const add = (title: string) => fireEvent.click(within(screen.getByRole("region", { name: `card ${title}` })).getByRole("button"));
/** Abre o construtor, vai aos looks e escolhe os dois primeiros. */
async function twoLooks() {
  renderApp(<DnaBuilder />);
  fireEvent.click(await screen.findByRole("button", { name: "Avançar" }));
  add("Look de sexta"); add("Look de domingo");
}
const DNA: DnaView = {
  id: "d1", owner: OWNER, title: "Meu DNA", palette: [], cardLayout: "GRADE", targetElement: "DNA_COMPLETO", narrativeType: null, creationMode: "AI_ASSISTED",
  occasion: "work, casual", style: "basic", seasonalTheme: "WINTER", visibility: "PRIVATE", status: "PUBLISHED", background: { color: "#222222" }, cardSkin: "noir",
  cells: [{ cell: "s1", schemeId: "s1", title: "Look de sexta", occasion: [], style: [], milestone: true, pieces: [] }, { cell: "s2", schemeId: "s2", title: "Look de domingo", occasion: [], style: [], milestone: false, pieces: [] }],
  logos: [], counters: { likes: 0, comments: 0, shares: 0, remixes: 0 }, canEdit: true,
} as DnaView;

describe("DnaBuilder — estados da tela", () => {
  it("erro ao carregar mostra o alerta", async () => {
    setup({ "GET /api/dna-schemes/builder": err(500, "Construtor de DNA fora do ar") });
    renderApp(<DnaBuilder />);
    expect((await screen.findByRole("alert")).textContent).toContain("Construtor de DNA fora do ar");
  });

  it("poucos looks: estado vazio com o rótulo da ação ou \"Criar look\"", async () => {
    setup({ "GET /api/dna-schemes/builder": { ...BUILDER, status: "INSUFICIENTE", message: "Faltam looks", action: { label: "Montar look", href: "/x" } } });
    const { unmount } = renderApp(<DnaBuilder />);
    expect(await screen.findByText("Crie looks primeiro")).toBeTruthy();
    expect(screen.getByText("Faltam looks")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Montar look" }).getAttribute("href")).toBe("/schemes/new");
    unmount();
    setup({ "GET /api/dna-schemes/builder": { ...BUILDER, status: "INSUFICIENTE" } });
    renderApp(<DnaBuilder />);
    expect((await screen.findByRole("link", { name: "Criar look" })).getAttribute("href")).toBe("/schemes/new");
  });

  it("etapa de modo mostra o DNA atual com ousadia e paleta; etapas vindas da API perdem o número", async () => {
    setup({ "GET /api/dna-schemes/builder": { ...BUILDER, steps: ["1 · Começo", "2 · Looks", "3 · Dados", "4 · Arte", "5 · Fim"], dna: { archetypeLabel: "Ousado" } } });
    const { container } = renderApp(<DnaBuilder />);
    expect(await screen.findByText("Ousado")).toBeTruthy();
    expect(screen.getByText(/ousadia 0/)).toBeTruthy();
    expect(within(nav()).getByRole("button", { name: "Começo" })).toBeTruthy();
    expect(container.querySelectorAll(".rounded-full.border-line-soft")).toHaveLength(0);
  });
});

describe("DnaBuilder — modo com IA", () => {
  const PROPOSALS = [
    { title: "Evolução", narrativeType: "TIMELINE", cardLayout: "AMPLIADO", cells: [{ schemeId: "s1", eraLabel: "2024", milestone: true }, { schemeId: "s2", title: "Domingo leve" }], occasion: ["work"], style: [], seasonalTheme: "SUMMER", rationale: "Do trabalho ao fim de semana" },
    { title: "Grade", cardLayout: "GRADE", cells: [{ schemeId: "s3" }, { schemeId: "s4" }] },
  ];

  it("gera propostas com os filtros escolhidos e mostra narrativa ou layout, época, marco e porquê", async () => {
    const api = setup({ "POST /api/dna-schemes/compositions": { compositions: PROPOSALS, provider: "Gemini" } });
    renderApp(<DnaBuilder />);
    fireEvent.click(await screen.findByRole("button", { name: /Com IA/ }));
    choose("Narrativa (opcional)", "B1 · Linha do tempo");
    choose("Estação (opcional)", "Outono · Ember");
    fireEvent.change(screen.getByLabelText("Orientação (opcional)"), { target: { value: "tons terrosos" } });
    click(/Gerar propostas de DNA/);
    expect(await screen.findByText("Gerado com Gemini")).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/api/dna-schemes/compositions")?.body).toMatchObject({ prompt: "tons terrosos", narrativeType: "TIMELINE", season: "AUTUMN", occasion: [], style: [] });
    expect(screen.getByText("Linha do tempo")).toBeTruthy();
    expect(screen.getByText("Em grade")).toBeTruthy();
    expect(screen.getByText("★ 2024 · Look de sexta")).toBeTruthy();   // sem título na proposta: vem do look
    expect(screen.getByText("Domingo leve")).toBeTruthy();
    expect(screen.getByText("Look 3")).toBeTruthy();
    expect(screen.getByText("Do trabalho ao fim de semana")).toBeTruthy();
  });

  it("aplicar uma proposta leva aos looks já escolhidos e preenche título e estação", async () => {
    setup({ "POST /api/dna-schemes/compositions": { compositions: PROPOSALS } });
    renderApp(<DnaBuilder />);
    fireEvent.click(await screen.findByRole("button", { name: /Com IA/ }));
    click(/Gerar propostas de DNA/);
    fireEvent.click(await screen.findByRole("button", { name: /Evolução/ }));
    const list = screen.getByRole("list", { name: "looks do DNA" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect((within(list).getAllByLabelText("época (eraLabel)")[0] as HTMLInputElement).value).toBe("2024");
    expect((within(list).getAllByRole("radio")[0] as HTMLInputElement).checked).toBe(true);
    stepTo("Detalhes");
    expect((screen.getByLabelText(/^Título/) as HTMLInputElement).value).toBe("Evolução");
    expect(screen.getByLabelText("Estação (Cartela sazonal)").textContent).toBe("Verão · Solstice");
  });

  it("mensagem do motor, IA local, nenhuma mensagem e erro ao gerar", async () => {
    let n = 0;
    setup({ "POST /api/dna-schemes/compositions": () => (++n === 1 ? { compositions: [], message: "Poucos looks combinam" } : n === 2 ? { compositions: [], fallbackUsed: true } : n === 3 ? { compositions: [] } : err(500, "IA fora do ar")) });
    renderApp(<DnaBuilder />);
    fireEvent.click(await screen.findByRole("button", { name: /Com IA/ }));
    click(/Gerar propostas de DNA/);
    expect(await screen.findByText("Poucos looks combinam")).toBeTruthy();
    click(/Gerar propostas de DNA/);
    expect(await screen.findByText("Feito pela IA local (a IA online está indisponível agora).")).toBeTruthy();
    click(/Gerar propostas de DNA/);
    await waitFor(() => expect(screen.queryByText(/IA local/)).toBeNull());
    click(/Gerar propostas de DNA/);
    expect(await screen.findByText("IA fora do ar")).toBeTruthy();
    click("Manual");
    expect(screen.queryByRole("button", { name: /Gerar propostas/ })).toBeNull();
  });
});

describe("DnaBuilder — looks do DNA", () => {
  it("adicionar vira \"No DNA\" com a época da data; marcas vêm das peças (sem repetir) ou \"sem marca\"", async () => {
    setup();
    await twoLooks();
    expect(screen.getByText(/Seus looks: 7 disponíveis/)).toBeTruthy();
    const list = screen.getByRole("list", { name: "looks do DNA" });
    const [first, second] = within(list).getAllByRole("listitem");
    expect(within(first).getByLabelText("marcas das peças do look").querySelectorAll(".slot-brand")).toHaveLength(2);   // Nike aparece uma vez só
    expect(within(first).getByLabelText("marcas das peças do look").textContent).toMatch(/Nike🔒.*Adidas🔒/);
    expect(within(second).getByText("sem marca")).toBeTruthy();
    expect((within(second).getByLabelText("época (eraLabel)") as HTMLInputElement).value).toMatch(/^mar\/26$/i);
    expect(within(screen.getByRole("region", { name: "card Look de sexta" })).getByRole("button").textContent).toBe("✓ No DNA");
    expect((btn(/^Avançar/) as HTMLButtonElement).textContent).toContain("(2/6)");
    add("Look de sexta");   // tira de novo
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect((btn(/^Avançar/) as HTMLButtonElement).disabled).toBe(true);
  });

  it("época editável, marco único, subir/descer (sem sair da lista) e remover", async () => {
    setup();
    await twoLooks();
    const list = screen.getByRole("list", { name: "looks do DNA" });
    const titles = () => within(list).getAllByRole("listitem").map((li) => li.querySelector(".font-medium")?.textContent);
    fireEvent.change(within(list).getAllByLabelText("época (eraLabel)")[0], { target: { value: "formatura" } });
    expect((within(list).getAllByLabelText("época (eraLabel)")[0] as HTMLInputElement).value).toBe("formatura");
    fireEvent.click(within(list).getAllByRole("radio")[1]);
    expect(within(list).getAllByRole("radio").map((r) => (r as HTMLInputElement).checked)).toEqual([false, true]);
    fireEvent.click(within(list).getAllByRole("button", { name: "subir" })[0]);   // já é o primeiro
    expect(titles()).toEqual(["Look de sexta", "Look de domingo"]);
    fireEvent.click(within(list).getAllByRole("button", { name: "descer" })[0]);
    expect(titles()).toEqual(["Look de domingo", "Look de sexta"]);
    fireEvent.click(within(list).getAllByRole("button", { name: "descer" })[1]);   // já é o último
    expect(titles()).toEqual(["Look de domingo", "Look de sexta"]);
    fireEvent.click(within(list).getAllByRole("button", { name: "Remover" })[0]);
    expect(titles()).toEqual(["Look de sexta"]);
  });

  it("no máximo 6 looks: o sétimo avisa e não entra; Voltar retorna ao modo", async () => {
    setup();
    await twoLooks();
    ["Look 3", "Look 4", "Look 5", "Look 6", "Look 7"].forEach(add);
    expect(await screen.findByText("Um DNA referencia no máximo 6 looks.")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "looks do DNA" })).getAllByRole("listitem")).toHaveLength(6);
    expect(within(screen.getByRole("region", { name: "card Look 7" })).getByRole("button").textContent).toBe("Adicionar ao DNA");
    click("Voltar");
    expect(screen.getByText("Modo de geração")).toBeTruthy();
  });
});

describe("DnaBuilder — dados, layout e narrativa", () => {
  it("dados: título obrigatório, visibilidade padrão da conta e selo inválido trava o avançar", async () => {
    setup();
    await twoLooks();
    click(/^Avançar/);
    expect(screen.getByText("Verificação de selos dos looks")).toBeTruthy();
    expect(screen.getByLabelText("Visibilidade").textContent).toBe("Seguidores");
    const next = () => screen.getAllByRole("button", { name: "Avançar" }).at(-1) as HTMLButtonElement;
    expect(next().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Minha história" } });
    expect(next().disabled).toBe(false);
    click("selo inválido Look de sexta");
    expect(next().disabled).toBe(true);
    click("pedir selo Look de sexta");
    fireEvent.click(next());
    expect(screen.getByText("anatomia TIMELINE")).toBeTruthy();
    click("Voltar");
    expect(screen.getByLabelText(/^Título/)).toBeTruthy();
  });

  it("painel de layout: anatomia base tira a narrativa; LEGO tem arte própria e nota; Cartela entra pelo modal", async () => {
    setup();
    await twoLooks();
    click(/^Avançar/);
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Minha história" } });
    stepTo("Aparência");
    const b1 = btn(/B1\s*Linha do tempo/);
    expect(b1.getAttribute("aria-pressed")).toBe("true");
    click(/A4/);
    expect(btn(/A4/).getAttribute("aria-pressed")).toBe("true");
    expect(btn(/B1\s*Linha do tempo/).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("anatomia LATERAL")).toBeTruthy();
    click(/B12/);
    expect(screen.getByText(/LEGO muda a forma/)).toBeTruthy();
    expect(screen.getByText(/anatomia LEGO · arte própria/)).toBeTruthy();
    click(/B11/);
    expect(btn(/B11/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/A cartela e a animação deste layout/)).toBeTruthy();
    click(/B11/);   // já ativa: o modal abre sem trocar
    expect(btn(/B11/).getAttribute("aria-pressed")).toBe("true");
    click(/B3/);
    expect(btn(/B3/).getAttribute("aria-pressed")).toBe("true");
    stepTo("Revisar e salvar");
    expect(screen.getByText(/2 looks · narrativa Primeira vez · skin atelier · /)).toBeTruthy();
  });

  it("look específico como alvo: narrativas indisponíveis e a revisão mostra o layout base", async () => {
    setup();
    await twoLooks();
    click(/^Avançar/);
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Minha história" } });
    choose("Elemento-alvo", "Look específico");
    stepTo("Aparência");
    expect(screen.getByText(/narrativas \(indisponíveis\)/)).toBeTruthy();
    expect(screen.getByText(/As narrativas só aparecem quando/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /B1\s/ })).toBeNull();
    expect(btn(/A1/).getAttribute("aria-pressed")).toBe("true");
    click("Avançar");
    expect(screen.getByText(/2 looks · layout Ampliado · skin atelier/)).toBeTruthy();
  });

  it("arte do fundo: Desfazer e Limpar arte no painel da prévia", async () => {
    setup();
    await twoLooks();
    click(/^Avançar/);
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Minha história" } });
    stepTo("Aparência");
    const undo = () => btn("Desfazer") as HTMLButtonElement;
    const clear = () => btn("Limpar arte") as HTMLButtonElement;
    expect(clear().disabled).toBe(true);
    click("pintar fundo");
    expect(clear().disabled).toBe(false);
    expect(undo().disabled).toBe(false);
    fireEvent.click(clear());
    expect(clear().disabled).toBe(true);
    fireEvent.click(undo());
    expect(clear().disabled).toBe(false);
  });
});

describe("DnaBuilder — prévia e salvar", () => {
  it("a prévia ao vivo chega depois do debounce, na lateral e ampliada na revisão; erro na prévia é ignorado", async () => {
    let n = 0;
    setup({ "POST /api/dna-schemes/preview": () => (++n === 1 ? PREVIEW : err(500, "sem prévia")) });
    await twoLooks();
    expect(await screen.findByText("card do dna Prévia viva")).toBeTruthy();
    click(/^Avançar/);
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Minha história" } });
    stepTo("Revisar e salvar");
    expect(screen.getByText("card do dna Prévia viva ampliado")).toBeTruthy();
    await waitFor(() => expect(n).toBeGreaterThan(1));
    expect(screen.queryByText("sem prévia")).toBeNull();
  });

  it("publicar: POST com o corpo, privado vira público, pedidos de selo (um recusado) e o sucesso leva ao perfil", async () => {
    const api = setup({
      "GET /api/dna-schemes/builder": { ...BUILDER, defaultVisibility: "PRIVATE" },
      "POST /api/dna-schemes": { id: "d9" },
      "POST /api/schemes/s1/seal-bonds": undefined,
      "POST /api/schemes/s2/seal-bonds": err(400, "Selo recusado"),
    });
    await twoLooks();
    click(/^Avançar/);
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Minha história" } });
    choose("Estação (Cartela sazonal)", "Inverno · Frost");
    click("pedir selo Look de sexta"); click("pedir selo Look de domingo");
    stepTo("Revisar e salvar");
    click("Publicar");
    fireEvent.click(await screen.findByRole("button", { name: "sucesso d9" }));
    const body = api.calls.find((c) => c.method === "POST" && c.path === "/api/dna-schemes")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ title: "Minha história", publish: true, visibility: "PUBLIC", narrativeType: "TIMELINE", seasonalTheme: "WINTER", creationMode: "MANUAL", targetElement: "DNA_COMPLETO", cardLayout: "AMPLIADO", background: { skin: "atelier" } });
    expect(screen.getByText("Selo recusado")).toBeTruthy();
    expect(screen.getByText("1 pedido de selo enviado para aprovação.")).toBeTruthy();
    expect(screen.getByText("DNA publicado!")).toBeTruthy();
    expect(router.push).toHaveBeenCalledWith(`/u/${ME.user.username}?tab=dna`);
  });

  it("salvar com selo inválido volta aos dados; erro no salvar vira aviso", async () => {
    setup({ "POST /api/dna-schemes": err(400, "Título repetido") });
    await twoLooks();
    click(/^Avançar/);
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: "Minha história" } });
    stepTo("Revisar e salvar");
    click("Salvar");
    expect(await screen.findByText("Título repetido")).toBeTruthy();
    stepTo("Detalhes");
    click("selo inválido Look de domingo");
    stepTo("Revisar e salvar");
    click("Salvar");
    expect(screen.getByLabelText(/^Título/)).toBeTruthy();
  });

  it("edição: abre no modo IA com os dados do DNA, salva com PUT e mantém a visibilidade", async () => {
    const api = setup({ "PUT /api/dna-schemes/d1": {} });
    renderApp(<DnaBuilder initial={DNA} />);
    expect(await screen.findByRole("button", { name: /Gerar propostas de DNA/ })).toBeTruthy();
    stepTo("Revisar e salvar");
    expect(screen.getByText(/2 looks · layout Em grade · skin noir · Privado/)).toBeTruthy();
    click("Salvar");
    expect(await screen.findByRole("button", { name: "sucesso d1 editado" })).toBeTruthy();
    expect(screen.getByText("DNA salvo!")).toBeTruthy();
    const body = api.calls.find((c) => c.method === "PUT")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ publish: false, visibility: "PRIVATE", creationMode: "AI", occasion: "work,casual", style: "basic", narrativeType: null, seasonalTheme: "WINTER", background: { color: "#222222", skin: "noir" } });
    expect((body.cells as { milestone: boolean }[])[0].milestone).toBe(true);
  });

  it("edição com Cartela sazonal sem estação nem cartela usa Outono", async () => {
    const api = setup({ "PUT /api/dna-schemes/d1": {} });
    renderApp(<DnaBuilder initial={{ ...DNA, narrativeType: "CARTELA_SAZONAL", seasonalTheme: null, creationMode: "MANUAL", visibility: "FOLLOWERS" } as DnaView} />);
    await screen.findByText("Modo de geração");
    stepTo("Revisar e salvar");
    click("Publicar");
    await screen.findByRole("button", { name: "sucesso d1 editado" });
    expect(api.calls.find((c) => c.method === "PUT")!.body).toMatchObject({ narrativeType: "CARTELA_SAZONAL", seasonalTheme: "AUTUMN", visibility: "FOLLOWERS", publish: true });
  });
});

// @vitest-environment jsdom
/**
 * RF39 — criador de guarda-roupa 3D (aba das marcas): blocos, materiais e cores, preço sugerido, publicação na loja do
 * quarto, edição e exclusão das criações, envio de logo/arte e a amostra do item na loja.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { AVAILABILITY, SLOT_LABELS, StoreSwatch, WardrobeCreatorTab, finishOf, type StoreItem } from "./wardrobe-creator";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const OPTIONS = {
  blocks: [
    { slotType: "DOOR", moldId: "door-a", widthCm: 50, label: "Porta lisa", basePrice: 100, minLevel: "ESTREIA", materials: ["MADEIRA", "METAL"] },
    { slotType: "DOOR", moldId: "door-b", widthCm: 50, label: "Porta de vidro", basePrice: 200, minLevel: "STUDIO", materials: ["VIDRO"] },
    { slotType: "DRAWER", moldId: "drawer-a", widthCm: 50, label: "Gaveta", basePrice: 50, minLevel: "ESTREIA", materials: ["MADEIRA"] },
    { slotType: "HANDLE", moldId: "handle-a", widthCm: 5, label: "Puxador", basePrice: 10, minLevel: "ESTREIA", materials: ["METAL"] },
    { slotType: "LOGO", moldId: "logo-a", widthCm: 20, label: "Placa", basePrice: 20, minLevel: "ESTREIA", materials: ["MADEIRA"] },
    { slotType: "HANGER", moldId: "hanger-a", widthCm: 40, label: "Cabide", basePrice: 5, minLevel: "ESTREIA", materials: ["MADEIRA"] },
    { slotType: "LIGHT", moldId: "led-a", widthCm: 100, label: "Fita LED", basePrice: 30, minLevel: "ESTREIA", materials: ["LED"] },
    { slotType: "MIRROR", moldId: "mirror-a", widthCm: 60, label: "Espelho", basePrice: 80, minLevel: "ESTREIA", materials: ["VIDRO"] },
    { slotType: "POSTER", moldId: "poster-a", widthCm: 60, label: "Pôster da marca", basePrice: 15, minLevel: "ESTREIA", materials: ["PAPEL"] },
  ],
  materials: [
    { code: "MADEIRA", label: "Madeira", roughness: 0.7, metalness: 0, priceFactor: 1, minLevel: "ESTREIA", colors: ["Carvalho", "Nogueira"] },
    { code: "METAL", label: "Metal", roughness: 0.2, metalness: 0.9, priceFactor: 2, minLevel: "LOFT", colors: ["Ouro"] },
    { code: "VIDRO", label: "Vidro", roughness: 0.1, metalness: 0.1, priceFactor: 1.5, minLevel: "STUDIO", colors: ["Fumê"] },
    { code: "LED", label: "LED", roughness: 0.5, metalness: 0, priceFactor: 1, minLevel: "ESTREIA", colors: ["Quente 3000 K"] },
  ],
  colors: { Carvalho: "#AA8855", Nogueira: "#553311", Ouro: "#D4AF37", "Fumê": "#444444" },
  levels: ["ESTREIA", "STUDIO", "LOFT"],
  identity: { name: "Nike", logoUrl: null, slug: "nike", kind: "BRAND" },
  seals: [{ id: "seal1", name: "Selo Nike", availableFrom: "2026-01-01T00:00:00Z", availableUntil: "2026-12-31T00:00:00Z" }, { id: "seal2", name: "Selo Eterno", availableFrom: "2026-01-01T00:00:00Z", availableUntil: "null" }],
  currency: "BRL",
};

const wardrobeItem: StoreItem = {
  sku: "W1", name: "Guarda-roupa Nike", kind: "WARDROBE", description: "Coleção verão", moldId: "door-a", slotType: "DOOR", blockLabel: "Porta lisa",
  bundle: [
    { slotType: "DOOR", moldId: "door-a", material: "MADEIRA", colorName: "Nogueira", finish: { color: "#553311" } },
    { slotType: "DRAWER", moldId: "drawer-a", material: "MADEIRA", colorName: "Carvalho", finish: undefined as never },
  ],
  pricePoints: 900, requiredLevel: "STUDIO", stock: 10, sold: 3, perUserLimit: 2, availableFrom: "2026-05-01T12:00:00Z", availableUntil: "2026-06-01T12:00:00Z",
  availability: "DISPONIVEL", requiresSeal: true, active: true, labelText: "NIKE", logoUrl: "/media/logo.png", artUrl: "/media/art.png", seal: { id: "seal1", name: "Selo Nike" },
};
const componentItem: StoreItem = {
  sku: "C1", name: "Porta Nike", kind: "COMPONENT", moldId: "door-a", slotType: "DOOR", blockLabel: "Porta lisa", material: "METAL", materialLabel: "Metal", colorName: "Ouro",
  finish: { color: "#D4AF37", metalness: 0.9 }, pricePoints: 300, requiredLevel: "ESTREIA", sold: 0, availability: "EM_BREVE", requiresSeal: false, active: false,
};
const oddItem: StoreItem = { ...componentItem, sku: "C2", name: "Peça antiga", availability: "XYZ" as never, material: null, colorName: null, finish: undefined };

const MINE = { identity: OPTIONS.identity, items: [wardrobeItem, componentItem, oddItem], stats: { items: 3, sold: 3, points: 2700 } };
const NONE = { identity: OPTIONS.identity, items: [], stats: { items: 0, sold: 0, points: 0 } };

const chip = (name: RegExp | string) => screen.getByRole("button", { name });
const publish = () => screen.getByRole("button", { name: "Publicar na loja do quarto" }) as HTMLButtonElement;
const choose = (id: string, option: string) => { fireEvent.click(document.getElementById(id)!); fireEvent.click(screen.getByRole("option", { name: option })); };

async function open(routes: Record<string, unknown> = {}) {
  const api = loggedAs(undefined, { "GET /api/room-creator/options": OPTIONS, "GET /api/room-creator/items": NONE, ...routes });
  renderApp(<WardrobeCreatorTab />);
  await screen.findByText("Novo guarda-roupa inteiro");
  return api;
}

describe("criador de guarda-roupa — utilitários", () => {
  it("acabamento junta cor e material; sem material só a cor", () => {
    expect(finishOf(OPTIONS.materials[1], { moldId: "x", material: "METAL", colorName: "Ouro", color: "#D4AF37" })).toEqual({ color: "#D4AF37", roughness: 0.2, metalness: 0.9, material: "METAL" });
    expect(finishOf(undefined, { moldId: "x", material: "?", colorName: "?", color: "#111" })).toEqual({ color: "#111", roughness: undefined, metalness: undefined, material: undefined });
  });
  it("rótulos traduzidos dos blocos e da disponibilidade", () => {
    expect(SLOT_LABELS.DOOR).toBe("Portas");
    expect(SLOT_LABELS.LIGHT).toBe("LED");
    expect(SLOT_LABELS.ISLAND).toBe("Ilha central");
    expect([SLOT_LABELS.MIRROR, SLOT_LABELS.DRAWER, SLOT_LABELS.HANDLE, SLOT_LABELS.TOP, SLOT_LABELS.BASE, SLOT_LABELS.HANGER, SLOT_LABELS.LOGO, SLOT_LABELS.RUG, SLOT_LABELS.SHOE_RACK, SLOT_LABELS.BAG_DISPLAY, SLOT_LABELS.JEWELRY])
      .toEqual(["Espelho", "Gavetas", "Puxadores", "Maleiro", "Base", "Cabides", "Placa de logo", "Tapete", "Sapateira", "Vitrine de bolsas", "Porta-joias"]);
    expect(AVAILABILITY.DISPONIVEL.label).toBe("à venda");
    expect(AVAILABILITY.EM_BREVE.label).toBe("em breve");
    expect(AVAILABILITY.INATIVO.label).toBe("fora da loja");
  });
});

describe("criador de guarda-roupa — estados da aba", () => {
  it("erro ao carregar as opções mostra o erro com tentar de novo", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/room-creator/options": new Response(JSON.stringify({ status: 500, code: "ERRO", message: "Falhou feio" }), { status: 500, headers: { "content-type": "application/json" } }) });
    renderApp(<WardrobeCreatorTab />);
    expect(await screen.findByText("Falhou feio")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/room-creator/options").length).toBeGreaterThan(1));
  });

  it("começa sem blocos: porta não incluída, publicar desabilitado e lista vazia", async () => {
    await open();
    expect(screen.getByText("(não incluído)")).toBeTruthy();
    expect(screen.getByText(/toque para incluir e editar/)).toBeTruthy();
    expect(publish().disabled).toBe(true);
    expect(await screen.findByText("Nenhuma criação ainda.")).toBeTruthy();
    expect(screen.getByText("sem logo")).toBeTruthy();
    expect(screen.getByText("sem arte")).toBeTruthy();
    // bloco fora da lista de rótulos usa o nome do bloco
    expect(chip("+ Pôster da marca")).toBeTruthy();
    // incluir a porta pelo botão
    fireEvent.click(screen.getByRole("button", { name: "Incluir este bloco" }));
    expect(chip("✓ Portas")).toBeTruthy();
    expect(screen.queryByText("(não incluído)")).toBeNull();
  });

  it("erro ao carregar as criações aparece só na lista", async () => {
    await open({ "GET /api/room-creator/items": new Response(JSON.stringify({ status: 500, code: "ERRO", message: "Lista indisponível" }), { status: 500, headers: { "content-type": "application/json" } }) });
    expect(await screen.findByText("Lista indisponível")).toBeTruthy();
    expect(screen.getByText("Novo componente")).toBeTruthy();
  });
});

describe("criador de guarda-roupa — montar e publicar", () => {
  it("guarda-roupa inteiro: blocos padrão, troca de material, modelo e cor, e publica com o pacote", async () => {
    const { calls } = await open({ "POST /api/room-creator/items": (_u: URL, init: RequestInit) => ({ ...wardrobeItem, sku: "NEW1", name: JSON.parse(String(init.body)).name, pricePoints: 410, requiredLevel: "LOFT" }) });
    fireEvent.click(screen.getByRole("button", { name: "Novo guarda-roupa inteiro" }));
    for (const s of ["Portas", "Gavetas", "Puxadores", "Placa de logo", "Cabides"]) expect(chip(`✓ ${s}`)).toBeTruthy();
    expect(chip("+ LED")).toBeTruthy();
    // preço sugerido: 100×1 + 50×1 + 10×2 + 20×1 + 5×1 = 195; o metal do puxador exige LOFT
    expect(screen.getByText("sugerido: 195")).toBeTruthy();
    expect(screen.getByText("blocos/materiais exigem LOFT")).toBeTruthy();
    expect((screen.getByLabelText("Nome gravado na placa") as HTMLInputElement).value).toBe("Nike");
    expect(screen.getByText(/Porta lisa · Madeira · Carvalho · a partir de ESTREIA/)).toBeTruthy();

    // material metálico tem o ✦ e troca a cor que não existe nele
    fireEvent.click(chip("Metal ✦"));
    expect(screen.getByText(/Porta lisa · Metal · Ouro · a partir de LOFT/)).toBeTruthy();
    expect(screen.getByText("Cor / acabamento de metal")).toBeTruthy();
    // modelo de vidro: o material do modelo anterior não serve, vai para o primeiro do novo
    choose("mold", "Porta de vidro · a partir de STUDIO");
    expect(screen.getByText(/Porta de vidro · Vidro · Fumê · a partir de STUDIO/)).toBeTruthy();
    // voltar para a porta lisa mantém o vidro? não: o vidro não é da porta lisa, então vira madeira
    choose("mold", "Porta lisa · a partir de ESTREIA");
    expect(screen.getByText(/Porta lisa · Madeira · Carvalho/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nogueira" }));
    expect(screen.getByRole("button", { name: "Nogueira" }).getAttribute("aria-pressed")).toBe("true");
    // cor livre da marca
    fireEvent.change(screen.getByLabelText("cor da marca (hex)"), { target: { value: "#ff0000" } });
    expect(screen.getByText(/Nogueira · #FF0000/)).toBeTruthy();

    // LED: inclui o bloco e não tem cor livre
    fireEvent.click(chip("+ LED"));
    expect(screen.queryByLabelText("cor da marca (hex)")).toBeNull();
    // tocar de novo no bloco ativo remove
    fireEvent.click(chip("✓ LED"));
    expect(chip("+ LED")).toBeTruthy();
    // o espelho (fora da pré-visualização) também entra
    fireEvent.click(chip("+ Espelho"));
    expect(chip("✓ Espelho")).toBeTruthy();
    // bloco sem material conhecido não entra
    fireEvent.click(chip("+ Pôster da marca"));
    expect(screen.getByText("(não incluído)")).toBeTruthy();
    fireEvent.click(chip("✓ Portas"));

    expect(publish().disabled).toBe(true);           // sem nome
    fireEvent.change(screen.getByLabelText(/Nome do item/), { target: { value: "Closet Nike" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Linha premium" } });
    fireEvent.click(publish());
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/room-creator/items")).toBe(true));
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/room-creator/items")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ kind: "WARDROBE", name: "Closet Nike", description: "Linha premium", labelText: "Nike", sealId: null, stock: null, perUserLimit: null, availableFrom: null, availableUntil: null, requiresSeal: false, active: true });
    expect(body.slotType).toBe("DOOR");
    expect((body.bundle as { slotType: string }[]).map((b) => b.slotType).sort()).toEqual(["DOOR", "DRAWER", "HANDLE", "HANGER", "LOGO", "MIRROR"]);
    expect(typeof body.pricePoints).toBe("number");
    expect(await screen.findByText("Closet Nike publicado na loja do quarto — 410 FAI pts · nível LOFT.")).toBeTruthy();
    // depois de publicar, segue editando o item criado
    expect(screen.getByText("editando NEW1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Novo" }));
    expect(screen.queryByText("editando NEW1")).toBeNull();
  });

  it("componente: um bloco só, preço/estoque/limite/datas/selo próprios e erro da publicação", async () => {
    const { calls } = await open({ "POST /api/room-creator/items": new Response(JSON.stringify({ status: 409, code: "NOME", message: "Nome já usado" }), { status: 409, headers: { "content-type": "application/json" } }) });
    fireEvent.click(screen.getByRole("button", { name: "Novo componente" }));
    expect(screen.getByText(/escolha o componente/)).toBeTruthy();
    expect(screen.getByText("Componente")).toBeTruthy();
    expect(chip("Portas")).toBeTruthy();
    // trocar de componente substitui o bloco
    fireEvent.click(chip("Gavetas"));
    expect(screen.getByText(/Gaveta · Madeira · Carvalho/)).toBeTruthy();
    expect(screen.getByText("sugerido: 50")).toBeTruthy();
    // tocar no mesmo componente não remove
    fireEvent.click(chip("Gavetas"));
    expect(screen.getByText(/Gaveta · Madeira · Carvalho/)).toBeTruthy();
    // o pôster não tem material: o componente fica vazio
    fireEvent.click(chip("Pôster da marca"));
    expect(screen.getByText("(não incluído)")).toBeTruthy();
    fireEvent.click(chip("Gavetas"));

    fireEvent.change(screen.getByLabelText(/Nome do item/), { target: { value: "Gaveta Nike" } });
    expect((screen.getByLabelText(/Nome do item/) as HTMLInputElement).placeholder).toBe("Porta Nike");
    fireEvent.change(screen.getByLabelText("Nome gravado na placa"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Preço (FAI Points)"), { target: { value: "777" } });
    fireEvent.change(screen.getByLabelText("Estoque (edição limitada)"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Limite por pessoa"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Disponível a partir de"), { target: { value: "2026-11-01T10:00" } });
    fireEvent.change(screen.getByLabelText("Expira em"), { target: { value: "2026-12-01T10:00" } });
    choose("lv", "STUDIO");
    expect(screen.getByText("Só vende para quem tem um selo de Nike")).toBeTruthy();
    fireEvent.click(document.getElementById("sl")!);
    expect(screen.getByRole("option", { name: /^Selo Nike · até / })).toBeTruthy();   // selo com validade mostra a data
    fireEvent.click(screen.getByRole("option", { name: "Selo Eterno" }));
    expect(screen.getByText("Só vende para quem tem este selo aprovado num look")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Só vende para quem tem este selo aprovado num look" }));
    fireEvent.click(screen.getByRole("switch", { name: "Visível na loja" }));
    fireEvent.click(publish());
    expect(await screen.findByText("Nome já usado")).toBeTruthy();
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/room-creator/items")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ kind: "COMPONENT", name: "Gaveta Nike", labelText: null, pricePoints: 777, stock: 5, perUserLimit: 1, requiredLevel: "STUDIO", sealId: "seal2", requiresSeal: true, active: false, slotType: "DRAWER", moldId: "drawer-a", material: "MADEIRA", bundle: null });
    expect(body.availableFrom).toBe(new Date("2026-11-01T10:00").toISOString());
    expect(body.availableUntil).toBe(new Date("2026-12-01T10:00").toISOString());
    expect(publish().disabled).toBe(false);          // terminou de enviar
    // tirar o selo desliga a exigência
    choose("sl", "— nenhum —");
    expect((screen.getByRole("switch", { name: "Só vende para quem tem um selo de Nike" }) as HTMLElement).getAttribute("aria-checked")).toBe("false");
  });

  it("envia logo e arte da marca; a arte pode ser removida; falha no envio avisa", async () => {
    let fail = false;
    const { calls } = await open({
      "POST /api/room-creator/uploads": (u: URL) => fail ? new Response(JSON.stringify({ status: 413, code: "GRANDE", message: "Arquivo grande demais" }), { status: 413, headers: { "content-type": "application/json" } }) : { url: `/media/${u.searchParams.get("kind")}.png` },
    });
    const [logoInput, artInput] = [...document.querySelectorAll<HTMLInputElement>("input[type=file]")];
    fireEvent.click(screen.getByRole("button", { name: "Enviar PNG" }));
    fireEvent.change(logoInput, { target: { files: [new File(["x"], "logo.png", { type: "image/png" })] } });
    expect(await screen.findByText("Logo enviado.")).toBeTruthy();
    expect(screen.getByAltText("logo").getAttribute("src")).toContain("/media/logo.png");
    fireEvent.change(artInput, { target: { files: [new File(["x"], "arte.png", { type: "image/png" })] } });
    expect(await screen.findByText("Arte enviada.")).toBeTruthy();
    expect(screen.getByAltText("arte").getAttribute("src")).toContain("/media/art.png");
    expect(screen.getAllByRole("button", { name: "Trocar" })).toHaveLength(2);
    expect(calls.filter((c) => c.path.startsWith("/api/room-creator/uploads")).map((c) => c.path)).toEqual(["/api/room-creator/uploads?kind=logo", "/api/room-creator/uploads?kind=art"]);
    fireEvent.click(screen.getByRole("button", { name: "remover" }));
    expect(screen.queryByAltText("arte")).toBeNull();
    // sem arquivo escolhido não envia nada
    fireEvent.change(artInput, { target: { files: [] } });
    fail = true;
    fireEvent.change(artInput, { target: { files: [new File(["x"], "arte.png", { type: "image/png" })] } });
    expect(await screen.findByText("Arquivo grande demais")).toBeTruthy();
    expect(calls.filter((c) => c.path.startsWith("/api/room-creator/uploads"))).toHaveLength(3);
  });

  it("marca com logo próprio mostra o logo sem envio", async () => {
    await open({ "GET /api/room-creator/options": { ...OPTIONS, identity: { ...OPTIONS.identity, logoUrl: "/media/marca.png" } } });
    expect(screen.getByAltText("logo").getAttribute("src")).toContain("/media/marca.png");
    expect(screen.getByRole("button", { name: "Enviar PNG" })).toBeTruthy();
  });
});

describe("criador de guarda-roupa — minhas criações", () => {
  it("lista com estatísticas, disponibilidade, selo, estoque e janelas de venda", async () => {
    await open({ "GET /api/room-creator/items": MINE });
    expect(await screen.findByText("Guarda-roupa Nike")).toBeTruthy();
    expect(screen.getByText("3 itens · 3 vendas · 2.700 FAI pts")).toBeTruthy();
    expect(screen.getByText("Guarda-roupa inteiro · 2 blocos")).toBeTruthy();
    expect(screen.getByText("Porta lisa · Metal · Ouro")).toBeTruthy();
    expect(screen.getByText("à venda")).toBeTruthy();
    expect(screen.getByText("em breve")).toBeTruthy();
    expect(screen.getByText("XYZ")).toBeTruthy();                        // disponibilidade desconhecida aparece crua
    expect(screen.getByText("selo Selo Nike")).toBeTruthy();
    expect(screen.getByText(/^3 vendidos \/ 10 · máx\. 2\/pessoa · de .+ · até .+$/)).toBeTruthy();
    expect(screen.getAllByText("0 vendidos")).toHaveLength(2);
    // vendido: retirar; não vendido: excluir
    expect(screen.getByRole("button", { name: "Retirar" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Excluir" })).toHaveLength(2);
  });

  it("editar guarda-roupa carrega o formulário e salva com PUT", async () => {
    const scroll = vi.fn(); vi.stubGlobal("scrollTo", scroll); window.scrollTo = scroll as never;
    const { calls } = await open({ "GET /api/room-creator/items": MINE, "PUT /api/room-creator/items/W1": (_u: URL, init: RequestInit) => ({ ...wardrobeItem, name: JSON.parse(String(init.body)).name }) });
    await screen.findByText("Guarda-roupa Nike");
    const card = screen.getByText("Guarda-roupa Nike").closest(".surface") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Editar" }));
    expect(scroll).toHaveBeenCalled();
    expect(screen.getByText("editando W1")).toBeTruthy();
    expect((screen.getByLabelText(/Nome do item/) as HTMLInputElement).value).toBe("Guarda-roupa Nike");
    expect((screen.getByLabelText("Estoque (edição limitada)") as HTMLInputElement).value).toBe("10");
    expect((screen.getByLabelText("Limite por pessoa") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("Disponível a partir de") as HTMLInputElement).value).toBe("2026-05-01T12:00");
    expect(chip("✓ Portas")).toBeTruthy();
    expect(chip("✓ Gavetas")).toBeTruthy();
    expect(chip("+ Puxadores")).toBeTruthy();
    expect(screen.getByAltText("arte")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nome do item/), { target: { value: "Guarda-roupa Nike 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Guarda-roupa Nike 2 atualizado — 900 FAI pts · nível STUDIO.")).toBeTruthy();
    const put = calls.find((c) => c.method === "PUT")!.body as Record<string, unknown>;
    expect(put).toMatchObject({ name: "Guarda-roupa Nike 2", pricePoints: 900, stock: 10, perUserLimit: 2, sealId: "seal1", requiresSeal: true, logoUrl: "/media/logo.png", artUrl: "/media/art.png" });
  });

  it("editar componente e item sem acabamento usa o bloco do item", async () => {
    window.scrollTo = vi.fn() as never;
    await open({ "GET /api/room-creator/items": MINE });
    await screen.findByText("Porta Nike");
    fireEvent.click(within(screen.getByText("Porta Nike").closest(".surface") as HTMLElement).getByRole("button", { name: "Editar" }));
    expect(screen.getByText("editando C1")).toBeTruthy();
    expect(screen.getByText(/Porta lisa · Metal · Ouro · a partir de LOFT/)).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Visível na loja" }).getAttribute("aria-checked")).toBe("false");
    fireEvent.click(within(screen.getByText("Peça antiga").closest(".surface") as HTMLElement).getByRole("button", { name: "Editar" }));
    expect(screen.getByText("editando C2")).toBeTruthy();
    // sem material gravado: nenhum material marcado e nenhuma cor para escolher
    expect(chip("Madeira").getAttribute("aria-pressed")).toBe("false");
    expect(chip("Metal ✦").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Cor / acabamento")).toBeTruthy();
  });

  it("guarda-roupa sem pacote abre na porta, sem blocos", async () => {
    window.scrollTo = vi.fn() as never;
    const bare: StoreItem = { ...wardrobeItem, sku: "W2", name: "Vazio", bundle: undefined, description: null, labelText: null, logoUrl: null, artUrl: null, seal: null, stock: null, perUserLimit: null, availableFrom: null, availableUntil: null };
    await open({ "GET /api/room-creator/items": { ...MINE, items: [bare] } });
    await screen.findByText("Vazio");
    expect(screen.getByText("Guarda-roupa inteiro · 0 blocos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByText("(não incluído)")).toBeTruthy();
    expect((screen.getByLabelText("Estoque (edição limitada)") as HTMLInputElement).value).toBe("");
  });

  it("retirar item vendido e excluir item em edição pedem confirmação", async () => {
    window.scrollTo = vi.fn() as never;
    const { calls } = await open({ "GET /api/room-creator/items": MINE, "DELETE /api/room-creator/items/W1": undefined, "DELETE /api/room-creator/items/C1": undefined });
    await screen.findByText("Guarda-roupa Nike");
    fireEvent.click(screen.getByRole("button", { name: "Retirar" }));
    expect(screen.getByText("Retirar da loja?")).toBeTruthy();
    expect(screen.getByText("Guarda-roupa Nike já foi vendido 3×: ele sai da loja, mas quem comprou continua com ele no quarto.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Retirar da loja?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retirar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Retirado da loja — quem comprou continua com o item.")).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/room-creator/items/W1")).toBe(true);

    const card = screen.getByText("Porta Nike").closest(".surface") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Editar" }));
    expect(screen.getByText("editando C1")).toBeTruthy();
    fireEvent.click(within(screen.getByText("Porta Nike").closest(".surface") as HTMLElement).getByRole("button", { name: "Excluir" }));
    expect(screen.getByText("Excluir item?")).toBeTruthy();
    expect(screen.getByText("Porta Nike será excluído.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Item excluído.")).toBeTruthy();
    expect(screen.queryByText("editando C1")).toBeNull();               // o item em edição saiu: volta para um novo
  });

  it("falha ao excluir avisa e fecha a confirmação", async () => {
    await open({ "GET /api/room-creator/items": MINE, "DELETE /api/room-creator/items/C1": new Response(JSON.stringify({ status: 403, code: "PROIBIDO", message: "Sem permissão" }), { status: 403, headers: { "content-type": "application/json" } }) });
    await screen.findByText("Porta Nike");
    fireEvent.click(within(screen.getByText("Porta Nike").closest(".surface") as HTMLElement).getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Sem permissão")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Excluir item?")).toBeNull());
  });
});

describe("amostra do item na loja", () => {
  it("faixas por bloco do pacote, com metal em degradê, logo da marca e nome gravado", () => {
    const { container } = renderApp(<StoreSwatch item={{ ...wardrobeItem, artUrl: null, bundle: [...wardrobeItem.bundle!, { slotType: "HANDLE", moldId: "h", material: "METAL", colorName: "Ouro", finish: { color: "#D4AF37", metalness: 0.95 } }] }} />);
    const stripes = [...container.querySelectorAll("span[title]")] as HTMLElement[];
    expect(stripes.map((s) => s.title)).toEqual(["DOOR", "DRAWER", "HANDLE"]);
    expect(stripes[1].style.background).toBe("rgb(204, 204, 204)");     // sem acabamento: cinza
    expect(stripes[2].style.background).toContain("linear-gradient");
    expect(container.querySelector("img")!.getAttribute("src")).toContain("/media/logo.png");
    expect(screen.getByText("NIKE")).toBeTruthy();
  });
  it("componente de vidro fica translúcido; com arte, a arte cobre a amostra; logo do criador como reserva", () => {
    const glass: StoreItem = { ...componentItem, finish: { color: "#336699", material: "VIDRO" }, creator: { name: "Nike", logoUrl: "/media/criador.png", kind: "BRAND" } };
    const { container, unmount } = renderApp(<StoreSwatch item={glass} className="h-10" />);
    expect((container.querySelector("span[title=DOOR]") as HTMLElement).style.background).toContain("rgba(51, 102, 153");
    expect((container.firstChild as HTMLElement).className).toContain("h-10");
    expect(container.querySelector("img")!.getAttribute("src")).toContain("/media/criador.png");
    unmount();
    const art = renderApp(<StoreSwatch item={{ ...componentItem, artUrl: "/media/art.png", finish: undefined }} />);
    expect(art.container.querySelector("span[title]")).toBeNull();
    expect((art.container.firstChild as HTMLElement).style.backgroundImage).toContain("/media/art.png");
    expect(art.container.querySelector("img")).toBeNull();
  });
});

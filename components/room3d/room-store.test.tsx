// @vitest-environment jsdom
/**
 * Loja do quarto (RF35 + RF39): cartões com as condições de cada item, filtros (tipo, bloco, material, origem, marca,
 * só o que posso comprar), busca, ordenação, paginação, prova sem compra, mais informações, prévia 3D e a montagem do
 * item comprado num módulo do quarto.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { RoomStore, moduleLabel } from "./room-store";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const base = { availability: "DISPONIVEL", requiresSeal: false, active: true, sold: 0, requiredLevel: "ESTREIA", levelOk: true, affordable: true };
const A = { ...base, sku: "A", name: "Porta Carvalho", kind: "COMPONENT", moldId: "door-a", slotType: "DOOR", blockLabel: "Porta lisa (60 cm)", material: "MADEIRA", materialLabel: "Madeira", colorName: "Carvalho",
  pricePoints: 100, rarity: "RARO", stock: 10, stockLeft: 3, perUserLimit: 2, availableFrom: "2026-05-01T12:00:00Z", availableUntil: "2026-12-01T12:00:00Z",
  finish: { color: "#AA8855", model3dUrl: "/media/a.glb" }, compatibleModules: ["door:1", "door:2"], inventory: [{ inventoryId: "inv1", appliedModule: null }, { inventoryId: "inv2", appliedModule: "door:2" }] };
const B = { ...base, sku: "B", name: "Gaveta Nike", kind: "COMPONENT", moldId: "drawer-a", slotType: "DRAWER", blockLabel: "Gaveta 90 cm funda", material: "METAL", materialLabel: "Metal", colorName: "Ouro",
  pricePoints: 300, levelOk: false, requiredLevel: "LOFT", rarity: "COMUM", seal: { id: "s1", name: "Selo Nike" }, requiresSeal: true,
  creator: { name: "Nike", slug: "nike", logoUrl: "/media/nike.png", kind: "MARCA" }, finish: { color: "#D4AF37", metalness: 0.9 }, compatibleModules: ["drawer:1"] };
const C = { ...base, sku: "C", name: "Closet Anitta", kind: "WARDROBE", moldId: "door-a", slotType: "DOOR", blockLabel: "Porta lisa", pricePoints: 200, affordable: false, availability: "XYZ",
  bundle: [{ slotType: "DOOR", moldId: "door-a", material: "MADEIRA", colorName: "Rosa", finish: { color: "#ff99cc" } }, { slotType: "PUFF", moldId: "p", material: "VIDRO", colorName: "Lilás", finish: { color: "#cc99ff" } }],
  creator: { name: "Anitta", slug: "anitta", kind: "CELEBRIDADE" }, compatibleModules: [], inventory: [{ inventoryId: "inv3", appliedModule: null }] };
const D = { ...base, sku: "D", name: "Puxador Básico", kind: "COMPONENT", moldId: "handle-a", slotType: "HANDLE", blockLabel: "Puxador", material: null, materialLabel: null, colorName: null,
  pricePoints: 50, blocker: "Limite por pessoa atingido", compatibleModules: ["handles"] };
const E = { ...base, sku: "E", name: "Placa Sem Slug", kind: "COMPONENT", moldId: "logo-a", slotType: "LOGO", blockLabel: "Placa", material: "MADEIRA", materialLabel: "Madeira", colorName: "Nogueira",
  pricePoints: 150, creator: { name: "Marca Antiga", kind: "MARCA" }, compatibleModules: ["logo"] };
const SHOP = [A, B, C, D, E];

const names = () => [...document.querySelectorAll(".grid-cards b")].map((b) => b.textContent);
const card = (name: string) => screen.getByText(name).closest(".surface") as HTMLElement;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function open(routes: Record<string, unknown> = {}, props: Parameters<typeof RoomStore>[0] = {}) {
  const api = loggedAs(undefined, { "GET /api/points/shop": SHOP, ...routes });
  renderApp(<RoomStore {...props} />);
  // sessão restaurada + loja carregada: com a suíte inteira e cobertura ligada passa de 1 s
  await screen.findByText("Porta Carvalho", undefined, { timeout: 4000 });
  return api;
}
function filter(group: string, option: string) {
  fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
  const sheet = screen.getByText(group, { selector: "legend" }).closest("fieldset") as HTMLElement;
  fireEvent.click(within(sheet).getByRole("button", { name: option }));
  fireEvent.click(screen.getByRole("button", { name: /^Ver|^Nenhum resultado/ }));
}

describe("loja do quarto — rótulos dos módulos", () => {
  it("portas e gavetas numeradas, módulos com nome e o vazio", () => {
    expect(moduleLabel("door:3")).toBe("Porta 3");
    expect(moduleLabel("drawer:12")).toBe("Gaveta 12");
    expect(moduleLabel("ALL")).toBe("Guarda-roupa inteiro");
    expect(["handles", "top", "base", "hangers", "logo", "rug", "shoe", "bags", "jewelry", "island", "light", "season", "signature"].map(moduleLabel))
      .toEqual(["Puxadores", "Maleiro", "Base", "Cabides", "Placa de logo", "Tapete", "Sapateira", "Vitrine de bolsas", "Porta-joias", "Ilha central", "Iluminação", "Maleiro da estação", "Closet de assinatura"]);
    expect(moduleLabel(null)).toBe("—");
    expect(moduleLabel("outro")).toBe("outro");
  });
});

describe("loja do quarto — vitrine", () => {
  it("erro ao carregar a loja", async () => {
    loggedAs(undefined, { "GET /api/points/shop": json(500, { status: 500, code: "X", message: "Loja fora do ar" }) });
    renderApp(<RoomStore />);
    expect(await screen.findByText("Loja fora do ar")).toBeTruthy();
  });

  it("cartões com preço, origem, selo, raridade, estoque, unidades já compradas e bloqueios; ordenados pelo menor preço", async () => {
    await open();
    expect(names()).toEqual(["Puxador Básico", "Porta Carvalho", "Placa Sem Slug", "Closet Anitta", "Gaveta Nike"]);
    const a = card("Porta Carvalho");
    expect(within(a).getByText("Porta lisa (60 cm) · Madeira · Carvalho")).toBeTruthy();
    expect(within(a).getByText("raro")).toBeTruthy();
    expect(within(a).getByText(/^restam 3\/10 · máx\. 2\/pessoa · de .+ até .+$/)).toBeTruthy();
    expect(within(a).getByText(/Você tem 2:/).textContent).toContain("na caixa, Porta 2");
    expect(within(a).getByText("Fábrica FAI")).toBeTruthy();
    expect(within(a).getByRole("button", { name: "Comprar outro" })).toBeTruthy();
    const b = card("Gaveta Nike");
    expect(within(b).getByText("Marca · Nike").closest("a")!.getAttribute("href")).toBe("/brands/nike");
    expect(within(b).getByText("selo Selo Nike")).toBeTruthy();
    expect(within(b).getByText("exige selo")).toBeTruthy();
    expect(within(b).queryByText("comum")).toBeNull();
    const buyB = within(b).getByRole("button", { name: "Comprar" }) as HTMLButtonElement;
    expect(buyB.disabled).toBe(true);
    expect(buyB.title).toBe("Disponível a partir do nível LOFT");
    const c = card("Closet Anitta");
    expect(within(c).getByText("Guarda-roupa inteiro · 2 blocos")).toBeTruthy();
    expect(within(c).getByText("Portas: Rosa · PUFF: Lilás")).toBeTruthy();
    expect(within(c).getByText("Celebridade · Anitta")).toBeTruthy();
    expect(within(c).getByText("XYZ")).toBeTruthy();
    expect((within(c).getByRole("button", { name: "Comprar outro" }) as HTMLButtonElement).title).toBe("Saldo insuficiente");
    const d = card("Puxador Básico");
    expect(within(d).getByText("Limite por pessoa atingido")).toBeTruthy();
    expect((within(d).getByRole("button", { name: "Comprar" }) as HTMLButtonElement).title).toBe("Limite por pessoa atingido");
    expect([...d.querySelectorAll("p")].map((p) => p.textContent)).toContain("Puxador ·  · ");   // sem material nem cor
    expect(within(card("Placa Sem Slug")).getByText("Marca · Marca Antiga").closest("a")!.getAttribute("href")).toBe("#");
  });

  it("ordenação por maior preço e marcas primeiro", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
    fireEvent.click(screen.getByRole("option", { name: "Maior preço" }));
    expect(names()).toEqual(["Gaveta Nike", "Closet Anitta", "Placa Sem Slug", "Porta Carvalho", "Puxador Básico"]);
    fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
    fireEvent.click(screen.getByRole("option", { name: "Marcas primeiro" }));
    expect(names()).toEqual(["Placa Sem Slug", "Closet Anitta", "Gaveta Nike", "Puxador Básico", "Porta Carvalho"]);
  });

  it("tipo, busca por cor (também nas peças do conjunto) e lista vazia", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Guarda-roupas inteiros" }));
    expect(names()).toEqual(["Closet Anitta"]);
    fireEvent.click(screen.getByRole("button", { name: "Componentes" }));
    expect(names()).not.toContain("Closet Anitta");
    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));
    fireEvent.change(screen.getByLabelText("buscar cor ou nome"), { target: { value: "lilás" } });
    expect(names()).toEqual(["Closet Anitta"]);
    fireEvent.change(screen.getByLabelText("buscar cor ou nome"), { target: { value: "selo nike" } });
    expect(names()).toEqual(["Gaveta Nike"]);
    fireEvent.change(screen.getByLabelText("buscar cor ou nome"), { target: { value: "zzz" } });
    expect(screen.getByText("Nenhum item com esses filtros.")).toBeTruthy();
    expect(screen.getByText("Limpe os filtros para ver toda a loja.")).toBeTruthy();
  });

  it("filtros de bloco, material (inclusive do conjunto), origem, marca e só o que posso comprar", async () => {
    await open();
    filter("bloco", "Gaveta");                              // rótulo do bloco sem a medida
    expect(names()).toEqual(["Gaveta Nike"]);
    fireEvent.click(screen.getByRole("button", { name: "Remover filtro bloco: Gaveta" }));
    filter("material", "Metal");
    expect(names()).toEqual(["Gaveta Nike"]);
    filter("material", "Madeira");                         // o conjunto entra pela madeira de um dos blocos
    expect(names()).toEqual(["Porta Carvalho", "Placa Sem Slug", "Closet Anitta"]);
    fireEvent.click(screen.getByRole("button", { name: "Remover filtro material: Madeira" }));
    filter("origem", "Fábrica FAI");
    expect(names()).toEqual(["Puxador Básico", "Porta Carvalho"]);
    filter("origem", "Celebridades");
    expect(names()).toEqual(["Closet Anitta"]);
    fireEvent.click(screen.getByRole("button", { name: "Remover filtro origem: Celebridades" }));
    filter("marca ou celebridade", "Nike");
    expect(names()).toEqual(["Gaveta Nike"]);
    fireEvent.click(screen.getByRole("button", { name: "Remover filtro marca ou celebridade: Nike" }));
    filter("Disponibilidade", "Só o que posso comprar");
    expect(names()).toEqual(["Porta Carvalho", "Placa Sem Slug"]);
    // com o tipo "guarda-roupa" o filtro de bloco some
    fireEvent.click(screen.getByRole("button", { name: "Guarda-roupas inteiros" }));
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    expect(screen.queryByText("bloco", { selector: "legend" })).toBeNull();
  });

  it("loja de uma marca: só os itens dela, sem filtro de origem, e o aviso de vazio da marca", async () => {
    loggedAs(undefined, { "GET /api/points/shop": SHOP });
    renderApp(<RoomStore creatorSlug="nike" />);
    await screen.findByText("Gaveta Nike");
    expect(names()).toEqual(["Gaveta Nike"]);
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    expect(screen.queryByText("origem", { selector: "legend" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Ver|Pronto/ }));
    fireEvent.change(screen.getByLabelText("buscar cor ou nome"), { target: { value: "zzz" } });
    expect(screen.getByText("Esta marca/celebridade ainda não publicou itens na loja do quarto.")).toBeTruthy();
  });

  it("mostra 24 por vez com 'mostrar mais'; no modo compacto, 12 e sem botão", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...E, sku: `M${i}`, name: `Item ${i}`, pricePoints: i, creator: undefined }));
    loggedAs(undefined, { "GET /api/points/shop": many });
    const view = renderApp(<RoomStore />);
    await screen.findByText("Item 0");
    expect(names()).toHaveLength(24);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar mais 6 (24 de 30)" }));
    expect(names()).toHaveLength(30);
    view.unmount();
    renderApp(<RoomStore compact />);
    await screen.findByText("Item 0");
    expect(names()).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /Mostrar mais/ })).toBeNull();
  });
});

describe("loja do quarto — ações do item", () => {
  it("provar mostra onde a prévia aparece, sem comprar; falha avisa", async () => {
    let reply: unknown = { module: "door:1", note: "acabamento aplicado por 1 min" };
    const { calls } = await open({ "POST /api/points/shop/A/try-on": () => reply });
    fireEvent.click(within(card("Porta Carvalho")).getByRole("button", { name: "Provar" }));
    expect(await screen.findByText("Prévia em Porta 1: acabamento aplicado por 1 min")).toBeTruthy();
    reply = {};
    fireEvent.click(within(card("Porta Carvalho")).getByRole("button", { name: "Provar" }));
    expect(await screen.findByText("Prévia em —: nada foi comprado.")).toBeTruthy();
    reply = json(409, { status: 409, code: "X", message: "Prova indisponível" });
    fireEvent.click(within(card("Porta Carvalho")).getByRole("button", { name: "Provar" }));
    expect(await screen.findByText("Prova indisponível")).toBeTruthy();
    expect(calls.filter((c) => c.path.endsWith("/try-on"))).toHaveLength(3);
  });

  it("mais informações: para que serve e módulos compatíveis (ou nenhum)", async () => {
    await open();
    fireEvent.click(within(card("Porta Carvalho")).getByRole("button", { name: "Mais informações" }));
    expect(screen.getByText("Este item personaliza Porta lisa (60 cm) no seu quarto 3D.")).toBeTruthy();
    expect(screen.getByText(/Módulos compatíveis: Porta 1, Porta 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Fechar/i }));
    fireEvent.click(within(card("Closet Anitta")).getByRole("button", { name: "Mais informações" }));
    expect(screen.getByText("Este conjunto personaliza os módulos compatíveis do seu guarda-roupa 3D.")).toBeTruthy();
    expect(screen.getByText(/Módulos compatíveis: Nenhum módulo compatível/)).toBeTruthy();
  });

  it("prévia do modelo 3D só para itens com modelo", async () => {
    await open();
    expect(within(card("Gaveta Nike")).queryByRole("button", { name: "Revisar modelo 3D" })).toBeNull();
    fireEvent.click(within(card("Porta Carvalho")).getByRole("button", { name: "Revisar modelo 3D" }));
    expect(screen.getByRole("dialog", { name: "Porta Carvalho" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Fechar/i }));
    expect(screen.queryByRole("dialog", { name: "Porta Carvalho" })).toBeNull();
  });

  it("saldo insuficiente avisa sem abrir a confirmação", async () => {
    const { calls } = await open();
    fireEvent.click(within(card("Closet Anitta")).getByRole("button", { name: "Comprar outro" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Seu saldo de FAI Points é insuficiente");
    expect(calls.some((c) => c.path.includes("purchase"))).toBe(false);
  });

  it("comprar confirma, mostra o número de série e abre a montagem; montar no módulo escolhido avisa a página", async () => {
    const onChanged = vi.fn();
    const { calls } = await open({
      "POST /api/points/shop/E/purchase": { inventoryId: "inv9", balance: 850, serial: "7" },
      "POST /api/me/room-inventory/inv9/apply": undefined,
    }, { onChanged });
    fireEvent.click(within(card("Placa Sem Slug")).getByRole("button", { name: "Comprar" }));
    expect(screen.getByText("Confirmar compra com FAI Points")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Confirmar compra com FAI Points")).toBeNull();
    fireEvent.click(within(card("Placa Sem Slug")).getByRole("button", { name: "Comprar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
    expect(await screen.findByText("Placa Sem Slug comprado (nº 7) — saldo 850 pts.")).toBeTruthy();
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Montar Placa Sem Slug")).toBeTruthy();
    expect(screen.getByText("Escolha o módulo onde este componente será montado.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Placa de logo" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Montar" }));
    expect(await screen.findByText("Placa Sem Slug montado em Placa de logo.")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/me/room-inventory/inv9/apply")!.body).toEqual({ moduleId: "logo" });
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it("retirar do quarto devolve a unidade montada para a caixa sem tirar do inventário", async () => {
    const onChanged = vi.fn();
    const { calls } = await open({ "DELETE /api/me/room-inventory/inv2/apply": { applied: false, module: "door:2", sku: "A", inventoryId: "inv2" } }, { onChanged });
    expect(within(card("Placa Sem Slug")).queryByRole("button", { name: "Retirar do quarto" })).toBeNull();   // nada montado
    fireEvent.click(within(card("Porta Carvalho")).getByRole("button", { name: "Retirar do quarto" }));
    expect(await screen.findByText("Porta Carvalho saiu do quarto e continua no seu inventário.")).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/me/room-inventory/inv2/apply")).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("compra sem número de série; montar escolhendo outro módulo e falha ao montar", async () => {
    await open({
      "POST /api/points/shop/A/purchase": { inventoryId: "inv7", balance: 10, serial: "null" },
      "POST /api/me/room-inventory/inv7/apply": json(409, { status: 409, code: "X", message: "Módulo ocupado" }),
    });
    fireEvent.click(within(card("Porta Carvalho")).getByRole("button", { name: "Comprar outro" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
    expect(await screen.findByText("Porta Carvalho comprado — saldo 10 pts.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Porta 2" }));
    expect(screen.getByRole("button", { name: "Porta 2" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Montar" }));
    expect(await screen.findByText("Módulo ocupado")).toBeTruthy();
    expect(screen.getByText("Montar Porta Carvalho")).toBeTruthy();         // continua aberto para tentar outro
    fireEvent.click(screen.getByRole("button", { name: "Deixar na caixa" }));
    expect(screen.queryByText("Montar Porta Carvalho")).toBeNull();
  });

  it("compra recusada pelo servidor mostra o motivo e libera nova tentativa", async () => {
    await open({ "POST /api/points/shop/E/purchase": () => json(500, { status: 500, code: "X", message: "Erro interno" }) });
    fireEvent.click(within(card("Placa Sem Slug")).getByRole("button", { name: "Comprar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar compra" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Erro interno");
    // o servidor recusou: a mesma chave de compra não é reaproveitada e dá para tentar de novo
    fireEvent.click(screen.getByRole("button", { name: /Fechar/i }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect((within(card("Placa Sem Slug")).getByRole("button", { name: "Comprar" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("montar no quarto uma unidade da caixa; conjunto sem módulo compatível não monta", async () => {
    await open();
    fireEvent.click(within(card("Porta Carvalho")).getByRole("button", { name: "Montar no quarto" }));
    expect(screen.getByText("Montar Porta Carvalho")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Porta 1" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Deixar na caixa" }));
    fireEvent.click(within(card("Closet Anitta")).getByRole("button", { name: "Montar no quarto" }));
    expect(screen.getByText("Montar Closet Anitta")).toBeTruthy();
    expect(screen.getByText(/^Nenhum módulo compatível no seu nível atual/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Montar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("montar conjunto inteiro explica que troca todos os blocos", async () => {
    await open({ "GET /api/points/shop": [{ ...C, compatibleModules: ["ALL"] }, A] });
    fireEvent.click(within(card("Closet Anitta")).getByRole("button", { name: "Montar no quarto" }));
    expect(screen.getByText("O guarda-roupa inteiro troca o acabamento de todos os blocos de uma vez.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guarda-roupa inteiro" })).toBeTruthy();
  });
});

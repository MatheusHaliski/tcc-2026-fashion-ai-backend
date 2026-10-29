// @vitest-environment jsdom
/**
 * Esquema, peça e DNA AMPLIADOS (RF7.CA07–CA12) e a janela de sucesso (RF5/RF4/RF13): ações do dono do look (publicar,
 * look do dia, sugerir e aceitar selos, melhorar com IA), detalhe da peça (carrossel, dados, "Mais opções", edição,
 * exclusão com impacto, estúdio e aprovação, 3D, tela cheia) e o que quem visita vê.
 * As janelas pesadas (editor de imagem, arte, 3D, manequim, tela cheia) são trocadas por botões que chamam os callbacks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import { PIECE, SCHEME } from "@/test-utils/fixtures";
import { label } from "@/lib/api/taxonomy";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { tokenStore } from "@/lib/api/client";
import type { Me, PieceView, SchemeView } from "@/lib/api/types";
import { CreationSuccess, ExpandedDna, ExpandedPiece, ExpandedScheme } from "./expanded-card";

const model = vi.hoisted(() => ({ st: null as null | { status: string; modelUrl?: string } }));
vi.mock("@/components/model3d-panel", () => ({
  useModel3d: () => ({ st: model.st }),
  Model3dAction: ({ onView }: { onView: () => void }) => <button onClick={onView}>Ver em 3D</button>,
  Model3dTechnical: () => <p>técnico do 3D</p>,
}));
vi.mock("@/components/edit-image", async (orig) => ({
  ...(await orig<typeof import("./edit-image")>()),
  EditImageDialog: ({ open, onStudio, onApprove, onDiscard, onReplace, onManual }: { open: boolean; onStudio: (b: string) => void; onApprove: () => void; onDiscard: () => void; onReplace: (f: File) => void; onManual: () => void }) => open ? (
    <div role="dialog" aria-label="Editor de imagem">
      <button onClick={() => onStudio("white")}>Estúdio branco</button><button onClick={onApprove}>Aprovar estúdio</button><button onClick={onDiscard}>Descartar estúdio</button>
      <button onClick={() => onReplace(new File(["x"], "nova.png", { type: "image/png" }))}>Trocar pelo editor</button><button onClick={onManual}>Editor manual</button>
    </div>) : null,
}));
vi.mock("@/components/piece-art-editor", () => ({
  PieceArtDialog: ({ open, piece, onSaved, onClose }: { open: boolean; piece: PieceView; onSaved: (p: PieceView) => void; onClose: () => void }) => open ? <div role="dialog" aria-label="Arte"><button onClick={() => { onSaved({ ...piece, name: "Nome pela arte" }); onClose(); }}>Salvar arte</button></div> : null,
}));
vi.mock("@/components/generate-3d", () => ({ Generate3DDialog: ({ targets, onClose }: { targets: { title: string }[]; onClose: () => void }) => <div role="dialog" aria-label="Manequim 3D">3D de {targets[0].title}<button onClick={onClose}>Fechar 3D</button></div>, Generate3DButton: () => null }));
vi.mock("@/components/mannequin-photo", async (orig) => ({
  ...(await orig<typeof import("./mannequin-photo")>()),
  MannequinPhotoButton: () => <span>botão do manequim</span>,
  MannequinPhotoDialog: ({ onClose }: { onClose: (saved: boolean) => void }) => <div role="dialog" aria-label="Foto no manequim"><button onClick={() => onClose(true)}>Salvar foto no manequim</button></div>,
}));
vi.mock("@/components/studio", async (orig) => ({
  ...(await orig<typeof import("./studio")>()),
  StudioLightbox: ({ images, start, onClose }: { images: { alt: string }[]; start: number; onClose: () => void }) => <div role="dialog" aria-label="Tela cheia">{images.map((i) => i.alt).join(" | ")} · início {start}<button onClick={onClose}>Sair da tela cheia</button></div>,
}));
vi.mock("@/components/flair/flair-collection", () => ({ FlairPieceBlock: () => <p>carta FLAIR da peça</p> }));

const HYPE = { "GET /api/hype/summaries": { type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans"] }, colors: { white: "#fff" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"], occasions: ["casual"], styles: ["basic"], allowedOccasionsByCategory: {} };
const VISITOR: Me = { user: { id: "u9", username: "bia", displayName: "Bia", profileType: "PESSOAL", verified: false, privateAccount: false }, email: "bia@example.com", emailVerified: true, status: "ACTIVE", role: "USER", twoFactorEnabled: false };
const err = (status: number, message: string) => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const piece = (extra: Partial<PieceView> = {}) => ({ ...PIECE, ...extra } as PieceView);
const openMore = async () => { fireEvent.click(await screen.findByRole("button", { name: /Mais opções/ })); };

beforeEach(() => { __resetHypeStore(); model.st = null; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); tokenStore.clear(); router.push.mockClear(); document.cookie = "fai_rt_h=; max-age=0; path=/"; window.history.pushState({}, "", "/"); });

describe("ExpandedScheme — ações do dono do look", () => {
  const draft: SchemeView = { ...SCHEME, status: "DRAFT", lookDoDia: false } as SchemeView;

  it("publica e marca como look do dia (POST e recarrega); erros aparecem no aviso", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/schemes/s1": { scheme: draft }, "POST /api/schemes/s1/publication": undefined, "POST /api/me/daily-look": err(409, "Já existe look do dia") });
    renderApp(<ExpandedScheme id="s1" headerExtra={<span>controles</span>} />);
    fireEvent.click(await screen.findByRole("button", { name: "Publicar" }));
    expect(await screen.findByText("Look publicado!")).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/api/schemes/s1/publication")?.body).toEqual({ visibility: "PUBLIC" });
    fireEvent.click(screen.getByRole("button", { name: "Marcar como look do dia" }));
    expect(await screen.findByText("Já existe look do dia")).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/api/me/daily-look")?.body).toEqual({ schemeId: "s1" });
    expect(screen.getByRole("link", { name: /Provar/ }).getAttribute("href")).toBe("/try-on?scheme=s1");
    expect(screen.getByRole("link", { name: /Editar imagem/ }).getAttribute("href")).toBe("/schemes/s1/photo");
    expect(screen.getByText("controles")).toBeTruthy();
    expect(screen.getByText("botão do manequim")).toBeTruthy();
  });

  it("look do dia com sucesso e publicar com erro", async () => {
    loggedAs(undefined, { ...HYPE, "GET /api/schemes/s1": { scheme: draft }, "POST /api/schemes/s1/publication": err(400, "Falta foto"), "POST /api/me/daily-look": undefined });
    renderApp(<ExpandedScheme id="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar como look do dia" }));
    expect(await screen.findByText("Look do Dia ✓")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    expect(await screen.findByText("Falta foto")).toBeTruthy();
  });

  it("sugere selos: lista com tipo e confiança; vincular aceita o vínculo sugerido ou cria um novo", async () => {
    const api = loggedAs(undefined, {
      ...HYPE, "GET /api/schemes/s1": { scheme: SCHEME },
      "GET /api/schemes/s1/seal-suggestions": { message: "Encontramos 2 selos", suggestions: [
        { id: "b1", kind: "CELEBRITY", confidence: 0.91, justification: "mesmo estilo", target: { id: "c1", displayName: "Anitta", username: "anitta" } },
        { kind: "BRAND", confidence: 0.5, target: { id: "m1", username: "nike" } },
      ] },
      "POST /api/seal-bonds/b1/accept": undefined, "POST /api/schemes/s1/seal-bonds": undefined,
    });
    renderApp(<ExpandedScheme id="s1" />);
    // publicado e já é o look do dia: sem "Publicar" nem "Marcar como look do dia"
    await screen.findByRole("button", { name: "Sugerir selos de marca" });
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar como look do dia" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sugerir selos de marca" }));
    const dialog = await screen.findByRole("dialog", { name: "Vínculos de selo sugeridos" });
    expect(within(dialog).getByText("Encontramos 2 selos")).toBeTruthy();
    expect(within(dialog).getByText("· celebridade")).toBeTruthy();
    expect(within(dialog).getByText("· marca")).toBeTruthy();
    expect(within(dialog).getByText("confiança 91% · mesmo estilo")).toBeTruthy();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Vincular" })[0]);
    expect(await screen.findByText("Vínculo enviado para revisão da marca.")).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/api/seal-bonds/b1/accept")?.body).toEqual({ imageRightsConsent: true });
    fireEvent.click(screen.getByRole("button", { name: "Sugerir selos de marca" }));
    fireEvent.click((await screen.findAllByRole("button", { name: "Vincular" }))[1]);
    await waitFor(() => expect(api.calls.find((c) => c.path === "/api/schemes/s1/seal-bonds")?.body).toEqual({ targetOwnerId: "m1", imageRightsConsent: true }));
  });

  it("sem sugestões avisa que dá para vincular pelo perfil; erro na busca ou no vínculo vira aviso", async () => {
    let calls = 0;
    loggedAs(undefined, {
      ...HYPE, "GET /api/schemes/s1": { scheme: SCHEME },
      "GET /api/schemes/s1/seal-suggestions": () => (++calls === 1 ? {} : calls === 2 ? err(503, "Busca fora do ar") : { suggestions: [{ id: "b2", kind: "BRAND", confidence: 0.3, target: { id: "m2", username: "zara" } }] }),
      "POST /api/seal-bonds/b2/accept": err(400, "Vínculo recusado"),
    });
    renderApp(<ExpandedScheme id="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Sugerir selos de marca" }));
    expect(await screen.findByText("Nenhuma sugestão agora. Você pode vincular manualmente pelo perfil da marca.")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sugerir selos de marca" }));
    expect(await screen.findByText("Busca fora do ar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sugerir selos de marca" }));
    fireEvent.click(await screen.findByRole("button", { name: "Vincular" }));
    expect(await screen.findByText("Vínculo recusado")).toBeTruthy();
  });

  it("melhorar com IA: pede, lista as alterações válidas para escolher e aplica só as marcadas", async () => {
    const api = loggedAs(undefined, {
      ...HYPE, "GET /api/schemes/s1": { scheme: SCHEME },
      "POST /api/schemes/s1/improvements": { message: "Deixei mais formal", explanation: "ignorada", changes: [
        { field: "title", current: "Look antigo", proposed: "Look elegante", reason: "mais formal" },
        { field: "occasion", current: ["casual"], proposed: ["formal", "jantar"] },
        { field: "title", proposed: "Outro título" },
        { field: "shoes", proposed: "mocassim" },               // campo não editável: some
        { field: "style", proposed: ["a", "b", "c", "d"] },    // mais de 3: some
        { field: "season", proposed: "  " },                   // vazio: some
        null,
      ] },
      "POST /api/schemes/s1/improvements/apply": undefined,
    });
    renderApp(<ExpandedScheme id="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Melhorar com IA" }));
    const dialog = await screen.findByRole("dialog", { name: "Melhorar com IA" });
    const generate = within(dialog).getByRole("button", { name: "Gerar com IA" }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);   // sem instrução não pede
    fireEvent.change(within(dialog).getByLabelText("O que você quer mudar?"), { target: { value: "  mais formal  " } });
    fireEvent.click(generate);
    expect(await within(dialog).findByText("Deixei mais formal")).toBeTruthy();
    expect(within(dialog).queryByText("ignorada")).toBeNull();
    expect(api.calls.find((c) => c.path === "/api/schemes/s1/improvements")?.body).toEqual({ instruction: "mais formal" });
    expect(within(dialog).getByText("Selecione as alterações que deseja aplicar.")).toBeTruthy();
    const rows = Array.from(dialog.querySelectorAll("label.list-row")).map((d) => d.textContent);
    expect(rows).toEqual([
      "TítuloAtual: Look antigoSugestão: Look elegantemais formal",
      "OcasiõesAtual: casualSugestão: formal, jantar",
      "TítuloAtual: —Sugestão: Outro título",
    ]);
    const apply = within(dialog).getByRole("button", { name: "Aplicar" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);   // nada marcado
    const boxes = within(dialog).getAllByRole("checkbox") as HTMLInputElement[];
    fireEvent.click(boxes[0]);
    expect(apply.disabled).toBe(false);
    fireEvent.click(boxes[2]);           // o mesmo campo: a segunda sugestão substitui a primeira
    expect([boxes[0].checked, boxes[2].checked]).toEqual([false, true]);
    fireEvent.click(boxes[1]); fireEvent.click(boxes[1]); fireEvent.click(boxes[1]);   // marca, desmarca e marca de novo
    // revisar a instrução volta ao formulário e descarta a escolha
    fireEvent.click(within(dialog).getByRole("button", { name: "Revisar instrução" }));
    expect((within(dialog).getByLabelText("O que você quer mudar?") as HTMLInputElement).value).toBe("  mais formal  ");
    fireEvent.click(within(dialog).getByRole("button", { name: "Gerar com IA" }));
    const again = await within(dialog).findAllByRole("checkbox") as HTMLInputElement[];
    expect(again.some((b) => b.checked)).toBe(false);
    fireEvent.click(again[2]); fireEvent.click(again[1]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText("Salvo")).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/api/schemes/s1/improvements/apply")?.body).toEqual({ title: "Outro título", occasion: ["formal", "jantar"] });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Melhorar com IA" })).toBeNull());
  });

  it("sem alterações avisa; explicação no lugar da mensagem; erro ao pedir e ao aplicar", async () => {
    let n = 0;
    loggedAs(undefined, {
      ...HYPE, "GET /api/schemes/s1": { scheme: SCHEME },
      "POST /api/schemes/s1/improvements": () => (++n === 1 ? { changes: "texto livre" } : n === 2 ? err(500, "IA indisponível") : { explanation: "Só isso", changes: [{ field: "mood", proposed: "leve" }] }),
      "POST /api/schemes/s1/improvements/apply": err(400, "Não deu para aplicar"),
    });
    renderApp(<ExpandedScheme id="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Melhorar com IA" }));
    const dialog = await screen.findByRole("dialog", { name: "Melhorar com IA" });
    fireEvent.change(within(dialog).getByLabelText("O que você quer mudar?"), { target: { value: "x" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gerar com IA" }));
    expect((await within(dialog).findByRole("status")).textContent).toBe("Nenhuma alteração disponível para esta instrução. Ajuste o pedido e tente novamente.");
    expect((within(dialog).getByRole("button", { name: "Aplicar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Revisar instrução" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Gerar com IA" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("IA indisponível");
    fireEvent.click(within(dialog).getByRole("button", { name: "Gerar com IA" }));
    expect(await within(dialog).findByText("Só isso")).toBeTruthy();
    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(dialog.querySelector("label.list-row")?.textContent).toBe("HumorAtual: —Sugestão: leve");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Não deu para aplicar");
    expect(screen.getByRole("dialog", { name: "Melhorar com IA" })).toBeTruthy();
  });

  it("quem visita: só Provar; sem sessão, nem isso; erro de carregamento oferece tentar de novo", async () => {
    loggedAs(VISITOR, { ...HYPE, "GET /api/schemes/s1": { scheme: SCHEME } });
    const { unmount } = renderApp(<ExpandedScheme id="s1" />);
    expect(await screen.findByRole("link", { name: /Provar/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sugerir selos de marca" })).toBeNull();
    unmount(); cleanup(); vi.unstubAllGlobals(); tokenStore.clear(); document.cookie = "fai_rt_h=; max-age=0; path=/";
    const api = mockApi({ ...HYPE, "GET /api/schemes/s1": { scheme: SCHEME } });
    const r = renderApp(<ExpandedScheme id="s1" />);
    await waitFor(() => expect(r.container.querySelector(".fai-card")).not.toBeNull());
    expect(screen.queryByRole("link", { name: /Provar/ })).toBeNull();
    expect(api.calls.some((c) => c.path === "/api/schemes/s1")).toBe(true);
    r.unmount();
    mockApi({ "GET /api/schemes/s2": err(500, "Falhou o look") });
    renderApp(<ExpandedScheme id="s2" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Falhou o look");
  });
});

describe("ExpandedPiece — o dono", () => {
  const routes = (p: PieceView, extra: Record<string, unknown> = {}) => ({ ...HYPE, "GET /api/taxonomy": TAXONOMY, "GET /api/pieces/p1": { piece: p, location: { label: "Gaveta 2" }, originSchemes: [{ schemeId: "s1", title: "Look de sábado", coverImageUrl: "/media/s.png" }, { schemeId: "s2", title: "null" }] }, ...extra });

  it("mostra os dados úteis, a ação principal e os looks com a peça; clicar no look navega", async () => {
    loggedAs(undefined, routes(piece({ forSale: false, forDonation: true, disponivel: false, visibility: "FOLLOWERS" })));
    const { container } = renderApp(<ExpandedPiece id="p1" />);
    expect(await screen.findByRole("heading", { name: "Camiseta branca lisa" })).toBeTruthy();
    const facts = Array.from(container.querySelectorAll(".c-facts > div")).map((d) => [d.querySelector("dt")?.textContent, d.querySelector("dd")?.textContent]);
    expect(facts.map(([k]) => k)).toEqual(["Categoria", "Cor", "Tamanho", "Material", "Ocasião", "Estilo", "Estado de conservação", "Preço", "Usos", "Situação", "Onde está"]);
    expect(Object.fromEntries(facts)["Estado de conservação"]).toBe("Novo");   // condição "NEW" do fixture vira rótulo
    expect(Object.fromEntries(facts)["Situação"]).toBe("Indisponível · Para doar");
    expect(Object.fromEntries(facts)["Onde está"]).toBe("Gaveta 2");
    expect(Object.fromEntries(facts)["Material"]).toBe(label("cotton"));
    expect(Object.fromEntries(facts)["Usos"]).toMatch(/^Usada 5× · último uso: /);
    expect(container.textContent).toContain("Seguidores");
    expect(screen.getByRole("link", { name: "Adicionar ao look" }).getAttribute("href")).toContain("p1");
    expect(screen.getByText("carta FLAIR da peça")).toBeTruthy();
    // o look sem título ("null") some da lista
    const looks = screen.getByRole("heading", { name: "Looks com esta peça" }).closest("section") as HTMLElement;
    expect(looks.querySelectorAll("button")).toHaveLength(1);
    fireEvent.click(within(looks).getByRole("button", { name: /Look de sábado/ }));
    expect(router.push).toHaveBeenCalledWith("/schemes/s1");
    fireEvent.click(screen.getByRole("button", { name: "ou experimente no manequim 3D" }));
    expect(screen.getByRole("dialog", { name: "Manequim 3D" }).textContent).toContain("3D de Camiseta branca lisa");
    fireEvent.click(screen.getByRole("button", { name: "Fechar 3D" }));
    expect(screen.queryByRole("dialog", { name: "Manequim 3D" })).toBeNull();
  });

  it("no modal, o look da lista abre pelo onScheme", async () => {
    loggedAs(undefined, routes(piece()));
    const onScheme = vi.fn();
    renderApp(<ExpandedPiece id="p1" from="s1" onScheme={onScheme} />);
    fireEvent.click(await screen.findByRole("button", { name: /Look de sábado/ }));
    expect(onScheme).toHaveBeenCalledWith("s1");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("\"Mais opções\": disponível e favorita alternam pelas flags; erro volta como aviso", async () => {
    const api = loggedAs(undefined, routes(piece(), { "PATCH /api/pieces/p1/flags": (_u: URL, init: RequestInit) => ({ ...PIECE, ...JSON.parse(String(init.body)) }) }));
    renderApp(<ExpandedPiece id="p1" />);
    await openMore();
    expect(screen.getByRole("menuitem", { name: "Tirar dos favoritos" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /Marcar como indisponível/ }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "PATCH" && (c.body as { disponivel?: boolean }).disponivel === false)).toBe(true));
    await openMore();
    expect(await screen.findByRole("menuitem", { name: "Marcar como disponível" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Tirar dos favoritos" }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "PATCH" && (c.body as { favorite?: boolean }).favorite === false)).toBe(true));
    await openMore();
    expect(await screen.findByRole("menuitem", { name: "Marcar como favorita" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Mostrar no quarto" }).getAttribute("href")).toBe("/room?piece=p1");
    expect(screen.getByRole("menuitem", { name: "Foto com meu manequim" })).toBeTruthy();
  });

  it("erro ao marcar uma flag mostra o aviso", async () => {
    loggedAs(undefined, routes(piece(), { "PATCH /api/pieces/p1/flags": err(500, "Não salvou a flag") }));
    renderApp(<ExpandedPiece id="p1" />);
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Tirar dos favoritos" }));
    expect(await screen.findByText("Não salvou a flag")).toBeTruthy();
  });

  it("editar dados: abre preenchido, valida no cliente, salva com PUT e mostra o erro do servidor", async () => {
    let fail = true;
    const api = loggedAs(undefined, routes(piece(), { "PUT /api/pieces/p1": (_u: URL, init: RequestInit) => (fail ? err(422, "Nome repetido") : { ...PIECE, ...JSON.parse(String(init.body)), name: JSON.parse(String(init.body)).name }) }));
    renderApp(<ExpandedPiece id="p1" />);
    await settle();
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar dados" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar dados" });
    const name = within(dialog).getByLabelText(/^Nome/) as HTMLInputElement;
    expect(name.value).toBe("Camiseta branca lisa");
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText(/nome/i, { selector: ".error-text, [role=alert], .field-error, p" })).toBeTruthy();
    expect(api.calls.some((c) => c.method === "PUT")).toBe(false);
    fireEvent.change(name, { target: { value: "Camiseta nova" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Nome repetido")).toBeTruthy();
    fail = false;
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar dados" })).toBeNull());
    expect((api.calls.filter((c) => c.method === "PUT").at(-1)?.body as { name: string }).name).toBe("Camiseta nova");
    expect(await screen.findByRole("heading", { name: "Camiseta nova" })).toBeTruthy();
  });

  it("edits conservation by UUID and shows the returned reference in the expanded card after save and reload", async () => {
    const excellent = { id: "00000000-0000-4000-8000-000000000002", codigo: "EXCELENTE", nome: "Excelente" };
    let saved = piece({ condition: "GOOD", estadoConservacao: null });
    const api = loggedAs(undefined, routes(saved, {
      "GET /api/pieces/p1": () => ({ piece: saved }),
      "GET /api/opcoes/estados-conservacao": [excellent],
      "PUT /api/pieces/p1": (_u: URL, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        saved = { ...saved, estadoConservacao: body.estadoConservacaoId === excellent.id ? excellent : null };
        return saved;
      },
    }));
    const { unmount } = renderApp(<ExpandedPiece id="p1" startEditing />);
    const dialog = await screen.findByRole("dialog", { name: "Editar dados" });
    const field = within(dialog).getByLabelText("Estado de conservação");
    await waitFor(() => expect(field.hasAttribute("disabled")).toBe(false));
    expect(field.textContent).toContain("Não informado");
    fireEvent.click(field);
    fireEvent.click(screen.getByRole("option", { name: "Excelente" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar dados" })).toBeNull());
    expect((api.calls.find(c => c.method === "PUT")?.body as { estadoConservacaoId: string }).estadoConservacaoId).toBe(excellent.id);
    expect(screen.getByText("Excelente", { selector: ".c-facts dd" })).toBeTruthy();
    unmount();
    renderApp(<ExpandedPiece id="p1" />);
    expect(await screen.findByText("Excelente", { selector: ".c-facts dd" })).toBeTruthy();
  });

  it.each([false, true])("shows the approved blue garment seal in the detail modal (celebrity=%s)", async premium => {
    const { DetailModalProvider, useDetailModal } = await import("./detail-modal");
    function Open() {
      const detail = useDetailModal();
      return <button onClick={() => detail?.openPiece("p1")}>Abrir peça azul</button>;
    }
    const badge = { name: premium ? "Azul da estrela" : "Azul da marca", tier: "PECA", owner: premium ? "estrela" : "marca", premium,
      design: { kind: "FASHIONAI", mode: "TEMPLATE", template: "fai/01" }, linkedPieceIds: ["p1"] };
    const api = loggedAs(undefined, routes(piece({ color: "blue", seals: ["SUSTAINABLE", "BRAND:nao-aprovada"] }), {
      "GET /api/pieces/seals": { items: { p1: [badge] } },
    }));
    renderApp(<DetailModalProvider><Open /></DetailModalProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Abrir peça azul" }));
    const modal = await screen.findByRole("dialog", { name: /detalhe da peça/i });
    expect(await within(modal).findByRole("img", { name: `selos: ${badge.name}` })).toBeTruthy();
    expect(modal.querySelector(`.card-seals .seal-medallion[title="${badge.name} · @${badge.owner} · PECA"]`)).toBeTruthy();
    expect(within(modal).queryByText("SUSTAINABLE")).toBeNull();
    expect(within(modal).queryByText("nao-aprovada")).toBeNull();
    expect(api.calls.some(call => call.path === "/api/pieces/seals?ids=p1")).toBe(true);
    fireEvent.click(within(modal).getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir peça azul" }));
    expect(await within(await screen.findByRole("dialog", { name: /detalhe da peça/i })).findByRole("img", { name: `selos: ${badge.name}` })).toBeTruthy();
  });

  it("startEditing abre a edição assim que a peça chega", async () => {
    loggedAs(undefined, routes(piece()));
    renderApp(<ExpandedPiece id="p1" startEditing />);
    expect(await screen.findByRole("dialog", { name: "Editar dados" })).toBeTruthy();
  });

  it("excluir: mostra o impacto (looks afetados) e exclui; fora da página da peça recarrega", async () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, pathname: "/closet", reload } as Location);
    const api = loggedAs(undefined, routes(piece(), { "GET /api/pieces/p1/deletion-impact": { schemes: [{ ...SCHEME, title: "Look afetado" }] }, "DELETE /api/pieces/p1": undefined }));
    renderApp(<ExpandedPiece id="p1" />);
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir" });
    expect(within(dialog).getByText("Esta peça aparece em 1 look(s).")).toBeTruthy();
    expect(within(dialog).getByText("Look afetado")).toBeTruthy();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Excluir" }).at(-1)!);
    expect(await screen.findByText("Peça excluída.")).toBeTruthy();
    expect(reload).toHaveBeenCalled();
    expect(api.calls.some((c) => c.method === "DELETE" && c.path === "/api/pieces/p1")).toBe(true);
    vi.restoreAllMocks();
  });

  it("excluir na página da peça volta ao guarda-roupa; impacto com mensagem pronta; cancelar e erros", async () => {
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, pathname: "/pieces/p1", reload: vi.fn() } as Location);
    let impactCalls = 0;
    loggedAs(undefined, routes(piece(), { "GET /api/pieces/p1/deletion-impact": () => (++impactCalls === 1 ? err(500, "Sem impacto") : { message: "Mensagem do servidor", count: 3 }), "DELETE /api/pieces/p1": () => (impactCalls === 2 ? err(409, "Ainda em uso") : undefined) }));
    renderApp(<ExpandedPiece id="p1" />);
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    expect(await screen.findByText("Sem impacto")).toBeTruthy();
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir" });
    expect(within(dialog).getByText("Mensagem do servidor")).toBeTruthy();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Excluir" }).at(-1)!);
    expect(await screen.findByText("Ainda em uso")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Excluir" })).toBeNull());
    impactCalls = 5;
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    const again = await screen.findByRole("dialog", { name: "Excluir" });
    fireEvent.click(within(again).getAllByRole("button", { name: "Excluir" }).at(-1)!);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/closet"));
    vi.restoreAllMocks();
  });

  it("editor de imagem: estúdio (pronto ou à espera de aprovação), aprovar, descartar, trocar foto e editor manual", async () => {
    const pending = piece({ studioImageUrl: "/media/st.png", flatLayMetadata: { studio: { pending: { url: "/media/novo.png" } } } });
    let studioCalls = 0;
    const api = loggedAs(undefined, routes(pending, {
      "POST /api/pieces/p1/studio": () => (++studioCalls === 1 ? pending : studioCalls === 2 ? piece({ studioImageUrl: "/media/st.png" }) : err(500, "Estúdio falhou")),
      "POST /api/pieces/p1/studio/approve": piece({ studioImageUrl: "/media/st.png" }),
      "DELETE /api/pieces/p1/studio/pending": err(400, "Nada para descartar"),
      "PUT /api/pieces/p1/image": piece({ imageUrl: "/media/trocada.png" }),
    }));
    const href = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, pathname: "/pieces/p1", set href(v: string) { href(v); } } as unknown as Location);
    renderApp(<ExpandedPiece id="p1" />);
    // há versão pendente: o aviso leva ao editor
    expect(await screen.findByText(/Há uma foto de estúdio esperando sua aprovação/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar a imagem" })[0]);
    const editor = await screen.findByRole("dialog", { name: "Editor de imagem" });
    fireEvent.click(within(editor).getByRole("button", { name: "Estúdio branco" }));
    expect(await screen.findByText("Nova versão pronta para revisão: a foto aprovada continua no feed.")).toBeTruthy();
    expect(api.calls.some((c) => c.path === "/api/pieces/p1/studio?backdrop=white")).toBe(true);
    fireEvent.click(within(editor).getByRole("button", { name: "Estúdio branco" }));
    expect(await screen.findByText("Foto de estúdio pronta ✓")).toBeTruthy();
    fireEvent.click(within(editor).getByRole("button", { name: "Estúdio branco" }));
    expect(await screen.findByText("Estúdio falhou")).toBeTruthy();
    fireEvent.click(within(editor).getByRole("button", { name: "Aprovar estúdio" }));
    expect(await screen.findByText("Nova foto aprovada e publicada.")).toBeTruthy();
    fireEvent.click(within(editor).getByRole("button", { name: "Descartar estúdio" }));
    expect(await screen.findByText("Nada para descartar")).toBeTruthy();
    fireEvent.click(within(editor).getByRole("button", { name: "Trocar pelo editor" }));
    expect(await screen.findByText("Trocar foto ✓")).toBeTruthy();
    fireEvent.click(within(editor).getByRole("button", { name: "Editor manual" }));
    expect(href).toHaveBeenCalledWith("/pieces/p1/photo");
    expect(screen.queryByRole("dialog", { name: "Editor de imagem" })).toBeNull();
    vi.restoreAllMocks();
  });

  it("descartar a versão nova com sucesso; trocar foto pelo menu com erro", async () => {
    loggedAs(undefined, routes(piece({ studioImageUrl: "/media/st.png", flatLayMetadata: { studio: { approved: false, feed: { missing: ["sleeve"] } } } }), {
      "DELETE /api/pieces/p1/studio/pending": piece({ studioImageUrl: "/media/st.png" }), "PUT /api/pieces/p1/image": err(413, "Arquivo grande demais"),
    }));
    const { container } = renderApp(<ExpandedPiece id="p1" />);
    // a atual ainda não foi aprovada e a foto do feed está incompleta: dois avisos
    expect(await screen.findByText(/A foto do feed não mostra a peça inteira/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Revisar a imagem" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar a imagem" })[1]);
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Editor de imagem" })).getByRole("button", { name: "Descartar estúdio" }));
    expect(await screen.findByText("Versão nova descartada; a aprovada continua no ar.")).toBeTruthy();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Trocar foto" }));
    expect(click).toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    expect(await screen.findByText("Arquivo grande demais")).toBeTruthy();
    fireEvent.change(input, { target: { files: [] } });
  });

  it("arte do card, foto no manequim e o visualizador 3D", async () => {
    model.st = { status: "COMPLETED", modelUrl: "/media/m.glb" };
    const api = loggedAs(undefined, routes(piece({ mannequinImageUrl: "/media/manequim.png", model3dUrl: null })));
    renderApp(<ExpandedPiece id="p1" />);
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar arte do card" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Arte" })).getByRole("button", { name: "Salvar arte" }));
    expect(await screen.findByRole("heading", { name: "Nome pela arte" })).toBeTruthy();
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Refazer foto com meu manequim" }));
    const before = api.calls.filter((c) => c.path.startsWith("/api/pieces/p1")).length;
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Foto no manequim" })).getByRole("button", { name: "Salvar foto no manequim" }));
    await waitFor(() => expect(api.calls.filter((c) => c.path.startsWith("/api/pieces/p1")).length).toBeGreaterThan(before));   // recarrega a peça
    fireEvent.click(screen.getByRole("button", { name: "Ver em 3D" }));
    const viewer = await screen.findByRole("dialog", { name: /em 3D$/ });
    expect(within(viewer).getByText(/serve para ver volume e proporção/)).toBeTruthy();
    expect(viewer.querySelector(".h-\\[420px\\]")).not.toBeNull();
    // detalhes técnicos aparecem quando há estado do 3D
    expect(screen.getByText("técnico do 3D")).toBeTruthy();
  });

  it("carrossel: produto e manequim, navegação pelas setas e pontos; tela cheia com o detalhe do logo", async () => {
    loggedAs(undefined, routes(piece({ studioImageUrl: "/media/st.png", studioBackdrop: "white", mannequinImageUrl: "/media/manequim.png", studioDetailUrl: "/media/logo.png", flatLayMetadata: { studio: { framing: { bleed: ["top"] }, stages: [{ name: "corte", provider: "local", ms: 10, ok: true }] } } })));
    const { container } = renderApp(<ExpandedPiece id="p1" />);
    const gallery = await screen.findByRole("group", { name: "Fotos da peça" });
    expect(gallery.querySelector(".pd-slide-tag")?.textContent).toBe("Produto");
    fireEvent.click(within(gallery).getByRole("button", { name: "Próxima foto" }));
    expect(gallery.querySelector(".pd-slide-tag")?.textContent).toBe("No manequim");
    fireEvent.click(within(gallery).getByRole("button", { name: "Foto anterior" }));
    expect(gallery.querySelector(".pd-slide-tag")?.textContent).toBe("Produto");
    fireEvent.click(within(gallery).getByRole("button", { name: /Foto 2 de 2/ }));
    expect(within(gallery).getByRole("button", { name: /Foto 2 de 2/ }).getAttribute("aria-current")).toBe("true");
    fireEvent.click(within(gallery).getByRole("button", { name: /^Ampliar:/ }));
    const full = await screen.findByRole("dialog", { name: "Tela cheia" });
    expect(full.textContent).toBe("Camiseta branca lisa — Estúdio | Camiseta branca lisa no manequim | Camiseta branca lisa — Detalhe do logo · início 1Sair da tela cheia");
    fireEvent.click(within(full).getByRole("button", { name: "Sair da tela cheia" }));
    expect(screen.queryByRole("dialog", { name: "Tela cheia" })).toBeNull();
    // relatório do estúdio nos detalhes técnicos
    expect(container.querySelector("details.pd-tech")).not.toBeNull();
    // a imagem do produto mede o quadro ao carregar e ao redimensionar a janela
    const img = gallery.querySelector("img") as HTMLImageElement;
    Object.defineProperty(img, "naturalWidth", { value: 400 }); Object.defineProperty(img, "naturalHeight", { value: 500 });
    fireEvent.load(img);
    window.dispatchEvent(new Event("resize"));
    expect(gallery.querySelector(".pd-slide")).not.toBeNull();
  });
});

describe("ExpandedPiece — quem visita", () => {
  it("vê a peça à venda com o preço no topo, \"Experimentar\" e nenhum controle do dono", async () => {
    loggedAs(VISITOR, { ...HYPE, "GET /api/pieces/p1": { piece: piece({ price: 120 }), location: { label: "Gaveta" } } });
    const { container } = renderApp(<ExpandedPiece id="p1" />);
    expect(await screen.findByRole("heading", { name: "Camiseta branca lisa" })).toBeTruthy();
    expect(container.querySelector(".pc-price")?.textContent).toMatch(/À venda.*120/);
    const keys = Array.from(container.querySelectorAll(".c-facts dt")).map((d) => d.textContent);
    expect(keys).not.toContain("Preço");   // à venda: o preço vai para o topo
    expect(keys).not.toContain("Usos");
    expect(keys).not.toContain("Onde está");
    expect(screen.queryByText("carta FLAIR da peça")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Experimentar" }));
    expect(screen.getByRole("dialog", { name: "Manequim 3D" })).toBeTruthy();
    // nenhuma opção do dono: o menu "Mais opções" nem aparece
    expect(screen.queryByRole("button", { name: /Mais opções/ })).toBeNull();
  });

  it("peça removida: o snapshot guardado ou o aviso de indisponível; erro com nova tentativa", async () => {
    mockApi({ "GET /api/pieces/p1": { notAvailableAnymore: true, snapshot: { name: "Peça antiga", category: "upper_piece" } } });
    const { unmount } = renderApp(<ExpandedPiece id="p1" />);
    expect(await screen.findByText("Peça antiga")).toBeTruthy();
    unmount();
    mockApi({ "GET /api/pieces/p1": { notAvailableAnymore: true } });
    const r = renderApp(<ExpandedPiece id="p1" />);
    expect(await screen.findByText("Esta peça não está mais disponível no guarda-roupa do autor.")).toBeTruthy();
    r.unmount();
    const api = mockApi({ "GET /api/pieces/p9": err(500, "Peça fora do ar") });
    renderApp(<ExpandedPiece id="p9" from="s1" />);
    await waitFor(() => expect(api.calls.some((c) => c.path === "/api/pieces/p9?fromScheme=s1")).toBe(true));
    expect((await screen.findByRole("alert")).textContent).toContain("Peça fora do ar");
  });

  it("sem foto de estúdio: produto com o recorte; sem marca nem dados opcionais as linhas somem", async () => {
    mockApi({ ...HYPE, "GET /api/pieces/p1": { piece: piece({ brandName: null, material: null, occasion: [], style: [], price: null, forSale: false, colorHex: null }) } });
    const { container } = renderApp(<ExpandedPiece id="p1" />);
    expect(await screen.findByRole("heading", { name: "Camiseta branca lisa" })).toBeTruthy();
    expect(container.querySelector(".pd-brand")).toBeNull();
    const keys = Array.from(container.querySelectorAll(".c-facts dt")).map((d) => d.textContent);
    expect(keys).toEqual(["Categoria", "Cor", "Tamanho", "Estado de conservação"]);   // a condição da peça continua
    expect(screen.queryByRole("heading", { name: "Looks com esta peça" })).toBeNull();
    expect(container.querySelector(".pd-slide-tag")).toBeNull();   // uma foto só: sem setas
  });
});

describe("ExpandedDna e janela de sucesso", () => {
  const DNA = { id: "d1", owner: SCHEME.owner, title: "DNA de teste", palette: [], cardLayout: "GRADE", targetElement: "DNA_COMPLETO", narrativeType: null, visibility: "PUBLIC", status: "PUBLISHED", cells: [], logos: [], counters: { likes: 1, comments: 0, shares: 0, remixes: 0 }, canEdit: true };

  it("DNA ampliado com a barra social; erro com nova tentativa", async () => {
    mockApi({ "GET /api/dna-schemes/d1": DNA });
    const { container, unmount } = renderApp(<ExpandedDna id="d1" />);
    expect(await screen.findByRole("article", { name: "DNA de estilo: DNA de teste" })).toBeTruthy();
    expect(container.querySelector(".c-extra .c-post")).not.toBeNull();
    unmount();
    mockApi({ "GET /api/dna-schemes/d2": err(500, "DNA fora do ar") });
    renderApp(<ExpandedDna id="d2" />);
    expect((await screen.findByRole("alert")).textContent).toContain("DNA fora do ar");
  });

  it("título conforme o tipo e se foi edição; fechar leva ao perfil (ou ao lookbook sem sessão)", async () => {
    loggedAs(undefined, { ...HYPE, "GET /api/schemes/s1": { scheme: SCHEME } });
    const { unmount } = renderApp(<CreationSuccess kind="scheme" id="s1" />);
    expect(await screen.findByRole("dialog", { name: "Parabéns! Seu look foi criado com sucesso!" })).toBeTruthy();
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Ir para o perfil" }));
    expect(router.push).toHaveBeenCalledWith("/u/ana");
    unmount();
    const cases: [React.ComponentProps<typeof CreationSuccess>, string][] = [
      [{ kind: "scheme", id: "s1", edited: true }, "Pronto! Seu look foi atualizado com sucesso!"],
      [{ kind: "dna", id: "d1" }, "Parabéns! Seu look DNA de estilo foi criado com sucesso!"],
      [{ kind: "dna", id: "d1", edited: true }, "Pronto! Seu look DNA de estilo foi atualizado com sucesso!"],
      [{ kind: "piece", id: "p1" }, "Parabéns! Sua peça foi adicionada com sucesso!"],
      [{ kind: "piece", id: "p1", edited: true }, "Pronto! Sua peça foi atualizada com sucesso!"],
    ];
    for (const [props, title] of cases) {
      const onDone = vi.fn();
      const r = renderApp(<CreationSuccess {...props} onDone={onDone} />);
      expect(screen.getByRole("dialog", { name: title })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Ir para o perfil" }));
      expect(onDone).toHaveBeenCalled();
      r.unmount();
    }
    cleanup(); vi.unstubAllGlobals(); tokenStore.clear(); document.cookie = "fai_rt_h=; max-age=0; path=/"; router.push.mockClear();
    mockApi({ "GET /api/pieces/p1": { piece: PIECE } });
    renderApp(<CreationSuccess kind="piece" id="p1" />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Ir para o perfil" }));
    expect(router.push).toHaveBeenCalledWith("/lookbook");
  });
});

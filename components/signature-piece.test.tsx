// @vitest-environment jsdom
/**
 * Exercício 18 — Peça Assinatura na tela: a escolha lista só as peças próprias, avisa quem vai ver a peça antes de
 * gravar e envia a revisão lida; o histórico pagina, tem estado vazio e erro com "tentar de novo"; no perfil, quem
 * visita só vê o que o servidor autorizou e o dono vê a escolha privada com o aviso.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { SignaturePiecePicker } from "./signature-piece-picker";
import { SignaturePieceHistory } from "./signature-piece-history";
import { SignaturePieceBlock } from "./signature-piece-block";

const TAXONOMY = { subcategories: { upper_piece: ["blazer"] }, colors: { gray: "#8A8D91", blue: "#2A5FA8" }, materials: [], sizes: [], sexes: [], occasions: [], styles: [], allowedOccasionsByCategory: {}, brands: [] };
const peca = (id: string, name: string, visibility: string) => ({ id, name, category: "upper_piece", subcategory: "blazer", color: "gray", colorHex: "#8A8D91", defaultImage: true, visibility });
const CLOSET = { items: [peca("p1", "Blazer de lã", "PUBLIC"), peca("p2", "Jeans reto", "PRIVATE"), peca("p3", "Camisa", "FOLLOWERS")], total: 3, page: 0, size: 100, hasMore: false };
const ASSINATURA = { id: "p1", name: "Blazer de lã", category: "upper_piece", subcategory: "blazer", color: "gray", colorHex: "#8A8D91", brandName: "Atelier Lumi", imageUrl: null };
const erro = (status: number, code: string, message: string) => () => new Response(JSON.stringify({ status, code, message }), { status, headers: { "content-type": "application/json" } });
const linha = (id: string, name: string | null, pieceId: string | null = "p1") => ({ id, pieceId, changedAt: "2026-11-20T12:00:00Z", removed: !name, snapshot: name ? { name, category: "upper_piece", subcategory: "blazer", color: "gray", brandName: "Atelier Lumi" } : null });

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("SignaturePiecePicker", () => {
  it("lista as peças próprias, avisa a visibilidade e grava com a revisão lida", async () => {
    const onChanged = vi.fn();
    const { calls } = loggedAs(undefined, {
      "GET /api/taxonomy": TAXONOMY, "GET /api/me/closet": CLOSET,
      "GET /api/me/signature-piece": { signaturePiece: { ...ASSINATURA, visibility: "PUBLIC" }, version: 2 },
      "PUT /api/me/signature-piece": { signaturePiece: { ...ASSINATURA, id: "p2", name: "Jeans reto", visibility: "PRIVATE" }, version: 3 },
    });
    renderApp(<SignaturePiecePicker onChanged={onChanged} />);
    const opcoes = await screen.findAllByRole("radio");
    expect(opcoes.map((o) => o.textContent)).toEqual(["Blazer de lã", "Jeans reto", "Camisa"]);
    // a escolha atual vem marcada e não há o que gravar
    await waitFor(() => expect(opcoes[0].getAttribute("aria-checked")).toBe("true"));
    expect(screen.getByRole("note").textContent).toContain("é pública");
    expect((screen.getByRole("button", { name: "Definir como Peça Assinatura" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(opcoes[1]);
    expect(screen.getByRole("note").getAttribute("data-visibility")).toBe("PRIVATE");
    expect(screen.getByRole("note").textContent).toContain("só você vai ver");
    fireEvent.click(opcoes[2]);
    expect(screen.getByRole("note").textContent).toContain("apenas quem segue você");
    fireEvent.click(opcoes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Definir como Peça Assinatura" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ version: 3 })));
    expect(calls.find((c) => c.method === "PUT")).toMatchObject({ path: "/api/me/signature-piece", body: { pieceId: "p2", expectedVersion: 2 } });
  });

  it("recusa do servidor (outra janela mudou) aparece, mantém a seleção e recarrega a revisão; remover envia a revisão", async () => {
    let leituras = 0;
    const { calls } = loggedAs(undefined, {
      "GET /api/taxonomy": TAXONOMY, "GET /api/me/closet": CLOSET,
      "GET /api/me/signature-piece": () => ({ signaturePiece: { ...ASSINATURA, visibility: "PUBLIC" }, version: leituras++ ? 5 : 2 }),
      "PUT /api/me/signature-piece": erro(409, "ASSINATURA_ALTERADA", "A Peça Assinatura mudou em outra janela. Recarregue e tente de novo."),
      "DELETE /api/me/signature-piece": { signaturePiece: null, version: 0 },
    });
    renderApp(<SignaturePiecePicker />);
    fireEvent.click((await screen.findAllByRole("radio"))[1]);
    fireEvent.click(screen.getByRole("button", { name: "Definir como Peça Assinatura" }));
    expect((await screen.findByRole("alert")).textContent).toContain("mudou em outra janela");
    await waitFor(() => expect(leituras).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "Remover a escolha" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/me/signature-piece?expectedVersion=5")).toBe(true));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remover a escolha" })).toBeNull());
  });

  it("sem peças no guarda-roupa convida a adicionar", async () => {
    loggedAs(undefined, { "GET /api/me/closet": { items: [], total: 0, page: 0, size: 100, hasMore: false }, "GET /api/me/signature-piece": { signaturePiece: null, version: 0 } });
    renderApp(<SignaturePiecePicker />);
    expect(await screen.findByText("Você ainda não tem peças para escolher.")).toBeTruthy();
  });
});

describe("SignaturePieceHistory", () => {
  it("pagina da mais recente para a mais antiga e descreve escolha, remoção e peça que não existe mais", async () => {
    const paginas = [
      { items: [linha("h3", null, null), linha("h2", "Jeans reto", null)], page: 0, size: 2, total: 3, hasMore: true },
      { items: [linha("h1", "Blazer de lã")], page: 1, size: 2, total: 3, hasMore: false },
    ];
    loggedAs(undefined, { "GET /api/taxonomy": TAXONOMY, "GET /api/me/signature-piece/history": (url: URL) => paginas[Number(url.searchParams.get("page"))] });
    renderApp(<SignaturePieceHistory />);
    const itens = await screen.findAllByRole("listitem");
    expect(itens[0].textContent).toContain("Escolha removida");
    expect(itens[1].textContent).toContain("Escolhida: Jeans reto");
    expect(itens[1].textContent).toContain("a peça não existe mais");
    expect(screen.getByRole("status").textContent).toBe("Página 1 de 2");
    expect((screen.getByRole("button", { name: "← Mais recentes" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Mais antigas →" }));
    expect(await screen.findByText(/Escolhida: Blazer de lã/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Mais antigas →" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("estado vazio e erro com tentar de novo", async () => {
    let falhar = true;
    loggedAs(undefined, { "GET /api/me/signature-piece/history": () => falhar ? erro(500, "X", "falhou")() : { items: [], page: 0, size: 5, total: 0, hasMore: false } });
    renderApp(<SignaturePieceHistory />);
    const retry = await screen.findByRole("button", { name: "Tentar de novo" }, { timeout: 4000 });
    falhar = false;
    fireEvent.click(retry);
    expect(await screen.findByText("Nenhuma mudança ainda.")).toBeTruthy();
  });
});

describe("SignaturePieceBlock", () => {
  it("visitante: sem peça autorizada o bloco não aparece; com peça, mostra só a peça", async () => {
    const { calls } = mockApi({ "GET /api/profiles/bia/signature-piece": { signaturePiece: null }, "GET /api/profiles/ana/signature-piece": { signaturePiece: ASSINATURA } });
    const vazio = renderApp(<SignaturePieceBlock username="bia" self={false} signedIn={false} />);
    await waitFor(() => expect(calls.some((c) => c.path === "/api/profiles/bia/signature-piece")).toBe(true));
    expect(vazio.container.querySelector("[data-signature-piece]")).toBeNull();
    vazio.unmount();
    renderApp(<SignaturePieceBlock username="ana" self={false} signedIn={false} />);
    const bloco = await screen.findByRole("region", { name: "Peça Assinatura" });
    expect(within(bloco).getByText("Blazer de lã")).toBeTruthy();
    expect(within(bloco).getByRole("link", { name: "Blazer de lã" }).getAttribute("href")).toBe("/pieces/p1");
    expect(within(bloco).queryByRole("button")).toBeNull();
  });

  it("dono: vê a escolha privada com o aviso e pode trocar ou abrir o histórico; sem escolha, é convidado a escolher", async () => {
    loggedAs(undefined, { "GET /api/taxonomy": TAXONOMY, "GET /api/profiles/ana/signature-piece": { signaturePiece: { ...ASSINATURA, visibility: "PRIVATE" } },
      "GET /api/profiles/nova/signature-piece": { signaturePiece: null }, "GET /api/me/signature-piece/history": { items: [], page: 0, size: 5, total: 0, hasMore: false } });
    const view = renderApp(<SignaturePieceBlock username="ana" self signedIn />);
    const bloco = await screen.findByRole("region", { name: "Peça Assinatura" });
    expect(within(bloco).getByText("Só você vê")).toBeTruthy();
    expect(within(bloco).getByRole("button", { name: "Trocar" })).toBeTruthy();
    fireEvent.click(within(bloco).getByRole("button", { name: "Histórico da Peça Assinatura" }));
    expect(await screen.findByText("Nenhuma mudança ainda.")).toBeTruthy();
    view.unmount();
    renderApp(<SignaturePieceBlock username="nova" self signedIn />);
    expect(await screen.findByText("Escolha a peça que representa você.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Escolher" })).toBeTruthy();
  });
});

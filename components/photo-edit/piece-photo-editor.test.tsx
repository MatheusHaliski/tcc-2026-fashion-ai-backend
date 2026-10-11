// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { PiecePhotoEditor } from "./piece-photo-editor";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/pieces/p1/photo" }));

const SESSION = { originalUrl: "/media/users/u/pieces/p/original.png", width: 1000, height: 1250, category: "upper_piece", currentRecipe: null };
const PREVIEW = { png: "iVBORw0KGgo=", quality: { sharpness: 0.8, exposure: 0.9, occupancy: 0.84, colorDeltaE: 1.2, cutConfidence: 0.9 }, warnings: [] };
const AUTO = { recipe: { version: 1, target: "CANONICAL", ops: [{ op: "crop", rect: { x: 0.1, y: 0, w: 0.8, h: 0.8 }, aspect: "4:5" }, { op: "background", kind: "WHITE", shadow: "NONE", strokes: [] }] } };
const ROUTES = { "GET /api/pieces/p1/photo-edits/session": SESSION, "GET /api/pieces/p1/photo-edits": [], "POST /api/pieces/p1/photo-edits/preview": PREVIEW, "POST /api/pieces/p1/photo-edits/auto": AUTO, "POST /api/pieces/p1/photo-edits": { id: "v1", target: "CANONICAL", current: true } };

afterEach(() => { cleanup(); push.mockClear(); });
const tab = (name: RegExp | string) => fireEvent.click(screen.getByRole("radio", { name }));
const topbar = () => within(screen.getByRole("banner", { name: "Barra do editor" }));

describe("editor de fotografia da peça (RF15)", () => {
  it("tem a barra Cancelar · Desfazer · Refazer · Comparar · Salvar e as cinco ferramentas em abas livres", async () => {
    mockApi(ROUTES);
    renderApp(<PiecePhotoEditor pieceId="p1" />);
    await screen.findByText("Editar foto da peça");
    const bar = topbar();
    for (const name of ["Cancelar", "Desfazer", "Refazer", "Comparar", "Salvar"]) expect(bar.getByRole("button", { name })).toBeTruthy();
    expect((bar.getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Ajustar", "Recortar", "Recorte da peça", "Apresentação", "Revisão"]);
    // navegação livre: Revisão direto, sem "Avançar"
    tab("Revisão"); expect(screen.getByText("Ocupação do quadro")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Avançar" })).toBeNull();
    tab("Ajustar"); expect(screen.getByLabelText(/Ponto preto/)).toBeTruthy();
  });

  it("carrega a sessão, pede a prévia ao servidor e o Automático leva à revisão com a receita sugerida; Salvar envia a receita", async () => {
    const { calls } = mockApi(ROUTES);
    renderApp(<PiecePhotoEditor pieceId="p1" />);
    await screen.findByText("Editar foto da peça");
    await waitFor(() => expect(calls.some((c) => c.path === "/api/pieces/p1/photo-edits/preview")).toBe(true), { timeout: 2000 });
    fireEvent.click(screen.getByRole("button", { name: "Automático" }));
    expect(await screen.findByText("Ocupação do quadro")).toBeTruthy();
    const save = topbar().getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces/p1/photo-edits")).toBe(true));
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/pieces/p1/photo-edits")!.body as { target: string; ops: { op: string }[] };
    expect(body.target).toBe("CANONICAL");
    expect(body.ops.map((o) => o.op)).toEqual(["crop", "background"]);
  });

  it("sem recorte a foto da peça não salva; a versão de apresentação libera filtros; desfazer e refazer funcionam", async () => {
    mockApi(ROUTES);
    renderApp(<PiecePhotoEditor pieceId="p1" />);
    await screen.findByText("Editar foto da peça");
    fireEvent.change(screen.getByLabelText(/Nitidez/), { target: { value: "0.2" } });
    tab("Revisão");
    expect(screen.getByText(/precisa do quadro 4:5/)).toBeTruthy();
    expect((topbar().getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(true);
    tab("Ajustar");
    expect(screen.getByText(/Filtros só na versão de apresentação/)).toBeTruthy();
    tab("Revisão");
    tab("Versão de apresentação");
    expect((topbar().getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(false);
    tab("Ajustar");
    expect(screen.getByRole("radio", { name: "P&B" })).toBeTruthy();
    fireEvent.click(topbar().getByRole("button", { name: "Desfazer" }));
    expect(screen.getByText(/Filtros só na versão de apresentação/)).toBeTruthy();
    fireEvent.click(topbar().getByRole("button", { name: "Refazer" }));
    expect(screen.getByRole("radio", { name: "P&B" })).toBeTruthy();
  });

  it("espelhar mostra o aviso de texto/logo e vai na receita; níveis e borda suave entram nas operações", async () => {
    const { calls } = mockApi({ ...ROUTES, "POST /api/pieces/p1/photo-edits/preview": { ...PREVIEW, warnings: ["ESPELHO_COM_TEXTO_OU_LOGO"] } });
    renderApp(<PiecePhotoEditor pieceId="p1" />);
    await screen.findByText("Editar foto da peça");
    tab("Recortar");
    fireEvent.click(screen.getByRole("button", { name: "Espelhar" }));
    expect(screen.getByText(/Espelhar inverte textos e logos/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tirar espelho" })).toBeTruthy();
    tab("Ajustar");
    fireEvent.change(screen.getByLabelText(/Ponto preto/), { target: { value: "0.05" } });
    tab("Recorte da peça");
    fireEvent.click(screen.getByLabelText("Remover o fundo"));
    fireEvent.change(screen.getByLabelText(/Suavizar borda/), { target: { value: "8" } });
    tab("Revisão");
    expect(await screen.findByText(/a marca fica invertida/)).toBeTruthy();
    await waitFor(() => {
      const last = [...calls].reverse().find((c) => c.path === "/api/pieces/p1/photo-edits/preview")!.body as { ops: { op: string; feather?: number; black?: number; axis?: string }[] };
      expect(last.ops.map((o) => o.op)).toEqual(["flip", "levels", "background"]);
      expect(last.ops[0].axis).toBe("H"); expect(last.ops[1].black).toBe(0.05); expect(last.ops[2].feather).toBe(8);
    }, { timeout: 2000 });
  });

  it("recorte com proporções e teclado: setas movem, + aumenta; Cancelar com alterações pede confirmação", async () => {
    mockApi(ROUTES);
    const { container } = renderApp(<PiecePhotoEditor pieceId="p1" />);
    await screen.findByText("Editar foto da peça");
    tab("Recortar");
    const img = container.querySelector(".photo-edit-frame img") as HTMLImageElement;
    Object.defineProperty(img, "naturalWidth", { value: 800 }); Object.defineProperty(img, "naturalHeight", { value: 1000 });
    fireEvent.load(img);
    expect(screen.getByRole("button", { name: "Recortar em 4:5" })).toBeTruthy();
    tab("1:1");                                                               // escolher a proporção já cria o recorte
    expect(screen.getByRole("button", { name: "Tirar recorte" })).toBeTruthy();
    const stage = container.querySelector(".photo-edit-stage") as HTMLElement;
    // 1:1 numa foto em pé ocupa a largura toda (x = 0, w = 100 %): só sobe e desce, e só pode diminuir
    const crop = () => stage.querySelector(".photo-edit-crop") as HTMLElement;
    expect(crop().style.width).toBe("100%");
    const before = parseFloat(crop().style.top);
    fireEvent.keyDown(stage, { key: "ArrowDown" });
    expect(parseFloat(crop().style.top)).toBeGreaterThan(before);
    fireEvent.keyDown(stage, { key: "-" });
    expect(parseFloat(crop().style.width)).toBeLessThan(100);
    fireEvent.click(topbar().getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("alertdialog", { name: "Descartar alterações?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(push).toHaveBeenCalledWith("/pieces/p1");
  });

  it("peça sem foto própria mostra o aviso e o caminho de volta", async () => {
    mockApi({ "GET /api/pieces/p1/photo-edits/session": new Response(JSON.stringify({ status: 409, code: "SEM_FOTO_PROPRIA", message: "Esta peça não tem foto sua para editar. Envie uma foto primeiro." }), { status: 409, headers: { "content-type": "application/json" } }) });
    renderApp(<PiecePhotoEditor pieceId="p1" />);
    expect(await screen.findByText("Esta peça não tem foto sua para editar")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar à peça" })).toBeTruthy();
  });
});

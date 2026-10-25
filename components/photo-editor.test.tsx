// @vitest-environment jsdom
/**
 * Editor Canvas 2D de Minhas Fotos (RF12.CA02 → RF15): carrega a foto (original do dono ou imagem da peça), recorta,
 * gira, ajusta brilho/contraste, remove o fundo, desfaz/refaz até a original e salva; sair com edições pede confirmação.
 * O jsdom não carrega imagens nem gera PNG: a imagem e o `toBlob` do canvas são simulados aqui.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { PhotoEditor } from "./photo-editor";

class FakeImage {
  naturalWidth = 400; naturalHeight = 200; onload: (() => void) | null = null; private s = "";
  get src() { return this.s; }
  set src(v: string) { this.s = v; setTimeout(() => this.onload?.(), 0); }
}
let blobOk = true;
/** Resposta binária com um Blob do próprio jsdom (o FormData do jsdom só aceita esse Blob). */
const png = () => ({ ok: true, status: 200, headers: new Headers({ "content-type": "image/png" }), blob: async () => new Blob(["png"], { type: "image/png" }) });
const BINARY = /\/(blob\/\d+|api\/photos\/ph1\/file|media\/p1\.png)$/;
const fail = (status = 500) => new Response(JSON.stringify({ status, code: "ERRO", message: "falhou no servidor" }), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  blobOk = true;
  vi.stubGlobal("Image", FakeImage);
  let n = 0;
  URL.createObjectURL = vi.fn(() => `/blob/${++n}`);
  URL.revokeObjectURL = vi.fn();
  HTMLCanvasElement.prototype.toBlob = function toBlob(cb: BlobCallback) { cb(blobOk ? new Blob(["x"], { type: "image/png" }) : null); };
  HTMLElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/** A API simulada por rota, com as URLs binárias (foto original, object URLs) respondidas antes dela. */
function mockAll(routes: Record<string, unknown>) {
  const api = mockApi(routes);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("data:") || BINARY.test(url)) { api.calls.push({ method: "GET", path: new URL(url, "http://localhost").pathname }); return png(); }
    return api.fetchMock(input, init);
  }));
  return api;
}
const history = () => within(document.querySelector(".editor-history") as HTMLElement).getAllByRole("button").map((b) => b.textContent);
async function open(props: Partial<Parameters<typeof PhotoEditor>[0]> = {}, routes: Record<string, unknown> = {}) {
  const onClose = vi.fn(); const onSaved = vi.fn();
  const api = mockAll(routes);
  renderApp(<PhotoEditor photoId="ph1" title="Camiseta" onClose={onClose} onSaved={onSaved} {...props} />);
  await screen.findByLabelText("imagem em edição");
  return { onClose, onSaved, ...api };
}
const btn = (name: string | RegExp) => screen.getByRole("button", { name });

describe("Editor Canvas 2D", () => {
  it("abre a foto original com o título, o histórico na original e salvar desligado", async () => {
    await open();
    expect(screen.getByRole("heading", { name: "Editor Canvas 2D · Camiseta" })).toBeTruthy();
    expect(history()).toEqual(["0. Original"]);
    expect((btn("Salvar edição") as HTMLButtonElement).disabled).toBe(true);
    expect((btn("desfazer (Ctrl+Z)") as HTMLButtonElement).disabled).toBe(true);
    expect((btn("refazer (Ctrl+Shift+Z)") as HTMLButtonElement).disabled).toBe(true);
    expect((btn("Voltar à original") as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem título mostra só o nome do editor", async () => {
    await open({ title: undefined });
    expect(screen.getByRole("heading", { name: "Editor Canvas 2D" })).toBeTruthy();
  });

  it("girar entra no histórico; desfazer, refazer, atalhos de teclado, voltar à original e clicar num passo navegam", async () => {
    await open();
    fireEvent.click(btn("⟳ Girar 90°"));
    fireEvent.click(btn("⟳ Girar 90°"));
    expect(history()).toEqual(["0. Original", "1. Girar 90°", "2. Girar 90°"]);
    fireEvent.click(btn("desfazer (Ctrl+Z)"));
    expect(screen.getByRole("button", { name: "1. Girar 90°" }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("button", { name: "2. Girar 90°" }).className).toBe("is-future");
    fireEvent.click(btn("refazer (Ctrl+Shift+Z)"));
    expect(screen.getByRole("button", { name: "2. Girar 90°" }).getAttribute("aria-current")).toBe("step");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getByRole("button", { name: "1. Girar 90°" }).getAttribute("aria-current")).toBe("step");
    fireEvent.keyDown(window, { key: "Z", metaKey: true, shiftKey: true });
    expect(screen.getByRole("button", { name: "2. Girar 90°" }).getAttribute("aria-current")).toBe("step");
    fireEvent.keyDown(window, { key: "z" });   // sem Ctrl/⌘ não desfaz
    expect(screen.getByRole("button", { name: "2. Girar 90°" }).getAttribute("aria-current")).toBe("step");
    fireEvent.click(btn("Voltar à original"));
    expect(screen.getByRole("button", { name: "0. Original" }).getAttribute("aria-current")).toBe("step");
    fireEvent.click(screen.getByRole("button", { name: "2. Girar 90°" }));
    expect(screen.getByRole("button", { name: "2. Girar 90°" }).getAttribute("aria-current")).toBe("step");
    // um passo novo depois de desfazer descarta o futuro
    fireEvent.click(screen.getByRole("button", { name: "0. Original" }));
    fireEvent.click(btn("⟳ Girar 90°"));
    expect(history()).toEqual(["0. Original", "1. Girar 90°"]);
  });

  it("recorte: arrastar marca a área, aplicar entra no histórico e o giro leva o recorte junto; recorte mínimo não aplica", async () => {
    const { container } = { container: document.body };
    await open();
    fireEvent.click(btn("✂ Recortar"));
    expect(screen.getByText("arraste para marcar o recorte")).toBeTruthy();
    expect((btn("Aplicar recorte") as HTMLButtonElement).disabled).toBe(true);
    const stage = container.querySelector(".editor-stage > div") as HTMLElement;
    fireEvent.pointerDown(stage, { clientX: 60, clientY: 70, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 90, clientY: 90, pointerId: 1 });   // depois de soltar não mexe mais
    const box = container.querySelector(".editor-crop") as HTMLElement;
    expect(box.style.left).toBe("10%");
    expect(box.style.width).toBe("50%");
    expect(box.style.height).toBe("60%");
    fireEvent.click(btn("Aplicar recorte"));
    expect(history()).toEqual(["0. Original", "1. Recortar"]);
    expect(container.querySelector(".editor-crop")).toBeNull();
    fireEvent.click(btn("⟳ Girar 90°"));
    expect(history()).toEqual(["0. Original", "1. Recortar", "2. Girar 90°"]);
    // segundo recorte dentro do primeiro, mas pequeno demais: o botão fica desligado e cancelar desfaz o modo
    fireEvent.click(btn("✂ Recortar"));
    fireEvent.pointerDown(stage, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(stage, { clientX: 51, clientY: 51, pointerId: 1 });
    expect((btn("Aplicar recorte") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn("Cancelar"));
    expect(screen.queryByText("arraste para marcar o recorte")).toBeNull();
    // fora do modo recorte o arrasto não marca nada
    fireEvent.pointerDown(stage, { clientX: 10, clientY: 10, pointerId: 1 });
    expect(container.querySelector(".editor-crop")).toBeNull();
    // alternar o botão desliga o modo
    fireEvent.click(btn("✂ Recortar"));
    fireEvent.click(btn("✂ Recortar"));
    expect(screen.queryByRole("button", { name: "Aplicar recorte" })).toBeNull();
  });

  it("brilho e contraste mudam o rascunho e entram no histórico ao soltar (mouse ou teclado)", async () => {
    await open();
    const [bright, contrast] = screen.getAllByRole("slider");
    fireEvent.pointerUp(bright);   // sem mudança, nada entra
    expect(history()).toHaveLength(1);
    fireEvent.change(bright, { target: { value: "130" } });
    expect(screen.getByText("Brilho · 130%")).toBeTruthy();
    expect((btn("desfazer (Ctrl+Z)") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.pointerUp(bright);
    fireEvent.change(contrast, { target: { value: "70" } });
    fireEvent.keyUp(contrast, { key: "ArrowLeft" });
    expect(history()).toEqual(["0. Original", "1. Brilho", "2. Contraste"]);
    expect(screen.getByText("Contraste · 70%")).toBeTruthy();
    // rascunho sem soltar: desfazer descarta o rascunho
    fireEvent.change(bright, { target: { value: "160" } });
    fireEvent.click(btn("desfazer (Ctrl+Z)"));
    expect(screen.getByText("Brilho · 130%")).toBeTruthy();
  });

  it("remover fundo: sucesso troca a fonte e avisa o provedor; recusa mostra a mensagem do servidor ou a padrão; erro avisa sem travar", async () => {
    const answers: unknown[] = [{ ok: true, png: "AAAA", provider: "rembg" }, { ok: true, png: "BBBB" }, { ok: false, message: "Foto escura demais" }, { ok: false }, fail()];
    const { calls } = await open({}, { "POST /api/photos/background-removal": () => answers.shift() });
    fireEvent.click(btn("Remover fundo"));
    expect(await screen.findByText("Fundo removido (rembg).")).toBeTruthy();
    expect(history()).toEqual(["0. Original", "1. Remover fundo"]);
    fireEvent.click(btn("desfazer (Ctrl+Z)"));
    fireEvent.click(btn("Remover fundo"));
    expect(await screen.findByText("Fundo removido (local).")).toBeTruthy();
    fireEvent.click(btn("Remover fundo"));
    expect(await screen.findByText("Foto escura demais")).toBeTruthy();
    fireEvent.click(btn("Remover fundo"));
    expect(await screen.findByText("Não deu para remover o fundo agora. As outras ferramentas seguem funcionando.")).toBeTruthy();
    fireEvent.click(btn("Remover fundo"));
    expect(await screen.findByText("A remoção de fundo falhou. Recorte, rotação e ajustes continuam disponíveis.")).toBeTruthy();
    expect(calls.filter((c) => c.path === "/api/photos/background-removal").length).toBe(5);
    expect(calls.find((c) => c.path === "/api/photos/background-removal")!.body).toBeInstanceOf(FormData);
  });

  it("salvar a edição de Minhas Fotos envia o PNG e devolve a mensagem do servidor (ou a padrão)", async () => {
    const replies: unknown[] = [{ message: "Nova versão guardada" }, {}];
    const { onSaved, calls } = await open({}, { "POST /api/photos/ph1/edits": () => replies.shift() });
    fireEvent.click(btn("⟳ Girar 90°"));
    fireEvent.click(btn("Salvar edição"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Nova versão guardada"));
    fireEvent.click(btn("Salvar edição"));
    await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith("Edição salva."));
    expect(calls.filter((c) => c.method === "POST" && c.path === "/api/photos/ph1/edits").length).toBe(2);
  });

  it("salvar com o canvas vazio ou erro do servidor avisa e não fecha", async () => {
    const { onSaved } = await open({}, { "POST /api/photos/ph1/edits": () => fail() });
    fireEvent.click(btn("⟳ Girar 90°"));
    blobOk = false;
    fireEvent.click(btn("Salvar edição"));
    expect(await screen.findByText("Algo deu errado. Tente de novo.")).toBeTruthy();   // canvas vazio: erro genérico
    blobOk = true;
    fireEvent.click(btn("Salvar edição"));
    expect(await screen.findByText("falhou no servidor")).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("a partir da peça carrega a imagem atual e salva trocando a imagem da peça (PUT)", async () => {
    const { onSaved, calls } = await open({ photoId: undefined, pieceId: "p1", imageUrl: "/media/p1.png" }, { "PUT /api/pieces/p1/image": { ok: true } });
    fireEvent.click(btn("⟳ Girar 90°"));
    fireEvent.click(btn("Salvar edição"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("A imagem editada agora é a da peça. A original continua em Minhas Fotos."));
    expect(calls.some((c) => c.method === "PUT" && c.path === "/api/pieces/p1/image")).toBe(true);
  });

  it("imagem da peça indisponível ou foto sem permissão: avisa e fecha o editor", async () => {
    const onClose = vi.fn();
    mockApi({ "GET /media/x.png": () => fail(404) });
    renderApp(<PhotoEditor pieceId="p1" imageUrl="/media/x.png" onClose={onClose} onSaved={vi.fn()} />);
    expect(await screen.findByText("Algo deu errado. Tente de novo.")).toBeTruthy();
    expect(onClose).toHaveBeenCalled();
    cleanup();
    const onClose2 = vi.fn();
    mockApi({ "GET /api/photos/ph9/file": () => fail(403) });
    renderApp(<PhotoEditor photoId="ph9" onClose={onClose2} onSaved={vi.fn()} />);
    await waitFor(() => expect(onClose2).toHaveBeenCalled());
  });

  it("fechar sem edições sai direto; com edições pede confirmação, continuar editando mantém e descartar sai", async () => {
    const { onClose } = await open();
    fireEvent.click(btn("fechar editor"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(btn("⟳ Girar 90°"));
    fireEvent.click(btn("⟳ Girar 90°"));
    fireEvent.click(btn("fechar editor"));
    const confirm = await screen.findByRole("dialog", { name: "Sair sem salvar?" });
    expect(within(confirm).getByText("As 2 edição(ões) desta sessão serão descartadas. A foto original continua intacta.")).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Continuar editando" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sair sem salvar?" })).toBeNull());
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(btn("fechar editor"));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Sair sem salvar?" })).getByRole("button", { name: "Descartar edições" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

// @vitest-environment jsdom
/**
 * Admin · Motor de assets 3D: formulário de geração (bloco, preço, nível, foto, importação de tarefa Meshy), limite de
 * 8 MB, chave de idempotência mantida após falha, lista de jobs com status/revisão, aprovar, rejeitar, publicar e prévia.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import RoomAssetsPage from "./page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ADMIN = { ...ME, role: "ADMIN" as const };
const fail = (status: number, message: string) => () => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const BLOCKS = [{ slotType: "DOOR", moldId: "door-1", widthCm: 60, label: "Porta", basePrice: 10, minLevel: "ESTREIA", materials: [] }, { slotType: "CUSTOM", moldId: "x-2", widthCm: 40, label: "X", basePrice: 10, minLevel: "LOFT", materials: [] }];
const job = (id: string, status: string, review: string, extra: Record<string, unknown> = {}) => ({ id, status, input: { command: { name: `Asset ${id}`, slotType: "DOOR", pricePoints: 100 }, referenceUrl: `/ref/${id}.png` }, result: { review, progress: 50 }, ...extra });
const JOBS = [job("j1", "COMPLETED", "APPROVED", { modelUrl: "/m/j1.glb" }), job("j2", "COMPLETED", "PENDING"), job("j3", "FAILED", "PENDING", { errorCode: "MESHY_TIMEOUT" }), { ...job("j4", "COMPLETED", "APPROVED"), result: { review: "APPROVED", progress: 100, sku: "SKU-9" } }];
const ASSETS = { available: true, items: JOBS, blocks: BLOCKS, levels: ["ESTREIA", "STUDIO", "LOFT"] };
const form = () => screen.getByText(/A geração utiliza créditos/).closest("form")!;
const inputs = () => form().querySelectorAll("input");
const commandOf = (body: unknown) => JSON.parse(String((body as FormData).get("command")));
function choose(index: number, option: RegExp | string) {
  fireEvent.click(form().querySelectorAll('[aria-haspopup="listbox"]')[index]);
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: option }));
}
/** O jsdom não aceita arquivo em input required: o envio vai direto pelo submit do formulário (o botão é conferido à parte). */
const png = (size?: number) => { const f = new File(["x"], "ref.png", { type: "image/png" }); if (size) Object.defineProperty(f, "size", { value: size }); return f; };

describe("admin · assets 3D — geração", () => {
  it("gera com o bloco e nível escolhidos; o botão só libera com nome e foto; depois limpa e avisa", async () => {
    const { calls } = loggedAs(ADMIN, { "GET /api/admin/room-assets": ASSETS, "POST /api/admin/room-assets": {} });
    renderApp(<RoomAssetsPage />);
    const submit = await screen.findByRole("button", { name: "Gerar com Meshy" }, { timeout: 4000 });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(inputs()[0], { target: { value: " Porta nova " } });
    choose(0, "CUSTOM · x-2");
    expect(form().querySelectorAll('[aria-haspopup="listbox"]')[1].textContent).toContain("LOFT");
    choose(1, "STUDIO");
    fireEvent.change(inputs()[1], { target: { value: "250" } });
    fireEvent.change(inputs()[2], { target: { files: [png()] } });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.submit(form());
    expect(await screen.findByText("Solicitação adicionada à fila.")).toBeTruthy();
    const post = calls.find((c) => c.method === "POST" && c.path === "/api/admin/room-assets")!;
    expect(commandOf(post.body)).toMatchObject({ name: "Porta nova", slotType: "CUSTOM", moldId: "x-2", widthCm: 40, pricePoints: 250, requiredLevel: "STUDIO" });
    expect(typeof commandOf(post.body).requestId).toBe("string");
    expect((post.body as FormData).get("taskId")).toBeNull();
    await waitFor(() => expect((inputs()[0] as HTMLInputElement).value).toBe(""));
  });

  it("imagem acima de 8 MB não envia; falha mantém a mesma chave ao tentar de novo; com ID de tarefa importa", async () => {
    let n = 0;
    const { calls } = loggedAs(ADMIN, { "GET /api/admin/room-assets": ASSETS, "POST /api/admin/room-assets": () => (++n === 1 ? fail(502, "Meshy fora")() : {}), "POST /api/admin/room-assets/import-meshy": {} });
    renderApp(<RoomAssetsPage />);
    await screen.findByRole("button", { name: "Gerar com Meshy" }, { timeout: 4000 });
    fireEvent.change(inputs()[0], { target: { value: "Grande" } });
    fireEvent.change(inputs()[2], { target: { files: [png(9 * 1024 * 1024)] } });
    fireEvent.submit(form());
    expect(await screen.findByText("Use uma imagem de até 8 MB.")).toBeTruthy();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    fireEvent.change(inputs()[2], { target: { files: [png()] } });
    fireEvent.submit(form());
    expect(await screen.findByText("Meshy fora")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Gerar com Meshy" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.submit(form());
    await waitFor(() => expect(calls.filter((c) => c.method === "POST" && c.path === "/api/admin/room-assets")).toHaveLength(2));
    const [a, b] = calls.filter((c) => c.method === "POST" && c.path === "/api/admin/room-assets").map((c) => commandOf(c.body).requestId);
    expect(a).toBe(b);
    // importação de tarefa existente
    await waitFor(() => expect((inputs()[0] as HTMLInputElement).value).toBe(""));
    fireEvent.change(inputs()[0], { target: { value: "Importado" } });
    fireEvent.change(inputs()[2], { target: { files: [png()] } });
    fireEvent.change(inputs()[3], { target: { value: " task-77 " } });
    expect(screen.getByRole("button", { name: "Importar para revisão" })).toBeTruthy();
    fireEvent.submit(form());
    await waitFor(() => expect(calls.some((c) => c.path === "/api/admin/room-assets/import-meshy")).toBe(true));
    const imp = calls.find((c) => c.path === "/api/admin/room-assets/import-meshy")!;
    expect((imp.body as FormData).get("taskId")).toBe("task-77");
    expect(commandOf(imp.body).requestId).not.toBe(a);
  });

  it("Meshy indisponível avisa e trava o envio; sem jobs mostra o vazio; erro da lista aparece", async () => {
    loggedAs(ADMIN, { "GET /api/admin/room-assets": { ...ASSETS, available: false, items: [] } });
    renderApp(<RoomAssetsPage />);
    expect(await screen.findByText(/A API Meshy está indisponível/, undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText("Nenhum asset gerado.")).toBeTruthy();
    fireEvent.change(inputs()[0], { target: { value: "X" } });
    fireEvent.change(inputs()[2], { target: { files: [png()] } });
    expect((screen.getByRole("button", { name: "Gerar com Meshy" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    loggedAs(ADMIN, { "GET /api/admin/room-assets": fail(500, "Lista quebrou") });
    renderApp(<RoomAssetsPage />);
    expect((await screen.findAllByText("Lista quebrou", undefined, { timeout: 4000 })).length).toBeGreaterThan(0);
  });
});

describe("admin · assets 3D — revisão", () => {
  it("lista status, progresso, sku ou erro; aprovar, rejeitar e publicar; publicar exige aprovado", async () => {
    const { calls } = loggedAs(ADMIN, { "GET /api/admin/room-assets": ASSETS, "POST /api/admin/room-assets/j2/review": {}, "POST /api/admin/room-assets/j1/publish": fail(409, "Já publicado") });
    renderApp(<RoomAssetsPage />);
    expect(await screen.findByText("Asset j1", undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.getAllByText("Concluído · 50%").length).toBe(2);
    expect(screen.getByText("Falhou · 50%")).toBeTruthy();
    expect(screen.getByText("MESHY_TIMEOUT")).toBeTruthy();
    expect(screen.getByText("SKU-9")).toBeTruthy();
    expect(screen.getByText("Aguardando revisão")).toBeTruthy();
    const j2 = screen.getByText("Asset j2").closest("li")!;
    expect((within(j2).getByRole("button", { name: "Publicar na loja" }) as HTMLButtonElement).disabled).toBe(true);
    // concluído com sku ou falho não mostra ações
    expect(within(screen.getByText("Asset j4").closest("li")!).queryByRole("button", { name: "Aprovar" })).toBeNull();
    fireEvent.click(within(j2).getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/admin/room-assets/j2/review")).toHaveLength(1));
    await waitFor(() => expect((within(screen.getByText("Asset j2").closest("li")!).getByRole("button", { name: "Rejeitar" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(screen.getByText("Asset j2").closest("li")!).getByRole("button", { name: "Rejeitar" }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/admin/room-assets/j2/review").map((c) => c.body)).toEqual([{ approve: true }, { approve: false }]));
    await waitFor(() => expect((within(screen.getByText("Asset j1").closest("li")!).getByRole("button", { name: "Publicar na loja" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(screen.getByText("Asset j1").closest("li")!).getByRole("button", { name: "Publicar na loja" }));
    expect(await screen.findByText("Já publicado")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/admin/room-assets/j1/publish")!.body).toEqual({});
  });

  it("prévia do modelo abre um diálogo com o nome do asset e fecha", async () => {
    loggedAs(ADMIN, { "GET /api/admin/room-assets": ASSETS });
    renderApp(<RoomAssetsPage />);
    const buttons = await screen.findAllByRole("button", { name: "Revisar modelo 3D" }, { timeout: 4000 });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    const dlg = await screen.findByRole("dialog", { name: "Asset j1" });
    fireEvent.keyDown(dlg, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

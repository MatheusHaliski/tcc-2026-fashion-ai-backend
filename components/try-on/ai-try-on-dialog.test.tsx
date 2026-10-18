// @vitest-environment jsdom
/**
 * Prova com IA no provador: só entram peças do próprio guarda-roupa que o FASHN veste (cima, baixo, inteira); a foto vai
 * para /api/try-on/person-photos; "Gerar prova" só com peça, foto e consentimento; o resultado é a imagem gerada e os
 * erros do servidor viram mensagens claras (GPU desligada, rota ainda ausente, foto pequena).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { AiTryOnDialog, aiCandidates } from "@/components/try-on/ai-try-on-dialog";
import type { FittingItem } from "@/lib/tryon/fitting-room";

const top: FittingItem = { key: "w:w1", source: "wardrobe", slot: "upper_piece", wear: "TOP", name: "Camisa de linho", brand: null, category: "upper_piece", imageUrl: "/media/w1.png", pieceId: "w1", addedAt: 1 };
const shoes: FittingItem = { key: "w:w2", source: "wardrobe", slot: "shoes_piece", wear: "SHOES", name: "Tênis branco", brand: null, category: "shoes_piece", pieceId: "w2", addedAt: 2 };
const store: FittingItem = { key: "c:p1", source: "catalog", slot: "lower_piece", wear: "BOTTOM", name: "Calça da loja", brand: { name: "Animale", logoUrl: null }, category: "lower_piece", productId: "p1", addedAt: 3 };
const error = (status: number, code: string) => new Response(JSON.stringify({ status, code, message: "do servidor" }), { status, headers: { "content-type": "application/json" } });
const photo = () => new File(["x"], "eu.jpg", { type: "image/jpeg" });

beforeEach(() => {
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:previa"), revokeObjectURL: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function open(items: FittingItem[] = [top, shoes, store], props: Partial<Parameters<typeof AiTryOnDialog>[0]> = {}) {
  return renderApp(<AiTryOnDialog open onClose={vi.fn()} items={items} onPickFromWardrobe={vi.fn()} {...props} />);
}
async function sendPhoto(button = "Escolher foto") {
  fireEvent.change(screen.getByLabelText(button), { target: { files: [photo()] } });
}
const generate = () => screen.getByRole("button", { name: "Gerar prova" }) as HTMLButtonElement;

describe("Prova com IA", () => {
  it("só peças do guarda-roupa com id e categoria que o FASHN veste são candidatas", () => {
    const dress: FittingItem = { ...top, key: "w:w3", slot: "lower_piece", wear: "FULL_BODY", category: "full_body_piece", pieceId: "w3", name: "Vestido" };
    const noId: FittingItem = { ...top, key: "w:sem-id", pieceId: undefined };
    expect(aiCandidates([top, shoes, store, dress, noId]).map((i) => i.key)).toEqual(["w:w1", "w:w3"]);
  });

  it("sem peça elegível: explica, leva ao guarda-roupa e não deixa gerar", () => {
    loggedAs();
    const onClose = vi.fn(); const onPickFromWardrobe = vi.fn();
    open([shoes, store], { onClose, onPickFromWardrobe });
    expect(screen.getByText(/Vista no provador uma parte de cima, de baixo ou peça inteira/)).toBeTruthy();
    expect(generate().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Escolher no guarda-roupa" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPickFromWardrobe).toHaveBeenCalledTimes(1);
  });

  it("envia a foto, pede consentimento e gera a prova da peça escolhida", async () => {
    const { calls } = loggedAs(undefined, {
      "POST /api/try-on/person-photos": { url: "/media/users/u1/tryon/person-1.jpg", width: 1024, height: 1536 },
      "POST /api/try-on/anatomical-renders": { status: "READY", url: "/media/users/u1/tryon/render-1.png", diagnostics: { gpuName: "NVIDIA T4", latencyMs: 41_200 }, physicalFitCertified: false },
    });
    const { unmount } = open();
    fireEvent.click(screen.getByRole("button", { name: "Peça do seu guarda-roupa: Camisa de linho" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Camisa de linho"]);
    fireEvent.click(screen.getByRole("option", { name: "Camisa de linho" }));
    expect(generate().disabled).toBe(true);
    await sendPhoto();
    await waitFor(() => expect(screen.getByRole("button", { name: "Trocar foto" })).toBeTruthy());
    const upload = calls.filter((c) => c.path === "/api/try-on/person-photos");
    expect(upload).toHaveLength(1);
    expect(upload[0].method).toBe("POST");
    expect(upload[0].body).toBeInstanceOf(FormData);
    expect(generate().disabled).toBe(true);  // ainda falta o consentimento
    fireEvent.click(screen.getByRole("switch", { name: /Autorizo o processamento desta foto/ }));
    expect(generate().disabled).toBe(false);
    fireEvent.click(generate());
    const result = await screen.findByAltText("Prova com IA: Camisa de linho na sua foto");
    expect(result.getAttribute("src")).toContain("/media/users/u1/tryon/render-1.png");
    expect(calls.find((c) => c.path === "/api/try-on/anatomical-renders")?.body)
      .toEqual({ pieceId: "w1", personMediaUrl: "/media/users/u1/tryon/person-1.jpg", processingConsent: true, mirror: false });
    expect(screen.getByText("Gerada em 41 s na GPU NVIDIA T4.")).toBeTruthy();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:previa");
  });

  it("GPU desligada no servidor vira aviso claro, sem imagem de resultado", async () => {
    loggedAs(undefined, {
      "POST /api/try-on/person-photos": { url: "/media/p.jpg" },
      "POST /api/try-on/anatomical-renders": () => error(503, "VTON_NOT_CONFIGURED"),
    });
    open();
    await sendPhoto();
    await waitFor(() => expect(screen.getByRole("button", { name: "Trocar foto" })).toBeTruthy());
    fireEvent.click(screen.getByRole("switch", { name: /Autorizo/ }));
    fireEvent.click(generate());
    expect((await screen.findByRole("alert")).textContent).toBe("O serviço de prova com IA não está disponível agora. Tente mais tarde.");
    expect(screen.queryByAltText(/Prova com IA:/)).toBeNull();
  });

  it("foto pequena e rota ainda ausente no servidor: mensagens próprias no envio", async () => {
    let upload: () => Response = () => error(400, "VTON_IMAGE_SMALL");
    loggedAs(undefined, { "POST /api/try-on/person-photos": () => upload() });
    open();
    await sendPhoto();
    expect((await screen.findByRole("alert")).textContent).toBe("Use uma foto com pelo menos 256 px no menor lado.");
    upload = () => error(404, "NAO_ENCONTRADO");
    await sendPhoto();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("A prova com IA ainda não está ativa no servidor."));
    expect(screen.getByRole("button", { name: "Escolher foto" })).toBeTruthy();
  });
});

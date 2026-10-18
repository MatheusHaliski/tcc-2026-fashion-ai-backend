// @vitest-environment jsdom
/**
 * Prova com IA na GPU (Provador): o look inteiro vai em sequência para /api/try-on/look-renders (inteira → baixo →
 * cima), calçados e acessórios ficam de fora com aviso e a recusa da GPU vira o que a pessoa corrige na foto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { accessories2d, GpuLookDialog, gpuLook, refusalKey, type GpuPiece } from "@/components/try-on/gpu-look-dialog";

// a detecção roda no navegador com o MediaPipe; aqui, um rosto de frente no centro da foto
const detect = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tryon/accessory-detect", () => ({ detectForAccessories: detect }));
const frontFace = () => {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.3, z: 0 }));
  Object.assign(lm, { 33: { x: 0.45, y: 0.3, z: 0 }, 263: { x: 0.55, y: 0.3, z: 0 }, 234: { x: 0.4, y: 0.32, z: 0 }, 454: { x: 0.6, y: 0.32, z: 0 } });
  return lm;
};
/** No jsdom imagens não carregam: esta dispara o onload com um tamanho conhecido. */
class LoadedImage { onload?: () => void; onerror?: () => void; naturalWidth = 400; naturalHeight = 160; set src(_: string) { queueMicrotask(() => this.onload?.()); } }

const shirt: GpuPiece = { id: "w1", source: "wardrobe", name: "Camisa de linho", category: "upper_piece" };
const pants: GpuPiece = { id: "w2", source: "wardrobe", name: "Calça de alfaiataria", category: "lower_piece" };
const shoes: GpuPiece = { id: "w3", source: "wardrobe", name: "Tênis branco", category: "shoes_piece" };
const photo = () => new File(["x"], "eu.jpg", { type: "image/jpeg" });
const refusal = (reason: string) => new Response(JSON.stringify({ status: 422, code: "VTON_WORKER_REJECTED", message: "do servidor", details: { reason } }),
  { status: 422, headers: { "content-type": "application/json" } });

beforeEach(() => { Object.assign(URL, { createObjectURL: vi.fn(() => "blob:previa"), revokeObjectURL: vi.fn() }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function photoAndConsent() {
  fireEvent.change(screen.getByLabelText("Escolher foto"), { target: { files: [photo()] } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Trocar foto" })).toBeTruthy());
  fireEvent.click(screen.getByRole("switch", { name: /Autorizo o processamento desta foto/ }));
}

describe("Foto realista na GPU", () => {
  it("uma peça por tipo, na ordem em que a GPU veste (inteira → baixo → cima)", () => {
    const dress: GpuPiece = { id: "d", source: "catalog", name: "Vestido", category: "full_body_piece" };
    expect(gpuLook([shirt, shoes, pants, { ...shirt, id: "w9" }, dress]).map((p) => p.id)).toEqual(["d", "w2", "w1"]);
  });

  it("veste o look inteiro em sequência e avisa o que ficou fora da foto", async () => {
    const { calls } = loggedAs(undefined, {
      "POST /api/try-on/person-photos": { url: "/media/users/u1/tryon/person-1.jpg" },
      "POST /api/try-on/look-renders": { status: "READY", url: "/media/users/u1/tryon/render-2.png", steps: [{ pieceId: "w2", category: "lower_piece", url: "/a.png" }, { pieceId: "w1", category: "upper_piece", url: "/media/users/u1/tryon/render-2.png" }], skipped: ["w3"] },
    });
    renderApp(<GpuLookDialog open onClose={vi.fn()} pieces={[shirt, pants, shoes]} />);
    expect(screen.getByRole("radio", { name: "Look inteiro · 2 peças" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Calça de alfaiataria · Camisa de linho")).toBeTruthy();
    expect(screen.getByText(/Ficam fora da foto .*Tênis branco/)).toBeTruthy();
    await photoAndConsent();
    fireEvent.click(screen.getByRole("button", { name: "Gerar prova" }));
    const result = await screen.findByAltText("Foto realista do look na sua foto");
    expect(result.getAttribute("src")).toContain("/media/users/u1/tryon/render-2.png");
    expect(calls.find((c) => c.path === "/api/try-on/look-renders")?.body)
      .toEqual({ pieceIds: ["w2", "w1"], productIds: [], personMediaUrl: "/media/users/u1/tryon/person-1.jpg", processingConsent: true });
    expect(screen.getByText("Vestido em 2 etapas na GPU.")).toBeTruthy();
  });

  it("a recusa da GPU diz o que corrigir na foto (nunca o texto cru do servidor)", async () => {
    loggedAs(undefined, {
      "POST /api/try-on/person-photos": { url: "/media/p.jpg" },
      "POST /api/try-on/look-renders": () => refusal("EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED"),
    });
    renderApp(<GpuLookDialog open onClose={vi.fn()} pieces={[shirt, pants]} />);
    await photoAndConsent();
    fireEvent.click(screen.getByRole("button", { name: "Gerar prova" }));
    expect((await screen.findByRole("alert")).textContent).toBe("A foto precisa mostrar exatamente uma pessoa, com o corpo visível.");
    expect(refusalKey("GPU_BUSY_RETRY_LATER")).toBe("tryOn.ia_motivo.gpu");
    expect(refusalKey("<script>")).toBeNull();
  });

  it("acessório com foto entra por cima da foto, posicionado pelos pontos do rosto (prévia 2D)", async () => {
    vi.stubGlobal("Image", LoadedImage);
    detect.mockResolvedValue({ face: frontFace(), pose: null, width: 1000, height: 1000 });
    const glasses: GpuPiece = { id: "c7", source: "catalog", name: "Óculos aviador", category: "accessory_piece", subcategory: "sunglasses", image: "/media/catalog/oculos.png", cutout: true };
    const ring: GpuPiece = { id: "c8", source: "catalog", name: "Anel", category: "accessory_piece", subcategory: "ring", image: "/media/catalog/anel.png" };
    expect(accessories2d([shirt, glasses, ring, { ...glasses, id: "c9", image: null }]).map((a) => a.name)).toEqual(["Óculos aviador"]);
    loggedAs(undefined, { "POST /api/try-on/person-photos": { url: "/media/p.jpg" } });
    renderApp(<GpuLookDialog open onClose={vi.fn()} pieces={[shirt, pants, glasses]} />);
    expect(screen.getByText(/Ficam fora da foto .*Óculos aviador/)).toBeTruthy();
    await photoAndConsent();
    fireEvent.click(screen.getByRole("switch", { name: "Compor acessórios na foto (prévia 2D)" }));
    const overlay = await screen.findByAltText("Óculos aviador sobre a foto");
    expect(detect).toHaveBeenCalledWith("blob:previa", { face: true, pose: false });
    expect((overlay as HTMLImageElement).style.width).toBe("15.5%");
    expect(screen.queryByText(/Ficam fora da foto/)).toBeNull();
    expect(screen.getByText(/Prévia 2D aproximada.*Óculos aviador/)).toBeTruthy();
  });

});

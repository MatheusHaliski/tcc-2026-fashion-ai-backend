// @vitest-environment jsdom
/**
 * Foto realista na GPU (Avatar 3D, Provador e espelho do Meu Quarto): o look inteiro vai em sequência para
 * /api/try-on/look-renders (inteira → baixo → cima), calçados e acessórios ficam de fora com aviso, a recusa da GPU
 * vira o que a pessoa corrige na foto e, no Avatar 3D, o look é montado com peças do guarda-roupa.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { GpuLookDialog, gpuLook, refusalKey, type GpuPiece } from "@/components/try-on/gpu-look-dialog";

const shirt: GpuPiece = { pieceId: "w1", name: "Camisa de linho", category: "upper_piece" };
const pants: GpuPiece = { pieceId: "w2", name: "Calça de alfaiataria", category: "lower_piece" };
const shoes: GpuPiece = { pieceId: "w3", name: "Tênis branco", category: "shoes_piece" };
const photo = () => new File(["x"], "eu.jpg", { type: "image/jpeg" });
const refusal = (reason: string) => new Response(JSON.stringify({ status: 422, code: "VTON_WORKER_REJECTED", message: "do servidor", details: { reason } }),
  { status: 422, headers: { "content-type": "application/json" } });
const page = (items: unknown[]) => ({ items, page: 0, size: 60, total: items.length, hasMore: false });

beforeEach(() => { Object.assign(URL, { createObjectURL: vi.fn(() => "blob:previa"), revokeObjectURL: vi.fn() }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function photoAndConsent() {
  fireEvent.change(screen.getByLabelText("Escolher foto"), { target: { files: [photo()] } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Trocar foto" })).toBeTruthy());
  fireEvent.click(screen.getByRole("switch", { name: /Autorizo o processamento desta foto/ }));
}

describe("Foto realista na GPU", () => {
  it("uma peça por tipo, na ordem em que a GPU veste (inteira → baixo → cima)", () => {
    const dress: GpuPiece = { pieceId: "d", name: "Vestido", category: "full_body_piece" };
    expect(gpuLook([shirt, shoes, pants, { ...shirt, pieceId: "w9" }, dress]).map((p) => p.pieceId)).toEqual(["d", "w2", "w1"]);
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
      .toEqual({ pieceIds: ["w2", "w1"], personMediaUrl: "/media/users/u1/tryon/person-1.jpg", processingConsent: true });
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

  it("no Avatar 3D o look é montado com peças do guarda-roupa, uma por tipo", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/me/closet": (u: URL) => page(u.searchParams.get("category") === "upper_piece" ? [{ id: "w1", name: "Camisa de linho", category: "upper_piece" }]
        : u.searchParams.get("category") === "lower_piece" ? [{ id: "w2", name: "Calça de alfaiataria", category: "lower_piece" }] : []),
      "POST /api/try-on/person-photos": { url: "/media/p.jpg" },
      "POST /api/try-on/look-renders": { status: "READY", url: "/media/r.png", steps: [], skipped: [] },
    });
    renderApp(<GpuLookDialog open onClose={vi.fn()} title="Foto realista do look (GPU)" />);
    fireEvent.click(await screen.findByRole("button", { name: /^Parte de cima/ }));
    fireEvent.click(screen.getByRole("option", { name: "Camisa de linho" }));
    fireEvent.click(screen.getByRole("button", { name: /^Parte de baixo/ }));
    fireEvent.click(screen.getByRole("option", { name: "Calça de alfaiataria" }));
    await photoAndConsent();
    fireEvent.click(screen.getByRole("button", { name: "Gerar prova" }));
    await screen.findByAltText("Foto realista do look na sua foto");
    expect(calls.filter((c) => c.path.startsWith("/api/me/closet")).map((c) => new URL(c.path, "http://x").searchParams.get("category"))).toEqual(["full_body_piece", "lower_piece", "upper_piece"]);
    expect(calls.find((c) => c.path === "/api/try-on/look-renders")?.body).toMatchObject({ pieceIds: ["w2", "w1"] });
  });
});

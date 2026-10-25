// @vitest-environment jsdom
/**
 * Admin · Fotos do catálogo: painel de qualidade do pipeline, fila de revisão com antes (depuração) e depois (card),
 * métricas, decisões (aprovar, reprocessar, rejeitar) e troca por outra foto oficial do produto.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import CatalogImagesPage from "./page";

vi.mock("@/components/catalog/catalog-photo", () => ({
  photoAspect: (a?: string | null) => a ?? "4 / 5",
  CatalogPhoto: ({ image, fallbackUrl }: { image?: { url: string; mode: string }; fallbackUrl?: string }) => <span data-testid="foto">{image ? `${image.mode} ${image.url}` : `fallback ${fallbackUrl}`}</span>,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ADMIN = { ...ME, role: "ADMIN" as const };
const fail = (status: number, message: string) => () => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const METRICS = { pipelineVersion: "v3", enabled: true, byStatus: { READY: 10, FAILED: 2 }, canonical: 8, reviewPending: 3, averageQuality: 0.815, topRejectionReasons: [{ reasons: "HUMANO", count: 4 }, { reasons: "BORRADA", count: 1 }] };
const R = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };
const PROCESSED = { id: "i1", productId: "p1", sourceUrl: "/src1.jpg", viewType: "FRONT", canonical: false, processingStatus: "NEEDS_REVIEW", reviewStatus: "PENDING", qualityScore: 0.42, reasons: ["HUMANO"],
  crop: { aspect: "4:5" }, assets: { card: "/card1.png" },
  metrics: { segmentationConfidence: 0.9, focusScore: 0.5, cropScore: "x", debug: { bbox: R, focus: R, finalCrop: R, critical: [{ name: "gola", rect: R }], distractors: [R], candidates: [{ crop: R, score: 1 }, { crop: R, score: 0.5 }] } } };
const CROPPED = { id: "i2", productId: "p2", sourceUrl: "/src2.jpg", canonical: false, processingStatus: "CROPPED", reviewStatus: "PENDING", reasons: [], crop: { crop: R, background: "#fff", aspect: "1:1" } };
const BARE = { id: "i3", productId: "p3", sourceUrl: "/src3.jpg", canonical: false, processingStatus: "FAILED", reviewStatus: "PENDING", reasons: [], qualityScore: null, metrics: null };
const base = { "GET /api/admin/catalog-images/metrics": METRICS, "GET /api/admin/catalog-images/review": { items: [PROCESSED, CROPPED, BARE], pending: 3 } };
const card = (status: string) => screen.getByText(status).closest("li")!;

describe("admin · fotos do catálogo", () => {
  it("painel com versão, status, canônicas, fila, qualidade média e motivos", async () => {
    loggedAs(ADMIN, base);
    renderApp(<CatalogImagesPage />);
    const painel = await screen.findByRole("region", { name: "Painel de qualidade" }, { timeout: 4000 });
    expect(within(painel).getByText("v3 · processamento ligado")).toBeTruthy();
    expect(within(painel).getByText("READY: 10")).toBeTruthy();
    expect(within(painel).getByText("8 canônicas")).toBeTruthy();
    expect(within(painel).getByText("3 na fila")).toBeTruthy();
    expect(within(painel).getByText("qualidade 82%")).toBeTruthy();
    expect(within(painel).getByText("Motivos mais comuns: HUMANO (4) · BORRADA (1)")).toBeTruthy();
  });

  it("cartões: card processado, recorte semântico ou sem recorte; métricas numéricas e caixas de depuração", async () => {
    loggedAs(ADMIN, base);
    renderApp(<CatalogImagesPage />);
    expect(await screen.findByText("NEEDS_REVIEW", undefined, { timeout: 4000 })).toBeTruthy();
    const c1 = card("NEEDS_REVIEW");
    expect(within(c1).getByText("FRONT")).toBeTruthy();
    expect(within(c1).getByText("qualidade 42%")).toBeTruthy();
    expect(within(c1).getByText("PROCESSED /card1.png")).toBeTruthy();
    expect(within(c1).getByText("segmentationConfidence")).toBeTruthy();
    expect(within(c1).getByText("90%")).toBeTruthy();
    expect(within(c1).queryByText("cropScore")).toBeNull();
    // 1 candidato extra + bbox + distrator + crítica + foco + recorte final
    expect(c1.querySelectorAll("svg rect")).toHaveLength(6);
    expect(within(card("CROPPED")).getByText("SEMANTIC_CROP /src2.jpg")).toBeTruthy();
    const c3 = card("FAILED");
    expect(within(c3).getByText("Sem recorte")).toBeTruthy();
    expect(c3.querySelectorAll("svg rect")).toHaveLength(0);
    expect(within(c3).queryByText(/^qualidade/)).toBeNull();
  });

  it("aprovar, reprocessar e rejeitar mandam a ação; erro avisa", async () => {
    const { calls } = loggedAs(ADMIN, { ...base, "POST /api/admin/catalog-images/i1/review": {}, "POST /api/admin/catalog-images/i2/review": fail(409, "Já revisada") });
    renderApp(<CatalogImagesPage />);
    await screen.findByText("NEEDS_REVIEW", undefined, { timeout: 4000 });
    fireEvent.click(within(card("NEEDS_REVIEW")).getByRole("button", { name: "Aprovar" }));
    expect(await screen.findByText("Decisão registrada")).toBeTruthy();
    fireEvent.click(within(await waitFor(() => card("NEEDS_REVIEW"))).getByRole("button", { name: "Reprocessar" }));
    fireEvent.click(within(card("NEEDS_REVIEW")).getByRole("button", { name: "Rejeitar" }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/admin/catalog-images/i1/review").map((c) => (c.body as { action: string }).action)).toEqual(["APPROVE", "REPROCESS", "REJECT"]));
    fireEvent.click(within(card("CROPPED")).getByRole("button", { name: "Aprovar" }));
    expect(await screen.findByText("Já revisada")).toBeTruthy();
  });

  it("escolher outra foto: lista as alternativas sem a atual e seleciona; sem alternativas avisa; erro ao carregar avisa", async () => {
    const { calls } = loggedAs(ADMIN, { ...base,
      "GET /api/catalog/products/p1": { id: "p1", images: [{ id: "i1", url: "/i1.jpg" }, { id: "a1", url: "/a1.jpg", processedUrl: "/a1p.png", viewType: "BACK", processingStatus: "READY" }, { id: "a2", url: "/a2.jpg", type: "DETAIL" }] },
      "GET /api/catalog/products/p2": { id: "p2" }, "GET /api/catalog/products/p3": fail(404, "Produto sumiu"),
      "POST /api/admin/catalog-images/i1/review": {} });
    renderApp(<CatalogImagesPage />);
    await screen.findByText("NEEDS_REVIEW", undefined, { timeout: 4000 });
    fireEvent.click(within(card("NEEDS_REVIEW")).getByRole("button", { name: "Escolher outra foto oficial" }));
    expect(await screen.findByText("BACK · READY")).toBeTruthy();
    expect(screen.getByText("DETAIL · —")).toBeTruthy();
    expect(screen.getByText("fallback /a1p.png")).toBeTruthy();
    expect(screen.getByText("fallback /a2.jpg")).toBeTruthy();
    fireEvent.click(within(card("CROPPED")).getByRole("button", { name: "Escolher outra foto oficial" }));
    expect(await screen.findByText("Este produto não tem outra foto oficial.")).toBeTruthy();
    fireEvent.click(within(card("FAILED")).getByRole("button", { name: "Escolher outra foto oficial" }));
    expect(await screen.findByText("Produto sumiu")).toBeTruthy();
    fireEvent.click(screen.getByText("BACK · READY").closest("button")!);
    await waitFor(() => expect(calls.find((c) => c.path === "/api/admin/catalog-images/i1/review")?.body).toEqual({ action: "SELECT_ALTERNATE_IMAGE", alternateImageId: "a1" }));
  });

  it("fila vazia e painel sem qualidade média nem motivos, com processamento desligado", async () => {
    loggedAs(ADMIN, { "GET /api/admin/catalog-images/metrics": { ...METRICS, enabled: false, averageQuality: null, topRejectionReasons: [] }, "GET /api/admin/catalog-images/review": { items: [], pending: 0 } });
    renderApp(<CatalogImagesPage />);
    expect(await screen.findByText("Nenhuma foto aguardando revisão", undefined, { timeout: 4000 })).toBeTruthy();
    expect(await screen.findByText(/processamento desligado/)).toBeTruthy();
    expect(screen.queryByText(/^qualidade/)).toBeNull();
    expect(screen.queryByText(/Motivos mais comuns/)).toBeNull();
  });
});

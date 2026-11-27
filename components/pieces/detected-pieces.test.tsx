// @vitest-environment jsdom
/**
 * Leitura local sem tipo: a forma do recorte vira uma sugestão rotulada, que a pessoa confirma ("Usar como …");
 * "Usar esta peça" continua sem tipo (auditoria 10: "o tipo nunca é sugerido").
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";

vi.mock("@/lib/pieces/type-suggestion", () => ({ suggestCategoryFromImage: vi.fn(async () => "lower_piece") }));
vi.mock("@/components/pieces/detected-piece", async (orig) => ({
  ...(await orig<typeof import("@/components/pieces/detected-piece")>()),
  cropBox: vi.fn(async (f: File) => f),
}));

import { DetectedPieces, type PhotoItem, type PhotoPick } from "./detected-pieces";

afterEach(cleanup);

const file = new File(["x"], "jeans.jpg", { type: "image/jpeg" });
const item = (): PhotoItem => ({ id: "f1", file, preview: "blob:x", status: "ready",
  detection: { draftId: "d1", source: "local", pieces: [{ index: 0, box: { x: 10, y: 5, width: 50, height: 90 }, confidence: 0.45, color: "blue" }] } as unknown as PhotoItem["detection"] });

describe("DetectedPieces · sugestão de tipo da leitura local", () => {
  it("mostra a sugestão pela forma e só preenche o tipo quando a pessoa confirma", async () => {
    loggedAs(undefined, { "GET /api/wardrobe/taxonomy": { subcategories: { lower_piece: ["jeans"], upper_piece: ["t_shirt"] }, colors: { blue: "#1f4fa0" }, occasions: ["casual"], styles: ["basic"] } });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:crop");
    const picks: PhotoPick[] = [];
    renderApp(<DetectedPieces items={[item()]} onPick={(p) => picks.push(p)} picked={null} savedKeys={[]} />);
    expect((await screen.findByTestId("type-suggestion")).textContent).toContain("Pela forma do recorte, parece Parte inferior");
    fireEvent.click(screen.getByRole("button", { name: "Usar esta peça" }));
    await waitFor(() => expect(picks).toHaveLength(1));
    expect(picks[0].value.category).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Usar como Parte inferior" }));
    await waitFor(() => expect(picks).toHaveLength(2));
    expect(picks[1].value).toMatchObject({ category: "lower_piece", subcategory: "", material: "", occasion: [], style: [] });
  });
});

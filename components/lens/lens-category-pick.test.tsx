// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import type { LensDetectionView, LensScanView } from "@/lib/lens/types";
import { LensResult } from "@/components/lens/lens-result";

const det = (over: Partial<LensDetectionView>): LensDetectionView => ({
  id: "d1", ordinal: 1, box: { x: 20, y: 10, w: 40, h: 35 }, label: "Peça", category: null, subcategory: null,
  colors: [{ name: "blue", hex: "#1f4fa0", share: 1 }], material: null, pattern: "solid", styles: [], occasions: [],
  confidence: 0.3, confidenceBand: "LOW", status: "DETECTED", wanted: false, ownedItemId: null, topMatch: null, ...over,
});
const scan = (detections: LensDetectionView[]): LensScanView => ({
  id: "s1", status: "READY", errorCode: null, source: "GALLERY", intent: "IDENTIFY", createdAt: new Date().toISOString(),
  expiresAt: null, savedAt: new Date().toISOString(), width: 800, height: 1000, facesRedacted: 0,
  aiSource: "local", algorithmVersion: "LENS_V1", modelVersion: "test", detections, reading: null,
});
const TAXONOMY = { subcategories: {}, colors: { blue: "#1f4fa0" }, materials: [], sizes: [], sexes: [], occasions: [], styles: [], allowedOccasionsByCategory: {} };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Lens › peça sem tipo lido", () => {
  it("o cartão pergunta o tipo; escolher grava a correção e o seletor some", async () => {
    const api = loggedAs(undefined, {
      "GET /api/taxonomy": TAXONOMY,
      "GET /api/lens/scans/s1": scan([det({})]),
      "PATCH /api/lens/scans/s1/detections/d1": det({ label: "Parte de baixo", category: "lower_piece", status: "CORRECTED" }),
    });
    renderApp(<LensResult scanId="s1" />);
    const group = await screen.findByRole("group", { name: "Que tipo de peça é esta?" });
    expect(within(group).getAllByRole("button")).toHaveLength(5);
    fireEvent.click(within(group).getByRole("button", { name: /Parte inferior|Parte de baixo/ }));
    await waitFor(() => expect(api.calls.find((c) => c.method === "PATCH")?.body).toEqual({ category: "lower_piece" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "Que tipo de peça é esta?" })).toBeNull());
  });

  it("peça com tipo lido não mostra o seletor", async () => {
    loggedAs(undefined, { "GET /api/taxonomy": TAXONOMY, "GET /api/lens/scans/s1": scan([det({ label: "Calça", category: "lower_piece" })]) });
    renderApp(<LensResult scanId="s1" />);
    await screen.findByRole("article", { name: /^Peça 1 de 1/ });
    expect(screen.queryByRole("group", { name: "Que tipo de peça é esta?" })).toBeNull();
  });
});

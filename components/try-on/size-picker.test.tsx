// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";
import { SizePicker } from "./size-picker";
import { GRIDS } from "@/lib/tryon/sizes";
import { validateSavedSizes } from "@/lib/tryon/saved-size-check";

const options = { grid: "letter", sizes: [{ label: "M", source: "STORE", availability: "AVAILABLE", measurements: [], ownerDeclared: false, representation: "VISUAL_APPROXIMATION" }, { label: "G", source: "STORE", availability: "UNAVAILABLE", measurements: [], ownerDeclared: false, representation: "VISUAL_APPROXIMATION" }, { label: "XG", source: "GRID", availability: "UNKNOWN", measurements: [], ownerDeclared: false, representation: "NONE" }],
  representation3d: { kind: "SHOWCASE_GLB", approvedForTryOn: false, quarantine: null, origin: "GENERATED_FROM_PHOTO", reviewStatus: "UNREVIEWED_SHOWCASE", provenance: "ESTIMATED", sizeVariants: "RELATIVE_VISUAL_APPROXIMATION" }, availabilityKnown: true, measurementsKnown: false, visualApproximationNote: "SIZES_ON_3D_ARE_RELATIVE_VISUAL_APPROXIMATIONS", avatarMeasurementsChanged: false, fitClaim: "NONE" };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("size selection and representation", () => {
  it("blocks unavailable sizes, flags approximations and says when a size has no 3D representation", async () => {
    loggedAs(undefined, { "GET /api/catalog/products/p1/size-options": options });
    const onPick = vi.fn();
    const { rerender } = renderApp(<SizePicker grid="letter" options={GRIDS.letter} chosen="M" natural="M" productId="p1" label="Tamanho" onPick={onPick} />);
    await screen.findByText(/Tamanho M no 3D é uma aproximação visual relativa/);
    const g = screen.getByRole("radio", { name: /^G \(L\) — indisponível na loja/ }) as HTMLButtonElement;
    expect(g.disabled).toBe(true);
    fireEvent.click(g);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: /^PP/ }));
    expect(onPick).toHaveBeenCalledWith("PP");
    expect(screen.getByText(/não altera as medidas do seu avatar/)).toBeTruthy();
    rerender(<SizePicker grid="letter" options={GRIDS.letter} chosen="XG" natural="M" productId="p1" label="Tamanho" onPick={onPick} />);
    await screen.findByText(/O tamanho XG não tem representação 3D; nenhum outro tamanho é mostrado como equivalente/);
  });

  it("keeps saved sizes and clears the ones that became unavailable on restore", async () => {
    const items = [{ key: "c:p1", source: "catalog", slot: "upper_piece", wear: "TOP", name: "Jaqueta", brand: null, category: "upper_piece", productId: "p1", size: "G", addedAt: 1 }, { key: "c:p2", source: "catalog", slot: "lower_piece", wear: "BOTTOM", name: "Calça", brand: null, category: "lower_piece", productId: "p2", size: "40", addedAt: 2 }] as never[];
    const result = await validateSavedSizes(items, async (id) => id === "p1" ? options as never : { ...options, sizes: [{ label: "40", availability: "AVAILABLE" }] } as never);
    expect(result.items[0]).toMatchObject({ size: null });
    expect(result.items[1]).toMatchObject({ size: "40" });
    expect(result.unavailable).toEqual([{ name: "Jaqueta", size: "G" }]);
  });
});

// @vitest-environment jsdom
/**
 * RF — editor 3D da peça, critérios 2 e 3: a câmera tem as vistas de frente, costas e laterais, e os controles de
 * edição aparecem só para o que o modelo suporta (e desligados para quem só pode ver).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import type { Customization } from "@/lib/piece3d/customization";
import { PieceEditorToolbar } from "./piece-editor-toolbar";

const info = (extra: Partial<Customization> = {}): Customization => ({
  pieceId: "p1",
  baseModelUrl: "/media/jaqueta.glb",
  modelAvailable: true,
  editable: true,
  viewOnly: false,
  assetApproval: "APPROVED",
  quarantine: false,
  tryOnApproved: true,
  supports: { camera: true, materials: true, transforms: true, undoRedo: true, vertices: true },
  document: { nodes: {}, materials: {}, vertices: {} },
  revision: 1,
  savedAt: null,
  baseChanged: false,
  scaleIsVisualOnly: true,
  affectsOfficialMeasurements: false,
  affectsPassport: false,
  fitClaim: "NONE",
  ...extra,
});

function montar(dados: Customization) {
  const onView = vi.fn();
  renderApp(<PieceEditorToolbar info={dados} tool="translate" view="perspective" canUndo canRedo dirty busy={false} onTool={vi.fn()} onView={onView}
    onFit={vi.fn()} onUndo={vi.fn()} onRedo={vi.fn()} onRestore={vi.fn()} onSave={vi.fn()} />);
  return { onView };
}

afterEach(() => {
  cleanup();
});

describe("barra do editor 3D da peça", () => {
  it("oferece as vistas de frente, costas e laterais", () => {
    const { onView } = montar(info());
    fireEvent.click(screen.getByRole("button", { name: "Vista da câmera: Perspectiva" }));
    const vistas = screen.getAllByRole("option").map((o) => o.textContent);
    expect(vistas).toHaveLength(6);
    expect(vistas).toEqual(expect.arrayContaining(["Frente", "Costas", "Lado esquerdo", "Lado direito"]));
    fireEvent.click(screen.getByRole("option", { name: "Costas" }));
    expect(onView).toHaveBeenCalledWith("back");
  });

  it("mostra mover, girar, escala, desfazer e refazer só quando o modelo suporta", () => {
    montar(info({ supports: { camera: true, materials: true, transforms: false, undoRedo: false, vertices: false } }));
    expect(screen.queryByRole("button", { name: "Desfazer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Refazer" })).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).not.toEqual(expect.arrayContaining(["Mover (G)"]));
    cleanup();
    montar(info());
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refazer" })).toBeTruthy();
  });

  it("para quem só pode ver, edição e salvar ficam desligados", () => {
    montar(info({ editable: false, viewOnly: true }));
    expect((screen.getByRole("button", { name: "Desfazer" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Restaurar original" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderApp } from "@/test-utils/render";
import { triangle } from "@/test-utils/glb-fixture";
import { disposeAsset, EMPTY_DOCUMENT, loadGlb } from "@/lib/atelier3d/document";
import { SceneInspector } from "./scene-inspector";
import type { Inspection } from "@/lib/atelier3d/document";

afterEach(cleanup);

const inspection: Inspection = {
  nodes: 1, meshes: 1, materials: 1, vertices: 3,
  skinned: false, morphs: false, animated: false,
  primitives: { "n0.p0": 3 }, extensions: [],
};

it("keeps controls disabled for a viewer and rejects invalid scale and texture values", async () => {
  const loaded = await loadGlb(triangle());
  const onChange = vi.fn();
  const props = { loaded, document: EMPTY_DOCUMENT, selected: "n0", inspection,
    vertex: 0, onVertexChange: vi.fn(), onChange };
  try {
    const { rerender } = renderApp(<SceneInspector {...props} editable={false} />);
    expect(screen.getByLabelText("Posição — unidades do arquivo X").matches(":disabled")).toBe(true);
    expect(screen.getByLabelText("Cor", { exact: true }).matches(":disabled")).toBe(true);
    rerender(<SceneInspector {...props} editable />);
    const scale = screen.getByLabelText("Escala X");
    fireEvent.change(scale, { target: { value: "-1" } });
    fireEvent.change(screen.getByLabelText("Repetição da textura", { exact: true }), { target: { value: "101" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(scale, { target: { value: "2" } });
    expect(onChange.mock.calls[0][0].nodes.n0.scale).toEqual([2, 1, 1]);
    expect(loaded.baseline.nodes.n0.scale).toEqual([1, 1, 1]);
  } finally {
    cleanup();
    disposeAsset(loaded);
  }
});

it.each(["skinned", "morphs", "animated"] as const)(
  "keeps vertex editing unavailable for %s assets while retaining material controls",
  async (flag) => {
    const loaded = await loadGlb(triangle());
    try {
      renderApp(<SceneInspector loaded={loaded} document={EMPTY_DOCUMENT} selected="n0"
        inspection={{ ...inspection, [flag]: true }} editable vertex={0}
        onVertexChange={vi.fn()} onChange={vi.fn()} />);
      expect(screen.getByText(/A edição de vértices está bloqueada/)).toBeTruthy();
      expect(screen.queryByLabelText("Posição do vértice X")).toBeNull();
      expect(screen.getByLabelText("Cor", { exact: true }).matches(":disabled")).toBe(false);
    } finally {
      cleanup();
      disposeAsset(loaded);
    }
  },
);

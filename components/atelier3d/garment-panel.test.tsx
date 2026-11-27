// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderApp } from "@/test-utils/render";
import { engineGarmentGlb, photoReliefGlb } from "@/test-utils/garment-fixture";
import { EMPTY_DOCUMENT, loadGlb, type SceneDocument } from "@/lib/atelier3d/document";
import { listParts } from "@/lib/atelier3d/garment-parts";
import { setDecalImageLoader } from "@/lib/atelier3d/decal-meshes";
import { listDecals } from "@/lib/atelier3d/decals";
import { SceneInspector } from "./scene-inspector";

vi.mock("@/lib/atelier3d/decal-image", () => ({
  readDecalImage: vi.fn(async () => ({ dataUrl: "data:image/png;base64,iVBORw0KGgo=", aspect: 0.5 })),
}));
afterEach(cleanup);
let bytes: ArrayBuffer;
beforeAll(async () => {
  bytes = await engineGarmentGlb();
  setDecalImageLoader(async () => ({ width: 4, height: 4 }) as unknown as HTMLImageElement);
});

async function open(document: SceneDocument = EMPTY_DOCUMENT, editable = true) {
  const loaded = await loadGlb(bytes), onChange = vi.fn();
  renderApp(<SceneInspector loaded={loaded} document={document} selected="n0" editable={editable} vertex={0} onVertexChange={vi.fn()} onChange={onChange} />);
  const key = (role: string) => listParts(loaded).find((part) => part.materialName === role)!.key;
  const last = () => onChange.mock.calls.at(-1)![0] as SceneDocument;
  return { loaded, onChange, key, last };
}

describe("painel da peça com GLB próprio", () => {
  it("mostra as partes em português e muda a cor da costura, do zíper e dos botões, cada uma na sua", async () => {
    const { key, last } = await open();
    expect(screen.getByTestId("garment-panel")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Cor: Costura (linha)"), { target: { value: "#ff0000" } });
    expect(last().materials[key("linha")].color).toBe("#ff0000");
    fireEvent.change(screen.getByLabelText("Cor: Zíper (dentes)"), { target: { value: "#00ff00" } });
    expect(last().materials[key("dentes")].color).toBe("#00ff00");
    fireEvent.change(screen.getByLabelText("Cor: Botões"), { target: { value: "#0000ff" } });
    expect(last().materials[key("botao")].color).toBe("#0000ff");
    fireEvent.change(screen.getByLabelText("Cor: Faixa da barra"), { target: { value: "#333333" } });
    expect(last().materials[key("faixa_barra")].color).toBe("#333333");
    fireEvent.click(screen.getByLabelText("Ocultar Zíper (dentes)"));
    expect(last().materials[key("dentes")].hidden).toBe(true);
    expect(screen.getByTestId("technical-fields").tagName).toBe("DETAILS");
  });

  it("tamanho, barra e logo novo viram edições do documento", async () => {
    const { last } = await open();
    fireEvent.change(screen.getByLabelText("Tamanho geral (%)"), { target: { value: "110" } });
    expect(last().nodes.n0.scale.map((v) => +v.toFixed(3))).toEqual([1.1, 1.1, 1.1]);
    fireEvent.change(screen.getByLabelText("Comprimento (%)"), { target: { value: "120" } });
    expect(last().nodes.n0.scale[1]).toBeCloseTo(1.2);
    fireEvent.click(screen.getByRole("button", { name: "Alongar barra (+2 cm)" }));
    expect(Object.keys(last().vertices).length).toBeGreaterThan(0);
    const file = new File([new Uint8Array([1])], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Adicionar logo (imagem)"), { target: { files: [file] } });
    await waitFor(() => expect(last().decals?.d1?.image).toMatch(/^data:image\/png/));
    expect(last().decals!.d1.aspect).toBe(0.5);
  });

  it("move, escala, gira e recolore a estampa do arquivo", async () => {
    const { last, key } = await open();
    expect(screen.getByLabelText("Desenho em edição").textContent).toContain("Estampa 1");
    fireEvent.click(screen.getByRole("button", { name: "Subir" }));
    await waitFor(() => expect(last().decals?.[key("estampa_0")]?.target).toBe(key("estampa_0")));
    fireEvent.change(screen.getByLabelText("Largura (cm)"), { target: { value: "8" } });
    await waitFor(() => expect(last().decals![key("estampa_0")].size).toBeCloseTo(0.08));
    fireEvent.change(screen.getByLabelText("Giro (graus)"), { target: { value: "45" } });
    await waitFor(() => expect(last().decals![key("estampa_0")].rotation).toBeCloseTo(Math.PI / 4));
    fireEvent.change(screen.getByLabelText("Cor do desenho"), { target: { value: "#ff8800" } });
    await waitFor(() => expect(last().decals![key("estampa_0")].color).toBe("#ff8800"));
  });

  it("cliques seguidos antes de redesenhar acumulam (três passos de 1 cm, não um)", async () => {
    const { last, key, onChange, loaded } = await open();
    const start = listDecals(loaded, EMPTY_DOCUMENT)[0].edit.position[1];
    const up = screen.getByRole("button", { name: "Subir" });
    fireEvent.click(up);
    fireEvent.click(up);
    fireEvent.click(up);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(3));
    expect(last().decals![key("estampa_0")].position[1] - start).toBeCloseTo(0.03, 2);
  });

  it("quem só vê não edita; relevo da foto não mostra o painel e avisa", async () => {
    await open(EMPTY_DOCUMENT, false);
    expect(screen.getByLabelText("Cor: Costura (linha)").matches(":disabled")).toBe(true);
    cleanup();
    const relief = await loadGlb(await photoReliefGlb());
    renderApp(<SceneInspector loaded={relief} document={EMPTY_DOCUMENT} selected="n0" editable vertex={0} onVertexChange={vi.fn()} onChange={vi.fn()} />);
    expect(screen.queryByTestId("garment-panel")).toBeNull();
    expect(screen.getByTestId("photo-relief-notice").textContent).toMatch(/relevo gerado de uma foto/);
    expect(screen.getByLabelText("Posição — unidades do arquivo X").matches(":disabled")).toBe(true);
  });
});

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderApp } from "@/test-utils/render";
import { createGarmentTemplate } from "@/lib/atelier3d/garment-template";
import { EMPTY_DOCUMENT, loadGlb, type LoadedAsset, type SceneDocument } from "@/lib/atelier3d/document";
import { garmentOf } from "@/lib/atelier3d/garment/state";
import { useGarmentStudio } from "./use-garment-studio";
import { GarmentStudioPanel } from "./garment-studio";

let asset: LoadedAsset;
const docs: SceneDocument[] = [];
beforeAll(async () => {
  asset = await loadGlb(await createGarmentTemplate("tee", "#2867ad"));
});
afterEach(() => {
  cleanup();
  docs.length = 0;
});

function Harness({ selected = "n1" }: { selected?: string }) {
  const [doc, setDoc] = useState<SceneDocument>(EMPTY_DOCUMENT);
  const studio = useGarmentStudio(asset, doc, selected, (next) => {
    docs.push(next);
    setDoc(next);
  });
  return <GarmentStudioPanel studio={studio} asset={asset} doc={doc} editable />;
}

describe("Ateliê da peça › material", () => {
  it("aplica o preset na peça inteira e mostra os ajustes do tecido", () => {
    renderApp(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Jeans" }));
    expect(docs).toHaveLength(1);
    const fabrics = garmentOf(docs[0]).fabrics;
    expect(Object.keys(fabrics)).toHaveLength(asset.primitives.size);
    expect(docs[0].materials[Object.keys(fabrics)[0]].color).toBe("#3b5a86");
    expect(screen.getByRole("button", { name: "Jeans" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("slider", { name: /Repetições da trama/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Malha" }));
    expect(garmentOf(docs[1]).fabrics[Object.keys(fabrics)[0]].weave).toBe("knit");
    fireEvent.click(screen.getByRole("button", { name: "Remover tecido" }));
    expect(docs[2].garment).toBeUndefined();
  });

  it("com escopo na parte, só a parte selecionada recebe o tecido e a cor pode ser mantida", () => {
    renderApp(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Parte selecionada" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Manter a cor atual" }));
    fireEvent.click(screen.getByRole("button", { name: "Veludo" }));
    const keys = Object.keys(garmentOf(docs[0]).fabrics);
    expect(keys).toEqual(["n1.p0"]);
    expect(docs[0].materials["n1.p0"].color).toBe(asset.baseline.materials["n1.p0"].color);
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { engineGarmentGlb, photoReliefGlb } from "@/test-utils/garment-fixture";
import { triangle } from "@/test-utils/glb-fixture";
import { loadGlb } from "@/lib/atelier3d/document";
import { editBlock } from "./edit-block";

describe("só peça com GLB próprio é editável", () => {
  it("GLB do motor de peças: pode editar", async () => {
    expect(editBlock({ editBlockedReason: null }, await loadGlb(await engineGarmentGlb()))).toBeNull();
  });

  it("relevo da foto e GLB sem partes de peça: bloqueados pelo próprio arquivo, mesmo com servidor antigo", async () => {
    expect(editBlock({}, await loadGlb(await photoReliefGlb()))).toBe("CUSTOMIZATION_PHOTO_RELIEF");
    expect(editBlock({}, await loadGlb(triangle()))).toBe("CUSTOMIZATION_NOT_OWN_MODEL");
  });

  it("o motivo do servidor vale antes do arquivo carregar e prevalece depois", async () => {
    expect(editBlock({ editBlockedReason: "CUSTOMIZATION_PHOTO_RELIEF" }, null)).toBe("CUSTOMIZATION_PHOTO_RELIEF");
    expect(editBlock({ editBlockedReason: "CUSTOMIZATION_NOT_OWN_MODEL" }, await loadGlb(await engineGarmentGlb()))).toBe("CUSTOMIZATION_NOT_OWN_MODEL");
    expect(editBlock({}, null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SPECS, armOutFor, garmentMaterial, kindOf, specOf } from "./garments";

describe("tipo de molde pela subcategoria (kindOf) — subcategorias livres, fora da tabela oficial", () => {
  it.each([
    ["legging_termica", "leggings"], ["short_saia_jeans", "skirt"], ["saia_midi", "skirt"], ["bermuda_sarja", "bermuda"],
    ["short_curto", "shorts"], ["pantacourt_linho", "culottes"], ["calca_reta", "pants"], ["vestido_longo", "dress"],
    ["macaquinho_floral", "romper"], ["jardineira_sarja", "jumpsuit"], ["coturno_preto", "boots"], ["tenis_corrida", "shoes"],
    ["trench_bege", "coat"], ["colete_alfaiataria", "vest"], ["jaqueta_couro", "jacket"], ["capuz_fleece", "hoodie"],
    ["moletom_basico", "sweater"], ["regata_nadador", "tank"], ["body", "tank"], ["cropped", "crop"], ["polo_piquet", "tee"],
    ["camisa_social", "shirt"], ["camiseta_shirt", "tee"], ["manga_longa_basica", "longsleeve"], ["tee_oversized", "tee"],
  ])("%s → %s", (sub, kind) => {
    expect(kindOf({ subcategory: sub })).toBe(kind);
  });

  it("bolsas são acessórios, inclusive 'crossbody_bag'; 'baggy' não é bolsa", () => {
    expect(kindOf({ subcategory: "crossbody_bag" })).toBeNull();
    expect(kindOf({ subcategory: "mochila_escolar" })).toBeNull();
    expect(kindOf({ subcategory: "calca_baggy" })).toBe("pants");
  });

  it("subcategoria desconhecida: camada externa do look, depois a categoria, depois o lugar no look", () => {
    expect(kindOf({ subcategory: "xyz", slot: "outerwear", category: "LOWER_PIECE" })).toBe("jacket");
    expect(kindOf({ category: "outer_layer_piece" })).toBe("jacket");
    expect(kindOf({ category: "FULL_BODY_PIECE" })).toBe("dress");
    expect(kindOf({ category: "upper_piece" })).toBe("tee");
    expect(kindOf({ category: "PARTE_INFERIOR" })).toBe("pants");
    expect(kindOf({ category: "FOOTWEAR" })).toBe("shoes");
    expect(kindOf({ category: "ACESSORIO", slot: "LOWER" })).toBe("pants");
    expect(kindOf({ category: null, subcategory: null, slot: null })).toBeNull();
  });
});

describe("especificação do molde (specOf)", () => {
  it("blusa sem carcela; polo com carcela curta; top como regata curta; jardineira com decote em V", () => {
    expect(specOf({ subcategory: "blouse" })).toMatchObject({ kind: "shirt", placket: false });
    expect(specOf({ subcategory: "polo_shirt" })).toMatchObject({ kind: "shirt", sleeve: 0.33, placketLength: 0.16 });
    expect(specOf({ subcategory: "top" })).toMatchObject({ kind: "tank", hem: 0.45 });
    expect(specOf({ subcategory: "overalls" })).toMatchObject({ kind: "jumpsuit", neck: 1.03, vneck: 0.3 });
  });

  it("calça cargo: justa por padrão, solta quando o nome diz", () => {
    expect(specOf({ subcategory: "cargo_pants" })).toMatchObject({ construction: "cargo", ease: 0.019, flare: 0.032 });
    expect(specOf({ subcategory: "cargo_pants", name: "Cargo Wide" })).toMatchObject({ construction: "cargo", ease: 0.026, flare: 0.045 });
  });

  it("blazer mais justo e caído; manga longa pelo nome; acessório sem molde", () => {
    expect(specOf({ subcategory: "blazer" })).toMatchObject({ kind: "jacket", ease: 0.01, drape: 0.5 });
    expect(specOf({ subcategory: "t_shirt", name: "Camiseta manga longa" })!.sleeve).toBe(0.96);
    const jeans = specOf({ subcategory: "jeans", name: "long sleeve?" })!;   // peça de baixo: perfil próprio, sem manga longa
    expect(jeans).toMatchObject({ kind: "pants" });
    expect(jeans.sleeve).toBe(SPECS.pants.sleeve);
    expect(specOf({ subcategory: "tote_bag" })).toBeNull();
  });

  it("afastamento dos braços: saia rodada abre a 15°, camadas grossas até 22°", () => {
    expect(armOutFor([])).toBe(10);
    expect(armOutFor([SPECS.skirt])).toBe(15);
    expect(armOutFor([SPECS.coat, SPECS.sweater, SPECS.tee])).toBeGreaterThan(armOutFor([SPECS.tee]));
    expect(armOutFor([SPECS.coat, SPECS.sweater, SPECS.tee])).toBeLessThanOrEqual(22);
  });
});

describe("material da roupa", () => {
  const tex = new THREE.Texture();
  it("aspereza e brilho de tecido por construção e tipo; camada vira deslocamento de polígono", () => {
    const cargo = garmentMaterial(tex, specOf({ subcategory: "cargo_pants" })!);
    expect(cargo.roughness).toBeCloseTo(0.94); expect(cargo.sheen).toBeCloseTo(0.08);
    const jacket = garmentMaterial(tex, SPECS.jacket);
    expect(jacket.roughness).toBeCloseTo(0.7); expect(jacket.sheen).toBeCloseTo(0.15);
    const coat = garmentMaterial(tex, SPECS.coat);
    expect(coat.roughness).toBeCloseTo(0.7);
    const tee = garmentMaterial(tex, SPECS.tee);
    expect(tee.roughness).toBeCloseTo(0.85); expect(tee.sheen).toBeCloseTo(0.35);
    expect(tee.name).toBe("roupa-tee");
    expect(tee.polygonOffsetFactor).toBe(-SPECS.tee.layer);
    expect(tee.alphaTest).toBe(0.5);
  });

  it("o shader mistura tecido e foto pelo peso e tem chave de cache própria", () => {
    const m = garmentMaterial(tex, SPECS.tee);
    const shader = { vertexShader: "#include <common>\n#include <begin_vertex>", fragmentShader: "#include <common>\n#include <map_fragment>" } as THREE.WebGLProgramParametersWithUniforms;
    m.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain("attribute float photoWeight");
    expect(shader.vertexShader).toContain("vGarmentFabricUv = fabricUv");
    expect(shader.fragmentShader).toContain("mix(garmentFabric, garmentPhoto");
    expect(shader.fragmentShader).not.toContain("#include <map_fragment>");
    expect(m.customProgramCacheKey()).toBe("garment-fabric-blend-v2-plain");
  });
});

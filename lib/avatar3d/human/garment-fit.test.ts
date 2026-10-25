import { describe, expect, it } from "vitest";
import { fitClassOf, necklineOf, riseOf, sleeveLengthOf, specFor } from "./garment-fit";

describe("decote da peça: dimensão NECKLINE ou o nome (o catálogo não traz atributos)", () => {
  const tee = (name: string, attributes: Record<string, string[]> | null = null) => ({ name, category: "upper_piece", subcategory: "t_shirt", attributes });
  it("lê o nome em português e inglês; sem pista, não inventa", () => {
    expect(necklineOf(tee("T-Shirt De Malha Decote V Turquesa"))).toBe("V_NECK");
    expect(necklineOf(tee("Camiseta V-Neck Básica"))).toBe("V_NECK");
    expect(necklineOf(tee("Regata Canelada Com Decote"))).toBe("SCOOP");
    expect(necklineOf(tee("Blusa Gola Alta Preta"))).toBe("TURTLENECK");
    expect(necklineOf(tee("Top Ombro a Ombro"))).toBe("OFF_SHOULDER");
    expect(necklineOf(tee("T-Shirt Cropped Loc Vidro"))).toBeNull();
  });
  it("a dimensão NECKLINE vale mais que o nome", () => {
    expect(necklineOf(tee("Camiseta decote V", { NECKLINE: ["CREW"] }))).toBe("CREW");
  });
  it("entra no molde: V mais fundo e em ponta; gola alta sobe; a calça não tem decote", () => {
    const base = specFor(tee("Camiseta"))!, v = specFor(tee("T-Shirt De Malha Decote V Turquesa"))!, alta = specFor(tee("Blusa Gola Alta"))!;
    expect(v.neckShape).toBe("v"); expect(v.vneck).toBeGreaterThan(base.vneck + 0.1);
    expect(alta.neck).toBeGreaterThan(base.neck); expect(alta.vneck).toBeLessThan(base.vneck);
    expect(specFor({ name: "Calça decote V", category: "lower_piece", subcategory: "jeans" })!.neckShape).toBeUndefined();
  });
});


describe("tamanho escolhido × corpo do avatar (lib/tryon/sizes.ts)", () => {
  it("maior que o corpo: mais folga, barra e manga mais longas; menor: aperta até o mínimo", () => {
    const tee = { category: "upper_piece", subcategory: "t_shirt" };
    const base = specFor(tee)!, big = specFor({ ...tee, sizeSteps: 2 })!, small = specFor({ ...tee, sizeSteps: -3 })!;
    expect(big.ease - base.ease).toBeCloseTo(2 * 0.06 / (2 * Math.PI), 4);           // 6 cm de perímetro por tamanho
    expect(big.hem).toBeLessThan(base.hem); expect(big.sleeve).toBeGreaterThan(base.sleeve); expect(big.sizeSteps).toBe(2);
    expect(small.ease).toBe(0.0015);                                                    // não fecha: cola no corpo
    expect(small.sleeve).toBeLessThan(base.sleeve);
  });
  it("calça na numeração (4 cm por número) e perna até o chão no máximo; calçado só alarga", () => {
    const jeans = { category: "lower_piece", subcategory: "jeans" };
    const base = specFor(jeans)!, big = specFor({ ...jeans, sizeSteps: 3 })!;
    expect(big.ease - base.ease).toBeCloseTo(3 * 0.04 / (2 * Math.PI), 4);
    expect(big.leg).toBeLessThanOrEqual(1); expect(big.leg).toBeGreaterThan(base.leg);
    const shoe = { category: "shoes_piece", subcategory: "casual_sneakers" };
    const sb = specFor(shoe)!, s2 = specFor({ ...shoe, sizeSteps: 2 })!;
    expect(s2.ease - sb.ease).toBeCloseTo(0.003, 5); expect(s2.leg).toBe(sb.leg);
    expect(specFor({ ...jeans, sizeSteps: 0 })).toEqual(base);
  });
});

describe("catalogue structural attributes reach the fitted garment", () => {
  it("preserves explicit short and long sleeve titles, while structured attributes take precedence", () => {
    expect(specFor({ subcategory: "shirt", name: "Hokkaido Short Sleeve Linen Blend Shirt" })!.sleeve).toBe(.33);
    expect(specFor({ subcategory: "shirt", name: "Camisa Manga Curta Floral" })!.sleeve).toBe(.33);
    expect(specFor({ subcategory: "shirt", name: "Camisa Manga Longa Slim Micro Xadrez" })!.sleeve).toBe(.96);
    expect(specFor({ subcategory: "jacket", name: "Short-Sleeved Jacket" })!.sleeve).toBe(.33);
    expect(specFor({ subcategory: "shirt", name: "Short Sleeve Shirt", attributes: { SLEEVE_LENGTH: ["LONG_SLEEVE"] } })!.sleeve).toBe(.96);
    expect(sleeveLengthOf({ name: "A brand without a length" })).toBeNull();
  });
  it("orders declared waistband heights without changing leg length or the avatar", () => {
    const waist = ["LOW_RISE", "MID_RISE", "HIGH_RISE", "SUPER_HIGH_RISE"].map(rise => specFor({subcategory:"jeans",attributes:{RISE:[rise]}})!);
    expect(waist.map(s=>s.waist)).toEqual([...waist.map(s=>s.waist)].sort((a,b)=>a-b));
    expect(new Set(waist.map(s=>s.waist)).size).toBe(4);
    expect(new Set(waist.map(s=>s.leg)).size).toBe(1);
    expect(riseOf({name:"Jeans cintura alta",attributes:{RISE:["LOW_RISE"]}})).toBe("LOW_RISE");
    expect(riseOf({name:"Levi's jeans"})).toBeNull();
    expect(specFor({subcategory:"jumpsuit",attributes:{RISE:["LOW_RISE"]}})!.waist).toBe(1);
    expect(specFor({subcategory:"t_shirt",attributes:{RISE:["HIGH_RISE"]}})!.waist).toBeNaN();
  });
  it("reads explicit catalogue names when RISE is absent without assigning a brand-wide fit", () => {
    expect(specFor({name:"Calça cintura alta",subcategory:"jeans"})!.waist).toBeGreaterThan(specFor({name:"Calça cintura baixa",subcategory:"jeans"})!.waist);
    expect(specFor({name:"Levi's",subcategory:"jeans"})!.waist).toBe(specFor({name:"Zara",subcategory:"jeans"})!.waist);
  });
  it.each(["PULLOVER","ZIPPER","HALF_ZIP","TIE"])("never fabricates shirt buttons on %s", closure => {
    expect(specFor({subcategory:"shirt",attributes:{CLOSURE:[closure]}})!.placket).toBe(false);
  });
  it("retains declared buttons, material and sleeve length", () => {
    const sp=specFor({subcategory:"shirt",material:"SILK",attributes:{CLOSURE:["BUTTON"],SLEEVE_LENGTH:["SHORT_SLEEVE"]}})!;
    expect(sp.placket).toBe(true);expect(sp.fabric).toBe("SILK");expect(sp.sleeve).toBe(.33);
  });
});

it("respects explicit model fits in catalogue titles without a brand-wide preset",()=>{
  expect(fitClassOf({name:"Camiseta Básica Slim Fit",subcategory:"t_shirt"})).toBe("justa");
  expect(fitClassOf({name:"Jeans Wide Leg",subcategory:"jeans"})).toBe("fluida");
  expect(fitClassOf({name:"Jeans Skinny",subcategory:"jeans",variation:"OVERSIZED"})).toBe("oversized");
  expect(specFor({name:"Macacão decote V",subcategory:"jumpsuit"})!.neckShape).toBe("v");
});

describe("silhuetas inferiores declaradas", () => {
  const pants = (variation: string) => specFor({ subcategory: "jeans", variation })!;
  it("abre bootcut e flare somente abaixo do joelho, com amplitudes distintas", () => {
    expect(pants("BOOTCUT").legFlareStart).toBe(.52);
    expect(pants("FLARE").legFlareStart).toBe(.52);
    expect(pants("FLARE").flare).toBeGreaterThan(pants("BOOTCUT").flare);
    expect(pants("BOOTCUT").legColumn).toBe(1);
    expect(pants("WIDE_LEG").legFlareStart).toBeLessThan(.52);
    expect(pants("WIDE_LEG").legColumn).toBeGreaterThan(pants("BOOTCUT").legColumn);
  });
  it("afunila tapered sem torná-la skinny, preservando cintura e comprimento", () => {
    expect(pants("TAPERED").legColumn).toBeGreaterThan(pants("SKINNY").legColumn);
    expect(pants("TAPERED").legColumn).toBeLessThan(pants("STRAIGHT").legColumn);
    expect(pants("TAPERED").flare).toBe(0);
    expect(pants("TAPERED").waist).toBe(pants("STRAIGHT").waist);
    expect(pants("TAPERED").leg).toBe(pants("STRAIGHT").leg);
  });
  it("distingue saias lápis, reta e evasê, conservando comprimento midi e cintura", () => {
    const skirts = ["PENCIL", "STRAIGHT", "A_LINE"].map(variation => specFor({ subcategory: "skirt", variation, attributes: { LENGTH: ["MIDI"], RISE: ["HIGH_RISE"] } })!);
    expect(skirts.map(s => s.flare)).toEqual([0, .012, .17]);
    expect(skirts.every(s => s.skirt === .66 && s.waist === .34)).toBe(true);
  });
  it("usa nomes explícitos apenas sem variação declarada e restringe a abertura à família de calças", () => {
    expect(specFor({ name: "Saia lápis", subcategory: "skirt" })!.flare).toBe(0);
    expect(specFor({ name: "Calça bootcut", subcategory: "jeans", variation: "STRAIGHT" })!.legFlareStart).toBeUndefined();
    expect(specFor({ name: "Legging", subcategory: "leggings", variation: "FLARE" })!.legFlareStart).toBe(.52);
    expect(specFor({ subcategory: "bermuda_shorts", variation: "FLARE" })!.legFlareStart).toBeUndefined();
    expect(specFor({ name: "Marca", subcategory: "jeans" })!.legFlareStart).toBeUndefined();
  });
});

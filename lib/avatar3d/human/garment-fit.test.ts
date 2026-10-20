import { describe, expect, it } from "vitest";
import { fitClassOf, necklineOf, riseOf, specFor } from "./garment-fit";

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


describe("catalogue structural attributes reach the fitted garment", () => {
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

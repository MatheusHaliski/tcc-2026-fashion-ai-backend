import { describe, expect, it } from "vitest";
import { kindOf } from "@/lib/avatar3d/human/garments";
import { fitClassOf, specFor } from "@/lib/avatar3d/human/garment-fit";
import { STRATEGIES, familyOf, garmentContract } from "@/lib/tryon/garment-asset";

/** Contrato da vestimenta: família, molde, caimento, comprimentos declarados e estado honesto de cada peça. */
const P = (subcategory: string, extra: Record<string, unknown> = {}) => ({ id: `t-${subcategory}`, category: "x", subcategory, ...extra });

describe("molde por subcategoria (códigos da taxonomia)", () => {
  it("corrige as famílias que viravam outra peça", () => {
    expect(kindOf(P("polo_shirt"))).toBe("tee");            // antes: camisa de manga longa
    expect(kindOf(P("vest"))).toBe("vest");                 // antes: jaqueta com mangas
    expect(kindOf(P("culottes"))).toBe("culottes");         // antes: calça até o tornozelo
    expect(kindOf(P("bermuda_shorts"))).toBe("bermuda");    // antes: short curto
    expect(kindOf(P("skort"))).toBe("skirt");               // antes: calça
    expect(kindOf(P("romper"))).toBe("romper");             // antes: macacão de perna longa
    expect(kindOf(P("dress"))).toBe("dress");
    expect(kindOf(P("t_shirt"))).toBe("tee");
    expect(kindOf(P("crossbody_bag"))).toBeNull();          // acessório: sem molde no corpo
  });
  it("cano da bota pela subcategoria e pela dimensão SHAFT_HEIGHT", () => {
    expect(specFor(P("ankle_boots"))!.shaft).toBeGreaterThan(specFor(P("long_boots"))!.shaft);
    expect(specFor(P("boots", { attributes: { SHAFT_HEIGHT: ["KNEE_HIGH"] } }))!.shaft).toBeCloseTo(0.55);
  });
});

describe("classe de caimento", () => {
  it("vem da variação declarada; sem ela, da subcategoria", () => {
    expect(fitClassOf(P("jeans", { variation: "SKINNY" }))).toBe("justa");
    expect(fitClassOf(P("jeans"))).toBe("regular");
    expect(fitClassOf(P("t_shirt", { variation: "OVERSIZED" }))).toBe("oversized");
    expect(fitClassOf(P("tailored_pants", { variation: "WIDE_LEG" }))).toBe("fluida");
    expect(fitClassOf(P("blazer"))).toBe("estruturada");
  });
  it("justa acompanha o corpo, regular cai reta, oversized folga e alonga a manga; o corpo nunca muda", () => {
    const skinny = specFor(P("jeans", { variation: "SKINNY" }))!, straight = specFor(P("jeans"))!, wide = specFor(P("jeans", { variation: "WIDE_LEG" }))!;
    expect(skinny.legColumn).toBe(0); expect(straight.legColumn).toBe(1); expect(wide.legColumn).toBeGreaterThan(1);
    expect(skinny.ease).toBeLessThan(straight.ease);
    const tee = specFor(P("t_shirt"))!, over = specFor(P("t_shirt", { variation: "OVERSIZED" }))!;
    expect(over.ease).toBeGreaterThan(tee.ease); expect(over.sleeve).toBeGreaterThan(tee.sleeve); expect(over.hem).toBeLessThan(tee.hem);
    expect(specFor(P("jogger_pants"))!.legColumn).toBeLessThan(1);   // jogger afunila no punho
  });
  it("comprimentos das dimensões LENGTH e SLEEVE_LENGTH", () => {
    expect(specFor(P("dress", { attributes: { LENGTH: ["MAXI"] } }))!.skirt).toBeGreaterThan(specFor(P("dress", { attributes: { LENGTH: ["MINI"] } }))!.skirt);
    expect(specFor(P("t_shirt", { attributes: { SLEEVE_LENGTH: ["LONG_SLEEVE"] } }))!.sleeve).toBeGreaterThan(0.9);
    expect(specFor(P("jeans", { attributes: { LENGTH: ["CAPRI"] } }))!.leg).toBeLessThan(0.8);
  });
});

describe("contrato e estado no provador", () => {
  it("peça com foto: prévia estimada (molde do corpo), nunca 'aprovada' sem malha validada", () => {
    const c = garmentContract(P("t_shirt", { imageUrl: "/x.webp" }), "ok");
    expect(c.validation).toEqual({ state: "ESTIMADA", reason: "molde_estimado_foto_frontal" });
    expect(c.asset).toMatchObject({ kind: "molde-estimado", approval: "pendente" });
    expect(c.identity.family).toBe("superior");
    expect(c.motion).toEqual({ method: "skinning", collisions: "folga-por-camada", simulation: "nenhuma" });
    expect(c.appearance).toEqual({ front: "foto", back: "cor-do-tecido-da-foto" });
  });
  it("foto que não carrega no 3D é ERRO (não vira casca pintada); carregando é PROCESSANDO; acessório é SEM_3D", () => {
    expect(garmentContract(P("jeans"), "falhou").validation.state).toBe("ERRO");
    expect(garmentContract(P("jeans"), "carregando").validation.state).toBe("PROCESSANDO");
    expect(garmentContract(P("handbag"), "ok").validation).toEqual({ state: "SEM_3D", reason: "acessorio_sem_molde_3d" });
  });
  it("limitações conhecidas aparecem no contrato e cada família tem sua estratégia", () => {
    expect(garmentContract(P("sandals"), "ok").compatibility.restrictions).toEqual(["sandalia_como_sapato_fechado"]);
    expect(familyOf(P("coat"))).toBe("sobreposicao"); expect(familyOf(P("dress"))).toBe("peca-inteira"); expect(familyOf(P("ankle_boots"))).toBe("calcado");
    expect(STRATEGIES["peca-inteira"].build).toBe("tubo-da-cintura"); expect(STRATEGIES.calcado.build).toBe("forma-do-calcado"); expect(STRATEGIES.acessorio.motion).toBe("fixo-no-osso");
  });
});

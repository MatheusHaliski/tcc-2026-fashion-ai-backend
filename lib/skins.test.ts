import { describe, expect, it } from "vitest";
import { CARD_SKINS, backgroundStyle, skinStyle, skinTone, surfaceToneStyle } from "./skins";

type Vars = Record<string, unknown>;

describe("surfaceToneStyle", () => {
  it("ignora cor ausente ou fora do formato #rrggbb", () => {
    expect(surfaceToneStyle()).toBeUndefined();
    expect(surfaceToneStyle(null)).toBeUndefined();
    expect(surfaceToneStyle("#fff")).toBeUndefined();
    expect(surfaceToneStyle("vermelho")).toBeUndefined();
  });

  it("superfície clara recebe tokens claros e escura recebe tokens escuros", () => {
    const light = surfaceToneStyle("#F0F0F0") as Vars;
    expect(light.colorScheme).toBe("light");
    expect(light["--surface"]).toBe("#F0F0F0");
    const dark = surfaceToneStyle("#101820") as Vars;
    expect(dark.colorScheme).toBe("dark");
    expect(dark["--ink"]).toBe("#F2F1EC");
  });
});

describe("skinTone e skinStyle", () => {
  it("classifica as skins escuras e trata vazio/desconhecida como clara", () => {
    expect(skinTone("oxblood")).toBe("dark");
    expect(skinTone("spread")).toBe("light");
    expect(skinTone()).toBe("light");
    expect(skinTone(null)).toBe("light");
  });

  it("skin conhecida vira variáveis CSS do card", () => {
    const s = skinStyle("midnight_violet") as Vars;
    expect(s["--card-bg"]).toBe(CARD_SKINS.midnight_violet.bg);
    expect(s["--card-radius"]).toBe("12px");
    expect(s["--card-title-weight"]).toBe(300);
    expect(s.colorScheme).toBe("dark");
  });

  it("skin desconhecida ou ausente cai na atelier clara", () => {
    for (const k of ["nao-existe", null, undefined]) {
      const s = skinStyle(k) as Vars;
      expect(s["--card-bg"]).toBe("#FFFFFF");
      expect(s.colorScheme).toBe("light");
    }
  });
});

describe("backgroundStyle", () => {
  it("sem config devolve objeto vazio", () => {
    expect(backgroundStyle()).toEqual({});
    expect(backgroundStyle(null)).toEqual({});
    expect(backgroundStyle({})).toEqual({});
  });

  it("imagem vence gradiente, com prioridade artUrl > aiArt > upload > poster > image > url", () => {
    expect(backgroundStyle({ artUrl: "/a.png", aiArt: { url: "/b.png" }, gradient: "linear-gradient(red, blue)" }).backgroundImage).toBe('url("/a.png")');
    expect(backgroundStyle({ aiArt: { url: "https://x/b.png" }, uploadUrl: "/c.png" }).backgroundImage).toBe('url("https://x/b.png")');
    expect(backgroundStyle({ aiArt: null, uploadUrl: "media/c.png" }).backgroundImage).toBe('url("/media/c.png")');
    expect(backgroundStyle({ posterUrl: "/p.png", imageUrl: "/i.png" }).backgroundImage).toBe('url("/p.png")');
    expect(backgroundStyle({ imageUrl: "/i.png" }).backgroundImage).toBe('url("/i.png")');
    const s = backgroundStyle({ url: "/u.png" });
    expect(s).toEqual({ backgroundImage: 'url("/u.png")', backgroundSize: "cover", backgroundPosition: "center" });
  });

  it("gradiente em texto só vale se for CSS de gradiente", () => {
    expect(backgroundStyle({ gradient: "radial-gradient(red, blue)" })).toEqual({ backgroundImage: "radial-gradient(red, blue)" });
    expect(backgroundStyle({ gradient: "azul", color: "#123456" })).toEqual({ background: "#123456" });
  });

  it("monta gradiente linear ou radial a partir das paradas", () => {
    expect(backgroundStyle({ stops: ["#000", "#fff"] }).backgroundImage).toBe("linear-gradient(135deg, #000, #fff)");
    expect(backgroundStyle({ stops: ["#000", "#fff"], angle: 90 }).backgroundImage).toBe("linear-gradient(90deg, #000, #fff)");
    expect(backgroundStyle({ gradient: { stops: ["red", "blue"], angle: 45 } }).backgroundImage).toBe("linear-gradient(45deg, red, blue)");
    expect(backgroundStyle({ gradient: { stops: ["red", "blue"] } }).backgroundImage).toBe("linear-gradient(135deg, red, blue)");
    expect(backgroundStyle({ gradient: { stops: ["red", "blue"], type: "radial" } }).backgroundImage).toBe("radial-gradient(circle, red, blue)");
  });

  it("paradas vazias caem na cor sólida ou em nada", () => {
    expect(backgroundStyle({ stops: [], color: "#abc" })).toEqual({ background: "#abc" });
    expect(backgroundStyle({ gradient: { stops: [] }, color: 3 })).toEqual({});
  });
});

// @vitest-environment jsdom
/**
 * RF54 — o "É minha" do FashionAI Lens (sem peça parecida) abre /pieces/new com a leitura na URL
 * (LensService.prefillHref: category, subcategory, color, material, styles, q, from=lens, scan, detection). O criador
 * pré-preenche subtipo, cor, material, estilos e nome — só valores da taxonomia, o resto é ignorado — e avisa que veio do
 * Lens. Os atalhos antigos (?category=, ?brand=, ?q=) continuam iguais.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, loggedAs, renderApp, screen, waitFor, ME } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import type { Taxonomy } from "@/lib/api/taxonomy";
import NewPiecePage from "@/app/(site)/(app)/pieces/new/page";
import { readPiecePrefill, validPieceCategory, validPiecePrefill } from "./prefill";

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt", "shirt"], lower_piece: ["jeans"], shoes_piece: ["casual_sneakers"], accessory_piece: ["cap"] },
  colors: { white: "#ffffff", black: "#111111" }, materials: ["COTTON", "LEATHER"], sizes: ["m"], sexes: ["UNISSEX"],
  occasions: ["casual", "work"], styles: ["basic", "streetwear", "minimalist"], allowedOccasionsByCategory: { upper_piece: ["casual", "work"] },
  defaultImages: { upper_piece: "/assets/upper.png", generic: "/assets/generic.png" }, brands: [],
} as unknown as Taxonomy;
const CATS = ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "full_body_piece"];
const ROUTES = { "GET /api/taxonomy": TAXONOMY, "GET /api/catalog/brands": { brands: [] }, "GET /api/catalog/suggestions": { suggestions: [] },
  "GET /api/catalog/search": { intent: { brand: null, brandKnown: false, category: "upper_piece", subcategory: null, keywords: [], color: null }, results: [], total: 0, enoughInput: true, canSearchOfficial: false } };
const LENS_URL = "category=upper_piece&subcategory=t_shirt&color=black&material=cotton&styles=basic%2Cstreetwear&q=Camiseta+preta&from=lens&scan=s9&detection=d1";
const text = (id: string) => document.getElementById(id)?.textContent ?? "";
const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("validação do pré-preenchimento na taxonomia", () => {
  it("só entra o que existe: subtipo do próprio tipo, cor, material (código canônico) e até 2 estilos", () => {
    const p = readPiecePrefill(new URLSearchParams(LENS_URL));
    expect(p).toMatchObject({ category: "upper_piece", subcategory: "t_shirt", color: "black", material: "cotton", styles: "basic,streetwear", query: "Camiseta preta", from: "lens", scan: "s9", detection: "d1" });
    expect(validPiecePrefill(p, TAXONOMY, CATS)).toEqual({ category: "upper_piece", subcategory: "t_shirt", color: "black", material: "COTTON", style: ["basic", "streetwear"], name: "Camiseta preta", fromLens: true, scan: "s9" });
    // desconhecidos e fora do tipo são ignorados; estilos repetidos, desconhecidos e acima de 2 saem
    const bad = validPiecePrefill({ category: "upper_piece", subcategory: "jeans", color: "neon", material: "kevlar", styles: "foo, BASIC,basic,minimalist,streetwear", from: "lens", scan: "../admin", query: "x".repeat(120) }, TAXONOMY, CATS);
    expect(bad).toEqual({ category: "upper_piece", subcategory: "", color: "", material: "", style: ["basic", "minimalist"], name: "x".repeat(80), fromLens: true, scan: null });
    // tipo fora dos chips: nada de subtipo; sem ?from=lens o ?q= é só a busca (não vira nome nem link)
    expect(validPiecePrefill({ category: "planet", subcategory: "t_shirt", query: "Nike", scan: "s9" }, TAXONOMY, CATS)).toMatchObject({ category: "", subcategory: "", name: "", fromLens: false, scan: null });
    expect(validPieceCategory("LOWER_PIECE", CATS)).toBe("lower_piece");
    // taxonomia ainda carregando: só o que não depende dela
    expect(validPiecePrefill(p, null, CATS)).toEqual({ category: "upper_piece", subcategory: "", color: "", material: "", style: [], name: "Camiseta preta", fromLens: true, scan: "s9" });
  });
});

describe("/pieces/new aberto pelo FashionAI Lens", () => {
  it("taxonomia chegando depois: preenche tipo, subtipo, cor, material, estilos e nome, e mostra a nota com o link da leitura", async () => {
    nav.search = new URLSearchParams(LENS_URL);
    loggedAs(ME, ROUTES);
    renderApp(<NewPiecePage />);
    expect(await screen.findByText("Veio do FashionAI Lens")).toBeTruthy();
    const note = document.querySelector("[data-prefill=lens]");
    expect(note?.textContent).toContain("Veio do FashionAI Lens");
    expect(note?.textContent).toContain("Confira antes de salvar");
    expect(screen.getByRole("link", { name: "Voltar à leitura" }).getAttribute("href")).toBe("/lens/s9");
    expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Camiseta preta");
    expect(pressed("Parte superior")).toBe("true");
    await waitFor(() => expect(text("subcategory")).toBe("Camiseta"));
    expect(text("color")).toBe("Preto");
    expect(text("material")).toBe("Algodão");
    expect(pressed("Básico")).toBe("true");
    expect(pressed("Streetwear")).toBe("true");
    expect(pressed("Minimalista")).toBe("false");
    // a busca catalogada também abre no subtipo lido
    await waitFor(() => expect(pressed("Camiseta")).toBe("true"));
  });

  it("taxonomia em cache: valores desconhecidos ficam em branco, sem nota e sem nome fora do Lens", async () => {
    // valores fora da taxonomia (subtipo de outro tipo, cor e material que não existem) com ?from=lens
    nav.search = new URLSearchParams("category=upper_piece&subcategory=jeans&color=neon&material=kevlar&styles=foo%2Cminimalist&q=Pe%C3%A7a&from=lens");
    loggedAs(ME, ROUTES);
    renderApp(<NewPiecePage />);
    expect(await screen.findByText("Veio do FashionAI Lens")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Voltar à leitura" })).toBeNull();          // sem ?scan= não há link
    expect(text("subcategory")).toBe("—");
    expect(text("color")).toBe("—");
    expect(text("material")).toBe("—");
    expect(pressed("Minimalista")).toBe("true");
    expect(pressed("Básico")).toBe("false");
    cleanup();
    // atalho do Explorador/marcas: só tipo, marca e busca, como antes — nada de nota nem de nome
    nav.search = new URLSearchParams("category=lower_piece&brand=Nike&q=jeans");
    loggedAs(ME, ROUTES);
    renderApp(<NewPiecePage />);
    expect(await screen.findByRole("heading", { name: "Buscar no catálogo" })).toBeTruthy();
    expect(screen.queryByText("Veio do FashionAI Lens")).toBeNull();
    expect(pressed("Parte inferior")).toBe("true");
    expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("");
    expect((document.getElementById("cs-q") as HTMLInputElement).value).toBe("jeans");
  });
});

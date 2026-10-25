// @vitest-environment jsdom
/**
 * Card "Esquema de DNA de Estilo" (RF13 · anatomia_cards_DNA_v4): as quatro anatomias da Seção A, as doze narrativas da
 * Seção B (com os dados de narrativeData), a fileira de logos pela regra de corte, a frase de identidade, a arte do
 * Background Studio atrás do container e o clique no container que abre o DNA.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import { OWNER } from "@/test-utils/fixtures";
import { label } from "@/lib/api/taxonomy";
import { DNA_LAYOUTS, DNA_NARRATIVES, DnaCard, SEASON_PRESETS, dnaHypeScore, dnaLayoutLabel, dnaNarrativeLabel, narrativeHasOwnArt, type DnaCellView, type DnaView } from "./dna-card";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); router.push.mockClear(); });

const cell = (schemeId: string, title: string, extra: Partial<DnaCellView> = {}): DnaCellView => ({
  cell: schemeId, schemeId, title, occasion: ["casual"], style: ["basic"], milestone: false, createdAt: "2025-03-10T12:00:00Z",
  pieces: [{ id: `${schemeId}-p`, name: `Peça de ${title}`, imageUrl: `/media/${schemeId}-p.png`, brand: "Nike" }], ...extra,
});
const CELLS: DnaCellView[] = [
  cell("s1", "Look de sexta", { coverImageUrl: "/media/s1.png", eraLabel: "Mar/25", dominantBrand: "Nike", dominantColor: "#111111", season: "WINTER", milestone: true,
    hype: { status: "AVAILABLE", score: 81, level: "TRENDING", direction: "UP", deltaPoints: 4, deltaPercent: 5 } }),
  cell("s2", "Look de domingo", { dominantColor: "#FAFAFA", occasion: [], season: "SUMMER", hype: { status: "AVAILABLE", score: 42, level: null as never, direction: "FLAT", deltaPoints: 0, deltaPercent: 0 } }),
  cell("s3", "Look da festa", { pieces: [], dominantBrand: null, createdAt: undefined, hype: { status: "INSUFFICIENT_DATA", score: null, level: null as never, direction: null as never, deltaPoints: null as never, deltaPercent: null as never } }),
];
const DNA: DnaView = {
  id: "d1", owner: OWNER, title: "Meu DNA", archetype: "MINIMAL", archetypeLabel: "Minimalista", boldnessIndex: 37, identityPhrase: "Menos é mais",
  palette: ["#111111", "#E53935", "#1E88E5"], cardLayout: "AMPLIADO", targetElement: "DNA_COMPLETO", narrativeType: null, occasion: "casual, work", style: "basic",
  visibility: "PUBLIC", status: "PUBLISHED", background: {}, cardSkin: "atelier", cells: CELLS,
  logos: [{ brand: "Nike", pieces: 3, structural: 1 }, { brand: "Zara", pieces: 2, structural: 0, logoUrl: "/media/zara.png" }, { brand: "Gap", pieces: 1, structural: 0 }, { brand: "Puma", pieces: 1, structural: 0 }],
  counters: { likes: 2, comments: 1, shares: 0, remixes: 0 }, canEdit: true, createdAt: "2026-09-01T12:00:00Z",
};
const render = (dna: Partial<DnaView>, props: { href?: string; expanded?: boolean; extra?: React.ReactNode } = {}) => {
  mockApi({});
  return renderApp(<DnaCard dna={{ ...DNA, ...dna }} {...props} />);
};
const narrative = (narrativeType: string, extra: Partial<DnaView> = {}) => render({ narrativeType, ...extra });

describe("DnaCard — anatomias da Seção A", () => {
  it("A1 Ampliado: lista com época · ocasião, as peças só no ampliado e a frase de identidade entre aspas", () => {
    const { container } = render({ narrativeType: "TIMELINE", targetElement: "ESQUEMA" }, { expanded: true });
    // elemento-alvo que não é o DNA completo ignora a narrativa e usa a anatomia
    expect(container.querySelector(".dna-container")?.getAttribute("data-label")).toBe("DNA de estilo · Ampliado");
    expect(screen.getByText("Looks do DNA (3)")).toBeTruthy();
    const rows = Array.from(container.querySelectorAll(".dna-row"));
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain(`Mar/25 · ${label("casual")}`);
    expect(rows[0].querySelector("small")?.textContent).toBe("Peça de Look de sexta");
    expect(rows[2].querySelector("small")).toBeNull();   // look sem peças
    // sem foto de capa: a célula usa a foto da primeira peça; sem nenhuma, as iniciais
    expect(rows[1].querySelector("img")?.getAttribute("src")).toContain("s2-p.png");
    expect(rows[2].querySelector(".dna-thumb-fallback")?.textContent).toBe("LO");
    expect(container.querySelector(".dna-phrase")?.textContent).toContain("“Menos é mais”");
    expect(container.querySelector(".c-row")?.textContent).toContain(`${label("casual")} · ${label("work")} · ${label("basic")}`);
    // ampliado: sem a linha de ações do card
    expect(container.querySelector(".c-post")).toBeNull();
  });

  it("A2 Em grade e A3 Na horizontal: célula com a ocasião (ou livre) e com a marca dominante (ou sem marca)", () => {
    const { container, unmount } = render({ cardLayout: "GRADE" });
    const grid = Array.from(container.querySelectorAll(".dna-grid-cell"));
    expect(grid.map((c) => c.querySelector(":scope > span:last-child")?.textContent)).toEqual([label("casual"), label("livre"), label("casual")]);
    unmount();
    const h = render({ cardLayout: "HORIZONTAL" });
    expect(Array.from(h.container.querySelectorAll(".dna-hcell > span:last-child")).map((s) => s.textContent)).toEqual(["NIKE", "SEM MARCA", "SEM MARCA"]);
  });

  it("A4 Na lateral: a lista troca a foto em destaque e a fileira de logos é a dedicada (2 logos + contador)", () => {
    const { container } = render({ cardLayout: "LATERAL" });
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(".dna-lateral-list button"));
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".dna-hero-tag")?.textContent).toBe("Look de sexta · NIKE");
    fireEvent.click(buttons[1]);
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".dna-hero-tag")?.textContent).toBe("Look de domingo");
    expect(buttons[1].textContent).toContain(label("livre").toUpperCase());
    const logos = container.querySelector(".dna-logos") as HTMLElement;
    expect(logos.className).toContain("dedicated");
    expect(logos.querySelectorAll(".dna-logo")).toHaveLength(2);
    expect(logos.querySelector(".dna-logo-more")?.textContent).toBe("+2");
    expect(screen.getByText("clique para trocar a foto ↕")).toBeTruthy();
  });

  it("sem looks: pede de 2 a 6; sem ocasião, estilo nem frase: travessões", () => {
    const { container } = render({ cells: [], occasion: null, style: null, identityPhrase: null, logos: [] });
    expect(screen.getByText("Selecione de 2 a 6 looks para montar o DNA.")).toBeTruthy();
    expect(container.querySelector(".c-row")?.textContent).toBe("Ocasião · estilo—");
    expect(container.querySelector(".dna-phrase")?.textContent).toBe("Frase de identidade—");
    expect(container.querySelector(".dna-logos")).toBeNull();
  });
});

describe("DnaCard — narrativas da Seção B", () => {
  it("B1 Linha do tempo: segue a ordem do backend e o clique foca um marco (os outros escurecem)", () => {
    const { container } = narrative("TIMELINE", { narrative: { order: ["s3", "s1", "inexistente"] } });
    expect(container.querySelector(".dna-container")?.getAttribute("data-label")).toBe("DNA · Linha do tempo");
    const marks = Array.from(container.querySelectorAll<HTMLButtonElement>(".dna-mark"));
    expect(marks.map((m) => m.querySelector("b")?.textContent)).toEqual(["Look da festa", "Look de sexta"]);
    fireEvent.click(marks[1]);
    expect(marks[1].className).toContain("on");
    expect(marks[0].className).toContain("dim");
    fireEvent.click(marks[1]);   // clicar de novo tira o foco
    expect(marks[1].className).not.toContain("on");
    expect(marks[0].className).not.toContain("dim");
  });

  it("B1 sem ordem gravada: usa a ordem das células", () => {
    const { container } = narrative("TIMELINE");
    expect(Array.from(container.querySelectorAll(".dna-mark b")).map((b) => b.textContent)).toEqual(["Look de sexta", "Look de domingo", "Look da festa"]);
  });

  it("B2 Momentos marcantes: o marco vira capa e a fileira troca o destaque; sem logos fora do corpo", () => {
    const { container } = narrative("MOMENTOS_MARCANTES", { narrative: { cover: "s1" } });
    expect(container.querySelector(".dna-hero-tag")?.textContent).toBe("MARCO ·Mar/25");
    expect(container.querySelector(".dna-moment-cap")?.textContent).toContain("NIKE");
    expect(container.querySelector(".dna-logos")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Look da festa/ }));
    expect(container.querySelector(".dna-hero-tag")?.textContent).toBe("Look da festa");
    expect(screen.getByRole("button", { name: /Look da festa/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("B2 sem capa gravada nem logos: a primeira célula é a capa", () => {
    const { container } = narrative("MOMENTOS_MARCANTES", { logos: [] });
    expect(container.querySelector(".dna-moment-cap b")?.textContent).toBe("Look de sexta");
    expect(container.querySelector(".dna-moment-cap .dna-logo")).toBeNull();
  });

  it("B3 Primeira vez: estreia de ocasião, de marca e rótulo livre; os logos seguem as estreias de peça", () => {
    const { container } = narrative("PRIMEIRA_VEZ", { narrative: { firsts: [
      { schemeId: "s1", label: "1ª vez", kind: "OCASIAO", value: "work" },
      { schemeId: "s2", label: "1ª peça Zara", kind: "MARCA", value: "zara" },
      { schemeId: "s3", label: "Primeiro look de festa" },
      { schemeId: "fantasma", label: "some" },
    ] } });
    const rows = Array.from(container.querySelectorAll(".dna-firsts .dna-row b")).map((b) => b.textContent);
    expect(rows).toEqual([`1ª vez em ${label("work").toLowerCase()}`, "1ª peça ZARA", "Primeiro look de festa"]);
    // uma estreia de peça → 2 logos, sem contador nesta narrativa
    const logos = container.querySelector(".dna-logos") as HTMLElement;
    expect(logos.querySelectorAll(".dna-logo")).toHaveLength(2);
    expect(logos.querySelector(".dna-logo-more")).toBeNull();
  });

  it("B3 sem estreias gravadas: mostra o 1º look salvo", () => {
    const { container } = narrative("PRIMEIRA_VEZ");
    expect(container.querySelector(".dna-firsts b")?.textContent).toBe("1º look salvo");
  });

  it("B4 Cápsula: peças-base com ×looks, a marca da peça e a estatística de versatilidade com vírgula", () => {
    const { container } = narrative("CAPSULA_VERSATILIDADE", { narrative: { basePieces: [
      { pieceId: "s1-p", name: "Camiseta", looks: 3, imageUrl: "/media/cam.png" }, { pieceId: "x", name: "Sem foto", looks: 1, imageUrl: "null" },
    ], baseCount: 2, avgUses: 1.5, factor: 2.5 } });
    const cells = Array.from(container.querySelectorAll(".dna-capsule-cell"));
    expect(cells[0].textContent).toContain("×3");
    expect(cells[0].textContent).toContain("NIKE");
    expect(cells[1].querySelector("img")).toBeNull();
    expect(container.querySelector(".dna-stat")?.textContent).toBe("2 peças-base → 3 looks neste DNA · cada peça rende, em média, 1,5 combinações · fator de versatilidade 2,5");
    expect(container.querySelectorAll(".dna-logos .dna-logo")).toHaveLength(2);
  });

  it("B4 sem dados: zero peças-base", () => {
    const { container } = narrative("CAPSULA_VERSATILIDADE");
    expect(container.querySelector(".dna-stat")?.textContent).toContain("0 peças-base");
  });

  it("B5 Por ocasião: uma fileira por ocasião (no máx. 3) e só um logo, sem contador", () => {
    const { container } = narrative("POR_OCASIAO", { narrative: { groups: { casual: ["s1", "s2"], work: ["s3", "nao-existe"], party: [], extra: ["s1"] } } });
    expect(Array.from(container.querySelectorAll(".dna-occ-tag")).map((x) => x.textContent)).toEqual([label("casual"), label("work"), label("party")]);
    expect(container.querySelectorAll(".dna-occ-cell")).toHaveLength(3);
    expect(container.querySelectorAll(".dna-logos .dna-logo")).toHaveLength(1);
    expect(container.querySelector(".dna-logo-more")).toBeNull();
  });

  it("B6 Mood board: arquétipo e ousadia no núcleo e na frase; órbitas interna e externa numeradas", () => {
    const { container } = narrative("MOOD_BOARD", { narrative: { orbits: [{ schemeId: "s1", orbit: 1 }, { schemeId: "s2", orbit: 2 }, { schemeId: "zz", orbit: 2 }] } });
    expect(container.querySelector(".dna-core")?.textContent).toBe("Minimalista37/100");
    expect(container.querySelectorAll(".dna-node")).toHaveLength(2);
    expect(container.querySelector(".dna-legend")?.textContent).toBe("① Look de sexta · ② Look de domingo · ③ ");
    expect(container.querySelector(".dna-phrase")?.textContent).toBe("ArquétipoMinimalista, ousadia 37/100");
    expect(container.querySelectorAll(".dna-logos .dna-logo")).toHaveLength(3);
  });

  it("B6 sem arquétipo: núcleo \"Estilo\", 0/100 e todas as células na órbita 1", () => {
    const { container } = narrative("MOOD_BOARD", { archetypeLabel: null, archetype: null, boldnessIndex: null });
    expect(container.querySelector(".dna-core")?.textContent).toBe("Estilo0/100");
    expect(container.querySelectorAll(".dna-node")).toHaveLength(3);
    expect(container.querySelector(".dna-phrase")?.textContent).toBe("Arquétipo—, ousadia 0/100");
  });

  it("B7 Paleta dominante: faixa com a participação de cada cor e células com tinta legível", () => {
    const { container } = narrative("PALETA_DOMINANTE", { narrative: { band: [{ color: "black", hex: "#111111", share: 60 }, { color: "white", hex: "#FAFAFA", share: 2 }] } });
    const band = Array.from(container.querySelectorAll<HTMLElement>(".dna-band i"));
    expect(band[0].title).toBe(`${label("black")} · 60%`);
    expect(band[1].style.flexGrow).toBe("4");   // mínimo de 4 para a faixa não sumir
    const cells = Array.from(container.querySelectorAll<HTMLElement>(".dna-color-cell"));
    expect(cells[0].style.color).toBe("rgb(255, 255, 255)");   // cor escura → texto branco
    expect(cells[1].style.color).toBe("rgb(26, 23, 20)");
    expect(cells[2].style.background).toContain("rgb(204, 204, 204)");   // sem cor dominante
  });

  it("B7 sem faixa gravada: a paleta do DNA em partes iguais", () => {
    const { container } = narrative("PALETA_DOMINANTE");
    expect(container.querySelectorAll(".dna-band i")).toHaveLength(3);
    expect((container.querySelector(".dna-band i") as HTMLElement).title).toContain("20%");
  });

  it("B8 Harmonia cromática: marcadores na roda e o texto da harmonia; logos só em texto", () => {
    const { container } = narrative("HARMONIA_CROMATICA", { narrative: { harmony: "TRIADICA" } });
    expect(container.querySelectorAll(".dna-wheel i")).toHaveLength(3);
    expect(container.querySelector(".dna-harmony p")?.textContent).toBe("Harmonia: tríade — três matizes a ≈120° entre si, contraste equilibrado");
    expect(container.querySelector(".dna-logos")?.textContent).toBe("MarcasNIKE · ZARA · GAP · PUMA");
  });

  it("B8 sem paleta: usa as cores dominantes das células; harmonia desconhecida aparece em minúsculas", () => {
    const { container } = narrative("HARMONIA_CROMATICA", { palette: [], narrative: { harmony: "OUTRA" } });
    expect(container.querySelectorAll(".dna-wheel i")).toHaveLength(2);
    expect(container.querySelector(".dna-harmony b")?.textContent).toBe("Harmonia: outra");
  });

  it("B8 sem harmonia gravada: monocromática", () => {
    const { container } = narrative("HARMONIA_CROMATICA");
    expect(container.querySelector(".dna-harmony b")?.textContent).toBe("Harmonia: monocromática/neutra");
  });

  it("B9 Marcas favoritas: ranking com barras proporcionais e a base do ranking; vazio avisa", () => {
    const { container, unmount } = narrative("MARCAS_FAVORITAS");
    const bars = Array.from(container.querySelectorAll<HTMLElement>(".dna-brand-bar"));
    expect(bars.map((b) => b.querySelector(".dna-brand-name")?.textContent)).toEqual(["NIKE", "ZARA", "GAP", "PUMA"]);
    expect((bars[0].querySelector(".dna-brand-track i") as HTMLElement).style.width).toBe("100%");
    expect(screen.getByText(/Base do ranking: 7 peças · 3 looks/)).toBeTruthy();
    expect(container.querySelector(".dna-logos")).toBeNull();
    unmount();
    narrative("MARCAS_FAVORITAS", { logos: [], narrative: { ranking: [] } });
    expect(screen.getByText("Nenhuma peça com marca nos looks escolhidos.")).toBeTruthy();
  });

  it("B10 Hype focus: o maior Hype em destaque; sem dados aparece como — e \"sem dados\", nunca 0", () => {
    const { container } = narrative("HYPE_FOCUS");
    expect(container.querySelector(".dna-gauge")?.textContent).toBe("🔥 81Look de sexta · NIKE");
    expect(container.querySelector(".dna-hype-level")?.textContent).toBe("Tendência");
    const rows = Array.from(container.querySelectorAll(".dna-hype-row"));
    expect(rows.map((r) => r.querySelector("b")?.textContent)).toEqual(["Look de domingo", "Look da festa"]);
    // 42 sem faixa vinda do backend: a faixa sai do número
    expect(rows[0].querySelector(".hype-level-chip")?.textContent).toBe("Relevante");
    expect(rows[0].querySelector(".hype-bar")).not.toBeNull();
    expect(rows[1].querySelector(".dna-mini em")?.textContent).toBe("🔥 —");
    expect(rows[1].textContent).toContain("sem dados");
    expect(rows[1].querySelector("[title]")?.getAttribute("title")).toBe("Dados insuficientes");
  });

  it("B10 nenhum look com Hype: o destaque mostra — e \"Hype ainda não calculado\"; sem looks não há corpo", () => {
    const cells = CELLS.map((c) => ({ ...c, hype: null }));
    const { container, unmount } = narrative("HYPE_FOCUS", { cells });
    expect(container.querySelector(".dna-gauge b")?.textContent).toBe("🔥 —");
    expect(container.querySelector(".dna-hype-level")?.textContent).toBe("Hype ainda não calculado");
    expect(container.querySelector(".dna-gauge em")?.textContent).toBe("Look de sexta · NIKE");
    unmount();
    const empty = narrative("HYPE_FOCUS", { cells: [] });
    expect(empty.container.querySelector(".dna-hype")).toBeNull();
  });

  it("B11 Cartela sazonal: a estação do DNA assume o card, os looks da estação vêm primeiro e a animação escolhida aparece", () => {
    const { container } = narrative("CARTELA_SAZONAL", { seasonalTheme: "WINTER", background: { animation: "SNOW" } });
    expect(container.querySelector(".dna-season")?.className).toContain("anim-snow");
    expect(container.querySelector(".dna-season b")?.textContent).toBe(SEASON_PRESETS.WINTER.label);
    expect(container.querySelector(".dna-season em")?.textContent).toBe("seasonalTheme = WINTER · animação SNOW");
    const cells = Array.from(container.querySelectorAll(".dna-grid-cell"));
    expect(cells[0].className).not.toContain("secondary");
    expect(cells[1].className).toContain("secondary");
    expect(container.querySelector("[data-art]")).toBeNull();   // arte própria: a manual não entra
  });

  it("B11 sem estação: outono; animação de brilho vira classe; no ampliado cabem 6 looks", () => {
    const many = Array.from({ length: 7 }, (_, i) => cell(`m${i}`, `Look ${i}`, { season: "AUTUMN" }));
    const { container } = render({ narrativeType: "CARTELA_SAZONAL", seasonalTheme: null, background: { animation: "SHIMMER" }, cells: many }, { expanded: true });
    expect(container.querySelector(".dna-season")?.className).toContain("anim-leaves");
    expect(container.querySelector(".dna-season")?.className).toContain("motion-shimmer");
    expect(container.querySelector(".dna-season em")?.textContent).toBe("seasonalTheme = AUTUMN · animação SHIMMER");
    expect(container.querySelectorAll(".dna-grid-cell")).toHaveLength(6);
  });

  it("B12 LEGO: o DNA inteiro em blocos, com logos (+N) e frase; \"montar de novo\" refaz a queda", () => {
    const { container } = narrative("LEGO");
    expect(container.querySelector("article")?.className).toContain("dna-blocks");
    expect(container.querySelector(".title-brick")?.textContent).toContain("Meu DNA");
    expect(container.querySelectorAll(".cell-brick")).toHaveLength(3);
    expect(container.querySelector(".cell-brick .plate-label")?.textContent).toBe("Look de sexta · Mar/25");
    expect(Array.from(container.querySelectorAll(".logo-brick .plate-label")).map((x) => x.textContent)).toEqual([expect.stringMatching(/NIKE$/), expect.stringMatching(/ZARA$/), "+2"]);
    expect(container.querySelector(".phrase-brick")?.textContent).toBe("Frase de identidade“Menos é mais”");
    // LEGO não repete título, ocasião e frase fora dos blocos
    expect(container.querySelector(".c-title")).toBeNull();
    const plate = container.querySelector(".dna-plate");
    fireEvent.click(screen.getByRole("button", { name: "▸ montar de novo" }));
    expect(container.querySelector(".dna-plate")).not.toBe(plate);   // remonta os blocos
  });

  it("B12 sem logos, ocasião nem frase", () => {
    const { container } = narrative("LEGO", { logos: [], occasion: "", style: "", identityPhrase: null });
    expect(container.querySelector(".title-brick span")?.textContent).toBe("—");
    expect(container.querySelector(".logo-brick")?.textContent).toBe("");
    expect(container.querySelector(".phrase-brick")?.textContent).toBe("Frase de identidade“—”");
  });

  it("narrativa desconhecida cai na anatomia base", () => {
    const { container } = narrative("INVENTADA", { cardLayout: "GRADE" });
    expect(container.querySelector(".dna-container")?.getAttribute("data-label")).toBe("DNA · INVENTADA");
    expect(container.querySelectorAll(".dna-grid-cell")).toHaveLength(3);
  });
});

describe("DnaCard — arte, ações e navegação", () => {
  it("arte do Background Studio fica atrás do container, com a cor e a tinta manuais", () => {
    const { container } = render({ background: { color: "#223344", container: { color: "#101010", ink: "#FFEEDD" } } });
    const article = container.querySelector("article") as HTMLElement;
    expect(article.className).toContain("has-art");
    expect(article.getAttribute("data-art")).toBe("cor #223344");
    expect(article.style.getPropertyValue("--card-ink")).toBe("#FFEEDD");
    expect(article.style.getPropertyValue("--container-bg")).toBe("#101010");
  });

  it("arte com container manual sem tinta: a tinta legível é calculada; só tinta manual sem arte também vale", () => {
    const { container, unmount } = render({ background: { color: "#223344", container: { color: "#FFFFFF" } } });
    expect((container.querySelector("article") as HTMLElement).style.getPropertyValue("--card-ink")).toBe("#1A1714");
    unmount();
    const r = render({ background: { container: { ink: "#123456" } } });
    const article = r.container.querySelector("article") as HTMLElement;
    expect(article.className).not.toContain("has-art");
    expect(article.style.getPropertyValue("--card-ink")).toBe("#123456");
  });

  it("no feed, clicar no container (fora de botões) ou Enter abre o DNA; clicar num botão não navega", () => {
    const { container } = render({ cardLayout: "LATERAL" }, { href: "/dna-schemes/d1" });
    const box = container.querySelector(".dna-container") as HTMLElement;
    expect(box.getAttribute("role")).toBe("link");
    fireEvent.click(box.querySelector(".dna-lateral-list button")!);
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.click(box.querySelector(".c-title")!);
    expect(router.push).toHaveBeenCalledWith("/dna-schemes/d1");
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.keyDown(box, { key: "a" });
    expect(router.push).toHaveBeenCalledTimes(2);
    // a linha de ações do post aparece no card do feed
    expect(container.querySelector(".c-post")).not.toBeNull();
  });

  it("ampliado com href não navega; sem id não há ações; o extra fica dentro do card", () => {
    const { container } = render({ id: null }, { href: "/dna-schemes/d1", expanded: true, extra: <span>extra do DNA</span> });
    const box = container.querySelector(".dna-container") as HTMLElement;
    expect(box.getAttribute("role")).toBeNull();
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(router.push).not.toHaveBeenCalled();
    expect(container.querySelector(".c-post")).toBeNull();
    expect(container.querySelector(".c-extra")?.textContent).toBe("extra do DNA");
  });
});

describe("DnaCard — catálogos e utilitários", () => {
  it("rótulos de anatomia e narrativa, arte própria e score do Hype", () => {
    expect(DNA_LAYOUTS.map((l) => l.label)).toEqual(["Ampliado", "Em grade", "Na horizontal", "Na lateral"]);
    expect(DNA_LAYOUTS.every((l) => l.hint.length > 0)).toBe(true);
    expect(DNA_NARRATIVES.every((n) => n.label.length > 0 && n.hint.length > 0)).toBe(true);
    expect(dnaLayoutLabel("GRADE")).toBe("Em grade");
    expect(dnaLayoutLabel("X")).toBe("X");
    expect(dnaLayoutLabel(null)).toBe("—");
    expect(dnaNarrativeLabel("LEGO")).toBe("LEGO");
    expect(dnaNarrativeLabel(undefined)).toBe("—");
    expect(narrativeHasOwnArt("CARTELA_SAZONAL")).toBe(true);
    expect(narrativeHasOwnArt("TIMELINE")).toBe(false);
    expect(narrativeHasOwnArt(null)).toBe(false);
    expect(dnaHypeScore({ hype: { status: "AVAILABLE", score: 12 } as DnaCellView["hype"] })).toBe(12);
    expect(dnaHypeScore({ hype: { status: "AVAILABLE", score: null } as DnaCellView["hype"] })).toBeNull();
    expect(dnaHypeScore({ hype: null })).toBeNull();
  });
});

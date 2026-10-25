// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { BrandSearchInput, type BrandChoice, type BrandHit } from "./brand-search-input";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const EMPTY: BrandChoice = { brandName: "", brandLogoUrl: null, brandSource: null, brandRef: null };

const HITS: BrandHit[] = [
  { name: "Nike", description: "Marca esportiva", source: "WIKIDATA", sourceLabel: "Wikidata", ref: "Q483915", domain: "nike.com", match: "EXATO", logoUrl: "/media/nike.png", logoWideUrl: "/media/nike-wide.png", logo: { accepted: true, metrics: { larguraDaBordaFinalPx: 12 } } },
  { name: "Nikon", description: null, source: "SIMPLE_ICONS", sourceLabel: "Simple Icons", ref: null, domain: null, match: "PARCIAL", logoUrl: null, logo: { accepted: false, reason: "SEM_NITIDEZ" } },
  { name: "Nikka", source: "IA_BUSCA_WEB", sourceLabel: "IA", match: "PARCIAL", logo: { accepted: false, reason: "MOTIVO_DESCONHECIDO" } },
];

function search(query: string, results: BrandHit[] = HITS, extra: Record<string, unknown> = {}) {
  return {
    query, results, rejectedLogos: 2, note: "", cache: false, ms: 10,
    sources: [{ source: "WIKIDATA", label: "Wikidata", status: "OK", count: 1 }, { source: "SI", label: "Simple Icons", status: "SEM_RESULTADO" }, { source: "IA", label: "IA", status: "OUTRO" }],
    ...extra,
  };
}

function Harness({ initial = EMPTY, onChange }: { initial?: BrandChoice; onChange?: (v: BrandChoice) => void }) {
  const [v, setV] = useState<BrandChoice>(initial);
  return <BrandSearchInput value={v} error={undefined} onChange={(n) => { onChange?.(n); setV(n); }} />;
}

const input = () => screen.getByRole("combobox") as HTMLInputElement;

describe("BrandSearchInput (busca de marca na internet)", () => {
  it("busca o termo digitado e lista resultados com logo, monograma, motivo de recusa e fontes", async () => {
    const { calls } = mockApi({ "GET /api/brand-search": (u: URL) => search(u.searchParams.get("q")!) });
    renderApp(<Harness />);
    fireEvent.change(input(), { target: { value: "nik" } });
    expect(screen.getByText("Buscando “nik” na internet…")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Nike")).toBeTruthy());
    expect(calls.some((c) => c.path === "/api/brand-search?q=nik")).toBe(true);
    expect(screen.getByAltText("logo Nike")).toBeTruthy();
    expect(screen.getByText("Marca esportiva · nike.com")).toBeTruthy();
    expect(screen.getByText("logo recusado: sem nitidez")).toBeTruthy();
    expect(screen.getByText("MOTIVO_DESCONHECIDO")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText(/Wikidata: ok \(1\) · Simple Icons: sem resultado · IA: OUTRO · 2 logo\(s\) recusado\(s\)/)).toBeTruthy();
    expect(screen.getByText("Usar “nik” sem logo da web (monograma)")).toBeTruthy();
  });

  it("escolher um resultado com o mouse preenche nome, logo, fonte e borda do filtro", async () => {
    mockApi({ "GET /api/brand-search": (u: URL) => search(u.searchParams.get("q")!) });
    const onChange = vi.fn();
    renderApp(<Harness onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "nik" } });
    await waitFor(() => expect(screen.getByText("Nike")).toBeTruthy());
    fireEvent.mouseEnter(screen.getByText("Nike").closest("li")!);
    fireEvent.mouseDown(screen.getByText("Nike").closest("li")!);
    expect(onChange).toHaveBeenLastCalledWith({ brandName: "Nike", brandLogoUrl: "/media/nike.png", brandLogoWideUrl: "/media/nike-wide.png", brandSource: "WIKIDATA", brandRef: "Q483915", brandDomain: "nike.com", edgePx: 12 });
    expect(input().value).toBe("Nike");
    expect(screen.getByAltText("logo Nike")).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("teclado: setas navegam, Enter escolhe o item ativo e Escape fecha", async () => {
    mockApi({ "GET /api/brand-search": (u: URL) => search(u.searchParams.get("q")!) });
    const onChange = vi.fn();
    renderApp(<Harness onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "nik" } });
    await waitFor(() => expect(screen.getByText("Nikon")).toBeTruthy());
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(screen.getByText("Nikon").closest("li")!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ brandName: "Nikon", brandLogoUrl: null, brandRef: null, brandDomain: null, edgePx: null }));
    // depois de escolher, o slot mostra o monograma (sem logo)
    expect(screen.getByText("Nikon", { selector: "b.type-body-sm" })).toBeTruthy();
  });

  it("Enter no item 'usar sem logo' grava texto livre; Escape fecha a lista", async () => {
    mockApi({ "GET /api/brand-search": (u: URL) => search(u.searchParams.get("q")!, []) });
    const onChange = vi.fn();
    renderApp(<Harness onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "zzmarca" } });
    await waitFor(() => expect(screen.getByText("Nenhuma marca encontrada na internet para “zzmarca”.")).toBeTruthy());
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith({ brandName: "zzmarca", brandLogoUrl: null, brandSource: "TEXTO_LIVRE", brandRef: null });
  });

  it("clique em 'usar sem logo' com termo em branco nas pontas usa o nome aparado", async () => {
    mockApi({ "GET /api/brand-search": (u: URL) => search(u.searchParams.get("q")!, []) });
    const onChange = vi.fn();
    renderApp(<Harness onChange={onChange} />);
    fireEvent.change(input(), { target: { value: " minha marca " } });
    fireEvent.mouseEnter(screen.getByText("Usar “minha marca” sem logo da web (monograma)").closest("li")!);
    fireEvent.mouseDown(screen.getByText("Usar “minha marca” sem logo da web (monograma)").closest("li")!);
    expect(onChange).toHaveBeenLastCalledWith({ brandName: "minha marca", brandLogoUrl: null, brandSource: "TEXTO_LIVRE", brandRef: null });
  });

  it("falha na busca mostra aviso para usar o nome digitado", async () => {
    mockApi({ "GET /api/brand-search": () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "x" }), { status: 500, headers: { "content-type": "application/json" } }) });
    renderApp(<Harness />);
    fireEvent.change(input(), { target: { value: "adidas" } });
    await waitFor(() => expect(screen.getByText("Não foi possível buscar agora. Você pode usar o nome digitado.")).toBeTruthy(), { timeout: 3000 });
  });

  it("termo com menos de 2 letras não busca nem abre a lista", async () => {
    const { calls } = mockApi({});
    renderApp(<Harness />);
    fireEvent.change(input(), { target: { value: "n" } });
    await new Promise((r) => setTimeout(r, 450));
    expect(calls.filter((c) => c.path.startsWith("/api/brand-search"))).toHaveLength(0);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByText("O logo aparece aqui quando você escolhe a marca na busca.")).toBeTruthy();
    expect(screen.getByText("logo da marca", { selector: "em" })).toBeTruthy();
  });

  it("marca já escolhida: trocar limpa tudo, e digitar por cima desfaz o logo", () => {
    mockApi({});
    const onChange = vi.fn();
    const chosen: BrandChoice = { brandName: "Nike", brandLogoUrl: "/media/nike.png", brandSource: "WIKIDATA", brandRef: "Q1" };
    renderApp(<Harness initial={chosen} onChange={onChange} />);
    expect(screen.getByAltText("logo Nike").getAttribute("src")).toContain("nike.png");
    // focar com a marca escolhida não reabre a lista
    fireEvent.focus(input());
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.change(input(), { target: { value: "Nikex" } });
    expect(onChange).toHaveBeenLastCalledWith({ brandName: "Nikex", brandLogoUrl: null, brandSource: null, brandRef: null });
    fireEvent.click(screen.getByText("Trocar"));
    expect(onChange).toHaveBeenLastCalledWith({ brandName: "", brandLogoUrl: null, brandSource: null, brandRef: null });
    expect(input().value).toBe("");
  });

  it("focar um termo livre já digitado reabre a lista; blur fecha depois de um instante", async () => {
    mockApi({ "GET /api/brand-search": (u: URL) => search(u.searchParams.get("q")!, []) });
    renderApp(<Harness initial={{ brandName: "Zara", brandLogoUrl: null, brandSource: null, brandRef: null }} />);
    expect(screen.getByText("Zara", { selector: "b.type-body-sm" })).toBeTruthy();
    fireEvent.focus(input());
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.blur(input());
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("mostra a borda de erro quando recebe erro", () => {
    mockApi({});
    renderApp(<BrandSearchInput value={EMPTY} onChange={() => {}} error="obrigatório" />);
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(input().className).toContain("input-error");
  });

  it("traduz cada motivo de recusa do logo e cada estado das fontes", async () => {
    const reasons = ["RESOLUCAO_BAIXA", "FUNDO_NAO_UNIFORME", "CONTRASTE_BAIXO", "BLOCO_SOLIDO", "SEM_DESENHO", "LOGO_NAO_BAIXOU", "SEM_LOGO_NA_FONTE", "LOGO_INVALIDO", "NAO_PROCESSADO"];
    const hits: BrandHit[] = reasons.map((r, i) => ({ name: `Marca ${i}`, source: "WIKIDATA", sourceLabel: "Wikidata", ref: `Q${i}`, match: "PARCIAL", logo: { accepted: false, reason: r } }));
    mockApi({ "GET /api/brand-search": (u: URL) => search(u.searchParams.get("q")!, hits, { rejectedLogos: 0, sources: [{ source: "A", label: "A", status: "INDISPONIVEL" }, { source: "B", label: "B", status: "NAO_USADA", count: 0 }] }) });
    renderApp(<Harness />);
    fireEvent.change(input(), { target: { value: "marca" } });
    await waitFor(() => expect(screen.getByText("Marca 0")).toBeTruthy());
    for (const txt of ["logo recusado: resolução baixa", "logo recusado: não é logo (foto/banner)", "logo recusado: contraste baixo", "logo recusado: bloco sólido",
      "logo recusado: vazio", "logo não baixou", "fonte sem logo", "arquivo de logo inválido", "logo não processado"]) expect(screen.getByText(txt)).toBeTruthy();
    const src = document.querySelector(".brand-search-sources")!.textContent!;
    expect(src).toContain("B: não usada");
    expect(src).not.toContain("recusado");
    expect(src).not.toContain("(0)");
  });
});

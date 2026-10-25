// @vitest-environment jsdom
/**
 * Peça ampliada: opções do dono que faltavam ("à venda", "para doar", editar imagem escondido sem foto), edição de uma
 * peça com dados opcionais vazios, a camada AURA/Fashion Hype ligada pela peça, o visualizador 3D vazio e o DNA sem id.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import { router } from "@/test-utils/setup";
import { PIECE, SCHEME } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { tokenStore } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { ExpandedDna, ExpandedPiece } from "./expanded-card";


const model = vi.hoisted(() => ({ st: null as null | { status: string; modelUrl?: string } }));
vi.mock("@/components/model3d-panel", () => ({
  useModel3d: () => ({ st: model.st }),
  Model3dAction: ({ onView }: { onView: () => void }) => <button onClick={onView}>Ver em 3D</button>,
  Model3dTechnical: () => <p>técnico do 3D</p>,
}));
vi.mock("@/components/edit-image", async (orig) => ({
  ...(await orig<typeof import("./edit-image")>()),
  EditImageDialog: ({ open, onStudio, onApprove, onDiscard, onReplace, onManual }: { open: boolean; onStudio: (b: string) => void; onApprove: () => void; onDiscard: () => void; onReplace: (f: File) => void; onManual: () => void }) => open ? (
    <div role="dialog" aria-label="Editor de imagem">
      <button onClick={() => onStudio("white")}>Estúdio branco</button><button onClick={onApprove}>Aprovar estúdio</button><button onClick={onDiscard}>Descartar estúdio</button>
      <button onClick={() => onReplace(new File(["x"], "nova.png", { type: "image/png" }))}>Trocar pelo editor</button><button onClick={onManual}>Editor manual</button>
    </div>) : null,
}));
vi.mock("@/components/piece-art-editor", () => ({
  PieceArtDialog: ({ open, piece, onSaved, onClose }: { open: boolean; piece: PieceView; onSaved: (p: PieceView) => void; onClose: () => void }) => open ? <div role="dialog" aria-label="Arte"><button onClick={() => { onSaved({ ...piece, name: "Nome pela arte" }); onClose(); }}>Salvar arte</button></div> : null,
}));
vi.mock("@/components/generate-3d", () => ({ Generate3DDialog: ({ targets, onClose }: { targets: { title: string }[]; onClose: () => void }) => <div role="dialog" aria-label="Manequim 3D">3D de {targets[0].title}<button onClick={onClose}>Fechar 3D</button></div>, Generate3DButton: () => null }));
vi.mock("@/components/mannequin-photo", async (orig) => ({
  ...(await orig<typeof import("./mannequin-photo")>()),
  MannequinPhotoButton: () => <span>botão do manequim</span>,
  MannequinPhotoDialog: ({ onClose }: { onClose: (saved: boolean) => void }) => <div role="dialog" aria-label="Foto no manequim"><button onClick={() => onClose(true)}>Salvar foto no manequim</button></div>,
}));
vi.mock("@/components/studio", async (orig) => ({
  ...(await orig<typeof import("./studio")>()),
  StudioLightbox: ({ images, start, onClose }: { images: { alt: string }[]; start: number; onClose: () => void }) => <div role="dialog" aria-label="Tela cheia">{images.map((i) => i.alt).join(" | ")} · início {start}<button onClick={onClose}>Sair da tela cheia</button></div>,
}));
vi.mock("@/components/flair/flair-collection", () => ({ FlairPieceBlock: () => <p>carta FLAIR da peça</p> }));

const HYPE = { "GET /api/hype/summaries": { type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans"] }, colors: { white: "#fff" }, materials: ["COTTON"], sizes: ["m"], sexes: ["UNISSEX"], occasions: ["casual"], styles: ["basic"], allowedOccasionsByCategory: {} };
const piece = (extra: Partial<PieceView> = {}) => ({ ...PIECE, ...extra } as PieceView);
const openMore = async () => { fireEvent.click(await screen.findByRole("button", { name: /Mais opções/ })); };
const routes = (p: PieceView, extra: Record<string, unknown> = {}) => ({ ...HYPE, "GET /api/taxonomy": TAXONOMY, "GET /api/pieces/p1": { piece: p }, ...extra });

beforeEach(() => { __resetHypeStore(); model.st = null; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); tokenStore.clear(); router.push.mockClear(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("ExpandedPiece — mais opções do dono", () => {
  it("colocar à venda e marcar para doar mandam a flag invertida; os rótulos alternam", async () => {
    const api = loggedAs(undefined, routes(piece({ forSale: false, forDonation: false }), { "PATCH /api/pieces/p1/flags": (_u: URL, init: RequestInit) => ({ ...PIECE, forSale: false, forDonation: false, ...JSON.parse(String(init.body)) }) }));
    renderApp(<ExpandedPiece id="p1" />);
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Colocar à venda" }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "PATCH" && (c.body as { forSale?: boolean }).forSale === true)).toBe(true));
    await openMore();
    expect(await screen.findByRole("menuitem", { name: "Tirar da venda" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Marcar para doar" }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "PATCH" && (c.body as { forDonation?: boolean }).forDonation === true)).toBe(true));
    await openMore();
    expect(await screen.findByRole("menuitem", { name: "Desmarcar para doar" })).toBeTruthy();
  });

  it("peça só com a imagem padrão e sem foto: \"Editar imagem\" some do menu; com foto, abre o editor", async () => {
    loggedAs(undefined, routes(piece({ defaultImage: true, imageUrl: null as unknown as string })));
    const { unmount } = renderApp(<ExpandedPiece id="p1" />);
    await openMore();
    expect(screen.getByRole("menuitem", { name: "Editar dados" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Editar imagem" })).toBeNull();
    unmount();
    loggedAs(undefined, routes(piece({ defaultImage: true })));
    renderApp(<ExpandedPiece id="p1" />);
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar imagem" }));
    expect(screen.getByRole("dialog", { name: "Editor de imagem" })).toBeTruthy();
  });

  it("editar uma peça sem marca, material, tamanho, preço nem tags abre o formulário com os padrões", async () => {
    loggedAs(undefined, routes(piece({ brandName: null, brandId: undefined, brandLogoUrl: undefined, material: null, size: null as unknown as string, occasion: undefined, style: undefined, price: null, seals: undefined, background: undefined } as Partial<PieceView>)));
    renderApp(<ExpandedPiece id="p1" />);
    await settle();
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar dados" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar dados" });
    expect((within(dialog).getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Camiseta branca lisa");
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar dados" })).toBeNull());
  });
});

describe("ExpandedPiece — AURA e 3D", () => {
  it("AURA ligada pela peça: o card ganha a camada Fashion Hype (nível pendente sem resumo)", async () => {
    loggedAs(undefined, routes(piece({ background: { skin: "noir", auraHype: "ON" } })));
    renderApp(<ExpandedPiece id="p1" />);
    const card = await screen.findByRole("article", { name: "Camiseta branca lisa" });
    expect(card.className).toContain("is-fashion-hype");
    expect(card.getAttribute("data-fashion-level")).toBe("PENDING");
    expect(card.querySelector(".fashion-depth-glare")).not.toBeNull();
  });

  it("AURA desligada (OFF) não liga a camada; sem modelo 3D o visualizador só traz o aviso", async () => {
    model.st = { status: "PENDING" };
    loggedAs(undefined, routes(piece({ background: { auraHype: "OFF" }, model3dUrl: null } as Partial<PieceView>)));
    renderApp(<ExpandedPiece id="p1" />);
    const card = await screen.findByRole("article", { name: "Camiseta branca lisa" });
    expect(card.className).not.toContain("is-fashion-hype");
    expect(card.hasAttribute("data-fashion-level")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Ver em 3D" }));
    const dialog = await screen.findByRole("dialog", { name: /3D/ });
    expect(dialog.querySelector(".h-\\[420px\\]")).toBeNull();
  });
});

describe("ExpandedDna — sem id na resposta", () => {
  it("a barra social usa o id da rota quando o DNA chega sem id", async () => {
    const api = mockApi({ "GET /api/dna-schemes/d7": { owner: SCHEME.owner, title: "DNA sem id", palette: [], cardLayout: "GRADE", targetElement: "DNA_COMPLETO", narrativeType: null, visibility: "PUBLIC", status: "PUBLISHED", cells: [], logos: [], counters: { likes: 0, comments: 0, shares: 0, remixes: 0 }, canEdit: false } });
    const { container } = renderApp(<ExpandedDna id="d7" />);
    expect(await screen.findByRole("article", { name: "DNA de estilo: DNA sem id" })).toBeTruthy();
    expect(container.querySelector(".c-extra .c-post")).not.toBeNull();
    expect(api.calls[0].path).toBe("/api/dna-schemes/d7");
  });
});

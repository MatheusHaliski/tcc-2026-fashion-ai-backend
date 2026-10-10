// @vitest-environment jsdom
/**
 * Painel da prova no quarto: ajuda de primeiro uso com "Não mostrar novamente" (persistida por usuário), abrir à mão,
 * as roupas em mãos por lugar do corpo com Vestir/Tirar/Trocar e o estado do asset, troca em andamento, falha sem
 * julgamento e Voltar ao quarto.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen } from "@/test-utils/render";
import { MirrorHands, type MirrorHandsProps } from "./mirror-hands";
import type { AssetState, HandPiece, HandSlot } from "@/lib/room3d/mirror-session";

afterEach(() => { cleanup(); localStorage.clear(); });
const CATEGORY: Record<HandSlot, string> = { upper: "upper_piece", lower: "lower_piece", shoes: "shoes_piece", accessory: "accessory_piece" };
const piece = (id: string, slot: HandSlot, worn: boolean, asset: AssetState = "MOULD_3D"): HandPiece =>
  ({ id, name: id, slot, apiSlot: worn ? slot : null, category: CATEGORY[slot], subcategory: null, imageUrl: `/m/${id}.png`, asset, worn });
const HANDS: Record<HandSlot, HandPiece[]> = {
  upper: [piece("camiseta", "upper", false), piece("jaqueta", "upper", true)], lower: [piece("jeans", "lower", true)], shoes: [], accessory: [piece("bolsa", "accessory", true, "IMAGE_2D")],
};
const props = (over: Partial<MirrorHandsProps> = {}): MirrorHandsProps =>
  ({ phase: "tryon", hands: HANDS, busy: null, error: null, onWear: vi.fn(), onRemove: vi.fn(), onSwap: vi.fn(), onBack: vi.fn(), onOpen: vi.fn(), ...over });

describe("painel da prova no espelho", () => {
  it("no quarto: ajuda de primeiro uso até 'Não mostrar novamente' (fica guardado) e abrir o espelho à mão", async () => {
    mockApi(); const p = props({ phase: "room" }); renderApp(<MirrorHands {...p} />);
    expect(await screen.findByText("Aproxime-se do espelho para experimentar suas peças")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Não mostrar novamente" }));
    expect(screen.queryByText("Aproxime-se do espelho para experimentar suas peças")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir espelho" })); expect(p.onOpen).toHaveBeenCalledTimes(1);
    cleanup(); renderApp(<MirrorHands {...props({ phase: "room" })} />);
    expect(await screen.findByRole("button", { name: "Abrir espelho" })).toBeTruthy();
    expect(screen.queryByText("Aproxime-se do espelho para experimentar suas peças")).toBeNull();
    expect(screen.queryByRole("region", { name: "Roupas em mãos" })).toBeNull();
  });
  it("chegando e saindo: só o estado, sem lista", () => {
    mockApi(); renderApp(<MirrorHands {...props({ phase: "approach" })} />);
    expect(screen.getByRole("status").textContent).toBe("Chegando ao espelho…");
    cleanup(); renderApp(<MirrorHands {...props({ phase: "exit" })} />);
    expect(screen.getByRole("status").textContent).toBe("Saindo do espelho…");
  });
  it("na prova: os quatro lugares, a peça na mão com Vestir, as vestidas com Tirar, o estado do asset, Trocar e Voltar", () => {
    mockApi(); const p = props(); renderApp(<MirrorHands {...p} />);
    for (const name of ["Parte de cima", "Parte de baixo", "Calçado", "Acessório"]) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getAllByText("Nada vestido aqui")).toHaveLength(1);                           // só o calçado está vazio
    expect(screen.getAllByText("Molde 3D (aproximação)")).toHaveLength(3); expect(screen.getByText("Só na prévia 2D")).toBeTruthy();
    expect(screen.getByText(/· Na mão$/)).toBeTruthy(); expect(screen.getAllByText(/· No espelho$/)).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Vestir · camiseta" })); expect(p.onWear).toHaveBeenCalledWith(expect.objectContaining({ id: "camiseta", worn: false }));
    fireEvent.click(screen.getByRole("button", { name: "Tirar · jaqueta" })); expect(p.onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "jaqueta" }));
    fireEvent.click(screen.getByRole("button", { name: "Trocar · Calçado" })); expect(p.onSwap).toHaveBeenCalledWith("shoes");
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao quarto" })); expect(p.onBack).toHaveBeenCalledTimes(1);
  });
  it("troca em andamento desabilita as ações e diz o lugar; falha avisa sem opinar; sucesso descreve o que mudou", () => {
    mockApi(); renderApp(<MirrorHands {...props({ busy: "lower" })} />);
    expect(screen.getByRole("status").textContent).toBe("Trocando Parte de baixo…");
    for (const b of screen.getAllByRole("button")) if (b.textContent !== "Voltar ao quarto") expect((b as HTMLButtonElement).disabled).toBe(true);
    cleanup(); renderApp(<MirrorHands {...props({ error: "sem rede" })} />);
    expect(screen.getByRole("alert").textContent).toBe("Não deu para trocar (sem rede); a peça anterior continua.");
    cleanup(); renderApp(<MirrorHands {...props({ changed: { slot: "upper", name: "camiseta" } })} />);
    expect(screen.getByRole("status").textContent).toBe("Pronto: camiseta no espelho.");
  });
});

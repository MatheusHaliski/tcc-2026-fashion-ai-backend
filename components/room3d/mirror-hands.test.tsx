// @vitest-environment jsdom
/**
 * Estado da prova no quarto: ajuda de primeiro uso com "Não mostrar novamente" (persistida por usuário), chegando/saindo,
 * e na prova só "Voltar ao quarto" e o que aconteceu na troca — as roupas em mãos não se repetem aqui (ficam nas células
 * e na folha da parte do painel do Espelho).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen } from "@/test-utils/render";
import { MirrorHands, type MirrorHandsProps } from "./mirror-hands";

afterEach(() => { cleanup(); localStorage.clear(); });
const props = (over: Partial<MirrorHandsProps> = {}): MirrorHandsProps => ({ phase: "tryon", busy: null, error: null, onBack: vi.fn(), ...over });

describe("estado da prova no espelho", () => {
  it("no quarto: ajuda de primeiro uso até 'Não mostrar novamente' (fica guardado); sem botão próprio de abrir (o caminho é Ir ao espelho)", async () => {
    mockApi(); const { container } = renderApp(<MirrorHands {...props({ phase: "room" })} />);
    expect(await screen.findByText("Aproxime-se do espelho para experimentar suas peças")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Abrir espelho/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Não mostrar novamente" }));
    expect(screen.queryByText("Aproxime-se do espelho para experimentar suas peças")).toBeNull();
    expect(container.textContent).toBe("");
    cleanup(); renderApp(<MirrorHands {...props({ phase: "room" })} />);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByText("Aproxime-se do espelho para experimentar suas peças")).toBeNull();
  });
  it("chegando e saindo: só o estado; saindo andando (a cena já avisa), não repete", () => {
    mockApi(); renderApp(<MirrorHands {...props({ phase: "approach" })} />);
    expect(screen.getByRole("status").textContent).toBe("Chegando ao espelho…");
    cleanup(); renderApp(<MirrorHands {...props({ phase: "exit" })} />);
    expect(screen.getByRole("status").textContent).toBe("Saindo do espelho…");
    cleanup(); renderApp(<MirrorHands {...props({ phase: "exit", walking: "away" })} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("na prova: sem a lista por lugar do corpo (nada de Vestir/Tirar/Trocar aqui), com a dica das partes e Voltar ao quarto", () => {
    mockApi(); const p = props(); const { container } = renderApp(<MirrorHands {...p} />);
    for (const name of ["Parte de cima", "Parte de baixo", "Calçado", "Acessório"]) expect(screen.queryByText(name)).toBeNull();
    expect(screen.queryByRole("button", { name: /^(Vestir|Tirar|Trocar)/ })).toBeNull();
    expect(container.querySelectorAll("img, li")).toHaveLength(0);
    expect(screen.getByText(/toque numa parte para vestir, tirar ou trocar/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao quarto" })); expect(p.onBack).toHaveBeenCalledTimes(1);
    cleanup(); renderApp(<MirrorHands {...props({ walking: "away" })} />);
    expect(screen.getByText("Saindo do espelho…")).toBeTruthy();
  });
  it("troca em andamento diz o lugar; falha avisa sem opinar; sucesso descreve o que mudou", () => {
    mockApi(); renderApp(<MirrorHands {...props({ busy: "lower" })} />);
    expect(screen.getByRole("status").textContent).toBe("Trocando Parte de baixo…");
    cleanup(); renderApp(<MirrorHands {...props({ error: "sem rede" })} />);
    expect(screen.getByRole("alert").textContent).toBe("Não deu para trocar (sem rede); a peça anterior continua.");
    cleanup(); renderApp(<MirrorHands {...props({ changed: { slot: "upper", name: "camiseta" } })} />);
    expect(screen.getByRole("status").textContent).toBe("Pronto: camiseta no espelho.");
  });
});

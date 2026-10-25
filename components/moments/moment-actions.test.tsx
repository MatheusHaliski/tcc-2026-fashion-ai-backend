// @vitest-environment jsdom
/**
 * Participar e enviar look: escolha de abordagem e de "só guarda-roupa", envio com desafio, prévia de MomentMatch e
 * FAI Points (linhas de desafio, sem pontos, já enviado), erros; e os blocos de scores/match usados na prévia.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { JoinDialog, SubmitDialog } from "@/components/moments/moment-actions";
import { MomentContextRows, MomentMatchBreakdown, MomentScoreGrid } from "@/components/moments/moment-scores";
import type { MomentDetail } from "@/lib/moments/types";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const time = { status: "ACTIVE", now: "2026-10-25T00:00:00Z", startAt: "2026-10-20T03:00:00Z", endAt: "2026-11-01T02:59:59Z", timezone: "UTC", localStart: "2026-10-20", localEnd: "2026-10-31", startsInSeconds: 0, endsInSeconds: 86400, elapsed: 0.5 };
const M = { id: "m1", slug: "halloween", name: "Halloween", type: "CULTURAL", nature: "CULTURAL", scope: "GLOBAL", visibility: "PUBLIC", official: true, featured: false, sponsored: false, pointsEnabled: true, basePoints: 10, pointsMultiplier: 1, styleTags: [], occasionTags: [], colorTags: [], theme: {}, time,
  interpretations: [], challenges: [{ id: "c1", code: "NO_BUY", name: "No-Buy", description: "Só o guarda-roupa", kind: "NO_BUY", points: 40, styleTags: [], colorTags: [], occasionTags: [], params: {}, active: true }],
  rules: {}, settings: {}, requiredItems: [], suggestedItems: [], bonusRules: { wardrobe: 30 }, sensitive: false, competitive: true, cooperative: false, isCreator: false, isMember: true, stats: {} } as unknown as MomentDetail;
const fail = (message: string) => () => new Response(JSON.stringify({ status: 500, code: "ERRO", message }), { status: 500, headers: { "content-type": "application/json" } });
const LOOKS = [{ id: "l1", title: "Look preto", coverImageUrl: "/c.jpg", status: "PUBLISHED", visibility: "PUBLIC", sent: false }, { id: "l2", title: "Look antigo", status: "PUBLISHED", visibility: "PUBLIC", sent: true }];

describe("JoinDialog", () => {
  it("parte da participação atual, escolhe descoberta + catálogo e mostra a mensagem do servidor", async () => {
    const onJoined = vi.fn(); const onClose = vi.fn();
    const { calls } = mockApi({ "POST /api/moments/halloween/join": { message: "Bem-vinda!" } });
    renderApp(<JoinDialog moment={{ ...M, sensitive: true, me: { approach: "EXPERIMENTAL", wardrobeOnly: false } as never }} open onClose={onClose} onJoined={onJoined} />);
    expect(screen.getByRole("radio", { name: /Experimental/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Meu guarda-roupa \+ catálogo/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/significado religioso/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Descoberta/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Somente meu guarda-roupa · \+30/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Meu guarda-roupa \+ catálogo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Participar" }));
    expect(await screen.findByText("Bem-vinda!")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ approach: "DISCOVERY", wardrobeOnly: false });
    expect(onJoined).toHaveBeenCalled(); expect(onClose).toHaveBeenCalled();
  });

  it("sem pontos esconde a escolha de guarda-roupa; sem mensagem usa o texto padrão; erro não fecha", async () => {
    mockApi({ "POST /api/moments/halloween/join": {} });
    renderApp(<JoinDialog moment={{ ...M, pointsEnabled: false, bonusRules: undefined as never }} open onClose={() => {}} onJoined={() => {}} />);
    expect(screen.queryByText("Usar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Participar" }));
    expect(await screen.findByText("Você está dentro.")).toBeTruthy();
    cleanup();
    const onJoined = vi.fn();
    mockApi({ "POST /api/moments/halloween/join": fail("Fechado") });
    renderApp(<JoinDialog moment={{ ...M, bonusRules: {} }} open onClose={() => {}} onJoined={onJoined} />);
    expect(screen.getByRole("radio", { name: /\+25/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Participar" }));
    expect(await screen.findByText("Fechado")).toBeTruthy();
    expect(onJoined).not.toHaveBeenCalled();
  });
});

describe("SubmitDialog", () => {
  it("escolhe look e desafio, vê a prévia (match, partes, pontos) e envia", async () => {
    const onSubmitted = vi.fn();
    const { calls } = mockApi({ "GET /api/moments/halloween/looks": LOOKS,
      "POST /api/moments/halloween/preview": { match: { score: 82, parts: { styleMatch: 90, colorMatch: 120 }, interpretation: "dark", reasons: [] }, scores: { hype: 61.6, moment: 82, contextualHype: null }, points: [{ action: "SUBMIT", points: 20, ref: "a", label: "submit" }, { action: "CH", points: 40, ref: "b", label: "challenge:NO_BUY" }], pointsTotal: 60, explanation: [{ kind: "style", values: ["edgy"] }], alreadySubmitted: false, wardrobeOnly: true, rediscovered: ["p1", "p2"], newStyles: [] },
      "POST /api/moments/halloween/submit": { message: "Enviado!" } });
    renderApp(<SubmitDialog moment={M} open onClose={() => {}} onSubmitted={onSubmitted} />);
    const sent = await screen.findByRole("radio", { name: /Look antigo/ });
    expect((sent as HTMLButtonElement).disabled).toBe(true);
    expect(sent.getAttribute("title")).toBe("Este look já participa deste Momento.");
    const preview = screen.getByRole("button", { name: "Ver MomentMatch e pontos" }) as HTMLButtonElement;
    expect(preview.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Look preto/ }));
    fireEvent.click(screen.getByRole("radio", { name: /No-Buy · \+40/ }));
    fireEvent.click(preview);
    expect(await screen.findByText("82", { selector: "b" })).toBeTruthy();
    expect(screen.getByText("leitura: dark")).toBeTruthy();
    expect(screen.getByText("Estilos")).toBeTruthy();
    expect(screen.getByText("Forte associação ao tema pelos estilos Ousado.")).toBeTruthy();
    expect(screen.getByText("62")).toBeTruthy();   // hype arredondado
    expect(screen.getByText("Desafio NO_BUY")).toBeTruthy();
    expect(screen.getByText("+60 FAI Points")).toBeTruthy();
    expect(screen.getByText("Só peças que você já tinha: Wardrobe Bonus.")).toBeTruthy();
    expect(screen.getByText("2 peças redescobertas")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/preview"))!.body).toEqual({ schemeId: "l1", challengeId: "c1" });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Enviado!")).toBeTruthy();
    expect(onSubmitted).toHaveBeenCalled();
    // trocar o desafio descarta a prévia
    fireEvent.click(screen.getByRole("radio", { name: "Só o Momento" }));
    expect(await screen.findByRole("button", { name: "Ver MomentMatch e pontos" })).toBeTruthy();
  });

  it("prévia sem pontos (desligado/ligado), já enviado e erros de prévia e envio", async () => {
    const base = { match: null, points: [], pointsTotal: 0, explanation: [], wardrobeOnly: false, rediscovered: [], newStyles: [] };
    let already = true;
    mockApi({ "GET /api/moments/halloween/looks": LOOKS, "POST /api/moments/halloween/preview": () => ({ ...base, alreadySubmitted: already }), "POST /api/moments/halloween/submit": fail("Envio falhou") });
    renderApp(<SubmitDialog moment={{ ...M, pointsEnabled: false, challenges: [] }} open onClose={() => {}} onSubmitted={() => {}} />);
    fireEvent.click(await screen.findByRole("radio", { name: /Look preto/ }));
    expect(screen.queryByText("Desafio (opcional)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver MomentMatch e pontos" }));
    expect(await screen.findByText("Este Momento não distribui FAI Points.")).toBeTruthy();
    expect(screen.getByText(/Sem base para calcular o MomentMatch/)).toBeTruthy();
    expect(screen.getAllByText("Este look já participa deste Momento.").length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Enviar" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    already = false;
    mockApi({ "GET /api/moments/halloween/looks": LOOKS, "POST /api/moments/halloween/preview": () => ({ ...base, alreadySubmitted: false }), "POST /api/moments/halloween/submit": fail("Envio falhou") });
    renderApp(<SubmitDialog moment={M} open onClose={() => {}} onSubmitted={() => {}} />);
    fireEvent.click(await screen.findByRole("radio", { name: /Look preto/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ver MomentMatch e pontos" }));
    expect(await screen.findByText(/Este look ainda não pontua aqui/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Envio falhou")).toBeTruthy();
    cleanup();
    mockApi({ "GET /api/moments/halloween/looks": LOOKS, "POST /api/moments/halloween/preview": fail("Prévia falhou") });
    renderApp(<SubmitDialog moment={M} open onClose={() => {}} onSubmitted={() => {}} />);
    fireEvent.click(await screen.findByRole("radio", { name: /Look preto/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ver MomentMatch e pontos" }));
    expect(await screen.findByText("Prévia falhou")).toBeTruthy();
  });

  it("sem looks (ou falha ao listar) mostra o convite a criar; fechado não busca", async () => {
    const { calls } = mockApi({ "GET /api/moments/halloween/looks": fail("x") });
    const { rerender } = renderApp(<SubmitDialog moment={M} open={false} onClose={() => {}} onSubmitted={() => {}} />);
    await waitFor(() => expect(calls.length).toBe(0));
    rerender(<SubmitDialog moment={M} open onClose={() => {}} onSubmitted={() => {}} />);
    expect(await screen.findByText("Você ainda não tem looks. Crie um primeiro.")).toBeTruthy();
  });
});

describe("MomentScoreGrid, MomentMatchBreakdown e MomentContextRows", () => {
  it("grade: nada sem scores; '—' sem base; estilo só com compatibilidade", () => {
    const { container } = renderApp(<MomentScoreGrid scores={null} />);
    expect(container.textContent).toBe("");
    cleanup();
    renderApp(<MomentScoreGrid scores={{ hype: null, moment: 70.4, reuse: 3 }} compatibility={null} />);
    expect(screen.queryByText("Seu estilo")).toBeNull();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("70")).toBeTruthy();
    expect(screen.queryByText("Redescoberta")).toBeNull();
    cleanup();
    renderApp(<MomentScoreGrid scores={{}} compatibility={55} />);
    expect(screen.getByText("Seu estilo")).toBeTruthy();
    expect(screen.getByText("55")).toBeTruthy();
  });

  it("match sem partes nem explicação mostra só o número e o aviso", () => {
    renderApp(<MomentMatchBreakdown match={{ score: 40 }} explanation={[]} />);
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.queryByLabelText("Dimensões do MomentMatch")).toBeNull();
    expect(screen.getByText(/mede associação, não correção/)).toBeTruthy();
  });

  it("contexto: some quando a API falha ou não há Momentos", async () => {
    mockApi({ "GET /api/moments/context/PIECE/p1": { type: "PIECE", id: "p1", moments: [] } });
    const a = renderApp(<MomentContextRows type="PIECE" id="p1" />);
    await waitFor(() => expect(a.container.textContent).toBe(""));
    cleanup();
    const { calls } = mockApi({});
    const b = renderApp(<MomentContextRows type="PIECE" id="p2" />);
    await waitFor(() => expect(calls.length).toBe(1));
    expect(b.container.textContent).toBe("");
  });
});

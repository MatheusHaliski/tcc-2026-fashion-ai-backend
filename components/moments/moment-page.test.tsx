// @vitest-environment jsdom
/**
 * MomentPage genérica: ações por estado (ativo/agendado/encerrado, com e sem participação, sem sessão), salvar lembrete,
 * sair, aba inicial pela URL, visão geral completa (regras, fonte, meus looks, grupo) e desafios com parâmetros.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { MomentPage } from "@/components/moments/moment-page";

vi.mock("@/components/scheme-card", () => ({ SchemeCard: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const time = { status: "ACTIVE", now: "2026-10-25T00:00:00Z", startAt: "2026-10-20T03:00:00Z", endAt: "2026-11-01T02:59:59Z", timezone: "UTC", localStart: "2026-10-20", localEnd: "2026-10-31", startsInSeconds: 0, endsInSeconds: 86400 * 2, elapsed: 0.5 };
const D = { id: "m1", slug: "baile", name: "Baile", type: "CULTURAL", nature: "CULTURAL", scope: "GLOBAL", visibility: "PUBLIC", official: true, featured: false, sponsored: false, pointsEnabled: false, basePoints: 10, pointsMultiplier: 1, styleTags: [], occasionTags: [], colorTags: [], theme: {}, time,
  interpretations: [], challenges: [], rules: {}, settings: {}, requiredItems: [], suggestedItems: [], bonusRules: {}, sensitive: false, competitive: false, cooperative: false, isCreator: false, isMember: false, stats: {}, me: null };
const fail = () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "Deu ruim" }), { status: 500, headers: { "content-type": "application/json" } });
const scheduled = { ...time, status: "SCHEDULED", startsInSeconds: 86400 * 3 };

describe("MomentPage — ações por estado", () => {
  it("sem sessão: botão Entrar com volta para o Momento e caminhos de criar", async () => {
    mockApi({ "GET /api/moments/baile": D });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect((await screen.findByRole("link", { name: "Entrar" })).getAttribute("href")).toBe("/login?next=/moments/baile");
    expect(screen.getByRole("link", { name: "Criar look" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Participar" })).toBeNull();
  });

  it("ativo com participação: enviar look abre o envio, sair chama a API e avisa", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/moments/baile": { ...D, me: { status: "JOINED", approach: "DISCOVERY", wardrobeOnly: true, remind: false, pointsEarned: 30, bestMatch: 77, badgeCode: "B", publicOnProfile: true, outcome: "PARTICIPATED" } },
      "POST /api/moments/baile/leave": {}, "GET /api/moments/baile/looks": [] });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect(await screen.findByRole("button", { name: "Sair do Momento" })).toBeTruthy();
    expect(screen.getAllByText("Participando").length).toBe(2);
    expect(screen.getByText("Descoberta")).toBeTruthy();
    expect(screen.getByText("+30 FAI Points")).toBeTruthy();
    expect(screen.getByText("Momento 77")).toBeTruthy();
    expect(screen.getByText("Insígnia")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar look" }));
    expect(await screen.findByText("Enviar look para Baile")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair do Momento" }));
    expect(await screen.findByText("Você saiu do Momento.")).toBeTruthy();
    expect(calls.some((c) => c.path === "/api/moments/baile/leave")).toBe(true);
  });

  it("ativo concluído não oferece sair; erro ao sair vira aviso", async () => {
    loggedAs(undefined, { "GET /api/moments/baile": { ...D, me: { status: "COMPLETED", outcome: "WINNER", approach: "MY_STYLE", pointsEarned: 0, remind: false, wardrobeOnly: false, publicOnProfile: true } } });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect((await screen.findAllByText("Vencedor")).length).toBeGreaterThan(0);
    expect(screen.getByText("Meu estilo")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sair do Momento" })).toBeNull();
    cleanup();
    loggedAs(undefined, { "GET /api/moments/baile": { ...D, me: { status: "SUBMITTED", outcome: "PARTICIPATED", approach: "EXPERIMENTAL", pointsEarned: 0, remind: false, wardrobeOnly: false, publicOnProfile: true } }, "POST /api/moments/baile/leave": fail });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect(await screen.findByText("Experimental")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sair do Momento" }));
    expect(await screen.findByText("Deu ruim")).toBeTruthy();
  });

  it("agendado sem participação: lembrar-me (PUT remind) e preparar abre o diálogo de participar", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/moments/baile": { ...D, time: scheduled }, "PUT /api/moments/baile/save": {} });
    renderApp(<MomentPage idOrSlug="baile" />);
    fireEvent.click(await screen.findByRole("button", { name: "Lembrar-me" }));
    expect(await screen.findByText("Salvo no seu calendário.")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/moments/baile/save")!.body).toEqual({ remind: true });
    fireEvent.click(screen.getByRole("button", { name: "Preparar look" }));
    expect(await screen.findByText("Participar de Baile")).toBeTruthy();
  });

  it("agendado e salvo: remover lembrete (DELETE) e falha ao salvar/remover vira aviso", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/moments/baile": { ...D, time: scheduled, me: { status: "INTERESTED", remind: true, outcome: "PARTICIPATED", pointsEarned: 0, wardrobeOnly: false, publicOnProfile: false } }, "DELETE /api/moments/baile/save": {} });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect((await screen.findAllByText("Lembrete ativo")).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Remover lembrete" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    cleanup();
    loggedAs(undefined, { "GET /api/moments/baile": { ...D, time: scheduled, me: { status: "JOINED", remind: false, outcome: "PARTICIPATED", pointsEarned: 0, wardrobeOnly: false, publicOnProfile: false } }, "DELETE /api/moments/baile/save": fail });
    renderApp(<MomentPage idOrSlug="baile" />);
    fireEvent.click(await screen.findByRole("button", { name: "Remover lembrete" }));
    expect(await screen.findByText("Deu ruim")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Preparar look" })).toBeNull();
    cleanup();
    loggedAs(undefined, { "GET /api/moments/baile": { ...D, time: scheduled }, "PUT /api/moments/baile/save": fail });
    renderApp(<MomentPage idOrSlug="baile" />);
    fireEvent.click(await screen.findByRole("button", { name: "Lembrar-me" }));
    expect(await screen.findByText("Deu ruim")).toBeTruthy();
  });

  it("encerrado: sem criar/copilot/bônus, com aba Memória aberta pela URL", async () => {
    nav.search = new URLSearchParams("tab=memory");
    mockApi({ "GET /api/moments/baile": { ...D, pointsEnabled: true, pointsMultiplier: 2, time: { ...time, status: "ENDED", endsInSeconds: 0 }, memory: { participants: 3, looks: 2, votes: 1 } } });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect(await screen.findByText("Participantes")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Memória/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("link", { name: "Criar look" })).toBeNull();
    expect(screen.queryByText("+100% FAI Points")).toBeNull();
  });

  it("aba inválida na URL cai na visão geral; erro de carga mostra tentar de novo", async () => {
    nav.search = new URLSearchParams("tab=xyz");
    mockApi({ "GET /api/moments/baile": D });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect((await screen.findByRole("tab", { name: /Visão geral/ })).getAttribute("aria-selected")).toBe("true");
    cleanup();
    mockApi({ "GET /api/moments/baile": fail });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });
});

describe("MomentPage — conteúdo", () => {
  const FULL = { ...D, description: "Noite de gala", sponsored: true, sponsorName: "Marca X", nature: "RELIGIOUS", visibility: "GROUP", sensitive: true, pointsEnabled: true, pointsMultiplier: 1.5, cooperative: true,
    styleTags: ["edgy"], colorTags: ["black"], occasionTags: ["party"], interpretations: [{ key: "gala", label: null, styleTags: [], colorTags: [] }, { key: "dark", label: "Dark", styleTags: ["edgy"], colorTags: ["black"] }],
    rules: { text: "Só preto", theme: "Gala" }, requiredItems: ["dress"], suggestedItems: ["heels"], sourceUrl: "https://ex.com/f", sourceNote: "Calendário oficial", bonusRules: { wardrobe: 25 },
    stats: { participants: 10, looks: 2 }, group: { id: "g1", name: "Amigas" }, participants: [{ user: { id: "u9", username: "bia" }, status: "SUBMITTED" }],
    mySubmissions: [{ id: "s1", schemeId: "sc1", match: 70, matchDetail: { score: 70 }, wardrobeOnly: false, rediscovered: 0, votes: 2, votedByMe: false, submittedAt: "", mine: true }],
    challenges: [{ id: "c1", code: "A", name: "Uma peça, vários looks", description: "Repita a peça", kind: "STYLE", points: 15, styleTags: ["edgy"], colorTags: [], occasionTags: [], params: { looksRequired: 3, idleDays: 90 }, active: true },
      { id: "c2", code: "B", name: "Simples", kind: "NO_BUY", points: 5, styleTags: [], colorTags: [], occasionTags: [], params: {}, active: true }] };

  it("visão geral com tudo: interpretações, tags, regras, fonte, pontos, meus looks e grupo", async () => {
    loggedAs(undefined, { "GET /api/moments/baile": FULL });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect(await screen.findByText("Noite de gala")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Amigas" }).getAttribute("href")).toBe("/moments?tab=flair");
    expect(screen.getByText("Patrocinado · Marca X")).toBeTruthy();
    expect(screen.getByText("religioso")).toBeTruthy();
    expect(screen.getByText("+50% FAI Points")).toBeTruthy();
    expect(screen.getByText("10 participantes")).toBeTruthy();
    expect(screen.getByText("gala")).toBeTruthy();
    expect(screen.getAllByText(/Ousado/).length).toBeGreaterThan(0);
    expect(screen.getByText("Só preto")).toBeTruthy();
    expect(screen.getByText("Gala")).toBeTruthy();
    expect(screen.getByText("Peças obrigatórias:")).toBeTruthy();
    expect(screen.getByText("Peças sugeridas:")).toBeTruthy();
    expect(screen.getByText("Calendário oficial")).toBeTruthy();
    expect(screen.getByRole("link", { name: "https://ex.com/f" })).toBeTruthy();
    expect(screen.getAllByText("+15").length).toBe(2);   // look (10 × 1,5) e o desafio
    expect(screen.getByText("Wardrobe Bonus · só peças que você já tem")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Look" }).getAttribute("href")).toBe("/schemes/sc1");
    expect(screen.getByText(/@bia/)).toBeTruthy();
    expect(screen.getByText("· look enviado")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Meta do grupo/ })).toBeTruthy();
  });

  it("desafios: parâmetros e 'Enviar look' só para quem participa de Momento ativo", async () => {
    nav.search = new URLSearchParams("tab=challenges");
    loggedAs(undefined, { "GET /api/moments/baile": { ...FULL, me: { status: "JOINED", outcome: "PARTICIPATED", pointsEarned: 0, remind: false, wardrobeOnly: true, publicOnProfile: true } }, "GET /api/moments/baile/looks": [] });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect(await screen.findByText("3 looks com a mesma peça")).toBeTruthy();
    expect(screen.getByText("peça sem uso há mais de 90 dias")).toBeTruthy();
    expect(screen.getByText("Repita a peça")).toBeTruthy();
    expect(screen.getByText("No-Buy · só o seu guarda-roupa")).toBeTruthy();
    const sends = screen.getAllByRole("button", { name: "Enviar look" });
    expect(sends.length).toBe(3);
    fireEvent.click(sends[1]);
    expect(await screen.findByText("Enviar look para Baile")).toBeTruthy();
    cleanup();
    nav.search = new URLSearchParams("tab=challenges");
    mockApi({ "GET /api/moments/baile": FULL });
    renderApp(<MomentPage idOrSlug="baile" />);
    expect(await screen.findByText("Simples")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar look" })).toBeNull();
  });

  it("aba comunidade e ranking carregam feed e ranking", async () => {
    const { calls } = mockApi({ "GET /api/moments/baile": FULL, "GET /api/moments/baile/feed": { items: [], dimensions: [] }, "GET /api/moments/baile/leaderboard": { competitive: false, items: [] } });
    renderApp(<MomentPage idOrSlug="baile" />);
    fireEvent.click(await screen.findByRole("tab", { name: /Comunidade/ }));
    expect(await screen.findByText("Ainda não há looks neste Momento.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Meta do grupo/ }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith("/leaderboard"))).toBe(true));
  });
});

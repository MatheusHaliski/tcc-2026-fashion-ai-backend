// @vitest-environment jsdom
/**
 * Comunidade do Momento: feed com voto por dimensão (nunca no próprio look), ranking (competitivo, cooperativo,
 * desligado/sensível), "Em alta" e a Memória com os destaques.
 */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { SCHEME } from "@/test-utils/fixtures";
import { MomentFeed, MomentLeaderboard, MomentMemoryView, MomentTrending } from "@/components/moments/moment-community";
import type { MomentDetail } from "@/lib/moments/types";

vi.mock("@/components/scheme-card", () => ({ SchemeCard: ({ scheme }: { scheme: { title: string }; extra?: ReactNode }) => <p>card {scheme.title}</p> }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const time = { status: "ACTIVE", now: "2026-10-25T00:00:00Z", startAt: "2026-10-20T03:00:00Z", endAt: "2026-11-01T02:59:59Z", timezone: "America/Sao_Paulo", localStart: "2026-10-20", localEnd: "2026-10-31", startsInSeconds: 0, endsInSeconds: 86400, elapsed: 0.5 };
const M = { id: "m1", slug: "halloween", name: "Halloween", type: "CULTURAL", nature: "CULTURAL", scope: "GLOBAL", visibility: "PUBLIC", official: true, featured: false, sponsored: false, pointsEnabled: true, basePoints: 10, pointsMultiplier: 1, styleTags: [], occasionTags: [], colorTags: [], theme: {}, time,
  interpretations: [], challenges: [], rules: {}, settings: {}, requiredItems: [], suggestedItems: [], bonusRules: {}, sensitive: false, competitive: true, cooperative: false, isCreator: false, isMember: true, stats: {} } as unknown as MomentDetail;
const sub = (o: object) => ({ id: "s1", schemeId: "sc1", match: 80, wardrobeOnly: false, rediscovered: 0, votes: 3, votedByMe: false, submittedAt: "2026-10-21", mine: false, ...o });
const fail = () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "Falhou feio" }), { status: 500, headers: { "content-type": "application/json" } });

describe("MomentFeed", () => {
  it("logado em Momento ativo e competitivo: vota por dimensão, recarrega e bloqueia o próprio look", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/moments/halloween/feed": { items: [sub({ scheme: { ...SCHEME, title: "Look Noite" }, contextualHype: 77, wardrobeOnly: true, rediscovered: 2 }), sub({ id: "s2", match: null, mine: true, votedByMe: true })], dimensions: [] },
      "POST /api/moments/halloween/votes": {},
    });
    renderApp(<MomentFeed moment={M} />);
    expect(await screen.findByText("card Look Noite")).toBeTruthy();
    expect(screen.getByText("Look indisponível.")).toBeTruthy();
    expect(screen.getByText("Hype no Momento 77")).toBeTruthy();
    expect(screen.getByText("só guarda-roupa")).toBeTruthy();
    expect(screen.getByText("2 redescoberta(s)")).toBeTruthy();
    expect(screen.getByText("Momento —")).toBeTruthy();
    expect(document.querySelector(".moment-entry.is-mine")).toBeTruthy();
    const elegant = screen.getAllByRole("button", { name: "Elegante" });
    await waitFor(() => expect((elegant[0] as HTMLButtonElement).disabled).toBe(false));
    expect((elegant[1] as HTMLButtonElement).disabled).toBe(true);
    expect(elegant[1].getAttribute("title")).toBe("Não dá para votar no próprio look.");
    fireEvent.click(elegant[0]);
    await waitFor(() => expect(calls.find((c) => c.path.endsWith("/votes"))?.body).toEqual({ submissionId: "s1", dimension: "ELEGANT" }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/moments/halloween/feed").length).toBeGreaterThan(1));
  });

  it("erro ao votar vira aviso; Momento não competitivo não mostra votação", async () => {
    loggedAs(undefined, { "GET /api/moments/halloween/feed": { items: [sub({})], dimensions: [] }, "POST /api/moments/halloween/votes": fail });
    renderApp(<MomentFeed moment={M} />);
    const btn = (await screen.findAllByRole("button", { name: "Trend" }))[0];
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(btn);
    expect(await screen.findByText("Falhou feio")).toBeTruthy();
    cleanup();
    loggedAs(undefined, { "GET /api/moments/halloween/feed": { items: [sub({})], dimensions: [] } });
    renderApp(<MomentFeed moment={{ ...M, competitive: false }} />);
    expect(await screen.findByText("Momento 80")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Votar neste look" })).toBeNull();
  });

  it("feed vazio e erro com tentar de novo", async () => {
    mockApi({ "GET /api/moments/halloween/feed": { items: [], dimensions: [] } });
    renderApp(<MomentFeed moment={M} />);
    expect(await screen.findByText("Ainda não há looks neste Momento.")).toBeTruthy();
    cleanup();
    mockApi({ "GET /api/moments/halloween/feed": fail });
    renderApp(<MomentFeed moment={M} />);
    expect(await screen.findByText("Falhou feio")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });
});

describe("MomentLeaderboard", () => {
  it("competitivo: posições, você, anônimo, capa e match", async () => {
    mockApi({ "GET /api/moments/halloween/leaderboard": { competitive: true, items: [
      { position: 1, submissionId: "s1", schemeId: "sc1", votes: 9, match: 91, byDimension: {}, you: true, user: { id: "u1", username: "ana", displayName: "Ana" }, title: "Noite", coverImageUrl: "/media/a.jpg" },
      { position: 2, submissionId: "s2", schemeId: "sc2", votes: 4, match: null, byDimension: {}, you: false, user: null },
    ] } });
    renderApp(<MomentLeaderboard moment={M} />);
    expect(await screen.findByLabelText("Posição 1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Noite" }).getAttribute("href")).toBe("/schemes/sc1");
    expect(screen.getByRole("link", { name: "Look" }).getAttribute("href")).toBe("/schemes/sc2");
    expect(screen.getByText(/@ana · você/)).toBeTruthy();
    expect(screen.getByText("votação anônima")).toBeTruthy();
    expect(screen.getByText("9 votos")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(document.querySelector(".moment-rank.is-you img")).toBeTruthy();
  });

  it("vazio, cooperativo (barra limitada a 100%), sensível e desligado", async () => {
    mockApi({ "GET /api/moments/halloween/leaderboard": { competitive: true, items: [] } });
    renderApp(<MomentLeaderboard moment={M} />);
    expect(await screen.findByText("Sem looks no ranking ainda.")).toBeTruthy();
    cleanup();
    mockApi({ "GET /api/moments/halloween/leaderboard": { competitive: false, items: [], cooperative: { goal: 10, looks: 15 } } });
    renderApp(<MomentLeaderboard moment={M} />);
    expect(await screen.findByText("15 de 10 looks")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
    cleanup();
    mockApi({ "GET /api/moments/halloween/leaderboard": { competitive: false, items: [] } });
    renderApp(<MomentLeaderboard moment={{ ...M, sensitive: true }} />);
    expect(await screen.findByText(/significado religioso/)).toBeTruthy();
    cleanup();
    mockApi({ "GET /api/moments/halloween/leaderboard": { competitive: false, items: [] } });
    renderApp(<MomentLeaderboard moment={M} />);
    expect(await screen.findByText("Este Momento não tem ranking.")).toBeTruthy();
  });

  it("erro no ranking oferece tentar de novo e recarrega", async () => {
    const { calls } = mockApi({ "GET /api/moments/halloween/leaderboard": fail });
    renderApp(<MomentLeaderboard moment={M} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith("/leaderboard")).length).toBe(2));
  });
});

describe("MomentTrending e MomentMemoryView", () => {
  it("Em alta: some sem base; lista estilos, leituras e looks com/sem Hype", () => {
    const { container } = renderApp(<MomentTrending trending={{ styles: [], colors: [], interpretations: [], looks: [], basis: 0 }} />);
    expect(container.textContent).toBe("");
    cleanup();
    renderApp(<MomentTrending trending={{ styles: [{ key: "edgy", count: 4 }], colors: [], interpretations: [{ key: "dark", count: 2 }], looks: [{ schemeId: "x1", title: "Look X", coverImageUrl: "/m/x.jpg", votes: 1, contextualHype: 70 }, { schemeId: "x2", title: "Look Y", votes: 0 }], basis: 5 }} />);
    expect(screen.getByText("Em alta neste Momento")).toBeTruthy();
    expect(screen.getByText("Estilos")).toBeTruthy();
    expect(screen.queryByText("Cores")).toBeNull();
    expect(screen.getByText("dark")).toBeTruthy();
    expect(screen.getByText("Hype 70")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Look Y/ }).getAttribute("href")).toBe("/schemes/x2");
    expect(screen.getByText("com base em 5 looks enviados")).toBeTruthy();
  });

  it("Memória: números, meta cooperativa, destaques e leituras", () => {
    const { container } = renderApp(<MomentMemoryView memory={null} moment={M} />);
    expect(container.textContent).toBe("");
    cleanup();
    renderApp(<MomentMemoryView moment={{ ...M, cooperative: true }} memory={{ participants: 1200, looks: 30, goalReached: true, winner: { submissionId: "s1", schemeId: "w1", votes: 9, title: "Vencedor", coverImageUrl: "/w.jpg", user: { id: "u2", username: "bia" } as never }, mostCreative: { submissionId: "s2", schemeId: "w2", votes: 3 }, interpretations: [{ key: "dark", count: 4 }] }} />);
    expect(screen.getByText("1.200")).toBeTruthy();
    expect(screen.getByText("meta alcançada")).toBeTruthy();
    expect(screen.getByText("Look vencedor")).toBeTruthy();
    expect(screen.getByText("@bia")).toBeTruthy();
    expect(screen.getByText("Mais criativo")).toBeTruthy();
    expect(screen.getByText("Look")).toBeTruthy();
    expect(screen.queryByText("Mais elegante")).toBeNull();
    expect(screen.getByText("Leituras do tema: dark (4)")).toBeTruthy();
    cleanup();
    renderApp(<MomentMemoryView moment={{ ...M, cooperative: true }} memory={{ goalReached: false, interpretations: [] }} />);
    expect(screen.getByText("meta não alcançada")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBe(3);
    expect(screen.queryByText(/Leituras do tema/)).toBeNull();
  });
});

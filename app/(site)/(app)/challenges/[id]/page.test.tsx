// @vitest-environment jsdom
/**
 * Detalhe de um desafio: ações conforme o estado (começar, aceitar/recusar, sair, cancelar, card de resultado),
 * progresso, participantes ou contagem anônima, entradas com voto, envio de look e da foto do espelho real, e o mural
 * (recados prontos, recado livre e reações). Cada ação chama a rota certa e avisa o resultado.
 */
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import ChallengePage from "./page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const fail = (status: number, message: string) => () => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const BASE = { id: "c1", code: "NO_BUY", name: "Sem compras", rule: "Use só o que tem", mode: "DUELO", improves: ["Criatividade", "Rotação"], reward: 40, isCreator: false };
/** Promessa já resolvida: `use(params)` lê o valor sem suspender. */
const PARAMS = Object.assign(Promise.resolve({ id: "c1" }), { status: "fulfilled", value: { id: "c1" } });
const LOOKS = { items: [{ id: "s1", title: "Look azul" }] };
function show(detail: unknown, routes: Record<string, unknown> = {}) {
  const r = loggedAs(undefined, { "GET /api/challenges/c1": detail, "GET /api/me/schemes": LOOKS, ...routes });
  renderApp(<Suspense fallback={<p>carregando</p>}><ChallengePage params={PARAMS} /></Suspense>);
  return r;
}
const posted = (calls: { method: string; path: string; body?: unknown }[], path: string) => calls.find((c) => c.method === "POST" && c.path === path);

describe("detalhe do desafio — ações por estado", () => {
  it("pendente e criador: começa agora e cancela; mostra prazo de aceite, tema e recompensa", async () => {
    const { calls } = show({ ...BASE, state: "PENDENTE", isCreator: true, theme: "Anos 90", acceptDeadline: "2026-11-01T00:00:00Z", daysLeft: 4 },
      { "POST /api/challenges/c1/start": {}, "POST /api/challenges/c1/cancel": fail(409, "Não dá para cancelar") });
    expect(await screen.findByRole("heading", { name: "Sem compras" }, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText("Use só o que tem · tema: Anos 90")).toBeTruthy();
    expect(screen.getByText(/^aceite até .+ · 4 dias restantes · recompensa até 40 pts · melhora Criatividade, Rotação$/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Desafios" }).getAttribute("href")).toBe("/challenges");
    fireEvent.click(screen.getByRole("button", { name: "Começar agora" }));
    expect(await screen.findByText("Começou!")).toBeTruthy();
    expect(posted(calls, "/api/challenges/c1/start")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(await screen.findByText("Não dá para cancelar")).toBeTruthy();
    // sem participantes listados: mostra a contagem anônima
    expect(screen.getByText("participantes anônimos")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("pendente e convidado: aceitar com consentimento de foto e recusar", async () => {
    const { calls } = show({ ...BASE, state: "PENDENTE", playing: 12 }, { "POST /api/challenges/c1/accept": {}, "POST /api/challenges/c1/decline": {} });
    fireEvent.click(await screen.findByRole("button", { name: "Aceitar" }, { timeout: 4000 }));
    expect(await screen.findByText("Você entrou!")).toBeTruthy();
    expect(posted(calls, "/api/challenges/c1/accept")!.body).toEqual({ photoConsent: true });
    fireEvent.click(await screen.findByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(posted(calls, "/api/challenges/c1/decline")).toBeTruthy());
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
  });

  it("concluído: abre o card de resultado (url ou imageUrl), sem url não abre, erro avisa; mostra resultado e decoração", async () => {
    const open = vi.fn(); vi.stubGlobal("open", open);
    let n = 0;
    show({ ...BASE, state: "CONCLUIDO", isCreator: true, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-08T00:00:00Z", decoration: "Vaso dourado", result: { winner: "ana" } },
      { "GET /api/challenges/c1/result-card": () => [{ url: "/media/card.png" }, { imageUrl: "/media/img.png" }, {}, fail(500, "Card indisponível")()][n++] });
    const card = await screen.findByRole("button", { name: "Card de resultado" }, { timeout: 4000 });
    expect(screen.getByText(/→/)).toBeTruthy();
    expect(screen.getByText("Vaso dourado")).toBeTruthy();
    expect(screen.getByText(/"winner": "ana"/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    fireEvent.click(card);
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(String(open.mock.calls[0][0])).toContain("/media/card.png");
    expect(open.mock.calls[0][1]).toBe("_blank");
    fireEvent.click(card);
    await waitFor(() => expect(open).toHaveBeenCalledTimes(2));
    expect(String(open.mock.calls[1][0])).toContain("/media/img.png");
    fireEvent.click(card);
    await waitFor(() => expect(n).toBe(3));
    fireEvent.click(card);
    expect(await screen.findByText("Card indisponível")).toBeTruthy();
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("erro ao carregar mostra o estado de erro da página", async () => {
    show(fail(500, "Desafio fora do ar"));
    expect((await screen.findAllByText("Desafio fora do ar", undefined, { timeout: 4000 })).length).toBeGreaterThan(0);
  });
});

describe("detalhe do desafio — ativo", () => {
  const ACTIVE = { ...BASE, state: "ATIVO", me: { fraction: 0.5, progress: { value: 2, target: 4, label: "looks" } },
    members: [{ user: { id: "u1", username: "ana" }, status: "ACTIVE", team: "Azul", fraction: 0.5 }, { user: { id: "u2", username: "bia" }, status: "ACTIVE", fraction: 0.25 }], teamFraction: 0.375,
    entries: [{ entryId: "e1", title: "Meu look", coverImageUrl: "/c.png", mine: true, votes: 2 }, { entryId: "e2", title: "Look da bia", author: "bia", mine: false, votedByMe: true, pieces: [{ imageUrl: "/p1.png" }, { imageUrl: "/p2.png" }] }, { entryId: "e3", title: "Sem autor", mine: false }],
    notes: [{ id: "n1", user: "bia", text: "Bora!", createdAt: "2026-10-24T10:00:00Z" }, { text: "anônimo" }], presetNotes: ["Arrasou"], reactions: ["🔥"] };

  it("progresso, participantes com equipe, entradas e votos", async () => {
    const { calls } = show(ACTIVE, { "POST /api/challenges/c1/votes": {}, "POST /api/challenges/c1/leave": {} });
    expect(await screen.findByText("2/4 looks", undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText("Azul")).toBeTruthy();
    expect(screen.getByText("Equipe: 38%")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("Look da bia · @bia")).toBeTruthy();
    expect(screen.getByText("Meu look").closest(".ring-2")).toBeTruthy();
    expect(screen.getByText("2 votos")).toBeTruthy();
    const votar = screen.getAllByRole("button", { name: "Votar" });
    expect(votar).toHaveLength(2);
    fireEvent.click(votar[0]);
    await waitFor(() => expect(posted(calls, "/api/challenges/c1/votes")!.body).toEqual({ entrySchemeId: "e2" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    expect(await screen.findByText("Você saiu.")).toBeTruthy();
  });

  it("envia look como entrada e a foto do espelho real", async () => {
    const { calls } = show(ACTIVE, { "POST /api/challenges/c1/entries": {}, "POST /api/challenges/c1/real-mirror": {} });
    const send = (await screen.findAllByRole("button", { name: "Enviar" }, { timeout: 4000 }))[0] as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    const select = screen.getByRole("button", { name: /^look/ });
    fireEvent.click(select);
    fireEvent.click(await within(screen.getByRole("listbox")).findByRole("option", { name: "Look azul" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Enviar" })[0]);
    expect(await screen.findByText("Entrada enviada!")).toBeTruthy();
    expect(posted(calls, "/api/challenges/c1/entries")!.body).toEqual({ schemeId: "s1" });
    const file = screen.getByText("Espelho real").closest("label")!.querySelector("input")!;
    fireEvent.change(file, { target: { files: [] } });
    fireEvent.change(file, { target: { files: [new File(["x"], "f.png", { type: "image/png" })] } });
    expect(await screen.findByText("Foto enviada como evidência.")).toBeTruthy();
    expect(calls.filter((c) => c.path === "/api/challenges/c1/real-mirror")).toHaveLength(1);
  });

  it("mural: recados, recado pronto, recado livre (limpa depois) e reação", async () => {
    const { calls } = show(ACTIVE, { "POST /api/challenges/c1/notes": {}, "POST /api/challenges/c1/reactions": {} });
    expect(await screen.findByText("Bora!", undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText("@anon")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Arrasou" }));
    await waitFor(() => expect(posted(calls, "/api/challenges/c1/notes")!.body).toEqual({ preset: "Arrasou" }));
    const input = () => screen.getByLabelText("recado") as HTMLInputElement;
    const send = () => screen.queryAllByRole("button", { name: "Enviar" }).at(-1) as HTMLButtonElement;
    await waitFor(() => expect(send().disabled).toBe(true));
    fireEvent.change(input(), { target: { value: "Muito bom" } });
    fireEvent.click(send());
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/challenges/c1/notes").at(-1)!.body).toEqual({ free: "Muito bom" }));
    await waitFor(() => expect(input().value).toBe(""));
    fireEvent.click(await screen.findByRole("button", { name: "reagir 🔥" }));
    await waitFor(() => expect(posted(calls, "/api/challenges/c1/reactions")!.body).toEqual({ emoji: "🔥" }));
  });
});

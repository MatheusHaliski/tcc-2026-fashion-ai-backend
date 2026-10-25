// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AfterpartyAdventure } from "./afterparty-adventure";
import type { AdventureSession, AdventureState } from "@/lib/flair/afterparty";
import { cleanup, fireEvent, loggedAs, ME, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * FLAIR Metamorfose (Roubo ao Afterparty): travado abaixo do Loft; no Loft escolhe até 7 looks, inicia a missão e joga
 * pelo teclado, pelos controles e pelo mapa tático (sem WebGL). Cada ação vai para a API com o tipo certo.
 */
const gl = vi.hoisted(() => ({ value: false as boolean | null }));
vi.mock("@/components/three/common", async (orig) => ({ ...(await orig<typeof import("@/components/three/common")>()), useWebGL: () => gl.value }));

beforeEach(() => { gl.value = false; vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "req-1" }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const LOADOUTS = [
  { id: "L1", title: "Look Serviço", tier: "COMMON", role: "STAFF", color: "#111", techwear: true, imageUrl: "/a.png", cost: 10, cooldownMs: 0 },
  { id: "L2", title: "Look Gala", tier: "LEGENDARY", role: "VIP", color: "#222", techwear: false, imageUrl: null, cost: 50, cooldownMs: 0 },
] as AdventureState["loadouts"];
const state = (extra: Partial<AdventureState> = {}): AdventureState => ({
  x: 0, z: 0, energy: 30.7, suspicion: 12.4, status: "ACTIVE", phase: "ACQUIRE", activeDeckId: null, role: "GUEST", color: "#f00", feedback: "STARTED", badge: false, item: false, running: false,
  activeUntil: 0, distractionUntilLeft: 0, distractionUntilRight: 0, distractionReadyAt: 0, loadouts: LOADOUTS, cooldowns: { L1: 5000 }, ...extra,
});
const session = (extra: Partial<AdventureState> = {}): AdventureSession => ({ id: "sess1", serverTime: 1000, state: state(extra) });
const deck = (id: string, title: string) => ({ schemeId: id, title, cards: [{}, {}], combos: [], brandMultiplier: 1, seasonBonus: 0, power: 1, avg: {}, abilities: [] });
const LOFT = { balance: 0, lifetime: 1000, level: "LOFT", levels: [], rules: [] };
const err = (status: number, message: string) => new Response(JSON.stringify({ status, code: "X", message }), { status, headers: { "content-type": "application/json" } });

function routes(extra: Record<string, unknown> = {}) {
  return { "GET /api/me/points": LOFT, "GET /api/flair/decks": [deck("d1", "Noite"), deck("d2", "Dia")], "GET /api/flair/adventure/active": null, ...extra };
}
/** A missão ativa não é retomada ao abrir a tela (ver relatório): os testes iniciam uma nova. */
async function start() {
  const go = await screen.findByRole("button", { name: "Iniciar missão" });
  await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(go);
}
const actions = (calls: { method: string; path: string; body?: unknown }[]) => calls.filter((c) => c.path.endsWith("/actions")).map((c) => c.body as { type: string; [k: string]: unknown });

describe("AfterpartyAdventure", () => {
  it("abaixo do Loft mostra o bloqueio e quanto falta", async () => {
    loggedAs(ME, { "GET /api/me/points": { ...LOFT, lifetime: 300, level: "STUDIO" } });
    renderApp(<AfterpartyAdventure />);
    expect(await screen.findByText("Este jogo FLAIR Metamorfose é desbloqueado no nível Loft.")).toBeTruthy();
    expect(screen.getByText(/Faltam 600 FAI Points para Loft\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver progresso e níveis" }).getAttribute("href")).toBe("/points");
  });

  it("erro ao carregar os pontos mostra o estado de erro", async () => {
    loggedAs(ME, { "GET /api/me/points": err(500, "falhou") });
    renderApp(<AfterpartyAdventure />);
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy();
  });

  it("sem looks convida a criar; erro dos decks mostra o estado de erro", async () => {
    loggedAs(ME, routes({ "GET /api/flair/decks": [] }));
    renderApp(<AfterpartyAdventure />);
    expect(await screen.findByText("Crie um look com peças para jogar")).toBeTruthy();
    cleanup();
    loggedAs(ME, routes({ "GET /api/flair/decks": err(500, "x") }));
    renderApp(<AfterpartyAdventure />);
    expect(await screen.findByRole("button", { name: /tentar/i })).toBeTruthy();
  });

  it("escolhe looks (todos pré-marcados), inicia a missão e mostra o HUD; a ajuda explica cada papel", async () => {
    const { calls } = loggedAs(ME, routes({ "POST /api/flair/adventure/sessions": session(), "GET /api/flair/adventure/sessions/sess1": session() }));
    renderApp(<AfterpartyAdventure />);
    const noite = await screen.findByRole("checkbox", { name: /Noite · 2 peças/ });
    await waitFor(() => expect((noite as HTMLInputElement).checked).toBe(true));
    fireEvent.click(screen.getByRole("checkbox", { name: /Dia/ }));
    expect((screen.getByRole("checkbox", { name: /Dia/ }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Como jogar" }));
    const help = await screen.findByRole("dialog", { name: "Como jogar" });
    expect(within(help).getByText("VIP do evento")).toBeTruthy();
    fireEvent.click(within(help).getAllByRole("button", { name: /Fechar/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar missão" }));
    expect(await screen.findByText("Missão iniciada. Escolha sua estratégia.")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/flair/adventure/sessions")?.body).toEqual({ deckIds: ["d1"] });
    expect(screen.getByText("Encontre uma forma de entrar no VIP e recuperar o item")).toBeTruthy();
    expect(screen.getByText("Energia: 30 · Suspeita: 12%")).toBeTruthy();
    expect(screen.getByText("Entrada de serviço à direita: procure o crachá")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Mapa tático interativo da missão" })).toBeTruthy();
    const serviço = screen.getByRole("button", { name: /1\. Look Serviço/ });
    expect(serviço.textContent).toContain("10 Energia · 4s");
    expect(serviço.textContent).toContain("Mobilidade Techwear");
    expect((serviço as HTMLButtonElement).disabled).toBe(true);
    // energia 30 < custo 50
    expect((screen.getByRole("button", { name: /2\. Look Gala/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("controles mandam interagir, distrair, mover, ativar e encerrar", async () => {
    const live = session({ cooldowns: {}, energy: 80 });
    const { calls } = loggedAs(ME, routes({
      "POST /api/flair/adventure/sessions": live, "GET /api/flair/adventure/sessions/sess1": live,
      "POST /api/flair/adventure/sessions/sess1/actions": (_u: URL, init: RequestInit) => {
        const b = JSON.parse(String(init.body)) as { type: string };
        if (b.type === "ABANDON") return session({ status: "ABANDONED", feedback: "ABANDONED" });
        if (b.type === "ACTIVATE") return session({ cooldowns: {}, energy: 70, activeDeckId: "L1", feedback: "TRANSFORMED", badge: true, phase: "ESCAPE" });
        return session({ cooldowns: {}, energy: 80, feedback: b.type === "DISTRACT" ? "DISTRACTED" : "MOVING" });
      },
      "GET /api/schemes/L1/look3d": { schemeId: "L1", mannequin: {}, pieces: [] },
    }));
    renderApp(<AfterpartyAdventure />);
    await start();
    fireEvent.click(await screen.findByRole("button", { name: "Interagir (E)" }));
    await waitFor(() => expect(actions(calls).map((a) => a.type)).toContain("INTERACT"));
    await waitFor(() => expect((screen.getByRole("button", { name: "Distrair segurança" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Distrair segurança" }));
    expect(await screen.findByText("Segurança distraído temporariamente.")).toBeTruthy();
    // correr alterna e entra no movimento por teclado no botão de direção
    const run = screen.getByRole("button", { name: "Correr" });
    fireEvent.click(run);
    expect(run.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect((screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.keyDown(screen.getByRole("button", { name: "Direita" }), { key: "Enter" });
    await waitFor(() => expect(actions(calls)).toContainEqual(expect.objectContaining({ type: "MOVE", dx: 1, dz: 0, running: true })));
    await waitFor(() => expect((screen.getByRole("button", { name: /1\. Look Serviço/ }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: /1\. Look Serviço/ }));
    expect(await screen.findByText("Metamorfose FLAIR ativada no avatar.")).toBeTruthy();
    expect(screen.getByText("Retorne à saída e interaja para concluir")).toBeTruthy();
    expect(screen.getByText("Crachá de serviço obtido")).toBeTruthy();
    expect(screen.getByRole("button", { name: /1\. Look Serviço/ }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(calls.some((c) => c.path === "/api/schemes/L1/look3d")).toBe(true));
    await waitFor(() => expect((screen.getByRole("button", { name: "Encerrar missão" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Encerrar missão" }));
    expect(await screen.findByRole("heading", { name: "Missão encerrada." })).toBeTruthy();
    expect(actions(calls).find((a) => a.type === "ACTIVATE")).toMatchObject({ deckId: "L1", requestId: "req-1" });
    // preparar nova missão volta à escolha de looks
    fireEvent.click(screen.getByRole("button", { name: "Preparar nova missão" }));
    expect(await screen.findByText("Selecione até sete looks para o deck")).toBeTruthy();
  });

  it("teclado no cenário: WASD move, E interage, 1–7 ativa look, Shift corre e soltar tudo para", async () => {
    const live = session({ cooldowns: {}, energy: 80 });
    const { calls } = loggedAs(ME, routes({
      "POST /api/flair/adventure/sessions": live, "GET /api/flair/adventure/sessions/sess1": live,
      "POST /api/flair/adventure/sessions/sess1/actions": live,
    }));
    renderApp(<AfterpartyAdventure />);
    await start();
    const world = await screen.findByRole("region", { name: /Cenário da missão/ });
    fireEvent.keyDown(world, { key: "Shift" });
    expect(screen.getByRole("button", { name: "Correr" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(world, { key: "w" });
    fireEvent.keyDown(world, { key: "a" });
    await waitFor(() => expect(actions(calls)).toContainEqual(expect.objectContaining({ type: "MOVE", dx: -1, dz: -1, running: true })), { timeout: 2000 });
    fireEvent.keyUp(world, { key: "w" }); fireEvent.keyUp(world, { key: "a" });
    fireEvent.keyUp(world, { key: "Shift" });
    expect(screen.getByRole("button", { name: "Correr" }).getAttribute("aria-pressed")).toBe("false");
    await waitFor(() => expect(actions(calls).map((a) => a.type)).toContain("WAIT"));
    fireEvent.keyDown(world, { key: "ArrowDown" }); fireEvent.keyDown(world, { key: "ArrowRight" });
    await waitFor(() => expect(actions(calls)).toContainEqual(expect.objectContaining({ type: "MOVE", dx: 1, dz: 1 })), { timeout: 2000 });
    fireEvent.keyUp(world, { key: "ArrowDown" }); fireEvent.keyUp(world, { key: "ArrowRight" });
    await waitFor(() => expect(actions(calls).filter((a) => a.type === "WAIT").length).toBeGreaterThanOrEqual(2));
    fireEvent.keyDown(world, { key: "e" });
    await waitFor(() => expect(actions(calls).map((a) => a.type)).toContain("INTERACT"));
    fireEvent.keyDown(world, { key: "2" });
    await waitFor(() => expect(actions(calls)).toContainEqual(expect.objectContaining({ type: "ACTIVATE", deckId: "L2" })));
    // atalho sem look correspondente não manda nada
    const before = actions(calls).length;
    fireEvent.keyDown(world, { key: "7" });
    fireEvent.blur(world);
    await waitFor(() => expect(actions(calls).length).toBeGreaterThan(before));
    expect(actions(calls).slice(before).every((a) => a.type === "WAIT")).toBe(true);
  });

  it("botões de direção por ponteiro movem até soltar; clique no mapa leva o avatar até o ponto", async () => {
    let pos = { x: 0, z: 0 };
    const { calls } = loggedAs(ME, routes({
      "POST /api/flair/adventure/sessions": session({ cooldowns: {} }),
      "GET /api/flair/adventure/sessions/sess1": () => session({ cooldowns: {}, ...pos }),
      "POST /api/flair/adventure/sessions/sess1/actions": (_u: URL, init: RequestInit) => {
        const b = JSON.parse(String(init.body)) as { type: string; dx?: number; dz?: number };
        if (b.type === "MOVE") pos = { x: 1.95, z: 0 };
        return session({ cooldowns: {}, ...pos, feedback: b.type === "MOVE" ? "GATE_BLOCKED" : "WAITING" });
      },
    }));
    renderApp(<AfterpartyAdventure />);
    await start();
    const up = await screen.findByRole("button", { name: "Avançar" });
    (up as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
    fireEvent.pointerDown(up, { pointerId: 1 });
    await waitFor(() => expect(actions(calls)).toContainEqual(expect.objectContaining({ type: "MOVE", dx: 0, dz: -1 })), { timeout: 2000 });
    fireEvent.pointerUp(up);
    await waitFor(() => expect(actions(calls).map((a) => a.type)).toContain("WAIT"));
    // clique no mapa: alvo bem à direita (x = 4) faz andar; a portaria bloqueia e o alvo é descartado
    const map = screen.getByRole("img", { name: "Mapa tático interativo da missão" });
    map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 400, right: 600, bottom: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
    let n = actions(calls).length;
    fireEvent.pointerDown(map, { clientX: 480, clientY: 200 });
    await waitFor(() => expect(actions(calls).slice(n)).toContainEqual(expect.objectContaining({ type: "MOVE", dx: 1, dz: 0 })), { timeout: 2000 });
    expect(await screen.findByText("Portaria bloqueada. Use um disfarce ou a entrada de serviço.")).toBeTruthy();
    // alvo a menos de .25 do avatar (x = 1,95): chega e espera
    n = actions(calls).length;
    fireEvent.pointerDown(map, { clientX: 390, clientY: 200 });
    await waitFor(() => expect(actions(calls).slice(n).map((a) => a.type)).toContain("WAIT"), { timeout: 2000 });
    expect(actions(calls).slice(n).some((a) => a.type === "MOVE")).toBe(false);
  });

  it("missão concluída recarrega os pontos; erro numa ação vira aviso", async () => {
    let fail = true;
    const { calls } = loggedAs(ME, routes({
      "POST /api/flair/adventure/sessions": session({ cooldowns: {} }),
      "GET /api/flair/adventure/sessions/sess1": session({ cooldowns: {} }),
      "POST /api/flair/adventure/sessions/sess1/actions": () => fail ? err(409, "Ação recusada") : session({ status: "COMPLETED", feedback: "COMPLETED", item: true }),
    }));
    renderApp(<AfterpartyAdventure />);
    await start();
    fireEvent.click(await screen.findByRole("button", { name: "Interagir (E)" }));
    expect(await screen.findByText("Ação recusada")).toBeTruthy();
    fail = false;
    const pts = calls.filter((c) => c.path === "/api/me/points").length;
    await waitFor(() => expect((screen.getByRole("button", { name: "Interagir (E)" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Interagir (E)" }));
    expect(await screen.findByRole("heading", { name: "Missão concluída!" })).toBeTruthy();
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/me/points").length).toBeGreaterThan(pts));
    expect((screen.getByRole("button", { name: "Interagir (E)" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a consulta periódica atualiza a sessão e conclui a missão; falha na consulta vira aviso", async () => {
    let poll = 0;
    const { calls } = loggedAs(ME, routes({
      "POST /api/flair/adventure/sessions": session({ cooldowns: {} }),
      "GET /api/flair/adventure/sessions/sess1": () => (++poll === 1 ? err(500, "Consulta falhou") : session({ status: "COMPLETED", feedback: "COMPLETED" })),
    }));
    renderApp(<AfterpartyAdventure />);
    await start();
    expect(await screen.findByText("Consulta falhou", {}, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Missão concluída!" }, { timeout: 3000 })).toBeTruthy();
    expect(calls.filter((c) => c.path === "/api/me/points").length).toBeGreaterThan(1);
  });

  it("com WebGL a cena 3D toma o lugar do mapa tático", async () => {
    gl.value = true;
    loggedAs(ME, routes({ "POST /api/flair/adventure/sessions": session(), "GET /api/flair/adventure/sessions/sess1": session() }));
    renderApp(<AfterpartyAdventure />);
    await start();
    expect(await screen.findByRole("region", { name: /Cenário da missão/ })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Mapa tático interativo da missão" })).toBeNull();
    cleanup();
    gl.value = null;
    loggedAs(ME, routes({ "POST /api/flair/adventure/sessions": session(), "GET /api/flair/adventure/sessions/sess1": session() }));
    renderApp(<AfterpartyAdventure />);
    await start();
    expect(await screen.findByRole("region", { name: /Cenário da missão/ })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Mapa tático interativo da missão" })).toBeNull();
  });
});

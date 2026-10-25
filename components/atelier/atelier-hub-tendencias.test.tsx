// @vitest-environment jsdom
/**
 * FAI Atelier: o hub (contagem por categoria, abas pela URL, pausar efeitos, ajuda, erro), a matriz de tendências
 * (sinais de estilo/cor com variação, atualizar, vazio, erro, consulta a cada 30 s) e "Minhas animações pessoais".
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { AtelierHub } from "@/components/atelier/atelier-hub";
import { TrendsPanel } from "@/components/atelier/trends-panel";
import { MyMotionArts } from "@/components/atelier/my-motion-arts";
import { PIECE } from "@/test-utils/fixtures";

vi.mock("@/components/piece-card", () => ({ PieceCard: ({ piece }: { piece: { name: string } }) => <p>peça {piece.name}</p> }));
vi.mock("@/components/profile-level-progress", () => ({ ProfileLevelChip: ({ progress }: { progress: { level: number } }) => <span>nível {progress.level}</span> }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); nav.search = new URLSearchParams(); router.replace.mockClear(); });
const fail = (message: string) => () => new Response(JSON.stringify({ status: 500, code: "ERRO", message }), { status: 500, headers: { "content-type": "application/json" } });
const reward = (id: string) => ({ id, category: "auraSignature", code: id, title: id, description: "", sourceType: "", sourceReference: "", earnedAt: "" });
const REWARDS = { categories: { auraSignature: [reward("a"), reward("b")], garmentMemory: [], habitableTrofeus: [], directorPower: [], collectiveWork: [] }, levelProgress: { level: 4 }, total: 2 };

describe("AtelierHub", () => {
  it("conta recompensas por categoria, pausa efeitos, abre a ajuda e troca de aba pela URL", async () => {
    nav.search = new URLSearchParams("tab=trends&x=1");
    mockApi({ "GET /api/me/atelier": REWARDS });
    renderApp(<AtelierHub />);
    expect(await screen.findByText("nível 4")).toBeTruthy();
    const strip = screen.getByLabelText("Suas recompensas de identidade");
    expect(within(strip).getByText("Assinatura de Aura").nextElementSibling!.textContent).toBe("2");
    expect(within(strip).getByText("Convites de temporada").nextElementSibling!.textContent).toBe("0");
    expect(screen.getByRole("tab", { name: "Tendências" }).getAttribute("aria-selected")).toBe("true");
    const pause = screen.getByRole("button", { name: "Pausar efeitos" });
    fireEvent.click(pause);
    expect(screen.getByRole("button", { name: "Retomar efeitos" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector(".atelier-hub")!.getAttribute("data-motion")).toBe("off");
    fireEvent.click(screen.getByRole("button", { name: "Conheça seu Atelier" }));
    expect(await screen.findByText(/As categorias exibem apenas concessões registradas/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Conquistas & Quarto" }));
    expect(router.replace).toHaveBeenCalledWith("/atelier?tab=room&x=1", { scroll: false });
    expect(screen.getByRole("link", { name: "Abrir meu Quarto 3D" }).getAttribute("href")).toBe("/room");
  });

  it("aba inválida cai em Metamorfoses; erro mostra '—' e tentar de novo", async () => {
    nav.search = new URLSearchParams("tab=nada");
    mockApi({ "GET /api/me/atelier": fail("Atelier fora") });
    renderApp(<AtelierHub />);
    expect(await screen.findByText("Atelier fora")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Metamorfoses" }).getAttribute("aria-selected")).toBe("true");
    expect(within(screen.getByLabelText("Suas recompensas de identidade")).getAllByText("—").length).toBe(6);
    expect(screen.queryByText(/nível/)).toBeNull();
  });
});

describe("TrendsPanel", () => {
  const row = (id: string, rank: number, style: string[], color: string | null, hype: object) => ({ id, rank, hype, piece: { ...PIECE, id, name: `Peça ${id}`, style, color } });
  const DATA = { window: 7, items: [
    row("p1", 1, ["edgy", "edgy"], "black", { status: "AVAILABLE", score: 80, deltaPoints: 4 }),
    row("p2", 2, ["edgy"], "black", { status: "AVAILABLE", score: 70, deltaPoints: -10 }),
    row("p3", 3, ["boho"], null, { status: "AVAILABLE", score: 60, deltaPoints: 0 }),
    row("p4", 4, ["glam"], "red", { status: "NOT_CALCULATED" }),
    row("p5", 5, ["vintage"], null, { status: "AVAILABLE", score: 50, deltaPoints: 5 }),
  ] };

  it("sinais por estilo e cor com variação (alta, queda, estável, indisponível) e cards ranqueados", async () => {
    mockApi({ "GET /api/hype/trending": DATA });
    renderApp(<TrendsPanel motion={false} />);
    expect(await screen.findByText("peça Peça p1")).toBeTruthy();
    expect(screen.getByText("#1 · Hype Index 80")).toBeTruthy();
    expect(screen.getByText("#4 · Hype Index —")).toBeTruthy();
    const deltas = Array.from(document.querySelectorAll(".atelier-trend-delta")).map((d) => d.getAttribute("data-direction"));
    expect(deltas).toEqual(expect.arrayContaining(["up", "down", "stable", "unknown"]));
    expect(screen.getAllByText("Variação média Hype: -3 pontos").length).toBeGreaterThan(0);   // edgy: (4 − 10) / 2
    expect(screen.getByText("Variação média Hype: +5 pontos")).toBeTruthy();
    expect(screen.getAllByText("Variação Hype indisponível").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Explorar peça" })[0].getAttribute("href")).toBe("/pieces/p1");
  });

  it("vazio sem sinais, atualizar busca de novo e o relógio de 30 s só conta com a aba visível", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const { calls } = mockApi({ "GET /api/hype/trending": { window: 7, items: [] } });
    renderApp(<TrendsPanel motion />);
    expect(await screen.findByText("Ainda não há peças públicas em alta.")).toBeTruthy();
    expect(screen.getAllByText("Ainda sem sinais suficientes.").length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar agora" }));
    await waitFor(() => expect(calls.length).toBe(2));
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => { vi.advanceTimersByTime(30000); });
    expect(calls.length).toBe(2);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    act(() => { vi.advanceTimersByTime(30000); });
    await waitFor(() => expect(calls.length).toBe(3));
  });

  it("erro mostra o estado de erro", async () => {
    mockApi({ "GET /api/hype/trending": fail("Sem ranking") });
    renderApp(<TrendsPanel motion={false} />);
    expect(await screen.findByText("Sem ranking")).toBeTruthy();
  });
});

describe("MyMotionArts", () => {
  it("lista só os prontos com mídia e linka para gerenciar a peça", async () => {
    mockApi({ "GET /api/me/aura-impersonation/jobs": [{ id: "j1", status: "READY", mediaUrl: "/x.mp4", pieceId: "p 1" }, { id: "j2", status: "READY", mediaUrl: null, pieceId: "p2" }, { id: "j3", status: "RUNNING", mediaUrl: "/y.mp4", pieceId: "p3" }] });
    renderApp(<MyMotionArts />);
    const links = await screen.findAllByRole("link", { name: "Gerenciar no Atelier" });
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("/atelier?tab=metamorphoses&pieceId=p%201");
  });

  it("carregando, vazio e erro com tentar de novo", async () => {
    mockApi({ "GET /api/me/aura-impersonation/jobs": [] });
    renderApp(<MyMotionArts />);
    expect(screen.getByRole("status").textContent).toBe("Verificando seu nível…");
    expect(await screen.findByText("Seus vídeos aprovados aparecerão aqui.")).toBeTruthy();
    cleanup();
    const { calls } = mockApi({ "GET /api/me/aura-impersonation/jobs": fail("x") });
    renderApp(<MyMotionArts />);
    expect(await screen.findByText("Não foi possível atualizar suas gerações.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));
    await waitFor(() => expect(calls.length).toBe(2));
  });
});

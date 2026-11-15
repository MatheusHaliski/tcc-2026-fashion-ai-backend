// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CbcList, CbcPlay } from "@/components/flair/cbc";
import { act } from "@testing-library/react";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";

/**
 * Desafios de Montagem (Card Building Challenges): lista por janela, montagem vaga a vaga, conferência no servidor
 * (sem gravar), entrega atômica com o modal de recompensa (só "creditado" quando o servidor confirma) e o estado
 * somente leitura depois de entregue.
 */
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/flair/desafios" }));

const own = { status: "OPEN", now: "2026-10-10T12:00:00Z", always: true, startsInSeconds: 0, endsInSeconds: 0, daysLeft: null };
const base = (over: Record<string, unknown>) => ({ id: "cbc-1", slug: "verao-em-ipanema", name: "Verão em Ipanema", description: "Três cartas.", scenario: "ipanema", difficulty: "EASY", status: "OPEN", time: own, slotsCount: 3, points: 15, multiplier: 1, pointsPreview: 15, requirements: [], levelOpen: true, groupCode: null, locksCards: true, repeatLimit: 1, official: true, moment: null, mine: { submissions: 0, attemptsLeft: 1, done: false }, ...over });
const card = (id: string, name: string, position: string, tier = "PRATA", ovr = 70) => ({ id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier, ovr, rare: false, position, name, brandName: "Atelier Lumi", imageUrl: null, hype: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });
const CARDS = { season: "SPRING", counts: { ESPECIAL: 0, OURO: 0, PRATA: 3, BRONZE: 0 }, total: 3, cards: [card("c1", "Tênis Aero", "CAL"), card("c2", "Bolsa transversal", "ACE"), card("c3", "Camisa de linho", "SUP")] };
const detail = (over: Record<string, unknown> = {}) => base({ slots: [{ key: "calcadao", position: "CAL", label: null }, { key: "guarda_sol", position: "ACE", label: null }, { key: "quiosque", position: "SUP", label: null }], themeTags: [], interpretations: [], suggestedInterpretation: null, mySubmissions: [], communityOpen: false, community: [], memory: { builds: 22, people: 18, averageSintonia: 61, readings: null, season: "SPRING" }, ...over });
const evaluation = (slots: Record<string, string>, ok: boolean) => ({ status: "OPEN", interpretation: "own", canSubmit: ok,
  evaluation: { slots: Object.entries(slots).map(([slot, cardId]) => ({ slot, position: "ANY", cardId, positionOk: true, neighbor: false, theme: false, sintonia: 1 })), requirements: [], sintonia: Object.keys(slots).length, sintoniaMax: 9, filled: Object.keys(slots).length, complete: Object.keys(slots).length === 3, ok, rediscovered: [] },
  story: [{ key: "cbc.scenario.ipanema.open", vars: {} }, ...Object.entries(slots).map(([slot, cardId]) => ({ key: `cbc.scenario.ipanema.${slot}.story`, vars: { name: CARDS.cards.find((c) => c.id === cardId)!.name, brand: "Atelier Lumi", color: "none" }, slot, sintonia: 1 }))],
  points: { lines: [{ action: "FLAIR_CBC", points: 15, ref: "cbc-1", label: "Desafio concluído" }], total: 15 } });

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("lista", () => {
  it("separa agora, sempre disponíveis, em breve e memórias, com janela, pontos e a ação certa", async () => {
    loggedAs(ME, { "GET /api/flair/challenges": { season: "SPRING", groups: [], now: [base({ id: "n1", slug: "primavera", name: "Primavera no jardim", moment: { id: "m", slug: "p", name: "Primavera 2026", type: "SEASONAL", nature: "SEASONAL", theme: {} }, time: { status: "ACTIVE", now: "", startAt: "", endAt: "", timezone: "UTC", localStart: "2026-10-07", localEnd: "2026-10-21", startsInSeconds: 0, endsInSeconds: 950400, elapsed: 0.3, daysLeft: 11 }, multiplier: 1.5, pointsPreview: 23 })],
      always: [base({})], upcoming: [base({ id: "u1", slug: "halloween", name: "Noite de Halloween", status: "UPCOMING", time: { ...own, always: false, status: "UPCOMING", startsInSeconds: 5 * 86400 } })], memories: [base({ id: "e1", slug: "carnaval", name: "Carnaval no bloco", status: "ENDED" })] } });
    renderApp(<CbcList />);
    expect((await screen.findByRole("heading", { name: "Agora" }))).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sempre disponíveis" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Em breve" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Memórias" })).toBeTruthy();
    expect(screen.getByText("Termina em 11 dias")).toBeTruthy();
    expect(screen.getByText("Abre em 5 dias")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Montar" }).map((l) => l.getAttribute("href"))).toEqual(["/flair/desafios/primavera", "/flair/desafios/verao-em-ipanema"]);
    expect(screen.getByRole("link", { name: "Preparar" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver memória" })).toBeTruthy();
    expect(screen.getByText("+23")).toBeTruthy();
  });
  it("sem desafios mostra o estado vazio", async () => {
    loggedAs(ME, { "GET /api/flair/challenges": { season: "SPRING", groups: [], now: [], always: [], upcoming: [], memories: [] } });
    renderApp(<CbcList />);
    expect(await screen.findByText("Nenhum desafio por aqui ainda")).toBeTruthy();
  });
});

const vaga = (slot: string) => document.querySelector(`.cbv-slot[data-slot=${slot}]`) as HTMLElement;
const naVaga = (slot: string) => vaga(slot).querySelector(".cbv-pos")?.textContent;
const carta = (nome: string) => within(screen.getByTestId("mesa-bandeja")).getByRole("button", { name: new RegExp(`^Pôr ${nome}`) });
const pecas = () => document.querySelector(".cbc-stage-art canvas")?.getAttribute("data-pecas");
function arrastar(origem: Element, destino: Element) {
  const doc = document as unknown as { elementFromPoint?: (x: number, y: number) => Element | null };
  doc.elementFromPoint = () => destino;
  fireEvent(origem, new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10, button: 0 }));
  fireEvent(window, new MouseEvent("pointermove", { bubbles: true, clientX: 60, clientY: 80 }));
  fireEvent(window, new MouseEvent("pointerup", { bubbles: true, clientX: 60, clientY: 80 }));
  delete doc.elementFromPoint;
}

describe("montagem", () => {
  it("arrastar põe e troca, a bandeja tira, desfazer volta e a montagem fica guardada entre visitas", async () => {
    loggedAs(ME, {
      "GET /api/flair/challenges/verao-em-ipanema": detail(),
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/challenges/verao-em-ipanema/check": (_u: URL, init: RequestInit) => evaluation((JSON.parse(String(init.body)) as { slots: Record<string, string> }).slots, false),
    });
    const tela = renderApp(<CbcPlay slug="verao-em-ipanema" />);
    await screen.findByRole("heading", { name: "Verão em Ipanema" });
    // arrasta a carta da bandeja direto para a vaga 3, sem escolher a vaga antes
    arrastar(carta("Camisa de linho"), vaga("quiosque"));
    expect(naVaga("quiosque")).toBe("Camisa de linho");
    arrastar(carta("Tênis Aero"), vaga("calcadao"));
    // de vaga para vaga: as cartas trocam de lugar
    arrastar(vaga("calcadao").querySelector(".cbv-card")!, vaga("quiosque"));
    expect([naVaga("calcadao"), naVaga("quiosque")]).toEqual(["Camisa de linho", "Tênis Aero"]);
    // da vaga para a bandeja: tira; Z desfaz
    arrastar(vaga("quiosque").querySelector(".cbv-card")!, screen.getByTestId("mesa-bandeja"));
    expect(naVaga("quiosque")).toBe("Parte de cima");
    fireEvent.keyDown(window, { key: "z" });
    expect(naVaga("quiosque")).toBe("Tênis Aero");
    // (o clique que o navegador dispara logo depois de soltar é engolido por um instante: espera passar)
    await new Promise((r) => setTimeout(r, 80));
    fireEvent.click(screen.getAllByRole("button", { name: "Desfazer" })[0]);
    expect([naVaga("calcadao"), naVaga("quiosque")]).toEqual(["Tênis Aero", "Camisa de linho"]);
    // tirar pela bandeja: a vaga e o botão
    fireEvent.click(vaga("calcadao"));
    fireEvent.click(within(screen.getByTestId("mesa-bandeja")).getByRole("button", { name: "Tirar" }));
    expect(naVaga("calcadao")).toBe("Calçado");
    expect(JSON.parse(localStorage.getItem("fai.flair.montagem.cbc.verao-em-ipanema") ?? "{}")).toEqual({ quiosque: "c3" });
    // sai e volta: a carta continua na vaga
    tela.unmount();
    renderApp(<CbcPlay slug="verao-em-ipanema" />);
    await screen.findByRole("heading", { name: "Verão em Ipanema" });
    await waitFor(() => expect(naVaga("quiosque")).toBe("Camisa de linho"));
    await settle();
  });

  it("coloca cartas vaga a vaga, confere no servidor sem gravar, entrega e mostra a recompensa creditada", async () => {
    let submitted = false;
    const { calls } = loggedAs(ME, {
      "GET /api/flair/challenges/verao-em-ipanema": () => detail(submitted ? { mine: { submissions: 1, attemptsLeft: 0, done: true }, mySubmissions: [{ id: "s1", attempt: 1, createdAt: "2026-10-10T12:00:00Z", interpretation: "own", sintonia: 3, sintoniaMax: 9, points: 15, story: [], cards: [] }] } : {}),
      "GET /api/me/flair/cards": CARDS,
      "POST /api/flair/challenges/verao-em-ipanema/check": (_u: URL, init: RequestInit) => { const b = JSON.parse(String(init.body)) as { slots: Record<string, string> }; return evaluation(b.slots, Object.keys(b.slots).length === 3); },
      "POST /api/flair/challenges/verao-em-ipanema/submit": (_u: URL, init: RequestInit) => { submitted = true; const b = JSON.parse(String(init.body)) as { slots: Record<string, string> }; const ev = evaluation(b.slots, true); return { ...ev, points: { lines: [{ ...ev.points.lines[0], granted: true }], total: 15 }, submission: { id: "s1", attempt: 1, createdAt: "2026-10-10T12:00:00Z", interpretation: "own", sintonia: 3, sintoniaMax: 9, points: 15, story: ev.story, cards: [] }, group: null, locked: true }; },
    });
    renderApp(<CbcPlay slug="verao-em-ipanema" />);
    expect(await screen.findByRole("heading", { name: "Verão em Ipanema" })).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Entregar" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByText("0/3")).toBeTruthy();
    // a bandeja já está aberta na vaga 1 (calçado): a carta que cabe vem primeiro, as outras apagadas com o motivo
    const bandeja = screen.getByTestId("mesa-bandeja");
    expect(vaga("calcadao").getAttribute("aria-current")).toBe("true");
    const options = within(bandeja).getAllByRole("button", { name: /^Pôr/ });
    expect(options[0].getAttribute("aria-label")).toBe("Pôr Tênis Aero · 70 · Calçado");
    expect(options[1].getAttribute("aria-label")).toContain("a vaga pede Calçado");
    expect(pecas()).toBe("coberta,coberta,coberta");
    // um toque põe a carta (sem janela no meio): a peça entra na hora, sem sintonia até o servidor responder
    fireEvent.click(options[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pecas()).toBe("chegando,coberta,coberta");
    expect(vaga("guarda_sol").getAttribute("aria-current")).toBe("true");
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith("/check")).length).toBe(1), { timeout: 3000 });
    expect(calls.filter((c) => c.path.endsWith("/submit")).length).toBe(0);
    await waitFor(() => expect(pecas()).toBe("vermelha,coberta,coberta"));
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(screen.getByText("Previsto")).toBeTruthy();
    // vagas 2 e 3: um toque cada, porque o destaque já passou para a próxima vaga vazia
    fireEvent.click(carta("Bolsa transversal"));
    fireEvent.click(carta("Camisa de linho"));
    await waitFor(() => expect((screen.getByRole("button", { name: "Entregar" }) as HTMLButtonElement).disabled).toBe(false), { timeout: 3000 });
    expect(screen.getByText("3/3")).toBeTruthy();
    expect(screen.getByText(/No calçadão, Tênis Aero da Atelier Lumi/)).toBeTruthy();
    // entrega: uma chamada, modal com o valor creditado pelo servidor
    fireEvent.click(screen.getByRole("button", { name: "Entregar" }));
    const reward = await screen.findByRole("dialog");
    expect(reward.textContent).toContain("Montagem entregue");
    expect(reward.textContent).toContain("Creditado");
    expect(reward.textContent).toContain("FAI Points creditados pelo servidor");
    expect(calls.filter((c) => c.path.endsWith("/submit")).length).toBe(1);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ver minha entrega" })));
    fireEvent.click(screen.getByRole("button", { name: "Ver minha entrega" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // depois de entregue: somente leitura, sem botão de entregar
    await waitFor(() => expect(screen.getByText(/Você entregou a tentativa 1/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull();
  });

  it("desafio em breve: monta e confere, mas a entrega fica fechada; sem cartas disponíveis aponta o caminho", async () => {
    loggedAs(ME, {
      "GET /api/flair/challenges/verao-em-ipanema": detail({ status: "UPCOMING", time: { ...own, always: false, status: "UPCOMING", startsInSeconds: 86400 * 2 } }),
      "GET /api/me/flair/cards": { season: "SPRING", counts: { ESPECIAL: 0, OURO: 0, PRATA: 0, BRONZE: 0 }, total: 0, cards: [] },
    });
    renderApp(<CbcPlay slug="verao-em-ipanema" />);
    await screen.findByRole("heading", { name: "Verão em Ipanema" });
    expect(screen.getByRole("note").textContent).toContain("ainda não abriu");
    expect((screen.getByRole("button", { name: "Entrega abre com o desafio" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Você ainda não tem cartas FLAIR disponíveis")).toBeTruthy();
    await settle();
  });
});

describe("teclado e controle", () => {
  const rotas = () => loggedAs(ME, {
    "GET /api/flair/challenges/verao-em-ipanema": detail(),
    "GET /api/me/flair/cards": CARDS,
    "POST /api/flair/challenges/verao-em-ipanema/check": (_u: URL, init: RequestInit) => evaluation((JSON.parse(String(init.body)) as { slots: Record<string, string> }).slots, false),
  });

  it("setas escolhem a vaga, Espaço entra na bandeja e põe, Backspace sai da bandeja ou tira", async () => {
    rotas();
    renderApp(<CbcPlay slug="verao-em-ipanema" />);
    await screen.findByRole("heading", { name: "Verão em Ipanema" });
    await waitFor(() => expect(carta("Tênis Aero")).toBeTruthy());
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(vaga("guarda_sol").getAttribute("aria-current")).toBe("true");
    fireEvent.keyDown(window, { key: " " });
    expect(carta("Bolsa transversal").className).toContain("is-focus");
    fireEvent.keyDown(window, { key: " " });
    expect(naVaga("guarda_sol")).toBe("Bolsa transversal");
    // o destaque segue para a próxima vaga vazia, ainda dentro da bandeja: Espaço põe a primeira carta dela
    expect(vaga("quiosque").getAttribute("aria-current")).toBe("true");
    fireEvent.keyDown(window, { key: " " });
    expect(naVaga("quiosque")).toBe("Camisa de linho");
    // a próxima vaga vazia agora é a primeira; Backspace sai da bandeja, as setas voltam ao quiosque e Backspace tira
    expect(vaga("calcadao").getAttribute("aria-current")).toBe("true");
    fireEvent.keyDown(window, { key: "Backspace" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(vaga("calcadao").getAttribute("aria-current")).toBe("true");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(vaga("quiosque").getAttribute("aria-current")).toBe("true");
    expect(naVaga("quiosque")).toBe("Camisa de linho");
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(naVaga("quiosque")).toBe("Parte de cima");
    await settle();
  });

  it("controle: direcional escolhe a vaga, A entra e põe, B sai", async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let seq = 0;
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => { frames.set(++seq, f); return seq; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const pad = { index: 0, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    vi.stubGlobal("navigator", { ...navigator, getGamepads: () => [pad] });
    const quadro = () => act(() => { const todos = [...frames.values()]; frames.clear(); todos.forEach((f) => f(performance.now())); });
    const apertar = (botao: number) => { pad.buttons[botao].pressed = true; quadro(); pad.buttons[botao].pressed = false; quadro(); };
    rotas();
    renderApp(<CbcPlay slug="verao-em-ipanema" />);
    await screen.findByRole("heading", { name: "Verão em Ipanema" });
    await waitFor(() => expect(carta("Tênis Aero")).toBeTruthy());
    act(() => { window.dispatchEvent(new Event("gamepadconnected")); });
    quadro();
    apertar(15);
    expect(vaga("guarda_sol").getAttribute("aria-current")).toBe("true");
    apertar(0);
    apertar(0);
    expect(naVaga("guarda_sol")).toBe("Bolsa transversal");
    apertar(1);
    apertar(14);
    expect(vaga("guarda_sol").getAttribute("aria-current")).toBe("true");
    apertar(1);
    expect(naVaga("guarda_sol")).toBe("Acessório");
    await settle();
  });
});

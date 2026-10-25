// @vitest-environment jsdom
/**
 * Desafios (RF32): catálogo (destaque, regra do dia, esforço, elegibilidade), início com modo e convidados, meus desafios
 * (convites aceitar/recusar, ativos, concluídos), votação e proposta à comunidade. Erros da API aparecem como aviso.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import ChallengesPage from "./page";

vi.mock("@/components/challenges/community-trends", () => ({ CommunityTrends: () => <p>tendências da comunidade</p> }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); });

const fail = (status: number, message: string) => () => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const CATALOG = { activeCount: 1, maxActive: 3, note: "Escolha um desafio",
  challenges: [
    { code: "NO_BUY", name: "Sem compras", rule: "Use só o que tem", todayRule: "Hoje: só preto", durationDays: 7, modes: ["SOLO", "DUELO"], improves: ["Criatividade"], effortDots: 2, reward: "+40 pts", playingNow: 5, author: "bia", roomDecoration: "Vaso", highlight: "Novo" },
    { code: "WEEK", name: "Tema da semana", rule: "Regra base", weeklyTheme: "Anos 90", modes: ["EQUIPE"], improves: [], eligible: false, reason: "Limite atingido" },
    { code: "PLAIN", name: "Simples", rule: "Regra simples", modes: ["GRUPO"], improves: [], eligible: false },
  ] };
const INSTANCE = { id: "i1", code: "NO_BUY", name: "Sem compras ativo", mode: "SOLO", state: "ACTIVE", daysLeft: 3, endsAt: "2026-11-01T00:00:00Z", progress: { value: 2, target: 7, fraction: 2 / 7, label: "looks" } };
const tab = async (name: RegExp) => fireEvent.click(await screen.findByRole("tab", { name }, { timeout: 4000 }));

describe("desafios — catálogo e início", () => {
  it("mostra o catálogo com destaque, regra do dia/tema, esforço, autor, decoração e botões de elegibilidade", async () => {
    nav.search = new URLSearchParams("start=NO_BUY");
    loggedAs(undefined, { "GET /api/challenges/catalog": CATALOG, "GET /api/me/challenges": {}, "GET /api/challenges/votes": [] });
    renderApp(<ChallengesPage />);
    expect(await screen.findByText("Hoje: só preto", undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText("Escolha um desafio")).toBeTruthy();
    expect(screen.getByText("1/3 ativos")).toBeTruthy();
    expect(screen.getByText("Novo")).toBeTruthy();
    expect(screen.getByText("7 dias · esforço ●●○ · +40 pts")).toBeTruthy();
    expect(screen.getByText("5 jogando agora · por @bia · decoração: Vaso")).toBeTruthy();
    expect(screen.getByText("Anos 90")).toBeTruthy();
    expect(screen.getByText("Regra simples")).toBeTruthy();
    expect(screen.getAllByText(/^— dias · esforço ●○○/)).toHaveLength(2);
    expect((screen.getByRole("button", { name: "Limite atingido" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "indisponível" }) as HTMLButtonElement).disabled).toBe(true);
    // o desafio vindo de ?start= fica realçado
    expect(screen.getByText("Sem compras").closest(".ring-2")).toBeTruthy();
  });

  it("começar em duelo manda os convidados e abre o desafio criado", async () => {
    const href = vi.spyOn(window, "location", "get");
    const loc = { href: "" } as Location; href.mockReturnValue(loc);
    const { calls } = loggedAs(undefined, { "GET /api/challenges/catalog": CATALOG, "GET /api/me/challenges": {}, "GET /api/challenges/votes": [], "POST /api/challenges": { id: "novo", message: "Bora!" } });
    renderApp(<ChallengesPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Começar" }, { timeout: 4000 }))[0]);
    const dlg = await screen.findByRole("dialog", { name: "Sem compras" });
    expect(within(dlg).getByText("Use só o que tem")).toBeTruthy();
    expect(within(dlg).queryByLabelText("Convidar (usernames ou ids, vírgula)")).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: "DUELO" }));
    fireEvent.change(within(dlg).getByLabelText("Convidar (usernames ou ids, vírgula)"), { target: { value: "ana, , bia " } });
    fireEvent.click(within(dlg).getAllByRole("button", { name: "Começar" }).at(-1)!);
    await waitFor(() => expect(loc.href).toBe("/challenges/novo"));
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/challenges")!.body).toEqual({ code: "NO_BUY", mode: "DUELO", params: {}, invitees: ["ana", "bia"] });
    expect(await screen.findByText("Bora!")).toBeTruthy();
    href.mockRestore();
  });

  it("começar sem id na resposta usa a mensagem padrão; erro ao começar aparece", async () => {
    let n = 0;
    loggedAs(undefined, { "GET /api/challenges/catalog": CATALOG, "GET /api/me/challenges": {}, "GET /api/challenges/votes": [],
      "POST /api/challenges": () => (++n === 1 ? {} : fail(409, "Você já tem 3 ativos")()) });
    renderApp(<ChallengesPage />);
    // o guia automático da aba (GuideAuto) também abre um diálogo: mira o diálogo do desafio pelo nome
    fireEvent.click((await screen.findAllByRole("button", { name: "Começar" }, { timeout: 4000 }))[0]);
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Sem compras" })).getAllByRole("button", { name: "Começar" }).at(-1)!);
    expect(await screen.findByText("Desafio iniciado!")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sem compras" })).toBeNull());
    fireEvent.click(screen.getAllByRole("button", { name: "Começar" })[0]);
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Sem compras" })).getAllByRole("button", { name: "Começar" }).at(-1)!);
    expect(await screen.findByText("Você já tem 3 ativos")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Sem compras" })).toBeTruthy();
  });

  it("erro ao carregar o catálogo mostra o estado de erro; ?tab=trends abre as tendências", async () => {
    loggedAs(undefined, { "GET /api/challenges/catalog": fail(500, "Catálogo fora do ar"), "GET /api/me/challenges": {}, "GET /api/challenges/votes": [] });
    renderApp(<ChallengesPage />);
    expect((await screen.findAllByText("Catálogo fora do ar", undefined, { timeout: 4000 })).length).toBeGreaterThan(0);
    cleanup();
    nav.search = new URLSearchParams("tab=trends");
    loggedAs(undefined, { "GET /api/challenges/catalog": CATALOG, "GET /api/me/challenges": {}, "GET /api/challenges/votes": [] });
    renderApp(<ChallengesPage />);
    expect(await screen.findByText("tendências da comunidade", undefined, { timeout: 4000 })).toBeTruthy();
  });
});

describe("desafios — meus desafios", () => {
  it("convites aceitam e recusam; ativos com progresso e concluídos com link", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/challenges/catalog": CATALOG, "GET /api/challenges/votes": [],
      "GET /api/me/challenges": { invites: [{ id: "c1", code: "X", name: "Convite duelo", mode: "DUELO", state: "INVITED" }, { id: "c2", code: "Y", name: "Convite grupo", mode: "OUTRO", state: "INVITED" }],
        active: [INSTANCE], finished: [{ id: "f1", code: "Z", name: "Já foi", mode: "EQUIPE", state: "DONE", progress: { value: 7, target: 7, fraction: 2 } }] },
      "POST /api/challenges/c1/accept": {}, "POST /api/challenges/c2/decline": fail(400, "Não deu para recusar") });
    renderApp(<ChallengesPage />);
    await tab(/Meus desafios/);
    expect(await screen.findByText("Convites")).toBeTruthy();
    expect(screen.getByText(/SOLO · ACTIVE · 3 dias · até/)).toBeTruthy();
    expect(screen.getByText("2/7 looks")).toBeTruthy();
    expect(screen.getByText("7/7")).toBeTruthy();
    expect(screen.getByText("Concluídos")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Ver" }).map((a) => a.getAttribute("href"))).toEqual(["/challenges/i1", "/challenges/f1"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Aceitar" })[0]);
    await waitFor(() => expect(calls.find((c) => c.path === "/api/challenges/c1/accept")?.body).toEqual({ photoConsent: true }));
    fireEvent.click(screen.getAllByRole("button", { name: "Recusar" })[1]);
    expect(await screen.findByText("Não deu para recusar")).toBeTruthy();
  });

  it("aceitar com erro avisa; recusar com sucesso recarrega; sem ativos mostra o vazio que volta ao catálogo", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/challenges/catalog": CATALOG, "GET /api/challenges/votes": [],
      "GET /api/me/challenges": { invites: [{ id: "c1", code: "X", name: "Convite", mode: "SOLO", state: "INVITED" }] },
      "POST /api/challenges/c1/accept": fail(400, "Convite expirado"), "POST /api/challenges/c1/decline": {} });
    renderApp(<ChallengesPage />);
    await tab(/Meus desafios/);
    fireEvent.click(await screen.findByRole("button", { name: "Aceitar" }));
    expect(await screen.findByText("Convite expirado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/challenges/c1/decline")).toBe(true));
    expect(screen.getByText("Nenhum desafio ativo.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver catálogo" }));
    expect(await screen.findByText("Hoje: só preto")).toBeTruthy();
  });
});

describe("desafios — votação e proposta", () => {
  it("vota numa entrada (marcada se já votada) e erro de voto avisa; sem votações mostra vazio", async () => {
    let n = 0;
    const { calls } = loggedAs(undefined, { "GET /api/challenges/catalog": CATALOG, "GET /api/me/challenges": {},
      "GET /api/challenges/votes": [{ id: "v1", name: "Melhor look", entries: [{ entryId: "e1", title: "Look A", coverImageUrl: "/a.png", votes: 3, votedByMe: true }, { entryId: "e2", title: "Look B" }] }, { id: "v2" }],
      "POST /api/challenges/v1/votes": () => (++n === 1 ? {} : fail(409, "Voto repetido")()) });
    renderApp(<ChallengesPage />);
    await tab(/Votação/);
    expect(await screen.findByText("Melhor look")).toBeTruthy();
    expect(screen.getAllByText("Votação").length).toBeGreaterThan(1);
    expect(screen.getByText("3 votos")).toBeTruthy();
    expect(screen.getByText("0 votos")).toBeTruthy();
    expect(screen.getByText("Look A").closest("button")!.className).toContain("ring-2");
    fireEvent.click(screen.getByText("Look B").closest("button")!);
    await waitFor(() => expect(calls.find((c) => c.path === "/api/challenges/v1/votes")?.body).toEqual({ entrySchemeId: "e2" }));
    fireEvent.click(screen.getByText("Look B").closest("button")!);
    expect(await screen.findByText("Voto repetido")).toBeTruthy();
    cleanup();
    loggedAs(undefined, { "GET /api/challenges/catalog": CATALOG, "GET /api/me/challenges": {}, "GET /api/challenges/votes": [] });
    renderApp(<ChallengesPage />);
    await tab(/Votação/);
    expect(await screen.findByText("Nenhuma votação aberta.")).toBeTruthy();
  });

  it("proposta exige nome e regra, alterna modos, envia e limpa; erro avisa", async () => {
    let n = 0;
    const { calls } = loggedAs(undefined, { "GET /api/challenges/catalog": CATALOG, "GET /api/me/challenges": {}, "GET /api/challenges/votes": [],
      "POST /api/challenges/proposals": () => (++n === 1 ? {} : fail(400, "Nome repetido")()) });
    renderApp(<ChallengesPage />);
    await tab(/^Propor$/);
    const send = await screen.findByRole("button", { name: "Enviar" });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(document.getElementById("pname")!, { target: { value: "Só verde" } });
    fireEvent.change(document.getElementById("prule")!, { target: { value: "Um item verde" } });
    fireEvent.change(document.getElementById("pdays")!, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "DUELO" }));
    fireEvent.click(screen.getByRole("button", { name: "SOLO" }));
    fireEvent.click(send);
    expect(await screen.findByText("Proposta enviada para curadoria.")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/challenges/proposals")!.body).toEqual({ name: "Só verde", blocks: [{ type: "RULE", text: "Um item verde" }], modes: ["DUELO"], durationDays: 5 });
    expect((document.getElementById("pname") as HTMLInputElement).value).toBe("");
    fireEvent.change(document.getElementById("pname")!, { target: { value: "Outro" } });
    fireEvent.change(document.getElementById("prule")!, { target: { value: "Regra" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Nome repetido")).toBeTruthy();
  });
});

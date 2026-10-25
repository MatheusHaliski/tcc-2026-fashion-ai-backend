// @vitest-environment jsdom
/**
 * FLAIR — Momentos do grupo: sem grupo, erro, seções vazias/cheias, memórias (com e sem números) e o diálogo de criação
 * (validação de datas, modo cooperativo troca prêmios pela meta, corpo enviado, erro do servidor).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { CreateGroupMomentDialog, GroupMomentsPanel } from "@/components/moments/flair-moments";
import type { MomentCard } from "@/lib/moments/types";
import { __setTaxonomyCache, type Taxonomy } from "@/lib/api/taxonomy";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); __setTaxonomyCache(null); });

const time = { status: "ACTIVE" as const, now: "2026-10-25T00:00:00Z", startAt: "2026-10-20T03:00:00Z", endAt: "2026-11-01T02:59:59Z", timezone: "UTC", localStart: "2026-10-20", localEnd: "2026-10-31", startsInSeconds: 0, endsInSeconds: 3 * 86400, elapsed: 0.5 };
const card = (id: string, name: string, o: Partial<MomentCard> = {}): MomentCard => ({ id, slug: id, name, type: "PRIVATE_GROUP", nature: "PRIVATE", scope: "GROUP", visibility: "GROUP", official: false, featured: false, sponsored: false, pointsEnabled: false, basePoints: 0, pointsMultiplier: 1, styleTags: [], occasionTags: [], colorTags: [], theme: {}, time, ...o });
const GROUP = { id: "g1", name: "Amigas", activeCount: 1, upcomingCount: 0 };
const fail = () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "Servidor caiu" }), { status: 500, headers: { "content-type": "application/json" } });

describe("GroupMomentsPanel", () => {
  it("sem grupo convida a abrir o FLAIR", () => {
    renderApp(<GroupMomentsPanel group={null} />);
    expect(screen.getByText("Você ainda não está em um grupo FLAIR.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir FLAIR" }).getAttribute("href")).toBe("/flair/partidas");
  });

  it("erro do servidor mostra o estado de erro", async () => {
    mockApi({ "GET /api/flair/groups/g1/moments": fail });
    renderApp(<GroupMomentsPanel group={GROUP} />);
    expect(await screen.findByText("Servidor caiu")).toBeTruthy();
  });

  it("grupo vazio: seções com textos de vazio", async () => {
    mockApi({ "GET /api/flair/groups/g1/moments": { ...GROUP, color: null, members: 1, modes: [], active: [], upcoming: [], history: [] } });
    renderApp(<GroupMomentsPanel group={GROUP} />);
    expect(await screen.findByRole("heading", { name: "Amigas" })).toBeTruthy();
    expect(screen.getByText("1 membro")).toBeTruthy();
    expect(screen.getByText("Nada acontecendo agora.")).toBeTruthy();
    expect(screen.getByText("Nada agendado.")).toBeTruthy();
    expect(screen.getByText(/As memórias do grupo aparecem aqui/)).toBeTruthy();
  });

  it("grupo com Momentos ativos, próximos e memórias (com e sem números)", async () => {
    mockApi({ "GET /api/flair/groups/g1/moments": { ...GROUP, color: "#f00", members: 4, modes: [],
      active: [card("a1", "Noite gótica")], upcoming: [card("u1", "Denim total", { time: { ...time, status: "SCHEDULED", startsInSeconds: 86400 * 2 } })],
      history: [card("h1", "Baile", { memory: { participants: 4, looks: 6, votes: 12, winner: { submissionId: "s", schemeId: "x", votes: 5, title: "Vestido" } } }), card("h2", "Praia", { memory: { winner: { submissionId: "s", schemeId: "y", votes: 1 } } }), card("h3", "Sem memória")] } });
    renderApp(<GroupMomentsPanel group={GROUP} />);
    expect(await screen.findByRole("link", { name: "Noite gótica" })).toBeTruthy();
    expect(screen.getByText("4 membros")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Denim total" })).toBeTruthy();
    expect(screen.getByText("Vestido")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getAllByText("Look vencedor").length).toBe(2);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("A memória é montada quando o Momento termina.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Criar Momento privado" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("CreateGroupMomentDialog", () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Halloween das amigas" } });
    fireEvent.change(screen.getByLabelText(/^Início/), { target: { value: "2026-10-30T18:00" } });
    fireEvent.change(screen.getByLabelText(/^Fim/), { target: { value: "2026-10-31T23:00" } });
  };

  it("valida período, envia o corpo com prêmios filtrados e opções, e avisa o grupo", async () => {
    const onCreated = vi.fn(); const onClose = vi.fn();
    const { calls } = mockApi({ "POST /api/flair/groups/g1/moments": { id: "new" } });
    __setTaxonomyCache({ styles: ["edgy", "minimalist"], colors: { black: "#000" } } as unknown as Taxonomy);
    renderApp(<CreateGroupMomentDialog groupId="g1" open onClose={onClose} onCreated={onCreated} />);
    const save = screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fill();
    fireEvent.change(screen.getByLabelText(/^Fim/), { target: { value: "2026-10-29T10:00" } });
    expect(save.disabled).toBe(true);   // fim antes do início
    fireEvent.change(screen.getByLabelText(/^Fim/), { target: { value: "2026-10-31T23:00" } });
    expect(save.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText(/^Tema/), { target: { value: "Gótico" } });
    fireEvent.change(screen.getByLabelText(/^Prêmios/), { target: { value: "100, x, -3, 50" } });
    fireEvent.change(screen.getByLabelText(/^Looks por pessoa/), { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText(/^Regras/), { target: { value: "Só preto" } });
    fireEvent.change(screen.getByLabelText(/^Descrição/), { target: { value: "Festa" } });
    fireEvent.click(await screen.findByRole("button", { name: "Ousado" }));
    fireEvent.click(screen.getByRole("button", { name: "Preto" }));
    for (const name of ["Permitir votação", "Votação anônima", "Permitir remix", "Permitir comentários", "Permitir IA", "Permitir peças externas"]) fireEvent.click(screen.getByRole("switch", { name }));
    fireEvent.click(screen.getByRole("button", { name: /^Privacidade/ }));
    fireEvent.click(screen.getByRole("option", { name: "Privado" }));
    fireEvent.click(save);
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText("Momento criado. Seu grupo foi avisado.")).toBeTruthy();
    const body = calls.find((c) => c.method === "POST")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ name: "Halloween das amigas", description: "Festa", theme: "Gótico", startAt: "2026-10-30T18:00", endAt: "2026-10-31T23:00", visibility: "PRIVATE", flairMode: "MOMENT", looksPerUser: 0,
      allowRemix: false, allowVoting: false, allowComments: false, allowAi: false, allowExternalPieces: false, anonymousVoting: false, prizes: [100, 50], cooperativeGoal: 20, styleTags: ["edgy"], colorTags: ["black"], rules: "Só preto" });
    expect(typeof body.timezone).toBe("string");
  });

  it("modo cooperativo troca prêmios pela meta; campos vazios viram null; erro vira aviso", async () => {
    const onCreated = vi.fn();
    const { calls } = mockApi({ "POST /api/flair/groups/g1/moments": fail });
    renderApp(<CreateGroupMomentDialog groupId="g1" open onClose={() => {}} onCreated={onCreated} />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /^Modo/ }));
    fireEvent.click(screen.getByRole("option", { name: "Cooperativo" }));
    expect(screen.getByText("Sem vencedor: se o grupo alcança a meta de looks, todos ganham.")).toBeTruthy();
    expect(screen.queryByLabelText(/^Prêmios/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Meta de looks/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Servidor caiu")).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
    const body = calls.find((c) => c.method === "POST")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ flairMode: "COOPERATIVE", cooperativeGoal: null, description: null, theme: null, rules: null, looksPerUser: 1 });
  });
});

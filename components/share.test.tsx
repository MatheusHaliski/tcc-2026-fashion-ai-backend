// @vitest-environment jsdom
/**
 * Compartilhar (RF19.CA08/CA09) — o botão cria um post no feed social do FashionAI: o post é o próprio card, SEM
 * descrição (o diálogo mostra a prévia, não tem campo de legenda); o diálogo abre por cima de tudo (portal no <body>,
 * nunca preso no card), conteúdo privado da dona pede "Tornar público e publicar", o DNA de estilo usa o tipo DNA da
 * API, copiar o link copia o link confirmado e o Feed mostra o post com quem compartilhou.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { OWNER, PIECE, SCHEME } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { CardActions, ShareDialog, interactionType } from "./interactions";
import FeedPage from "@/app/(site)/(app)/feed/page";

const HYPE = { "GET /api/hype/summaries": { type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const posts = (calls: { method: string; path: string; body?: unknown }[]) => calls.filter((c) => c.method === "POST" && c.path.endsWith("/shares"));

beforeEach(() => __resetHypeStore());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Compartilhar › diálogo", () => {
  it("abre no <body> (fora do card), mostra a prévia do post sem campo de descrição e publica no feed", async () => {
    const { calls } = loggedAs(undefined, { "POST /api/interactions/PIECE/p1/shares": { shareId: "x", channel: "FEED", shares: 1 }, "GET /api/pieces/p1": { piece: PIECE } });
    const { container } = renderApp(<div className="card-box"><CardActions type="PIECE" id="p1" counters={PIECE.counters} viewer={PIECE.viewer} title="Camiseta" compact /></div>);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /Compartilhar/ }));
    const dialog = await screen.findByRole("dialog", { name: "Compartilhar" });
    expect(container.contains(dialog)).toBe(false);                  // portal: a contenção do card não prende o diálogo
    expect(document.body.contains(dialog)).toBe(true);
    // a prévia do post é o próprio card, com "@você compartilhou" — e não há campo de descrição
    const preview = await screen.findByRole("figure", { name: "Prévia do post" });
    await waitFor(() => expect(preview.textContent).toContain(PIECE.name));
    expect(preview.textContent).toContain(`@${ME.user.username} compartilhou`);
    expect(dialog.querySelector("textarea")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Publicar no feed" }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0].body).toEqual({ channel: "FEED" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Compartilhar" })).toBeNull());
    // a contagem do botão sobe na hora
    expect(screen.getByRole("button", { name: /Compartilhar/ }).textContent).toContain(String((PIECE.counters?.shares ?? 0) + 1));
  });

  it("conteúdo privado da dona: avisa e só publica depois de 'Tornar público e publicar'", async () => {
    const { calls } = loggedAs(undefined, {
      "POST /api/interactions/SCHEME/s1/shares": (_u: URL, init: RequestInit) => (JSON.parse(String(init.body)).publish
        ? { shareId: "x", published: true }
        : new Response(JSON.stringify({ status: 409, code: "PUBLICAR_PARA_COMPARTILHAR", message: "privado" }), { status: 409, headers: { "content-type": "application/json" } })),
    });
    renderApp(<ShareDialog type="SCHEME" id="s1" open onClose={vi.fn()} />);
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: "Publicar no feed" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/privado/);
    fireEvent.click(screen.getByRole("button", { name: "Tornar público e publicar" }));
    await waitFor(() => expect(posts(calls)).toHaveLength(2));
    expect(posts(calls)[1].body).toMatchObject({ channel: "FEED", publish: true });
  });

  it("copiar o link registra o compartilhamento e copia o link do app", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const { calls } = loggedAs(undefined, { "POST /api/interactions/PIECE/p1/shares": { link: "/pieces/p1" } });
    renderApp(<ShareDialog type="PIECE" id="p1" open onClose={vi.fn()} />);
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: "Copiar link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/pieces/p1`));
    expect(posts(calls)[0].body).toMatchObject({ channel: "EXTERNAL" });
  });

  it("sem permissão de área de transferência, mostra o link para copiar à mão", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("NotAllowed")) } });
    loggedAs(undefined, { "POST /api/interactions/PIECE/p1/shares": { link: "/pieces/p1" } });
    renderApp(<ShareDialog type="PIECE" id="p1" open onClose={vi.fn()} />);
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: "Copiar link" }));
    expect(((await screen.findByLabelText(/Copie o link/)) as HTMLInputElement).value).toBe(`${window.location.origin}/pieces/p1`);
  });

  it("o DNA de estilo usa o tipo DNA da API (DNA_SCHEME voltava 400 em toda interação)", () => {
    expect(interactionType("DNA_SCHEME")).toBe("DNA");
    expect(interactionType("PIECE")).toBe("PIECE");
  });
});

describe("Compartilhar › Feed", () => {
  it("o post compartilhado (peça ou look) aparece no Feed com quem compartilhou, sem descrição", async () => {
    loggedAs(undefined, {
      ...HYPE,
      "GET /api/feed": { items: [SCHEME], nextCursor: null, chips: [], entries: [
        { kind: "PIECE", id: PIECE.id, piece: PIECE, sharedBy: OWNER, caption: "legenda antiga" },   // dado antigo: não aparece
        { kind: "SCHEME", id: SCHEME.id, scheme: SCHEME },
      ] },
    });
    renderApp(<FeedPage />);
    await settle();
    expect(await screen.findByText(`@${OWNER.username} compartilhou`)).toBeTruthy();
    expect(screen.queryByText(/legenda antiga/)).toBeNull();
    expect(screen.getAllByText(PIECE.name).length).toBeGreaterThan(0);
    expect(screen.getByText(SCHEME.title)).toBeTruthy();
  });

  it("na Passarela, a peça que eu compartilhei aparece (entrada { reason: COMPARTILHADO, piece })", async () => {
    loggedAs(undefined, {
      ...HYPE,
      "GET /api/feed": { items: [], nextCursor: null, chips: [] },
      "GET /api/runway": { items: [{ reason: "COMPARTILHADO", piece: PIECE, by: OWNER, caption: "null", at: "2026-10-07T00:00:00Z" }], nextCursor: null },
    });
    renderApp(<FeedPage />);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Passarela" }));
    expect(await screen.findByText(`@${OWNER.username} compartilhou`)).toBeTruthy();
    expect(screen.queryByText(/null/)).toBeNull();
  });
});

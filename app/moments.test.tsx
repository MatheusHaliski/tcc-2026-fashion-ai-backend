// @vitest-environment jsdom
/**
 * Momentos (docs/momentos/MOMENTOS.md): a home mostra o Momento ativo com contagem informativa e caminhos de participação;
 * o banner do feed só aparece com Momento relevante; a página genérica abre pelo slug com tema como camada; o verso do
 * card lista a relevância por Momento.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import MomentsPage from "@/app/(site)/(app)/moments/page";
import { MomentNowBanner } from "@/components/moments/moment-banner";
import { MomentPage } from "@/components/moments/moment-page";
import { MomentContextRows } from "@/components/moments/moment-scores";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); });

const NOW = new Date().toISOString();
const time = { status: "ACTIVE", now: NOW, startAt: "2026-10-20T03:00:00Z", endAt: "2026-11-01T02:59:59Z", timezone: "America/Sao_Paulo", localStart: "2026-10-20", localEnd: "2026-10-31", startsInSeconds: 0, endsInSeconds: 6 * 86400 + 3600, elapsed: 0.45, daysLeft: 7 };
const HALLOWEEN = { id: "m1", slug: "halloween-2026", name: "Halloween 2026", description: "Dark, gothic, minimal ou experimental.", type: "CULTURAL", nature: "CULTURAL", scope: "GLOBAL", visibility: "PUBLIC", official: true, featured: true, sponsored: false, pointsEnabled: true, basePoints: 20, pointsMultiplier: 1.5,
  styleTags: ["edgy", "minimalist"], occasionTags: ["party"], colorTags: ["black", "orange"], theme: { accent: "#F57C1F", background: "#1A1020", gradient: "linear-gradient(135deg,#1A1020,#F57C1F)", icon: "🎃", tone: "dark" }, time, participantCount: 14200, me: null };
const DENIM = { ...HALLOWEEN, id: "m2", slug: "denim-week-2026", name: "Denim Week", featured: false, pointsMultiplier: 1, theme: { accent: "#2D55C9", icon: "👖" }, time: { ...time, status: "SCHEDULED", startsInSeconds: 3 * 86400, endsInSeconds: 0, elapsed: 0, daysLeft: null, localStart: "2026-11-09", localEnd: "2026-11-15" }, participantCount: 0 };
const HOME = { now: NOW, active: [HALLOWEEN], upcoming: [DENIM], featured: HALLOWEEN, mine: { saved: 1, participated: 2, completed: 1, points: 55 }, group: null, principle: "A moda não acontece fora do tempo." };
const DETAIL = { ...HALLOWEEN, interpretations: [{ key: "dark", label: "Dark", styleTags: ["edgy"], colorTags: ["black"] }, { key: "minimal", label: "Minimal Halloween", styleTags: ["minimalist"], colorTags: [] }],
  challenges: [{ id: "c1", code: "NO_BUY_HALLOWEEN", name: "No-Buy Halloween", description: "Use apenas o seu guarda-roupa.", kind: "NO_BUY", points: 40, styleTags: [], colorTags: [], occasionTags: [], params: { wardrobeOnly: true }, active: true }],
  rules: {}, settings: { allowVoting: true }, requiredItems: [], suggestedItems: [], bonusRules: { wardrobe: 25, rediscovery: 15 }, sensitive: false, competitive: true, cooperative: false, isCreator: false, isMember: false, stats: { participants: 14200, looks: 230 }, mySubmissions: [], trending: { styles: [{ key: "edgy", count: 40 }], colors: [], interpretations: [{ key: "dark", count: 30 }], looks: [], basis: 230 } };

describe("Momentos — a aba do tempo da moda", () => {
  it("home: Agora com contagem informativa, multiplicador e os caminhos de participação", async () => {
    loggedAs(undefined, { "GET /api/moments": HOME });
    renderApp(<MomentsPage />);
    expect(await screen.findByRole("heading", { name: "Halloween 2026" })).toBeTruthy();
    expect(screen.getByText("Agora no FashionAI")).toBeTruthy();
    expect(screen.getAllByText("Termina em 6 dias").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+50% FAI Points").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Criar look" }).getAttribute("href")).toContain("/schemes/new?moment=halloween-2026");
    expect(screen.getByRole("link", { name: "Pedir ao Copilot" }).getAttribute("href")).toContain("/copilot?ask=");
    expect(screen.queryByText(/última chance/i)).toBeNull();   // nunca FOMO
    // os próximos aparecem resumidos na home e completos na aba Próximos
    expect(screen.getAllByText("Denim Week").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: /Próximos/ }));
    expect(await screen.findByText("Começa em 3 dias")).toBeTruthy();
  });

  it("home sem Momento ativo mostra estado vazio, sem banner permanente", async () => {
    loggedAs(undefined, { "GET /api/moments": { ...HOME, active: [], featured: null, upcoming: [] } });
    renderApp(<MomentsPage />);
    expect(await screen.findByText("Nenhum Momento acontecendo agora.")).toBeTruthy();
    expect(screen.queryByText("Agora no FashionAI")).toBeNull();
  });

  it("banner do feed: aparece só com Momento relevante e pode ser dispensado", async () => {
    loggedAs(undefined, { "GET /api/moments/now": { now: NOW, moment: HALLOWEEN } });
    renderApp(<MomentNowBanner />);
    expect(await screen.findByText("Halloween 2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Participar" }).getAttribute("href")).toBe("/moments/halloween-2026");
    fireEvent.click(screen.getByRole("button", { name: "Dispensar este aviso" }));
    expect(screen.queryByText("Halloween 2026")).toBeNull();
    cleanup();
    localStorage.clear();
    loggedAs(undefined, { "GET /api/moments/now": { now: NOW, moment: null } });
    const { container } = renderApp(<MomentNowBanner />);
    await waitFor(() => new Promise((r) => setTimeout(r, 30)));
    expect(container.textContent).toBe("");
  });

  it("página genérica: tema como camada, interpretações, desafios e participar", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/moments/halloween-2026": DETAIL, "POST /api/moments/halloween-2026/join": { message: "Você está dentro." } });
    renderApp(<MomentPage idOrSlug="halloween-2026" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Halloween 2026" })).toBeTruthy();
    const head = document.querySelector(".moment-page-head") as HTMLElement;
    expect(head.getAttribute("data-tone")).toBe("dark");
    expect(head.style.getPropertyValue("--moment-accent")).toBe("#F57C1F");
    expect(screen.getByText("Minimal Halloween")).toBeTruthy();
    expect(screen.getByText("Não existe uma única maneira certa: o seu estilo interpreta o tema.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Participar" }));
    expect(await screen.findByText("Como quer participar?")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Experimental/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Participar" }).at(-1)!);
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/moments/halloween-2026/join")).toBe(true));
    const join = calls.find((c) => c.method === "POST" && c.path === "/api/moments/halloween-2026/join");
    expect(join?.body).toEqual({ approach: "EXPERIMENTAL", wardrobeOnly: true });
    fireEvent.click(screen.getByRole("tab", { name: /Desafios/ }));
    expect(await screen.findByText("No-Buy Halloween")).toBeTruthy();
    expect(screen.getByText("+40")).toBeTruthy();
  });

  it("verso do card: relevância por Momento ativo sem tocar no Hype global", async () => {
    mockApi({ "GET /api/moments/context/SCHEME/s1": { type: "SCHEME", id: "s1", globalHype: 67, moments: [{ momentId: "m1", slug: "halloween-2026", name: "Halloween 2026", icon: "🎃", match: 88, interpretation: "dark", contextualHype: 86 }, { momentId: "m3", slug: "primavera-2026", name: "Primavera 2026", icon: "🌸", match: null, contextualHype: null }] } });
    renderApp(<MomentContextRows type="SCHEME" id="s1" />);
    expect(await screen.findByText("Halloween 2026")).toBeTruthy();
    expect(screen.getByText("88")).toBeTruthy();
    expect(screen.getByText("Hype 86")).toBeTruthy();
    expect(screen.getByText("leitura: dark")).toBeTruthy();
    expect(screen.getByText("Primavera 2026")).toBeTruthy();
  });
});

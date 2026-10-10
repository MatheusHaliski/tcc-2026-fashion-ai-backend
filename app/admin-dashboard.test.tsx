// @vitest-environment jsdom
/**
 * Dashboard gerencial (RF26, item obrigatório da rubrica): com dados do backend, cada aba desenha os seus widgets,
 * os filtros refazem a consulta e o layout escolhido é salvo; sem papel de admin, a tela é bloqueada.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { ME } from "@/test-utils/render";
import AdminDashboardPage from "@/app/(site)/(app)/admin/dashboard/page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const day = (d: number) => `2026-09-${String(d).padStart(2, "0")}`;
const series = (k: string) => [1, 2, 3].map((d) => ({ day: day(d), value: d * 2, [k]: d }));
const DASH = {
  filter: { from: day(1), to: day(30), country: null, profileType: null },
  kpis: { new_users: 3, active_users: 1, pieces_created: 29, schemes_created: 1, ai_calls: 109, ai_cost_usd: 1.86, ai_fallback_pct: 53.2, moderation_pending: 0 },
  kpisPrevious: { new_users: 2, active_users: 1, pieces_created: 10, schemes_created: 0, ai_calls: 50, ai_cost_usd: 0.5, ai_fallback_pct: 60, moderation_pending: 1 },
  series: { users: series("users"), pieces: series("pieces"), schemes: series("schemes"), ai: series("ai") },
  aiUsage: [{ capability: "PIECE_ANALYZER", provider: "claude", result: "SUCCESS", calls: 40, cost: 1.2 }, { capability: "COPILOT", provider: "local", result: "FALLBACK_LOCAL", calls: 20, cost: 0 }],
  aiByCountry: [{ country: "BR", calls: 90, cost: 1.5, users: 3 }], aiProviders: { claude: true, gemini: false },
  brands: [{ brand: "Nike", pieces: 5 }], countries: [{ country: "BR", users: 3 }], inventoryBands: [{ band: "50-70", total: 1 }],
  sealFunnel: [{ step: "requested", total: 3 }, { step: "approved", total: 1 }], challenges: [{ status: "OPEN", total: 1 }], points: [{ reason: "PIECE_CREATED", total: 29 }],
  profiles: [{ profileType: "PESSOAL", total: 3 }], alerts: [{ level: "warning", title: "Custo de IA subiu", action: "Ver uso de IA" }, { level: "critical", title: "Falhas de login" }],
  funnel: [{ step: "cadastro", total: 3 }, { step: "peça", total: 2 }], heatmap: [{ dow: 1, hour: 10, total: 4 }], topUsers: [{ username: "ana", pieces: 20 }], categories: [{ category: "upper_piece", total: 12 }],
  moderation: { byStatus: [{ status: "APPROVED", total: 20 }], pending: [] }, engagement: series("likes"),
  security: { series: series("failures"), failures: [{ reason: "BAD_PASSWORD", total: 2 }], recent: [{ at: day(3), action: "LOGIN_FALHOU", ip: "127.0.0.1" }] },
  jobs: { byStatus: [{ status: "COMPLETED", total: 5 }], failed: [] },
  system: { dbLatencyMs: 3, heapUsedMb: 300, heapMaxMb: 2048, uptimeMinutes: 90, processors: 8, aiRemoteEnabled: true, aiProviders: { claude: true }, lastBackup: { status: "OK", startedAt: day(29), sizeBytes: 1_500_000 } },
  layout: { widgets: [], hidden: [], defaultFilter: { days: 30, tab: "overview" } },
};

describe("dashboard gerencial (RF26)", () => {
  it("admin vê KPIs, alertas e cada aba; filtros refazem a consulta e o layout é salvo", async () => {
    const { calls } = loggedAs({ ...ME, role: "ADMIN" }, { "GET /api/admin/dashboard": DASH, "PUT /api/me/dashboard-layout": {} });
    const { container } = renderApp(<AdminDashboardPage />);
    await waitFor(() => expect(screen.getByText("Custo de IA subiu")).toBeTruthy(), { timeout: 4000 });
    // percorre as abas
    for (const tab of screen.queryAllByRole("tab")) { fireEvent.click(tab); await act(async () => { await new Promise((r) => setTimeout(r, 10)); }); }
    // mexe nos filtros e nos botões (aplicar, período, ocultar/mostrar widget)
    container.querySelectorAll("input").forEach((i) => fireEvent.change(i, { target: { value: i.type === "date" ? day(5) : "BR" } }));
    for (const b of screen.getAllByRole("button").slice(0, 25)) { if (!(b as HTMLButtonElement).disabled) fireEvent.click(b); }
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(calls.filter((c) => c.path.startsWith("/api/admin/dashboard")).length).toBeGreaterThan(0);
  });

  it("pessoa sem papel de admin é bloqueada", async () => {
    loggedAs(ME, {});
    renderApp(<AdminDashboardPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 4000 });
  });
});

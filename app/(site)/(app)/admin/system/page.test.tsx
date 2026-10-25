// @vitest-environment jsdom
/**
 * Administração · Sistema e IA: provedores e catálogo de IA, tarefas agendadas, estado do HypeScore v2, backups,
 * inferências recentes e logos de marcas (origem, confiança, nova busca, envio manual). Cada ação avisa o resultado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import SystemPage from "./page";

vi.mock("@/components/hype/hype-dashboards", () => ({
  HypeJobStatus: ({ job }: { job: { algorithmVersion: string } }) => <p>job {job.algorithmVersion}</p>,
  HypeCoverageTable: ({ rows }: { rows: unknown[] }) => <p>cobertura {rows.length}</p>,
}));
vi.mock("@/components/brand-logo", () => ({ BrandLogo: ({ name }: { name: string }) => <i>logo {name}</i> }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ADMIN = { ...ME, role: "ADMIN" as const };
const fail = (status: number, message: string) => () => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const AI = { remoteEnabled: true, providers: { claude: true, local: false },
  catalog: [{ capability: "tag", name: "Etiquetas", primary: "claude", status: "OK", dailyQuota: 100, hostRf: "RF05" }, { capability: "dna", name: "DNA", primary: "local", status: "OFF" }],
  recent: [{ capability: "tag", provider: "claude", result: "OK", latencyMs: 120, costUsd: 0.01 }, { capability: "dna", provider: "local", result: "FALLBACK", fallback: true }],
  hypeV2: { algorithmVersion: "v2.1", lastCalculatedAt: null, lastSnapshotDate: null, rows: 0, staleAfterHours: 24, stale: null, coverage: [{}, {}] } };
const LOGOS = [
  { name: "Nike", url: "/n.png", source: "WIKIDATA", status: "FOUND", domain: "nike.com", confidence: 0.92 },
  { name: "Zara", source: "MONOGRAMA", status: "PENDING", nextAttemptAt: "2026-10-26T10:00:00Z" },
  { name: "Outra", source: "DESCONHECIDA", status: "FOUND" },
];
const BACKUPS = [{ id: "b1", kind: "INCR", sizeBytes: 20480, ok: true, createdAt: "2026-10-24T03:00:00Z" }, { ok: false }];
const base = { "GET /api/admin/ai": AI, "GET /api/admin/brand-logos": LOGOS, "GET /api/admin/backups": BACKUPS };

describe("admin · sistema e IA", () => {
  it("mostra provedores, catálogo, HypeScore, backups, inferências e logos", async () => {
    loggedAs(ADMIN, base);
    renderApp(<SystemPage />);
    expect(await screen.findByText("Etiquetas", undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText(/Remoto ligado/)).toBeTruthy();
    expect(screen.getByText("claude ✓")).toBeTruthy();
    expect(screen.getByText("local ✗")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("job v2.1")).toBeTruthy();
    expect(screen.getByText("cobertura 2")).toBeTruthy();
    expect(screen.getByText(/· INCR · ok/)).toBeTruthy();
    expect(screen.getByText("20 KB")).toBeTruthy();
    expect(screen.getByText("· FULL · falhou")).toBeTruthy();
    expect(screen.getByText("tag · claude · OK")).toBeTruthy();
    expect(screen.getByText("dna · local(IA local) · FALLBACK")).toBeTruthy();
    expect(screen.getByText(/^0 ms ·$/)).toBeTruthy();
    expect(screen.getByText(/^120 ms · .*0[.,]01/)).toBeTruthy();
    expect(await screen.findByText("Wikidata / Commons · nike.com · 92%")).toBeTruthy();
    expect(screen.getByText(/^monograma \(aguardando\) · nova busca /)).toBeTruthy();
    expect(screen.getByText("DESCONHECIDA")).toBeTruthy();
  });

  it("vazios: remoto desligado, sem HypeScore, sem backups, sem inferências e sem marcas", async () => {
    loggedAs(ADMIN, { "GET /api/admin/ai": { remoteEnabled: false, providers: {}, catalog: [], hypeV2: { ...AI.hypeV2, coverage: [] } }, "GET /api/admin/brand-logos": [], "GET /api/admin/backups": [] });
    renderApp(<SystemPage />);
    expect(await screen.findByText(/Remoto desligado/, undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText(/^cobertura/)).toBeNull();
    expect(screen.getByText("Nenhum backup registrado.")).toBeTruthy();
    expect(screen.getByText("Sem chamadas ainda.")).toBeTruthy();
    expect(await screen.findByText("Nenhuma marca consultada ainda.")).toBeTruthy();
    cleanup();
    loggedAs(ADMIN, { "GET /api/admin/ai": { remoteEnabled: false, providers: {}, catalog: [] }, "GET /api/admin/brand-logos": [], "GET /api/admin/backups": [] });
    renderApp(<SystemPage />);
    expect(await screen.findByText("Estado do HypeScore indisponível.", undefined, { timeout: 4000 })).toBeTruthy();
  });

  it("tarefas agendadas e recálculo avisam (com a mensagem da API quando vem); erro avisa", async () => {
    const { calls } = loggedAs(ADMIN, { ...base, "POST /api/admin/jobs/hype": { message: "12 perfis" }, "POST /api/admin/jobs/rankings": {}, "POST /api/admin/jobs/assets": fail(500, "Assets falhou") });
    renderApp(<SystemPage />);
    fireEvent.click(await screen.findByRole("button", { name: "hype" }, { timeout: 4000 }));
    expect(await screen.findByText("Tarefa hype executada: 12 perfis")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "rankings" }));
    expect(await screen.findByText("Tarefa rankings executada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "assets" }));
    expect(await screen.findByText("Assets falhou")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Recalcular agora" }));
    expect(await screen.findByText("HypeScore recalculado: 12 perfis")).toBeTruthy();
    expect(calls.filter((c) => c.method === "POST" && c.path === "/api/admin/jobs/hype")).toHaveLength(2);
  });

  it("backup, busca dos pendentes, nova busca de uma marca e envio do logo", async () => {
    const { calls } = loggedAs(ADMIN, { ...base, "POST /api/admin/backups": {}, "POST /api/admin/brand-logos/refresh-pending": {}, "POST /api/admin/brand-logos/refresh": {}, "POST /api/admin/brand-logos/upload": {} });
    renderApp(<SystemPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Executar backup agora" }, { timeout: 4000 }));
    expect(await screen.findByText("Backup solicitado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buscar pendentes agora" }));
    expect(await screen.findByText("Busca dos pendentes executada")).toBeTruthy();
    fireEvent.click((await screen.findAllByRole("button", { name: "Buscar" }))[1]);
    expect(await screen.findByText("Nova busca de Zara")).toBeTruthy();
    expect(calls.some((c) => c.path === "/api/admin/brand-logos/refresh?name=Zara")).toBe(true);
    const input = (await screen.findAllByTitle("enviar o logo correto"))[0].querySelector("input")!;
    fireEvent.change(input, { target: { files: [] } });
    fireEvent.change(input, { target: { files: [new File(["x"], "nike.png", { type: "image/png" })] } });
    expect(await screen.findByText("Logo de Nike atualizado")).toBeTruthy();
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/admin/brand-logos/upload?name=Nike")).toHaveLength(1));
  });
});

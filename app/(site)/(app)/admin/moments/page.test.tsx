// @vitest-environment jsdom
/**
 * Administração de Momentos: lista com estados e ações de ciclo de vida, job manual, criação com todos os campos
 * (traduções, tema, pontos, etiquetas, desafios) e as validações de fuso e JSON antes de salvar.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import AdminMomentsPage from "./page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ADMIN = { ...ME, role: "ADMIN" as const };
const TAXONOMY = { subcategories: {}, colors: { black: "#000", orange: "#f80" }, materials: [], sizes: [], sexes: [], occasions: ["party", "work"], styles: ["edgy", "minimalist"], allowedOccasionsByCategory: {} };
const time = { status: "ACTIVE", now: "2026-10-24T12:00:00Z", startAt: "2026-10-20T03:00:00Z", endAt: "2026-11-01T02:59:59Z", timezone: "America/Sao_Paulo", localStart: "2026-10-20", localEnd: "2026-10-31", startsInSeconds: 0, endsInSeconds: 1, elapsed: 0.5, daysLeft: 7 };
const ROW = { id: "m1", slug: "halloween-2026", name: "Halloween 2026", description: "Dark", type: "CULTURAL", nature: "CULTURAL", scope: "COUNTRY", country: "BR", visibility: "PUBLIC", official: true, featured: true, sponsored: true, pointsEnabled: true, basePoints: 20, pointsMultiplier: 1.5,
  styleTags: ["edgy"], occasionTags: ["party"], colorTags: ["black"], theme: { accent: "#F57C1F", icon: "🎃" }, time, participantCount: 1, me: null, storedStatus: "ACTIVE", challenges: 1 };
const DRAFT = { ...ROW, id: "m2", slug: "rascunho", name: "Rascunho", country: null, featured: false, sponsored: false, pointsEnabled: false, theme: undefined, storedStatus: "DRAFT", challenges: 0 };
const ENDED = { ...DRAFT, id: "m3", slug: "fim", name: "Encerrado", storedStatus: "ENDED" };
const DETAIL = { ...ROW, names: { "pt-BR": "Halloween 2026", en: "Halloween EN", es: "Halloween ES" }, descriptions: { "pt-BR": "Escuro", en: "Dark EN", es: "Oscuro" }, interpretations: [{ key: "dark" }],
  bonusRules: { wardrobe: 25, rediscovery: 15, remix: 10, newStyle: 5, publish: 3 }, sourceUrl: "https://fonte", sourceNote: "nota", sponsorName: "Marca", season: "AUTUMN", badgeCode: "B1",
  theme: { accent: "#F57C1F", background: "#111111", gradient: "linear-gradient(#000,#fff)", icon: "🎃", tone: "dark" },
  challenges: [{ id: "c1", code: "NO_BUY", name: "No-Buy", description: "Só o guarda-roupa", kind: "NO_BUY", points: 40, styleTags: ["edgy"], colorTags: [], occasionTags: [], params: { wardrobeOnly: true }, active: true }], settings: {}, rules: {} };

const open = async (name: RegExp | string) => fireEvent.click(await screen.findByRole("button", { name }));
const dialog = () => screen.getByRole("dialog");
const field = (id: string) => dialog().querySelector(`#${id}`) as HTMLInputElement;
const change = (id: string, value: string) => fireEvent.change(field(id), { target: { value } });
/** Abre a lista (Dropdown) do campo pelo id e escolhe a opção pelo texto. */
function pick(id: string, option: string) {
  fireEvent.click(field(id));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: option }));
}

describe("admin de Momentos", () => {
  it("lista com status, destaque, patrocínio e pontos; ações de ciclo de vida e o job manual avisam e recarregam", async () => {
    const { calls } = loggedAs(ADMIN, { "/api/taxonomy": TAXONOMY, "GET /api/admin/moments": [ROW, DRAFT, ENDED], "POST /api/admin/moments/m1/schedule": {}, "POST /api/admin/moments/jobs/tick": {},
      "POST /api/admin/moments/m2/archive": () => new Response(JSON.stringify({ status: 409, code: "CONFLITO", message: "Não dá para arquivar" }), { status: 409, headers: { "content-type": "application/json" } }) });
    renderApp(<AdminMomentsPage />);
    expect(await screen.findByText("Halloween 2026", { exact: false }, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText("FAI Points ×1.5")).toBeTruthy();
    expect(screen.getAllByText("sem pontos")).toHaveLength(2);
    expect(screen.getByText(/· BR ·/)).toBeTruthy();
    const items = screen.getAllByRole("listitem");
    fireEvent.click(within(items[0]).getByRole("button", { name: "Agendar" }));
    expect(await screen.findByText("Ação aplicada: Agendar")).toBeTruthy();
    fireEvent.click(within(items[1]).getByRole("button", { name: "Arquivar" }));
    expect(await screen.findByText("Não dá para arquivar")).toBeTruthy();
    await open("Rodar job agora");
    expect(await screen.findByText("Job de Momentos executado.")).toBeTruthy();
    expect(calls.filter((c) => c.method === "GET" && c.path === "/api/admin/moments").length).toBeGreaterThanOrEqual(3);
  });

  it("lista vazia e erro ao carregar", async () => {
    loggedAs(ADMIN, { "GET /api/admin/moments": [] });
    renderApp(<AdminMomentsPage />);
    expect(await screen.findByText("Nenhum Momento cadastrado.", undefined, { timeout: 4000 })).toBeTruthy();
    cleanup();
    loggedAs(ADMIN, { "GET /api/admin/moments": () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "falhou" }), { status: 500, headers: { "content-type": "application/json" } }) });
    renderApp(<AdminMomentsPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 4000 });
  });

  it("novo Momento: preenche todos os campos, desafios e etiquetas e manda o corpo completo", async () => {
    const { calls } = loggedAs(ADMIN, { "/api/taxonomy": TAXONOMY, "GET /api/admin/moments": [], "POST /api/admin/moments": {} });
    renderApp(<AdminMomentsPage />);
    await open("Novo Momento");
    const save = () => within(dialog()).getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);   // sem nome e datas
    change("am-name", "Denim Week"); change("am-name-en", "Denim EN"); change("am-name-es", "Denim ES"); change("am-slug", "denim-week");
    pick("am-type", "Evento de moda"); pick("am-nature", "comercial");
    change("am-start", "2026-11-09T00:00"); change("am-end", "2026-11-15T23:59"); change("am-tz", "America/Sao_Paulo");
    pick("am-scope", "País"); change("am-country", "br"); pick("am-season", "Verão");
    change("am-desc", "Semana do jeans"); change("am-desc-en", "Jeans week"); change("am-desc-es", "Semana vaquera");
    change("am-accent", "#2d55c9"); change("am-bg", "#ffffff"); change("am-grad", "linear-gradient(#000,#fff)"); change("am-icon", "👖"); pick("am-tone", "escuro");
    change("am-base", "30"); change("am-mult", "2"); change("am-badge", "MOMENT_DENIM");
    const bonus = dialog().querySelectorAll<HTMLInputElement>("#am-b1, #am-b2, #am-b3, #am-b4");
    bonus.forEach((b, i) => fireEvent.change(b, { target: { value: String(i + 1) } }));
    fireEvent.change(dialog().querySelector("#am-interps")!, { target: { value: '[{"key":"raw"}]' } });
    change("am-sponsor", "Marca X"); change("am-src", "https://fonte.tld"); change("am-srcn", "conferido");
    pick("am-vis", "Privado");
    // chaves: pontos (desliga), destaque e patrocinado (ligam)
    within(dialog()).getAllByRole("switch").forEach((s) => fireEvent.click(s));
    await waitFor(() => expect(within(dialog()).getAllByRole("button", { name: /Minimalista/ }).length).toBeGreaterThan(0));
    // etiquetas do Momento
    fireEvent.click(within(dialog()).getAllByRole("button", { name: /Ousado/ })[0]);
    fireEvent.click(within(dialog()).getAllByRole("button", { name: /Festa/ })[0]);
    fireEvent.click(within(dialog()).getAllByRole("button", { name: /Preto/ })[0]);
    // dois desafios: o primeiro é removido, o segundo é preenchido
    fireEvent.click(within(dialog()).getByRole("button", { name: "Adicionar desafio" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Adicionar desafio" }));
    fireEvent.click(within(dialog()).getAllByRole("button", { name: "Remover" })[0]);
    fireEvent.change(dialog().querySelector("#ch-code-0")!, { target: { value: "denim7" } });
    fireEvent.change(dialog().querySelector("#ch-name-0")!, { target: { value: "7 dias de jeans" } });
    fireEvent.change(dialog().querySelector("#ch-pts-0")!, { target: { value: "abc" } });
    fireEvent.change(dialog().querySelector("#ch-desc-0")!, { target: { value: "" } });
    fireEvent.change(dialog().querySelector("#ch-params-0")!, { target: { value: '{"looksRequired":7}' } });
    fireEvent.click(dialog().querySelector("#ch-kind-0")!);
    fireEvent.click(within(screen.getByRole("listbox")).getAllByRole("option")[1]);
    // etiquetas do desafio: as últimas listas do formulário
    fireEvent.click(within(dialog()).getAllByRole("button", { name: /Ousado/ }).at(-1)!);
    fireEvent.click(within(dialog()).getAllByRole("button", { name: /Laranja/ }).at(-1)!);
    fireEvent.click(save());
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/admin/moments")).toBe(true));
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/admin/moments")!.body as Record<string, any>;
    expect(body).toMatchObject({ slug: "denim-week", name: "Denim Week", names: { "pt-BR": "Denim Week", en: "Denim EN", es: "Denim ES" }, descriptions: { en: "Jeans week", es: "Semana vaquera" },
      startAt: "2026-11-09T00:00", endAt: "2026-11-15T23:59", scope: "COUNTRY", country: "BR", season: "SUMMER", basePoints: 30, pointsMultiplier: 2, badgeCode: "MOMENT_DENIM",
      bonusRules: { wardrobe: 1, rediscovery: 2, remix: 3, newStyle: 4 }, interpretations: [{ key: "raw" }], sponsorName: "Marca X", sourceUrl: "https://fonte.tld", sourceNote: "conferido",
      pointsEnabled: false, featured: true, sponsored: true, theme: { accent: "#2d55c9", background: "#ffffff", icon: "👖", tone: "dark", animation: "none" } });
    expect(body.styleTags).toEqual(["edgy"]);
    expect(body.occasionTags).toEqual(["party"]);
    expect(body.colorTags).toEqual(["black"]);
    expect(body.challenges).toHaveLength(1);
    expect(body.challenges[0]).toMatchObject({ code: "DENIM7", name: "7 dias de jeans", points: 0, description: null, params: { looksRequired: 7 } });
    expect(body.challenges[0].kind).toBe("COLOR");
    expect(body.challenges[0].styleTags).toEqual(["edgy"]);
    expect(body.challenges[0].colorTags).toEqual(["orange"]);
    expect(body.type).toBe("FASHION_EVENT");
    expect(body.nature).toBe("COMMERCIAL");
    expect(body.visibility).toBe("PRIVATE");
    expect(await screen.findByText("Momento salvo.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("validações: fuso inválido, interpretações e parâmetros com JSON inválido não chegam à API", async () => {
    const { calls } = loggedAs(ADMIN, { "GET /api/admin/moments": [] });
    renderApp(<AdminMomentsPage />);
    await open("Novo Momento");
    change("am-name", "X"); change("am-start", "2026-11-09T00:00"); change("am-end", "2026-11-10T00:00");
    change("am-tz", "Lua/Base");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Fuso inválido: Lua/Base. Use um nome IANA, ex.: America/Sao_Paulo.")).toBeTruthy();
    change("am-tz", "UTC");
    fireEvent.change(dialog().querySelector("#am-interps")!, { target: { value: "[{" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Interpretações: JSON inválido.")).toBeTruthy();
    fireEvent.change(dialog().querySelector("#am-interps")!, { target: { value: "" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Adicionar desafio" }));
    fireEvent.change(dialog().querySelector("#ch-params-0")!, { target: { value: "{x" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Parâmetros de desafio: JSON inválido.")).toBeTruthy();
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/admin/moments")).toBe(false);
    // cancelar fecha sem salvar
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("editar: carrega traduções, tema, bônus e desafios do detalhe e salva com PUT; erro do servidor aparece", async () => {
    const { calls } = loggedAs(ADMIN, { "/api/taxonomy": TAXONOMY, "GET /api/admin/moments": [ROW], "GET /api/admin/moments/m1": DETAIL,
      "PUT /api/admin/moments/m1": () => new Response(JSON.stringify({ status: 400, code: "INVALIDO", message: "Fonte obrigatória" }), { status: 400, headers: { "content-type": "application/json" } }) });
    renderApp(<AdminMomentsPage />);
    await open("Editar");
    expect(await screen.findByText("Editar Momento")).toBeTruthy();
    expect(field("am-name-en").value).toBe("Halloween EN");
    expect(field("am-desc-es").value).toBe("Oscuro");
    expect(field("am-grad").value).toBe("linear-gradient(#000,#fff)");
    expect((dialog().querySelector("#am-b4") as HTMLInputElement).value).toBe("5");
    expect((dialog().querySelector("#ch-code-0") as HTMLInputElement).value).toBe("NO_BUY");
    expect((dialog().querySelector("#ch-params-0") as HTMLInputElement).value).toBe('{"wardrobeOnly":true}');
    fireEvent.click(within(dialog()).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Fonte obrigatória")).toBeTruthy();
    const body = calls.find((c) => c.method === "PUT")!.body as Record<string, any>;
    expect(body.names).toEqual({ "pt-BR": "Halloween 2026", en: "Halloween EN", es: "Halloween ES" });
    expect(body.challenges[0]).toMatchObject({ code: "NO_BUY", points: 40, params: { wardrobeOnly: true }, description: "Só o guarda-roupa" });
    expect(body.theme.tone).toBe("dark");
    expect(dialog()).toBeTruthy();   // erro mantém o formulário aberto
  });

  it("editar: detalhe mínimo (sem traduções, tema nem bônus) usa os valores do card; falha ao abrir avisa", async () => {
    const minimal = { ...ROW, names: undefined, descriptions: undefined, description: undefined, theme: undefined, bonusRules: undefined, challenges: undefined, interpretations: undefined, country: null, season: null, sponsorName: null, badgeCode: null };
    loggedAs(ADMIN, { "GET /api/admin/moments": [ROW, { ...DRAFT }], "GET /api/admin/moments/m1": minimal });
    renderApp(<AdminMomentsPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Editar" }))[0]);
    await screen.findByText("Editar Momento");
    expect(field("am-name").value).toBe("Halloween 2026");
    expect(field("am-desc").value).toBe("");
    expect((dialog().querySelector("#am-interps") as HTMLTextAreaElement).value).toBe("[]");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

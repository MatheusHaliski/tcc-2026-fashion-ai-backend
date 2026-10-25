// @vitest-environment jsdom
/**
 * Configurações, aba por aba: conta (passarela, capa, país, dados sensíveis, troca de e-mail), aparência (tema, idioma,
 * moeda, acessibilidade, som, tamanhos, fundo e cor dos containers, Impersonation), privacidade (visibilidade e
 * consentimentos), dados (exportação, exclusão) e sessões. Cada mudança chama a API certa e avisa o resultado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, settle, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import SettingsPage from "./page";

const PREFS = { theme: "LIGHT", language: "PT_BR", density: "COMFORTABLE", fontScale: 100, soundEnabled: false, hapticsEnabled: true, sizeSystem: "BR", unitSystem: "CM" };
const ME_FULL = { ...ME, phone: "+5511999999999", birthDate: "1990-01-01", bio: "oi", runwayOptOut: false, emailVerified: false };
const fail = (status: number, message: string) => () => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const echoPrefs = (_u: URL, init: RequestInit) => ({ ...PREFS, ...JSON.parse(String(init.body)) });

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const tab = async (name: string) => fireEvent.click(await screen.findByRole("tab", { name }, { timeout: 4000 }));
/** Abre a lista do campo (Select/Dropdown) pelo id e escolhe a opção pelo texto. */
function pick(id: string, option: string | RegExp) {
  fireEvent.click(document.getElementById(id)!);
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: option }));
}
/** Os avisos vêm num modal, um por vez: "Entendi" fecha o atual e mostra o próximo da fila. */
const dismiss = async () => fireEvent.click(await screen.findByRole("button", { name: "Entendi" }));
/** Fecha todos os avisos da fila. */
async function dismissAll() { await settle(); while (screen.queryByRole("button", { name: "Entendi" })) { fireEvent.click(screen.getByRole("button", { name: "Entendi" })); await settle(); } }
const puts = (calls: { method: string; path: string; body?: unknown }[]) => calls.filter((c) => c.method === "PUT" && c.path === "/api/me/preferences").map((c) => c.body as Record<string, unknown>);

describe("configurações — conta", () => {
  it("passarela, capa, país, dados sensíveis e confirmação do novo e-mail", async () => {
    const { calls } = loggedAs(ME_FULL as typeof ME, { "GET /api/me/preferences": PREFS, "PATCH /api/me/profile": {}, "POST /api/me/cover": {}, "PATCH /api/me/sensitive": {}, "POST /api/me/email-change/confirm": {} });
    renderApp(<SettingsPage />);
    const runway = await screen.findByRole("switch", { name: "Desfilar meu Look do Dia na Passarela 3D do Explorar" }, { timeout: 4000 });
    // país em maiúsculas (antes das outras ações: cada refreshMe recarrega o campo a partir do `me`)
    fireEvent.change(document.getElementById("country")!, { target: { value: "pt" } });
    expect((document.getElementById("country") as HTMLInputElement).value).toBe("PT");
    fireEvent.click(within(document.getElementById("country")!.parentElement!).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH" && (c.body as { country?: string }).country === "PT")).toBe(true));
    await dismiss();
    fireEvent.click(runway);
    expect(await screen.findByText("Você saiu da Passarela 3D")).toBeTruthy();
    expect(calls.filter((c) => c.method === "PATCH" && c.path === "/api/me/profile").at(-1)?.body).toEqual({ runwayOptOut: true });
    // capa: sem arquivo não faz nada; com arquivo envia
    const cover = screen.getByText("Imagem de capa").querySelector("input")!;
    fireEvent.change(cover, { target: { files: [] } });
    fireEvent.change(cover, { target: { files: [new File(["x"], "capa.png", { type: "image/png" })] } });
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/me/cover")).toBe(true));
    await settle();
    // dados sensíveis: e-mail novo, telefone e nascimento limpos viram null
    expect(screen.getByText("Não confirmado", { exact: false })).toBeTruthy();
    fireEvent.change(document.getElementById("email")!, { target: { value: "novo@x.com" } });
    fireEvent.change(document.getElementById("phone")!, { target: { value: "" } });
    fireEvent.change(document.getElementById("birthDate")!, { target: { value: "" } });
    fireEvent.change(document.getElementById("curpwd")!, { target: { value: "senha" } });
    fireEvent.click(screen.getByRole("switch", { name: "Autenticação em duas etapas (código por e-mail)" }));
    const saves = screen.getAllByRole("button", { name: "Salvar" });
    fireEvent.click(saves[saves.length - 1]);
    await waitFor(() => expect(calls.some((c) => c.path === "/api/me/sensitive")).toBe(true));
    expect(calls.find((c) => c.path === "/api/me/sensitive")!.body).toEqual({ password: "senha", email: "novo@x.com", phone: null, birthDate: null, twoFactorEnabled: true });
    // e-mail diferente mostra o campo do código (o refreshMe depois de salvar volta o campo ao e-mail atual do `me`,
    // então é preciso digitar o novo e-mail de novo para o campo do código reaparecer)
    await dismissAll();
    expect(screen.queryByPlaceholderText("código enviado ao novo e-mail")).toBeNull();
    fireEvent.change(document.getElementById("email")!, { target: { value: "novo@x.com" } });
    fireEvent.change(screen.getByPlaceholderText("código enviado ao novo e-mail"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/me/email-change/confirm")).toBe(true));
    expect(calls.find((c) => c.path === "/api/me/email-change/confirm")!.body).toEqual({ code: "123456" });
  });

  it("voltar à passarela e e-mail igual (manda null); erro da API aparece", async () => {
    const { calls } = loggedAs({ ...ME_FULL, runwayOptOut: true } as typeof ME, { "GET /api/me/preferences": PREFS, "PATCH /api/me/profile": {}, "PATCH /api/me/sensitive": fail(400, "Senha incorreta") });
    renderApp(<SettingsPage />);
    fireEvent.click(await screen.findByRole("switch", { name: /Desfilar meu Look/ }, { timeout: 4000 }));
    expect(await screen.findByText("Seu Look do Dia volta à Passarela 3D")).toBeTruthy();
    const saves = screen.getAllByRole("button", { name: "Salvar" });
    fireEvent.click(saves[saves.length - 1]);
    await waitFor(() => expect(calls.some((c) => c.path === "/api/me/sensitive")).toBe(true));
    await dismiss();
    expect(await screen.findByText("Senha incorreta")).toBeTruthy();
    expect((calls.find((c) => c.path === "/api/me/sensitive")!.body as { email: unknown }).email).toBeNull();
    expect(screen.queryByPlaceholderText("código enviado ao novo e-mail")).toBeNull();
  });
});

describe("configurações — aparência", () => {
  it("tema, contraste, animações, som, vibração, tamanhos e unidades vão para as preferências", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/me/preferences": PREFS, "PUT /api/me/preferences": echoPrefs });
    renderApp(<SettingsPage />);
    await tab("Aparência");
    pick("theme", "Escuro");
    fireEvent.click(screen.getByRole("switch", { name: "Alto contraste" }));
    fireEvent.click(screen.getByRole("switch", { name: "Reduzir animações" }));
    fireEvent.click(screen.getByRole("switch", { name: "Sons do quarto" }));
    fireEvent.click(screen.getByRole("switch", { name: "Vibração leve no celular" }));
    pick("sizeSystem", "US");
    pick("unitSystem", "IN");
    await waitFor(() => expect(puts(calls).length).toBeGreaterThanOrEqual(7));
    const all = Object.assign({}, ...puts(calls));
    expect(all).toMatchObject({ theme: "DARK", highContrast: true, reduceMotion: true, soundEnabled: true, hapticsEnabled: false, sizeSystem: "US", unitSystem: "IN" });
    expect(screen.getAllByText("Preferências salvas").length).toBeGreaterThan(0);
    expect(document.documentElement.dataset.theme).toBeDefined();
  });

  it("idioma e moeda mudam na hora (moeda automática volta a seguir o idioma)", async () => {
    loggedAs(undefined, { "GET /api/me/preferences": PREFS, "PUT /api/me/preferences": echoPrefs });
    renderApp(<SettingsPage />);
    await tab("Aparência");
    pick("currency", /\(USD\)/);
    expect(document.getElementById("currency")!.textContent).toContain("USD");
    pick("currency", /^Automática|automática|Auto/i);
    pick("language", "English");
    await waitFor(() => expect(screen.getByRole("tab", { name: "Appearance" })).toBeTruthy());
  });

  it("fundo do app, cor dos containers (preset, personalizada e padrão branco)", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/me/preferences": PREFS, "PUT /api/me/preferences": echoPrefs });
    renderApp(<SettingsPage />);
    await tab("Aparência");
    const bg = screen.getAllByRole("button", { pressed: false }).find((b) => b.querySelector("img"))!;
    fireEvent.click(bg);
    expect(bg.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Liso, sem padrão/ }));
    fireEvent.click(screen.getByRole("button", { name: /Marfim/ }));
    expect(screen.getByRole("button", { name: /Marfim/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Branco (padrão)" }));
    const color = screen.getByLabelText("cor personalizada dos containers") as HTMLInputElement;
    fireEvent.change(color, { target: { value: "#abcdef" } });
    fireEvent.blur(color, { target: { value: "#abcdef" } });
    fireEvent.click(screen.getByRole("button", { name: "Padrão (branco)" }));
    await waitFor(() => expect(puts(calls).length).toBeGreaterThanOrEqual(6));
    const bodies = puts(calls);
    expect(bodies.some((b) => typeof b.chromeBackgroundId === "string")).toBe(true);
    expect(bodies.some((b) => b.chromeBackgroundId === null)).toBe(true);
    expect(bodies.some((b) => b.contentContainerColor === "#FBF7EF")).toBe(true);
    expect(bodies.some((b) => b.contentContainerColor === "#ABCDEF")).toBe(true);
    expect(bodies.filter((b) => b.contentContainerColor === "").length).toBeGreaterThanOrEqual(2);
  });

  it("preferência salva no servidor é aplicada ao abrir (tema, idioma e moeda); erro ao salvar avisa", async () => {
    loggedAs(undefined, { "GET /api/me/preferences": { ...PREFS, theme: "DARK", language: "ES", currency: "EUR", auraHype: true, auraImpersonation: true, highContrast: true, chromeBackgroundId: "rf23_bg_selos_fai_claro", contentContainerColor: "#FBF7EF" },
      "PUT /api/me/preferences": fail(500, "Falha ao salvar") });
    renderApp(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Apariencia" })).toBeTruthy(), { timeout: 4000 });
    fireEvent.click(screen.getByRole("tab", { name: "Apariencia" }));
    expect(document.getElementById("currency")!.textContent).toContain("EUR");
    fireEvent.click(screen.getAllByRole("switch")[2]);
    expect(await screen.findByText("Falha ao salvar")).toBeTruthy();
  });

  it("Impersonation liberada: ligar salva; backend sem o campo avisa indisponível; erro de rede no AURA Hype fica local", async () => {
    let put = 0;
    loggedAs(undefined, { "GET /api/me/preferences": PREFS,
      "GET /api/me/aura-permissions": { currentTier: "LOFT", auras: { AURA_IMPERSONATION: { allowed: true, requiredTier: "LOFT" } } },
      "PUT /api/me/preferences": (u: URL, i: RequestInit) => { put++; if (put === 1) return { ...PREFS }; if (put === 2) return fail(500, "x")(); return echoPrefs(u, i); } });
    renderApp(<SettingsPage />);
    await tab("Aparência");
    expect(await screen.findAllByText("Disponível no seu nível atual: LOFT.")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "AURA Impersonation" }));
    // backend sem o campo: o código lança um Error comum, e o aviso cai na mensagem genérica
    expect(await screen.findByText("Algo deu errado. Tente de novo.")).toBeTruthy();
    await dismiss();
    fireEvent.click(screen.getByRole("switch", { name: "AURA Hype" }));
    expect(await screen.findByText(/Preferência aplicada neste navegador/)).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "AURA Impersonation" }));
    await waitFor(() => expect(screen.getByRole("switch", { name: "AURA Impersonation" }).getAttribute("aria-checked")).toBe("true"));
  });

  it("sem dados de Impersonation no nível: mostra indisponível", async () => {
    loggedAs(undefined, { "GET /api/me/preferences": PREFS, "GET /api/me/aura-permissions": { currentTier: "STUDIO", auras: {} } });
    renderApp(<SettingsPage />);
    await tab("Aparência");
    expect(await screen.findAllByText(/Não foi possível verificar ou salvar o acesso/)).toBeTruthy();
  });
});

describe("configurações — privacidade", () => {
  it("visibilidade, tópicos do Hype, consentimento ligado e erro ao mudar consentimento", async () => {
    let n = 0;
    const consent = [{ purpose: "AI_RECOMMENDATION", granted: false }, { purpose: "MARKETING_EMAIL", label: "E-mails", granted: true, description: "Novidades" }];
    const { calls } = loggedAs({ ...ME, user: { ...ME.user, privateAccount: true } }, { "GET /api/me/preferences": PREFS, "GET /api/me/consents": consent, "PUT /api/me/privacy": {},
      "PUT /api/me/consents/AI_RECOMMENDATION": () => (++n === 1 ? [{ ...consent[0], granted: true }, consent[1]] : fail(500, "Consentimento falhou")()) });
    renderApp(<SettingsPage />);
    await tab("Privacidade");
    // sem rótulo, o nome vem do propósito
    const sw = await screen.findByRole("switch", { name: "AI RECOMMENDATION" });
    fireEvent.click(sw);
    await waitFor(() => expect(screen.getByRole("switch", { name: "AI RECOMMENDATION" }).getAttribute("aria-checked")).toBe("true"));
    fireEvent.click(screen.getByRole("switch", { name: "AI RECOMMENDATION" }));
    expect(await screen.findByText("Consentimento falhou")).toBeTruthy();
    // informação do consentimento sem descrição
    fireEvent.click(screen.getByRole("button", { name: "Informações sobre AI RECOMMENDATION" }));
    const dlg = await screen.findByRole("dialog", { name: "AI RECOMMENDATION" });
    fireEvent.click(within(dlg).getAllByRole("button", { name: "Fechar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // tópicos do Hype: o de notificações tem link que fecha a explicação
    const topics = screen.getAllByRole("button", { name: /^Informações sobre/ });
    for (const b of topics.slice(0, 4)) { fireEvent.click(b); await screen.findByRole("dialog"); fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); }
    const notif = topics.find((b) => /notifica/i.test(b.getAttribute("aria-label") ?? ""));
    if (notif) {
      fireEvent.click(notif);
      const link = within(await screen.findByRole("dialog")).getByRole("link");
      expect(link.getAttribute("href")).toBe("/notifications");
      fireEvent.click(link);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
    // visibilidade: perfil privado escolhe Público
    fireEvent.click(screen.getByRole("button", { name: /^visibilidade/ }));
    fireEvent.click(within(screen.getByRole("listbox")).getAllByRole("option")[0]);
    await waitFor(() => expect(calls.find((c) => c.path === "/api/me/privacy")?.body).toEqual({ visibility: "PUBLIC" }));
  });

  it("erro ao carregar consentimentos", async () => {
    loggedAs(undefined, { "GET /api/me/preferences": PREFS, "GET /api/me/consents": fail(500, "x") });
    renderApp(<SettingsPage />);
    await tab("Privacidade");
    expect(await screen.findByText("Não foi possível carregar seus consentimentos. Tente novamente mais tarde.")).toBeTruthy();
  });
});

describe("configurações — dados e sessões", () => {
  it("exporta, baixa o pacote pronto e agenda a exclusão com senha", async () => {
    const open = vi.fn(); vi.stubGlobal("open", open);
    URL.createObjectURL = vi.fn(() => "blob:pacote");
    const { calls } = loggedAs(undefined, { "GET /api/me/preferences": PREFS, "POST /api/me/exports": {}, "POST /api/me/deletion": {},
      "GET /api/me/exports": [{ id: "e1", status: "READY", requestedAt: "2026-10-01T10:00:00Z" }, { id: "e2", status: "PENDING" }],
      "GET /api/me/exports/e1/file": () => new Response("zip", { status: 200, headers: { "content-type": "application/zip" } }) });
    renderApp(<SettingsPage />);
    await tab("Seus dados (LGPD)");
    expect(await screen.findByText("READY · 2026-10-01")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Exportar meus dados" }).at(-1)!);
    expect(await screen.findByText("Exportação solicitada.")).toBeTruthy();
    await dismissAll();
    fireEvent.click(screen.getByRole("link", { name: "Baixar" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("blob:pacote"));
    // exclusão: sem senha não confirma; cancelar fecha; com senha agenda
    fireEvent.click(screen.getAllByRole("button", { name: "Excluir conta" }).at(-1)!);
    let dlg = await screen.findByRole("dialog", { name: "Excluir conta" });
    expect((within(dlg).getByRole("button", { name: "Confirmar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getAllByRole("button", { name: "Excluir conta" }).at(-1)!);
    dlg = await screen.findByRole("dialog", { name: "Excluir conta" });
    fireEvent.change(within(dlg).getByLabelText("Senha"), { target: { value: "minha-senha" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Exclusão agendada.")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/me/deletion")!.body).toEqual({ password: "minha-senha" });
  });

  it("exclusão recusada mostra o erro; exclusão já agendada pode ser cancelada", async () => {
    loggedAs(undefined, { "GET /api/me/preferences": PREFS, "GET /api/me/exports": [], "POST /api/me/deletion": fail(400, "Senha errada") });
    renderApp(<SettingsPage />);
    await tab("Seus dados (LGPD)");
    fireEvent.click((await screen.findAllByRole("button", { name: "Excluir conta" })).at(-1)!);
    const dlg = await screen.findByRole("dialog", { name: "Excluir conta" });
    fireEvent.change(within(dlg).getByLabelText("Senha"), { target: { value: "x" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Senha errada")).toBeTruthy();
    cleanup();
    const { calls } = loggedAs({ ...ME, deletionScheduledFor: "2026-11-20T00:00:00Z" } as typeof ME, { "GET /api/me/preferences": PREFS, "DELETE /api/me/deletion": {} });
    renderApp(<SettingsPage />);
    await tab("Seus dados (LGPD)");
    expect(screen.getByText(/2026-11-20/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar exclusão" }));
    expect(await screen.findByText("Exclusão cancelada.")).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/me/deletion")).toBe(true);
  });

  it("sessões: encerra outra sessão; falha ao sair de todas avisa", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/me/preferences": PREFS,
      "GET /api/auth/sessions": [{ sessionId: "cur", current: true, createdAt: "2026-10-01T10:00:00Z" }, { sessionId: "s2", device: "Celular", ip: "1.2.3.4", lastUsedAt: "2026-10-20T08:30:00Z" }],
      "DELETE /api/auth/sessions/s2": {}, "DELETE /api/auth/sessions": fail(500, "Não deu para sair") });
    renderApp(<SettingsPage />);
    await tab("Sessões");
    expect(await screen.findByText(/Celular · 1.2.3.4 · 2026-10-20T08:30/)).toBeTruthy();
    expect(screen.getByText("· esta sessão")).toBeTruthy();
    expect(screen.getByText("· esta sessão").parentElement!.textContent).toBe("dispositivo ·  · 2026-10-01T10:00· esta sessão");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    expect(await screen.findByText("Sessão encerrada.")).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/auth/sessions/s2")).toBe(true);
    await dismiss();
    fireEvent.click(screen.getByRole("button", { name: "Sair de todos os dispositivos" }));
    expect(await screen.findByText("Não deu para sair")).toBeTruthy();
  });
});

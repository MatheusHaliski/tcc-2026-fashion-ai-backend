// @vitest-environment jsdom
/**
 * "Hoje eu vesti isso para…" (Look do Dia Vivido F1): sugestões vindas do servidor, escolha de propósito (chip ou lista),
 * para quem, nota, aviso de dia de cuidado/só eu, e o que vai no registro; sem sugestões ainda dá para registrar.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { DailyLookContextPicker } from "./context-picker";

afterEach(cleanup);

const SUGGEST = {
  date: "2026-11-23", prompt: "Hoje eu vesti isso para…",
  marks: [{ kind: "WEEKDAY", code: "MONDAY", label: "Segunda-feira", weekend: false }, { kind: "SEASON", code: "SPRING", label: "Primavera" }, { kind: "WEATHER", code: "INVERNO_PESADO", label: "9 °C · chuva" }, { kind: "MOMENT", code: "denim-week", label: "Denim Week", icon: "👖", type: "COMMUNITY" }],
  suggestedPurposes: [{ code: "ENTREVISTA", label: "Entrevista", sensitive: false }, { code: "TRABALHO_PRESENCIAL", label: "Trabalho presencial", sensitive: false }, { code: "FESTA", label: "Festa", sensitive: false }],
  purposes: [{ code: "ENTREVISTA", label: "Entrevista", sensitive: false }, { code: "TRABALHO_PRESENCIAL", label: "Trabalho presencial", sensitive: false }, { code: "FESTA", label: "Festa", sensitive: false }, { code: "CUIDADO", label: "Dia de cuidado", sensitive: true }, { code: "OUTRO", label: "Outro", sensitive: false }],
  audiences: [{ code: "SO_EU", label: "Só eu", privateOnly: true }, { code: "TRABALHO", label: "Trabalho", privateOnly: false }],
  weekPlanDay: { id: "w1", eventLabel: "Entrevista na agência", occasion: "work" },
};

describe("DailyLookContextPicker", () => {
  it("mostra as sugestões e manda propósito, para quem e nota no registro", async () => {
    loggedAs(undefined, { "GET /api/me/daily-looks/suggest-context": SUGGEST });
    const onConfirm = vi.fn();
    renderApp(<DailyLookContextPicker open onClose={() => {}} onConfirm={onConfirm} />);
    expect(await screen.findByText("No seu plano da semana: Entrevista na agência")).toBeTruthy();
    const chips = screen.getByRole("radiogroup", { name: "Sugestões para hoje" });
    expect(within(chips).getAllByRole("radio").map((c) => c.textContent)).toEqual(["Entrevista", "Trabalho presencial", "Festa"]);
    fireEvent.click(within(chips).getByRole("radio", { name: "Entrevista" }));
    expect(within(chips).getByRole("radio", { name: "Entrevista" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Quem vai me ver" })).getByRole("radio", { name: "Trabalho" }));
    fireEvent.change(screen.getByLabelText("Conte em poucas palavras (opcional)"), { target: { value: "  Vaga de designer  " } });
    expect(screen.getByText("120 caracteres restantes")).toBeTruthy();
    const marks = screen.getByRole("list", { name: "Marcas do dia" });
    expect(within(marks).getAllByRole("listitem").map((l) => l.textContent)).toEqual(["📅Segunda-feira", "🍃Primavera", "🌤9 °C · chuva", "👖Denim Week"]);
    fireEvent.click(screen.getByRole("button", { name: "Registrar Look do Dia" }));
    expect(onConfirm).toHaveBeenCalledWith({ purpose: "ENTREVISTA", purposeNote: "Vaga de designer", audience: "TRABALHO" });
  });

  it("dia de cuidado e 'só eu' avisam; clicar o mesmo chip de novo desmarca; 'sem contexto' manda vazio", async () => {
    loggedAs(undefined, { "GET /api/me/daily-looks/suggest-context": SUGGEST });
    const onConfirm = vi.fn();
    renderApp(<DailyLookContextPicker open onClose={() => {}} onConfirm={onConfirm} />);
    const chips = within(await screen.findByRole("radiogroup", { name: "Sugestões para hoje" }));
    fireEvent.click(chips.getByRole("radio", { name: "Festa" }));
    fireEvent.click(chips.getByRole("radio", { name: "Festa" }));
    expect(chips.getByRole("radio", { name: "Festa" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByText(/Dia de cuidado fica só com você/)).toBeNull();
    // a lista "Outro propósito" só tem os que não são chips
    const more = screen.getByRole("button", { name: /Outro propósito|Nenhum/ });
    fireEvent.click(more);
    fireEvent.click(await screen.findByRole("option", { name: "Dia de cuidado" }));
    expect(await screen.findByText(/Dia de cuidado fica só com você/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Quem vai me ver" })).getByRole("radio", { name: "Só eu" }));
    expect(screen.getByText("“Só eu” nunca sai do seu perfil.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Registrar sem contexto" }));
    expect(onConfirm).toHaveBeenCalledWith({});
  });

  it("sem sugestões (erro) ainda dá para registrar", async () => {
    loggedAs(undefined, {});
    const onConfirm = vi.fn();
    renderApp(<DailyLookContextPicker open onClose={() => {}} onConfirm={onConfirm} />);
    expect(await screen.findByText(/Não deu para carregar as sugestões/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Registrar Look do Dia" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ purpose: null, purposeNote: null, audience: null }));
  });

  it("'Usar minha posição' pede a posição ao navegador, recarrega as sugestões com o clima e manda as coordenadas no registro", async () => {
    const api = loggedAs(undefined, { "GET /api/me/daily-looks/suggest-context": (url: URL) => (url.searchParams.get("latitude") ? SUGGEST : { ...SUGGEST, marks: SUGGEST.marks.filter((m) => m.kind !== "WEATHER") }) });
    const getCurrentPosition = vi.fn((ok: (p: { coords: { latitude: number; longitude: number } }) => void) => ok({ coords: { latitude: -23.55, longitude: -46.63 } }));
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
    const onConfirm = vi.fn();
    renderApp(<DailyLookContextPicker open onClose={() => {}} onConfirm={onConfirm} />);
    const marks = await screen.findByRole("list", { name: "Marcas do dia" });
    expect(marks.textContent).not.toContain("9 °C");
    fireEvent.click(screen.getByRole("button", { name: "Usar minha posição para o clima" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("list", { name: "Marcas do dia" }).textContent).toContain("9 °C · chuva"));
    expect(api.calls.some((c) => c.path === "/api/me/daily-looks/suggest-context?latitude=-23.55&longitude=-46.63")).toBe(true);
    expect(screen.queryByRole("button", { name: "Usar minha posição para o clima" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Registrar Look do Dia" }));
    expect(onConfirm).toHaveBeenCalledWith({ purpose: null, purposeNote: null, audience: null, latitude: -23.55, longitude: -46.63 });
  });

  it("posição negada: avisa e o clima fica de fora, sem travar o registro", async () => {
    loggedAs(undefined, { "GET /api/me/daily-looks/suggest-context": { ...SUGGEST, marks: SUGGEST.marks.filter((m) => m.kind !== "WEATHER") } });
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: (_ok: unknown, err: (e: { code: number }) => void) => err({ code: 1 }) } });
    const onConfirm = vi.fn();
    renderApp(<DailyLookContextPicker open onClose={() => {}} onConfirm={onConfirm} />);
    fireEvent.click(await screen.findByRole("button", { name: "Usar minha posição para o clima" }));
    expect(await screen.findByText("Sem permissão de posição; o clima fica de fora.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Registrar Look do Dia" }));
    expect(onConfirm).toHaveBeenCalledWith({ purpose: null, purposeNote: null, audience: null });
  });
});

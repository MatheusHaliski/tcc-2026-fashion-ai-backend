// @vitest-environment jsdom
/**
 * Extras da aba Look do Dia (F2/F3): "quem mais está vivendo isso hoje" (≥ 5 pessoas; escondido em dia de cuidado),
 * convite da véspera e "mesma data, outro ano". Sem dados, nada aparece.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, loggedAs, renderApp, screen, within } from "@/test-utils/render";
import { LivingToday, OnThisDay, TomorrowInvite } from "./daily-tab-extras";

afterEach(() => { cleanup(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const owner = (u: string) => ({ id: u, username: u, displayName: u });
const look = (id: string, worked = false) => ({ schemeId: id, title: "Look " + id, worked, owner: owner("u" + id) });

describe("LivingToday", () => {
  it("com cinco pessoas mostra o trilho com a mesma missão; com poucas, só o aviso", async () => {
    loggedAs(undefined, { "GET /api/me/daily-looks/living-today": { date: "2026-11-23", purpose: "ENTREVISTA", purposeLabel: "Entrevista", hidden: false, count: 5, enough: true, minGroup: 5, looks: [look("a", true), look("b"), look("c"), look("d"), look("e")] } });
    renderApp(<LivingToday />);
    expect(await screen.findByText("5 pessoas também se vestiram para entrevista hoje.")).toBeTruthy();
    const rail = screen.getByRole("list", { name: "Looks com a mesma missão" });
    expect(within(rail).getAllByRole("listitem")).toHaveLength(5);
    expect(within(rail).getAllByRole("link")[0].getAttribute("href")).toBe("/schemes/a");
    expect(rail.textContent).toContain("@ua · deu certo");
    cleanup();
    loggedAs(undefined, { "GET /api/me/daily-looks/living-today": { date: "2026-11-23", purpose: "FESTA", purposeLabel: "Festa", hidden: false, count: 2, enough: false, minGroup: 5, looks: [] } });
    renderApp(<LivingToday />);
    expect(await screen.findByText(/Ainda poucas pessoas se vestiram para festa hoje; o grupo aparece a partir de 5\./)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Looks com a mesma missão" })).toBeNull();
  });

  it("dia de cuidado ou sem propósito: nada", async () => {
    loggedAs(undefined, { "GET /api/me/daily-looks/living-today": { date: "2026-11-23", purpose: "CUIDADO", purposeLabel: "Dia de cuidado", hidden: true, count: 0, enough: false, looks: [] } });
    const { container } = renderApp(<LivingToday />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toBe("");
  });
});

describe("TomorrowInvite e OnThisDay", () => {
  it("véspera: mensagem, Momento de amanhã e o link para preparar; com look já marcado, some", async () => {
    loggedAs(undefined, { "GET /api/me/daily-looks/tomorrow": { date: "2026-11-24", event: "Apresentação para a diretoria", moments: [{ kind: "MOMENT", code: "denim-week", label: "Denim Week", icon: "👖" }], hasLook: false, message: "Amanhã: Apresentação para a diretoria. Quer preparar o Look do Dia agora?", prepareHref: "/autopilot" } });
    renderApp(<TomorrowInvite />);
    expect(await screen.findByText("Amanhã: Apresentação para a diretoria. Quer preparar o Look do Dia agora?")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Preparar o look agora" }).getAttribute("href")).toBe("/autopilot");
    expect(screen.getByRole("list", { name: "Marcas do dia" }).textContent).toContain("Denim Week");
    cleanup();
    loggedAs(undefined, { "GET /api/me/daily-looks/tomorrow": { date: "2026-11-24", event: "x", moments: [], hasLook: true, message: "m", prepareHref: "/autopilot" } });
    const { container } = renderApp(<TomorrowInvite />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toBe("");
  });

  it("mesma data, outro ano: anos atrás e o contexto da época", async () => {
    loggedAs(undefined, { "GET /api/me/daily-looks/on-this-day": { date: "2026-11-23", items: [
      { id: "d1", date: "2025-11-23", source: "MANUAL", schemeId: "s1", title: "Look de entrevista", yearsAgo: 1, context: { purpose: "ENTREVISTA", purposeLabel: "Entrevista", sensitive: false, privateOnly: false, marks: [] } },
      { id: "d3", date: "2023-11-23", source: "MANUAL", schemeId: "s3", title: "Look antigo", yearsAgo: 3, context: null },
    ] } });
    renderApp(<OnThisDay />);
    expect(await screen.findByText("Mesma data, outro ano")).toBeTruthy();
    expect(screen.getByText("há 1 ano")).toBeTruthy();
    expect(screen.getByText("há 3 anos")).toBeTruthy();
    expect(screen.getByText("Entrevista")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Look antigo" }).getAttribute("href")).toBe("/schemes/s3");
  });
});

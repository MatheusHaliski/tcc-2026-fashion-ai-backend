// @vitest-environment jsdom
/**
 * Aba Look do Dia (extraída de lookbook-tabs.tsx): o Contexto do Dia de hoje aparece sob o card e o de cada dia do histórico
 * na linha; sem contexto, nada é inventado. O painel e o histórico seguem como antes (lookbook-hype.test.tsx).
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, loggedAs, renderApp, screen, settle, within } from "@/test-utils/render";
import { SCHEME } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { DailyTab } from "./daily-tab";

beforeEach(() => { __resetHypeStore(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const CTX = { purpose: "ENTREVISTA", purposeLabel: "Entrevista", purposeNote: "Vaga de designer", audience: "TRABALHO", audienceLabel: "Trabalho", sensitive: false, privateOnly: false,
  marks: [{ kind: "WEEKDAY", code: "MONDAY", label: "Segunda-feira", weekend: false }, { kind: "WEATHER", code: "INVERNO_PESADO", label: "9 °C · chuva" }, { kind: "MOMENT", code: "denim-week", label: "Denim Week", icon: "👖" }] };
const TAB = {
  panelVersion: "SPOTLIGHT_CLASSICO", panelVersions: [{ code: "SPOTLIGHT_CLASSICO", name: "Spotlight" }], scheme: SCHEME,
  today: { date: "2026-11-23", feedback: "ADOREI", source: "MANUAL", context: CTX }, panel: { v2: null, tip: null },
  history: [{ date: "2026-11-23", schemeId: "s1", title: "Look de entrevista", feedback: "ADOREI", context: CTX }, { date: "2026-11-22", schemeId: "s2", title: "Look de domingo", feedback: null, context: null }],
};
const BASE = { "GET /api/insights": { context: "HISTORY", items: [] }, "GET /api/hype/summaries": { type: "SCHEME", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };

it("mostra o Contexto do Dia de hoje sob o card e o de cada linha do histórico", async () => {
  loggedAs(undefined, { ...BASE, "GET /api/me/daily-look-tab": TAB });
  renderApp(<DailyTab />);
  await settle();
  const today = await screen.findByRole("region", { name: "Contexto do dia" });
  expect(today.textContent).toContain("Entrevista");
  expect(today.textContent).toContain("Vaga de designer");
  expect(today.textContent).toContain("para Trabalho");
  expect(within(today).getByRole("list", { name: "Marcas do dia" }).textContent).toContain("9 °C · chuva");
  const rows = Array.from((screen.getByRole("heading", { name: "Histórico" }).parentElement as HTMLElement).querySelector("ul.fai-list")!.children) as HTMLElement[];
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain("Entrevista");
  expect(rows[0].textContent).toContain("Denim Week");
  expect(rows[0].textContent).not.toContain("Vaga de designer");   // compacto: sem a nota
  expect(rows[1].textContent).not.toContain("Marcas do dia");
});

it("sem contexto registrado, a aba não mostra o bloco do contexto", async () => {
  loggedAs(undefined, { ...BASE, "GET /api/me/daily-look-tab": { ...TAB, today: { date: "2026-11-23", feedback: "ADOREI", source: "AUTOPILOTO", context: null }, history: [] } });
  renderApp(<DailyTab />);
  await settle();
  expect(await screen.findByRole("heading", { name: "Histórico" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Contexto do dia" })).toBeNull();
});

// @vitest-environment jsdom
/**
 * Exercício 06 — Lookbook › Looks: o filtro de estação usa a estação que o GET devolveu em cada look (não a estação do
 * calendário); o padrão é "Todas"; look legado sem estação entra em "Sem estação" e o card mostra "Não informada".
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, within } from "@/test-utils/render";
import { SCHEME } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import type { SchemeView } from "@/lib/api/types";
import { LooksTab, matchesSeason } from "./lookbook-looks-tab";

beforeEach(() => { __resetHypeStore(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-07-15T12:00:00Z")); });  // julho: inverno no Brasil
afterEach(() => { vi.useRealTimers(); cleanup(); vi.unstubAllGlobals(); });

const look = (id: string, title: string, season: string | null): SchemeView => ({ ...SCHEME, id, title, season } as SchemeView);
const LOOKS = [look("a", "Casaco de lã", "WINTER"), look("b", "Praia de sol", "SUMMER"), look("c", "Look antigo", null)];
const routes = { "GET /api/profiles/u1": { schemes: LOOKS }, "GET /api/hype/summaries": { type: "SCHEME", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };

it("filtra pela estação gravada no look; padrão Todas mesmo em julho; Sem estação pega o legado", async () => {
  mockApi(routes);
  renderApp(<LooksTab ownerId="u1" self={false} />);
  const group = within(await screen.findByRole("radiogroup", { name: "Estação" }));
  expect(group.getByRole("radio", { name: /^Todas/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("Casaco de lã")).toBeTruthy();
  expect(screen.getByText("Praia de sol")).toBeTruthy();
  fireEvent.click(group.getByRole("radio", { name: /^Verão/ }));
  expect(screen.getByText("Praia de sol")).toBeTruthy();
  expect(screen.queryByText("Casaco de lã")).toBeNull();
  fireEvent.click(group.getByRole("radio", { name: /^Sem estação/ }));
  expect(screen.getByText("Look antigo")).toBeTruthy();
  expect(screen.queryByText("Praia de sol")).toBeNull();
  fireEvent.click(group.getByRole("radio", { name: /^Primavera/ }));
  expect(screen.getByText("Nenhum look de Primavera por aqui.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ver todas as estações" }));
  expect(screen.getByText("Look antigo")).toBeTruthy();
});

it("o card do look legado mostra Estação: Não informada (vazio legível)", async () => {
  mockApi(routes);
  renderApp(<LooksTab ownerId="u1" self={false} />);
  await screen.findByText("Look antigo");
  expect(screen.getAllByText("Não informada").length).toBeGreaterThan(0);
});

it("matchesSeason: código exato, Todas e Sem estação", () => {
  expect(matchesSeason({ season: "WINTER" }, "WINTER")).toBe(true);
  expect(matchesSeason({ season: "WINTER" }, "SUMMER")).toBe(false);
  expect(matchesSeason({ season: null }, "NONE")).toBe(true);
  expect(matchesSeason({ season: "AUTUMN" }, "")).toBe(true);
});

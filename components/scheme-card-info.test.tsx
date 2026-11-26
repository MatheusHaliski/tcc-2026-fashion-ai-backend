// @vitest-environment jsdom
import { ExpandedPieceCard } from "@/components/expanded-card/expanded-piece-card";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, within } from "@/test-utils/render";
import { PIECE, SCHEME } from "@/test-utils/fixtures";
import { SchemeCard } from "./scheme-card";
import { PieceCard } from "./piece-card";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("mostra as peças do look ampliado dentro de Info e alterna para Hype", () => {
  mockApi({});
  renderApp(<SchemeCard scheme={SCHEME} href="#" expanded />);
  expect(within(screen.getByRole("tabpanel")).getByText(PIECE.name)).toBeTruthy();
  expect(screen.getByRole("tabpanel").querySelector(".card-fashion-meta")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: /^Hype/ }));
  expect(screen.getByRole("tabpanel").querySelector(".fashion-hype-matrix")).toBeTruthy();
  expect(within(screen.getByRole("tabpanel")).queryByText(PIECE.name)).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /info/i }));
  expect(within(screen.getByRole("tabpanel")).getByText(PIECE.name)).toBeTruthy();
});

it.each([
  ["peça", <PieceCard key="piece" piece={PIECE} href="#" />],
  ["look", <SchemeCard key="scheme" scheme={SCHEME} href="#" />],
])("mostra a grade mínima de informações na aba Info do card de %s", (_kind, card) => {
  mockApi({});
  const { container } = renderApp(card);
  const panel = screen.getByRole("tabpanel");
  const grade = panel.querySelector(".card-info-grid")!;
  expect(grade.getAttribute("data-cols")).toBe("2");
  expect(grade.querySelectorAll("[data-field]").length).toBeGreaterThan(0);
  expect(grade.querySelector('[data-field="condition"], [data-field="style"], [data-field="season"]')).toBeNull();
  expect(panel.querySelector(".pc-name-link, .c-title")).toBeTruthy();
  expect(container.querySelector(".card-fashion-meta")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /^Hype/ }));
  expect(screen.getByRole("tabpanel").querySelector(".card-info-grid")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /info/i }));
  expect(screen.getByRole("tabpanel").querySelector(".card-info-grid")).toBeTruthy();
});

it("a grade segue a escolha do Background Studio: campos, colunas, estilo da célula e rótulos", () => {
  mockApi({});
  renderApp(<PieceCard piece={{ ...PIECE, background: { infoGrid: { fields: ["color", "size", "material"], columns: 3, cells: "pill", labels: false, align: "center", density: "compact" } } }} href="#" />);
  const grade = screen.getByRole("tabpanel").querySelector(".card-info-grid")!;
  expect([...grade.querySelectorAll("[data-field]")].map((d) => d.getAttribute("data-field")).every((f) => ["color", "size", "material"].includes(f!))).toBe(true);
  expect(grade.querySelector('[data-field="brand"]')).toBeNull();
  expect([grade.getAttribute("data-cols"), grade.getAttribute("data-cells"), grade.getAttribute("data-labels"), grade.getAttribute("data-align"), grade.getAttribute("data-density")]).toEqual(["3", "pill", "off", "center", "compact"]);
  expect(grade.querySelector("dt")?.className).toBe("sr-only");
});

it.each([
  ["peça", <PieceCard key="piece" piece={{ ...PIECE, seals: ["BRAND:Marca teste"] }} href="#" />],
  ["peça ampliada", <ExpandedPieceCard key="piece-expanded" piece={{ ...PIECE, seals: ["CELEBRITY:Artista teste"] }} preview />],
  ["look", <SchemeCard key="scheme" scheme={{ ...SCHEME, background: { selectedSeals: [{ targetOwnerId: "b1", kind: "BRAND", name: "Marca teste" }] } }} href="#" />],
])("mostra selo selecionado e não verificado em Info e Hype no card de %s", (_kind, card) => {
  mockApi({});
  renderApp(card);
  const seals = screen.getByLabelText("Selos selecionados · não verificados");
  expect(seals.textContent).toMatch(/Marca teste|Artista teste/);
  fireEvent.click(screen.getByRole("tab", { name: /^Hype/ }));
  expect(screen.getByLabelText("Selos selecionados · não verificados")).toBeTruthy();
});

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
])("mostra marca, cor, ocasião e estilo na aba Info do card de %s", (_kind, card) => {
  mockApi({});
  const { container } = renderApp(card);
  const panel = screen.getByRole("tabpanel");
  expect(panel.querySelector(".card-fashion-meta")).toBeTruthy();
  expect(panel.querySelector(".pc-name-link, .c-title")).toBeTruthy();
  expect(container.querySelector(".is-identity .card-fashion-meta, .c-titleblock .card-fashion-meta")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /^Hype/ }));
  expect(screen.getByRole("tabpanel").querySelector(".card-fashion-meta")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /info/i }));
  expect(screen.getByRole("tabpanel").querySelector(".card-fashion-meta")).toBeTruthy();
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

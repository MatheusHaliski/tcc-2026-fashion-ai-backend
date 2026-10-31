// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, mockApi, renderApp, screen, within } from "@/test-utils/render";
import { PIECE, SCHEME } from "@/test-utils/fixtures";
import { PieceCardPanels } from "./piece-card-panels";
import { PieceDetailFacts } from "./piece-detail-facts";
import { PieceCard } from "./piece-card";
import { SchemeCard } from "./scheme-card";

afterEach(cleanup);
const estadoConservacao = { id: "a32ea7a1-b97c-4ff9-b47d-72c219667453", codigo: "SEMINOVA", nome: "Sem marcas de uso" };
const tipoLavagem = { id: "3333666f-6b13-4cc9-913f-c7e5d529eb79", codigo: "MANUAL", nome: "Lavar à mão" };

it("prefers the conservation reference name over the legacy enum in the Info tab", () => {
  mockApi({});
  renderApp(<PieceCardPanels piece={{ ...PIECE, condition: "DAMAGED", estadoConservacao }} />);
  const info = screen.getByRole("tabpanel");
  expect(within(info).getByText("Estado de conservação")).toBeTruthy();
  expect(within(info).getByText(estadoConservacao.nome)).toBeTruthy();
  expect(within(info).queryByText("DAMAGED")).toBeNull();
  expect(within(info).queryByText("Danificado")).toBeNull();
});

it.each([
  ["NEW", "Novo"], ["GOOD", "Não informado"], ["WORN", "Desgastado"], ["DAMAGED", "Danificado"],
])("translates legacy %s without requiring a catalog entry", (condition, expected) => {
  mockApi({});
  renderApp(<PieceCardPanels piece={{ ...PIECE, condition, estadoConservacao: null }} />);
  expect(within(screen.getByRole("tabpanel")).getByText(expected)).toBeTruthy();
});

it("marks absent condition as unselected and omits absent washing facts", () => {
  mockApi({});
  const { container } = renderApp(<PieceDetailFacts piece={{ ...PIECE, condition: null, estadoConservacao: null, tipoLavagem: null, careInstructions: "  " }} />);
  expect(screen.getByText("Não informado")).toBeTruthy();
  expect(screen.queryByText("Lavagem")).toBeNull();
  expect(screen.queryByText("Cuidados adicionais")).toBeNull();
});

it("shows both reference names and preserves distinct additional care text", () => {
  mockApi({});
  const careInstructions = "Secar à sombra.\nNão alvejar nem torcer. " + "Conservar separadamente. ".repeat(35);
  const { container } = renderApp(<PieceDetailFacts piece={{ ...PIECE, estadoConservacao, tipoLavagem, careInstructions }} />);
  expect(screen.getByText(estadoConservacao.nome)).toBeTruthy();
  expect(screen.getByText(tipoLavagem.nome)).toBeTruthy();
  const careRow = screen.getByText("Cuidados adicionais").parentElement!;
  expect(careRow.querySelector("dd")?.textContent).toBe(careInstructions.trim());
  expect(careRow.querySelector("dd")?.classList.contains("whitespace-pre-wrap")).toBe(true);
  expect(container.textContent).not.toContain("NEW");
});

it("uses legacy washing text literally and does not parse it as markup", () => {
  mockApi({});
  const careInstructions = "Lavar a frio <script>alert('care')</script>. " + "Usar ciclo delicado. ".repeat(35);
  const { container } = renderApp(<PieceDetailFacts piece={{ ...PIECE, tipoLavagem: null, careInstructions }} />);
  const washRow = screen.getByText("Lavagem").parentElement!;
  expect(washRow.querySelector("dd")?.textContent).toBe(careInstructions.trim());
  expect(container.querySelector("script")).toBeNull();
  expect(screen.queryByText("Cuidados adicionais")).toBeNull();
});

it("does not duplicate identical washing and care text", () => {
  mockApi({});
  renderApp(<PieceDetailFacts piece={{ ...PIECE, tipoLavagem, careInstructions: `  ${tipoLavagem.nome}  ` }} />);
  expect(screen.getAllByText(tipoLavagem.nome)).toHaveLength(1);
  expect(screen.queryByText("Cuidados adicionais")).toBeNull();
});

it.each([false, true])("retains the real conservation object in a piece card, expanded=%s", expanded => {
  mockApi({});
  const { container } = renderApp(<PieceCard piece={{ ...PIECE, estadoConservacao, tipoLavagem }} expanded={expanded} flip={false} />);
  expect(within(screen.getByRole("tabpanel")).getByText(estadoConservacao.nome)).toBeTruthy();
  if (expanded) expect(container.querySelector(".c-facts")?.textContent).toContain(tipoLavagem.nome);
});

it.each([false, true])("renders a real TipoLook object on the outfit card, expanded=%s", expanded => {
  mockApi({});
  const tipoLook = { id: "bc8c9081-cdb4-4db4-a34c-491d38c7e646", codigo: "TRABALHO", nome: "Trabalho e reuniões" };
  const { container } = renderApp(<SchemeCard scheme={{ ...SCHEME, tipoLook }} expanded={expanded} flip={false} />);
  expect(container.textContent).toContain(tipoLook.nome);
  expect(container.textContent).not.toContain("[object Object]");
});

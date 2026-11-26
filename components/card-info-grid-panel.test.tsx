// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import type { InfoGridConfig } from "@/lib/cards/info-grid";
import { CardInfoGridPanel } from "./card-info-grid-panel";

afterEach(cleanup);

function Painel({ onValue }: { onValue: (v: InfoGridConfig | null) => void }) {
  const [v, setV] = useState<InfoGridConfig | null>(null);
  return <CardInfoGridPanel kind="piece" value={v} onChange={(n) => { setV(n); onValue(n); }} />;
}
const ligado = (nome: string) => screen.getByRole("button", { name: nome }).getAttribute("aria-pressed");

it("começa no mínimo (conservação desligada), liga campos, muda colunas/estilo e volta ao padrão", () => {
  let atual: InfoGridConfig | null = null;
  renderApp(<Painel onValue={(v) => { atual = v; }} />);
  expect([ligado("Marca"), ligado("Cor"), ligado("Categoria"), ligado("Tamanho"), ligado("Estado de conservação"), ligado("Padrão")]).toEqual(["true", "true", "true", "true", "false", "true"]);
  fireEvent.click(screen.getByRole("button", { name: "Estado de conservação" }));
  fireEvent.click(screen.getByRole("button", { name: "Marca" }));
  fireEvent.click(screen.getByRole("button", { name: "3 coluna(s)" }));
  fireEvent.click(screen.getByRole("button", { name: "Pílula" }));
  fireEvent.click(screen.getByRole("button", { name: "Só o valor" }));
  expect(atual).toEqual({ fields: ["color", "category", "size", "condition"], columns: 3, cells: "pill", labels: false });
  expect(ligado("Padrão")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Padrão" }));
  expect(atual).toBeNull();
  expect(ligado("Estado de conservação")).toBe("false");
});

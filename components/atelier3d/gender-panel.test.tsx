// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderApp, loggedAs, ME } from "@/test-utils/render";
import { GenderPanel } from "./gender-panel";
import type { GenderEvidence } from "./contracts";
afterEach(cleanup);
const evidence: GenderEvidence = {
  sources: [
    { id: "p", name: "Camisa", gender: "MEN", normalized: "MASCULINO" },
  ],
  status: "READY",
  suggestion: "MASCULINO",
  hash: "hash",
  options: [
    { id: "male", codigo: "MASCULINO", nome: "Masculino" },
    { id: "unisex", codigo: "UNISEX", nome: "Unissex" },
  ],
};
it("shows catalog evidence but requires a deliberate final TipoLook choice", () => {
  loggedAs(ME);
  const confirm = vi.fn();
  renderApp(
    <GenderPanel
      search={vi.fn()}
      ids={["p"]}
      onSources={vi.fn()}
      evidence={evidence}
      selected={null}
      onConfirm={confirm}
      disabled={false}
    />,
  );
  expect(screen.getByText("Camisa · MEN")).toBeTruthy();
  const select = screen.getByRole("button", {
    name: "TipoLook final — confirmação do criador",
  });
  expect(select.textContent).toContain("Escolha para confirmar");
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(select);
  fireEvent.click(screen.getByRole("option", { name: "Unissex" }));
  expect(confirm).toHaveBeenCalledWith("unisex");
});
it("does not select unisex for missing or conflicting catalog data", () => {
  loggedAs(ME);
  const confirm = vi.fn();
  renderApp(
    <GenderPanel
      search={vi.fn()}
      ids={[]}
      onSources={vi.fn()}
      evidence={{
        ...evidence,
        sources: [],
        status: "INCOMPLETE",
        suggestion: null,
      }}
      selected={null}
      onConfirm={confirm}
      disabled={false}
    />,
  );
  expect(
    screen.getByRole("button", {
      name: "TipoLook final — confirmação do criador",
    }).textContent,
  ).toContain("Escolha para confirmar");
  expect(confirm).not.toHaveBeenCalled();
});

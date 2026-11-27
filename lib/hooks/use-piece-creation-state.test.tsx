// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";
import { EMPTY_PIECE } from "@/components/piece-form";
import { usePieceCreationState } from "./use-piece-creation-state";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const categories = ["upper_piece"];
function Form() {
  const { value, setValue } = usePieceCreationState({}, {}, null, categories);
  return <>
    <output>{value.sex}</output>
    <button onClick={() => setValue({ ...EMPTY_PIECE, sex: "FEMININO" })}>Escolher foto</button>
    <button onClick={() => setValue(() => ({ ...EMPTY_PIECE }))}>Nova peça</button>
  </>;
}

it("mostra o tipo configurado e o mantém ao selecionar foto ou criar outra peça", async () => {
  loggedAs(undefined, {
    "GET /api/me/preferences/tipo-look": { tipoLook: { id: "t", codigo: "MASCULINO", nome: "Masculino" } },
  });
  renderApp(<Form />);
  await screen.findByText("MASCULINO");
  fireEvent.click(screen.getByRole("button", { name: "Escolher foto" }));
  expect(screen.getByText("MASCULINO")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
  expect(screen.getByText("MASCULINO")).toBeTruthy();
});

it("preserva o formulário sem um padrão configurado", async () => {
  loggedAs(undefined, { "GET /api/me/preferences/tipo-look": { tipoLook: null } });
  renderApp(<Form />);
  await screen.findByText("UNISSEX");
  fireEvent.click(screen.getByRole("button", { name: "Escolher foto" }));
  expect(screen.getByText("FEMININO")).toBeTruthy();
});

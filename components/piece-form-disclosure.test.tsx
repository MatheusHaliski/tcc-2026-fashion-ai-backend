// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { TAXONOMY } from "@/test-utils/fixtures";
import { EMPTY_PIECE, PieceFields } from "./piece-form";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("opens hidden supplementary fields when validation fails and preserves entered values", async () => {
  mockApi({ "GET /api/taxonomy": TAXONOMY });
  function Form() {
    const [value, setValue] = useState({ ...EMPTY_PIECE, name: "Peça de teste" });
    const [errors, setErrors] = useState<Record<string, string>>({});
    return <><PieceFields compact value={value} onChange={setValue} fieldErrors={errors} /><button onClick={() => setErrors({ material: "Escolha o material" })}>Validar formulário</button></>;
  }
  const { container } = renderApp(<Form />);
  expect(container.querySelector("details")?.open).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Validar formulário" }));
  await waitFor(() => expect(container.querySelector("details")?.open).toBe(true));
  expect(screen.getByText("Escolha o material")).toBeTruthy();
  expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe("Peça de teste");
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { SchemeImprovementDialog } from "./scheme-improvement-dialog";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const suggestion = { changes: [
  { field: "title", current: "Look atual", proposed: "Noite elegante", reason: "Título mais adequado" },
  { field: "visibility", current: "PRIVATE", proposed: "PUBLIC", reason: "Compartilhar" },
], explanation: "Alterações propostas", inferenceId: "inference-1", message: "Escolha o que deseja mudar" };

async function generate() {
  fireEvent.change(screen.getByRole("textbox", { name: "O que você quer mudar?" }), { target: { value: "  mais elegante  " } });
  fireEvent.click(screen.getByRole("button", { name: "Gerar com IA" }));
  await screen.findAllByRole("checkbox", { name: /Título/ });
}

it("selects suggestions and sends only accepted fields to the real apply contract", async () => {
  const onSaved = vi.fn(), onClose = vi.fn();
  const { calls } = mockApi({ "POST /api/schemes/s1/improvements": suggestion, "POST /api/schemes/s1/improvements/apply": { scheme: { title: "Noite elegante" } } });
  renderApp(<SchemeImprovementDialog id="s1" onSaved={onSaved} onClose={onClose} />);
  await generate();
  const apply = screen.getByRole("button", { name: "Aplicar" });
  expect((apply as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: /Título/ }));
  expect((apply as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(apply);
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(onClose).toHaveBeenCalledOnce();
  expect(calls.find(c => c.path.endsWith("/improvements"))?.body).toEqual({ instruction: "mais elegante" });
  expect(calls.find(c => c.path.endsWith("/apply"))?.body).toEqual({ title: "Noite elegante" });
  expect(calls.find(c => c.path.endsWith("/apply"))?.body).not.toHaveProperty("changes");
});

it("keeps failed selections available for retry and permits rejecting a suggestion", async () => {
  let attempts = 0;
  const { calls } = mockApi({ "POST /api/schemes/s1/improvements": suggestion,
    "POST /api/schemes/s1/improvements/apply": () => ++attempts === 1 ? new Response(JSON.stringify({ message: "Falha temporária" }), { status: 503, headers: { "content-type": "application/json" } }) : { scheme: {} } });
  const saved = vi.fn(); renderApp(<SchemeImprovementDialog id="s1" onSaved={saved} onClose={vi.fn()} />);
  await generate();
  fireEvent.click(screen.getByRole("checkbox", { name: /Título/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Visibilidade/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Visibilidade/ }));
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Falha temporária");
  expect((screen.getByRole("checkbox", { name: /Título/ }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(calls.filter(c => c.path.endsWith("/apply")).map(c => c.body)).toEqual([{ title: "Noite elegante" }, { title: "Noite elegante" }]);
});

it("shows an empty result, ignores noneditable fields and allows revising the instruction", async () => {
  mockApi({ "POST /api/schemes/s1/improvements": { changes: [{ field: "ownerId", proposed: "other" }] } });
  renderApp(<SchemeImprovementDialog id="s1" onSaved={vi.fn()} onClose={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "mais elegante" } });
  fireEvent.click(screen.getByRole("button", { name: "Gerar com IA" }));
  expect((await screen.findByRole("status")).textContent).toContain("Nenhuma alteração disponível");
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect((screen.getByRole("button", { name: "Aplicar" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Revisar instrução" }));
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("mais elegante");
});

it("selects only one alternative per field instead of silently applying the last one", async () => {
  const { calls } = mockApi({ "POST /api/schemes/s1/improvements": { changes: [suggestion.changes[0], { field: "title", current: "Look atual", proposed: "Outra opção" }] }, "POST /api/schemes/s1/improvements/apply": { scheme: {} } });
  renderApp(<SchemeImprovementDialog id="s1" onSaved={vi.fn()} onClose={vi.fn()} />);
  await generate();
  const alternatives = screen.getAllByRole("checkbox", { name: /Título/ });
  fireEvent.click(alternatives[0]); fireEvent.click(alternatives[1]);
  expect((alternatives[0] as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
  await waitFor(() => expect(calls.find(c => c.path.endsWith("/apply"))?.body).toEqual({ title: "Outra opção" }));
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import LoginPage from "@/app/(site)/(auth)/login/page";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
it("recognizes the actual backend challenge, requests the email code and preserves the step after an invalid code", async () => {
  let attempt = 0;
  const { calls } = mockApi({ "POST /bff/auth/login": () => {
    attempt++;
    return new Response(JSON.stringify(attempt === 1
      ? { code: "DOIS_FATORES_NECESSARIO", message: "Código enviado", details: { twoFactorRequired: true } }
      : { code: "NAO_AUTORIZADO", message: "Código inválido ou expirado" }), { status: 401 });
  } });
  const { container } = renderApp(<LoginPage />);
  fireEvent.change(container.querySelector("#identifier")!, { target: { value: "ana@example.com" } });
  fireEvent.change(container.querySelector("#password")!, { target: { value: "test-password" } });
  fireEvent.submit(container.querySelector("form")!);
  const dialog = await screen.findByRole("dialog", { name: "Verificação em duas etapas" });
  expect(within(dialog).getByText(/Insira o código recebido/)).toBeTruthy();
  expect(screen.queryByText("Não foi possível concluir")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Entendi" }));
  const code = screen.getByLabelText(/Código recebido por e-mail/);
  await waitFor(() => expect(document.activeElement).toBe(code));
  fireEvent.change(code, { target: { value: "123456" } });
  fireEvent.submit(container.querySelector("form")!);
  await screen.findByRole("dialog", { name: "Verificação em duas etapas" });
  expect(screen.getByLabelText(/Código recebido por e-mail/)).toBeTruthy();
  expect(calls.filter(c => c.path === "/bff/auth/login")[1].body).toMatchObject({ twoFactorCode: "123456" });
});

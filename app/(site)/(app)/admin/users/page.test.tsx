// @vitest-environment jsdom
/**
 * Admin · Usuários e aprovações: fila de verificação (com erro), busca de usuários com troca de papel, suspensão e
 * reativação, e a auditoria filtrada por ator (campos em português ou inglês).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import AdminUsersPage from "./page";

vi.mock("@/components/admin-approvals", () => ({
  AdminApprovals: ({ queue, onChanged }: { queue: { pending: unknown[] }; onChanged: () => void }) => <button type="button" onClick={onChanged}>{queue.pending.length} pendentes</button>,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ADMIN = { ...ME, role: "ADMIN" as const };
const fail = (status: number, message: string) => () => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const USERS = [
  { id: "u1", username: "ana", displayName: "Ana", profileType: "PESSOAL", verified: true, country: "BR", privateAccount: false },
  { id: "u2", username: "marca", displayName: "Marca X", profileType: "MARCA", verified: false, privateAccount: false },
];
const tab = async (name: RegExp) => fireEvent.click(await screen.findByRole("tab", { name }, { timeout: 4000 }));

describe("admin · usuários", () => {
  it("aprovações: mostra a fila e o contador; erro mostra o estado de erro", async () => {
    let n = 0;
    loggedAs(ADMIN, { "GET /api/admin/approvals": () => (++n === 1 ? { pending: [{}, {}] } : fail(500, "Fila indisponível")()) });
    renderApp(<AdminUsersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "2 pendentes" }, { timeout: 4000 }));
    expect(screen.getByRole("tab", { name: /Aprovações/ }).textContent).toContain("2");
    await tab(/Usuários/);
    await tab(/Aprovações/);
    expect((await screen.findAllByText("Fila indisponível")).length).toBeGreaterThan(0);
  });

  it("usuários: busca, papel, suspender e reativar", async () => {
    const { calls } = loggedAs(ADMIN, { "GET /api/admin/approvals": { pending: [] }, "GET /api/admin/users": USERS,
      "PUT /api/admin/users/u1/role": {}, "PUT /api/admin/users/u1/status": {}, "PUT /api/admin/users/u2/status": fail(403, "Sem permissão") });
    renderApp(<AdminUsersPage />);
    await tab(/Usuários/);
    expect(await screen.findByText("@ana", { exact: false })).toBeTruthy();
    expect(screen.getByText("PESSOAL· verificado · BR")).toBeTruthy();
    expect(screen.getByText("MARCA")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("buscar"), { target: { value: "an a" } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/admin/users?term=an%20a")).toBe(true));
    const row = (await screen.findByText("Ana")).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: /^papel/ }));
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "ADMIN" }));
    expect(await screen.findByText("Papel atualizado")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/admin/users/u1/role")!.body).toEqual({ role: "ADMIN" });
    fireEvent.click(within(row).getByRole("button", { name: "Suspender" }));
    expect(await screen.findByText("Suspenso")).toBeTruthy();
    fireEvent.click(within((await screen.findByText("Ana")).closest("li")!).getByRole("button", { name: "Reativar" }));
    expect(await screen.findByText("Reativado")).toBeTruthy();
    expect(calls.filter((c) => c.path === "/api/admin/users/u1/status").map((c) => c.body)).toEqual([{ suspend: true, reason: "Violação da política." }, { suspend: false, reason: "" }]);
    fireEvent.click(within((await screen.findByText("Marca X")).closest("li")!).getByRole("button", { name: "Suspender" }));
    expect(await screen.findByText("Sem permissão")).toBeTruthy();
  });

  it("auditoria: filtra por ator e mostra campos em português ou inglês", async () => {
    const { calls } = loggedAs(ADMIN, { "GET /api/admin/approvals": { pending: [] },
      "GET /api/admin/audit": [{ id: "a1", actor: "1234567890ab", acao: "SUSPENDER", recurso: "USER", resultado: "OK", timestamp: "2026-10-24T12:00:00Z", ip: "10.0.0.1" },
        { actor: "zzzzzzzzzz", action: "LOGIN", resource: "SESSION", result: "FAIL", timestamp: "2026-10-24T12:00:00Z" }] });
    renderApp(<AdminUsersPage />);
    await tab(/Auditoria/);
    expect(await screen.findByText("SUSPENDER")).toBeTruthy();
    expect(screen.getByText("12345678")).toBeTruthy();
    expect(screen.getByText("10.0.0.1")).toBeTruthy();
    expect(screen.getByText("LOGIN")).toBeTruthy();
    expect(screen.getByText("SESSION")).toBeTruthy();
    expect(screen.getByText("FAIL")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("ator"), { target: { value: "u1" } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/admin/audit?actor=u1")).toBe(true));
  });
});

// @vitest-environment jsdom
/**
 * Tela do gate: 1º fator (Google ou usuário da equipe) libera o PIN; cada resposta da verificação vira uma mensagem
 * neutra (sem i18n nem marca do app), e o sucesso leva ao destino pedido.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { nav } from "@/test-utils/setup";
import GatePage from "./page";
import GateRootLayout, { metadata } from "../layout";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const assign = vi.fn();
const realLocation = window.location;

type Route = (init?: RequestInit) => Response | Promise<Response>;
function api(routes: Record<string, Route>) {
  const calls: { url: string; body?: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const h = routes[url.split("?")[0]];
    return h ? h(init) : json(404, {});
  }));
  return calls;
}

beforeEach(() => { Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, assign } }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); assign.mockReset(); nav.search = new URLSearchParams(); Object.defineProperty(window, "location", { configurable: true, value: realLocation }); });

const pinInput = () => screen.getByPlaceholderText("Enter your PIN") as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: /Verify PIN|Verifying/ }) as HTMLButtonElement;

describe("tela do gate", () => {
  it("modo Google sem login: link do Google com o next e PIN bloqueado", async () => {
    nav.search = new URLSearchParams("next=/feed");
    api({ "/gate/status": () => json(200, { mode: "google", googleDone: false, email: null }) });
    render(<GatePage />);
    const link = await screen.findByRole("link", { name: /Continuar com o Google/ });
    expect(link.getAttribute("href")).toBe("/gate/google?next=%2Ffeed");
    expect(screen.getByRole("heading").textContent).toBe("Sign in with Google and enter your PIN");
    expect(pinInput().disabled).toBe(true);
    expect(submit().disabled).toBe(true);
  });

  it("erro conhecido e desconhecido vindos do callback do Google aparecem como alerta", async () => {
    nav.search = new URLSearchParams("erro=conta_nao_autorizada");
    api({ "/gate/status": () => json(200, { mode: "google", googleDone: false, email: null }) });
    render(<GatePage />);
    expect(screen.getByRole("alert").textContent).toBe("This Google account is not authorized.");
    cleanup();
    nav.search = new URLSearchParams("erro=qualquer");
    render(<GatePage />);
    expect(screen.getByRole("alert").textContent).toBe("Google sign-in failed. Try again.");
  });

  it("status indisponível: cai no modo Google sem login", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    render(<GatePage />);
    expect(await screen.findByRole("link", { name: /Continuar com o Google/ })).toBeTruthy();
  });

  it("Google concluído: mostra o e-mail, PIN certo leva ao destino", async () => {
    const calls = api({
      "/gate/status": () => json(200, { mode: "google", googleDone: true, email: "ana@exemplo.com" }),
      "/gate/verify": () => json(200, { ok: true, next: "/feed" }),
    });
    nav.search = new URLSearchParams("next=/feed");
    render(<GatePage />);
    expect(await screen.findByText("ana@exemplo.com")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Switch" }).getAttribute("href")).toBe("/gate/google?next=%2Ffeed");
    fireEvent.change(pinInput(), { target: { value: "12345678" } });
    fireEvent.click(submit());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/feed"));
    expect(calls.find((c) => c.url === "/gate/verify")?.body).toEqual({ user: "", pin: "12345678", next: "/feed" });
  });

  it("sucesso sem next na resposta vai para a home", async () => {
    api({ "/gate/status": () => json(200, { mode: "google", googleDone: true, email: "a@x.com" }), "/gate/verify": () => json(200, { ok: true }) });
    render(<GatePage />);
    await screen.findByText("a@x.com");
    fireEvent.change(pinInput(), { target: { value: "1" } });
    fireEvent.submit(submit().closest("form")!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
  });

  it("modo Google com PIN errado: limpa o PIN, pede novo login e reconsulta o status", async () => {
    let statusCalls = 0;
    api({
      "/gate/status": () => { statusCalls++; return json(200, { mode: "google", googleDone: statusCalls === 1, email: statusCalls === 1 ? "a@x.com" : null }); },
      "/gate/verify": () => json(401, { error: "CREDENCIAIS_INVALIDAS" }),
    });
    render(<GatePage />);
    await screen.findByText("a@x.com");
    fireEvent.change(pinInput(), { target: { value: "999" } });
    fireEvent.click(submit());
    expect((await screen.findByRole("alert")).textContent).toBe("Verification failed. Sign in with Google again and re-enter your PIN.");
    expect(pinInput().value).toBe("");
    await waitFor(() => expect(screen.getByRole("link", { name: /Continuar com o Google/ })).toBeTruthy());
    expect(statusCalls).toBe(2);
  });

  it("modo usuário: usuário libera o PIN; 429, 503, erro comum e falha de rede viram mensagens próprias", async () => {
    const answers: Route[] = [() => json(429, {}), () => json(503, {}), () => new Response("não json", { status: 401 }), () => { throw new TypeError("offline"); }];
    api({ "/gate/status": () => json(200, { mode: "user", googleDone: false, email: null }), "/gate/verify": () => answers.shift()!() });
    render(<GatePage />);
    expect((await screen.findByRole("heading")).textContent).toBe("Enter your user and PIN");
    expect(pinInput().disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "equipe" } });
    expect(pinInput().disabled).toBe(false);
    // sem PIN, enviar não faz nada
    fireEvent.submit(submit().closest("form")!);
    expect(screen.queryByRole("alert")).toBeNull();
    const expected = ["Too many attempts. Try again in 15 minutes.", "Access is not configured on this server.", "Verification failed. Check your PIN.", "Network error. Try again."];
    for (const msg of expected) {
      fireEvent.change(pinInput(), { target: { value: "1234" } });
      fireEvent.click(submit());
      await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(msg));
    }
  });

  it("layout do gate: documento próprio, neutro e fora dos buscadores", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    const el = GateRootLayout({ children: <p>oi</p> });
    expect(el.type).toBe("html");
    expect((el.props as { lang: string }).lang).toBe("en");
  });
});

// @vitest-environment jsdom
/**
 * Erro no layout raiz: texto neutro e fixo (fica acima dos dois layouts), botão de tentar de novo e, se o erro é um
 * pedaço de script sumido num deploy novo, recarrega sozinha uma vez.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GlobalError from "./global-error";

const reload = vi.fn();
const realLocation = window.location;
beforeEach(() => { sessionStorage.clear(); Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, reload } }); });
afterEach(() => { cleanup(); reload.mockReset(); Object.defineProperty(window, "location", { configurable: true, value: realLocation }); vi.restoreAllMocks(); });

// o componente traz <html>/<body>: o React avisa ao montar dentro de uma <div>; o aviso não interessa aqui
const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("erro global", () => {
  it("erro comum: mensagem neutra, código do erro e botão que chama reset", () => {
    quiet();
    const reset = vi.fn();
    render(<GlobalError error={Object.assign(new Error("boom"), { digest: "abc123" })} reset={reset} />);
    expect(screen.getByRole("alert").textContent).toContain("Algo deu errado. / Something went wrong.");
    expect(screen.getByText("abc123")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo / Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("pedaço de script sumido: mostra 'Atualizando…' e recarrega uma vez", () => {
    quiet();
    const err = Object.assign(new Error("Loading chunk 12 failed"), { name: "ChunkLoadError" });
    render(<GlobalError error={err} reset={vi.fn()} />);
    expect(screen.getByText("Atualizando…")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("pedaço sumido de novo logo depois de recarregar: não entra em laço e mostra o erro", () => {
    quiet();
    sessionStorage.setItem("fai.chunk-reload-at", String(Date.now()));
    render(<GlobalError error={Object.assign(new Error("x"), { name: "ChunkLoadError" })} reset={vi.fn()} />);
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("Algo deu errado. / Something went wrong.")).toBeTruthy();
  });
});

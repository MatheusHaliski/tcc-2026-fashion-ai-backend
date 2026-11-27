// @vitest-environment jsdom
/**
 * Código de suporte no aviso de erro: vale para falha (o time de suporte acha o pedido pelo código), não para uma regra
 * recusada (409/422), em que o código só confunde (auditoria 10.1, Desafios: "(12521a5d)" numa regra de jogo).
 */
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { ApiError } from "@/lib/api/client";
import { useNotice } from "@/components/ui";

afterEach(cleanup);

function Harness() {
  const n = useNotice();
  return <>
    <button onClick={() => n.fromError(new ApiError(409, "REGRA", "Esse look não cumpre a regra do desafio", {}, "12521a5d99"))}>regra</button>
    <button onClick={() => n.fromError(new ApiError(500, "ERRO", "Falhou no servidor", {}, "abcdef1234"))}>falha</button>
  </>;
}

it("regra recusada não mostra código de suporte; falha do servidor mostra", () => {
  renderApp(<Harness />);
  fireEvent.click(screen.getByText("regra"));
  expect(screen.getByText("Esse look não cumpre a regra do desafio")).toBeTruthy();
  expect(document.body.textContent).not.toContain("12521a5d");
  fireEvent.click(screen.getByText("Entendi"));
  fireEvent.click(screen.getByText("falha"));
  expect(Array.from(document.querySelectorAll(".notice-list li")).map((l) => l.textContent)).toContain("Código de suporte: abcdef12");
});

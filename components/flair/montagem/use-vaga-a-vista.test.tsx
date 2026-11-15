// @vitest-environment jsdom

/** A vaga em destaque nunca fica atrás da bandeja: a página rola só o que falta. */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";
import { rolagemParaVer, useVagaAVista } from "@/components/flair/montagem/use-vaga-a-vista";

describe("rolagemParaVer", () => {
  it("vaga visível não rola; atrás da bandeja desce o que falta; acima do topo sobe", () => {
    expect(rolagemParaVer(300, 380, 76, 600)).toBe(0);
    expect(rolagemParaVer(560, 640, 76, 600)).toBe(40);
    expect(rolagemParaVer(20, 100, 76, 600)).toBe(-56);
  });

  it("nunca leva o topo da vaga para baixo da barra do topo, mesmo se ela for mais alta que o espaço", () => {
    expect(rolagemParaVer(100, 700, 76, 600)).toBe(24);
  });
});

function Tela({ vaga, reduzido }: { vaga: string; reduzido: boolean }) {
  const bandeja = useRef<HTMLElement>(null);
  useVagaAVista(vaga, bandeja, reduzido);
  return (
    <div>
      <button data-slot="a">a</button>
      <button data-slot="b">b</button>
      <section ref={bandeja}>bandeja</section>
    </div>
  );
}

const caixa = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

describe("useVagaAVista", () => {
  it("ao mudar o destaque para uma vaga coberta pela bandeja, rola até ela; com movimento reduzido, sem animação", () => {
    const rolar = vi.fn();
    window.scrollBy = rolar as unknown as typeof window.scrollBy;
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
    const { container, rerender } = render(<Tela vaga="a" reduzido={false} />);
    const [a, b] = Array.from(container.querySelectorAll("button"));
    const tray = container.querySelector("section")!;
    a.getBoundingClientRect = () => caixa(300, 370);
    b.getBoundingClientRect = () => caixa(600, 670);
    tray.getBoundingClientRect = () => caixa(610, 780);
    rerender(<Tela vaga="b" reduzido={false} />);
    expect(rolar).toHaveBeenLastCalledWith({ top: 72, behavior: "smooth" });
    rolar.mockClear();
    rerender(<Tela vaga="a" reduzido />);
    expect(rolar).not.toHaveBeenCalled();
    b.getBoundingClientRect = () => caixa(640, 700);
    rerender(<Tela vaga="b" reduzido />);
    expect(rolar).toHaveBeenLastCalledWith({ top: 102, behavior: "auto" });
  });
});

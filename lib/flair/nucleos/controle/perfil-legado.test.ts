import { describe, expect, it } from "vitest";
import { comandoDaTecla } from "@/lib/flair/nucleos/controls";
import { TECLAS_DE_ANDAR } from "@/components/flair/nucleos/use-eixo-de-andar";
import { perfilDoJogo } from "@/lib/flair/nucleos/controle/perfil-console";

/**
 * Caracterização do perfil "legado" (lib/flair/nucleos/controls.ts e use-eixo-de-andar.ts), que os outros 14 jogos
 * continuam usando enquanto o Fashion Detective passa ao perfil console: o mapa não muda com a chegada do perfil novo.
 */
describe("perfil legado (os outros jogos)", () => {
  it("setas e WASD navegam; E e Espaço vestem; Shift tira; F desfila; I troca a aba; Esc abre o objetivo; Enter entrega", () => {
    expect(comandoDaTecla("ArrowLeft", "ArrowLeft")).toEqual({ acao: "NAVEGAR", dir: -1, eixo: "x" });
    expect(comandoDaTecla("a", "KeyA")).toEqual({ acao: "NAVEGAR", dir: -1, eixo: "x" });
    expect(comandoDaTecla("ArrowDown", "ArrowDown")).toEqual({ acao: "NAVEGAR", dir: 1, eixo: "y" });
    expect(comandoDaTecla("e", "KeyE")).toEqual({ acao: "VESTIR" });
    expect(comandoDaTecla(" ", "Space")).toEqual({ acao: "VESTIR" });
    expect(comandoDaTecla("Shift", "ShiftLeft")).toEqual({ acao: "TIRAR" });
    expect(comandoDaTecla("f", "KeyF")).toEqual({ acao: "DESFILAR" });
    expect(comandoDaTecla("i", "KeyI")).toEqual({ acao: "TROCAR_ABA", dir: 1 });
    expect(comandoDaTecla("Escape", "Escape")).toEqual({ acao: "VER_OBJETIVO" });
    expect(comandoDaTecla("Enter", "Enter")).toEqual({ acao: "ENTREGAR" });
    expect(comandoDaTecla("x", "KeyX")).toBeNull();
  });

  it("o andar livre do legado é só WASD; só o Detective está no perfil console", () => {
    expect([...TECLAS_DE_ANDAR].sort()).toEqual(["KeyA", "KeyD", "KeyS", "KeyW"]);
    for (const jogo of ["PASSARELA", "DRESS_FIGHTER", "LABIRINTO", "AROUND_THE_WORLD", "FASHION_SPORTS"] as const) expect(perfilDoJogo(jogo)).toBe("legado");
  });
});

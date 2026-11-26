import { describe, expect, it } from "vitest";
import { ACOES_ENTRADA, limitar } from "@/lib/flair/entrada/acoes";
import { familiaDoControle, lerControle, semZonaMorta, ZONA_MORTA, type PadLike } from "@/lib/flair/entrada/gamepad";
import { glifo } from "@/lib/flair/entrada/glifos";
import { botoesDoJogo, mapaDoJogo } from "@/lib/flair/entrada/mapa-por-jogo";
import { acaoDaTecla, ehDirecao, ignorarTecla, vetorDasTeclas } from "@/lib/flair/entrada/teclado";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { NUCLEO_CODIGOS } from "@/lib/flair/nucleos/types";

const pad = (apertados: number[] = [], eixos: number[] = [0, 0, 0, 0], extra: Partial<PadLike> = {}): PadLike => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: apertados.includes(i) })),
  axes: eixos,
  ...extra,
});
const tecla = (code: string, target: unknown = null, mods: Partial<Record<"altKey" | "ctrlKey" | "metaKey", boolean>> = {}) =>
  ({ code, altKey: false, ctrlKey: false, metaKey: false, target, ...mods }) as Parameters<typeof ignorarTecla>[0];

describe("entrada de console: teclado", () => {
  it("cinco ações: Espaço/E interagem, Shift/Backspace cancelam, F é o quadrado, I o inventário, Esc/Enter pausam", () => {
    expect(["Space", "KeyE", "ShiftLeft", "Backspace", "KeyF", "KeyI", "Escape", "Enter"].map(acaoDaTecla)).toEqual(
      ["INTERAGIR", "INTERAGIR", "CANCELAR", "CANCELAR", "ACAO", "INVENTARIO", "PAUSAR", "PAUSAR"],
    );
    expect(acaoDaTecla("KeyZ")).toBeNull();
    expect(acaoDaTecla("Equal")).toBeNull();
    expect(ehDirecao("KeyW") && ehDirecao("ArrowLeft") && !ehDirecao("KeyF")).toBe(true);
  });

  it("WASD e setas dão o mesmo vetor; a diagonal não passa de 1; opostas se anulam; W com seta para cima conta uma vez", () => {
    expect(vetorDasTeclas(["KeyW"])).toEqual(vetorDasTeclas(["ArrowUp"]));
    expect(vetorDasTeclas(["KeyW"])).toEqual({ x: 0, y: 1 });
    const diagonal = vetorDasTeclas(["KeyW", "KeyD"]);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 6);
    expect(vetorDasTeclas(["KeyW", "KeyS"])).toEqual({ x: 0, y: 0 });
    expect(vetorDasTeclas(["KeyW", "ArrowUp"])).toEqual({ x: 0, y: 1 });
  });

  it("ignora atalhos, digitação em campos e Espaço/Enter num botão focado", () => {
    expect(ignorarTecla(tecla("KeyW", null, { ctrlKey: true }))).toBe(true);
    expect(ignorarTecla(tecla("KeyW", { tagName: "INPUT" }))).toBe(true);
    expect(ignorarTecla(tecla("Space", { tagName: "BUTTON" }))).toBe(true);
    expect(ignorarTecla(tecla("KeyF", { tagName: "BUTTON" }))).toBe(false);
    expect(ignorarTecla(tecla("Space", { tagName: "CANVAS" }))).toBe(false);
  });
});

describe("entrada de console: controle", () => {
  it("os botões 0, 1, 2, 3 e 9 viram as cinco ações, só no instante em que são apertados", () => {
    const primeiro = lerControle(pad([0, 1, 2, 3, 9]), []);
    expect(primeiro.acoes).toEqual(["INTERAGIR", "CANCELAR", "ACAO", "INVENTARIO", "PAUSAR"]);
    expect(lerControle(pad([0]), primeiro.botoes).acoes).toEqual([]);
    expect(lerControle(pad([4, 5, 6, 7, 8]), []).acoes).toEqual([]);
  });

  it("o analógico esquerdo e o direcional dão o mesmo vetor do teclado; zona morta e y para a frente", () => {
    expect(lerControle(pad([], [0, -1, 0, 0]), []).mover).toEqual(vetorDasTeclas(["KeyW"]));
    expect(lerControle(pad([12]), []).mover).toEqual(vetorDasTeclas(["KeyW"]));
    expect(lerControle(pad([], [ZONA_MORTA * 0.9, 0.1, 0, 0]), []).mover).toEqual({ x: 0, y: 0 });
    const diagonal = lerControle(pad([], [1, -1, 0, 0]), []).mover;
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeLessThanOrEqual(1 + 1e-9);
    expect(lerControle(pad([], [0, 0, 1, 0]), []).camera.x).toBe(1);
    expect(semZonaMorta(0.6)).toBeCloseTo(0.5, 6);
    expect(semZonaMorta(Number.NaN)).toBe(0);
  });

  it("reconhece PlayStation e Xbox pelo id; controle fora do layout padrão recebe símbolos genéricos", () => {
    expect(familiaDoControle({ id: "DualSense Wireless Controller (Vendor: 054c Product: 0ce6)", mapping: "standard" })).toBe("PLAYSTATION");
    expect(familiaDoControle({ id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)", mapping: "standard" })).toBe("XBOX");
    expect(familiaDoControle({ id: "DualSense Wireless Controller", mapping: "" })).toBe("GENERICO");
    expect(glifo("INTERAGIR", "CONTROLE", "PLAYSTATION").simbolo).toBe("✕");
    expect(glifo("ACAO", "CONTROLE", "PLAYSTATION").simbolo).toBe("□");
    expect(glifo("INTERAGIR", "CONTROLE", "XBOX").simbolo).toBe("A");
    expect(glifo("INTERAGIR", "TECLADO").simbolo).toBe("Espaço");
    expect(glifo("INVENTARIO", "TOQUE").simbolo).toBe("△");
    expect(glifo("PAUSAR", "CONTROLE", "GENERICO").rotuloKey).toBe("flair3d.entrada.acao.PAUSAR");
  });
});

describe("entrada de console: os 15 jogos", () => {
  it("todo jogo tem mapa; o triângulo abre a janela de recursos onde há o que vestir; nenhum usa botão fora dos cinco", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const mapa = mapaDoJogo(codigo, NUCLEOS[codigo].acoes);
      expect(mapa.inventario, codigo).toBe(NUCLEOS[codigo].acoes.includes("VESTIR"));
      const botoes = botoesDoJogo(mapa);
      expect(botoes.every((b) => (ACOES_ENTRADA as readonly string[]).includes(b)), codigo).toBe(true);
      expect(botoes).toContain("INTERAGIR");
      expect(botoes).toContain("PAUSAR");
    }
    expect(mapaDoJogo("FASHION_DETECTIVE", NUCLEOS.FASHION_DETECTIVE.acoes).movimento).toBe("PONTOS");
    expect(mapaDoJogo("DRESS_FIGHTER", NUCLEOS.DRESS_FIGHTER.acoes).esquiva).toBe(true);
    expect(limitar({ x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
  });
});

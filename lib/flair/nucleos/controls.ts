/**
 * Comandos do controle (tabela "Ações do personagem e comandos do controle"): teclado e Gamepad API no layout padrão
 * (https://w3c.github.io/gamepad/#remapping). Funções puras; o hook use-nucleo-controls só liga os eventos.
 */
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

export interface Comando {
  acao: NucleoAcao;
  /** direção: −1/+1 (navegar, aba, girar, zoom) */
  dir?: number;
  /** navegar: "x" (esquerda/direita) ou "y" (cima/baixo) */
  eixo?: "x" | "y";
}

const TECLAS: Record<string, Comando> = {
  ArrowLeft: { acao: "NAVEGAR", dir: -1, eixo: "x" },
  ArrowRight: { acao: "NAVEGAR", dir: 1, eixo: "x" },
  ArrowUp: { acao: "NAVEGAR", dir: -1, eixo: "y" },
  ArrowDown: { acao: "NAVEGAR", dir: 1, eixo: "y" },
  q: { acao: "TROCAR_ABA", dir: -1 },
  e: { acao: "TROCAR_ABA", dir: 1 },
  " ": { acao: "VESTIR" },
  Backspace: { acao: "TIRAR" },
  z: { acao: "GIRAR", dir: -1 },
  c: { acao: "GIRAR", dir: 1 },
  "+": { acao: "ZOOM", dir: 1 },
  "=": { acao: "ZOOM", dir: 1 },
  "-": { acao: "ZOOM", dir: -1 },
  _: { acao: "ZOOM", dir: -1 },
  p: { acao: "POSAR" },
  w: { acao: "DESFILAR" },
  Enter: { acao: "ENTREGAR" },
  o: { acao: "VER_OBJETIVO" },
};

/** Tecla → comando (letras sem diferença de maiúscula); tecla sem ação = null. */
export function comandoDaTecla(key: string): Comando | null {
  const k = key.length === 1 ? key.toLowerCase() : key;
  return TECLAS[k] ?? null;
}

/** Botões do layout padrão: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Select, 9 Start, 12–15 direcional. */
export const BOTOES: Record<number, Comando> = {
  0: { acao: "VESTIR" },
  1: { acao: "TIRAR" },
  2: { acao: "POSAR" },
  3: { acao: "DESFILAR" },
  4: { acao: "TROCAR_ABA", dir: -1 },
  5: { acao: "TROCAR_ABA", dir: 1 },
  6: { acao: "ZOOM", dir: -1 },
  7: { acao: "ZOOM", dir: 1 },
  8: { acao: "VER_OBJETIVO" },
  9: { acao: "ENTREGAR" },
  12: { acao: "NAVEGAR", dir: -1, eixo: "y" },
  13: { acao: "NAVEGAR", dir: 1, eixo: "y" },
  14: { acao: "NAVEGAR", dir: -1, eixo: "x" },
  15: { acao: "NAVEGAR", dir: 1, eixo: "x" },
};

/** Analógico direito (eixo 2): além deste limiar, gira; repete a cada GIRO_MS enquanto inclinado. */
export const LIMIAR_ANALOGICO = 0.5;
export const GIRO_MS = 180;

export interface PadEstado {
  botoes: boolean[];
  giroEm: number;
}

export const PAD_INICIAL: PadEstado = { botoes: [], giroEm: 0 };

interface PadLike {
  buttons: ReadonlyArray<{ pressed: boolean; value?: number }>;
  axes: ReadonlyArray<number>;
}

/** Lê um gamepad: comandos dos botões que acabaram de ser apertados (borda) e do analógico direito. */
export function lerGamepad(pad: PadLike, antes: PadEstado, agora: number): { comandos: Comando[]; estado: PadEstado } {
  const comandos: Comando[] = [];
  const botoes = pad.buttons.map((b) => !!b.pressed || (b.value ?? 0) > 0.5);
  botoes.forEach((apertado, i) => {
    const cmd = BOTOES[i];
    if (cmd && apertado && !antes.botoes[i]) comandos.push(cmd);
  });
  let giroEm = antes.giroEm;
  const x = pad.axes[2] ?? 0;
  if (Math.abs(x) > LIMIAR_ANALOGICO) {
    if (agora - antes.giroEm >= GIRO_MS) {
      comandos.push({ acao: "GIRAR", dir: x > 0 ? 1 : -1 });
      giroEm = agora;
    }
  } else {
    giroEm = 0;
  }
  return { comandos, estado: { botoes, giroEm } };
}

/** Botões na tela (toque/mouse): um por ação e direção, na ordem da tabela. */
export const BOTOES_TELA: { id: string; cmd: Comando }[] = [
  { id: "nav-prev", cmd: { acao: "NAVEGAR", dir: -1, eixo: "x" } },
  { id: "nav-next", cmd: { acao: "NAVEGAR", dir: 1, eixo: "x" } },
  { id: "tab-prev", cmd: { acao: "TROCAR_ABA", dir: -1 } },
  { id: "tab-next", cmd: { acao: "TROCAR_ABA", dir: 1 } },
  { id: "apply", cmd: { acao: "VESTIR" } },
  { id: "remove", cmd: { acao: "TIRAR" } },
  { id: "turn-left", cmd: { acao: "GIRAR", dir: -1 } },
  { id: "turn-right", cmd: { acao: "GIRAR", dir: 1 } },
  { id: "zoom-in", cmd: { acao: "ZOOM", dir: 1 } },
  { id: "zoom-out", cmd: { acao: "ZOOM", dir: -1 } },
  { id: "pose", cmd: { acao: "POSAR" } },
  { id: "walk", cmd: { acao: "DESFILAR" } },
  { id: "objective", cmd: { acao: "VER_OBJETIVO" } },
];

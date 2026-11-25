/**
 * Comandos do controle (padrão de console, docs/refactoring/gof/2026-11-25-entrada-console.md): teclado e Gamepad API no
 * layout padrão (https://w3c.github.io/gamepad/#remapping). Funções puras; o hook use-nucleo-controls só liga os eventos.
 */
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

export interface Comando {
  acao: NucleoAcao;
  /** direção: −1/+1 (navegar, aba, girar, zoom) */
  dir?: number;
  /** navegar: "x" (esquerda/direita) ou "y" (cima/baixo) */
  eixo?: "x" | "y";
}

/**
 * Padrão de console (lib/flair/entrada/acoes.ts): mover nas setas ou em WASD; ✕ (Espaço ou E) veste ou confirma;
 * ○ (Shift ou Backspace) tira ou volta; □ (F) é o gesto do jogo (desfilar, ou posar onde não há desfile); △ (I) troca
 * a aba das roupas; Start (Esc) abre a pausa com o objetivo; Enter entrega o look. Girar fica no analógico direito e
 * no arrasto do mouse; zoom, na roda do mouse. Teclas pela posição (KeyboardEvent.code): WASD vale em qualquer layout.
 */
const TECLAS: Record<string, Comando> = {
  ArrowLeft: { acao: "NAVEGAR", dir: -1, eixo: "x" },
  KeyA: { acao: "NAVEGAR", dir: -1, eixo: "x" },
  ArrowRight: { acao: "NAVEGAR", dir: 1, eixo: "x" },
  KeyD: { acao: "NAVEGAR", dir: 1, eixo: "x" },
  ArrowUp: { acao: "NAVEGAR", dir: -1, eixo: "y" },
  KeyW: { acao: "NAVEGAR", dir: -1, eixo: "y" },
  ArrowDown: { acao: "NAVEGAR", dir: 1, eixo: "y" },
  KeyS: { acao: "NAVEGAR", dir: 1, eixo: "y" },
  Space: { acao: "VESTIR" },
  KeyE: { acao: "VESTIR" },
  ShiftLeft: { acao: "TIRAR" },
  ShiftRight: { acao: "TIRAR" },
  Backspace: { acao: "TIRAR" },
  KeyF: { acao: "DESFILAR" },
  KeyI: { acao: "TROCAR_ABA", dir: 1 },
  Escape: { acao: "VER_OBJETIVO" },
  Enter: { acao: "ENTREGAR" },
  NumpadEnter: { acao: "ENTREGAR" },
};

/** A posição da tecla a partir do caractere, para eventos sem `code` (teclados virtuais, testes). */
export function codigoDoCaractere(key: string): string {
  if (key === " ") return "Space";
  if (key === "Shift") return "ShiftLeft";
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  return key;
}

/** Tecla → comando; tecla sem ação = null. `code` (a posição) vale sobre `key` (o caractere). */
export function comandoDaTecla(key: string, code?: string): Comando | null {
  return TECLAS[code || codigoDoCaractere(key)] ?? null;
}

/** Botões do layout padrão: 0 ✕/A, 1 ○/B, 2 □/X, 3 △/Y, 9 Start/Options, 12–15 direcional. */
export const BOTOES: Record<number, Comando> = {
  0: { acao: "VESTIR" },
  1: { acao: "TIRAR" },
  2: { acao: "DESFILAR" },
  3: { acao: "TROCAR_ABA", dir: 1 },
  9: { acao: "VER_OBJETIVO" },
  12: { acao: "NAVEGAR", dir: -1, eixo: "y" },
  13: { acao: "NAVEGAR", dir: 1, eixo: "y" },
  14: { acao: "NAVEGAR", dir: -1, eixo: "x" },
  15: { acao: "NAVEGAR", dir: 1, eixo: "x" },
};

/** Analógicos: além deste limiar, o direito gira e o esquerdo move o foco; repete a cada GIRO_MS enquanto inclinado. */
export const LIMIAR_ANALOGICO = 0.5;
export const GIRO_MS = 180;

export interface PadEstado {
  botoes: boolean[];
  giroEm: number;
  moverEm?: number;
}

export const PAD_INICIAL: PadEstado = { botoes: [], giroEm: 0 };

interface PadLike {
  buttons: ReadonlyArray<{ pressed: boolean; value?: number }>;
  axes: ReadonlyArray<number>;
}

/** Lê um gamepad: os botões que acabaram de ser apertados (borda), o analógico esquerdo (foco) e o direito (girar). */
/** `andando`: o analógico esquerdo é do corpo (jogos de andar livre), não do foco do menu. */
export function lerGamepad(pad: PadLike, antes: PadEstado, agora: number, andando = false): { comandos: Comando[]; estado: PadEstado } {
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
  let moverEm = antes.moverEm ?? 0;
  const [lx, ly] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0];
  const forte = Math.max(Math.abs(lx), Math.abs(ly));
  if (forte > LIMIAR_ANALOGICO && !andando) {
    if (agora - moverEm >= GIRO_MS) {
      comandos.push(Math.abs(lx) >= Math.abs(ly) ? { acao: "NAVEGAR", dir: lx > 0 ? 1 : -1, eixo: "x" } : { acao: "NAVEGAR", dir: ly > 0 ? 1 : -1, eixo: "y" });
      moverEm = agora;
    }
  } else {
    moverEm = 0;
  }
  return { comandos, estado: { botoes, giroEm, moverEm } };
}

/**
 * O □ é o gesto do jogo: desfilar onde há desfile, posar nos outros. Qualquer outro comando passa como veio. Puro.
 */
export function comandoDoJogo(c: Comando, acoes: readonly NucleoAcao[]): Comando {
  if (c.acao === "DESFILAR" && !acoes.includes("DESFILAR")) return { acao: "POSAR" };
  return c;
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

/**
 * Teclado para a entrada de console (acoes.ts). Usa KeyboardEvent.code (a posição da tecla), então WASD é o mesmo no
 * teclado ABNT, no americano e no AZERTY. Puro.
 */
import { limitar, type AcaoEntrada, type Vetor } from "@/lib/flair/entrada/acoes";

const ACOES: Record<string, AcaoEntrada> = {
  Space: "INTERAGIR",
  KeyE: "INTERAGIR",
  ShiftLeft: "CANCELAR",
  ShiftRight: "CANCELAR",
  Backspace: "CANCELAR",
  KeyF: "ACAO",
  KeyI: "INVENTARIO",
  Escape: "PAUSAR",
  Enter: "PAUSAR",
  NumpadEnter: "PAUSAR",
};

const DIRECOES: Record<string, Vetor> = {
  KeyW: { x: 0, y: 1 },
  ArrowUp: { x: 0, y: 1 },
  KeyS: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: -1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export function acaoDaTecla(code: string): AcaoEntrada | null {
  return ACOES[code] ?? null;
}

/** A tecla move o personagem (ou o foco, num menu)? */
export function ehDirecao(code: string): boolean {
  return code in DIRECOES;
}

/** O vetor de mover pelas teclas apertadas agora (W com S se anulam; W com D vai na diagonal, limitada a 1). */
export function vetorDasTeclas(apertadas: Iterable<string>): Vetor {
  let x = 0;
  let y = 0;
  const vistas = new Set<string>();
  for (const code of apertadas) {
    const d = DIRECOES[code];
    // W e seta para cima juntas contam uma vez só
    const chave = d ? `${d.x},${d.y}` : "";
    if (!d || vistas.has(chave)) continue;
    vistas.add(chave);
    x += d.x;
    y += d.y;
  }
  return limitar({ x, y });
}

const CAMPOS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export interface TeclaLike {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
}

/**
 * A tecla não é do jogo: atalho com Ctrl/Alt/Cmd, digitação num campo, ou Espaço/Enter num botão focado (o navegador
 * já dispara o clique dele; repetir como comando faria a ação duas vezes).
 */
export function ignorarTecla(e: TeclaLike): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey) return true;
  const alvo = e.target as HTMLElement | null;
  if (!alvo || !alvo.tagName) return false;
  if (CAMPOS.has(alvo.tagName) || alvo.isContentEditable) return true;
  const confirma = e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter";
  return confirma && (alvo.tagName === "BUTTON" || alvo.tagName === "A");
}

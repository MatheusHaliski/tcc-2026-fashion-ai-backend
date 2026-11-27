/**
 * Perfil de controles "console" da tela de jogo (pedido da dona em 27/11/2026, padrão PS5), escolhido por jogo: o
 * Fashion Detective já o usa; os outros jogos continuam no mapa de lib/flair/nucleos/controls.ts ("legado") até a
 * frente A0 migrá-los (PERFIL_POR_JOGO). Teclas pela posição (KeyboardEvent.code), menos "?", que é pelo caractere.
 *
 * | Ação | Teclado | Controle (layout padrão) |
 * | --- | --- | --- |
 * | mover | só as setas (A é mirar) | analógico esquerdo |
 * | correr | Shift segurado | L3 (botão 10) |
 * | INTERAGIR | E ou Enter | ✕ (botão 0) |
 * | MIRAR (segurar) | A | L2 (botão 6) |
 * | RODA de recursos e armas (segurar; soltar confirma) | X | □ (botão 2) |
 * | PEGAR o item em foco na roda | P | △ (botão 3) |
 * | TELA_CHEIA | F | — |
 * | FECHAR painel, roda ou ajuda | Esc | ○ (botão 1) |
 * | AJUDA (cartão de controles) | ? | Create (botão 8) |
 * | PAINEL_ESQUERDO (caso, mapa, pistas) | C | — |
 * | PAINEL_DIREITO (ações, inventário) | I | Options (botão 9) |
 * Puro.
 */
import { limitar, type Vetor } from "@/lib/flair/entrada/acoes";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

export type PerfilDeControles = "legado" | "console";

/** Qual perfil cada jogo usa; quem não está aqui fica no legado (lib/flair/nucleos/controls.ts). */
export const PERFIL_POR_JOGO: Partial<Record<NucleoCodigo, PerfilDeControles>> = { FASHION_DETECTIVE: "console" };

export function perfilDoJogo(codigo: NucleoCodigo): PerfilDeControles {
  return PERFIL_POR_JOGO[codigo] ?? "legado";
}

export const ACOES_CONSOLE = ["INTERAGIR", "MIRAR", "RODA", "PEGAR", "TELA_CHEIA", "FECHAR", "AJUDA", "PAINEL_ESQUERDO", "PAINEL_DIREITO"] as const;
export type AcaoConsole = (typeof ACOES_CONSOLE)[number];

/** As ações que valem enquanto a tecla está segurada (o hook avisa também quando ela sobe). */
export const SEGURADAS: ReadonlySet<AcaoConsole> = new Set(["MIRAR", "RODA"]);

const TECLAS: Record<string, AcaoConsole> = {
  KeyE: "INTERAGIR",
  Enter: "INTERAGIR",
  NumpadEnter: "INTERAGIR",
  KeyA: "MIRAR",
  KeyX: "RODA",
  KeyP: "PEGAR",
  KeyF: "TELA_CHEIA",
  Escape: "FECHAR",
  KeyC: "PAINEL_ESQUERDO",
  KeyI: "PAINEL_DIREITO",
};

/** Os botões do controle no layout padrão (https://w3c.github.io/gamepad/#remapping). */
export const BOTOES_CONSOLE: Record<number, AcaoConsole> = { 0: "INTERAGIR", 1: "FECHAR", 2: "RODA", 3: "PEGAR", 6: "MIRAR", 8: "AJUDA", 9: "PAINEL_DIREITO" };
export const BOTAO_CORRER = 10;

const SETAS: Record<string, Vetor> = {
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** A ação do perfil console para a tecla (code pela posição; key só para "?"), ou nula. */
export function acaoDoConsole(code: string, key = ""): AcaoConsole | null {
  if (key === "?") return "AJUDA";
  return TECLAS[code] ?? null;
}

export function ehSeta(code: string): boolean {
  return code in SETAS;
}

export function ehCorrer(code: string): boolean {
  return code === "ShiftLeft" || code === "ShiftRight";
}

/** O vetor de andar pelas setas seguradas (cima com baixo se anulam; a diagonal fica limitada a 1). */
export function vetorDasSetas(apertadas: Iterable<string>): Vetor {
  let x = 0;
  let y = 0;
  for (const code of new Set(apertadas)) {
    const d = SETAS[code];
    if (!d) continue;
    x += d.x;
    y += d.y;
  }
  return limitar({ x, y });
}

/** O cartão de ajuda (tecla ?): o que cada tecla faz, na ordem em que aparece. A chave do texto é da ação. */
export const AJUDA_DO_CONSOLE: readonly { teclas: string[]; acao: string }[] = [
  { teclas: ["↑", "↓", "←", "→"], acao: "MOVER" },
  { teclas: ["Shift"], acao: "CORRER" },
  { teclas: ["E"], acao: "INTERAGIR" },
  { teclas: ["A"], acao: "MIRAR" },
  { teclas: ["X"], acao: "RODA" },
  { teclas: ["P"], acao: "PEGAR" },
  { teclas: ["F"], acao: "TELA_CHEIA" },
  { teclas: ["Esc"], acao: "FECHAR" },
  { teclas: ["C", "I"], acao: "PAINEIS" },
  { teclas: ["?"], acao: "AJUDA" },
];

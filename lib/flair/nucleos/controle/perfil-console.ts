/**
 * Perfil de controles "console" da tela de jogo (pedido da dona em 27/11/2026, padrão PS5), escolhido por jogo: o
 * Fashion Detective já o usa; os outros jogos continuam no mapa de lib/flair/nucleos/controls.ts ("legado") até a
 * frente A0 migrá-los (PERFIL_POR_JOGO). Teclas pela posição (KeyboardEvent.code), menos "?", que é pelo caractere.
 *
 * | Ação | Teclado | Controle (layout padrão) |
 * | --- | --- | --- |
 * | mover | só as setas (A é mirar) | analógico esquerdo |
 * | correr | Shift segurado | L3 (botão 10) |
 * | INTERAGIR (abrir porta, gaveta, armário; coletar) | E ou Enter | ✕ (botão 0) |
 * | MIRAR (segurar: retícula e câmera por cima do ombro) | A | L2 (botão 6) |
 * | DISPARAR (mirando: a arma equipada; sem mirar: golpe corpo a corpo) | F | R2 (botão 7) |
 * | RODA de recursos e armas (segurar; soltar confirma) | X | L1 (botão 4) |
 * | PEGAR (equipar) o item em foco na roda | P | △ (botão 3) |
 * | RECARREGAR | R | □ (botão 2) |
 * | TELA_CHEIA | T | — |
 * | PAUSA (fecha o que estiver aberto antes) | Esc | ○ (botão 1) ou Options (botão 9) |
 * | AJUDA (cartão de controles) | ? | Create (botão 8) |
 * | PAINEL_ESQUERDO e PAINEL_DIREITO | C e I | — |
 * Puro.
 */
import { limitar, type Vetor } from "@/lib/flair/entrada/acoes";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

export type PerfilDeControles = "legado" | "console";

/** Qual perfil cada jogo usa; quem não está aqui fica no legado (lib/flair/nucleos/controls.ts). */
export const PERFIL_POR_JOGO: Partial<Record<NucleoCodigo, PerfilDeControles>> = {
  FASHION_DETECTIVE: "console",
  // rodada zonas: a fase de uso dos quatro jogos de zonas (components/flair/nucleos/use-console-da-fase-de-uso.ts)
  CLUBE_CORACAO: "console",
  FAVORITE_SINGER: "console",
  PILOTO_FAVORITO: "console",
  SUPER_HEROI: "console",
};

export function perfilDoJogo(codigo: NucleoCodigo): PerfilDeControles {
  return PERFIL_POR_JOGO[codigo] ?? "legado";
}

export const ACOES_CONSOLE = ["INTERAGIR", "MIRAR", "DISPARAR", "RODA", "PEGAR", "RECARREGAR", "TELA_CHEIA", "PAUSA", "AJUDA", "PAINEL_ESQUERDO", "PAINEL_DIREITO"] as const;
export type AcaoConsole = (typeof ACOES_CONSOLE)[number];

/** As ações que valem enquanto a tecla está segurada (o hook avisa também quando ela sobe). */
export const SEGURADAS: ReadonlySet<AcaoConsole> = new Set(["MIRAR", "RODA"]);

const TECLAS: Record<string, AcaoConsole> = {
  KeyE: "INTERAGIR",
  Enter: "INTERAGIR",
  NumpadEnter: "INTERAGIR",
  KeyA: "MIRAR",
  KeyF: "DISPARAR",
  KeyX: "RODA",
  KeyP: "PEGAR",
  KeyR: "RECARREGAR",
  KeyT: "TELA_CHEIA",
  Escape: "PAUSA",
  KeyC: "PAINEL_ESQUERDO",
  KeyI: "PAINEL_DIREITO",
};

/** Os botões do controle no layout padrão (https://w3c.github.io/gamepad/#remapping). */
export const BOTOES_CONSOLE: Record<number, AcaoConsole> = { 0: "INTERAGIR", 1: "PAUSA", 2: "RECARREGAR", 3: "PEGAR", 4: "RODA", 6: "MIRAR", 7: "DISPARAR", 8: "AJUDA", 9: "PAUSA" };
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
  { teclas: ["F"], acao: "DISPARAR" },
  { teclas: ["X"], acao: "RODA" },
  { teclas: ["P"], acao: "PEGAR" },
  { teclas: ["R"], acao: "RECARREGAR" },
  { teclas: ["T"], acao: "TELA_CHEIA" },
  { teclas: ["Esc"], acao: "PAUSA" },
  { teclas: ["C", "I"], acao: "PAINEIS" },
  { teclas: ["?"], acao: "AJUDA" },
];

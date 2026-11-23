/**
 * O elenco reage à acusação na passarela (auditoria dos jogos: "ninguém reage à acusação na cena"). Quem decide o
 * desfecho é o servidor: aqui só se lê o que ele já mandou no retrato, o final ({@code final}) e a cutscene do álibi
 * ("ALIBI:<número>"), e se escolhe o movimento de cada pessoa. O culpado só aparece na reação depois do final, quando
 * a legenda da cutscene já o disse; no álibi, Bento reage como qualquer um do salão. Sem violência. Puro.
 */
import type { Motion } from "@/lib/avatar3d/human/locomotion-model";
import { ELENCO_DAS_SALAS } from "@/lib/flair/detetive/elenco";
import type { Retrato } from "@/lib/flair/detetive/types";
import type { Gesto } from "@/lib/flair/nucleos/gente/gestos";

/** O papel (roupa e corpo) de cada suspeito do quadro da acusação, pelo número do elenco. */
export const PAPEL_DO_SUSPEITO: Record<number, string> = { 2: "BENTO", 3: "CLEO", 4: "RAFA", 5: "DALIA", 6: "OTTO", 7: "NINA", 8: "TEO", 9: "LIA" };

/** Onde o suspeito acusado por engano fica na passarela enquanto mostra o álibi: entre Iolanda e Bento, de frente. */
const LUGAR_DO_ACUSADO: [number, number, number] = [0.1, -3.1, 0];

export interface PessoaDaCena {
  papel: string;
  x: number;
  z: number;
  /** giro em graus */
  giro: number;
  anim: Motion;
  gesto?: Gesto;
}

type Reacao = Pick<PessoaDaCena, "anim" | "gesto">;
const PARADA: Reacao = { anim: "idle" };

/** O que cada pessoa da passarela faz em cada final (quem não está na lista continua parada). */
const NO_FINAL: Record<NonNullable<Retrato["final"]>, Record<string, Reacao>> = {
  // culpado certo, com provas: Iolanda comemora, Bento baixa a cabeça
  COMPLETO: { IOLANDA: { anim: "cheer" }, BENTO: { anim: "idle", gesto: "lamentar" } },
  // culpado certo, com poucas provas: Bento nega e recua, Iolanda lamenta
  PARCIAL: { IOLANDA: { anim: "idle", gesto: "lamentar" }, BENTO: { anim: "idle", gesto: "recuar" } },
  // segunda acusação errada: Iolanda aponta quem foi, Bento baixa a cabeça
  ERRADO_REVELA: { IOLANDA: { anim: "point" }, BENTO: { anim: "idle", gesto: "lamentar" } },
};

/** O número do suspeito do álibi em cena ("ALIBI:4" → 4), ou nulo. */
export function acusadoDoAlibi(cutscene: string | null | undefined): number | null {
  const m = /^ALIBI:(\d+)$/.exec(cutscene ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * As pessoas do elenco na sala, com a reação à acusação: no final, pelo desfecho; na primeira acusação errada, o
 * acusado entra em cena explicando o álibi (fala, com as mãos à frente), Iolanda pensa e os outros olham em volta.
 * Fora da passarela, ou antes de qualquer acusação, todos ficam parados como antes.
 */
export function elencoDaCena(r: Pick<Retrato, "sala" | "final" | "cutscene">): PessoaDaCena[] {
  const base = (ELENCO_DAS_SALAS[r.sala] ?? []).map(([papel, x, z, giro]): PessoaDaCena => ({ papel, x, z, giro, ...PARADA }));
  if (r.sala !== "PASSARELA") return base;
  if (r.final) {
    const reacoes = NO_FINAL[r.final] ?? {};
    return base.map((p) => ({ ...p, ...(reacoes[p.papel] ?? PARADA) }));
  }
  const papel = PAPEL_DO_SUSPEITO[acusadoDoAlibi(r.cutscene) ?? 0];
  if (!papel) return base;
  const reagindo = base
    .filter((p) => p.papel !== papel)
    .map((p): PessoaDaCena => ({ ...p, ...(p.papel === "IOLANDA" ? { anim: "idle", gesto: "pensar" } : { anim: "look" }) }));
  const [x, z, giro] = LUGAR_DO_ACUSADO;
  return [...reagindo, { papel, x, z, giro, anim: "talk", gesto: "defender" }];
}

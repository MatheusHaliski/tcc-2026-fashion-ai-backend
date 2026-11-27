/**
 * Movimento de ambiente de cada jogo (giro lento do manequim, torcida acenando, luz de palco, capa ao vento): laços
 * que rodam enquanto a sala está aberta. Com "reduzir movimento", o ambiente fica parado.
 */
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import { ANIMACOES } from "@/lib/flair/nucleos/scene/animations";
import { amostrar, type Amostra } from "@/lib/flair/nucleos/scene/clips";
import { clipDe } from "@/lib/flair/nucleos/scene/clips/index";

/** O ambiente vale para o ator? ("fig:TORCIDA:*" vale para toda a torcida) */
function valePara(alvo: string, ator: string): boolean {
  if (alvo === ator) return true;
  return alvo.endsWith(":*") && ator.startsWith(alvo.slice(0, -1));
}

/** Defasagem estável por ator, para a torcida não acenar toda no mesmo instante. */
function defasagem(ator: string): number {
  let h = 0;
  for (const ch of ator) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 40) / 10;
}

export function amostraDeAmbiente(codigo: NucleoCodigo, ator: string, agora: number, reduzido: boolean): Amostra {
  const out: Amostra = {};
  if (reduzido) return out;
  for (const a of ANIMACOES[codigo].ambiente) {
    if (!valePara(a.ator, ator)) continue;
    if (a.giro) out["raiz.ry"] = (out["raiz.ry"] ?? 0) + ((a.giro * agora) % 360);
    if (!a.clip) continue;
    const c = clipDe(a.clip);
    const amostra = amostrar(c, (agora + defasagem(ator)) % c.duracao);
    for (const k of Object.keys(amostra)) out[k] = (out[k] ?? 0) + amostra[k];
  }
  return out;
}

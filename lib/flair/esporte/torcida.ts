/**
 * O que a torcida e os bancos do Fashion Sports fazem por causa do jogo (auditoria dos jogos, mudança 5: as pessoas de
 * cena reagem ao desfecho de verdade): o ponto do time da casa levanta a arquibancada, o ponto sofrido e a bola na
 * trave a fazem lamentar, e no apito final ela comemora a vitória, aplaude o empate ou lamenta a derrota. O banco do
 * visitante reage ao contrário. Só lê o lance e o placar que o servidor mandou. Puro.
 */
import { CHEGADA_AO_GOL, gol, naTrave } from "@/lib/flair/esporte/bola";
import { desfechoDoPlacar } from "@/lib/flair/esporte/momentos";
import type { Jogada, Lado } from "@/lib/flair/esporte/types";
import type { HumorDaTorcida } from "@/lib/flair/nucleos/gente/torcida";
import type { Qualidade } from "@/lib/flair/nucleos/scene/qualidade";

/**
 * Quantos jogadores têm o corpo inteiro ao mesmo tempo na transmissão, pela qualidade da cena: todos na alta; na média
 * e na baixa, os mais perto da câmera (quem está na jogada entra sempre); os outros ficam de corpo leve, que corre junto.
 */
export const CORPOS_DA_TRANSMISSAO: Record<Qualidade, number> = { ALTA: Infinity, MEDIA: 6, BAIXA: 2 };

const DO_DESFECHO = { VITORIA: "comemora", EMPATE: "aplaude", DERROTA: "lamenta" } as const;

/** O humor da torcida da casa no instante `k` (0 a 1) do lance da vez; `fim`: a partida fechou. */
export function humorDaTorcida(lance: Jogada | null, k: number, fim: boolean): HumorDaTorcida | null {
  if (fim) return { reacao: DO_DESFECHO[desfechoDoPlacar(lance?.placar)], chave: "fim" };
  if (!lance || k < CHEGADA_AO_GOL) return null;
  if (gol(lance.tipo)) return { reacao: lance.time === "NOS" ? "comemora" : "lamenta", chave: `lance-${lance.n}` };
  // a bola na trave do adversário: o "uuuh" da arquibancada
  if (naTrave(lance.tipo) && lance.time === "NOS") return { reacao: "lamenta", chave: `lance-${lance.n}` };
  return null;
}

/** O mesmo momento visto pelo outro lado (o banco do visitante): comemora o que a casa lamenta. */
export function humorDoLado(humor: HumorDaTorcida | null, lado: Lado): HumorDaTorcida | null {
  if (!humor || lado === "NOS" || humor.reacao === "aplaude") return humor;
  return { ...humor, reacao: humor.reacao === "comemora" ? "lamenta" : "comemora" };
}

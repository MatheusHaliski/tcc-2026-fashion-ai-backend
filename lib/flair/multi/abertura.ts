/**
 * Ponto de extensão da abertura da partida na tela do jogo (use-nucleo-match): solo, pela rota do núcleo; numa sala
 * com a mesma semente, pela sala (o servidor usa a semente e a rodada dela e ignora a rodada da tela).
 */
import { abrirPartidaDaSala } from "@/lib/flair/multi/api";
import { abrirPartida } from "@/lib/flair/nucleos/api";
import type { AvatarTipo, NucleoCodigo, NucleoPartida } from "@/lib/flair/nucleos/types";

export type Abridor = (deck: string[], avatar: AvatarTipo | null, rodada: string | null) => Promise<NucleoPartida>;

export function abridorDaPartida(codigo: NucleoCodigo, salaId?: string | null): Abridor {
  if (salaId) return (deck, avatar) => abrirPartidaDaSala(salaId, deck, avatar);
  return (deck, avatar, rodada) => abrirPartida(codigo, deck, avatar, rodada);
}

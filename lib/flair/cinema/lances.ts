/**
 * A cutscene do meio da partida nos jogos de zonas (rodada zonas): o momento-chave da fase de uso (o pênalti, a virada
 * da música, o pit stop, a ameaça) ganha uma tomada própria assim que a escolha é conferida — a câmera do lance, que
 * mostra quem assiste reagindo ao desfecho (a torcida canta ou segura o grito, a plateia acende ou silencia, a equipe
 * comemora ou corre, a cidade acende ou se esconde). Gatilho VIRADA: no máximo 4 s, sempre pulável, e o prazo da fase
 * fica parado enquanto ela toca (use-execucao-do-desfile.ts). Puro.
 */
import type { Cutscene, Enquadramento, Tomada } from "@/lib/flair/cinema/types";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

const e = (dist: number, altura: number, angulo: number, mira: number): Enquadramento => ({ dist, altura, angulo, mira });

/** A linguagem de câmera do lance de cada jogo: a tomada do gesto e a de quem reage. */
const TOMADAS: Partial<Record<NucleoCodigo, (fala: string) => Tomada[]>> = {
  // o chute visto de trás da personagem, para o gol, e a grua que sobe para a arquibancada
  CLUBE_CORACAO: (fala) => [
    { duracaoS: 1.6, de: e(2.4, 1.1, 165, 1.2), movimento: "FIXA", fala },
    { duracaoS: 2, de: e(3.4, 1.6, 70, 1.3), ate: e(4.8, 3.6, 90, 1.6), movimento: "GRUA" },
  ],
  // o close de baixo na virada do figurino e o travelling que mostra a plateia
  FAVORITE_SINGER: (fala) => [
    { duracaoS: 1.6, de: e(2, 0.6, 0, 1.6), ate: e(1.6, 0.7, 0, 1.6), movimento: "ZOOM", fala },
    { duracaoS: 2, de: e(3.2, 1.6, -40, 1.3), ate: e(3.2, 1.6, 40, 1.3), movimento: "TRAVELLING" },
  ],
  // a câmera baixa do box, de lado, e a órbita até a equipe
  PILOTO_FAVORITO: (fala) => [
    { duracaoS: 1.6, de: e(2.2, 0.5, 90, 0.9), movimento: "FIXA", fala },
    { duracaoS: 2, de: e(3.4, 1.4, 90, 1.2), ate: e(3.4, 1.4, 20, 1.2), movimento: "ORBITA" },
  ],
  // o contra-plongée heroico e a grua que mostra a cidade
  SUPER_HEROI: (fala) => [
    { duracaoS: 1.6, de: e(2.2, 0.4, -20, 1.7), movimento: "FIXA", fala },
    { duracaoS: 2, de: e(2.8, 1.2, 10, 1.5), ate: e(4.2, 3.8, 0, 1.2), movimento: "GRUA" },
  ],
};

/** A cutscene do desfecho do momento-chave, ou nula fora dos jogos de zonas. */
export function cutsceneDoLance(jogo: NucleoCodigo, certa: boolean): Cutscene | null {
  const tomadas = TOMADAS[jogo];
  if (!tomadas) return null;
  return { id: `${jogo}.VIRADA.${certa ? "CERTA" : "ERRADA"}`, jogo, gatilho: "VIRADA", tomadas: tomadas(`flair3d.uso.cena.${jogo}.${certa ? "CERTA" : "ERRADA"}`) };
}

export const JOGOS_COM_LANCE = Object.keys(TOMADAS) as NucleoCodigo[];

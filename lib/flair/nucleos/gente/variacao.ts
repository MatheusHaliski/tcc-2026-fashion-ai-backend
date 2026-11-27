/**
 * Variação entre as pessoas de cena (auditoria dos jogos, mudança 5): numa reação de grupo ("a plateia aplaude", "a
 * torcida comemora") cada pessoa começa num instante próprio, com a força e o ritmo dela, para a plateia não parecer um
 * bloco de bonecos sincronizados. Tudo sai do id da pessoa (o mesmo id, a mesma variação): nada é sorteado a cada quadro.
 * Quem reage sozinho por roteiro (a cliente, a oponente, a estrela) não atrasa. Puro.
 */
import { sorteio } from "@/lib/flair/nucleos/gente/elenco";
import type { Reacao } from "@/lib/flair/nucleos/gente/reacoes";

export interface Variacao {
  /** quanto depois do começo do passo a pessoa reage (segundos) */
  atraso: number;
  /** força da reação: 0,55 (contida) a 1 (inteira) */
  intensidade: number;
  /** ritmo do gesto (palmas, aceno): 0,85 a 1,15 do normal */
  ritmo: number;
}

/** O maior atraso de uma reação de grupo: a onda atravessa a plateia em menos de um segundo. */
export const ATRASO_MAXIMO = 0.9;
export const INTENSIDADE_MINIMA = 0.55;
/** Abaixo desta força a pessoa não pula nem ergue os braços: aplaude de pé. */
export const FORCA_PARA_COMEMORAR = 0.7;

export const SEM_VARIACAO: Variacao = { atraso: 0, intensidade: 1, ritmo: 1 };

export function variacaoDoAtor(id: string, semente = 1): Variacao {
  return {
    atraso: Math.round(sorteio(semente, `${id}:atraso`) * ATRASO_MAXIMO * 100) / 100,
    intensidade: Math.round((INTENSIDADE_MINIMA + (1 - INTENSIDADE_MINIMA) * sorteio(semente, `${id}:forca`)) * 100) / 100,
    ritmo: Math.round((0.85 + 0.3 * sorteio(semente, `${id}:ritmo`)) * 100) / 100,
  };
}

/**
 * A reação de uma pessoa do grupo: quem tem pouca força troca a comemoração por palmas de pé (a plateia se levanta, mas
 * nem todos pulam). As outras reações valem para todos; a força muda só o tamanho do gesto.
 */
export function reacaoComVariacao(r: Reacao, v: Variacao): Reacao {
  if (r.anim === "cheer" && v.intensidade < FORCA_PARA_COMEMORAR) return { anim: "idle", gesto: "aplaudir" };
  return r;
}

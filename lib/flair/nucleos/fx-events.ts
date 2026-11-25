/**
 * Eventos dos efeitos da partida (Observer): a tela de jogo publica o que acontece com as cartas e a cena 3D pode
 * assinar para desenhar o mesmo efeito por dentro do cenário (luz atrás do avatar, LED da passarela, espelho). Puro e
 * sem React: quem assina recebe só dados que o servidor já calculou; nenhum assinante muda a nota.
 */
import type { EntradaFx } from "@/lib/flair/nucleos/card-fx";
import type { PassoAcao } from "@/lib/flair/nucleos/action-fx";
import type { AcionamentoTipo, Momento } from "@/lib/flair/nucleos/moments";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";
import type { Cutscene } from "@/lib/flair/cinema/types";

export type FxEvento =
  /** a partida mudou de momento (deck, preparação, ação, resultado) */
  | { tipo: "momento"; nucleo: NucleoCodigo; momento: Momento }
  /** uma carta foi vestida na preparação: clarão na cor do nível, selo e Aura Hype */
  | { tipo: "entrada"; nucleo: NucleoCodigo; entrada: EntradaFx; reduzido: boolean; /** efeitos de luz ligados nas preferências */ efeitos?: boolean }
  /** um passo da ação, na ordem do resultado do servidor (regra cumprida, round, placar...) */
  | { tipo: "acao-passo"; nucleo: NucleoCodigo; passo: PassoAcao; indice: number; total: number }
  /** a ação terminou: resultado e estrelas do servidor */
  | { tipo: "acao-fim"; nucleo: NucleoCodigo; resultado: string; estrelas: number }
  /** a pessoa acionou o que o jogo permite (carta Especial, espelho, troca no intervalo, resposta) */
  | { tipo: "acionamento"; nucleo: NucleoCodigo; acionamento: AcionamentoTipo; cardId?: string }
  /** uma cutscene começou (a câmera da cena segue as tomadas dela) ou acabou (cutscene nula: a câmera volta ao jogo) */
  | { tipo: "cinema"; nucleo: NucleoCodigo; cutscene: Cutscene | null; reduzido: boolean }
  /** desfile jogável: quantas marcas a personagem já alcançou e se está na ponta (a pose final liberada) */
  | { tipo: "desfile"; nucleo: NucleoCodigo; alcancadas: number; total: number; naPonta: boolean }
  /** a pessoa apertou □ na ação do desfile; e o fim da pose final, que revela o resultado */
  | { tipo: "desfile-pose"; nucleo: NucleoCodigo }
  | { tipo: "desfile-fim"; nucleo: NucleoCodigo }
  /** um dos quatro botões na ação do desfile (✕ ○ □ △): a resposta à deixa da execução ou, sem deixa, □ faz a pose final */
  | { tipo: "desfile-botao"; nucleo: NucleoCodigo; botao: "VESTIR" | "TIRAR" | "DESFILAR" | "TROCAR_ABA" };

export type FxAssinante = (evento: FxEvento) => void;

const assinantes = new Set<FxAssinante>();

/** Assina os efeitos; devolve a função que cancela a assinatura. */
export function assinarFx(assinante: FxAssinante): () => void {
  assinantes.add(assinante);
  return () => {
    assinantes.delete(assinante);
  };
}

/** Publica um efeito para todos os assinantes; a falha de um não derruba a tela nem os outros. */
export function emitirFx(evento: FxEvento): void {
  for (const assinante of Array.from(assinantes)) {
    try {
      assinante(evento);
    } catch {
      // assinante com erro fica sem o evento; os demais seguem
    }
  }
}

/** Quantos assinantes há (para testes e diagnóstico). */
export function assinantesFx(): number {
  return assinantes.size;
}

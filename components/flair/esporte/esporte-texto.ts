/**
 * Textos do Fashion Sports: a narração de cada lance ("12' Passe de Lia para Caio"), a situação da jogada da vez, o
 * nome dos times e dos jogadores (inventados; nenhum clube ou atleta real) e o resumo final. A modalidade pode ter a
 * sua frase (flair3d.esporte.<MODALIDADE>.lance.<TIPO>); sem ela, vale a frase comum a todos os esportes.
 */
import type { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { Jogada, Lado, Resumo, Situacao } from "@/lib/flair/esporte/types";

type Texto = ReturnType<typeof useNucleoText>;

export function nomeDoTime(tx: Texto, lado: Lado): string {
  return tx.t(`flair3d.esporte.time.${lado}`);
}

export function nomeDoJogador(tx: Texto, lado: Lado, n: number): string {
  return tx.ou(`flair3d.esporte.nome.${lado}.${n}`, tx.t("flair3d.esporte.nome.outro", { n }));
}

/** A ação da cor da carta com a palavra da modalidade (drible, crossover, deixadinha...). */
export function nomeDaAcao(tx: Texto, modalidade: string, acao: string): string {
  return tx.ou(`flair3d.ui.acaoCor.${modalidade}.${acao}`, tx.ou(`flair3d.ui.acaoCor.${acao}`, tx.t("flair3d.esporte.acao.TOQUE")));
}

/** A narração do lance, com o minuto do relógio na frente. */
export function narracao(tx: Texto, modalidade: string, j: Jogada): string {
  const outro: Lado = j.time === "NOS" ? "ELES" : "NOS";
  const vars = { jogador: nomeDoJogador(tx, j.time, j.jogador), alvo: nomeDoJogador(tx, j.time, j.alvo), rival: nomeDoTime(tx, outro), time: nomeDoTime(tx, j.time) };
  const comum = tx.ou(`flair3d.esporte.lance.${j.tipo}`, tx.t("flair3d.esporte.lance.OUTRO"), vars);
  const frase = tx.ou(`flair3d.esporte.${modalidade}.lance.${j.tipo}`, comum, vars);
  return tx.t("flair3d.esporte.minuto", { min: Math.floor(j.relogio / 60), frase });
}

/** A situação da jogada da vez em uma frase: quem tem a bola, onde, e o que isso pede. */
export function situacaoEmTexto(tx: Texto, s: Situacao): string {
  const base = tx.t(`flair3d.esporte.situacao.${s.posse}.${s.zona}`);
  return s.goleiroPronto ? `${base} ${tx.t("flair3d.esporte.situacao.goleiroPronto")}` : base;
}

/** O resumo final em linhas: posse, finalizações, defesas, desarmes, passes e jogadas com carta. */
export function linhasDoResumo(tx: Texto, r: Resumo): string[] {
  return [
    tx.t("flair3d.esporte.resumo.posse", { nos: r.posse[0], eles: r.posse[1] }),
    tx.t("flair3d.esporte.resumo.chutes", { nos: r.chutes[0], noGol: r.noGol[0], eles: r.chutes[1], noGolDeles: r.noGol[1] }),
    tx.t("flair3d.esporte.resumo.defesas", { nos: r.defesas[0], eles: r.defesas[1] }),
    tx.t("flair3d.esporte.resumo.desarmes", { nos: r.desarmes[0], eles: r.desarmes[1] }),
    tx.t("flair3d.esporte.resumo.passes", { certos: r.passes[0], total: r.passes[1] }),
    tx.t("flair3d.esporte.resumo.cartas", { n: r.cartas }),
  ];
}

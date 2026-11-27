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

/** O tipo do lance para a narração: o passe que saiu pela lateral e a bola no travessão têm a sua frase. */
function tipoNarrado(j: Jogada): string {
  if (j.saiu) return "PASSE_FORA";
  return j.bateu === "TRAVESSAO" ? j.tipo.replace("NA_TRAVE", "NO_TRAVESSAO") : j.tipo;
}

/** O que o jogador está fazendo no lance, em palavras ("Lia (Seu time): dá apoio ao lado da bola"). */
export function jogadorEmTexto(tx: Texto, lado: Lado, n: number, estado: string | undefined): string {
  const nome = nomeDoJogador(tx, lado, n);
  return estado ? tx.t("flair3d.esporte.jogador", { nome, time: nomeDoTime(tx, lado), estado: tx.ou(`flair3d.esporte.estado.${estado}`, estado) }) : nome;
}

/** A narração do lance, com o minuto do relógio na frente. */
export function narracao(tx: Texto, modalidade: string, j: Jogada): string {
  const outro: Lado = j.time === "NOS" ? "ELES" : "NOS";
  const vars = { jogador: nomeDoJogador(tx, j.time, j.jogador), alvo: nomeDoJogador(tx, j.time, j.alvo), rival: nomeDoTime(tx, outro), time: nomeDoTime(tx, j.time) };
  const tipo = tipoNarrado(j);
  const comum = tx.ou(`flair3d.esporte.lance.${tipo}`, tx.t("flair3d.esporte.lance.OUTRO"), vars);
  const frase = tx.ou(`flair3d.esporte.${modalidade}.lance.${tipo}`, comum, vars);
  return tx.t("flair3d.esporte.minuto", { min: Math.floor(j.relogio / 60), frase });
}

/** O texto da modalidade (flair3d.esporte.<MODALIDADE>.<chave>), ou o do futebol de 5 quando ela não tem o seu. */
function daModalidade(tx: Texto, modalidade: string, chave: string, vars?: Record<string, string | number>): string {
  return tx.ou(`flair3d.esporte.${modalidade}.${chave}`, tx.t(`flair3d.esporte.${chave}`, vars), vars);
}

/** A situação da jogada da vez em uma frase, nas palavras da modalidade: quem tem a bola, onde, e o que isso pede. */
export function situacaoEmTexto(tx: Texto, s: Situacao, modalidade = "FUTEBOL"): string {
  const base = daModalidade(tx, modalidade, `situacao.${s.posse}.${s.zona}`);
  return s.goleiroPronto ? `${base} ${daModalidade(tx, modalidade, "situacao.goleiroPronto")}` : base;
}

/** O nome do tempo da partida: "2º tempo" no futebol e no basquete, "2º set" no vôlei e no tênis. */
export function tempoEmTexto(tx: Texto, modalidade: string, n: number): string {
  return daModalidade(tx, modalidade, "tempo", { n });
}

/** O resumo final em linhas, nas palavras da modalidade: posse, finalizações, defesas, desarmes, passes e cartas. */
export function linhasDoResumo(tx: Texto, r: Resumo, modalidade = "FUTEBOL"): string[] {
  return [
    tx.t("flair3d.esporte.resumo.posse", { nos: r.posse[0], eles: r.posse[1] }),
    daModalidade(tx, modalidade, "resumo.chutes", { nos: r.chutes[0], noGol: r.noGol[0], eles: r.chutes[1], noGolDeles: r.noGol[1] }),
    daModalidade(tx, modalidade, "resumo.defesas", { nos: r.defesas[0], eles: r.defesas[1] }),
    daModalidade(tx, modalidade, "resumo.desarmes", { nos: r.desarmes[0], eles: r.desarmes[1] }),
    daModalidade(tx, modalidade, "resumo.passes", { certos: r.passes[0], total: r.passes[1] }),
    tx.t("flair3d.esporte.resumo.cartas", { n: r.cartas }),
  ];
}

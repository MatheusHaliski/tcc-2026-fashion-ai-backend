/**
 * Textos das rodadas e das etapas (catálogos de i18n): o nome e o objetivo de cada rodada
 * (flair3d.rodada.<JOGO>.<RODADA>.*), o nome e a descrição de cada etapa ou do que o jogo revela ao entrar
 * (flair3d.etapa.<CODIGO>.*: a cliente, a região, o espelho, o tema, a estrela, a cena, o desafio) e as regras comuns a
 * mais de um jogo (flair3d.regra.<REGRA>). Puro: recebe o tradutor da tela. Código sem frase vira letras comuns, nunca
 * um código cru.
 */
export type Ou = (key: string, fallback: string, vars?: Record<string, string | number>) => string;

/** Código cru em letras comuns ("TEMA_NOITE" → "Tema noite"), para o que ainda não tem frase própria. */
export function legivel(codigo: string): string {
  return codigo.charAt(0) + codigo.slice(1).toLowerCase().replace(/_/g, " ");
}

export function nomeDaRodada(ou: Ou, nucleo: string, rodada: string): string {
  return ou(`flair3d.rodada.${nucleo}.${rodada}.name`, legivel(rodada));
}

/** O objetivo da rodada em uma linha; sem frase própria, o objetivo do jogo. */
export function objetivoDaRodada(ou: Ou, nucleo: string, rodada: string, doJogo: string): string {
  return ou(`flair3d.rodada.${nucleo}.${rodada}.objective`, doJogo);
}

export function nomeDaEtapa(ou: Ou, codigo: string): string {
  const numerada = /^(ESPELHO|MANEQUIM)_(\d+)$/.exec(codigo);
  if (numerada) return ou(`flair3d.etapa.${numerada[1]}.name`, legivel(codigo), { n: Number(numerada[2]) });
  return ou(`flair3d.etapa.${codigo}.name`, legivel(codigo));
}

/** A descrição da etapa (o pedido da cliente, o clima e a estética da região, as pistas da cena); sem frase, vazio. */
export function textoDaEtapa(ou: Ou, codigo: string): string {
  const numerada = /^(ESPELHO|MANEQUIM)_(\d+)$/.exec(codigo);
  if (numerada) return ou(`flair3d.etapa.${codigo}.text`, ou(`flair3d.etapa.${numerada[1]}.text`, "", { n: Number(numerada[2]) }));
  return ou(`flair3d.etapa.${codigo}.text`, "");
}

/** O texto de uma regra que não é só de um jogo: a frase comum ou, nas rodadas em etapas, o nome da etapa. */
export function regraComum(ou: Ou, regra: string): string {
  const sem = "\u0000";
  const comum = ou(`flair3d.regra.${regra}`, sem);
  if (comum !== sem) return comum;
  const etapa = nomeDaEtapa(ou, regra);
  return etapa;
}

/** Códigos que chegam como valor de um evento (o tema, a estrela, o desafio) viram o nome que a tela mostra. */
export function nomeDoValor(ou: Ou, valor: string): string {
  const sem = "\u0000";
  const nome = ou(`flair3d.etapa.${valor}.name`, sem);
  if (nome !== sem) return nome;
  return ou(`flair3d.opcao.${valor}`, valor);
}

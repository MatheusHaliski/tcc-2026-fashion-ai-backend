/**
 * O look na tela a partir dos perfis que o servidor mandou para cada carta: a mesma conta de
 * Flair3dRecursoCalculo.doLook (neutro mais a média dos deltas das peças vestidas, de 0 a 100), para a roda reagir na
 * hora em que a peça é vestida, sem esperar outra requisição. A nota continua sendo do servidor. Puro.
 */
import { ACOES_DESTRAVADAS, ATRIBUTOS, NEUTRO, type AcaoDestravada, type Atributo, type AtributosDoLook, type PerfilDaPeca } from "@/lib/flair/recursos/types";

export interface LookNaTela {
  atributos: AtributosDoLook;
  acoes: AcaoDestravada[];
  /** quantas peças vestidas têm perfil */
  pecas: number;
}

export const LOOK_NEUTRO: LookNaTela = { atributos: Object.fromEntries(ATRIBUTOS.map((a) => [a, NEUTRO])) as AtributosDoLook, acoes: [], pecas: 0 };

/** O look vestido (cartas por vaga) com os perfis por carta; carta sem perfil não conta. */
export function lookNaTela(vestidas: Record<string, string>, perfil: (cardId: string) => PerfilDaPeca | undefined): LookNaTela {
  const perfis = Object.values(vestidas).map(perfil).filter((p): p is PerfilDaPeca => !!p);
  if (perfis.length === 0) return LOOK_NEUTRO;
  const atributos = {} as AtributosDoLook;
  for (const a of ATRIBUTOS) {
    const soma = perfis.reduce((n, p) => n + (p.atributos[a] ?? 0), 0);
    atributos[a] = Math.max(0, Math.min(100, NEUTRO + Math.round(soma / perfis.length)));
  }
  const acoes = ACOES_DESTRAVADAS.filter((x) => perfis.some((p) => p.acoes.includes(x)));
  return { atributos, acoes, pecas: perfis.length };
}

export interface MudancaDeAtributo {
  atributo: Atributo;
  delta: number;
}

/**
 * O look dos jogos de zonas: o servidor manda o perfil das zonas pintadas na prévia (evento PERFIL_DO_LOOK); nulo
 * quando a prévia não traz.
 */
export function lookDaPrevia(eventos: { codigo: string; valor?: unknown }[] | undefined): LookNaTela | null {
  const v = eventos?.find((e) => e.codigo === "PERFIL_DO_LOOK")?.valor as { atributos?: Partial<AtributosDoLook>; acoes?: string[] } | undefined;
  if (!v?.atributos) return null;
  const atributos = { ...LOOK_NEUTRO.atributos, ...v.atributos } as AtributosDoLook;
  const acoes = ACOES_DESTRAVADAS.filter((a) => (v.acoes ?? []).includes(a));
  return { atributos, acoes, pecas: 1 };
}

/** O que mudou de um look para o outro: no máximo `limite` atributos, os de maior mudança primeiro. */
export function mudancas(antes: LookNaTela, depois: LookNaTela, limite = 2): MudancaDeAtributo[] {
  return ATRIBUTOS.map((atributo) => ({ atributo, delta: depois.atributos[atributo] - antes.atributos[atributo] }))
    .filter((m) => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limite);
}

/** As ações que a última troca destravou (as que não existiam antes). */
export function acoesNovas(antes: LookNaTela, depois: LookNaTela): AcaoDestravada[] {
  return depois.acoes.filter((a) => !antes.acoes.includes(a));
}

/** O atributo que mais subiu (a cor do brilho no avatar), ou nulo se nada subiu. */
export function atributoEmAlta(m: MudancaDeAtributo[]): Atributo | null {
  return m.find((x) => x.delta > 0)?.atributo ?? null;
}

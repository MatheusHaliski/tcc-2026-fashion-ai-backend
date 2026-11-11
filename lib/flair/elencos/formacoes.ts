/**
 * As cinco formações (tabela "As formações"): vagas com posição e coordenada (coluna, linha; fileiras de cima para
 * baixo, colunas de 0 a 4) e as linhas na ordem do contrato — a mesma ordem das peças do quebra-cabeça.
 */
import type { ElencoDefinicao, ElencoLinha, ElencoVaga } from "@/lib/flair/elencos/types";

const v = (chave: string, posicao: string, coluna: number, linha: number): ElencoVaga => ({ chave, posicao, coluna, linha });

function linhas(texto: string): ElencoLinha[] {
  return texto.split(" ").map((par) => {
    const [a, b] = par.split("-");
    return { a, b };
  });
}

export const FORMACOES: ElencoDefinicao[] = [
  {
    codigo: "PRIMEIRO_ELENCO",
    vagas: [v("acessorio", "ACE", 2, 0), v("cima", "SUP", 1, 1), v("bolsa", "ACE", 3, 1), v("baixo", "INF", 2, 2), v("calcado", "CAL", 2, 3)],
    linhas: linhas("acessorio-cima cima-bolsa cima-baixo bolsa-baixo baixo-calcado"),
    requisitos: [{ tipo: "QUIMICA", alvo: 40 }, { tipo: "LINHAS_VERDES", alvo: 2 }],
  },
  {
    codigo: "PALETA_ATELIE",
    vagas: [v("ace1", "ACE", 1, 0), v("ace2", "ACE", 3, 0), v("sup1", "SUP", 1, 1), v("sup2", "SUP", 3, 1), v("inf1", "INF", 1, 2), v("inf2", "INF", 3, 2), v("cal", "CAL", 2, 3)],
    linhas: linhas("ace1-ace2 ace1-sup1 ace2-sup2 sup1-sup2 sup1-inf1 sup2-inf2 inf1-inf2 inf1-cal inf2-cal"),
    requisitos: [{ tipo: "QUIMICA", alvo: 60 }, { tipo: "LINHAS_COR", alvo: 4 }, { tipo: "CARTAS", alvo: 7 }],
  },
  {
    codigo: "CASA_MARCA",
    vagas: [
      v("ace1", "ACE", 0, 0), v("ace2", "ACE", 2, 0), v("ace3", "ACE", 4, 0),
      v("sup1", "SUP", 0, 1), v("sup2", "SUP", 2, 1), v("sup3", "SUP", 4, 1),
      v("inf1", "INF", 1, 2), v("inf2", "INF", 3, 2), v("cal", "CAL", 2, 3),
    ],
    linhas: linhas("ace1-ace2 ace2-ace3 sup1-sup2 sup2-sup3 inf1-inf2 ace1-sup1 ace2-sup2 ace3-sup3 sup1-inf1 sup3-inf2 inf1-cal inf2-cal"),
    requisitos: [{ tipo: "QUIMICA", alvo: 70 }, { tipo: "LINHAS_MARCA", alvo: 3 }, { tipo: "MARCAS", alvo: 2 }, { tipo: "OURO_OU_ESPECIAL", alvo: 1 }],
  },
  {
    codigo: "NOITE_ESTREIA",
    vagas: [
      v("ace1", "ACE", 1, 0), v("ace2", "ACE", 3, 0), v("sup1", "SUP", 0, 1), v("ves", "VES", 2, 1), v("sup2", "SUP", 4, 1),
      v("inf1", "INF", 1, 2), v("inf2", "INF", 3, 2), v("cal1", "CAL", 1, 3), v("cal2", "CAL", 3, 3),
    ],
    linhas: linhas("ace1-ace2 ace1-sup1 ace2-sup2 sup1-ves ves-sup2 ves-inf1 ves-inf2 sup1-inf1 sup2-inf2 inf1-inf2 inf1-cal1 inf2-cal2 cal1-cal2"),
    requisitos: [{ tipo: "QUIMICA", alvo: 80 }, { tipo: "LINHAS_OCASIAO", alvo: 5 }, { tipo: "SEM_VERMELHA_NA_VAGA", alvo: "ves" }],
  },
  {
    codigo: "ELENCO_LENDARIO",
    vagas: [
      v("ace1", "ACE", 0, 0), v("ace2", "ACE", 2, 0), v("ace3", "ACE", 4, 0),
      v("sup1", "SUP", 0, 1), v("sup2", "SUP", 2, 1), v("sup3", "SUP", 4, 1),
      v("inf1", "INF", 0, 2), v("inf2", "INF", 2, 2), v("inf3", "INF", 4, 2),
      v("cal1", "CAL", 1, 3), v("cal2", "CAL", 3, 3),
    ],
    linhas: linhas("ace1-ace2 ace2-ace3 sup1-sup2 sup2-sup3 inf1-inf2 inf2-inf3 cal1-cal2 ace1-sup1 ace2-sup2 ace3-sup3 sup1-inf1 sup2-inf2 sup3-inf3 inf1-cal1 inf2-cal1 inf2-cal2 inf3-cal2"),
    requisitos: [{ tipo: "QUIMICA", alvo: 100 }, { tipo: "SEM_VERMELHA", alvo: 0 }, { tipo: "ESPECIAIS", alvo: 2 }, { tipo: "MARCAS", alvo: 4 }],
  },
];

export function formacaoLocal(codigo: string): ElencoDefinicao | null {
  return FORMACOES.find((f) => f.codigo === codigo) ?? null;
}

/** Elenco da API completado pela formação local (vagas, linhas ou requisitos ausentes). */
export function mesclarElenco(codigo: string, api?: Partial<ElencoDefinicao> | null): ElencoDefinicao | null {
  const local = formacaoLocal(codigo);
  if (!api) return local;
  const base = local ?? { codigo, vagas: [], linhas: [], requisitos: [] };
  return {
    codigo,
    vagas: api.vagas?.length ? api.vagas : base.vagas,
    linhas: api.linhas?.length ? api.linhas : base.linhas,
    requisitos: api.requisitos?.length ? api.requisitos : base.requisitos,
  };
}

export function elencoDaRota(param: string): string | null {
  const codigo = decodeURIComponent(param).trim().toUpperCase().replace(/-/g, "_");
  return /^[A-Z0-9_]{1,40}$/.test(codigo) ? codigo : null;
}

export function rotaDoElenco(codigo: string): string {
  return `/flair/elencos/${codigo.toLowerCase().replace(/_/g, "-")}`;
}

/** Arte provisória do elenco (public/flair/elencos/<codigo>.svg). */
export function arteDoElenco(codigo: string): string {
  return `/flair/elencos/${codigo}.svg`;
}

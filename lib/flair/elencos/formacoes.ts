/**
 * Formações locais dos elencos (reserva quando a API não responde): uma vaga por peça do quebra-cabeça, com o que ela
 * pede, e os requisitos do deck — as mesmas do backend (FlairCbcElencos.java).
 */
import { pedidoDaVaga, QUEBRA_CABECAS } from "@/lib/flair/elencos/quebra-cabecas";
import type { ElencoDefinicao } from "@/lib/flair/elencos/types";

export const FORMACOES: ElencoDefinicao[] = QUEBRA_CABECAS.map((q) => ({
  codigo: q.codigo,
  vagas: q.pedidos.map((p, i) => ({ chave: `p${i + 1}`, posicao: "ANY", pede: pedidoDaVaga(p) })),
  requisitos: [...q.requisitos, ...(q.requisitos.some((r) => r.tipo === "CARTAS") ? [] : [{ tipo: "CARTAS", alvo: q.pedidos.length }])],
}));

export const ELENCO_CODIGOS: readonly string[] = FORMACOES.map((f) => f.codigo);

export function formacaoLocal(codigo: string): ElencoDefinicao | null {
  return FORMACOES.find((f) => f.codigo === codigo) ?? null;
}

/** Elenco da API completado pela formação local (vagas ou requisitos ausentes). */
export function mesclarElenco(codigo: string, api?: Partial<ElencoDefinicao> | null): ElencoDefinicao | null {
  const local = formacaoLocal(codigo);
  if (!api) return local;
  const base = local ?? { codigo, vagas: [], requisitos: [] };
  return {
    codigo,
    vagas: api.vagas?.length ? api.vagas : base.vagas,
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

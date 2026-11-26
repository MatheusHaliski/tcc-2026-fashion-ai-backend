/**
 * Formações locais dos elencos (reserva quando a API não responde): vagas e requisitos, as mesmas do backend.
 */
import type { ElencoDefinicao } from "@/lib/flair/elencos/types";

/** Os cinco elencos de linhas e química foram retirados; o catálogo novo entra aqui. */
export const FORMACOES: ElencoDefinicao[] = [];

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

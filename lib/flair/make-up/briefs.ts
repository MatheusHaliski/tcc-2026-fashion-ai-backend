/**
 * Os três briefs da base (níveis 1 e 2), as regras de Prestígio da carreira e o cenário do provador nas cores do
 * FashionAI. A API manda; isto completa a tela quando um campo não vem.
 */
import type { BrandEnvironment, ResolvedEnvironment } from "@/lib/tryon/fitting-room";
import { MAQUIAGEM_AREAS, PALETA_INICIAL } from "@/lib/flair/make-up/palette";
import type { BriefDefinicao } from "@/lib/flair/make-up/types";
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

export const BRIEFS: BriefDefinicao[] = [
  { codigo: "ENSAIO_VERAO", nivelMin: 1, regras: regras("OCASIAO", "MATERIAL", "LABIOS_FAMILIA", "LABIOS_ACABAMENTO"), vagas: ["SUP", "INF", "CAL", "ACE", "VES"], areas: MAQUIAGEM_AREAS, paleta: PALETA_INICIAL },
  { codigo: "ENTREVISTA", nivelMin: 1, regras: regras("OCASIAO", "CALCADO_FECHADO", "LABIOS_FAMILIA", "LABIOS_ACABAMENTO"), vagas: ["SUP", "INF", "CAL", "ACE", "VES"], areas: MAQUIAGEM_AREAS, paleta: PALETA_INICIAL },
  { codigo: "PRIMEIRO_ENCONTRO", nivelMin: 2, regras: regras("OCASIAO", "ACESSORIO", "LABIOS_FAMILIA", "BOCHECHAS"), vagas: ["SUP", "INF", "CAL", "ACE", "VES"], areas: MAQUIAGEM_AREAS, paleta: PALETA_INICIAL },
];

function regras(...codigos: string[]) {
  return codigos.map((codigo) => ({ codigo, pontos: 25 }));
}

/** Ações do MAKE UP: as do contrato, menos desfilar ou caminhar. */
export const MAKEUP_ACOES: NucleoAcao[] = ["NAVEGAR", "TROCAR_ABA", "APLICAR", "TIRAR", "GIRAR", "ZOOM", "POSAR", "ENTREGAR", "OBJETIVO"];

/** Prestígio para sair do nível n: 60, 90, 120, 150, 180 nos níveis 1 a 5; depois, round(15 · n^1,5). */
export function prestigioParaSair(nivel: number): number {
  if (nivel <= 5) return 30 + 30 * Math.max(1, nivel);
  return Math.round(15 * Math.pow(nivel, 1.5));
}

/** Brief da API completado pelo local (listas vazias e paleta ausente). */
export function mesclarBrief(codigo: string, api?: Partial<BriefDefinicao> | null): BriefDefinicao {
  const local = BRIEFS.find((b) => b.codigo === codigo) ?? { codigo, nivelMin: 1, regras: [], vagas: [], areas: MAQUIAGEM_AREAS, paleta: PALETA_INICIAL };
  if (!api) return local;
  return {
    ...local,
    ...api,
    codigo,
    regras: api.regras?.length ? api.regras : local.regras,
    vagas: api.vagas?.length ? api.vagas : local.vagas,
    areas: api.areas?.length ? api.areas : local.areas,
    paleta: api.paleta && Object.keys(api.paleta).length ? api.paleta : local.paleta,
  };
}

/** Código da rota (/flair/make-up/ensaio-verao) → código do brief (só letras, números e _). */
export function briefDaRota(param: string): string | null {
  const codigo = decodeURIComponent(param).trim().toUpperCase().replace(/-/g, "_");
  return /^[A-Z0-9_]{1,40}$/.test(codigo) ? codigo : null;
}

export function rotaDoBrief(codigo: string): string {
  return `/flair/make-up/${codigo.toLowerCase().replace(/_/g, "-")}`;
}

/** O provador com o logo do FashionAI na parede do fundo e as cores da marca (sem mudar o padrão do provador). */
export const FASHIONAI_AMBIENTE: BrandEnvironment = {
  key: "fashionai",
  name: "FashionAI",
  logoUrl: "/brand/fai-logo.png",
  style: "atelier",
  motif: "plain",
  wall: "#FBE7EE",
  floor: "#1F7A76",
  accent: "#C6275E",
  ink: "#1F7A76",
  curated: true,
};

export const FASHIONAI_PROVADOR: ResolvedEnvironment = {
  kind: "brand",
  featured: FASHIONAI_AMBIENTE,
  others: [],
  brands: [FASHIONAI_AMBIENTE],
};

/*
 * Contrato da vestimenta do provador 3D (PROVADOR-3D). Cada peça vestida responde, de forma verificável:
 *
 *   identidade     produto/peça, categoria, subcategoria, família, variação
 *   asset          o que existe de 3D: "molde-estimado" (casca do corpo + foto da frente) ou "malha-aprovada" (malha
 *                  de vestimenta com UV, rig e aprovação) — hoje nenhuma peça tem malha aprovada
 *   compatibilidade corpo alvo (fai-body-v1, MakeHuman CC0 com esqueleto Mixamo), slot e restrições
 *   ajuste         molde (garments.ts), classe de caimento (garment-fit.ts), folga e camada
 *   movimento      skinning no esqueleto do corpo; sem simulação de tecido
 *   aparência      foto da frente na frente; costas e laterais na cor do tecido medida na foto (nunca da loja)
 *   validação      estado: APROVADA | ESTIMADA | PROCESSANDO | SEM_3D | ERRO, com o motivo
 *
 * Estratégia por FAMÍLIA (nada de uma função única para camiseta, vestido, tênis e bolsa): cada família declara como a
 * peça é construída, o que nunca pode ser perdido e como se move.
 */
import { kindOf, type GarmentKind } from "@/lib/avatar3d/human/garments";
import { fitClassOf, specFor, type FitClass, type FitPiece } from "@/lib/avatar3d/human/garment-fit";

export type Family = "superior" | "sobreposicao" | "inferior" | "peca-inteira" | "calcado" | "acessorio";
export type TryOnState = "APROVADA" | "ESTIMADA" | "PROCESSANDO" | "SEM_3D" | "ERRO";
export type PhotoState = "ok" | "carregando" | "falhou" | "sem-foto";

export interface GarmentStrategy {
  family: Family;
  /** como a geometria é construída */
  build: "casca-do-corpo" | "tubo-da-cintura" | "forma-do-calcado" | "fixacao";
  /** elementos que a peça nunca pode perder */
  preserve: string[];
  /** como acompanha o corpo */
  motion: "skinning" | "fixo-no-osso";
  /** classes de caimento aceitas */
  fits: FitClass[];
}

export const STRATEGIES: Record<Family, GarmentStrategy> = {
  superior: { family: "superior", build: "casca-do-corpo", preserve: ["gola", "ombros", "mangas", "barra"], motion: "skinning", fits: ["justa", "regular", "oversized"] },
  sobreposicao: { family: "sobreposicao", build: "casca-do-corpo", preserve: ["abertura frontal", "gola/lapela", "mangas", "barra", "folga sobre a peça de baixo"], motion: "skinning", fits: ["regular", "oversized", "estruturada", "fluida"] },
  inferior: { family: "inferior", build: "casca-do-corpo", preserve: ["cós", "quadril", "entrepernas", "joelhos", "barra"], motion: "skinning", fits: ["justa", "regular", "oversized", "fluida"] },
  "peca-inteira": { family: "peca-inteira", build: "tubo-da-cintura", preserve: ["decote", "cintura", "comprimento", "volume da saia"], motion: "skinning", fits: ["justa", "regular", "fluida"] },
  calcado: { family: "calcado", build: "forma-do-calcado", preserve: ["sola no chão", "bico", "contraforte", "cano"], motion: "skinning", fits: ["regular"] },
  acessorio: { family: "acessorio", build: "fixacao", preserve: ["ponto de fixação", "alças"], motion: "fixo-no-osso", fits: [] },
};

const FAMILY_OF: Record<GarmentKind, Family> = {
  tee: "superior", tank: "superior", crop: "superior", longsleeve: "superior", shirt: "superior", sweater: "superior", hoodie: "superior",
  jacket: "sobreposicao", coat: "sobreposicao", vest: "sobreposicao",
  pants: "inferior", culottes: "inferior", shorts: "inferior", bermuda: "inferior", skirt: "inferior", leggings: "inferior",
  dress: "peca-inteira", jumpsuit: "peca-inteira", romper: "peca-inteira",
  shoes: "calcado", boots: "calcado",
};

/** Malhas de vestimenta aprovadas (UV, rig, pesos e validação por corpo). Vazio: nenhuma peça tem prova 3D real ainda. */
export const APPROVED_WEARABLES: ReadonlySet<string> = new Set();

export interface ContractPiece extends FitPiece { id: string; name?: string; imageUrl?: string | null; studioUrl?: string | null; colorHex?: string | null }

export interface GarmentContract {
  identity: { id: string; name?: string; category?: string | null; subcategory?: string | null; family: Family; variation?: string | null };
  asset: { kind: "molde-estimado" | "malha-aprovada" | "nenhum"; uv: boolean; rig: boolean; approval: "aprovada" | "pendente" };
  compatibility: { body: "fai-body-v1"; slot: string; restrictions: string[] };
  fit: { kind: GarmentKind | null; fitClass: FitClass | null; easeMm: number | null; layer: number | null };
  motion: { method: GarmentStrategy["motion"]; collisions: "folga-por-camada"; simulation: "nenhuma" };
  appearance: { front: "foto" | "cor-cadastrada" | "nenhuma"; back: "cor-do-tecido-da-foto" | "cor-cadastrada" | "nenhuma" };
  validation: { state: TryOnState; reason: string };
}

/** Limitações conhecidas por subcategoria (registradas, não escondidas). */
export const KNOWN_LIMITS: Record<string, string> = {
  sandals: "sandalia_como_sapato_fechado", flip_flops: "sandalia_como_sapato_fechado", heels: "salto_sem_salto_modelado", espadrilles: "sandalia_como_sapato_fechado",
  matching_set: "conjunto_como_macacao", overalls: "jardineira_sem_peitilho", kimono: "quimono_sem_manga_ampla", skort: "saia_short_sem_short_por_baixo",
};

export function familyOf(p: FitPiece): Family {
  const k = kindOf(p); return k ? FAMILY_OF[k] : "acessorio";
}

/** Contrato e estado da peça no provador, a partir da peça e do estado da foto (carregada no navegador). */
export function garmentContract(p: ContractPiece, photo: PhotoState): GarmentContract {
  const k = kindOf(p); const family = k ? FAMILY_OF[k] : "acessorio"; const st = STRATEGIES[family];
  const spec = specFor(p); const approved = APPROVED_WEARABLES.has(p.id);
  const restrictions = [KNOWN_LIMITS[(p.subcategory ?? "").toLowerCase()]].filter((x): x is string => !!x);
  let state: TryOnState; let reason: string;
  if (!k) { state = "SEM_3D"; reason = "acessorio_sem_molde_3d"; }
  else if (approved) { state = "APROVADA"; reason = "malha_aprovada"; }
  else if (photo === "carregando") { state = "PROCESSANDO"; reason = "carregando_foto"; }
  else if (photo === "falhou") { state = "ERRO"; reason = "foto_indisponivel_no_3d"; }
  else { state = "ESTIMADA"; reason = photo === "sem-foto" ? "sem_foto_cor_cadastrada" : "molde_estimado_foto_frontal"; }
  return {
    identity: { id: p.id, name: p.name, category: p.category, subcategory: p.subcategory, family, variation: p.variation ?? null },
    asset: { kind: approved ? "malha-aprovada" : k ? "molde-estimado" : "nenhum", uv: approved, rig: !!k, approval: approved ? "aprovada" : "pendente" },
    compatibility: { body: "fai-body-v1", slot: p.slot ?? p.category ?? "", restrictions },
    fit: { kind: k, fitClass: k ? fitClassOf(p) : null, easeMm: spec ? Math.round(spec.ease * 10000) / 10 : null, layer: spec?.layer ?? null },
    motion: { method: st.motion, collisions: "folga-por-camada", simulation: "nenhuma" },
    appearance: { front: !k ? "nenhuma" : photo === "ok" ? "foto" : "cor-cadastrada", back: !k ? "nenhuma" : photo === "ok" ? "cor-do-tecido-da-foto" : "cor-cadastrada" },
    validation: { state, reason },
  };
}

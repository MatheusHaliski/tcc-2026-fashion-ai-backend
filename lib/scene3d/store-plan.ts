/*
 * Plano da loja do provador (PROVADOR-3D, docs/provador/auditoria-provador-3d-2026-10-10.md).
 *
 * PERFIL DA LOJA → PLANO DE OBJETOS → cena 3D. A cena só desenha o que está no plano; cada objeto declara a função
 * comercial que justifica estar ali (exposição, organização, circulação, prova, comunicação, iluminação). Tudo puro
 * (sem React/three), para o inventário e as regras serem testáveis:
 *
 *  - fidelidade: sem referência oficial/autorizada registrada, o ambiente é uma INTERPRETAÇÃO CONCEITUAL da marca
 *    (paleta e estilo), nunca apresentado como reprodução da loja física;
 *  - foto de catálogo só aparece como fotografia num suporte deliberado (quadro, bloco acrílico, cavalete), nunca
 *    solta no ar nem fingindo ser produto 3D; produto em 3D exige asset 3D aprovado;
 *  - loja de marca não mostra logo, painel ou produto de outra marca (os painéis de outras marcas vestidas só existem
 *    no provador neutro multimarca FashionAI);
 *  - escala coerente: porta 2,10 m, assento 0,45 m, mesa 0,75 m, arara 1,6–1,8 m (faixas em SCALE_RANGES).
 */
import type { BrandEnvironment, RoomStyle } from "@/lib/tryon/fitting-room";
import type { SceneProduct, StoreScene, ZoneKind } from "@/lib/scene3d/scene";

export type FixtureFunction = "exposicao" | "organizacao" | "circulacao" | "prova" | "comunicacao" | "iluminacao";
export type FixtureKind =
  | "piso" | "paredes" | "teto"
  | "parede-da-marca" | "faixa-de-luz" | "trilho-de-luz" | "luz-de-parede"
  | "palco-de-prova" | "cabine-cortina" | "espelho" | "banco-de-prova" | "porta-provadores"
  | "placa-da-zona" | "quadros-da-zona" | "prateleiras-calcados" | "mesa-de-fotos" | "nicho-acessorios" | "foto-em-destaque"
  | "paineis-multimarca";

export type FloorMaterial = "quadra" | "tabuas" | "concreto" | "marmore" | "galeria" | "atelie";
export type Fidelity = "documented" | "conceptual";

/** Referência oficial ou autorizada de uma loja (foto de loja, manual de VM, guia de marca), com licença. */
export interface StoreReference { title: string; source: string; license: string; retrievedAt: string }

export interface StoreProfile {
  key: string;
  name: string;
  fidelity: Fidelity;
  references: StoreReference[];
  palette: { wall: string; floor: string; accent: string; ink: string };
  materials: { floor: FloorMaterial; wall: "liso" | "padrao-da-marca"; fixtures: "metal-escovado" | "madeira" | "laca-clara" };
  lighting: "spots-quentes" | "luz-difusa" | "galeria";
  /** assets 3D aprovados para expor (manequins, produtos). Vazio: produtos só como fotografia em suporte. */
  approvedAssets: string[];
  logoUrl: string | null;
}

export interface FixturePlan {
  id: string;
  kind: FixtureKind;
  fn: FixtureFunction;
  /** marca dona do objeto (logo, painel, produto); null = neutro */
  brandKey: string | null;
  position: [number, number, number];
  rotationY: number;
  /** largura × altura × profundidade (m) */
  size: [number, number, number];
  /** produtos exibidos (sempre como foto em suporte) */
  products?: SceneProduct[];
  /** painéis multimarca: as marcas mostradas */
  brands?: BrandEnvironment[];
  /** chave i18n da placa (zona) */
  labelKey?: string;
}

export interface StorePlan { profile: StoreProfile; fixtures: FixturePlan[] }

/** Dimensões da sala (m): as mesmas da cena. */
export const ROOM = { width: 7.2, depth: 6, height: 3.2, backZ: -1.9, sideX: 3.0 } as const;

/** Faixas de escala plausíveis por objeto (altura, m) — referência de loja e mobiliário comercial. */
export const SCALE_RANGES: Partial<Record<FixtureKind, [number, number]>> = {
  "porta-provadores": [2.0, 2.2],
  "banco-de-prova": [0.42, 0.5],
  "mesa-de-fotos": [0.72, 0.92],
  "espelho": [1.7, 2.2],
  "cabine-cortina": [2.0, 2.7],
  "prateleiras-calcados": [1.4, 2.0],
  "nicho-acessorios": [0.9, 1.4],
  "foto-em-destaque": [1.0, 1.5],
  "quadros-da-zona": [1.4, 2.4],
  "palco-de-prova": [0.02, 0.08],
};

/** Referências oficiais/autorizadas por marca. Nenhuma registrada: todas as lojas são conceituais. */
const REFERENCES: Record<string, StoreReference[]> = {};

const FLOOR: Record<RoomStyle, FloorMaterial> = { arena: "quadra", heritage: "tabuas", street: "concreto", boutique: "marmore", gallery: "galeria", atelier: "atelie" };
const LIGHTING: Record<RoomStyle, StoreProfile["lighting"]> = { arena: "spots-quentes", heritage: "spots-quentes", street: "luz-difusa", boutique: "galeria", gallery: "galeria", atelier: "luz-difusa" };

/** Perfil da loja a partir do ambiente da marca (paleta e estilo) e das referências registradas. */
export function storeProfileFor(env: BrandEnvironment): StoreProfile {
  const references = REFERENCES[env.key] ?? [];
  return {
    key: env.key, name: env.name,
    fidelity: references.length ? "documented" : "conceptual", references,
    palette: { wall: env.wall, floor: env.floor, accent: env.accent, ink: env.ink },
    materials: { floor: FLOOR[env.style], wall: env.motif === "plain" ? "liso" : "padrao-da-marca", fixtures: env.style === "heritage" ? "madeira" : env.style === "gallery" || env.style === "boutique" ? "laca-clara" : "metal-escovado" },
    lighting: LIGHTING[env.style],
    approvedAssets: [],
    logoUrl: env.logoUrl,
  };
}

const ZONE_FIXTURE: Record<ZoneKind, FixtureKind> = {
  SHOE_WALL: "prateleiras-calcados", GARMENT_RACK: "quadros-da-zona", DENIM_TABLE: "mesa-de-fotos", VITRINE: "nicho-acessorios",
};

/**
 * Plano de objetos do provador. `others` (marcas vestidas além da principal) só vira painel no provador neutro
 * multimarca; numa loja de marca, nada de outra marca entra.
 */
export function planStore(env: BrandEnvironment, others: BrandEnvironment[], scene: StoreScene | null): StorePlan {
  const profile = storeProfileFor(env);
  const brand = env.key === "neutral" ? null : env.key;
  const { backZ, height } = ROOM;
  const f: FixturePlan[] = [];
  const add = (p: Omit<FixturePlan, "id">) => f.push({ id: `${p.kind}:${p.brandKey ?? "neutro"}:${f.length}`, ...p });

  // arquitetura: piso (circulação), paredes e teto
  add({ kind: "piso", fn: "circulacao", brandKey: null, position: [0, 0, 1.1], rotationY: 0, size: [ROOM.width, 0, ROOM.depth] });
  add({ kind: "paredes", fn: "organizacao", brandKey: brand, position: [0, height / 2, backZ], rotationY: 0, size: [ROOM.width, height, ROOM.depth] });
  add({ kind: "teto", fn: "iluminacao", brandKey: null, position: [0, height, 1.1], rotationY: 0, size: [ROOM.width, 0, ROOM.depth] });
  // iluminação: trilho de spots sobre o palco e a luz que lava a parede da marca (não alcança o avatar)
  add({ kind: "trilho-de-luz", fn: "iluminacao", brandKey: null, position: [0, height - 0.02, 0.2], rotationY: 0, size: [3.6, 0.04, 0.08] });
  add({ kind: "luz-de-parede", fn: "iluminacao", brandKey: brand, position: [0, height - 0.25, backZ + 0.35], rotationY: 0, size: [2.6, 0.04, 0.04] });
  // comunicação: a parede da marca (logo aprovado do catálogo ou o nome) e a faixa de luz na cor de destaque
  add({ kind: "parede-da-marca", fn: "comunicacao", brandKey: brand, position: [0, 2.12, backZ + 0.03], rotationY: 0, size: [2.5, 0.72, 0.02] });
  add({ kind: "faixa-de-luz", fn: "comunicacao", brandKey: brand, position: [0, 0.03, backZ + 0.01], rotationY: 0, size: [ROOM.width, 0.05, 0.01] });
  // prova: palco, cabine com cortina, espelho de corpo inteiro e banco para calçar
  add({ kind: "palco-de-prova", fn: "prova", brandKey: null, position: [0, 0.02, 0], rotationY: 0, size: [1.5, 0.04, 1.5] });
  add({ kind: "cabine-cortina", fn: "prova", brandKey: null, position: [-2.35, 0, -0.6], rotationY: Math.PI / 2.6, size: [1.5, 2.6, 0.1] });
  const zone = scene?.zone ?? null;
  add({ kind: "espelho", fn: "prova", brandKey: null, position: zone ? [-2.75, 1.1, 0.75] : [2.3, 1.1, -0.75], rotationY: zone ? Math.PI / 2.2 : -Math.PI / 2.8, size: [0.84, 2.14, 0.05] });
  // circulação: a porta dos provadores (referência de escala ao lado do avatar)
  add({ kind: "porta-provadores", fn: "circulacao", brandKey: null, position: [-1.95, 0, backZ + 0.02], rotationY: 0, size: [0.9, 2.1, 0.08] });
  if (!zone) add({ kind: "banco-de-prova", fn: "prova", brandKey: null, position: [1.35, 0, backZ + 0.55], rotationY: 0, size: [1.1, 0.45, 0.42] });

  // exposição: a zona da categoria da busca, com as fotos do catálogo em suportes deliberados
  if (zone && scene) {
    const products = scene.display.length ? scene.display : scene.hero ? [scene.hero] : [];
    const kind = ZONE_FIXTURE[zone.kind];
    const place: Record<ZoneKind, { position: [number, number, number]; rotationY: number; size: [number, number, number] }> = {
      SHOE_WALL: { position: [1.75, 0, backZ + 0.12], rotationY: 0, size: [1.74, 1.6, 0.3] },
      GARMENT_RACK: { position: [1.75, 0, backZ + 0.05], rotationY: 0, size: [1.7, 1.9, 0.06] },
      DENIM_TABLE: { position: [1.7, 0, -0.45], rotationY: -0.32, size: [1.4, 0.76, 0.7] },
      VITRINE: { position: [1.55, 0, -0.6], rotationY: -0.5, size: [1.3, 1.35, 0.56] },
    };
    if (products.length) add({ kind, fn: "exposicao", brandKey: brand, ...place[zone.kind], products: products.slice(0, kind === "quadros-da-zona" ? 6 : kind === "prateleiras-calcados" ? 6 : 4) });
    add({ kind: "placa-da-zona", fn: "comunicacao", brandKey: brand, position: [1.75, 2.28, backZ + 0.3], rotationY: 0, size: [1.3, 0.33, 0.03], labelKey: `scene3d.zone.${zone.key}` });
  }
  // o produto escolhido: foto em quadro num cavalete ao lado do avatar (estático; a peça em si se prova no corpo)
  if (scene?.hero) add({ kind: "foto-em-destaque", fn: "exposicao", brandKey: brand, position: [-1.2, 0, 0.35], rotationY: 0.25, size: [0.5, 1.32, 0.4], products: [scene.hero] });
  // provador neutro multimarca: painéis das outras marcas vestidas (nunca numa loja de marca)
  if (!brand && others.length) add({ kind: "paineis-multimarca", fn: "comunicacao", brandKey: null, position: [0, 0, backZ + 0.02], rotationY: 0, size: [1.05, 0.72, 0.02], brands: others.slice(0, 3) });
  return { profile, fixtures: f };
}

/** Inventário legível do plano (objeto, função, marca, altura) — o mesmo que a cena desenha. */
export function inventoryOf(plan: StorePlan): { id: string; kind: FixtureKind; fn: FixtureFunction; brand: string | null; heightM: number; products: number }[] {
  return plan.fixtures.map((x) => ({ id: x.id, kind: x.kind, fn: x.fn, brand: x.brandKey, heightM: Math.round(x.size[1] * 100) / 100, products: x.products?.length ?? 0 }));
}

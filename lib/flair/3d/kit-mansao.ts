/**
 * Kit de interiores da mansão (perfil `high` do motor Blender, scripts/blender3d_high/kit): materiais de piso, parede e
 * teto assados no Blender (cor, normal, aspereza e oclusão em WebP, com a sujeira das juntas na cor) e peças em GLB
 * (alto e médio, meshopt) — móveis, lustres, portas e decoração —, mais os modelos prontos do MET Gala Heist (Meshy) que
 * servem a cada tipo de cômodo. O manifesto (`/flair/3d/kit-mansao/manifest.json`) é a fonte das medidas e dos
 * endereços; aqui ficam os tipos, a leitura e o que cada tipo de cômodo usa.
 *
 * Convenção das peças: metros, frente para +z do jogo. `piso`: base em y = 0, centrada; `parede`: as costas em z = 0
 * (encostar na parede) e a base em y = 0; `teto`: o topo em y = 0 (pendurar no teto).
 */
export const KIT_MANSAO_MANIFESTO = "/flair/3d/kit-mansao/manifest.json";

export type TipoDeComodo = "hall" | "salao-baile" | "biblioteca" | "closet" | "jantar" | "escritorio" | "jardim";
export type Superficie = "piso" | "parede" | "teto";
export type NivelDoKit = "alto" | "medio";

export interface MapasDoMaterial {
  cor: string;
  normal: string;
  aspereza: string;
  ao: string;
}

export interface MaterialDoKit {
  slug: string;
  titulo: string;
  superficie: Superficie;
  /** tamanho de uma repetição da textura, em metros (repeat = medida da superfície / repeticaoMetros) */
  repeticaoMetros: number;
  mapas: MapasDoMaterial;
  /** a mesma coisa em 512 px (nível médio) */
  mapasMedio: MapasDoMaterial;
  /** uma repetição num plano, com o material inteiro (GLB) */
  amostra: string;
}

export interface ArquivoDaPeca {
  url: string;
  triangles: number;
  calls: number;
  bytes: number;
}

export interface PecaDoKit {
  slug: string;
  titulo: string;
  apoio: Superficie;
  comodos: string[];
  /** "porta": a folha é o nó "folha" (abre girando no eixo da dobradiça, em x negativo); "luz": ponha uma luz nela */
  papel: string;
  /** largura (x), altura (y) e fundo (z) em metros */
  tamanho: [number, number, number];
  niveis: Partial<Record<NivelDoKit, ArquivoDaPeca>>;
}

export interface KitMansao {
  materiais: MaterialDoKit[];
  pecas: PecaDoKit[];
}

/** Modelos prontos do MET Gala Heist (public/heist/models, Meshy, 31/10 a 02/11/2026) e a altura real de cada um. */
export const MODELOS_DO_HEIST: Record<string, { url: string; altura: number; comodos: TipoDeComodo[] }> = {
  vestConsole: { url: "/heist/models/vestConsole.glb", altura: 0.8, comodos: ["hall"] },
  vestFloral: { url: "/heist/models/vestFloral.glb", altura: 1.85, comodos: ["hall", "salao-baile"] },
  monumentalVase: { url: "/heist/models/monumentalVase.glb", altura: 1.6, comodos: ["hall", "jardim", "escritorio"] },
  valetStand: { url: "/heist/models/valetStand.glb", altura: 1.25, comodos: ["hall"] },
  patronTable: { url: "/heist/models/patronTable.glb", altura: 1.0, comodos: ["salao-baile"] },
  dessertTable: { url: "/heist/models/dessertTable.glb", altura: 0.95, comodos: ["salao-baile", "jantar"] },
  buffetTable: { url: "/heist/models/buffetTable.glb", altura: 0.95, comodos: ["jantar"] },
  serviceBuffet: { url: "/heist/models/serviceBuffet.glb", altura: 0.95, comodos: ["jantar", "escritorio"] },
  loungeArmchair: { url: "/heist/models/loungeArmchair.glb", altura: 0.95, comodos: ["biblioteca", "escritorio"] },
  loungeCoffee: { url: "/heist/models/loungeCoffee.glb", altura: 0.45, comodos: ["biblioteca"] },
  loungeStool: { url: "/heist/models/loungeStool.glb", altura: 0.78, comodos: ["closet"] },
  loungeScreen: { url: "/heist/models/loungeScreen.glb", altura: 1.75, comodos: ["closet"] },
  terracoUrn: { url: "/heist/models/terracoUrn.glb", altura: 1.4, comodos: ["jardim", "salao-baile"] },
  terracoChair: { url: "/heist/models/terracoChair.glb", altura: 0.85, comodos: ["jardim"] },
  terracoBed: { url: "/heist/models/terracoBed.glb", altura: 0.6, comodos: ["jardim"] },
  terracoFire: { url: "/heist/models/terracoFire.glb", altura: 0.45, comodos: ["jardim"] },
  stoneBench: { url: "/heist/models/stoneBench.glb", altura: 0.45, comodos: ["jardim"] },
  terracoTotem: { url: "/heist/models/terracoTotem.glb", altura: 2.0, comodos: ["jardim"] },
};

/** O que cada tipo de cômodo usa por padrão: piso, parede e teto do kit (o primeiro é o sugerido). */
export const MATERIAIS_DO_COMODO: Record<TipoDeComodo, { piso: string[]; parede: string[]; teto: string[] }> = {
  hall: { piso: ["piso-marmore-xadrez"], parede: ["parede-boiserie-creme"], teto: ["teto-gesso"] },
  "salao-baile": { piso: ["piso-espinha-carvalho", "piso-marmore-xadrez"], parede: ["parede-damasco-bordo"], teto: ["teto-caixotoes"] },
  biblioteca: { piso: ["piso-carpete-bordo", "piso-espinha-nogueira"], parede: ["parede-boiserie-nogueira"], teto: ["teto-caixotoes"] },
  closet: { piso: ["piso-carpete-azul"], parede: ["parede-damasco-verde"], teto: ["teto-gesso"] },
  jantar: { piso: ["piso-espinha-nogueira"], parede: ["parede-damasco-verde", "parede-boiserie-nogueira"], teto: ["teto-caixotoes"] },
  escritorio: { piso: ["piso-espinha-nogueira"], parede: ["parede-boiserie-nogueira"], teto: ["teto-gesso"] },
  jardim: { piso: ["piso-porcelanato"], parede: ["parede-estuque"], teto: ["teto-gesso"] },
};

const texto = (v: unknown, padrao = ""): string => (typeof v === "string" ? v : padrao);
const numero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function mapas(v: unknown): MapasDoMaterial {
  const m = (v ?? {}) as Record<string, unknown>;
  return { cor: texto(m.cor), normal: texto(m.normal), aspereza: texto(m.aspereza), ao: texto(m.ao) };
}

function arquivo(v: unknown): ArquivoDaPeca | undefined {
  const a = v as Record<string, unknown> | undefined;
  if (!a || typeof a.url !== "string") return undefined;
  return { url: a.url, triangles: numero(a.triangles), calls: numero(a.calls), bytes: numero(a.bytes) };
}

/** Lê o manifesto do kit como veio do arquivo (o gerador escreve em inglês; aqui os nomes são os do jogo). */
export function lerKitMansao(json: unknown): KitMansao {
  const d = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    materiais: lista(d.materials).filter((m) => typeof m.slug === "string").map((m) => ({
      slug: String(m.slug), titulo: texto(m.title), superficie: texto(m.kind, "piso") as Superficie, repeticaoMetros: numero(m.repeatMeters) || 1,
      mapas: mapas(m.maps), mapasMedio: mapas(m.mapsMedium), amostra: texto((m.sample as Record<string, unknown> | undefined)?.url),
    })),
    pecas: lista(d.pieces).filter((p) => typeof p.slug === "string").map((p) => {
      const n = (p.levels ?? {}) as Record<string, unknown>;
      const t = Array.isArray(p.size) ? p.size.map(numero) : [1, 1, 1];
      return {
        slug: String(p.slug), titulo: texto(p.title), apoio: texto(p.support, "piso") as Superficie, comodos: Array.isArray(p.rooms) ? p.rooms.map(String) : [],
        papel: texto(p.role), tamanho: [t[0] ?? 1, t[1] ?? 1, t[2] ?? 1], niveis: { alto: arquivo(n.alto), medio: arquivo(n.medio) },
      };
    }),
  };
}

/** As peças que servem a um tipo de cômodo (as marcadas "qualquer" servem a todos). */
export const pecasDoComodo = (kit: KitMansao, comodo: TipoDeComodo): PecaDoKit[] =>
  kit.pecas.filter((p) => p.comodos.includes(comodo) || p.comodos.includes("qualquer"));

/** Quantas vezes a textura se repete numa superfície de `largura` × `altura` metros. */
export const repeticoes = (m: MaterialDoKit, largura: number, altura: number): [number, number] =>
  [largura / m.repeticaoMetros, altura / m.repeticaoMetros];

/** O arquivo da peça no nível (o outro, se só um existir). */
export const urlDaPeca = (p: PecaDoKit, nivel: NivelDoKit): string | null =>
  (p.niveis[nivel] ?? p.niveis.alto ?? p.niveis.medio)?.url ?? null;

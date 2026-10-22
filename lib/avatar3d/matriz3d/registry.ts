/*
 * MATRIZ-3D (#237) · biblioteca de componentes da vestimenta 3D com rastreabilidade até a implementação.
 *
 * Cada componente diz ONDE está (arquivo + símbolo, conferidos pelo teste da matriz), A QUE se aplica (subcategorias
 * da taxonomia), COMO saber se a peça o recebeu (lido do que os construtores de fato produziram — sonda em probe.ts),
 * QUAIS testes o validam e para QUAIS moldes. Nada é declarado "implementado" por leitura: o estado de cada célula sai
 * da execução real (matrix.ts). Componente sem referência é "Ausente" onde se aplica — a lacuna fica registrada aqui,
 * com o impacto no acabamento/caimento (3 = maior).
 *
 * Convenções de conexão (valem para todos): metros no espaço do corpo de referência (fai-body-v1), +y para cima, +z é a
 * frente da pessoa, x > 0 é o lado esquerdo dela; alturas paramétricas h (0 = articulação do quadril, 1 = base do
 * pescoço), braço (0 = ombro, 1 = punho) e perna (0 = quadril, 1 = tornozelo) de bodyParam(); malhas separadas presas ao
 * MESMO esqueleto (4 ossos por vértice, pesos somando 1) e desenhadas por cima da peça com polygonOffset −camada−1.
 */
import type { GarmentKind } from "@/lib/avatar3d/human/garments";
import type { Family } from "@/lib/tryon/garment-asset";

export type Estado = "Implementado e validado" | "Implementado, sem validação" | "Parcial" | "Ausente" | "Não aplicável";
export const ESTADOS: Estado[] = ["Implementado e validado", "Implementado, sem validação", "Parcial", "Ausente", "Não aplicável"];

export type Grupo = "Assets padrão" | "Mangas" | "Gola e decote" | "Botões" | "Casas e fechamento" | "Costuras" | "Corpo da peça"
  | "Cintura e acabamento" | "Detalhes" | "Aparência" | "Vestibilidade" | "Calçados" | "Acessórios";
export const GRUPOS: Grupo[] = ["Assets padrão", "Mangas", "Gola e decote", "Botões", "Casas e fechamento", "Costuras", "Corpo da peça",
  "Cintura e acabamento", "Detalhes", "Aparência", "Vestibilidade", "Calçados", "Acessórios"];

/** Arquivo + símbolo responsável (o teste da matriz confere que o símbolo aparece no arquivo). */
export interface Ref { file: string; symbol: string }
/** Teste que valida o componente: arquivo + trecho do título (conferido no arquivo). */
export interface TestRef { file: string; testName: string }

/** O que a sonda observou ao construir a peça no corpo de referência (probe.ts). */
export interface Observacao {
  sub: string; attrs: string; kind: GarmentKind | null;
  spec: { ease: number; hem: number; neck: number; vneck: number; neckShape: string; waist: number; sleeve: number; leg: number; skirt: number; drape: number; flare: number; layer: number; legColumn: number; bustFall: number; shaft: number; construction: string } | null;
  fit: string | null; neckline: string | null; shoeStyle: string | null; relax: number | null;
  /** vértices do molde por região de origem; tubo = vértices sem vértice de pele de origem (saia/barra) */
  /** ombro = vértices do tronco cobertos na linha dos ombros (h ≥ 0,97, fora do pescoço): alça ou manga passando por cima */
  molde: { verts: number; tris: number; tronco: number; braco: number; perna: number; pe: number; tubo: number; ombro: number } | null;
  gola: number;
  acabamentos: Record<string, number>;
  calcado: Record<string, number>;
}

export interface Ctx { category: string; sub: string; kind: GarmentKind | null; family: Family; legacy: boolean; variations: string[] }

export interface Componente {
  id: string; grupo: Grupo; nome: string;
  /** famílias em que o componente faz sentido (fora delas a linha nem aparece na tabela detalhada) */
  familias: Family[];
  /** implementação; vazio = ainda não existe */
  refs: Ref[];
  /** onde se aplica (true) — fora disso é "Não aplicável" */
  aplica: (c: Ctx) => boolean;
  /** a peça recebeu o componente? (lido do observado); ausente quando refs está vazio */
  produz?: (o: Observacao) => boolean;
  /** atributos com que a sonda observa a peça para este componente (variação que o liga), ex.: manga em vestido */
  sonda?: Record<string, string[]>;
  /** parâmetros/unidades no observado */
  params?: (o: Observacao) => string;
  /** malha final criada no provador (components/three/human-outfit.tsx) */
  asset?: string;
  deps: string[];
  testes: TestRef[];
  /** moldes que os testes exercitam; "todos" = caminho único, comum a todos os moldes */
  validados: GarmentKind[] | "todos";
  /** produzido, mas incompleto: o motivo (vira "Parcial") */
  parcial?: (c: Ctx, o: Observacao) => string | null;
  /** contrato de conexão (escala, orientação, encaixe, UV, material, pesos, continuidade) */
  contrato?: string;
  /** o que falta onde se aplica e não existe / está parcial */
  lacuna?: string;
  impacto?: 1 | 2 | 3;
}

// ----------------------------------------------------------------- conjuntos de subcategorias (códigos da taxonomia)
const S = (...codes: string[]) => new Set(codes);
const UP = "upper_piece", LOW = "lower_piece", FULL = "full_body_piece", SHOE = "shoes_piece", ACC = "accessory_piece";
const ROUPA: Family[] = ["superior", "sobreposicao", "inferior", "peca-inteira"];
const TOPO: Family[] = ["superior", "sobreposicao", "peca-inteira"];
const BAIXO: Family[] = ["inferior", "peca-inteira"];
const isCat = (c: Ctx, ...cats: string[]) => cats.includes(c.category);
const isSub = (set: Set<string>) => (c: Ctx) => set.has(c.sub);

const SEM_MANGA = S("tank_top", "vest", "overalls");
const COM_GOLA_FAIXA = S("t_shirt", "shirt", "blouse", "tank_top", "top", "polo_shirt", "bodysuit", "sweater", "sweatshirt", "hoodie", "crop_top", "dress", "jumpsuit", "romper", "matching_set");
const CAMISA_BOTOES = S("shirt");
const BOTOES_FRENTE = S("shirt", "polo_shirt", "cardigan", "blazer", "coat");
const CALCA_BRAGUILHA = S("jeans", "chino_pants", "tailored_pants", "cargo_pants", "casual_pants", "denim_shorts", "bermuda_shorts");
const ZIPER_FRENTE = S("jacket", "windbreaker", "parka");
const CAPUZ = S("hoodie", "parka");
const BOLSOS = S("jeans", "chino_pants", "tailored_pants", "cargo_pants", "casual_pants", "jogger_pants", "sweatpants", "shorts", "denim_shorts", "bermuda_shorts",
  "jacket", "blazer", "coat", "parka", "windbreaker", "hoodie", "overalls", "shirt");
const PASSANTES = S("jeans", "chino_pants", "tailored_pants", "cargo_pants", "casual_pants", "denim_shorts", "bermuda_shorts");
const COS_ELASTICO = S("jogger_pants", "sweatpants", "leggings");
const PUNHO_PERNA = S("jogger_pants", "sweatpants");
const FORRO = S("blazer", "coat", "parka");
const LAPELA = S("blazer", "coat");
const PE_GOLA = S("shirt", "polo_shirt");
const ENCHIMENTO = S("parka");
const PREGAS = S("skirt", "tailored_pants", "culottes", "dress");
const FENDA = S("skirt", "dress");
const ALCAS = S("tank_top", "bodysuit", "dress", "jumpsuit", "romper", "overalls");
const ABERTO_FRENTE = S("cardigan", "blazer", "jacket", "coat", "parka", "windbreaker", "kimono", "vest");
const SAIA_TUBO = S("skirt", "skort", "dress");
const CADARCO = S("casual_sneakers", "running_shoes", "training_shoes", "basketball_shoes", "skate_shoes", "oxford_shoes", "derby_shoes", "high_top_sneakers", "combat_boots");
const SALTO = S("heels");
const TIRAS = S("sandals", "flip_flops", "heels", "espadrilles");
const CANO = S("boots", "ankle_boots", "long_boots", "combat_boots", "high_top_sneakers");
const PALMILHA_VISIVEL = S("sandals", "flip_flops", "espadrilles", "flats", "loafers", "moccasins", "heels");
const ACC_ALCAS = S("handbag", "tote_bag", "clutch", "backpack", "crossbody_bag", "watch", "belt");
const ACC_FECHO = S("handbag", "tote_bag", "clutch", "backpack", "crossbody_bag", "belt", "watch", "necklace", "bracelet");
const ACC_RIGIDO = S("sunglasses", "eyeglasses", "watch", "ring", "earrings", "necklace", "bracelet", "hair_accessory");

const GARMENTS = "lib/avatar3d/human/garments.ts", TRIMS = "lib/avatar3d/human/garment-trims.ts", FIT = "lib/avatar3d/human/garment-fit.ts",
  RELAXF = "lib/avatar3d/human/garment-relax.ts", LAYERS = "lib/avatar3d/human/garment-layers.ts", SHOESF = "lib/avatar3d/human/shoes.ts",
  OUTFIT = "components/three/human-outfit.tsx", DRESS = "lib/avatar3d/human/dress.ts", CONTRACT = "lib/avatar3d/garment-contract.ts",
  ASSETF = "lib/tryon/garment-asset.ts", DEFAULTF = "lib/avatar3d/human/default-outfit.ts", PHOTO = "lib/avatar3d/human/garment-photo.ts";
const T_GARMENTS = "lib/avatar3d/human/garments.test.ts", T_GARMENT = "lib/avatar3d/garment.test.ts", T_PLACKET = "lib/avatar3d/human/shirt-placket.test.ts",
  T_LAYERS = "lib/avatar3d/human/garment-layers.test.ts", T_FIT = "lib/avatar3d/human/garment-fit.test.ts", T_ASSET = "lib/tryon/garment-asset.test.ts",
  T_MATRIX = "lib/avatar3d/human/fit-matrix.test.ts", T_DEFAULT = "lib/avatar3d/human/default-outfit.test.ts", T_CONTRACT = "lib/avatar3d/garment-contract.test.ts",
  T_PHOTO = "lib/avatar3d/human/garment-photo.test.ts";

const PENETRACAO: TestRef[] = [
  { file: T_GARMENTS, testName: "camiseta, calça, vestido e tênis não atravessam o corpo" },
  { file: T_GARMENTS, testName: "jaqueta sobre camiseta e casaco sobre suéter" },
  { file: T_GARMENT, testName: "nenhum vértice dentro do corpo depois das colisões" },
  { file: T_MATRIX, testName: "mede as peças e grava o relatório" },
];
const VALIDADOS_PENETRACAO: GarmentKind[] = ["tee", "pants", "shoes", "dress", "jacket", "coat", "sweater", "skirt", "boots"];

/** a manga existe: molde com manga declarada e vértices do braço (o colete cobre só o alto do braço junto da cava) */
const manga = (o: Observacao) => !!o.spec && o.spec.sleeve > 0 && (o.molde?.braco ?? 0) > 50;
const n = (x: number, d = 3) => (Number.isFinite(x) ? String(Math.round(x * 10 ** d) / 10 ** d) : "—");
const mm = (x: number) => `${Math.round(x * 1000)} mm`;
const v = (o: Observacao, part: string) => o.acabamentos[part] ?? 0;
const sp = (o: Observacao) => o.spec!;

export const COMPONENTES: Componente[] = [
  // ============================================================== Assets padrão
  {
    id: "asset.molde", grupo: "Assets padrão", nome: "Molde paramétrico da família (casca do corpo)", familias: [...ROUPA, "calcado"],
    refs: [{ file: GARMENTS, symbol: "SPECS" }, { file: GARMENTS, symbol: "garmentGeometry" }, { file: DRESS, symbol: "buildGarment" }],
    aplica: (c) => !!c.kind && c.kind !== "shoes", produz: (o) => !!o.molde && o.kind !== "shoes",
    params: (o) => `molde ${o.kind} · folga ${mm(sp(o).ease)} · barra h=${n(sp(o).hem, 2)} · cós h=${n(sp(o).waist, 2)} · manga ${n(sp(o).sleeve, 2)} · perna ${n(sp(o).leg, 2)} · saia ${n(sp(o).skirt, 2)} m · camada ${sp(o).layer} · ${o.molde?.verts ?? 0} vért.`,
    asset: "peca-<id>", deps: ["asset.corpo"], testes: PENETRACAO, validados: VALIDADOS_PENETRACAO,
    contrato: "vértices nascem da pele do corpo afastados pela folga ao longo da normal; mesmos pesos de pele; cobertura contínua por alfa (alphaTest)",
    lacuna: "malha de vestimenta própria (APPROVED_ASSET) com painéis e UV — hoje todo molde é aproximação (casca do corpo)", impacto: 3,
  },
  {
    id: "asset.forma-calcado", grupo: "Assets padrão", nome: "Fôrma do calçado (substitui o molde no pé)", familias: ["calcado"],
    refs: [{ file: SHOESF, symbol: "shoeParts" }, { file: SHOESF, symbol: "shoeStyleOf" }],
    aplica: (c) => c.family === "calcado", produz: (o) => (o.calcado.cabedal ?? 0) > 0,
    params: (o) => `estilo ${o.shoeStyle} · ${Object.entries(o.calcado).map(([k, x]) => `${k} ${x}`).join(" · ")}`,
    asset: "cabedal-<id>, sola-<id>, cadarco-<id>, colarinho-<id>", deps: ["asset.corpo"],
    testes: [{ file: T_GARMENTS, testName: "camiseta, calça, vestido e tênis não atravessam o corpo" }, { file: T_MATRIX, testName: "mede as peças e grava o relatório" }],
    validados: ["shoes", "boots"],
    parcial: (c) => (TIRAS.has(c.sub) || SALTO.has(c.sub) ? "fôrma fechada de tênis/sapato baixo: sandália, chinelo e salto viram sapato fechado (KNOWN_LIMITS)" : null),
    contrato: "pesos do vértice do pé mais próximo; o corpo sobe SOLE_LIFT para a sola tocar o chão; cor por vértice (cabedal/sola da foto)",
  },
  {
    id: "asset.corpo", grupo: "Assets padrão", nome: "Corpo de referência e esqueleto (fai-body-v1)", familias: [...ROUPA, "calcado"],
    refs: [{ file: CONTRACT, symbol: "BODY_RIG" }, { file: "lib/avatar3d/human/asset.ts", symbol: "parseBodyAsset" }, { file: "public/avatar3d/body/fai-body-v1.json", symbol: "bones" }],
    aplica: (c) => !!c.kind, produz: (o) => !!o.molde || (o.calcado.cabedal ?? 0) > 0,
    params: () => "MakeHuman CC0 + esqueleto Mixamo; 2 formas (F/M) por fitBody", deps: [],
    testes: [{ file: T_GARMENTS, testName: "o molde herda os pesos do corpo (4 ossos, somando 1)" }], validados: "todos",
  },
  {
    id: "asset.contrato", grupo: "Assets padrão", nome: "Contrato da vestimenta e estado no provador", familias: [...ROUPA, "calcado", "acessorio"],
    refs: [{ file: CONTRACT, symbol: "garmentContractOf" }, { file: CONTRACT, symbol: "MOULD_VERSION" }, { file: ASSETF, symbol: "garmentContract" }, { file: ASSETF, symbol: "KNOWN_LIMITS" }],
    aplica: () => true, produz: () => true, params: () => "origem de cada atributo (CONFIRMED/ESTIMATED/MISSING) + estado APROVADA/ESTIMADA/PROCESSANDO/SEM_3D/ERRO", deps: [],
    testes: [{ file: T_CONTRACT, testName: "inventário: toda subcategoria real do acervo tem família e caminho explícitos" }, { file: T_ASSET, testName: "limitações conhecidas aparecem no contrato" }], validados: "todos",
  },
  {
    id: "asset.peca-padrao", grupo: "Assets padrão", nome: "Peça padrão da zona (avatar nunca sem roupa)", familias: [...ROUPA, "calcado"],
    refs: [{ file: DEFAULTF, symbol: "DEFAULT_PIECES" }, { file: DEFAULTF, symbol: "withDefaultOutfit" }],
    aplica: (c) => S("t_shirt", "jeans", "casual_sneakers").has(c.sub), produz: (o) => S("t_shirt", "jeans", "casual_sneakers").has(o.sub),
    params: (o) => `zona ${o.kind === "tee" ? "upper" : o.kind === "pants" ? "lower" : "feet"}`, deps: ["asset.molde"],
    testes: [{ file: T_DEFAULT, testName: "sem peças, veste camiseta, jeans e tênis dos assets do FashionAI" }], validados: ["tee", "pants", "shoes"],
    parcial: (c) => (c.sub === "casual_sneakers" ? "a peça padrão dos pés usa a subcategoria \"sneakers\", que não existe na taxonomia (o molde sai certo por kindOf)" : null),
  },

  // ============================================================== Mangas
  {
    id: "manga.molde", grupo: "Mangas", nome: "Manga (comprimento no braço)", familias: TOPO,
    refs: [{ file: GARMENTS, symbol: "coverage" }, { file: GARMENTS, symbol: "sleeve:" }],
    aplica: (c) => (isCat(c, UP, FULL) || c.sub === "crop_top") && !SEM_MANGA.has(c.sub), produz: (o) => manga(o),
    sonda: { SLEEVE_LENGTH: ["SHORT_SLEEVE"] },
    params: (o) => `manga ${n(sp(o).sleeve, 2)} (0 ombro → 1 punho) · ${o.molde?.braco ?? 0} vért.`, asset: "peca-<id>", deps: ["asset.molde"],
    testes: [{ file: T_GARMENTS, testName: "shirt sleeves and back have fabric UV coverage" }, { file: T_MATRIX, testName: "mede as peças e grava o relatório" }], validados: ["tee", "shirt", "jacket", "coat", "sweater"],
    contrato: "vértices do braço da pele até arm = sleeve; transição de 3,5% do braço", lacuna: "manga em vestido/macacão só por atributo SLEEVE_LENGTH",
  },
  {
    id: "manga.comprimento-atributo", grupo: "Mangas", nome: "Comprimento pela dimensão SLEEVE_LENGTH", familias: TOPO,
    refs: [{ file: FIT, symbol: "SLEEVE_LEN" }, { file: FIT, symbol: "specFor" }],
    aplica: (c) => (isCat(c, UP, FULL) || c.sub === "crop_top") && !SEM_MANGA.has(c.sub), produz: (o) => manga(o), sonda: { SLEEVE_LENGTH: ["LONG_SLEEVE"] },
    params: (o) => `LONG_SLEEVE → ${n(sp(o).sleeve, 2)}`, deps: ["manga.molde"],
    testes: [{ file: T_ASSET, testName: "comprimentos das dimensões LENGTH e SLEEVE_LENGTH" }], validados: "todos",
  },
  {
    id: "manga.boca", grupo: "Mangas", nome: "Abertura da boca da manga (flare)", familias: TOPO,
    refs: [{ file: GARMENTS, symbol: "sp.flare * smooth(sp.sleeve * 0.3, sp.sleeve, P.arm[v])" }],
    aplica: (c) => (isCat(c, UP, FULL) || c.sub === "crop_top") && !SEM_MANGA.has(c.sub), produz: (o) => manga(o), sonda: { SLEEVE_LENGTH: ["SHORT_SLEEVE"] },
    params: (o) => `flare ${n(sp(o).flare, 3)} m/unid. (manga curta abre mais: ×1; longa ×0,3)`, deps: ["manga.molde"], testes: [], validados: [],
    lacuna: "sem teste que meça a abertura da boca da manga", impacto: 1,
  },
  {
    id: "manga.punho", grupo: "Mangas", nome: "Barra/punho da manga (faixa 3D)", familias: TOPO,
    refs: [{ file: TRIMS, symbol: "garmentTrims" }, { file: TRIMS, symbol: "trimWidth" }],
    aplica: (c) => (isCat(c, UP, FULL) || c.sub === "crop_top") && !SEM_MANGA.has(c.sub), produz: (o) => v(o, "punho") > 0, sonda: { SLEEVE_LENGTH: ["SHORT_SLEEVE"] },
    params: (o) => `${["sweater", "hoodie"].includes(o.kind ?? "") ? "ribana 45 mm" : "barra dobrada 14 mm"} · ${v(o, "punho")} vért. (2 lados)`,
    asset: "punho-<id>", deps: ["manga.molde"], testes: [{ file: T_LAYERS, testName: "hides long inner cuffs" }], validados: ["longsleeve"],
    contrato: "anel em volta do eixo ombro→punho em t = sleeve·L; raio = o da manga; pesos do braço mais próximo; cor trimColors().cuff",
  },
  {
    id: "manga.cava", grupo: "Mangas", nome: "Cava sem manga", familias: TOPO,
    refs: [{ file: GARMENTS, symbol: "if (g === 2 && sp.sleeve === 0) c *= inTorso" }],
    aplica: (c) => SEM_MANGA.has(c.sub) || S("bodysuit", "dress", "jumpsuit", "romper").has(c.sub), produz: (o) => !!o.molde && sp(o).sleeve === 0 && !Number.isNaN(sp(o).hem),
    params: () => "braço coberto só até o recorte do tronco", deps: ["asset.molde"], testes: [], validados: [],
    lacuna: "formato da cava não é parâmetro (vem do decote/tronco); sem teste próprio", impacto: 1,
  },
  {
    id: "manga.insercao", grupo: "Mangas", nome: "Tipo de inserção (raglan, ombro caído, dolman, bufante)", familias: TOPO, refs: [],
    aplica: (c) => (isCat(c, UP, FULL) || c.sub === "crop_top") && !SEM_MANGA.has(c.sub), deps: ["manga.molde"], testes: [], validados: [],
    lacuna: "SLEEVE_STYLE não é lido: toda manga nasce da pele do braço, sem costura de inserção nem volume", impacto: 2,
  },

  // ============================================================== Gola e decote
  {
    id: "decote.forma", grupo: "Gola e decote", nome: "Forma do decote (redondo, V, quadrado, canoa)", familias: TOPO,
    refs: [{ file: GARMENTS, symbol: "necklineH" }], aplica: (c) => isCat(c, UP, FULL) || c.sub === "crop_top",
    produz: (o) => !!o.molde && !Number.isNaN(sp(o).hem), params: (o) => `${sp(o).neckShape} · gola h=${n(sp(o).neck, 2)} · profundidade ${n(sp(o).vneck, 2)}`,
    deps: ["asset.molde"], testes: [{ file: T_GARMENTS, testName: "formas do decote" }, { file: T_GARMENTS, testName: "decote: mais baixo na frente" }], validados: "todos",
  },
  {
    id: "decote.atributo", grupo: "Gola e decote", nome: "Decote pela dimensão NECKLINE ou pelo nome", familias: TOPO,
    refs: [{ file: FIT, symbol: "necklineOf" }, { file: FIT, symbol: "NECK_WORDS" }], aplica: (c) => isCat(c, UP, FULL) || c.sub === "crop_top",
    produz: (o) => !!o.neckline, sonda: { NECKLINE: ["V_NECK"] }, params: (o) => `NECKLINE=V_NECK → ${sp(o).neckShape} ${n(sp(o).vneck, 2)}`, deps: ["decote.forma"],
    testes: [{ file: T_FIT, testName: "entra no molde" }], validados: "todos",
  },
  {
    id: "decote.foto", grupo: "Gola e decote", nome: "Profundidade do decote medida na foto", familias: TOPO,
    refs: [{ file: OUTFIT, symbol: "withPhotoNeckline" }, { file: GARMENTS, symbol: "neckDrop" }], aplica: (c) => COM_GOLA_FAIXA.has(c.sub),
    produz: (o) => !!o.kind && ["tee", "longsleeve", "tank", "crop", "sweater", "hoodie", "shirt", "dress", "jumpsuit", "romper"].includes(o.kind), params: () => "neckDrop × (gola − barra); só aprofunda",
    deps: ["decote.forma"], testes: [], validados: [], lacuna: "sem teste do aprofundamento pela foto", impacto: 1,
  },
  {
    id: "gola.faixa", grupo: "Gola e decote", nome: "Gola em faixa 3D (ribana) em volta do decote", familias: TOPO,
    refs: [{ file: GARMENTS, symbol: "collarBand" }, { file: GARMENTS, symbol: "HAS_COLLAR_BAND" }, { file: GARMENTS, symbol: "ribColor" }],
    aplica: (c) => COM_GOLA_FAIXA.has(c.sub), produz: (o) => o.gola > 0, params: (o) => `${o.gola} vért. · cor ribColor()`, asset: "gola-<id>", deps: ["decote.forma"],
    testes: [{ file: T_GARMENTS, testName: "a faixa fecha a volta" }, { file: T_GARMENTS, testName: "contorno suave e fechado" }], validados: ["tee", "shirt"],
    contrato: "anel sobre a borda do decote (frente, lados e nuca); pesos do pescoço/tronco; desenhado por cima da peça",
  },
  {
    id: "gola.pontas", grupo: "Gola e decote", nome: "Pontas da gola de camisa", familias: TOPO,
    refs: [{ file: TRIMS, symbol: "shirtPlacket" }, { file: TRIMS, symbol: "gola-ponta" }], aplica: isSub(CAMISA_BOTOES), produz: (o) => v(o, "gola-ponta") > 0,
    params: () => "2 quadriláteros ~5 × 3 cm deitados no peito", asset: "gola-ponta-<id>", deps: ["gola.faixa"],
    testes: [{ file: T_PLACKET, testName: "places seven buttons" }], validados: ["shirt"],
    parcial: () => "ponta plana (quadrilátero), sem pé de gola nem espessura", lacuna: "gola de camisa com pé e volume", impacto: 2,
  },
  {
    id: "gola.pe", grupo: "Gola e decote", nome: "Pé de gola", familias: TOPO, refs: [], aplica: isSub(PE_GOLA), deps: ["gola.faixa"], testes: [], validados: [],
    lacuna: "camisa e polo sem pé de gola (a gola é faixa de ribana ou ponta plana)", impacto: 2,
  },
  {
    id: "gola.polo", grupo: "Gola e decote", nome: "Gola polo (com vista de 2–3 botões)", familias: TOPO, refs: [{ file: "lib/avatar3d/human/upperwear.ts", symbol: "placketLength: .16" }, { file: TRIMS, symbol: "shirtPlacket" }], aplica: isSub(S("polo_shirt")),
    produz: (o) => (o.acabamentos.botoes ?? 0) === 39 && (o.acabamentos["gola-ponta"] ?? 0) > 0,
    deps: ["gola.faixa"], testes: [{ file: "lib/avatar3d/human/mould-library.test.ts", testName: "polo has three buttons" }], validados: ["shirt"],
    parcial: () => "gola em pontas trianguladas; pé de gola e tecido dobrado espesso ainda não modelados",
    lacuna: "a polo precisa de refinamento do volume da gola", impacto: 2,
  },
  {
    id: "gola.lapela", grupo: "Gola e decote", nome: "Lapela", familias: ["sobreposicao"], refs: [], aplica: isSub(LAPELA), deps: [], testes: [], validados: [],
    lacuna: "blazer e casaco sem lapela (a frente é a casca fechada)", impacto: 3,
  },

  // ============================================================== Botões
  {
    id: "botoes.disco", grupo: "Botões", nome: "Botões da vista (posição, quantidade, espaçamento)", familias: TOPO,
    refs: [{ file: TRIMS, symbol: "shirtPlacket" }, { file: TRIMS, symbol: "const count = gg.spec.placketLength ? 3 : 7" }], aplica: isSub(BOTOES_FRENTE),
    produz: (o) => v(o, "botoes") > 0, params: (o) => `${Math.round(v(o, "botoes") / 13)} discos de 5 mm · espaçamento uniforme do decote−4 cm à barra+4 cm · face +z`,
    asset: "botoes-<id>", deps: ["fechamento.vista"], testes: [{ file: T_PLACKET, testName: "places seven buttons" }], validados: ["shirt"],
    contrato: "centro em x=0 sobre a superfície da peça (+2,6 mm); orientação: disco no plano xy encarando +z",
    lacuna: "cardigã, blazer e casaco não têm botões", impacto: 2,
  },
  {
    id: "botoes.aro", grupo: "Botões", nome: "Aro do botão", familias: TOPO, refs: [{ file: TRIMS, symbol: "botoes-borda" }], aplica: isSub(CAMISA_BOTOES),
    produz: (o) => v(o, "botoes-borda") > 0, params: () => "anel 4,8–6,3 mm, escuro", asset: "botoes-borda-<id>", deps: ["botoes.disco"],
    testes: [{ file: T_PLACKET, testName: "places seven buttons" }], validados: ["shirt"],
  },
  {
    id: "botoes.fixacao", grupo: "Botões", nome: "Fixação do botão no tecido", familias: TOPO, refs: [{ file: TRIMS, symbol: "weightsNear" }],
    aplica: isSub(CAMISA_BOTOES), produz: (o) => v(o, "botoes") > 0, params: () => "pesos do vértice de tronco mais próximo (4 ossos, soma 1)", deps: ["botoes.disco", "vest.rig"],
    testes: [{ file: T_PLACKET, testName: "places seven buttons" }], validados: ["shirt"],
    parcial: () => "preso por pesos de pele, sem linha nem haste modeladas", lacuna: "linha de fixação (cruz/paralela) visível", impacto: 1,
  },

  // ============================================================== Casas e fechamento
  {
    id: "fechamento.vista", grupo: "Casas e fechamento", nome: "Vista/carcela frontal", familias: TOPO, refs: [{ file: TRIMS, symbol: "carcela" }],
    aplica: isSub(BOTOES_FRENTE), produz: (o) => v(o, "carcela") > 0, params: () => "tira de 18 mm do decote à barra, centrada em x=0", asset: "carcela-<id>", deps: ["asset.molde"],
    testes: [{ file: T_PLACKET, testName: "places seven buttons" }], validados: ["shirt"], lacuna: "cardigã, blazer e casaco sem vista", impacto: 2,
  },
  {
    id: "fechamento.casas", grupo: "Casas e fechamento", nome: "Casas de botão", familias: TOPO, refs: [], aplica: isSub(BOTOES_FRENTE), deps: ["botoes.disco"], testes: [], validados: [],
    lacuna: "nenhuma casa de botão modelada (nem textura)", impacto: 1,
  },
  {
    id: "fechamento.abertura", grupo: "Casas e fechamento", nome: "Abertura frontal (peça aberta na frente)", familias: ["sobreposicao"],
    refs: [{ file: CONTRACT, symbol: "fechamento (abertura frontal opcional; detalhes pela foto)" }], aplica: isSub(ABERTO_FRENTE), produz: (o) => !!o.molde && o.gola === 0,
    params: () => "sem faixa de gola; malha da frente contínua", deps: ["asset.molde"], testes: [{ file: T_GARMENTS, testName: "jaqueta e calçado não ganham faixa" }], validados: ["jacket"],
    parcial: () => "declarada aberta, mas a casca da frente é fechada (sem as duas bordas nem sobreposição)", lacuna: "frente aberta com bordas e sobreposição", impacto: 3,
  },
  {
    id: "fechamento.ziper", grupo: "Casas e fechamento", nome: "Zíper frontal", familias: ["sobreposicao"], refs: [], aplica: isSub(ZIPER_FRENTE), deps: [], testes: [], validados: [],
    lacuna: "zíper (fita + cursor) ausente", impacto: 1,
  },
  {
    id: "fechamento.braguilha", grupo: "Casas e fechamento", nome: "Braguilha e botão do cós", familias: ["inferior"], refs: [], aplica: isSub(CALCA_BRAGUILHA), deps: ["cintura.cos"], testes: [], validados: [],
    lacuna: "jeans e calças sem braguilha nem botão do cós", impacto: 2,
  },
  {
    id: "fechamento.amarracao", grupo: "Casas e fechamento", nome: "Amarração (cadarço)", familias: ["calcado"], refs: [{ file: SHOESF, symbol: "cadarco" }],
    aplica: isSub(CADARCO), produz: (o) => (o.calcado.cadarco ?? 0) > 0, params: (o) => `5 travessas · ${o.calcado.cadarco ?? 0} vért.`, asset: "cadarco-<id>", deps: ["calcado.cabedal"], testes: [], validados: [],
    lacuna: "cadarço só no estilo tênis e na peça \"shoes\": bota de cano curto/coturno e sapato social ficam sem; sem teste", impacto: 1,
  },
  {
    id: "fechamento.outros", grupo: "Casas e fechamento", nome: "Colchetes, velcro, fivelas e amarrações de roupa", familias: [...ROUPA], refs: [],
    aplica: (c) => c.variations.some((x) => /WRAP|TIE_FRONT|CORSET/.test(x)), deps: [], testes: [], validados: [],
    lacuna: "variações transpassadas (WRAP), amarradas (TIE_FRONT) e corset sem fechamento modelado", impacto: 1,
  },

  // ============================================================== Costuras
  {
    id: "costura.uniao", grupo: "Costuras", nome: "Costura que une painéis (ombro, lateral, manga, entrepernas)", familias: ROUPA, refs: [],
    aplica: (c) => !!c.kind, deps: ["asset.molde"], testes: [], validados: [],
    lacuna: "a peça é uma malha contínua sem painéis: nenhuma costura estrutural nem simulação de costura", impacto: 2,
  },
  {
    id: "costura.pesponto", grupo: "Costuras", nome: "Pesponto visual (linha decorativa)", familias: TOPO, refs: [{ file: TRIMS, symbol: "costura" }],
    aplica: isSub(CAMISA_BOTOES), produz: (o) => v(o, "costura") > 0, params: () => "2 fios de 1,2 mm nas bordas da carcela; cor da linha contrastando com o tecido",
    asset: "costura-<id>", deps: ["fechamento.vista"], testes: [{ file: T_PLACKET, testName: "places seven buttons" }], validados: ["shirt"],
    contrato: "fita 0,0012 m acima da carcela; só visual (não une malhas)",
  },
  {
    id: "costura.barra-tronco", grupo: "Costuras", nome: "Barra do tronco (faixa 3D)", familias: TOPO, refs: [{ file: TRIMS, symbol: "TORSO_HEM" }, { file: TRIMS, symbol: "garmentTrims" }],
    aplica: (c) => isCat(c, UP) || c.sub === "crop_top", produz: (o) => v(o, "barra") > 0,
    params: (o) => `${["sweater", "hoodie"].includes(o.kind ?? "") ? "ribana 50 mm" : "barra dobrada 16 mm"} na altura h=${n(sp(o).hem, 2)}`, asset: "barra-<id>", deps: ["asset.molde"],
    testes: [{ file: T_LAYERS, testName: "uses the actual length of a coat to cover the inner hem" }], validados: ["longsleeve"],
    lacuna: "jaqueta, casaco, colete e blazer sem barra 3D (TORSO_HEM não os inclui)", impacto: 1,
  },
  {
    id: "costura.barra-perna", grupo: "Costuras", nome: "Barra da perna", familias: BAIXO, refs: [{ file: GARMENTS, symbol: "sp.leg - dl" }],
    aplica: (c) => (isCat(c, LOW) && !SAIA_TUBO.has(c.sub)) || S("jumpsuit", "romper", "overalls", "matching_set").has(c.sub), produz: (o) => (o.molde?.perna ?? 0) > 0,
    params: (o) => `perna até ${n(sp(o).leg, 2)} (0 quadril → 1 tornozelo); borda por alfa (2% da perna)`, deps: ["asset.molde"], testes: [], validados: [],
    parcial: () => "a barra é só o recorte suave do alfa: sem faixa dobrada nem espessura", lacuna: "barra 3D da calça/shorts (como a do tronco)", impacto: 2,
  },
  {
    id: "costura.barra-saia", grupo: "Costuras", nome: "Barra da saia/vestido (fim do tubo)", familias: BAIXO, refs: [{ file: GARMENTS, symbol: "skirtTube" }],
    aplica: isSub(SAIA_TUBO), produz: (o) => (o.molde?.tubo ?? 0) > 0, params: (o) => `comprimento ${n(sp(o).skirt, 2)} m · abertura ${n(sp(o).flare, 2)}`, deps: ["corpo.tubo"],
    testes: [], validados: [], parcial: () => "tubo rígido termina sem bainha (sem espessura)", lacuna: "bainha da saia", impacto: 1,
  },

  // ============================================================== Corpo da peça
  {
    id: "corpo.folga", grupo: "Corpo da peça", nome: "Largura/folga do corpo e sobreposição", familias: ROUPA, refs: [{ file: GARMENTS, symbol: "underLayer" }, { file: GARMENTS, symbol: "ease:" }],
    aplica: (c) => !!c.kind, produz: (o) => !!o.molde, params: (o) => `folga ${mm(sp(o).ease)} + camadas de baixo · camada ${sp(o).layer}`, deps: ["asset.molde"],
    testes: [{ file: T_GARMENTS, testName: "outer layers clear the accumulated thickness" }, ...PENETRACAO.slice(0, 2)], validados: VALIDADOS_PENETRACAO,
  },
  {
    id: "corpo.caimento", grupo: "Corpo da peça", nome: "Caimento do busto e peito (cai reto, não desenha o corpo)", familias: TOPO,
    refs: [{ file: GARMENTS, symbol: "hullRing" }, { file: GARMENTS, symbol: "bustFall" }], aplica: (c) => isCat(c, UP, FULL) || c.sub === "crop_top",
    produz: (o) => !!o.molde && sp(o).drape > 0, params: (o) => `drape ${n(sp(o).drape, 2)} · queda até ${n(sp(o).bustFall, 3)}× o anel do busto`, deps: ["asset.molde"],
    testes: [{ file: T_ASSET, testName: "justa acompanha o corpo, regular cai reta" }, { file: T_MATRIX, testName: "mede as peças e grava o relatório" }], validados: ["tee", "shirt", "sweater", "hoodie", "jacket", "dress"],
  },
  {
    id: "corpo.comprimento", grupo: "Corpo da peça", nome: "Comprimento (barra) pela dimensão LENGTH", familias: ROUPA, refs: [{ file: FIT, symbol: "SKIRT_LEN" }, { file: FIT, symbol: "LEG_LEN" }],
    aplica: (c) => !!c.kind && c.family !== "calcado", produz: (o) => !!o.molde, params: (o) => `barra h=${n(sp(o).hem, 2)} · perna ${n(sp(o).leg, 2)} · saia ${n(sp(o).skirt, 2)} m`, deps: ["asset.molde"],
    testes: [{ file: T_ASSET, testName: "comprimentos das dimensões LENGTH e SLEEVE_LENGTH" }], validados: "todos",
  },
  {
    id: "corpo.silhueta", grupo: "Corpo da peça", nome: "Silhueta por classe de caimento (justa/regular/oversized/estruturada/fluida)", familias: ROUPA,
    refs: [{ file: FIT, symbol: "fitClassOf" }, { file: FIT, symbol: "VARIATION_FIT" }], aplica: (c) => !!c.kind && c.family !== "calcado", produz: (o) => !!o.fit,
    params: (o) => `classe ${o.fit}`, deps: ["corpo.folga", "corpo.caimento"], testes: [{ file: T_ASSET, testName: "vem da variação declarada" }], validados: "todos",
  },
  {
    id: "corpo.tubo", grupo: "Corpo da peça", nome: "Tubo da saia/vestido/casaco longo", familias: BAIXO.concat(["sobreposicao"]), refs: [{ file: GARMENTS, symbol: "skirtTube" }, { file: GARMENTS, symbol: "tubeRadius" }],
    aplica: (c) => SAIA_TUBO.has(c.sub) || c.sub === "coat" || c.sub === "parka", produz: (o) => (o.molde?.tubo ?? 0) > 0 && sp(o).skirt > 0, params: (o) => `${o.molde?.tubo ?? 0} vért. · 64 ângulos · flare ${n(sp(o).flare, 2)}`,
    deps: ["asset.molde"], testes: [{ file: T_GARMENTS, testName: "a blusa passa por fora da saia" }, { file: T_MATRIX, testName: "mede as peças e grava o relatório" }], validados: ["skirt", "dress", "coat"],
    contrato: "anéis em volta do eixo (0, torsoZ) da cintura para baixo; pesos quadril + coxas divididos pelo lado",
  },
  {
    id: "corpo.envelope-barra", grupo: "Corpo da peça", nome: "Envelope contínuo abaixo do quadril (barra longa de camisa/jaqueta)", familias: TOPO,
    refs: [{ file: GARMENTS, symbol: "shortHem" }], aplica: (c) => isCat(c, UP) && !S("crop_top", "coat", "parka").has(c.sub),
    produz: (o) => (o.molde?.tubo ?? 0) > 0 && sp(o).skirt === 0, params: (o) => `barra h=${n(sp(o).hem, 2)} < 0 → tubo até h=0,07`, deps: ["asset.molde"],
    testes: [{ file: T_GARMENTS, testName: "continuous hip-bound hem" }], validados: ["shirt", "jacket"],
  },
  {
    id: "corpo.recortes", grupo: "Corpo da peça", nome: "Painéis frente/costas e recortes", familias: ROUPA, refs: [],
    aplica: (c) => !!c.kind && c.family !== "calcado", deps: ["costura.uniao"], testes: [], validados: [],
    lacuna: "frente e costas são regiões da mesma casca (a foto vai na frente, as costas na cor do tecido); sem recortes/painéis", impacto: 2,
  },

  // ============================================================== Cintura e acabamento
  {
    id: "cintura.cos", grupo: "Cintura e acabamento", nome: "Altura do cós", familias: BAIXO, refs: [{ file: GARMENTS, symbol: "waist:" }],
    aplica: (c) => isCat(c, LOW) || S("jumpsuit", "romper", "overalls", "matching_set").has(c.sub), produz: (o) => !!o.molde && !Number.isNaN(sp(o).waist),
    params: (o) => `cós em h=${n(sp(o).waist, 2)}${o.spec?.construction ? ` (${o.spec.construction})` : ""}`, deps: ["asset.molde"],
    testes: [{ file: T_LAYERS, testName: "does not move the waistband" }, { file: T_GARMENTS, testName: "raises the waist" }], validados: ["pants"],
    parcial: () => "o cós é só onde a casca começa: sem faixa dobrada, espessura ou costura", lacuna: "cós como faixa 3D", impacto: 2,
  },
  {
    id: "cintura.elastico", grupo: "Cintura e acabamento", nome: "Cós elástico/franzido", familias: ["inferior"], refs: [], aplica: isSub(COS_ELASTICO), deps: ["cintura.cos"], testes: [], validados: [],
    lacuna: "jogger, moletom e legging sem cós elástico", impacto: 1,
  },
  {
    id: "cintura.passantes", grupo: "Cintura e acabamento", nome: "Passantes", familias: ["inferior"], refs: [], aplica: isSub(PASSANTES), deps: ["cintura.cos"], testes: [], validados: [],
    lacuna: "passantes ausentes", impacto: 1,
  },
  {
    id: "cintura.gancho", grupo: "Cintura e acabamento", nome: "Gancho e entrepernas", familias: BAIXO, refs: [{ file: GARMENTS, symbol: "if (g === 3 && sp.leg > 0)" }],
    aplica: (c) => (isCat(c, LOW) && !SAIA_TUBO.has(c.sub)) || S("jumpsuit", "romper", "overalls", "matching_set").has(c.sub), produz: (o) => (o.molde?.perna ?? 0) > 0,
    params: () => "segue a pele do quadril e das coxas", deps: ["asset.molde"], testes: [{ file: T_MATRIX, testName: "mede as peças e grava o relatório" }], validados: ["pants"],
    parcial: () => "o gancho é a própria pele afastada: sem profundidade de gancho nem folga entre as pernas", lacuna: "gancho com profundidade (RISE)", impacto: 2,
  },
  {
    id: "cintura.perna-coluna", grupo: "Cintura e acabamento", nome: "Perna em coluna (cai reta do joelho)", familias: BAIXO, refs: [{ file: RELAXF, symbol: "columnLegs" }, { file: GARMENTS, symbol: "legColumn" }],
    // legging (justa) e shorts curtos acompanham a perna por definição
    aplica: (c) => (isCat(c, LOW) && !SAIA_TUBO.has(c.sub) && !S("leggings", "shorts", "denim_shorts").has(c.sub)) || S("jumpsuit", "overalls").has(c.sub), produz: (o) => !!o.molde && sp(o).legColumn > 0 && sp(o).leg > 0,
    params: (o) => `legColumn ${n(sp(o).legColumn, 2)} (0 acompanha, 1 reta, >1 ampla)`, deps: ["asset.molde"], testes: [{ file: T_MATRIX, testName: "mede as peças e grava o relatório" }], validados: ["pants"],
  },
  {
    id: "cintura.forro", grupo: "Cintura e acabamento", nome: "Forro", familias: ["sobreposicao"], refs: [], aplica: isSub(FORRO), deps: [], testes: [], validados: [],
    lacuna: "sem forro (interior da peça é a mesma face, DoubleSide)", impacto: 1,
  },
  {
    id: "cintura.punho-perna", grupo: "Cintura e acabamento", nome: "Punho na barra da perna", familias: ["inferior"], refs: [], aplica: isSub(PUNHO_PERNA), deps: ["costura.barra-perna"], testes: [], validados: [],
    lacuna: "jogger e calça de moletom sem punho de ribana no tornozelo", impacto: 2,
  },

  // ============================================================== Detalhes
  { id: "detalhe.bolsos", grupo: "Detalhes", nome: "Bolsos", familias: ROUPA, refs: [], aplica: isSub(BOLSOS), deps: [], testes: [], validados: [], lacuna: "nenhum bolso modelado (cargo muda folga e cós, não bolsos)", impacto: 2 },
  { id: "detalhe.capuz", grupo: "Detalhes", nome: "Capuz", familias: ["superior", "sobreposicao"], refs: [], aplica: isSub(CAPUZ), deps: [], testes: [], validados: [], lacuna: "moletom com capuz sai sem capuz", impacto: 3 },
  {
    id: "detalhe.alcas", grupo: "Detalhes", nome: "Alças", familias: TOPO, refs: [{ file: GARMENTS, symbol: "necklineH" }], aplica: isSub(ALCAS),
    // colete: o ombro é o corpo da peça (cava de alfaiataria), não alça
    produz: (o) => !!o.spec && o.spec.sleeve === 0 && o.kind !== "vest" && (o.molde?.ombro ?? 0) > 0, params: (o) => `${o.molde?.ombro ?? 0} vért. na linha do ombro`, deps: ["decote.forma", "manga.cava"], testes: [{ file: "lib/avatar3d/human/mould-library.test.ts", testName: "straps cross the shoulders" }], validados: ["tank", "dress", "jumpsuit"],
    parcial: () => "a alça é o que sobra entre decote e cava: largura não é parâmetro",
    lacuna: "sem alça: a casca termina abaixo dos ombros (gola h=0,9) e a peça sai tomara-que-caia — regata, body, vestido, macacão e jardineira", impacto: 3,
  },
  { id: "detalhe.pregas", grupo: "Detalhes", nome: "Pregas, pences, franzidos e babados", familias: ROUPA, refs: [], aplica: isSub(PREGAS), deps: [], testes: [], validados: [], lacuna: "volume só pelo flare do tubo; sem pregas/franzidos", impacto: 1 },
  { id: "detalhe.fenda", grupo: "Detalhes", nome: "Fendas", familias: BAIXO, refs: [], aplica: isSub(FENDA), deps: [], testes: [], validados: [], lacuna: "HEM=SLIT não é lido", impacto: 1 },
  {
    id: "detalhe.dobras", grupo: "Detalhes", nome: "Dobras do tecido", familias: ROUPA, refs: [{ file: RELAXF, symbol: "foldGarment" }], aplica: (c) => !!c.kind && c.family !== "calcado",
    produz: (o) => !!o.molde, params: () => "dobras procedurais após o relaxamento", deps: ["vest.relaxamento"], testes: [], validados: [], lacuna: "sem teste próprio das dobras", impacto: 1,
  },
  { id: "detalhe.enchimento", grupo: "Detalhes", nome: "Enchimento/estrutura (puffer, ombreira)", familias: ["sobreposicao"], refs: [], aplica: isSub(ENCHIMENTO), deps: [], testes: [], validados: [], lacuna: "parka e puffer com a mesma casca da jaqueta", impacto: 1 },

  // ============================================================== Aparência
  {
    id: "aparencia.uv-frente", grupo: "Aparência", nome: "UV da frente (foto projetada)", familias: ROUPA, refs: [{ file: GARMENTS, symbol: "texturedGeometry" }, { file: GARMENTS, symbol: "photoInfo" }],
    aplica: (c) => !!c.kind && c.family !== "calcado", produz: (o) => !!o.molde, params: () => "projeção frontal na pose de exibição: gola↔topo, barra↔pé, largura do tronco↔largura da foto",
    deps: ["asset.molde"], testes: [{ file: T_GARMENT, testName: "a foto só vai para as faces que encaram a câmera" }, { file: T_GARMENT, testName: "estiramento da estampa limitado" }], validados: ["tee", "sweater", "dress", "pants", "skirt"],
    contrato: "UV = posição projetada (x, y) na caixa da peça na foto; triângulos de trás/lados com UV num canto de cor lisa",
  },
  {
    id: "aparencia.uv-tecido", grupo: "Aparência", nome: "UV de tecido (costas, laterais e mangas)", familias: ROUPA, refs: [{ file: GARMENTS, symbol: "fabricMapping" }, { file: PHOTO, symbol: "fabricTile" }],
    aplica: (c) => !!c.kind && c.family !== "calcado", produz: (o) => !!o.molde, params: () => "amostra de tecido da própria foto repetida nas costas e mangas", deps: ["aparencia.uv-frente"],
    testes: [{ file: T_GARMENTS, testName: "shirt sleeves and back have fabric UV coverage" }], validados: ["shirt"],
  },
  {
    id: "aparencia.material", grupo: "Aparência", nome: "Material físico (rugosidade, brilho)", familias: ROUPA, refs: [{ file: GARMENTS, symbol: "garmentMaterial" }],
    aplica: (c) => !!c.kind && c.family !== "calcado", produz: (o) => !!o.molde, params: () => "MeshPhysicalMaterial por tipo (cargo fosco)", deps: [],
    testes: [{ file: T_GARMENTS, testName: "uses matte workwear material" }], validados: ["pants"], lacuna: "MATERIAL do cadastro (jeans, couro, seda) não muda o material", impacto: 2,
  },
  {
    id: "aparencia.cor", grupo: "Aparência", nome: "Cor do tecido e dos acabamentos", familias: [...ROUPA, "calcado"], refs: [{ file: GARMENTS, symbol: "fabricColor" }, { file: GARMENTS, symbol: "trimColors" }, { file: GARMENTS, symbol: "shoeColors" }],
    aplica: (c) => !!c.kind, produz: () => true, params: () => "mediana da foto dentro da peça (nunca do fundo); sem foto, a cor do cadastro", deps: [],
    testes: [{ file: T_PHOTO, testName: "" }], validados: "todos",
  },
  {
    id: "aparencia.estampa", grupo: "Aparência", nome: "Estampa e logo", familias: ROUPA, refs: [{ file: GARMENTS, symbol: "garmentTexture" }], aplica: (c) => !!c.kind && c.family !== "calcado",
    produz: (o) => !!o.molde, params: () => "só pela foto da frente", deps: ["aparencia.uv-frente"], testes: [{ file: T_GARMENT, testName: "a foto só vai para as faces que encaram a câmera" }], validados: ["tee", "sweater", "dress", "pants", "skirt"],
    parcial: () => "estampa só na frente (as costas nunca recebem estampa inventada)", lacuna: "foto das costas para estampa traseira", impacto: 1,
  },
  { id: "aparencia.relevo", grupo: "Aparência", nome: "Bordado, relevo e trama (mapa normal)", familias: ROUPA, refs: [], aplica: (c) => !!c.kind && c.family !== "calcado", deps: [], testes: [], validados: [], lacuna: "maps.normal = null no contrato", impacto: 1 },
  {
    id: "aparencia.transparencia", grupo: "Aparência", nome: "Transparência", familias: ROUPA, refs: [{ file: GARMENTS, symbol: "alpha" }], aplica: (c) => !!c.kind && c.family !== "calcado",
    produz: (o) => !!o.molde, params: () => "alfa só nas bordas (barra, gola, punho)", deps: [], testes: [], validados: [], parcial: () => "tecido translúcido não existe: alfa só recorta bordas", impacto: 1,
  },

  // ============================================================== Vestibilidade
  {
    id: "vest.rig", grupo: "Vestibilidade", nome: "Rig e pesos (cópia da pele)", familias: [...ROUPA, "calcado"], refs: [{ file: GARMENTS, symbol: "skinWeight[v * 4 + k]" }],
    aplica: (c) => !!c.kind, produz: (o) => !!o.molde || (o.calcado.cabedal ?? 0) > 0, params: () => "4 ossos por vértice, soma 1; tubo: quadril + coxas", deps: ["asset.corpo"],
    testes: [{ file: T_GARMENTS, testName: "o molde herda os pesos do corpo" }], validados: "todos",
  },
  {
    id: "vest.relaxamento", grupo: "Vestibilidade", nome: "Relaxamento do tecido", familias: [...ROUPA, "calcado"], refs: [{ file: RELAXF, symbol: "relaxGarment" }, { file: RELAXF, symbol: "RELAX" }],
    aplica: (c) => !!c.kind, produz: (o) => !!o.molde, params: (o) => `${o.relax ?? 0} iterações`, deps: ["asset.molde"], testes: [{ file: T_MATRIX, testName: "mede as peças e grava o relatório" }], validados: ["tee", "pants", "dress"],
  },
  {
    id: "vest.camadas", grupo: "Vestibilidade", nome: "Camadas e oclusão da peça de baixo", familias: [...ROUPA], refs: [{ file: LAYERS, symbol: "occludeInnerGarment" }, { file: LAYERS, symbol: "visibleGarmentFinishes" }],
    aplica: (c) => !!c.kind && c.family !== "calcado", produz: (o) => !!o.molde, params: (o) => `camada ${sp(o).layer}`, deps: ["corpo.folga"],
    testes: [{ file: T_LAYERS, testName: "keeps the neckline, longer tail and longer sleeves exposed" }, { file: T_GARMENTS, testName: "a peça de cima passa por fora da de baixo na cintura" }], validados: ["tee", "longsleeve", "jacket", "coat", "pants"],
  },
  {
    id: "vest.colisao", grupo: "Vestibilidade", nome: "Colisão corpo–roupa (penetração)", familias: [...ROUPA, "calcado"], refs: [{ file: CONTRACT, symbol: "COLLISION_MARGIN_MM" }, { file: "lib/avatar3d/human/fit-metrics.ts", symbol: "fitReport" }],
    aplica: (c) => !!c.kind, produz: (o) => !!o.molde, params: () => "margem 2 mm; tolerância por pose (exibição 3%, agachamento 6%)", deps: ["corpo.folga"], testes: PENETRACAO, validados: VALIDADOS_PENETRACAO,
  },
  {
    id: "vest.pose", grupo: "Vestibilidade", nome: "Braços abertos por camada/saia", familias: [...ROUPA], refs: [{ file: GARMENTS, symbol: "armOutFor" }], aplica: (c) => !!c.kind && c.family !== "calcado",
    produz: () => true, params: () => "10° a 22° conforme espessura na axila; saia rodada 15°", deps: [], testes: [{ file: T_GARMENTS, testName: "camadas grossas e saia rodada abrem os braços" }], validados: "todos",
  },
  { id: "vest.simulacao", grupo: "Vestibilidade", nome: "Simulação física do tecido", familias: [...ROUPA], refs: [], aplica: (c) => !!c.kind && c.family !== "calcado", deps: [], testes: [], validados: [], lacuna: "sem simulação: a roupa segue o esqueleto (skinning)", impacto: 2 },

  // ============================================================== Calçados
  {
    id: "calcado.cabedal", grupo: "Calçados", nome: "Cabedal com bico e contraforte", familias: ["calcado"], refs: [{ file: SHOESF, symbol: "upperOf" }], aplica: (c) => c.family === "calcado",
    produz: (o) => (o.calcado.cabedal ?? 0) > 0, params: (o) => `estilo ${o.shoeStyle}`, asset: "cabedal-<id>", deps: ["asset.forma-calcado"], testes: [{ file: T_GARMENTS, testName: "camiseta, calça, vestido e tênis não atravessam o corpo" }], validados: ["shoes"],
    parcial: (c) => (c.variations.some((x) => /POINTED|SQUARE/.test(x)) ? "TOE_SHAPE não é lido: bico sempre arredondado" : null),
  },
  {
    id: "calcado.sola", grupo: "Calçados", nome: "Sola (entressola e solado)", familias: ["calcado"], refs: [{ file: SHOESF, symbol: "SOLE_HEEL" }, { file: SHOESF, symbol: "SOLE_FORE" }], aplica: (c) => c.family === "calcado",
    produz: (o) => (o.calcado.sola ?? 0) > 0, params: (o) => `${o.shoeStyle === "low" ? "fina (×0,55)" : "20 mm calcanhar / 14 mm frente"} · toe spring`, asset: "sola-<id>", deps: ["asset.forma-calcado"],
    testes: [{ file: T_MATRIX, testName: "mede as peças e grava o relatório" }], validados: ["boots"],
  },
  {
    id: "calcado.colarinho", grupo: "Calçados", nome: "Colarinho (abertura do tornozelo)", familias: ["calcado"], refs: [{ file: SHOESF, symbol: "colarinho" }, { file: SHOESF, symbol: "upperOf" }],
    aplica: (c) => c.family === "calcado" && !TIRAS.has(c.sub), produz: (o) => (o.kind === "boots" ? (o.calcado.colarinho ?? 0) : (o.calcado.cabedal ?? 0)) > 0,
    params: (o) => (o.kind === "boots" ? `anel acolchoado na junção do cano com a fôrma · ${o.calcado.colarinho ?? 0} vért.` : "borda do cabedal"), asset: "colarinho-<id> (bota) / cabedal-<id>", deps: ["calcado.cabedal"], testes: [], validados: [],
    parcial: (c, o) => (o.kind === "shoes" ? "tênis/sapato: a abertura é a borda do cabedal, sem acolchoado" : null), lacuna: "colarinho acolchoado do tênis; sem teste", impacto: 1,
  },
  {
    id: "calcado.cano", grupo: "Calçados", nome: "Cano da bota", familias: ["calcado"], refs: [{ file: FIT, symbol: "SHAFT_SUB" }, { file: GARMENTS, symbol: "shaft" }], aplica: isSub(CANO),
    produz: (o) => o.kind === "boots" && (o.molde?.perna ?? 0) > 0, params: (o) => `cano a partir de ${n(sp(o).shaft, 2)} da perna`, deps: ["asset.molde", "calcado.cabedal"],
    testes: [{ file: T_ASSET, testName: "cano da bota pela subcategoria" }], validados: ["boots"],
  },
  { id: "calcado.lingueta", grupo: "Calçados", nome: "Lingueta e ilhoses", familias: ["calcado"], refs: [], aplica: isSub(CADARCO), deps: ["fechamento.amarracao"], testes: [], validados: [], lacuna: "cadarço passa por cima do cabedal liso", impacto: 1 },
  { id: "calcado.salto", grupo: "Calçados", nome: "Salto", familias: ["calcado"], refs: [], aplica: isSub(SALTO), deps: [], testes: [], validados: [], lacuna: "salto alto vira sapato baixo (KNOWN_LIMITS)", impacto: 3 },
  { id: "calcado.tiras", grupo: "Calçados", nome: "Tiras abertas (sandália, chinelo)", familias: ["calcado"], refs: [], aplica: isSub(TIRAS), deps: [], testes: [], validados: [], lacuna: "sandália e chinelo viram sapato fechado (KNOWN_LIMITS)", impacto: 3 },
  { id: "calcado.palmilha", grupo: "Calçados", nome: "Palmilha visível", familias: ["calcado"], refs: [], aplica: isSub(PALMILHA_VISIVEL), deps: [], testes: [], validados: [], lacuna: "sem palmilha (só importa em calçado aberto/baixo)", impacto: 1 },

  // ============================================================== Acessórios
  {
    id: "acc.previa", grupo: "Acessórios", nome: "Prévia 2D (o avatar não veste)", familias: ["acessorio"], refs: [{ file: CONTRACT, symbol: "IMAGE_2D" }, { file: ASSETF, symbol: "acessorio_sem_molde_3d" }],
    aplica: (c) => c.family === "acessorio", produz: (o) => !o.kind, params: () => "estado SEM_3D", deps: ["asset.contrato"],
    testes: [{ file: T_ASSET, testName: "acessório é SEM_3D" }], validados: "todos",
  },
  { id: "acc.fixacao", grupo: "Acessórios", nome: "Fixação no corpo (osso âncora)", familias: ["acessorio"], refs: [], aplica: (c) => c.family === "acessorio" && c.sub !== "socks", deps: [], testes: [], validados: [], lacuna: "estratégia \"fixo-no-osso\" declarada em STRATEGIES, sem implementação", impacto: 2 },
  { id: "acc.alcas", grupo: "Acessórios", nome: "Alças e tiras", familias: ["acessorio"], refs: [], aplica: isSub(ACC_ALCAS), deps: ["acc.fixacao"], testes: [], validados: [], lacuna: "alças ausentes", impacto: 1 },
  { id: "acc.fechos", grupo: "Acessórios", nome: "Fivelas e fechos", familias: ["acessorio"], refs: [], aplica: isSub(ACC_FECHO), deps: ["acc.fixacao"], testes: [], validados: [], lacuna: "fivelas e fechos ausentes", impacto: 1 },
  { id: "acc.rigido", grupo: "Acessórios", nome: "Partes rígidas (armação, caixa, metal)", familias: ["acessorio"], refs: [], aplica: isSub(ACC_RIGIDO), deps: ["acc.fixacao"], testes: [], validados: [],
    lacuna: "óculos 3D só os da foto de perfil (glasses-3d.ts, identidade do avatar), não a peça do catálogo", impacto: 1 },
  { id: "acc.meia", grupo: "Acessórios", nome: "Meia (dentro do calçado)", familias: ["acessorio"], refs: [], aplica: isSub(S("socks")), deps: [], testes: [], validados: [], lacuna: "meia não aparece (cano pela SHAFT_HEIGHT não é usado)", impacto: 1 },
];

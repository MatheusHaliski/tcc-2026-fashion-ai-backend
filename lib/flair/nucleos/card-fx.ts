/**
 * Efeito de entrada da carta (docs/flair/flair-3d/DESENHO_DA_TELA.md, seção 4): ao vestir na preparação, o clarão na
 * cor do nível, o selo do efeito e a Aura Hype. Tudo sai do que o servidor já calculou (POST .../efeitos); aqui nada
 * muda a nota. Puro: a tela só desenha o que estas funções devolvem.
 */
import type { FlairCollectionCard, FlairTier } from "@/components/flair/flair-game-card";
import type { EfeitoItem } from "@/lib/flair/nucleos/types";

/** Cor do clarão por nível: bronze, prata, ouro e o violeta do Especial. */
export const COR_DO_NIVEL: Record<FlairTier, string> = {
  BRONZE: "#B07A52",
  PRATA: "#9DA3AA",
  OURO: "#E0B04D",
  ESPECIAL: "#7B4FD6",
};

/** Hype a partir do qual a carta ganha os anéis de luz no piso. */
export const HYPE_ALTO = 80;
/** Duração máxima do efeito de entrada, em ms. */
export const ENTRADA_MS = 1000;

export type SomDeEntrada = "tecido" | "metal" | "abafado";

export interface EntradaFx {
  cardId: string;
  vaga: string;
  tier: FlairTier;
  cor: string;
  /** true = pontua; false = não pontua (sem clarão, selo cinza com o motivo); null = o servidor ainda não disse */
  pontua: boolean | null;
  selo: EfeitoItem | null;
  /** código do motivo de a carta não pontuar (MARCA_NAO_BR, FORA_DA_FAMILIA, SEM_BONUS...), quando o servidor diz */
  motivo: string | null;
  aura: boolean;
  som: SomDeEntrada;
  /** o efeito que a cor da peça dá neste jogo (some com a carta que não tem cor com efeito) */
  efeitoDaCor: EfeitoItem | null;
  /** a cor da família na tela, para o pulso de luz */
  corDaPeca: string | null;
}

/** Efeito da cor da peça no jogo: "COR_<ação>" (efeito de cena ou ação do detetive) e "ACAO_<ação>" (esporte). */
const DE_COR = /^(COR|ACAO)_/;

/** Cor na tela de cada família, na ordem do servidor (Flair3dCores.FAMILIAS): preto, verde, amarelo, azul, vermelho, branco. */
export const COR_DA_FAMILIA = ["#3A3A44", "#2F7A45", "#E8C93C", "#2A5FA8", "#C62B28", "#F3EFE7"];

/** O efeito que a cor da peça dá neste jogo, quando o servidor mandou um. */
export function efeitoDaCor(itens: EfeitoItem[] | undefined): EfeitoItem | null {
  return itens?.find((i) => DE_COR.test(i.codigo) && !i.motivo) ?? null;
}

/** A cor na tela do efeito da cor (o valor do item é a posição da família, de 1 a 6). */
export function corDoEfeito(item: EfeitoItem | null): string | null {
  const i = typeof item?.valor === "number" ? Math.round(item.valor) - 1 : -1;
  return COR_DA_FAMILIA[i] ?? null;
}

function vale(item: EfeitoItem): boolean {
  if (item.motivo || item.codigo.startsWith("COR_")) return false;
  return typeof item.valor === "number" ? item.valor > 0 : String(item.valor).trim() !== "";
}

/** O efeito principal da carta neste jogo: o primeiro que vale alguma coisa. */
export function seloDaCarta(itens: EfeitoItem[] | undefined): EfeitoItem | null {
  return itens?.find(vale) ?? null;
}

/** A carta pontua neste jogo? Sem a resposta dos efeitos, não se afirma nada (null). */
export function pontua(itens: EfeitoItem[] | undefined): boolean | null {
  if (!itens) return null;
  return itens.some(vale);
}

/** O motivo de a carta não pontuar neste jogo (item com `motivo: true`), quando o servidor mandou um. */
export function motivoDaCarta(itens: EfeitoItem[] | undefined): string | null {
  return itens?.find((i) => i.motivo === true)?.codigo ?? null;
}

export function auraHype(card: Pick<FlairCollectionCard, "hype" | "rare">): boolean {
  return card.rare || (card.hype?.HYP ?? 0) >= HYPE_ALTO;
}

const METAL = /metal|corrente|joia|jóia|brinco|colar|anel|pulseira|relogio|relógio|cinto|oculos|óculos/i;
/** Materiais (como o servidor grava em `tags.materials`, em minúsculas) que soam como metal. */
const MATERIAL_METAL = /metal|steel|gold|silver|chain|aço|ouro|prata/i;

/**
 * Som da peça ao entrar: o material principal da carta (`tags.materials[0]`) decide entre metal e tecido; carta sem
 * material cai no nome e na categoria (joias e ferragens soam como metal).
 */
export function materialDoSom(card: Pick<FlairCollectionCard, "name" | "category" | "subcategory" | "tags">): "tecido" | "metal" {
  const material = card.tags?.materials?.[0];
  if (material) return MATERIAL_METAL.test(material) ? "metal" : "tecido";
  const texto = `${card.subcategory ?? ""} ${card.category ?? ""} ${card.name}`;
  return METAL.test(texto) ? "metal" : "tecido";
}

export function entradaDaCarta(card: FlairCollectionCard, vaga: string, itens: EfeitoItem[] | undefined): EntradaFx {
  const marca = pontua(itens);
  return {
    cardId: card.id,
    vaga,
    tier: card.tier,
    cor: COR_DO_NIVEL[card.tier],
    pontua: marca,
    selo: seloDaCarta(itens),
    motivo: marca === false ? motivoDaCarta(itens) : null,
    aura: auraHype(card),
    som: marca === false ? "abafado" : materialDoSom(card),
    efeitoDaCor: efeitoDaCor(itens),
    corDaPeca: corDoEfeito(efeitoDaCor(itens)),
  };
}

/** Vagas que ganharam uma carta nova (vestir ou trocar) entre duas seleções; tirar não dá efeito de entrada. */
export function cartasVestidas(antes: Record<string, string>, depois: Record<string, string>): { vaga: string; cardId: string }[] {
  const out: { vaga: string; cardId: string }[] = [];
  for (const [vaga, cardId] of Object.entries(depois)) {
    if (antes[vaga] !== cardId) out.push({ vaga, cardId });
  }
  return out;
}

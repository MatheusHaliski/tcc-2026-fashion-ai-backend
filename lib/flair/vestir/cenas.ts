/**
 * Desafios de Montagem "vestir a cena": a cena é uma imagem (a metade ANTES da arte) e cada vaga é um personagem.
 * Quando a carta certa entra na vaga — a que o servidor aceitou em /check para aquela roupa — o personagem aparece com a
 * roupa exata da metade DEPOIS (um recorte RGBA só da roupa dele); com as quatro vagas certas, a cena vira a metade
 * DEPOIS inteira. O manifesto (cenas.json) e os recortes (public/flair/desafios/<cenario>/) são gerados por
 * scripts/flair/vestir_mascaras.py a partir das imagens em scripts/flair/vestir/fontes/.
 */
import manifesto from "@/lib/flair/vestir/cenas.json";

export interface PessoaDaCena { vaga: string; x: number; y: number; w: number; h: number }
export interface CenaVestir { cenario: string; slug: string; largura: number; altura: number; pessoas: PessoaDaCena[] }

const CENAS = manifesto as Record<string, Omit<CenaVestir, "cenario">>;

/** A cena de vestir do cenário (null quando o cenário é outro tipo de arte). */
export function vestirDoCenario(cenario: string | null | undefined): CenaVestir | null {
  const c = cenario ? CENAS[cenario] : undefined;
  return c ? { cenario: cenario as string, ...c } : null;
}

export const cenariosDeVestir = (): string[] => Object.keys(CENAS);

const pasta = (c: CenaVestir) => `/flair/desafios/${c.cenario}`;
export const imagemAntes = (c: CenaVestir) => `${pasta(c)}/antes.webp`;
export const imagemDepois = (c: CenaVestir) => `${pasta(c)}/depois.webp`;
/** recorte da roupa do personagem `i` (0 = o primeiro da esquerda) */
export const imagemVeste = (c: CenaVestir, i: number) => `${pasta(c)}/veste-${i + 1}.webp`;

/** Posição do recorte em % da cena (o recorte acompanha a imagem em qualquer largura). */
export function caixaEmPercentual(c: CenaVestir, p: PessoaDaCena) {
  return { left: (p.x / c.largura) * 100, top: (p.y / c.altura) * 100, width: (p.w / c.largura) * 100, height: (p.h / c.altura) * 100 };
}

interface Julgamento { slot: string; cardId?: string | null; accepted?: boolean }

/**
 * Quem está vestido: a vaga tem carta E o servidor julgou essa mesma carta como a roupa da vaga (`accepted`). Sem
 * julgamento das cartas de agora, ninguém troca de roupa (nunca uma roupa que o servidor ainda não confirmou).
 */
export function vestidos(c: CenaVestir, placed: Record<string, string>, julgadas: Julgamento[] | null | undefined): boolean[] {
  const por = new Map((julgadas ?? []).map((r) => [r.slot, r]));
  return c.pessoas.map((p) => {
    const carta = placed[p.vaga];
    const r = por.get(p.vaga);
    return !!carta && !!r && r.cardId === carta && r.accepted !== false;
  });
}

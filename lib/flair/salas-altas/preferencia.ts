/**
 * A qualidade gráfica escolhida pela pessoa (seletor Alta/Média/Baixa, ou Automática): guardada no navegador e lida
 * por todas as cenas 3D dos jogos. Na Automática a cena decide pela máquina (qualidadeDeLargada: sem placa de vídeo,
 * Baixa) e pode descer sozinha; com um nível escolhido, a cena fica nele.
 */
import { qualidadeDeLargada, type Qualidade } from "@/lib/flair/nucleos/scene/qualidade";

export type PreferenciaDeQualidade = "AUTO" | Qualidade;
export const PREFERENCIAS: readonly PreferenciaDeQualidade[] = ["AUTO", "ALTA", "MEDIA", "BAIXA"];
export const CHAVE = "fai.flair3d.qualidade";

const ouvintes = new Set<() => void>();
let memoria: PreferenciaDeQualidade = "AUTO";

const valida = (v: unknown): v is PreferenciaDeQualidade => typeof v === "string" && (PREFERENCIAS as readonly string[]).includes(v);

export function lerPreferencia(): PreferenciaDeQualidade {
  try {
    const salvo = typeof localStorage === "undefined" ? null : localStorage.getItem(CHAVE);
    if (valida(salvo)) memoria = salvo;
  } catch {
    // navegação privada ou armazenamento bloqueado: fica a da memória
  }
  return memoria;
}

export function gravarPreferencia(p: PreferenciaDeQualidade): void {
  memoria = p;
  try {
    localStorage.setItem(CHAVE, p);
  } catch {
    // sem armazenamento a escolha vale só nesta aba
  }
  ouvintes.forEach((f) => f());
}

export function ouvirPreferencia(f: () => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** A qualidade que vale: a escolhida, ou na Automática a da máquina (pelo nome do renderizador). */
export function qualidadeEfetiva(p: PreferenciaDeQualidade, renderizador: string | null | undefined): Qualidade {
  return p === "AUTO" ? qualidadeDeLargada(renderizador) : p;
}

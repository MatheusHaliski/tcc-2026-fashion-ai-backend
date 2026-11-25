/**
 * A regra "peça-recurso" como a tela a recebe (POST /api/flair/3d/nucleos/{codigo}/efeitos, campo `perfil` de cada
 * carta). Quem calcula é o servidor (fai-application/.../flair3d/recurso/Flair3dRecursoTabela.java); aqui só os tipos,
 * os nomes na ordem do servidor e as cores de cada atributo. Puro.
 */
export const ATRIBUTOS = ["AGILIDADE", "FURTIVIDADE", "CARISMA", "RESISTENCIA", "FORCA"] as const;
export type Atributo = (typeof ATRIBUTOS)[number];

export const RECURSOS = ["VIDA", "ENERGIA", "FOCO", "MOEDAS"] as const;
export type Recurso = (typeof RECURSOS)[number];

export const ACOES_DESTRAVADAS = ["CORRER", "ESCONDER", "CONVENCER", "BLOQUEAR", "REFLETIR", "CARREGAR", "TROCA_RAPIDA", "ABRIR"] as const;
export type AcaoDestravada = (typeof ACOES_DESTRAVADAS)[number];

/** O que uma peça faz no jogo: deltas de atributo (-50 a 50), o recurso entregue no uso, os usos e as ações destravadas. */
export interface PerfilDaPeca {
  vaga: string;
  atributos: Partial<Record<Atributo, number>>;
  recurso: Recurso;
  quantidade: number;
  usos: number;
  acoes: AcaoDestravada[];
  dominante: Atributo | null;
}

/** Atributos do look de 0 a 100 (50 = neutro), como o servidor calcula (Flair3dRecursoCalculo.doLook). */
export type AtributosDoLook = Record<Atributo, number>;

export const NEUTRO = 50;

/** A cor de cada atributo na roda, no texto e no brilho do avatar. */
export const COR_DO_ATRIBUTO: Record<Atributo, string> = {
  AGILIDADE: "#2FB39B",
  FURTIVIDADE: "#7A5CC4",
  CARISMA: "#E0B04D",
  RESISTENCIA: "#4A6FA5",
  FORCA: "#C62B28",
};

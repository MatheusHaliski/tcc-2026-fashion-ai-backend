/**
 * Materiais das salas (seção 3, "materiais"): cada acabamento com textura, relevo e brilho coerentes, sem cor
 * chapada. Aqui só a descrição; a textura é desenhada em canvas pelo construtor 3D, com até 1024 px de lado.
 */
import type { MaterialDesc } from "@/lib/flair/nucleos/scene/types";

export const madeira = (cor: string, cor2: string, rugosidade = 0.55): MaterialDesc => ({ textura: "madeira", cor, cor2, rugosidade, metal: 0, px: 512, repete: 2 });

/** Madeira encerada ou laqueada: o mesmo veio, com brilho. */
export const madeiraEncerada = (cor: string, cor2: string): MaterialDesc => madeira(cor, cor2, 0.22);

export const marmore = (cor: string, veio: string): MaterialDesc => ({ textura: "marmore", cor, cor2: veio, rugosidade: 0.16, metal: 0, px: 1024, repete: 3 });

export const tijolo = (cor: string, rejunte: string): MaterialDesc => ({ textura: "tijolo", cor, cor2: rejunte, rugosidade: 0.9, metal: 0, px: 512, repete: 2 });

export const ladrilho = (cor: string, cor2: string): MaterialDesc => ({ textura: "ladrilho", cor, cor2, rugosidade: 0.28, metal: 0, px: 512, repete: 2 });

export const veludo = (cor: string, sombra: string): MaterialDesc => ({ textura: "veludo", cor, cor2: sombra, rugosidade: 0.95, metal: 0, px: 512, repete: 1.6 });

export const metalEscovado = (cor: string, rugosidade = 0.34): MaterialDesc => ({ textura: "metal", cor, rugosidade, metal: 1, px: 256, repete: 0.6 });

/** Metal pintado: a mesma escova, quase sem reflexo de metal. */
export const metalPintado = (cor: string): MaterialDesc => ({ textura: "metal", cor, rugosidade: 0.55, metal: 0.35, px: 256, repete: 0.6 });

export const asfaltoMolhado = (cor: string, reflexo: string): MaterialDesc => ({ textura: "asfalto", cor, cor2: reflexo, rugosidade: 0.32, metal: 0.1, px: 1024, repete: 6 });

export const concreto = (cor: string, rugosidade = 0.8): MaterialDesc => ({ textura: "concreto", cor, rugosidade, metal: 0, px: 512, repete: 3 });

export const reboco = (cor: string): MaterialDesc => ({ textura: "reboco", cor, rugosidade: 0.92, metal: 0, px: 512, repete: 3 });

export const pedra = (cor: string, rejunte: string): MaterialDesc => ({ textura: "pedra", cor, cor2: rejunte, rugosidade: 0.85, metal: 0, px: 512, repete: 2.4 });

export const pedraPortuguesa = (clara: string, escura: string): MaterialDesc => ({ textura: "pedraPortuguesa", cor: clara, cor2: escura, rugosidade: 0.7, metal: 0, px: 1024, repete: 2.4 });

export const borracha = (cor: string): MaterialDesc => ({ textura: "borracha", cor, rugosidade: 0.62, metal: 0, px: 512, repete: 2 });

export const laca = (cor: string): MaterialDesc => ({ textura: "laca", cor, rugosidade: 0.07, metal: 0.05, px: 256, repete: 3 });

export const tecido = (cor: string, cor2?: string): MaterialDesc => ({ textura: "tecido", cor, cor2, rugosidade: 0.9, metal: 0, px: 256, repete: 0.5 });

/** Tecido de listras largas (toldo). */
export const listrado = (cor: string, cor2: string): MaterialDesc => ({ textura: "listras", cor, cor2, rugosidade: 0.85, metal: 0, px: 256, repete: 1 });

export const la = (cor: string, cor2: string): MaterialDesc => ({ textura: "la", cor, cor2, rugosidade: 1, metal: 0, px: 512, repete: 1.2 });

export const amostras = (): MaterialDesc => ({ textura: "amostras", cor: "#C6275E", cor2: "#1F7A76", rugosidade: 0.85, metal: 0, px: 256, repete: 0.4 });

export const janelas = (parede: string, janela: string, emissiva = 0.6): MaterialDesc => ({ textura: "janelas", cor: parede, cor2: janela, rugosidade: 0.9, metal: 0, px: 512, repete: 4, emissiva });

export const led = (cor: string, cor2: string, emissiva = 1.1): MaterialDesc => ({ textura: "led", cor, cor2, rugosidade: 0.4, metal: 0, px: 512, repete: 1.2, emissiva });

export const rede = (cor: string): MaterialDesc => ({ textura: "rede", cor, rugosidade: 0.9, metal: 0, px: 256, repete: 0.5, opacidade: 0.99 });

/** Céu em degradê, do alto (`cor`) ao horizonte (`cor2`); a textura cobre a parede inteira. */
export const ceu = (alto: string, horizonte: string): MaterialDesc => ({ textura: "ceu", cor: alto, cor2: horizonte, rugosidade: 1, metal: 0, px: 512, repete: 0 });

/** Luz acesa (neon, lâmpada, tubo de LED): sem textura, só a cor emitida. */
export const luz = (cor: string, emissiva = 2): MaterialDesc => ({ textura: "liso", cor, rugosidade: 0.4, metal: 0, px: 0, emissiva });

/** Tinta lisa de demarcação (linhas da quadra, ringue, fita de set). */
export const tinta = (cor: string): MaterialDesc => ({ textura: "liso", cor, rugosidade: 0.6, metal: 0, px: 0 });

export const vidro = (cor = "#DDEBF0"): MaterialDesc => ({ textura: "liso", cor, rugosidade: 0.05, metal: 0.1, px: 0, opacidade: 0.28 });

export const espelhado = (cor = "#DCE6EA"): MaterialDesc => ({ textura: "liso", cor, rugosidade: 0.03, metal: 1, px: 0 });

/** Imagem pronta (logo); `repete: 0` usa a face inteira. */
export const imagem = (url: string): MaterialDesc => ({ textura: "imagem", cor: "#FFFFFF", rugosidade: 0.6, metal: 0, px: 1024, repete: 0, url, opacidade: 0.99 });

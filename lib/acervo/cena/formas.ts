/**
 * ACERVO — silhuetas das categorias para a peça sem foto usável (sem foto, foto que não carregou, fundo que não saiu, ou
 * a peça-fantasma da simulação): camiseta com mangas, calça com as duas pernas, vestido e o perfil do calçado, no lugar
 * do bloco retangular. Coordenadas no quadrado unitário (x de 0 a 1, y de 0 a 1, y para cima), escaladas por quem usa.
 */
import * as THREE from "three";

type Ponto = [number, number];

/** Contornos no quadrado unitário, no sentido anti-horário. */
const CONTORNOS: Record<"cima" | "baixo" | "inteira" | "calcado", Ponto[]> = {
  cima: [[0.3, 0], [0.7, 0], [0.7, 0.56], [0.78, 0.5], [1, 0.72], [0.84, 0.92], [0.62, 1], [0.56, 0.94], [0.44, 0.94],
    [0.38, 1], [0.16, 0.92], [0, 0.72], [0.22, 0.5], [0.3, 0.56]],
  baixo: [[0.02, 0], [0.44, 0], [0.5, 0.66], [0.56, 0], [0.98, 0], [0.88, 1], [0.12, 1]],
  inteira: [[0, 0], [1, 0], [0.7, 0.62], [0.76, 0.9], [0.62, 1], [0.56, 0.95], [0.44, 0.95], [0.38, 1], [0.24, 0.9], [0.3, 0.62]],
  calcado: [[0, 0], [1, 0], [1, 0.22], [0.86, 0.42], [0.55, 0.56], [0.4, 1], [0.08, 1], [0, 0.7]],
};

export type FormaDaCategoria = keyof typeof CONTORNOS;

export function formaDaCategoria(categoria: string): FormaDaCategoria {
  if (categoria === "shoes_piece") return "calcado";
  if (categoria === "lower_piece") return "baixo";
  if (categoria === "full_body_piece") return "inteira";
  return "cima";
}

/** Contorno da categoria com ``largura`` × ``altura`` (m), centrado na origem. */
export function contornoDaCategoria(categoria: string, largura: number, altura: number): THREE.Shape {
  const pts = CONTORNOS[formaDaCategoria(categoria)].map(([x, y]) => new THREE.Vector2((x - 0.5) * largura, (y - 0.5) * altura));
  return new THREE.Shape(pts);
}

/**
 * Casca da sala (seção 3, "sala delimitada"): piso, parede do fundo, duas laterais, a quarta parede quando a sala
 * tem quatro, e teto ou céu. O piso, as laterais e a cobertura vão até atrás da câmera: ela nunca vê o vazio.
 */
import { caixa, plano } from "@/lib/flair/nucleos/scene/parts";
import type { Parte, Sala } from "@/lib/flair/nucleos/scene/types";

const RODAPE_ALTURA = 0.12;
const RODAPE_ESPESSURA = 0.03;

export function cascaDaSala(sala: Sala): Parte[] {
  const { largura, fundo, frente, altura } = sala.dim;
  const { piso, parede, teto, rodape } = sala.casca;
  const comprimento = fundo + frente;
  const meioZ = (frente - fundo) / 2;
  const lado = largura / 2;
  const partes: Parte[] = [
    plano(piso, [largura, comprimento], [0, 0, meioZ], [-90, 0, 0]),
    plano(sala.casca.fundo ?? parede, [largura, altura], [0, altura / 2, -fundo]),
    plano(parede, [comprimento, altura], [-lado, altura / 2, meioZ], [0, 90, 0]),
    plano(parede, [comprimento, altura], [lado, altura / 2, meioZ], [0, -90, 0]),
    plano(teto, [largura, comprimento], [0, altura, meioZ], [90, 0, 0]),
  ];
  if (sala.fechamento === "quatro_paredes") {
    partes.push(plano(parede, [largura, altura], [0, altura / 2, frente], [0, 180, 0]));
  }
  if (rodape) {
    const y = RODAPE_ALTURA / 2;
    const e = RODAPE_ESPESSURA;
    partes.push(
      caixa(rodape, [largura, RODAPE_ALTURA, e], [0, y, -fundo + e / 2]),
      caixa(rodape, [e, RODAPE_ALTURA, comprimento], [-lado + e / 2, y, meioZ]),
      caixa(rodape, [e, RODAPE_ALTURA, comprimento], [lado - e / 2, y, meioZ]),
    );
  }
  return partes;
}

/**
 * Ferramentas de desenho das texturas procedurais: sorteio determinístico (a mesma textura a cada montagem), mistura
 * de cores e os gestos que se repetem (pontilhado, manchas suaves, linhas finas).
 */
import { rng } from "@/components/three/common";
import { mixHex } from "@/components/three/fitting-cabin";

export type Ctx = CanvasRenderingContext2D;
export type Sorteio = () => number;

export const sorteio = (semente: number): Sorteio => rng(semente);

/** Mistura de duas cores (t = 0 → a, 1 → b). */
export const mistura = mixHex;

export const escurece = (cor: string, t: number) => mixHex(cor, "#000000", t);
export const clareia = (cor: string, t: number) => mixHex(cor, "#FFFFFF", t);

export function fundo(g: Ctx, s: number, cor: string): void {
  g.fillStyle = cor;
  g.fillRect(0, 0, s, s);
}

/** Pontos miúdos claros e escuros (grão de pedra, poro de concreto, fibra). */
export function pontilhado(g: Ctx, s: number, r: Sorteio, quantos: number, alfa: number, tamanho = 2): void {
  for (let i = 0; i < quantos; i++) {
    g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${alfa})` : `rgba(0,0,0,${alfa})`;
    g.fillRect(r() * s, r() * s, 1 + r() * tamanho, 1 + r() * tamanho);
  }
}

/** Manchas largas e suaves (nuvem de mármore, desgaste de concreto, poça). */
export function manchas(g: Ctx, s: number, r: Sorteio, quantas: number, cor: string, alfa: number, raio = 0.25): void {
  for (let i = 0; i < quantas; i++) {
    const x = r() * s;
    const y = r() * s;
    const rr = (0.3 + r() * 0.7) * raio * s;
    const grad = g.createRadialGradient(x, y, 0, x, y, rr);
    grad.addColorStop(0, cor);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = alfa;
    g.fillStyle = grad;
    g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
  }
  g.globalAlpha = 1;
}

/** Linhas finas numa direção (veio de madeira, escova de metal, trama de tecido). */
export function linhas(g: Ctx, s: number, r: Sorteio, quantas: number, vertical: boolean, cor: string, alfa: number): void {
  g.strokeStyle = cor;
  g.lineWidth = 1;
  for (let i = 0; i < quantas; i++) {
    const p = r() * s;
    const desvio = (r() - 0.5) * 6;
    g.globalAlpha = alfa * (0.4 + r() * 0.6);
    g.beginPath();
    if (vertical) {
      g.moveTo(p, 0);
      g.lineTo(p + desvio, s);
    } else {
      g.moveTo(0, p);
      g.lineTo(s, p + desvio);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

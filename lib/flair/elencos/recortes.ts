/**
 * Recortes das imagens dos elencos em peças, puros: cada peça é um contorno SVG (`d`) nas unidades da imagem (altura
 * 100, largura pela proporção) e o centro dela (de onde a peça "chega" quando encaixa). Quatro formas:
 * - grade: retângulos iguais (as cenas: dois cortes pelo centro da largura e da altura);
 * - jigsaw: peças de quebra-cabeça com encaixe (saliência de um lado, reentrância do vizinho);
 * - setores: fatias iguais de um círculo;
 * - cacos: polígonos que seguem as rachaduras de uma imagem de vidro quebrado (raios a partir do ponto de impacto).
 */
import { bordaH, bordaV, ladoDeBaixo, ladoDireito, n2 } from "@/lib/flair/elencos/jigsaw";

export type Ponto = readonly [number, number];

export interface Peca {
  d: string;
  cx: number;
  cy: number;
}

const ALTURA = 100;

/** Grade de colunas × fileiras retângulos iguais, em ordem de leitura. */
export function grade(colunas: number, fileiras: number, largura: number): Peca[] {
  const w = largura / colunas;
  const h = ALTURA / fileiras;
  const out: Peca[] = [];
  for (let r = 0; r < fileiras; r++) {
    for (let c = 0; c < colunas; c++) {
      const [x, y] = [c * w, r * h];
      out.push({ d: `M${n2(x)} ${n2(y)}H${n2(x + w)}V${n2(y + h)}H${n2(x)}Z`, cx: n2(x + w / 2), cy: n2(y + h / 2) });
    }
  }
  return out;
}

/** Peças de quebra-cabeça com encaixe numa grade de colunas × fileiras, em ordem de leitura; a borda de fora é reta. */
export function jigsaw(colunas: number, fileiras: number, largura: number): Peca[] {
  const w = largura / colunas;
  const h = ALTURA / fileiras;
  const salto = Math.min(w, h) * 0.22;
  const out: Peca[] = [];
  for (let r = 0; r < fileiras; r++) {
    for (let c = 0; c < colunas; c++) {
      const [x0, y0] = [c * w, r * h];
      const cima = r > 0 ? ladoDeBaixo(c, r - 1) * salto : 0;
      const direita = c < colunas - 1 ? ladoDireito(c, r) * salto : 0;
      const baixo = r < fileiras - 1 ? ladoDeBaixo(c, r) * salto : 0;
      const esquerda = c > 0 ? ladoDireito(c - 1, r) * salto : 0;
      const d = `M${n2(x0)} ${n2(y0)}${bordaH(x0, x0 + w, y0, cima)}${bordaV(y0, y0 + h, x0 + w, direita)}${bordaH(x0 + w, x0, y0 + h, baixo)}${bordaV(y0 + h, y0, x0, esquerda)}Z`;
      out.push({ d, cx: n2(x0 + w / 2), cy: n2(y0 + h / 2) });
    }
  }
  return out;
}

/** n setores circulares iguais do círculo (cx, cy, raio), começando no alto e seguindo no sentido horário. */
export function setores(n: number, cx: number, cy: number, raio: number): Peca[] {
  const ponto = (k: number): Ponto => {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
    return [n2(cx + raio * Math.cos(a)), n2(cy + raio * Math.sin(a))];
  };
  return Array.from({ length: n }, (_, k) => {
    const [a, b] = [ponto(k), ponto(k + 1)];
    const meio = -Math.PI / 2 + (2 * Math.PI * (k + 0.5)) / n;
    const grande = n === 1 ? 1 : 0;
    return {
      d: `M${n2(cx)} ${n2(cy)}L${a[0]} ${a[1]}A${n2(raio)} ${n2(raio)} 0 ${grande} 1 ${b[0]} ${b[1]}Z`,
      cx: n2(cx + raio * 0.62 * Math.cos(meio)),
      cy: n2(cy + raio * 0.62 * Math.sin(meio)),
    };
  });
}

const angulo = (c: Ponto, p: Ponto) => Math.atan2(p[1] - c[1], p[0] - c[0]);

/**
 * Cacos entre rachaduras: cada raio sai do ponto de impacto, passa pelos pontos dados e termina na borda da imagem.
 * Os raios vêm no sentido horário; o caco i fica entre o raio i e o seguinte, com os cantos da imagem que caem entre os
 * dois. Juntos, os cacos cobrem a imagem inteira.
 */
export function cacos(impacto: Ponto, raios: readonly (readonly Ponto[])[], largura: number): Peca[] {
  const cantos: Ponto[] = [[0, 0], [largura, 0], [largura, ALTURA], [0, ALTURA]];
  return raios.map((raio, i) => {
    const prox = raios[(i + 1) % raios.length];
    const a0 = angulo(impacto, raio[raio.length - 1]);
    let a1 = angulo(impacto, prox[prox.length - 1]);
    if (a1 <= a0) a1 += 2 * Math.PI;
    const entre = cantos
      .map((p) => {
        let a = angulo(impacto, p);
        if (a <= a0) a += 2 * Math.PI;
        return { p, a };
      })
      .filter((x) => x.a < a1)
      .sort((x, y) => x.a - y.a)
      .map((x) => x.p);
    const pontos: Ponto[] = [impacto, ...raio, ...entre, ...[...prox].reverse()];
    const cx = pontos.reduce((s, p) => s + p[0], 0) / pontos.length;
    const cy = pontos.reduce((s, p) => s + p[1], 0) / pontos.length;
    return { d: `M${pontos.map((p) => `${n2(p[0])} ${n2(p[1])}`).join("L")}Z`, cx: n2(cx), cy: n2(cy) };
  });
}

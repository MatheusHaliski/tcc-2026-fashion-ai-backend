/**
 * ACERVO — a forma da peça a partir da miniatura. A miniatura é o recorte da peça composto sobre branco (ou a foto com
 * o fundo, quando o recorte falhou no envio); colada inteira numa caixa, ela virava um bloco retangular com a foto. Aqui
 * o fundo ligado à borda da imagem sai (vira transparente): fica a silhueta da peça, e a caixa dela diz que parte da
 * textura usar e com que proporção desenhar o painel.
 */

/** O que sobrou da imagem depois de tirar o fundo. */
export interface Recorte {
  /** fração dos pixels que saíram (fundo) */
  removido: number;
  /** caixa da peça na imagem, normalizada: [u0, v0, u1, v1] com v de cima para baixo */
  caixa: [number, number, number, number];
}

/** Abaixo disso quase nada saiu (foto sem fundo liso); acima, quase nada sobrou (peça da cor do fundo). */
const MIN_REMOVIDO = 0.06, MAX_REMOVIDO = 0.94;

/** O recorte serve para desenhar a silhueta: saiu fundo, e sobrou peça. */
export function recorteUsavel(r: Recorte | null | undefined): r is Recorte {
  return !!r && r.removido >= MIN_REMOVIDO && r.removido <= MAX_REMOVIDO && r.caixa[2] > r.caixa[0] && r.caixa[3] > r.caixa[1];
}

/** Mediana de cada canal dos pixels opacos da borda: a cor do fundo. */
function corDoFundo(px: Uint8ClampedArray, w: number, h: number): [number, number, number] | null {
  const canais: number[][] = [[], [], []];
  const ver = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (px[i + 3] < 128) return;
    for (let c = 0; c < 3; c++) canais[c].push(px[i + c]);
  };
  for (let x = 0; x < w; x++) { ver(x, 0); ver(x, h - 1); }
  for (let y = 0; y < h; y++) { ver(0, y); ver(w - 1, y); }
  if (!canais[0].length) return null;
  return canais.map((v) => v.sort((a, b) => a - b)[v.length >> 1]) as [number, number, number];
}

/**
 * Tira o fundo ligado à borda (o que já é transparente, e o que tem a cor do fundo dentro de ``tolerancia``), deixando
 * alfa 0 nele, direto em ``px`` (RGBA). Só o fundo que toca a borda sai: o branco de dentro da peça (estampa, gola)
 * fica. Devolve quanto saiu e a caixa do que sobrou.
 */
export function recortarFundo(px: Uint8ClampedArray, w: number, h: number, tolerancia = 30): Recorte {
  const fundo = corDoFundo(px, w, h);
  const visto = new Uint8Array(w * h);
  const fila: number[] = [];
  const ehFundo = (p: number) => {
    const i = p * 4;
    if (px[i + 3] < 128) return true;
    if (!fundo) return false;
    return Math.hypot(px[i] - fundo[0], px[i + 1] - fundo[1], px[i + 2] - fundo[2]) <= tolerancia;
  };
  const entrar = (x: number, y: number) => {
    const p = y * w + x;
    if (visto[p] || !ehFundo(p)) return;
    visto[p] = 1;
    fila.push(p);
  };
  for (let x = 0; x < w; x++) { entrar(x, 0); entrar(x, h - 1); }
  for (let y = 0; y < h; y++) { entrar(0, y); entrar(w - 1, y); }
  while (fila.length) {
    const p = fila.pop()!;
    const x = p % w, y = (p - x) / w;
    if (x > 0) entrar(x - 1, y);
    if (x < w - 1) entrar(x + 1, y);
    if (y > 0) entrar(x, y - 1);
    if (y < h - 1) entrar(x, y + 1);
  }
  let saiu = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0; p < w * h; p++) {
    if (visto[p]) { px[p * 4 + 3] = 0; saiu++; continue; }
    const x = p % w, y = (p - x) / w;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const caixa: Recorte["caixa"] = x1 < 0 ? [0, 0, 0, 0] : [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h];
  return { removido: saiu / (w * h), caixa };
}

/** Painel da silhueta dentro de ``largura`` × ``altura`` (m), na proporção da peça, e o trecho da textura (UV, v para cima). */
export function painelDaSilhueta(r: Recorte, largura: number, altura: number) {
  const [u0, v0, u1, v1] = r.caixa;
  const proporcao = (u1 - u0) / (v1 - v0);
  let h = altura, w = h * proporcao;
  if (w > largura) { w = largura; h = w / proporcao; }
  return { w, h, uv: { u0, u1, vBaixo: 1 - v1, vCima: 1 - v0 } };
}

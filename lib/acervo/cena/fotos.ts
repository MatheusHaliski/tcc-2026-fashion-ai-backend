/**
 * ACERVO — fotos das peças dentro da cena 3D. Cada foto vira uma textura pequena (128 × 128 px, a peça inteira no
 * quadro) com o fundo tirado ({@link recortarFundo}): a cena desenha a silhueta da peça, não a foto num bloco. A textura é
 * compartilhada por todas as formas que mostram a mesma peça e descartada quando nenhuma forma usa mais; o recorte fica
 * em ``textura.userData.recorte``. A cena guarda no máximo {@link MAX_FOTOS} fotos ao mesmo tempo (cerca de 4 MB de
 * memória de vídeo); além disso, e quando a foto não carrega, a peça fica com a silhueta da categoria na cor dela.
 */
import * as THREE from "three";
import { recortarFundo, type Recorte } from "./silhueta";

export const LADO_DA_FOTO = 128;
export const MAX_FOTOS = 64;
const TEMPO_LIMITE = 15000;

/** Lê a imagem e devolve o canvas já reduzido; null quando falha. */
export type CarregadorDeFoto = (url: string) => Promise<HTMLCanvasElement | null>;

/**
 * A imagem inteira no quadro (sem cortar a peça), com o fundo tirado; o recorte vai em ``canvas.dataset.recorte``.
 * Sem acesso aos pixels (imagem de outra origem sem CORS) o getImageData lança, e quem chama trata.
 */
export function desenharFoto(imagem: CanvasImageSource & { width: number; height: number }, lado = LADO_DA_FOTO): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const g = canvas.getContext("2d");
  if (!g || imagem.width <= 0 || imagem.height <= 0) return null;
  const k = lado / Math.max(imagem.width, imagem.height);
  const w = imagem.width * k, h = imagem.height * k;
  g.drawImage(imagem, (lado - w) / 2, (lado - h) / 2, w, h);   // o que sobra do quadro fica transparente: é fundo
  const pixels = g.getImageData(0, 0, lado, lado);
  canvas.dataset.recorte = JSON.stringify(recortarFundo(pixels.data, lado, lado));
  g.putImageData(pixels, 0, 0);
  return canvas;
}

/** O recorte guardado no canvas da foto; null quando não há (canvas de teste, leitura antiga). */
export function recorteDoCanvas(canvas: HTMLCanvasElement): Recorte | null {
  try {
    return canvas.dataset?.recorte ? (JSON.parse(canvas.dataset.recorte) as Recorte) : null;
  } catch {
    return null;
  }
}

export const carregarFoto: CarregadorDeFoto = (url) =>
  new Promise((resolve) => {
    const imagem = new Image();
    imagem.crossOrigin = "anonymous";
    imagem.decoding = "async";
    const desistir = setTimeout(() => resolve(null), TEMPO_LIMITE);
    imagem.onload = () => {
      clearTimeout(desistir);
      try {
        resolve(desenharFoto(imagem));
      } catch {
        resolve(null); // imagem de outra origem sem CORS: o canvas não pode ser lido
      }
    };
    imagem.onerror = () => {
      clearTimeout(desistir);
      resolve(null);
    };
    imagem.src = url;
  });

interface Entrada {
  promessa: Promise<THREE.Texture | null>;
  usos: number;
}

const fotos = new Map<string, Entrada>();

/**
 * Pede a textura da foto e conta mais um uso. Devolve null (sem contar uso) quando a cena já guarda o máximo de fotos.
 * Cada pedido aceito precisa de um {@link devolverFoto}.
 */
export function pedirFoto(url: string, carregar: CarregadorDeFoto = carregarFoto): Promise<THREE.Texture | null> | null {
  const existente = fotos.get(url);
  if (existente) {
    existente.usos += 1;
    return existente.promessa;
  }
  if (fotos.size >= MAX_FOTOS) return null;
  const promessa = carregar(url).then((canvas) => {
    if (!canvas) return null;
    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.generateMipmaps = false;
    textura.minFilter = THREE.LinearFilter;
    textura.userData.recorte = recorteDoCanvas(canvas);
    return textura;
  });
  fotos.set(url, { promessa, usos: 1 });
  return promessa;
}

/** Um uso a menos; sem nenhum, a textura sai da memória de vídeo. */
export function devolverFoto(url: string): void {
  const entrada = fotos.get(url);
  if (!entrada) return;
  entrada.usos -= 1;
  if (entrada.usos > 0) return;
  fotos.delete(url);
  void entrada.promessa.then((textura) => textura?.dispose());
}

/** Quantas fotos a cena guarda agora (para teste e diagnóstico). */
export function fotosGuardadas(): number {
  return fotos.size;
}

/**
 * ACERVO — fotos das peças dentro da cena 3D. Cada foto vira uma textura pequena (128 × 128 px, recortada ao centro),
 * compartilhada por todas as formas que mostram a mesma peça e descartada quando nenhuma forma usa mais. A cena guarda
 * no máximo {@link MAX_FOTOS} fotos ao mesmo tempo (cerca de 4 MB de memória de vídeo); além disso, e quando a foto não
 * carrega, a peça continua como o bloco na cor dela.
 */
import * as THREE from "three";

export const LADO_DA_FOTO = 128;
export const MAX_FOTOS = 64;
const TEMPO_LIMITE = 15000;

/** Lê a imagem e devolve o canvas já reduzido; null quando falha. */
export type CarregadorDeFoto = (url: string) => Promise<HTMLCanvasElement | null>;

/** Faces da caixa (+x, −x, +y, −y, +z, −z) que mostram a foto: a peça pendurada pelas laterais, a dobrada por cima. */
export function facesComFoto(forma: "pendurada" | "dobrada" | "calcado"): boolean[] {
  if (forma === "pendurada") return [true, true, false, false, false, false];
  if (forma === "calcado") return [true, true, true, false, false, false];
  return [false, false, true, false, false, false];
}

/** Recorte central quadrado da imagem, já no tamanho da textura. */
export function desenharFoto(imagem: CanvasImageSource & { width: number; height: number }, lado = LADO_DA_FOTO): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const g = canvas.getContext("2d");
  if (!g || imagem.width <= 0 || imagem.height <= 0) return null;
  const corte = Math.min(imagem.width, imagem.height);
  g.drawImage(imagem, (imagem.width - corte) / 2, (imagem.height - corte) / 2, corte, corte, 0, 0, lado, lado);
  return canvas;
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

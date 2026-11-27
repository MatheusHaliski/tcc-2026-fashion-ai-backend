/**
 * O corpo humano leve das pessoas de cena, modelado no motor Blender do projeto (scripts/blender3d/receitas/gente.py):
 * tronco com cintura e ombros, braços e mãos, pernas e sapatos, cabeça com rosto e cabelo. Substitui as cápsulas do
 * corpo leve e da torcida assim que o arquivo carrega; até lá (e se ele falhar) as cápsulas ficam no lugar.
 *
 * O arquivo traz um objeto por pedaço, com o nome da parte no começo (`tronco-torso`, `maos-mao`…). Aqui cada parte vira
 * uma geometria só, pronta para uma malha instanciada: uma chamada de desenho por parte para a cena inteira.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { urlDoGlb } from "@/lib/flair/nucleos/scene/assets";

/** As partes do corpo humano leve, na ordem em que são desenhadas. */
export const PARTES_HUMANAS = ["tronco", "bracos", "maos", "cabeca", "rosto", "cabelo", "pernas", "pes"] as const;
export type ParteHumana = (typeof PARTES_HUMANAS)[number];
export type CorpoHumanoLeve = Record<ParteHumana, THREE.BufferGeometry>;

const SLUG = "pessoa-leve";
/** Altura do ombro: os braços e as mãos giram em volta dele, então saem com o ombro na origem. */
export const OMBRO_HUMANO = 1.38;
/** Cores fixas do que não vem da roupa da pessoa. */
export const COR_DO_ROSTO = "#2A2220";
export const COR_DO_SAPATO = "#1C1C20";

/** Junta os objetos do arquivo por parte; nulo se faltar alguma (arquivo de outra versão). */
export function partesDoArquivo(cena: THREE.Object3D): CorpoHumanoLeve | null {
  const porParte = new Map<string, THREE.BufferGeometry[]>();
  cena.updateMatrixWorld(true);
  cena.traverse((o) => {
    const malha = o as THREE.Mesh;
    if (!malha.isMesh) return;
    const parte = malha.name.split("-")[0];
    const limpa = malha.geometry.index ? malha.geometry.toNonIndexed() : malha.geometry.clone();
    for (const nome of Object.keys(limpa.attributes)) if (nome !== "position" && nome !== "normal") limpa.deleteAttribute(nome);
    limpa.applyMatrix4(malha.matrixWorld);
    porParte.set(parte, [...(porParte.get(parte) ?? []), limpa]);
  });
  const corpo = {} as CorpoHumanoLeve;
  for (const parte of PARTES_HUMANAS) {
    const pedacos = porParte.get(parte);
    const junta = pedacos?.length ? mergeGeometries(pedacos, false) : null;
    for (const g of pedacos ?? []) g.dispose();
    if (!junta) return null;
    if (parte === "bracos" || parte === "maos") junta.translate(0, -OMBRO_HUMANO, 0);
    corpo[parte] = junta;
  }
  return corpo;
}

const pedidos = new Map<boolean, Promise<CorpoHumanoLeve | null>>();

/**
 * O corpo humano leve (uma vez por página). `simples`: a versão com menos triângulos, para a arquibancada. Devolve nulo
 * fora do navegador ou se o arquivo não carregar; quem chama segue com as cápsulas. As geometrias são compartilhadas:
 * quem as usa não as descarta.
 */
export function corpoHumanoLeve(simples = false): Promise<CorpoHumanoLeve | null> {
  let pedido = pedidos.get(simples);
  if (!pedido) {
    pedido = typeof window === "undefined" || typeof fetch === "undefined"
      ? Promise.resolve(null)
      : new GLTFLoader().loadAsync(urlDoGlb(SLUG, simples)).then((gltf) => partesDoArquivo(gltf.scene)).catch(() => null);
    pedidos.set(simples, pedido);
  }
  return pedido;
}

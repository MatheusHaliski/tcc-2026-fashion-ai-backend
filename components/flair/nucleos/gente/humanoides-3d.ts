/**
 * Os humanoides prontos em cena (lib/flair/nucleos/gente/humanoides.ts): cada modelo é baixado uma vez e clonado para
 * cada pessoa (SkeletonUtils: mesma malha e mesma textura, esqueleto próprio). A pose é posta osso a osso, apontando o
 * braço, o antebraço, a coxa e a canela para a direção pedida — vale para qualquer esqueleto, sem depender de como os
 * eixos dos ossos foram feitos. Enquanto o arquivo não chega (ou se falhar), `posar` devolve falso e quem chama mantém
 * o corpo leve no lugar.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as clonarComOssos } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";
import { humanoideDaPessoa, MEMBROS, OSSOS, urlDoHumanoide, type Humanoide, type Membro, type PoseHumana } from "@/lib/flair/nucleos/gente/humanoides";

interface Modelo {
  cena: THREE.Object3D;
  altura: number;
  base: number;
}
interface Clone {
  raiz: THREE.Group;
  corpo: THREE.Object3D;
  ossos: Partial<Record<Membro, THREE.Bone>>;
  repouso: Map<THREE.Bone, THREE.Quaternion>;
  escala: number;
  base: number;
}
interface Lugar {
  x: number;
  y: number;
  z: number;
  giro: number;
}

const modelos = new Map<string, Promise<Modelo | null>>();
const CAIXA = new THREE.Box3();

function carregar(slug: string): Promise<Modelo | null> {
  let pedido = modelos.get(slug);
  if (!pedido) {
    pedido = typeof window === "undefined" || typeof fetch === "undefined"
      ? Promise.resolve(null)
      : new GLTFLoader().loadAsync(urlDoHumanoide(slug)).then((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        CAIXA.setFromObject(gltf.scene);
        const altura = CAIXA.max.y - CAIXA.min.y;
        return altura > 0.3 ? { cena: gltf.scene, altura, base: CAIXA.min.y } : null;
      }).catch(() => null);
    modelos.set(slug, pedido);
  }
  return pedido;
}

const A = new THREE.Vector3();
const B = new THREE.Vector3();
const ALVO = new THREE.Vector3();
const GIRO = new THREE.Quaternion();
const DO_OSSO = new THREE.Quaternion();
const DO_PAI = new THREE.Quaternion();
const DA_RAIZ = new THREE.Quaternion();
/** os pares (osso, o osso seguinte que diz para onde ele aponta), do ombro e do quadril para as pontas */
const CADEIAS: [Exclude<Membro, "maoE" | "maoD" | "peE" | "peD">, Membro][] = [
  ["bracoE", "antebracoE"], ["antebracoE", "maoE"], ["bracoD", "antebracoD"], ["antebracoD", "maoD"],
  ["coxaE", "canelaE"], ["canelaE", "peE"], ["coxaD", "canelaD"], ["canelaD", "peD"],
];

/** Gira o osso (no espaço do mundo) até ele apontar para `alvo`. */
function apontar(osso: THREE.Bone, seguinte: THREE.Bone, alvo: THREE.Vector3): void {
  osso.getWorldPosition(A);
  seguinte.getWorldPosition(B);
  GIRO.setFromUnitVectors(B.sub(A).normalize(), alvo);
  osso.getWorldQuaternion(DO_OSSO);
  (osso.parent as THREE.Object3D).getWorldQuaternion(DO_PAI);
  osso.quaternion.copy(DO_PAI.invert().multiply(GIRO).multiply(DO_OSSO));
  osso.updateWorldMatrix(false, true);
}

export class Humanoides {
  readonly grupo = new THREE.Group();
  private readonly clones = new Map<string, Clone | "pedido">();
  private descartado = false;

  constructor() {
    this.grupo.name = "humanoides";
  }

  private montar(id: string, pessoa: PessoaDoElenco, modelo?: Humanoide): void {
    const escolhido = modelo ?? humanoideDaPessoa(pessoa.chave, pessoa.sexo);
    this.clones.set(id, "pedido");
    if (!escolhido) return;
    void carregar(escolhido.slug).then((modelo) => {
      if (!modelo || this.descartado) return;
      const corpo = clonarComOssos(modelo.cena);
      const ossos: Clone["ossos"] = {};
      corpo.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
        if (!(o as THREE.Bone).isBone) return;
        for (const m of MEMBROS) if (!ossos[m] && OSSOS[m].test(o.name)) ossos[m] = o as THREE.Bone;
      });
      const repouso = new Map(Object.values(ossos).map((o) => [o, o.quaternion.clone()] as const));
      const raiz = new THREE.Group();
      raiz.name = `humanoide-${id}`;
      raiz.add(corpo);
      raiz.visible = false;
      this.grupo.add(raiz);
      this.clones.set(id, { raiz, corpo, ossos, repouso, escala: pessoa.estatura / modelo.altura, base: modelo.base });
    });
  }

  /** Põe a pessoa no lugar, na pose; falso enquanto o modelo dela não chegou (quem chama mantém o corpo leve). */
  posar(id: string, pessoa: PessoaDoElenco, em: Lugar, pose: PoseHumana, modelo?: Humanoide): boolean {
    const c = this.clones.get(id);
    if (!c) this.montar(id, pessoa, modelo);
    if (!c || c === "pedido") return false;
    const altura = pessoa.estatura;
    c.raiz.visible = true;
    c.raiz.position.set(em.x, em.y + pose.pulo - pose.desce * altura, em.z);
    c.raiz.rotation.set(pose.inclina, em.giro, 0, "YXZ");
    c.corpo.scale.setScalar(c.escala);
    c.corpo.position.y = -c.base * c.escala;
    for (const [osso, q] of c.repouso) osso.quaternion.copy(q);
    c.raiz.updateWorldMatrix(true, true);
    c.raiz.getWorldQuaternion(DA_RAIZ);
    for (const [membro, seguinte] of CADEIAS) {
      const osso = c.ossos[membro];
      const filho = c.ossos[seguinte];
      if (osso && filho) apontar(osso, filho, ALVO.set(...pose.direcoes[membro]).normalize().applyQuaternion(DA_RAIZ));
    }
    return true;
  }

  esconder(id: string): void {
    const c = this.clones.get(id);
    if (c && c !== "pedido") c.raiz.visible = false;
  }

  /** As malhas e as texturas são do modelo compartilhado (ficam para a próxima cena); aqui saem só os clones. */
  descartar(): void {
    this.descartado = true;
    this.grupo.clear();
    this.clones.clear();
  }
}

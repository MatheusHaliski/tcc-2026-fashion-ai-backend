/**
 * Os corpos leves das pessoas do elenco (nível LONGE de lib/flair/nucleos/gente/detalhe.ts e quem fica fora dos corpos
 * inteiros): o mesmo humano leve da torcida (cabeça, pescoço, cabelo, tronco, braços e pernas, torcida-3d.tsx), com a cor
 * da roupa, da calça, da pele e do cabelo da pessoa e a altura dela. De longe continua gente, sem o custo do corpo
 * completo (pele, olhos, roupa costurada).
 *
 * Todas as pessoas leves de uma cena são desenhadas juntas, em cinco malhas instanciadas: cinco chamadas de desenho
 * para a plateia inteira (antes, cinco por pessoa), sem sombra. A reação de cada uma (palmas, braços para cima, cabeça
 * baixa, levantar) é só a matriz dela (lib/flair/nucleos/gente/leve.ts).
 */
import * as THREE from "three";
import { COR_DO_ROSTO, COR_DO_SAPATO, corpoHumanoLeve, type CorpoHumanoLeve } from "@/components/flair/nucleos/gente/corpo-humano-leve";
import { geometriasDaTorcida } from "@/components/flair/nucleos/gente/torcida-3d";
import type { PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";
import type { PoseLeve } from "@/lib/flair/nucleos/gente/leve";

/** Altura do ombro do humano leve, onde os braços se prendem. */
const OMBRO = 1.38;
/** Quanto o corpo de cima desce quando a pessoa leve está sentada (o quadril chega à altura do assento). */
const ASSENTO = 0.43;
/** As cinco malhas do corpo leve, na ordem em que são desenhadas. */
export const MALHAS_LEVES = ["tronco", "bracos", "cabeca", "cabelo", "pernas"] as const;
type Malha = (typeof MALHAS_LEVES)[number];
/** O que o corpo humano leve tem a mais que as cápsulas, e a malha cuja matriz cada parte acompanha. */
const EXTRAS = { maos: "bracos", rosto: "cabeca", pes: "pernas" } as const;
type Extra = keyof typeof EXTRAS;

/** As cores do corpo leve tiradas da roupa da pessoa: a peça de cima (ou o vestido), a de baixo, a pele e o cabelo. */
export function coresDoCorpoLeve(p: PessoaDoElenco): { roupa: string; calca: string; pele: string; cabelo: string } {
  const cima = p.pecas.find((x) => x.slot === "full") ?? p.pecas.find((x) => x.slot === "outer") ?? p.pecas.find((x) => x.slot === "upper");
  const baixo = p.pecas.find((x) => x.slot === "lower") ?? cima;
  return { roupa: cima?.colorHex ?? "#777777", calca: baixo?.colorHex ?? "#333333", pele: p.pele, cabelo: p.cabelo?.color ?? p.pele };
}

/** Onde a pessoa leve está: o lugar no piso, o giro (rad) e a pose do momento. */
export interface LugarLeve {
  x: number;
  y: number;
  z: number;
  giro: number;
}

const BASE = new THREE.Matrix4();
const PARTE = new THREE.Matrix4();
const AUX = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler(0, 0, 0, "YXZ");
const P = new THREE.Vector3();
const S = new THREE.Vector3();
const SOME = new THREE.Matrix4().makeScale(0, 0, 0);
const COR = new THREE.Color();

/** As pessoas leves de uma cena, em cinco malhas instanciadas (uma vaga por pessoa). */
export class MultidaoLeve {
  readonly grupo = new THREE.Group();
  readonly capacidade: number;
  private readonly malhas: Record<Malha, THREE.InstancedMesh>;
  /** as cápsulas de reserva (próprias); o corpo humano leve, quando chega, é compartilhado e não é descartado aqui */
  private capsulas: ReturnType<typeof geometriasDaTorcida> | null = geometriasDaTorcida();
  private readonly extras: Partial<Record<Extra, THREE.InstancedMesh>> = {};
  private readonly peles: string[];
  private descartada = false;
  private readonly material = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  private readonly escalas: number[];
  private readonly visiveis: boolean[];
  private mudou = false;

  constructor(capacidade: number) {
    this.capacidade = Math.max(1, capacidade);
    this.grupo.name = "corpos-leves";
    this.escalas = new Array(this.capacidade).fill(1);
    this.visiveis = new Array(this.capacidade).fill(false);
    this.peles = new Array(this.capacidade).fill("#C99A7A");
    const g = this.capsulas!;
    const malha = (nome: Malha) => this.malha(nome, g[nome]);
    this.malhas = { tronco: malha("tronco"), bracos: malha("bracos"), cabeca: malha("cabeca"), cabelo: malha("cabelo"), pernas: malha("pernas") };
    void corpoHumanoLeve().then((corpo) => {
      if (corpo && !this.descartada) this.usarCorpoHumano(corpo);
    });
  }

  private malha(nome: string, geometria: THREE.BufferGeometry): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(geometria, this.material, this.capacidade);
    m.name = `leve-${nome}`;
    // as pessoas andam pela sala: a esfera de recorte de uma malha instanciada não acompanha
    m.frustumCulled = false;
    m.castShadow = false;
    for (let i = 0; i < this.capacidade; i++) m.setMatrixAt(i, SOME);
    this.grupo.add(m);
    return m;
  }

  /** Troca as cápsulas pelo corpo humano modelado e acrescenta as mãos, o rosto e os sapatos (matrizes das partes que seguem). */
  usarCorpoHumano(corpo: CorpoHumanoLeve): void {
    for (const nome of MALHAS_LEVES) this.malhas[nome].geometry = corpo[nome];
    for (const g of Object.values(this.capsulas ?? {})) g.dispose();
    this.capsulas = null;
    for (const nome of Object.keys(EXTRAS) as Extra[]) {
      const m = this.malha(nome, corpo[nome]);
      const segue = this.malhas[EXTRAS[nome]];
      for (let i = 0; i < this.capacidade; i++) {
        segue.getMatrixAt(i, PARTE);
        m.setMatrixAt(i, PARTE);
        m.setColorAt(i, COR.set(nome === "maos" ? this.peles[i] : nome === "rosto" ? COR_DO_ROSTO : COR_DO_SAPATO));
      }
      this.extras[nome] = m;
    }
    this.mudou = true;
  }

  /** A mesma matriz na parte e no que a acompanha (a mão com o braço, o rosto com a cabeça, o sapato com a perna). */
  private por(nome: Malha, i: number, matriz: THREE.Matrix4): void {
    this.malhas[nome].setMatrixAt(i, matriz);
    for (const extra of Object.keys(this.extras) as Extra[]) if (EXTRAS[extra] === nome) this.extras[extra]!.setMatrixAt(i, matriz);
  }

  private todas(): THREE.InstancedMesh[] {
    return [...Object.values(this.malhas), ...Object.values(this.extras)];
  }

  /** As cores e a altura da pessoa na vaga `i`. */
  vestir(i: number, pessoa: PessoaDoElenco): void {
    const c = coresDoCorpoLeve(pessoa);
    this.escalas[i] = pessoa.estatura / 1.7;
    this.peles[i] = c.pele;
    this.extras.maos?.setColorAt(i, COR.set(c.pele));
    this.malhas.tronco.setColorAt(i, COR.set(c.roupa));
    this.malhas.bracos.setColorAt(i, COR.set(c.roupa));
    this.malhas.pernas.setColorAt(i, COR.set(c.calca));
    this.malhas.cabeca.setColorAt(i, COR.set(c.pele));
    this.malhas.cabelo.setColorAt(i, COR.set(c.cabelo));
    for (const m of this.todas()) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  /** Põe a pessoa da vaga `i` no lugar, na pose do momento. */
  posar(i: number, em: LugarLeve, pose: PoseLeve): void {
    const desce = pose.sentada ? -ASSENTO : 0;
    BASE.compose(P.set(em.x, em.y + pose.pulo, em.z), Q.setFromEuler(E.set(pose.inclina, em.giro, 0)), S.setScalar(this.escalas[i]));
    PARTE.copy(BASE).multiply(AUX.makeTranslation(0, desce, 0));
    this.por("tronco", i, PARTE);
    this.por("cabeca", i, PARTE);
    this.por("cabelo", i, PARTE);
    this.por("bracos", i, PARTE.copy(BASE).multiply(AUX.makeTranslation(0, OMBRO + desce, 0)).multiply(AUX.makeRotationX(pose.bracos)));
    // sentada, as pernas encolhem (o resto do corpo desce até o assento)
    this.por("pernas", i, PARTE.copy(BASE).multiply(AUX.makeScale(1, pose.sentada ? 0.5 : 1, 1)));
    this.visiveis[i] = true;
    this.mudou = true;
  }

  /** Tira a pessoa da vaga `i` de cena (ela está de corpo inteiro ou escondida). */
  esconder(i: number): void {
    if (!this.visiveis[i]) return;
    this.visiveis[i] = false;
    for (const m of this.todas()) m.setMatrixAt(i, SOME);
    this.mudou = true;
  }

  visivel(i: number): boolean {
    return this.visiveis[i];
  }

  /** Manda as matrizes novas para a placa (uma vez por quadro, só se alguma mudou). */
  fechar(): void {
    if (!this.mudou) return;
    this.mudou = false;
    for (const m of this.todas()) m.instanceMatrix.needsUpdate = true;
  }

  /** A matriz de uma malha da pessoa `i` (para os testes). */
  matriz(nome: Malha, i: number, alvo = new THREE.Matrix4()): THREE.Matrix4 {
    this.malhas[nome].getMatrixAt(i, alvo);
    return alvo;
  }

  descartar(): void {
    this.descartada = true;
    for (const g of Object.values(this.capsulas ?? {})) g.dispose();
    this.material.dispose();
    for (const m of this.todas()) m.dispose();
  }
}

/**
 * O corpo leve de uma pessoa do elenco (nível LONGE de lib/flair/nucleos/gente/detalhe.ts): o mesmo humano leve da
 * torcida (cabeça, pescoço, cabelo, tronco, braços e pernas, torcida-3d.tsx), com a cor da roupa, da calça, da pele e do
 * cabelo da pessoa e a altura dela. De longe continua gente, sem o custo do corpo completo (pele, olhos, roupa costurada).
 */
import * as THREE from "three";
import { geometriasDaTorcida } from "@/components/flair/nucleos/gente/torcida-3d";
import type { PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";

/** Altura do ombro do humano leve, onde os braços se prendem. */
const OMBRO = 1.38;
let geometrias: ReturnType<typeof geometriasDaTorcida> | null = null;
const materiais = new Map<string, THREE.MeshStandardMaterial>();

function material(cor: string): THREE.MeshStandardMaterial {
  let m = materiais.get(cor);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.85 });
    materiais.set(cor, m);
  }
  return m;
}

/** As cores do corpo leve tiradas da roupa da pessoa: a peça de cima (ou o vestido), a de baixo, a pele e o cabelo. */
export function coresDoCorpoLeve(p: PessoaDoElenco): { roupa: string; calca: string; pele: string; cabelo: string } {
  const cima = p.pecas.find((x) => x.slot === "full") ?? p.pecas.find((x) => x.slot === "outer") ?? p.pecas.find((x) => x.slot === "upper");
  const baixo = p.pecas.find((x) => x.slot === "lower") ?? cima;
  return { roupa: cima?.colorHex ?? "#777777", calca: baixo?.colorHex ?? "#333333", pele: p.pele, cabelo: p.cabelo?.color ?? p.pele };
}

export function corpoLeve(p: PessoaDoElenco): THREE.Group {
  geometrias ??= geometriasDaTorcida();
  const g = geometrias;
  const c = coresDoCorpoLeve(p);
  const grupo = new THREE.Group();
  grupo.name = "corpo-leve";
  const pernas = new THREE.Mesh(g.pernas, material(c.calca));
  pernas.name = "pernas";
  grupo.add(new THREE.Mesh(g.tronco, material(c.roupa)), pernas, new THREE.Mesh(g.cabeca, material(c.pele)), new THREE.Mesh(g.cabelo, material(c.cabelo)));
  const bracos = new THREE.Mesh(g.bracos, material(c.roupa));
  bracos.position.y = OMBRO;
  grupo.add(bracos);
  grupo.scale.setScalar(p.estatura / 1.7);
  grupo.visible = false;
  return grupo;
}

/** Quanto o corpo de cima desce quando a pessoa leve está sentada (o quadril chega à altura do assento). */
const ASSENTO = 0.43;

/** A pessoa leve sentada (a plateia de longe): as pernas encolhem e o corpo de cima desce até o assento. */
export function sentarCorpoLeve(grupo: THREE.Group, sentada: boolean): void {
  if (grupo.userData.sentada === sentada) return;
  grupo.userData.sentada = sentada;
  for (const filho of grupo.children) {
    if (filho.name === "pernas") filho.scale.y = sentada ? 0.5 : 1;
    else filho.position.y += sentada ? -ASSENTO : ASSENTO;
  }
}

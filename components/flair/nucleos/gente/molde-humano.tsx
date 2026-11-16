"use client";
/**
 * Molde de uma pessoa de cena (lib/flair/nucleos/gente/elenco.ts): veste o corpo humano do FashionAI uma vez, escondido
 * (o mesmo HumanAvatar do avatar da pessoa e das pessoas do MET Gala Heist), conserta os tecidos, prepara o esqueleto
 * para a locomoção procedural e entrega o modelo pronto para ser clonado (elenco-3d.tsx).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { HumanAvatar, type HumanParts } from "@/components/three/human-avatar";
import { fixFabrics, mendGarments } from "@/components/heist/people/fabric";
import type { HairLod } from "@/lib/avatar3d/human/hair-lod";
import { makeRig, type Rig } from "@/lib/avatar3d/human/locomotion";
import { paintFace } from "@/lib/heist/looks";
import type { PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";

/** O corpo vestido pronto (escondido) e o esqueleto preparado para animar. */
export interface Molde {
  chave: string;
  raiz: THREE.Object3D;
  rig: Rig;
}

interface Props {
  pessoa: PessoaDoElenco;
  cabelo: HairLod;
  onPronto: (m: Molde) => void;
}

export function MoldeHumano({ pessoa, cabelo, onPronto }: Props) {
  const atlas = useMemo(() => paintFace(pessoa.pele, pessoa.rosto, 512), [pessoa]);
  const partes = useRef<HumanParts | null>(null);
  const feito = useRef(false);
  useFrame(() => {
    const p = partes.current;
    if (!p || feito.current) return;
    const ud = p.human.root.userData;
    // pronto = vestido, pele assada, olhos com textura e cabelo preso (quem tem cabelo)
    if (ud.dressed !== true || ud.skin !== "baked" || !ud.eyesReady || (pessoa.cabelo && !p.hair)) return;
    feito.current = true;
    mendGarments(p, pessoa.pecas);
    fixFabrics(p.human.root, pessoa.pecas);
    const rig = makeRig(p.human.bones, p.human.rest.joints, (b) => p.pose.base.get(b), p.pose.hips);
    onPronto({ chave: pessoa.chave, raiz: p.human.root, rig });
  });
  return (
    <HumanAvatar body={pessoa.corpo} stature={pessoa.estatura} skin={pessoa.pele} hair={pessoa.cabelo} atlas={atlas} pieces={pessoa.pecas}
      externalPose motion hairLod={cabelo} wind={0.1} onReady={(p) => { partes.current = p; }} />
  );
}

"use client";
/**
 * O uniforme dos jogos de zonas no corpo da personagem (rodada zonas; lib/flair/nucleos/uniforme/desenho.ts): as
 * estampas (escudo, número, estrela, emblema) coladas na roupa pintada, a gola, o cinto, as dragonas, a capa e, na fase
 * de uso do piloto, o capacete. Tudo pendurado nos ossos do esqueleto, montado depois que a roupa pintada fica pronta;
 * refeito quando a pessoa pinta de novo. A capa balança com o vento (parada com "reduzir movimento").
 */
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { HumanParts } from "@/components/three/human-avatar";
import type { ItemDoUniforme } from "@/lib/flair/nucleos/uniforme/desenho";
import { moldeDoCorpo } from "@/components/flair/nucleos/scene/uniforme/molde-do-corpo";
import { malhaDaEstampa, malhaDoAdereco } from "@/components/flair/nucleos/scene/uniforme/pecas-do-uniforme";
import { agora } from "@/components/flair/nucleos/scene/stage-context";

interface Props {
  humano: HumanParts | null;
  /** o prefixo das malhas da roupa pintada (peca-pintada-<JOGO>) */
  prefixo: string;
  itens: ItemDoUniforme[];
  /** a fase de uso: o capacete entra (no ateliê o rosto fica à vista) */
  emUso: boolean;
  reduzido: boolean;
  /** muda quando a roupa pintada é refeita: o uniforme é montado de novo sobre ela */
  chaveDaRoupa: string;
}

/** Quadros de espera para a roupa pintada estar montada antes de ler a superfície dela. */
const ESPERA_QUADROS = 3;

export function UniformeNoCorpo({ humano, prefixo, itens, emUso, reduzido, chaveDaRoupa }: Props) {
  const capas = useRef<THREE.Object3D[]>([]);
  const chave = JSON.stringify(itens) + emUso;
  useEffect(() => {
    if (!humano || !itens.length) return;
    const pendurados: THREE.Object3D[] = [];
    let quadros = 0;
    let pedido = 0;
    let escondeuCabelo = false;
    const montar = () => {
      if (++quadros < ESPERA_QUADROS) {
        pedido = requestAnimationFrame(montar);
        return;
      }
      const molde = moldeDoCorpo(humano, prefixo);
      for (const item of itens) {
        if (item.tipo !== "ESTAMPA" && item.soNoUso && !emUso) continue;
        const pronto = item.tipo === "ESTAMPA" ? { objeto: malhaDaEstampa(item, molde), osso: "Spine2" } : malhaDoAdereco(item, molde, humano.human.rest.body);
        if (!pronto) continue;
        pronto.objeto.traverse((o) => void (o.castShadow = true));
        humano.human.bone(pronto.osso).add(pronto.objeto);
        pendurados.push(pronto.objeto);
        if (item.tipo === "CAPACETE" && humano.hair) {
          humano.hair.visible = false;
          escondeuCabelo = true;
        }
      }
      capas.current = pendurados.filter((o) => o.name === "uniforme-capa");
    };
    pedido = requestAnimationFrame(montar);
    return () => {
      cancelAnimationFrame(pedido);
      if (escondeuCabelo && humano.hair) humano.hair.visible = true;
      for (const o of pendurados) {
        o.removeFromParent();
        o.traverse((x) => {
          const m = x as THREE.Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          mats.forEach((mt) => {
            (mt as THREE.MeshStandardMaterial).map?.dispose();
            mt.dispose();
          });
        });
      }
      capas.current = [];
    };
    // a chave cobre os itens; a roupa refeita pede o uniforme de novo
  }, [humano, prefixo, chave, chaveDaRoupa]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    if (reduzido) return;
    const t = agora();
    for (const c of capas.current) c.rotation.x = -0.05 - Math.sin(t * 1.7) * 0.035;
  });
  return null;
}

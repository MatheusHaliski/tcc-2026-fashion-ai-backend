"use client";
/**
 * As pessoas de cena como gente (lib/flair/nucleos/gente): cada pessoa do elenco vira um molde montado uma vez
 * (molde-humano.tsx) e um clone na cena (SkeletonUtils: geometria e materiais do molde, esqueleto próprio). A cada quadro,
 * lê onde cada ator está e o que faz (`atores`), anima o esqueleto pela locomoção procedural do avatar
 * (lib/avatar3d/human/locomotion.ts) e escolhe o nível de detalhe pela distância da câmera (detalhe.ts): perto ou na
 * jogada, completo e com sombra; mais longe, sem os acabamentos e animado com menos frequência; nunca um pino.
 *
 * Os moldes montam dois por vez, primeiro os de quem está mais perto. Até o molde ficar pronto, quem chama desenha a
 * figura simples dele (`prontos` diz quem já é gente).
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as clonarComOssos } from "three/examples/jsm/utils/SkeletonUtils.js";
import { corpoLeve, sentarCorpoLeve } from "@/components/flair/nucleos/gente/corpo-leve";
import { MoldeHumano, type Molde } from "@/components/flair/nucleos/gente/molde-humano";
import { animate, cloneRig, newMotionState, type MotionState, type Rig } from "@/lib/avatar3d/human/locomotion";
import type { Motion } from "@/lib/avatar3d/human/locomotion-model";
import { corposCheios, nivelDeDetalhe, QUADROS_POR_NIVEL, type NivelDeDetalhe } from "@/lib/flair/nucleos/gente/detalhe";
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import { aplicarGesto } from "@/lib/flair/nucleos/gente/gestos";
import { agora as relogioDaCena } from "@/components/flair/nucleos/scene/stage-context";
import { sorteio, type PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";

interface Clone {
  grupo: THREE.Group;
  /** o corpo completo e o corpo leve (nível LONGE): um dos dois aparece */
  raiz: THREE.Object3D;
  leve: THREE.Group;
  rig: Rig;
  st: MotionState;
  malhas: THREE.Mesh[];
  detalhes: THREE.Object3D[];
  nivel: NivelDeDetalhe | null;
  quadro: number;
  acumulado: number;
  anim: Motion;
  desde: number;
}

const PARALELO = 2;
/** acabamentos de poucos pixels: saem no nível leve (mesmos nomes de malha do corpo humano) */
const DETALHE = /^(córnea|linha-dagua|pelos-sobrancelhas|barra-|punho-|costura-|botoes-|gola-ponta-|cadarco-|colarinho-)/;
const RAD_CHUTE = -1.15;

function clonar(m: Molde, pessoa: PessoaDoElenco, id: string, semente: number): Clone {
  const raiz = clonarComOssos(m.raiz);
  let corpo: THREE.SkinnedMesh | null = null;
  raiz.traverse((o) => {
    const s = o as THREE.SkinnedMesh;
    if (s.isSkinnedMesh && s.name === "corpo") corpo = s;
  });
  const malhas: THREE.Mesh[] = [];
  const detalhes: THREE.Object3D[] = [];
  raiz.traverse((o) => {
    const s = o as THREE.SkinnedMesh;
    if (s.isSkinnedMesh && corpo && s !== corpo) s.bind((corpo as THREE.SkinnedMesh).skeleton, s.bindMatrix);
    if ((o as THREE.Mesh).isMesh) {
      o.frustumCulled = false;
      malhas.push(o as THREE.Mesh);
    }
    if (o !== raiz && DETALHE.test(o.name)) detalhes.push(o);
  });
  raiz.visible = true;
  const grupo = new THREE.Group();
  grupo.name = `pessoa-${id}`;
  grupo.add(raiz);
  const leve = corpoLeve(pessoa);
  grupo.add(leve);
  const rig = cloneRig(m.rig, raiz);
  return { grupo, raiz, leve, rig, st: newMotionState(rig, semente, "idle"), malhas, detalhes, nivel: null, quadro: semente % 4, acumulado: 0, anim: "idle", desde: 0 };
}

interface Props {
  pessoas: Map<string, PessoaDoElenco>;
  atores: () => AtorDeCena[];
  /** quem já é gente na cena (quem chama esconde a figura simples dessas) */
  prontos: React.MutableRefObject<Set<string>>;
  reduzido: boolean;
  /** quantos corpos inteiros ao mesmo tempo (as salas com plateia: CORPOS_CHEIOS); sem limite, todos pela distância */
  limite?: number;
}

export function Elenco3D({ pessoas, atores, prontos, reduzido, limite = Infinity }: Props) {
  const grupo = useMemo(() => new THREE.Group(), []);
  const moldes = useRef(new Map<string, Molde>());
  const clones = useRef(new Map<string, Clone>());
  const [montando, setMontando] = useState<PessoaDoElenco[]>([]);
  const ultimoPlano = useRef(-1);
  /** quem pode ter o corpo inteiro agora: os mais perto da câmera e quem está na jogada (detalhe.ts) */
  const cheios = useRef<Set<string> | null>(null);
  /** quem fica de corpo leve sem nunca montar o corpo inteiro (fora dos cheios): sem molde, sem esqueleto */
  const soLeves = useRef(new Map<string, THREE.Group>());
  useEffect(() => () => {
    grupo.clear();
    clones.current.clear();
    soLeves.current.clear();
  }, [grupo]);

  useFrame(({ camera, clock, gl }, dtCru) => {
    const dt = Math.min(0.1, dtCru);
    // medida do orçamento (docs/flair/flair-3d/BASE_NUCLEOS.md): triângulos e chamadas do quadro anterior
    if (typeof window !== "undefined") (window as unknown as { __flairGente?: unknown }).__flairGente = { pessoas: clones.current.size, moldes: moldes.current.size, triangulos: gl.info.render.triangles, chamadas: gl.info.render.calls };
    const agora = clock.elapsedTime;
    const lista = atores();
    // plano de montagem: os moldes de quem está mais perto da câmera primeiro, dois por vez
    if (agora - ultimoPlano.current > 0.4) {
      ultimoPlano.current = agora;
      cheios.current = corposCheios(lista.map((a) => ({ id: a.id, naJogada: a.naJogada, distancia: Math.hypot(a.x - camera.position.x, a.z - camera.position.z) })), limite);
      const faltam = lista
        .map((a) => ({ p: pessoas.get(a.id), d: Math.hypot(a.x - camera.position.x, a.z - camera.position.z) }))
        .filter((x): x is { p: PessoaDoElenco; d: number } => !!x.p && !moldes.current.has(x.p.chave) && !montando.some((m) => m.chave === x.p!.chave))
        // só monta o corpo inteiro de quem pode tê-lo (os outros ficam no corpo leve, que não precisa de molde)
        .filter((x) => !cheios.current || lista.some((a) => pessoas.get(a.id) === x.p && cheios.current!.has(a.id)))
        .sort((a, b) => a.d - b.d);
      const ocupados = montando.filter((m) => !moldes.current.has(m.chave)).length;
      const novos = faltam.slice(0, Math.max(0, PARALELO - ocupados)).map((x) => x.p);
      if (novos.length) setMontando((m) => [...m, ...novos.filter((p, i) => !m.some((x) => x.chave === p.chave) && novos.findIndex((x) => x.chave === p.chave) === i)]);
    }
    /** o corpo leve sozinho de quem não tem (nem vai ter agora) o corpo inteiro: no lugar, no giro, sentado ou de pé */
    const soLeve = (a: AtorDeCena, pessoa: PessoaDoElenco): THREE.Group => {
      let g = soLeves.current.get(a.id);
      if (!g) {
        g = corpoLeve(pessoa);
        soLeves.current.set(a.id, g);
        grupo.add(g);
        prontos.current.add(a.id);
      }
      g.visible = !a.oculto;
      g.position.set(a.x, a.altura ?? 0, a.z);
      g.rotation.set(0, a.giro, 0);
      sentarCorpoLeve(g, a.anim === "sit");
      return g;
    };
    for (const a of lista) {
      const pessoa = pessoas.get(a.id);
      const molde = pessoa && moldes.current.get(pessoa.chave);
      let c = clones.current.get(a.id);
      const leve = !c && pessoa && cheios.current && !cheios.current.has(a.id) ? soLeve(a, pessoa) : null;
      if (leve) continue;
      const sobra = soLeves.current.get(a.id);
      if (sobra) sobra.visible = false;
      if (!c && molde) {
        c = clonar(molde, pessoa, a.id, Math.floor(sorteio(1, a.id) * 1000));
        clones.current.set(a.id, c);
        grupo.add(c.grupo);
        prontos.current.add(a.id);
      }
      if (!c) continue;
      c.grupo.visible = !a.oculto;
      c.grupo.position.set(a.x, a.altura ?? 0, a.z);
      c.grupo.rotation.set(0, a.giro, a.tombo ?? 0);
      if (a.anim !== c.anim) {
        c.anim = a.anim;
        c.desde = agora;
      }
      const cheio = !cheios.current || cheios.current.has(a.id);
      const nivel = cheio ? nivelDeDetalhe(Math.hypot(a.x - camera.position.x, a.z - camera.position.z), a.naJogada) : "LONGE";
      sentarCorpoLeve(c.leve, a.anim === "sit");
      if (nivel !== c.nivel) {
        c.nivel = nivel;
        for (const m of c.malhas) m.castShadow = nivel === "COMPLETO";
        for (const o of c.detalhes) o.visible = nivel === "COMPLETO";
        c.raiz.visible = nivel !== "LONGE";
        c.leve.visible = nivel === "LONGE";
      }
      // de longe, o corpo leve não tem esqueleto: nada a animar
      if (nivel === "LONGE") continue;
      c.acumulado += dt;
      if (++c.quadro % QUADROS_POR_NIVEL[nivel] !== 0 && c.st.t > 0) continue;
      const passo = reduzido ? 0 : c.acumulado;
      animate(c.rig, c.st, { anim: a.anim, animT: agora - c.desde, speed: reduzido ? 0 : a.velocidade, time: agora }, passo);
      c.acumulado = 0;
      if (a.chute) c.rig.bones[c.rig.k.RightUpLeg].rotateX(RAD_CHUTE * a.chute);
      // o gesto do momento (aplaudir, lamentar, a guarda): com "reduzir movimento", parado no meio
      if (a.gesto) aplicarGesto(c.rig, a.gesto, reduzido ? 0.6 : relogioDaCena() - (a.gestoDesde ?? 0), c.st.seed);
    }
  });

  return (
    <>
      <primitive object={grupo} />
      <group visible={false} name="moldes">
        {montando.map((p) => (
          <MoldeHumano key={p.chave} pessoa={p} cabelo={3} onPronto={(m) => { moldes.current.set(m.chave, m); }} />
        ))}
      </group>
    </>
  );
}

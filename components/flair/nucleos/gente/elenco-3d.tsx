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
import { MultidaoLeve } from "@/components/flair/nucleos/gente/corpo-leve";
import { MoldeHumano, type Molde } from "@/components/flair/nucleos/gente/molde-humano";
import { animate, cloneRig, newMotionState, type MotionState, type Rig } from "@/lib/avatar3d/human/locomotion";
import type { Motion } from "@/lib/avatar3d/human/locomotion-model";
import { corposCheios, nivelDeDetalhe, QUADROS_POR_NIVEL, type NivelDeDetalhe } from "@/lib/flair/nucleos/gente/detalhe";
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import { aplicarGesto } from "@/lib/flair/nucleos/gente/gestos";
import { poseLeveAnimada, poseLeveDoAtor } from "@/lib/flair/nucleos/gente/leve";
import { agora as relogioDaCena } from "@/components/flair/nucleos/scene/stage-context";
import { sorteio, type PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";

interface Clone {
  grupo: THREE.Group;
  /** o corpo completo; no nível LONGE ele some e a pessoa aparece na multidão leve */
  raiz: THREE.Object3D;
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

function clonar(m: Molde, id: string, semente: number): Clone {
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
  const rig = cloneRig(m.rig, raiz);
  return { grupo, raiz, rig, st: newMotionState(rig, semente, "idle"), malhas, detalhes, nivel: null, quadro: semente % 4, acumulado: 0, anim: "idle", desde: 0 };
}

interface Props {
  pessoas: Map<string, PessoaDoElenco>;
  atores: () => AtorDeCena[];
  /** quem já é gente na cena (quem chama esconde a figura simples dessas) */
  prontos: React.MutableRefObject<Set<string>>;
  reduzido: boolean;
  /** quantos corpos inteiros ao mesmo tempo (o orçamento da cena, que cai com a qualidade); sem limite, todos pela distância */
  limite?: number | (() => number);
}

/** De quantos em quantos quadros a pessoa leve que reage (palmas, braços para cima) é reposta. */
const QUADROS_DO_LEVE = 2;

export function Elenco3D({ pessoas, atores, prontos, reduzido, limite = Infinity }: Props) {
  const grupo = useMemo(() => new THREE.Group(), []);
  const moldes = useRef(new Map<string, Molde>());
  const clones = useRef(new Map<string, Clone>());
  const [montando, setMontando] = useState<PessoaDoElenco[]>([]);
  const ultimoPlano = useRef(-1);
  /** quem pode ter o corpo inteiro agora: os mais perto da câmera e quem está na jogada (detalhe.ts) */
  const cheios = useRef<Set<string> | null>(null);
  /** as pessoas leves, todas em cinco malhas instanciadas: a vaga de cada uma e a pose que já está na malha */
  const vagas = useMemo(() => new Map([...pessoas.keys()].map((id, i) => [id, i] as const)), [pessoas]);
  const multidao = useMemo(() => {
    const m = new MultidaoLeve(pessoas.size);
    for (const [id, p] of pessoas) m.vestir(vagas.get(id)!, p);
    return m;
  }, [pessoas, vagas]);
  const posta = useRef(new Map<string, string>());
  const quadro = useRef(0);
  useEffect(() => {
    grupo.add(multidao.grupo);
    const postas = posta.current;
    return () => {
      grupo.remove(multidao.grupo);
      multidao.descartar();
      postas.clear();
    };
  }, [grupo, multidao]);
  useEffect(() => () => {
    grupo.clear();
    clones.current.clear();
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
      cheios.current = corposCheios(lista.map((a) => ({ id: a.id, naJogada: a.naJogada, distancia: Math.hypot(a.x - camera.position.x, a.z - camera.position.z) })), typeof limite === "function" ? limite() : limite);
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
    const t = relogioDaCena();
    const repor = ++quadro.current % QUADROS_DO_LEVE === 0;
    /** a pessoa leve na vaga dela: reposta só quando mudou de lugar ou de reação, ou enquanto o gesto mexe */
    const leve = (a: AtorDeCena) => {
      const i = vagas.get(a.id);
      if (i == null) return;
      if (a.oculto) return multidao.esconder(i);
      const chave = `${a.x.toFixed(3)}|${a.z.toFixed(3)}|${a.giro.toFixed(3)}|${a.altura ?? 0}|${a.anim}|${a.gesto ?? ""}`;
      if (multidao.visivel(i) && posta.current.get(a.id) === chave && !(repor && poseLeveAnimada(a) && !reduzido)) return;
      posta.current.set(a.id, chave);
      multidao.posar(i, { x: a.x, y: a.altura ?? 0, z: a.z, giro: a.giro }, poseLeveDoAtor(a, t, sorteio(1, a.id), reduzido));
      prontos.current.add(a.id);
    };
    for (const a of lista) {
      const pessoa = pessoas.get(a.id);
      const molde = pessoa && moldes.current.get(pessoa.chave);
      let c = clones.current.get(a.id);
      const cheio = !cheios.current || cheios.current.has(a.id);
      if (!c && molde) {
        c = clonar(molde, a.id, Math.floor(sorteio(1, a.id) * 1000));
        clones.current.set(a.id, c);
        grupo.add(c.grupo);
        prontos.current.add(a.id);
      }
      // sem corpo inteiro (fora dos cheios, ou o molde ainda monta): a pessoa leve fica no lugar dela
      if (!c) {
        leve(a);
        continue;
      }
      c.grupo.visible = !a.oculto;
      c.grupo.position.set(a.x, a.altura ?? 0, a.z);
      c.grupo.rotation.set(0, a.giro, a.tombo ?? 0);
      if (a.anim !== c.anim) {
        c.anim = a.anim;
        c.desde = agora;
      }
      const nivel = cheio ? nivelDeDetalhe(Math.hypot(a.x - camera.position.x, a.z - camera.position.z), a.naJogada) : "LONGE";
      if (nivel !== c.nivel) {
        c.nivel = nivel;
        for (const m of c.malhas) m.castShadow = nivel === "COMPLETO";
        for (const o of c.detalhes) o.visible = nivel === "COMPLETO";
        c.raiz.visible = nivel !== "LONGE";
      }
      // de longe, a pessoa leve não tem esqueleto: nada a animar além da matriz dela
      if (nivel === "LONGE") {
        leve(a);
        continue;
      }
      const vaga = vagas.get(a.id);
      if (vaga != null) multidao.esconder(vaga);
      c.acumulado += dt;
      if (++c.quadro % QUADROS_POR_NIVEL[nivel] !== 0 && c.st.t > 0) continue;
      const passo = reduzido ? 0 : c.acumulado;
      animate(c.rig, c.st, { anim: a.anim, animT: agora - c.desde, speed: reduzido ? 0 : a.velocidade, time: agora }, passo);
      c.acumulado = 0;
      if (a.chute) c.rig.bones[c.rig.k.RightUpLeg].rotateX(RAD_CHUTE * a.chute);
      // o gesto do momento (aplaudir, lamentar, a guarda): com "reduzir movimento", parado no meio
      if (a.gesto) aplicarGesto(c.rig, a.gesto, reduzido ? 0.6 : t - (a.gestoDesde ?? 0), c.st.seed, a.intensidade, a.ritmo);
    }
    multidao.fechar();
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

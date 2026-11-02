"use client";
/*
 * MET Gala Heist v2 — as pessoas em cena: convidadas de vestido longo, convidados de smoking, garçons, seguranças,
 * fotógrafos, fãs e a jogadora, todos com o corpo humano do FashionAI (MakeHuman CC0: pele, olhos, sobrancelhas, cabelo
 * e roupa com geometria 3D presa ao esqueleto).
 *
 * Montar um corpo vestido custa caro (forma, cabelo, roupa, pele assada), então cada aparência de looks.ts vira um MODELO
 * montado uma vez, escondido, e a multidão são CLONES dele (SkeletonUtils): geometria, texturas e materiais compartilhados,
 * esqueleto próprio por pessoa (um só por clone: um upload de ossos por quadro). A variação vem da semente: modelo,
 * cor do vestido/paletó (material tingido, com brilho de cetim), altura (±5 %), passada, olhar e gestos fora de fase.
 *
 * Cada quadro: lê `view.current.actors` e `.player` (posição, giro, gesto, velocidade, objeto na mão, olhar, tiro levado,
 * cansaço), anima o esqueleto pela locomoção procedural (lib/avatar3d/human/locomotion.ts) e mostra o objeto da mão.
 * Desempenho: só desenha quem está visível e dentro da câmera; longe, anima a cada 2–4 quadros com o tempo acumulado;
 * sombra só de quem está perto. Os modelos carregam aos poucos, primeiro os de quem está mais perto (`onProgress`).
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Look3dPiece } from "@/components/three/common";
import type { HairLod } from "@/lib/avatar3d/human/hair-lod";
import type { SceneView } from "@/lib/heist/view";
import { templateFor, type LookTemplate } from "@/lib/heist/looks";
import { instantiate, step, type Person, type Template } from "./person";
import { TemplateBuilder } from "./template-builder";
import { PlayerBody } from "./player-body";

/** Quantos modelos montam ao mesmo tempo (cada um trava a página por alguns décimos de segundo enquanto monta). */
const PARALLEL = 2;
/** Clones novos por quadro. */
const CLONES_PER_FRAME = 3;

const FRUSTUM = new THREE.Frustum(), PV = new THREE.Matrix4(), SPHERE = new THREE.Sphere();
const LYING = new Set(["dead", "knockedOut", "downed", "crawl"]);

/* ---------- multidão ---------- */
export interface HeistPeopleProps { view: React.MutableRefObject<SceneView>; playerPieces: Look3dPiece[]; quality: "high" | "low"; onProgress?: (p: number) => void }

export function HeistPeople({ view, playerPieces, quality, onProgress }: HeistPeopleProps) {
  const crowd = useMemo(() => { const g = new THREE.Group(); g.name = "multidao"; return g; }, []);
  const [mounted, setMounted] = useState<LookTemplate[]>([]);
  const ready = useRef(new Map<string, Template>());
  const people = useRef(new Map<string, Person>());
  const plan = useRef({ at: -1, need: [] as LookTemplate[], player: false, progress: -1 });
  const hairLod: HairLod = quality === "high" ? 2 : 3;
  // lanternas dos seguranças: poucas luzes fixas, ligadas nos mais perto (o número de luzes nunca muda: sem recompilar)
  const spots = useMemo(() => (quality === "high" ? [0, 1] : []).map(() => { const l = new THREE.SpotLight("#fff1d2", 0, 16, 0.38, 0.6, 1.3); l.castShadow = false; return l; }), [quality]);
  useEffect(() => () => { crowd.clear(); people.current.clear(); }, [crowd]);

  const report = () => {
    const pl = plan.current, need = pl.need.length + 1;
    const have = pl.need.filter((t) => ready.current.has(t.key)).length + (pl.player ? 1 : 0);
    const p = need ? have / need : 1;
    if (Math.abs(p - pl.progress) > 1e-3) { pl.progress = p; onProgress?.(p); }
    if (typeof window !== "undefined") (window as unknown as { __heistPeople?: unknown }).__heistPeople = { progress: p, templates: ready.current.size, people: people.current.size };
  };

  useFrame(({ camera }, rawDt) => {
    const v = view.current, time = v.time, dt = Math.min(0.1, rawDt);
    // plano de carga: que modelos as pessoas em cena usam, os de quem está mais perto primeiro
    const now = performance.now(), pl = plan.current;
    if (now - pl.at > 400) {
      pl.at = now;
      const near = new Map<string, { t: LookTemplate; d: number }>();
      for (const a of v.actors) {
        const t = templateFor(a.look as never, a.seed), d = Math.hypot(a.x - v.player.x, a.z - v.player.z) - (a.visible ? 30 : 0);
        const cur = near.get(t.key); if (!cur || d < cur.d) near.set(t.key, { t, d });
      }
      pl.need = [...near.values()].sort((x, y) => x.d - y.d).map((x) => x.t);
      const building = mounted.filter((t) => !ready.current.has(t.key)).length;
      const next = pl.need.filter((t) => !mounted.some((m) => m.key === t.key)).slice(0, Math.max(0, PARALLEL - building));
      if (next.length) setMounted((m) => [...m, ...next.filter((t) => !m.some((x) => x.key === t.key))]);
      report();
    }
    // clones novos para quem já tem modelo pronto
    let made = 0;
    for (const a of v.actors) {
      if (made >= CLONES_PER_FRAME) break;
      if (people.current.has(a.id)) continue;
      const look = templateFor(a.look as never, a.seed), tp = ready.current.get(look.key);
      if (!tp) continue;
      const p = instantiate(tp, look, a); people.current.set(a.id, p); crowd.add(p.holder); made++;
    }
    // quadro de cada pessoa: visível, dentro da câmera, frequência pela distância, sombra só perto
    PV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FRUSTUM.setFromProjectionMatrix(PV);
    const cx = camera.position.x, cz = camera.position.z;
    let spot = 0;
    for (const a of v.actors) {
      const p = people.current.get(a.id); if (!p) continue;
      p.lastSeen = time;
      if (!a.visible) { p.holder.visible = false; continue; }
      const d = Math.hypot(a.x - cx, a.z - cz);
      SPHERE.center.set(a.x, a.y + 0.9, a.z); SPHERE.radius = LYING.has(a.anim) ? 1.9 : 1.3;
      const inView = FRUSTUM.intersectsSphere(SPHERE);
      p.holder.visible = inView;
      p.acc += dt;
      if (!inView) continue;
      const every = d < 14 ? 1 : d < 28 ? 2 : 4;
      if (++p.frame % every === 0 || !p.init) { step(p, a, time, Math.min(0.1, p.acc)); p.acc = 0; }
      else { p.holder.position.set(a.x, p.y, a.z); p.holder.rotation.y = a.yaw; }
      const shadow = quality === "high" && d < 14;
      if (shadow !== p.shadow) { p.shadow = shadow; for (const m of p.meshes) m.castShadow = shadow; }
      // de longe, os detalhes de poucos pixels saem (menos chamadas de desenho com o salão cheio)
      const far = d > (quality === "high" ? 13 : 9);
      if (far !== p.far) { p.far = far; for (const o of p.detail) o.visible = !far; }
      // lanterna acesa nos dois seguranças visíveis mais perto que estão com ela na mão
      if (a.hold === "flashlight" && spot < spots.length && d < 26) {
        const torch = p.holds.get("flashlight"); const at = torch?.userData.lightAt as { x: number; y: number; z: number } | undefined; const aim = torch?.userData.target as THREE.Object3D | undefined;
        if (torch && at && aim) {
          const l = spots[spot++]; torch.updateWorldMatrix(true, false);
          l.position.set(at.x, at.y, at.z).applyMatrix4(torch.matrixWorld); aim.getWorldPosition(l.target.position); l.target.updateMatrixWorld(); l.intensity = 26;
        }
      }
    }
    for (let i = spot; i < spots.length; i++) spots[i].intensity = 0;
    // quem saiu da cena (segurança desativado, figurante removido) some
    for (const [id, p] of people.current) if (p.lastSeen !== time) { p.holder.visible = false; if (!v.actors.some((a) => a.id === id)) { crowd.remove(p.holder); people.current.delete(id); } }
  });

  return <>
    <primitive object={crowd} />
    {spots.map((l, i) => <group key={i}><primitive object={l} /><primitive object={l.target} /></group>)}
    <group visible={false} name="modelos">
      {mounted.map((t) => <TemplateBuilder key={t.key} t={t} hairLod={hairLod} onDone={(tp) => { ready.current.set(tp.key, tp); report(); }} />)}
    </group>
    <PlayerBody view={view} pieces={playerPieces} quality={quality} onReady={() => { plan.current.player = true; report(); }} />
  </>;
}

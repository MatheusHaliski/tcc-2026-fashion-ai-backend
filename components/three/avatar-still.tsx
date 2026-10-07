"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import AvatarViewer from "@/components/three/avatar-viewer";
import type { HumanParts } from "@/components/three/human-avatar";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import type { BodyParams } from "@/lib/avatar3d/body-spec";
import { STILLS, stillKey, stillTick } from "@/lib/avatar3d/still";

/**
 * Prévia 2D (RF28, PROV-2D): o MESMO Avatar 3D do espelho — corpo medido, pele, rosto, cabelo e as peças vestidas
 * pelo mesmo HumanOutfit — renderizado uma vez de frente, parado na pose de repouso, e mostrado como imagem.
 * Substitui o boneco genérico da prévia 2D antiga: não existe mais um segundo personagem.
 *
 *  - O Canvas existe só até a foto: depois vira <img> e o contexto WebGL é liberado (leve no quarto e no celular).
 *  - A foto fica só em memória (lib/avatar3d/still.ts): tem o rosto da pessoa e não vai para storage, servidor nem log.
 *  - `hidden`: renderiza fora da tela (o quarto 3D usa a foto como reflexo no vidro do espelho).
 */
export interface AvatarStillProps {
  avatar: Avatar3dRef | null; sex: "FEMININO" | "MASCULINO"; body: BodyParams | null; pieces: Look3dPiece[];
  background?: string; hidden?: boolean; width?: number; height?: number;
  onStill?: (url: string | null) => void;              // null: a foto falhou (canvas "sujo"), quem usava a anterior a larga
  alt?: string; className?: string;
}

const OFFSCREEN: CSSProperties = { position: "fixed", left: -10000, top: 0, pointerEvents: "none" };

function Capture({ parts, expectFace, onShot }: { parts: React.MutableRefObject<HumanParts | null>; expectFace: boolean; onShot: (url: string | null) => void }) {
  const { gl, scene, camera } = useThree();
  const t0 = useRef(performance.now()); const stable = useRef(0); const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    const r = stillTick(parts.current?.human.root.userData, expectFace, stable.current, performance.now() - t0.current);
    stable.current = r.stable; if (!r.shoot) return;
    done.current = true;
    gl.render(scene, camera);
    let url: string | null = null;
    try { url = gl.domElement.toDataURL("image/webp", 0.92); } catch { url = null; }   // canvas "sujo": fica o Canvas parado
    onShot(url);
  });
  return null;
}

export default function AvatarStill({ avatar, sex, body, pieces, background = "#EEEAE2", hidden = false, width = 360, height = 720, onStill, alt = "", className }: AvatarStillProps) {
  const key = useMemo(() => stillKey({ avatar, sex, body, pieces, background }), [avatar, sex, body, pieces, background]);
  const [shot, setShot] = useState<{ key: string; url: string | null } | null>(() => { const u = STILLS.get(key); return u ? { key, url: u } : null; });
  const parts = useRef<HumanParts | null>(null);
  const cb = useRef(onStill); cb.current = onStill;
  useEffect(() => {
    const u = STILLS.get(key);
    if (u) { setShot({ key, url: u }); cb.current?.(u); } else setShot((s) => (s?.key === key ? s : null));
  }, [key]);
  const current = shot?.key === key ? shot : null;
  if (current?.url) return hidden ? null : <img src={current.url} alt={alt} className={className} draggable={false} />;
  if (current && hidden) return null;                  // foto falhou fora da tela: não deixa um Canvas escondido aberto
  const expectFace = !!(avatar?.textureUrl || avatar?.texture);
  return (
    <div style={hidden ? { ...OFFSCREEN, width, height } : { width: "100%", height: "100%" }} aria-hidden={hidden || undefined} data-still-key={key}>
      <AvatarViewer avatar={avatar} sex={sex} body={body} pieces={pieces} framing="full" view="front" controls={false} still hairLod={1} background={background}
        onHuman={(p) => { parts.current = p; }}>
        {!current && <Capture parts={parts} expectFace={expectFace} onShot={(url) => {
          if (url) STILLS.set(key, url);
          cb.current?.(url); setShot({ key, url });
        }} />}
      </AvatarViewer>
    </div>
  );
}

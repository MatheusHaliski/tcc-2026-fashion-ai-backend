import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { mediaUrl } from "@/lib/api/client";

/** Texturas carregadas por fora do Suspense: uma foto que falha vira cor lisa, sem derrubar a cena. */
const texCache = new Map<string, Promise<THREE.Texture | null>>();
function loadTexture(url: string): Promise<THREE.Texture | null> {
  let p = texCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const l = new THREE.TextureLoader(); l.setCrossOrigin("anonymous");
      l.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; resolve(t); }, undefined, () => resolve(null));
    });
    texCache.set(url, p);
  }
  return p;
}
export function useTex(url?: string | null) {
  const [t, setT] = useState<THREE.Texture | null>(null);
  useEffect(() => { let alive = true; const u = mediaUrl(url ?? null); if (!u || u.endsWith("/null")) return; loadTexture(u).then((x) => alive && setT(x)); return () => { alive = false; }; }, [url]);
  return t;
}

/**
 * Reflexo do espelho (PROV-2D): a Prévia 2D do avatar chega como data: URL só em memória. Sem o cache global de
 * texturas (que guardaria cada foto para sempre): a textura anterior é descartada quando chega a nova, e o reflexo
 * antigo continua no vidro até lá (sem piscar).
 */
export function useReflection(url?: string | null) {
  const [t, setT] = useState<THREE.Texture | null>(null);
  const cur = useRef<THREE.Texture | null>(null);
  useEffect(() => {
    // sem foto (look trocado ou captura falhou): larga o reflexo anterior para as peças de reserva aparecerem
    if (!url) { cur.current?.dispose(); cur.current = null; setT(null); return; }
    let alive = true;
    new THREE.TextureLoader().load(url, (x) => {
      if (!alive) { x.dispose(); return; }
      x.colorSpace = THREE.SRGBColorSpace; cur.current?.dispose(); cur.current = x; setT(x);
    }, undefined, () => { if (alive) { cur.current?.dispose(); cur.current = null; setT(null); } });
    return () => { alive = false; };
  }, [url]);
  useEffect(() => () => { cur.current?.dispose(); cur.current = null; }, []);
  return t;
}

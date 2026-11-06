"use client";
import { useEffect, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mediaUrl } from "@/lib/api/client";
import { sourceOf, type GlbSource } from "@/lib/avatar3d/human/glb-garment";

/**
 * Só o modelo de vitrine do produto do catálogo (catalog_product_models_3d → /media/catalog/model3d/…) veste o avatar:
 * passou pela importação e pela nota. O .glb do RF16 da própria pessoa (relevo de uma foto) continua só no visualizador.
 */
export function isProductModel(url: string | null | undefined): url is string {
  return !!url && /(^|\/)media\/catalog\/model3d\/[^?#]+\.glb([?#]|$)/.test(url);
}

/** .glb já lidos: a mesma peça em outro look ou outro tamanho não baixa de novo. Falha também fica guardada (null). */
const sources = new Map<string, Promise<GlbSource | null>>();

export function loadGarmentGlb(url: string): Promise<GlbSource | null> {
  const resolved = mediaUrl(url); if (!resolved) return Promise.resolve(null);
  let pending = sources.get(resolved);
  if (!pending) {
    pending = new GLTFLoader().loadAsync(resolved).then((g) => sourceOf(g.scene)).catch(() => null);
    sources.set(resolved, pending);
    if (sources.size > 24) sources.delete(sources.keys().next().value!);
  }
  return pending;
}

/**
 * Malha do .glb de cada peça que tem modelo 3D do produto (model3dUrl), por chave da peça. Enquanto carrega (ou se
 * não carregar), a peça fica com o molde: o avatar nunca espera o .glb para aparecer vestido.
 */
export function useGarmentGlbs(items: { key: string; piece: { model3dUrl?: string | null } }[]): Record<string, GlbSource | null> {
  const [loaded, setLoaded] = useState<Record<string, GlbSource | null>>({});
  const wanted = items.flatMap((i) => (isProductModel(i.piece.model3dUrl) ? [[i.key, i.piece.model3dUrl] as const] : []));
  const key = JSON.stringify(wanted);
  useEffect(() => {
    let alive = true;
    for (const [k, url] of wanted) {
      void loadGarmentGlb(url).then((src) => { if (alive) setLoaded((cur) => (cur[k] === src ? cur : { ...cur, [k]: src })); });
    }
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return Object.fromEntries(wanted.map(([k]) => [k, loaded[k] ?? null]));
}

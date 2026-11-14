/**
 * Manifesto dos objetos GLB das salas, buscado uma vez por sessão. Enquanto não chega (ou se falha), a lista é
 * vazia e as salas ficam com os móveis procedurais.
 */
import { useEffect, useState } from "react";
import { GLB_MANIFESTO, lerManifesto, type ManifestoGlb } from "@/lib/flair/nucleos/scene/assets";

let pedido: Promise<ManifestoGlb> | null = null;
const VAZIO: ManifestoGlb = [];

function buscar(): Promise<ManifestoGlb> {
  pedido ??= fetch(GLB_MANIFESTO)
    .then((r) => (r.ok ? r.json() : []))
    .then(lerManifesto)
    .catch(() => VAZIO);
  return pedido;
}

export function useGlbManifest(): ManifestoGlb {
  const [manifesto, setManifesto] = useState<ManifestoGlb>(VAZIO);
  useEffect(() => {
    let vivo = true;
    if (typeof fetch !== "function") return;
    void buscar().then((m) => {
      if (vivo && m.length > 0) setManifesto(m);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return manifesto;
}

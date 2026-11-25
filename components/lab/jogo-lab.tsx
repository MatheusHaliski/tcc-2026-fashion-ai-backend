"use client";
/**
 * Laboratório da cena de jogo (FLAIR 3D): a cena 3D de verdade de um jogo, sem partida, com a modelo da casa na
 * preparação e o andar livre ligado, para conferir no navegador o andar (WASD), o clipe de caminhar, a área de andar
 * e a câmera que segue. `?jogo=DRESS_FIGHTER` escolhe o jogo; `?agilidade=N` a agilidade do look; nos jogos de zonas,
 * `?zonas=FRENTE:C8283A,MANGAS:F5F4F0` veste a peça pintada.
 */
import { useEffect, useState } from "react";
import NucleoScene3D from "@/components/flair/nucleos/nucleo-scene-3d";
import { MODELO_CASA } from "@/components/flair/nucleos/nucleo-avatar";
import { useEixoDeAndar } from "@/components/flair/nucleos/use-eixo-de-andar";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { pecasDasZonas } from "@/lib/flair/nucleos/pecas-pintadas";
import type { NucleoCodigo, ZonaEscolha } from "@/lib/flair/nucleos/types";

const AVATAR = { giro: 0, zoom: 0, poses: 0, desfilando: false };

export default function JogoLab() {
  const [jogo, setJogo] = useState<{ codigo: NucleoCodigo; agilidade: number; zonas: Record<string, ZonaEscolha> } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const zonas = Object.fromEntries((q.get("zonas") ?? "").split(",").filter(Boolean).map((z) => [z.split(":")[0], { cor: `#${z.split(":")[1]}` }]));
    setJogo({ codigo: (q.get("jogo") ?? "DRESS_FIGHTER") as NucleoCodigo, agilidade: Number(q.get("agilidade") ?? 50), zonas });
  }, []);
  useEixoDeAndar(!!jogo);
  if (!jogo) return null;
  const config = NUCLEOS[jogo.codigo];
  return (
    <main className="p-4">
      <h1 className="type-h3 mb-2">Laboratório de jogo · {jogo.codigo}</h1>
      <div data-jogo-lab style={{ width: 1100, height: 680, background: "#15161a", position: "relative" }}>
        <NucleoScene3D config={config} avatar={AVATAR} pecas={pecasDasZonas(jogo.codigo, jogo.zonas)} reduzido={false} desfile={false} rotulo={jogo.codigo} protagonista={MODELO_CASA}
          semente={7} momento="PREPARO" andarLivre agilidade={jogo.agilidade} />
      </div>
    </main>
  );
}

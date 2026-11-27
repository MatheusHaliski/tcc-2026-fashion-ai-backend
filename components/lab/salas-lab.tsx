"use client";
/**
 * Laboratório das salas (FLAIR 3D): desenha a sala de um jogo sem partida nem avatar, para conferir os objetos GLB
 * gerados pelo motor Blender (scripts/blender3d) no lugar dos móveis procedurais — escala, apoio no piso e para onde
 * cada um fica virado. `?jogo=PERSONAGEM_FILME` escolhe a sala; `?olho=x,y,z` e `?alvo=x,y,z` fixam a câmera;
 * `?glb=0` mostra a sala só com os móveis procedurais, para comparar; `?variante=` escolhe a variante da sala;
 * `?gente=N` põe os figurantes (N de corpo inteiro, os outros no corpo humano leve).
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Humanoides } from "@/components/flair/nucleos/gente/humanoides-3d";
import { FigurantesHumanos } from "@/components/flair/nucleos/gente/figurantes-humanos";
import { Sala3D } from "@/components/flair/nucleos/scene/room";
import { CenaContexto } from "@/components/flair/nucleos/scene/stage-context";
import { HUMANOIDES, poseHumana } from "@/lib/flair/nucleos/gente/humanoides";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { figurantesDaCena } from "@/lib/flair/nucleos/scene/budget";
import { Diretor } from "@/lib/flair/nucleos/scene/director";
import { salaDe } from "@/lib/flair/nucleos/scene/registry";
import type { PessoaDoElenco } from "@/lib/flair/nucleos/gente/elenco";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

type V3 = [number, number, number];
const tripla = (texto: string | null, padrao: V3): V3 => {
  const n = (texto ?? "").split(",").map(Number);
  return n.length === 3 && n.every(Number.isFinite) ? (n as V3) : padrao;
};

/** `?humanoides=1`: todos os humanoides do catálogo lado a lado (conversando e andando, alternados), para conferir cada modelo. */
function Catalogo() {
  const reais = useMemo(() => new Humanoides(), []);
  useFrame(({ clock }) => {
    HUMANOIDES.forEach((h, i) => {
      const pessoa = { chave: h.slug, sexo: h.sexo, estatura: 1.7 } as PessoaDoElenco;
      const x = (i - (HUMANOIDES.length - 1) / 2) * 0.9;
      const parado = { bracos: 0, inclina: 0, pulo: 0, sentada: false };
      reais.posar(h.slug, pessoa, { x, y: 0, z: 0, giro: 0 }, poseHumana(i % 2 ? "walk" : "talk", i % 2, parado, i % 2 ? 0.2 + i : clock.elapsedTime, i), h);
    });
  });
  return <primitive object={reais.grupo} />;
}

export default function SalasLab() {
  const [cena, setCena] = useState<{ jogo: NucleoCodigo; olho: V3; alvo: V3; semObjetos: boolean; variante: string | null; gente: number | null; catalogo: boolean } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setCena({ jogo: (q.get("jogo") ?? "PERSONAGEM_FILME") as NucleoCodigo, olho: tripla(q.get("olho"), [0, 2.4, 7.5]), alvo: tripla(q.get("alvo"), [0, 1, 0]), semObjetos: q.get("glb") === "0", variante: q.get("variante"), gente: q.has("gente") ? Number(q.get("gente")) : null, catalogo: q.has("humanoides") });
  }, []);
  // a sala lê o diretor das sequências a cada quadro: aqui, um diretor parado (nenhuma sequência tocando)
  const contexto = useMemo(() => (cena ? { codigo: cena.jogo, diretor: new Diretor(), reduzido: true } : null), [cena]);
  const prontos = useRef(new Set<string>());
  if (!cena || !contexto) return null;
  const sala = salaDe(cena.jogo, cena.variante);
  // `?gente=N`: os figurantes da sala, N deles de corpo inteiro e os outros no corpo humano leve
  const figurantes = sala && cena.gente != null ? figurantesDaCena(sala, NUCLEOS[cena.jogo]?.personagens ?? []) : [];
  const inteiros = cena.gente ?? 0;
  return (
    <main className="p-4">
      <h1 className="type-h3 mb-2">Laboratório de salas · {cena.jogo}</h1>
      <div data-sala-lab style={{ width: 1100, height: 680, background: "#15161a" }}>
        <Canvas shadows camera={{ position: cena.olho, fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
          <ambientLight intensity={0.6} />
          <CenaContexto.Provider value={contexto}>
            <Suspense fallback={null}>{sala && <Sala3D sala={sala} placar={null} semObjetos={cena.semObjetos} />}</Suspense>
            {cena.catalogo && <Catalogo />}
            {figurantes.length > 0 && <FigurantesHumanos codigo={cena.jogo} personagens={figurantes} prontos={prontos} reduzido limite={() => inteiros} />}
          </CenaContexto.Provider>
          <OrbitControls target={cena.alvo} />
        </Canvas>
      </div>
    </main>
  );
}

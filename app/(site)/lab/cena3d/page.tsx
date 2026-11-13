"use client";
// TEMPORÁRIO (verificação visual das salas): removido antes de entregar.
import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { MODELO_CASA } from "@/components/flair/nucleos/nucleo-avatar";
import { boardInicial } from "@/lib/flair/nucleos/board";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

const Cena = dynamic(() => import("@/components/flair/nucleos/nucleo-scene-3d"), { ssr: false });

function Lab() {
  const q = useSearchParams();
  const codigo = (q.get("n") ?? "PASSARELA") as NucleoCodigo;
  const [avatar, setAvatar] = useState({ ...boardInicial().avatar, zoom: Number(q.get("zoom") ?? 0), giro: Number(q.get("giro") ?? 0) });
  const [resultado, setResultado] = useState<NucleoResultado | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.get("pose")) setAvatar((a) => ({ ...a, poses: Number(q.get("pose")) }));
      if (q.get("desfile")) setAvatar((a) => ({ ...a, desfilando: true }));
      if (q.get("res")) setResultado(JSON.parse(q.get("res")!) as NucleoResultado);
    }, Number(q.get("wait") ?? 2500));
    return () => clearTimeout(t);
  }, [q]);
  const w = Number(q.get("w") ?? 1280);
  const h = Number(q.get("h") ?? 496);
  return (
    <div style={{ width: w, height: h, position: "fixed", left: 0, top: 0, zIndex: 9999, background: "#000" }}>
      <Cena config={NUCLEOS[codigo]} avatar={avatar} pecas={[]} reduzido={q.get("red") === "1"} desfile rotulo="lab" protagonista={MODELO_CASA} resultado={resultado} />
    </div>
  );
}

export default function Page() {
  return <Suspense><Lab /></Suspense>;
}

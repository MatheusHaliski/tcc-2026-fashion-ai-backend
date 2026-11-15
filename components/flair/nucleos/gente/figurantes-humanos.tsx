"use client";
/**
 * Os figurantes das salas como gente (lib/flair/nucleos/gente/figurantes.ts): plateia sentada, fotógrafos, torcida,
 * adversário, cliente e convidados com o corpo humano do avatar, vestidos pelo papel e animados pela locomoção do avatar,
 * com os níveis de detalhe de elenco-3d.tsx, e seguindo as sequências do diretor de cena (aplaudem pela nota, a cliente
 * prova, o oponente dá a guarda: lib/flair/nucleos/gente/reacoes.ts). Enquanto o corpo de cada um monta, a silhueta
 * antiga fica no lugar.
 */
import { useCallback, useContext, useMemo, useRef } from "react";
import { Elenco3D } from "@/components/flair/nucleos/gente/elenco-3d";
import { sementeDoTexto } from "@/lib/flair/nucleos/gente/elenco";
import { atoresDosFigurantes, pessoasDosFigurantes } from "@/lib/flair/nucleos/gente/figurantes";
import { atorNoMomento } from "@/lib/flair/nucleos/gente/reacoes";
import { agora, CenaContexto } from "@/components/flair/nucleos/scene/stage-context";
import type { NucleoPersonagem } from "@/lib/flair/nucleos/types";

interface Props {
  codigo: string;
  personagens: NucleoPersonagem[];
  prontos: React.MutableRefObject<Set<string>>;
  reduzido: boolean;
}

export function FigurantesHumanos({ codigo, personagens, prontos, reduzido }: Props) {
  const pessoas = useMemo(() => pessoasDosFigurantes(sementeDoTexto(codigo), personagens, codigo === "FASHION_SPORTS"), [codigo, personagens]);
  const atores = useMemo(() => atoresDosFigurantes(personagens), [personagens]);
  const cena = useContext(CenaContexto);
  const antes = useRef(new Map<string, { x: number; z: number; t: number }>());
  // a cada quadro: o clipe que a sequência do momento dá a cada um e o lugar para onde o diretor o levou
  const noMomento = useCallback(() => {
    if (!cena) return atores;
    const t = agora();
    return atores.map((a) => {
      const lugar = cena.diretor.lugar(a.id, t, { x: a.x, z: a.z, giro: (a.giro * 180) / Math.PI });
      const clip = cena.diretor.clipeDoAtor(a.id, t);
      const ultimo = antes.current.get(a.id);
      const velocidade = ultimo && t > ultimo.t ? Math.hypot(lugar.x - ultimo.x, lugar.z - ultimo.z) / (t - ultimo.t) : 0;
      antes.current.set(a.id, { x: lugar.x, z: lugar.z, t });
      return atorNoMomento(a, { clip: clip?.clip ?? null, desde: clip?.desde ?? t, x: lugar.x, z: lugar.z, giro: lugar.giro, velocidade });
    });
  }, [atores, cena]);
  if (pessoas.size === 0) return null;
  return <Elenco3D pessoas={pessoas} atores={noMomento} prontos={prontos} reduzido={reduzido} />;
}

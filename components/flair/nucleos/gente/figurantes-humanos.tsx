"use client";
/**
 * Os figurantes das salas como gente (lib/flair/nucleos/gente/figurantes.ts): plateia sentada, fotógrafos, torcida,
 * adversário, cliente e convidados com o corpo humano do avatar, vestidos pelo papel e animados pela locomoção do avatar,
 * com os níveis de detalhe de elenco-3d.tsx. Enquanto o corpo de cada um monta, a silhueta antiga fica no lugar.
 */
import { useMemo } from "react";
import { Elenco3D } from "@/components/flair/nucleos/gente/elenco-3d";
import { sementeDoTexto } from "@/lib/flair/nucleos/gente/elenco";
import { atoresDosFigurantes, pessoasDosFigurantes } from "@/lib/flair/nucleos/gente/figurantes";
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
  if (pessoas.size === 0) return null;
  return <Elenco3D pessoas={pessoas} atores={() => atores} prontos={prontos} reduzido={reduzido} />;
}

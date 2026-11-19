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
import { variacaoDoAtor } from "@/lib/flair/nucleos/gente/variacao";
import { CORPOS_CHEIOS } from "@/lib/flair/nucleos/gente/detalhe";
import { agora, CenaContexto } from "@/components/flair/nucleos/scene/stage-context";
import type { NucleoPersonagem } from "@/lib/flair/nucleos/types";

interface Props {
  codigo: string;
  /** semente da partida: outra partida, outras pessoas na plateia (sem partida, a do jogo) */
  semente?: number;
  personagens: NucleoPersonagem[];
  prontos: React.MutableRefObject<Set<string>>;
  reduzido: boolean;
  /** quantos corpos inteiros a cena aguenta agora (o orçamento da cena, que cai com a qualidade); sem ele, CORPOS_CHEIOS */
  limite?: () => number;
}

export function FigurantesHumanos({ codigo, semente, personagens, prontos, reduzido, limite }: Props) {
  const raiz = semente ?? sementeDoTexto(codigo);
  const pessoas = useMemo(() => pessoasDosFigurantes(raiz, personagens, codigo === "FASHION_SPORTS"), [codigo, raiz, personagens]);
  // cada pessoa reage no próprio instante, com a própria força: a plateia não se mexe como um bloco
  const variacoes = useMemo(() => new Map(atoresDosFigurantes(personagens).map((a) => [a.id, variacaoDoAtor(a.id, raiz)])), [personagens, raiz]);
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
      return atorNoMomento(a, { clip: clip?.clip ?? null, desde: clip?.desde ?? t, x: lugar.x, z: lugar.z, giro: lugar.giro, velocidade, agora: t, grupo: clip?.grupo, variacao: variacoes.get(a.id) });
    });
  }, [atores, cena, variacoes]);
  if (pessoas.size === 0) return null;
  return <Elenco3D pessoas={pessoas} atores={noMomento} prontos={prontos} reduzido={reduzido} limite={limite ?? CORPOS_CHEIOS} />;
}

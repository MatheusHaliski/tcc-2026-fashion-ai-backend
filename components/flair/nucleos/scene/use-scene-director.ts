/**
 * Diretor da cena de um jogo: transforma o que a tela manda (posar, desfilar ou caminhar, o resultado da entrega) em
 * sequências, e toca a abertura de cada salão nos jogos que têm uma. Com "reduzir movimento", cada sequência vira um quadro parado (lib/flair/nucleos/scene/director.ts).
 */
import { useEffect, useMemo, useRef } from "react";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";
import { Diretor } from "@/lib/flair/nucleos/scene/director";
import { sequenciaDeAbertura } from "@/lib/flair/nucleos/scene/opening";
import { sequenciaDoResultado } from "@/lib/flair/nucleos/scene/sequences-auto";
import { sequenciaDaPose, sequenciaDeIda, sequenciaDeVolta } from "@/lib/flair/nucleos/scene/sequences-manual";
import { agora, type Cena } from "@/components/flair/nucleos/scene/stage-context";

interface Entrada {
  codigo: NucleoCodigo;
  avatar: AvatarEstado;
  resultado?: NucleoResultado | null;
  reduzido: boolean;
  /** o salão da vez nos jogos com abertura animada: cada troca toca a abertura */
  abertura?: string | null;
}

export function useSceneDirector({ codigo, avatar, resultado, reduzido, abertura }: Entrada): Cena {
  const diretor = useMemo(() => new Diretor(), [codigo]); // eslint-disable-line react-hooks/exhaustive-deps
  const visto = useRef({ poses: avatar.poses, desfilando: avatar.desfilando, resultado: null as NucleoResultado | null });

  // posar: a pose da vez do jogo
  useEffect(() => {
    if (avatar.poses === visto.current.poses) return;
    visto.current.poses = avatar.poses;
    diretor.tocar(sequenciaDaPose(codigo, avatar.poses), agora(), reduzido);
  }, [avatar.poses, codigo, diretor, reduzido]);

  // desfilar ou caminhar: ida ao ligar, volta ao desligar
  useEffect(() => {
    if (avatar.desfilando === visto.current.desfilando) return;
    visto.current.desfilando = avatar.desfilando;
    const seq = avatar.desfilando ? sequenciaDeIda(codigo) : sequenciaDeVolta(codigo);
    if (seq) diretor.tocar(seq, agora(), reduzido);
  }, [avatar.desfilando, codigo, diretor, reduzido]);

  // resultado da entrega: a sequência automática do jogo; sem resultado (nova partida), tudo volta ao lugar
  useEffect(() => {
    const atual = resultado ?? null;
    if (atual === visto.current.resultado) return;
    visto.current.resultado = atual;
    if (!atual) {
      diretor.limpar();
      return;
    }
    diretor.tocar(sequenciaDoResultado(codigo, atual), agora(), reduzido);
  }, [resultado, codigo, diretor, reduzido]);

  // abertura do salão: depois do efeito do resultado, que devolve os atores ao lugar quando o salão anterior acaba
  useEffect(() => {
    const seq = abertura ? sequenciaDeAbertura(codigo) : null;
    if (seq) diretor.tocar(seq, agora(), reduzido);
  }, [abertura, codigo, diretor, reduzido]);

  return useMemo(() => ({ codigo, diretor, reduzido }), [codigo, diretor, reduzido]);
}

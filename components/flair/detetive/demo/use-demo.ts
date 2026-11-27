"use client";
/**
 * O controle da demonstração jogável: guarda a simulação (lib/flair/detetive/demo) num ref que a cena 3D avança a cada
 * quadro, e o que a tela mostra por cima (roda X, ajuda ?, pausa Esc, mira A, aviso curto, flash de dano). As teclas e o
 * controle chegam pelo perfil console (use-controle-console.ts). A roda aberta desacelera a cena; a pausa, a ajuda e o
 * fim a param.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { useAvisoCurto } from "@/components/flair/nucleos/console/use-aviso-curto";
import { useControleConsole } from "@/components/flair/nucleos/console/use-controle-console";
import type { TelaCheia } from "@/components/flair/nucleos/console/use-tela-cheia";
import { ORDEM_DA_RODA, usarKit } from "@/lib/flair/detetive/demo/armas";
import { avisoDoEvento } from "@/lib/flair/detetive/demo/avisos";
import { estadoInicial } from "@/lib/flair/detetive/demo/mundo";
import { clonar } from "@/lib/flair/detetive/demo/passo";
import type { EstadoDaDemo, EventoDaDemo } from "@/lib/flair/detetive/demo/tipos";
import { definirMira } from "@/lib/flair/nucleos/controle/estado-do-console";
import type { AcaoConsole } from "@/lib/flair/nucleos/controle/perfil-console";

/** A roda aberta deixa a cena a 15% da velocidade (desacelera sem congelar). */
export const CENA_LENTA = 0.15;

export interface Simulacao {
  estado: EstadoDaDemo;
  fila: { disparar?: boolean; interagir?: boolean; recarregar?: boolean };
  escala: number;
  /** segundos de tremor da câmera que faltam */
  tremor: number;
}

export function useDemo(telaCheia: TelaCheia) {
  const { t } = useI18n();
  const sim = useRef<Simulacao>({ estado: estadoInicial(), fila: {}, escala: 1, tremor: 0 });
  const [quadro, setQuadro] = useState<EstadoDaDemo>(sim.current.estado);
  const [roda, setRoda] = useState<{ aberta: boolean; foco: number }>({ aberta: false, foco: 0 });
  const [ajuda, setAjuda] = useState(false);
  const [pausa, setPausa] = useState(false);
  const [mirando, setMirando] = useState(false);
  const [flash, setFlash] = useState(0);
  const [aviso, avisar] = useAvisoCurto();
  const fim = quadro.fim;
  const parada = pausa || ajuda || !!fim;
  useEffect(() => {
    sim.current.escala = parada ? 0 : roda.aberta ? CENA_LENTA : 1;
  }, [parada, roda.aberta]);

  const onEventos = useCallback((eventos: EventoDaDemo[]) => {
    for (const ev of eventos) {
      if (ev.tipo === "DANO_NO_JOGADOR") {
        setFlash((f) => f + 1);
        sim.current.tremor = 0.35;
      }
      const a = avisoDoEvento(ev);
      if (a) avisar(t(`flair3d.demo.aviso.${a.chave}`), a.tom);
    }
  }, [avisar, t]);

  /** P, soltar X ou clicar: equipa a arma em foco (o kit cura na hora e não fica na mão). */
  const escolher = useCallback((i: number) => {
    const arma = ORDEM_DA_RODA[i];
    const e = clonar(sim.current.estado);
    const eventos: EventoDaDemo[] = [];
    if (arma === "KIT") {
      if (!usarKit(e, eventos)) avisar(t(e.jogador.municao.kits === 0 ? "flair3d.demo.aviso.semKit" : "flair3d.demo.aviso.vidaCheia"), "alerta");
    } else {
      e.jogador.arma = arma;
    }
    sim.current.estado = e;
    setQuadro(e);
    onEventos(eventos);
    setRoda({ aberta: false, foco: i });
  }, [avisar, onEventos, t]);

  const reiniciar = useCallback(() => {
    sim.current = { estado: estadoInicial(), fila: {}, escala: 1, tremor: 0 };
    setQuadro(sim.current.estado);
    setPausa(false);
    setRoda({ aberta: false, foco: 0 });
  }, []);

  const onAcao = (a: AcaoConsole, fase: "desce" | "sobe") => {
    if (a === "MIRAR") {
      const mira = fase === "desce";
      definirMira(mira);
      return setMirando(mira);
    }
    if (a === "RODA") {
      if (fase === "desce" && !parada) return setRoda({ aberta: true, foco: Math.max(0, ORDEM_DA_RODA.indexOf(sim.current.estado.jogador.arma)) });
      if (fase === "sobe" && roda.aberta) escolher(roda.foco);
      return;
    }
    if (fase === "sobe") return;
    if (a === "PAUSA") {
      if (roda.aberta) return setRoda((r) => ({ ...r, aberta: false }));
      if (ajuda) return setAjuda(false);
      return setPausa((p) => !p && !fim);
    }
    if (a === "AJUDA") return setAjuda((x) => !x);
    if (a === "TELA_CHEIA") return telaCheia.alternar();
    if (a === "PEGAR" && roda.aberta) return escolher(roda.foco);
    if (parada || roda.aberta) return;
    if (a === "DISPARAR") sim.current.fila.disparar = true;
    if (a === "INTERAGIR") sim.current.fila.interagir = true;
    if (a === "RECARREGAR") sim.current.fila.recarregar = true;
  };
  useControleConsole({ ativo: true, onAcao });
  useEffect(() => () => definirMira(false), []);

  return {
    sim, quadro, setQuadro, onEventos, roda, setRoda, escolher, ajuda, setAjuda, pausa, setPausa, mirando, setMirando, flash, aviso, reiniciar, parada,
    /** botões na tela (toque): as mesmas ações das teclas */
    tocar: (a: AcaoConsole) => onAcao(a, "desce"),
    alternarMira: () => onAcao("MIRAR", mirando ? "sobe" : "desce"),
  };
}

export type Demo = ReturnType<typeof useDemo>;

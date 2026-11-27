"use client";
/**
 * O Fashion Detective no perfil console (lib/flair/detetive/console.ts): setas andam (Shift corre), E usa o que está
 * perto, A mira com o recurso equipado e F o usa no alvo travado, X abre a roda (P ou soltar X equipa), C e I abrem os
 * painéis, Esc fecha o que estiver aberto, ? mostra a ajuda e T a tela cheia. Na planta 2D a seta vai ao vizinho
 * daquele lado. Toda ação vai pelo mesmo `onAcao(alvo, carta)` de sempre: o servidor confere e recusa o que não vale.
 */
import { useEffect, useRef, useState } from "react";
import { useControleConsole } from "@/components/flair/nucleos/console/use-controle-console";
import type { PaineisLaterais } from "@/components/flair/nucleos/console/use-paineis-laterais";
import type { TelaCheia } from "@/components/flair/nucleos/console/use-tela-cheia";
import type { AcaoDeCor } from "@/lib/flair/detetive/acoes";
import { alvoDaMira, ARSENAL, cartaPara, interacoesDaSala, maisProxima, vizinhoNaDirecao, type CartaComAcao, type Interacao } from "@/lib/flair/detetive/console";
import type { Retrato } from "@/lib/flair/detetive/types";
import { definirMira, estadoDoConsole } from "@/lib/flair/nucleos/controle/estado-do-console";
import type { AcaoConsole } from "@/lib/flair/nucleos/controle/perfil-console";
import { vetorDasSetas } from "@/lib/flair/nucleos/controle/perfil-console";

interface Opcoes {
  r: Retrato;
  mao: CartaComAcao[];
  ocupado: boolean;
  /** o jogo aceita comando agora (sem cutscene nem final) */
  ativo: boolean;
  /** a planta 2D no lugar da cena 3D */
  planta: boolean;
  paineis: PaineisLaterais;
  telaCheia: TelaCheia;
  onAcao: (alvo: string, cardId?: string) => void;
  /** a ação pede uma cor que a mão não tem */
  onSemCarta: (cor: string) => void;
}

export function useDetetiveConsole({ r, mao, ocupado, ativo, planta, paineis, telaCheia, onAcao, onSemCarta }: Opcoes) {
  const [roda, setRoda] = useState({ aberta: false, foco: 0 });
  const [equipada, setEquipada] = useState<AcaoDeCor | null>(null);
  const [mirando, setMirando] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [perto, setPerto] = useState<Interacao | null>(null);
  const [alvo, setAlvo] = useState<Interacao | null>(null);
  const atual = useRef({ perto, alvo });
  atual.current = { perto, alvo };
  // onde a detetive está (a cena escreve; na planta, o ponto): o que E alcança e o que a mira trava
  useEffect(() => {
    const ler = () => {
      const aqui = r.layout.pontos.find((p) => p.id === r.ponto);
      const pos = (!planta && estadoDoConsole().posicao) || aqui || { x: 0, z: 0 };
      const p = ativo ? maisProxima(interacoesDaSala(r), pos) : null;
      const a = ativo && mirando ? alvoDaMira(r, pos, equipada) : null;
      if (p?.acao.alvo !== atual.current.perto?.acao.alvo) setPerto(p);
      if (a?.acao.alvo !== atual.current.alvo?.acao.alvo) setAlvo(a);
    };
    ler();
    const t = setInterval(ler, 150);
    return () => clearInterval(t);
  }, [r, planta, ativo, mirando, equipada]);
  useEffect(() => () => definirMira(false), []);

  const usar = (i: Interacao | null, cor: AcaoDeCor | null = null) => {
    if (!i || ocupado) return;
    const pede = i.acao.cor;
    if (!pede) return onAcao(i.acao.alvo);
    const carta = cartaPara(cor ?? pede, mao);
    if (!carta) return onSemCarta(String(pede));
    onAcao(i.acao.alvo, carta);
  };
  const equipar = (i: number) => {
    setEquipada(ARSENAL[i]);
    setRoda({ aberta: false, foco: i });
  };
  const onTecla = (a: AcaoConsole, fase: "desce" | "sobe") => {
    if (a === "MIRAR") {
      const m = fase === "desce" && ativo;
      definirMira(m);
      return setMirando(m);
    }
    if (a === "RODA") {
      if (fase === "desce" && ativo) return setRoda({ aberta: true, foco: Math.max(0, equipada ? ARSENAL.indexOf(equipada) : 0) });
      if (fase === "sobe" && roda.aberta) equipar(roda.foco);
      return;
    }
    if (fase === "sobe") return;
    if (a === "PAUSA") {
      if (roda.aberta) return setRoda((x) => ({ ...x, aberta: false }));
      if (ajuda) return setAjuda(false);
      return void paineis.fecharUm();
    }
    if (a === "AJUDA") return setAjuda((x) => !x);
    if (a === "TELA_CHEIA") return telaCheia.alternar();
    if (a === "PAINEL_ESQUERDO") return paineis.alternar("esquerda");
    if (a === "PAINEL_DIREITO") return paineis.alternar("direita");
    if (a === "PEGAR" && roda.aberta) return equipar(roda.foco);
    if (!ativo || roda.aberta) return;
    if (a === "INTERAGIR") return usar(atual.current.perto);
    if (a === "DISPARAR" && mirando) return usar(atual.current.alvo, equipada);
  };
  useControleConsole({ ativo: true, onAcao: onTecla });
  // na planta 2D, cada seta apertada leva ao vizinho daquele lado
  useEffect(() => {
    if (!planta || !ativo || typeof window === "undefined") return;
    const desce = (e: KeyboardEvent) => {
      const v = vetorDasSetas([e.code]);
      const destino = vizinhoNaDirecao(r, v);
      if (destino && !ocupado) onAcao(`IR:${destino}`);
    };
    window.addEventListener("keydown", desce);
    return () => window.removeEventListener("keydown", desce);
  }, [planta, ativo, r, ocupado, onAcao]);

  return {
    roda, setRoda, equipar, equipada, mirando, perto, alvo, ajuda, setAjuda,
    usarPerto: () => usar(atual.current.perto),
    usarAlvo: () => usar(atual.current.alvo, equipada),
    tocar: (a: AcaoConsole) => onTecla(a, a === "MIRAR" && mirando ? "sobe" : "desce"),
  };
}

export type DetetiveConsole = ReturnType<typeof useDetetiveConsole>;

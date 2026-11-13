"use client";
/**
 * Tela de jogo de um núcleo (docs/flair/flair-3d/DESENHO_DA_TELA.md, seções 1 e 4): o quadro com o palco 3D em cima
 * (56% no celular em pé, 62% no quadro deitado), a régua de vagas e a faixa do deck embaixo. A tela conhece o momento
 * da partida (preparação, ação, resultado) e só aceita o que vale em cada um. Teclado, toque e gamepad passam pelo
 * mesmo comando (use-nucleo-controls) e pela mesma redução de estado (lib/flair/nucleos/board.ts). Os efeitos das
 * cartas mostram só o que o servidor calculou e saem também por lib/flair/nucleos/fx-events.ts, para a cena.
 */
import { useEffect, useMemo, useReducer, useState } from "react";
import type { ApiError } from "@/lib/api/client";
import { useMirrorAvatar } from "@/components/mirror/mirror-stage";
import { useReducedMotion } from "@/components/three/common";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { NucleoActionPanel } from "@/components/flair/nucleos/nucleo-action-panel";
import { MODELO_CASA, type Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { NucleoCardZoom } from "@/components/flair/nucleos/nucleo-card-zoom";
import { NucleoHelp } from "@/components/flair/nucleos/nucleo-controls";
import { NucleoDeckBand } from "@/components/flair/nucleos/nucleo-deck-band";
import { NucleoObjectiveDetails } from "@/components/flair/nucleos/nucleo-objective";
import { NucleoResult, type CartaNoResultado } from "@/components/flair/nucleos/nucleo-result";
import { NucleoSlotRuler, type BrilhoDaVaga } from "@/components/flair/nucleos/nucleo-slot-ruler";
import { NucleoStage } from "@/components/flair/nucleos/nucleo-stage";
import { NucleoTrigger, type AcionamentoPedido } from "@/components/flair/nucleos/nucleo-trigger";
import { useCardFx } from "@/components/flair/nucleos/use-card-fx";
import { useCardZoom } from "@/components/flair/nucleos/use-card-zoom";
import { useFxPrefs } from "@/components/flair/nucleos/use-fx-prefs";
import { useNucleoAction } from "@/components/flair/nucleos/use-nucleo-action";
import { useNucleoControls } from "@/components/flair/nucleos/use-nucleo-controls";
import { useNucleoEffects } from "@/components/flair/nucleos/use-nucleo-effects";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { useNucleoViewport } from "@/components/flair/nucleos/use-nucleo-viewport";
import { cartasQuePontuaram } from "@/lib/flair/nucleos/action-fx";
import { protagonistaEfetiva } from "@/lib/flair/nucleos/avatares";
import { boardInicial, boardReducer } from "@/lib/flair/nucleos/board";
import type { Comando } from "@/lib/flair/nucleos/controls";
import { vagasDaRegua, type ItemDaFileira } from "@/lib/flair/nucleos/deck-row";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { pecasDoLook } from "@/lib/flair/nucleos/look";
import { acionamentoDe, comandoPermitido, type Momento } from "@/lib/flair/nucleos/moments";
import { classesDoQuadro, estiloDoQuadro } from "@/lib/flair/nucleos/quadro";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { buildTabs, temEscolha, type Selecao } from "@/lib/flair/nucleos/selection";
import type { AvatarTipo, NucleoDefinicao, NucleoResultado } from "@/lib/flair/nucleos/types";

interface Props {
  definicao: NucleoDefinicao;
  cartas: FlairCollectionCard[];
  entregando: boolean;
  erro: ApiError | null;
  onEntregar: (sel: Selecao, avatar: AvatarTipo) => void;
  /** momento da partida (a tela de jogo cobre preparação, ação e resultado) */
  momento?: Momento;
  /** resposta do servidor à entrega */
  resultado?: NucleoResultado | null;
  onFimAcao?: () => void;
  onAgain?: () => void;
  /** só existe quando o servidor aceita o acionamento durante a ação */
  onAcionar?: (pedido: AcionamentoPedido) => void;
}

const SEM_FIM = () => undefined;

export function NucleoGame({ definicao, cartas, entregando, erro, onEntregar, momento = "PREPARACAO", resultado = null, onFimAcao, onAgain, onAcionar }: Props) {
  const tx = useNucleoText();
  const codigo = definicao.codigo;
  const config = NUCLEOS[codigo];
  const layout = useNucleoViewport();
  const reduzido = useReducedMotion();
  const fx = useFxPrefs();
  const tabs = useMemo(() => buildTabs(definicao, cartas), [definicao, cartas]);
  const [estado, dispatch] = useReducer(boardReducer, undefined, () => boardInicial());
  const [aviso, setAviso] = useState<string | null>(null);
  const perfil = useMirrorAvatar();
  const [escolha, setEscolha] = useState<AvatarTipo | null>(null);
  const efetiva = protagonistaEfetiva(config.avatares.protagonista, escolha, !!perfil.avatar);
  const protagonista: Protagonista = efetiva === "PROPRIO" ? { avatar: perfil.avatar, sexo: perfil.sex, corpo: perfil.body } : MODELO_CASA;
  const pecas = useMemo(() => pecasDoLook(estado.sel.cartas, cartas), [estado.sel.cartas, cartas]);
  const efeitos = useNucleoEffects(codigo, cartas, definicao.recursos.includes("CARTAS"));
  const preparando = momento === "PREPARACAO";
  const acionamento = acionamentoDe(codigo);
  const faltaResposta = acionamento?.tipo === "RESPOSTA" && !estado.sel.resposta;
  const pronto = temEscolha(estado.sel) && !faltaResposta;
  const emFoco = tabs[estado.aba]?.items[estado.item];
  const zoom = useCardZoom(emFoco?.kind === "carta" ? emFoco.card : null, preparando);
  const entrada = useCardFx({ nucleo: codigo, vestidas: estado.sel.cartas, cards: cartas, itens: efeitos.itens, ativo: preparando, reduzido, prefs: fx.prefs });
  const acao = useNucleoAction({ nucleo: codigo, momento, resultado, automatico: !!config.automatico, reduzido, prefs: fx.prefs, podeAcionar: !!onAcionar, onFim: onFimAcao ?? SEM_FIM });

  useEffect(() => {
    if (estado.sel.resposta && acionamento?.tipo === "RESPOSTA") emitirFx({ tipo: "acionamento", nucleo: codigo, acionamento: "RESPOSTA" });
  }, [estado.sel.resposta, acionamento?.tipo, codigo]);

  const entregar = () => {
    if (!preparando || !pronto || entregando) return;
    if (acionamento?.tipo === "ESPELHO") emitirFx({ tipo: "acionamento", nucleo: codigo, acionamento: "ESPELHO" });
    onEntregar(estado.sel, efetiva);
  };
  const onComando = (c: Comando) => {
    if (!comandoPermitido(momento, c.acao)) return;
    setAviso(null);
    if (c.acao === "ENTREGAR") entregar();
    else dispatch({ type: "comando", comando: c, tabs });
  };
  const { disparar, gamepad } = useNucleoControls({ acoes: definicao.acoes, onComando, ativo: !entregando && !zoom.ampliada });

  const naoCabe = (x: ItemDaFileira) => {
    dispatch({ type: "foco", aba: x.aba, item: x.item });
    const vaga = tabs.find((t) => t.id === estado.vaga);
    setAviso(tx.t("flair3d.ui.card.noFit", { pos: tx.aba(x.tab), vaga: vaga ? tx.aba(vaga) : "" }));
  };
  const acionar = (pedido: AcionamentoPedido) => {
    emitirFx({ tipo: "acionamento", nucleo: codigo, acionamento: pedido.tipo, cardId: pedido.cardId });
    acao.marcarUsado();
    onAcionar?.(pedido);
  };

  const pontuadas = useMemo(
    () => (momento === "RESULTADO" && resultado ? cartasQuePontuaram(resultado, estado.sel.cartas, cartas, efeitos.porCarta) : []),
    [momento, resultado, estado.sel.cartas, cartas, efeitos.porCarta],
  );
  const textoDaCarta = (p: (typeof pontuadas)[number]) => (p.pontos != null ? tx.t("flair3d.ui.points", { n: p.pontos }) : p.selo ? tx.efeito(p.selo) : "");
  const brilho: Record<string, BrilhoDaVaga> = {};
  pontuadas.forEach((p, ordem) => (brilho[p.vaga] = { ordem, texto: textoDaCarta(p) }));
  const noResultado: CartaNoResultado[] = pontuadas.map((p) => ({ cardId: p.cardId, nome: cartas.find((c) => c.id === p.cardId)?.name ?? "", texto: textoDaCarta(p) }));

  return (
    <div className={classesDoQuadro(layout)} style={estiloDoQuadro(layout)} data-testid="nucleo-game" data-momento={momento} data-porte={layout.porte} data-quadro={layout.quadro} data-reduced={reduzido || undefined} data-fx={fx.prefs.efeitos ? "on" : "off"}>
      <p className="sr-only" role="status" data-testid="nucleo-moment">{tx.t("flair3d.ui.moment.label", { momento: tx.t(`flair3d.ui.moment.${momento}`) })}</p>
      <NucleoStage
        definicao={definicao}
        config={config}
        momento={momento}
        avatar={estado.avatar}
        pecas={pecas}
        protagonista={protagonista}
        efetiva={efetiva}
        temAvatar={!!perfil.avatar}
        onEscolha={setEscolha}
        objetivoAberto={estado.objetivo}
        resultado={resultado}
        prefs={fx.prefs}
        onPref={fx.alternar}
        entrada={entrada}
        reduzido={reduzido}
        passos={acao.passos}
        mostrados={acao.mostrados}
        gamepad={gamepad}
        onComando={(c) => disparar(c)}
      />
      <div className="n3d-lower">
        <NucleoSlotRuler
          vagas={vagasDaRegua(tabs)}
          vestidas={estado.sel.cartas}
          cards={cartas}
          vaga={estado.vaga}
          bloqueada={!preparando}
          brilho={brilho}
          onVaga={(id) => {
            setAviso(null);
            dispatch({ type: "vaga", id, tabs });
          }}
        />
        <NucleoDeckBand
          definicao={definicao}
          momento={momento}
          tabs={tabs}
          estado={estado}
          efeitos={efeitos.itens}
          zoom={zoom}
          gamepad={gamepad}
          automatico={!!config.automatico}
          pronto={pronto}
          entregando={entregando}
          erro={erro}
          aviso={aviso}
          onAba={(index) => dispatch({ type: "aba", index })}
          onItem={(aba, item) => {
            setAviso(null);
            dispatch({ type: "aplicar", aba, item, tabs });
          }}
          onNaoCabe={naoCabe}
          onComando={(c) => disparar(c)}
          onEntregar={entregar}
          acao={
            <NucleoActionPanel nucleo={codigo} passos={acao.passos} mostrados={acao.mostrados} onPular={acao.pular}>
              {acao.tipo && (acao.tipo === "ESPECIAL" || acao.tipo === "TROCA") && (
                <NucleoTrigger tipo={acao.tipo} aberta={acao.aberta} usado={acao.usado} cartas={cartas} onAcionar={onAcionar ? acionar : undefined} onSeguir={acao.seguir} />
              )}
            </NucleoActionPanel>
          }
          resultado={resultado ? <NucleoResult codigo={codigo} resultado={resultado} cartas={noResultado} onAgain={onAgain ?? SEM_FIM} /> : null}
        />
        {estado.objetivo && (
          <NucleoObjectiveDetails definicao={definicao} onFechar={() => disparar({ acao: "VER_OBJETIVO" })}>
            <NucleoHelp acoes={definicao.acoes} gamepad={gamepad} ampliar={definicao.recursos.includes("CARTAS")} />
          </NucleoObjectiveDetails>
        )}
      </div>
      {zoom.ampliada && <NucleoCardZoom card={zoom.ampliada} itens={efeitos.itens(zoom.ampliada.id)} onFechar={zoom.fechar} />}
    </div>
  );
}

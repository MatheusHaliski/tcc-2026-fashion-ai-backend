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
import { NucleoCutscene } from "@/components/flair/nucleos/nucleo-cutscene";
import { NucleoCardZoom } from "@/components/flair/nucleos/nucleo-card-zoom";
import { NucleoHelp } from "@/components/flair/nucleos/nucleo-controls";
import { NucleoDeckBand } from "@/components/flair/nucleos/nucleo-deck-band";
import { NucleoObjectiveDetails } from "@/components/flair/nucleos/nucleo-objective";
import { NucleoResult } from "@/components/flair/nucleos/nucleo-result";
import { NucleoSlotRuler } from "@/components/flair/nucleos/nucleo-slot-ruler";
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
import { useResultCards } from "@/components/flair/nucleos/use-result-cards";
import { lookComTroca } from "@/lib/flair/nucleos/action-fx";
import { protagonistaEfetiva } from "@/lib/flair/nucleos/avatares";
import { boardInicial, boardReducer } from "@/lib/flair/nucleos/board";
import type { Comando } from "@/lib/flair/nucleos/controls";
import { vagasDaRegua, type ItemDaFileira } from "@/lib/flair/nucleos/deck-row";
import { salaoDaVez } from "@/lib/flair/nucleos/detective";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { pecasDoLook } from "@/lib/flair/nucleos/look";
import { acionamentoDe, comandoPermitido, type Momento } from "@/lib/flair/nucleos/moments";
import { classesDoQuadro, estiloDoQuadro } from "@/lib/flair/nucleos/quadro";
import { semPlacar, varianteDaCena } from "@/lib/flair/nucleos/variante";
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
  /** o servidor está respondendo um acionamento */
  acionando?: boolean;
  erroAcionar?: ApiError | null;
  /** prévia do servidor para o look de agora (preparação) */
  previa?: NucleoResultado | null;
  /** pede a prévia a cada mudança do look */
  onPrevia?: (sel: Selecao, avatar: AvatarTipo) => void;
  /** última apresentação que não fechou a partida (LABIRINTO) */
  tentativa?: NucleoResultado | null;
}

const SEM_FIM = () => undefined;

export function NucleoGame(props: Props) {
  const { definicao, cartas, entregando, erro, onEntregar, momento = "PREPARACAO", resultado = null, onFimAcao, onAgain, onAcionar, onPrevia } = props;
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
  /** o look em cena: o da entrega com a troca do intervalo que o servidor aplicou */
  const vestidas = useMemo(() => lookComTroca(estado.sel.cartas, resultado), [estado.sel.cartas, resultado]);
  const pecas = useMemo(() => pecasDoLook(vestidas, cartas), [vestidas, cartas]);
  /** a pessoa já acionou uma carta nesta partida (vale até o servidor confirmar ou recusar) */
  const [acionou, setAcionou] = useState(false);
  const efeitos = useNucleoEffects(codigo, cartas, definicao.recursos.includes("CARTAS"));
  const preparando = momento === "PREPARACAO";
  const acionamento = acionamentoDe(codigo);
  const faltaResposta = acionamento?.tipo === "RESPOSTA" && !estado.sel.resposta;
  const pronto = temEscolha(estado.sel) && !faltaResposta;
  const emFoco = tabs[estado.aba]?.items[estado.item];
  const zoom = useCardZoom(emFoco?.kind === "carta" ? emFoco.card : null, preparando);
  const entrada = useCardFx({ nucleo: codigo, vestidas: estado.sel.cartas, cards: cartas, itens: efeitos.itens, ativo: preparando, reduzido, prefs: fx.prefs });
  const acao = useNucleoAction({ nucleo: codigo, momento, resultado, automatico: !!config.automatico, reduzido, prefs: fx.prefs, onFim: onFimAcao ?? SEM_FIM });

  useEffect(() => {
    if (estado.sel.resposta && acionamento?.tipo === "RESPOSTA") emitirFx({ tipo: "acionamento", nucleo: codigo, acionamento: "RESPOSTA" });
  }, [estado.sel.resposta, acionamento?.tipo, codigo]);

  useEffect(() => {
    if (preparando) onPrevia?.(estado.sel, efetiva);
  }, [preparando, estado.sel, efetiva, onPrevia]);
  useEffect(() => {
    setAcionou(false);
  }, [props.erroAcionar, resultado]);
  const variante = varianteDaCena(codigo, estado.sel.resposta, props.tentativa);
  /** a ação que a cor da carta dispara ao entrar em campo (item ACAO_* do servidor) */
  const acaoDaCarta = (id: string) => {
    const item = efeitos.itens(id)?.find((i) => i.codigo.startsWith("ACAO_"));
    if (!item) return null;
    const modalidade = estado.sel.resposta ?? "FUTEBOL";
    return tx.ou(`flair3d.ui.acaoCor.${modalidade}.${item.codigo.slice("ACAO_".length)}`, tx.efeito(item));
  };

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
    if (pedido.cardId) setAcionou(true);
    onAcionar?.(pedido);
  };

  const pontuadas = useResultCards({ momento, resultado, vestidas, cards: cartas, efeitos: efeitos.porCarta });

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
        previa={props.previa ?? null}
        variante={variante}
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
        {codigo === "FASHION_DETECTIVE" && preparando && <NucleoCutscene salao={salaoDaVez(props.tentativa)} />}
        <NucleoSlotRuler
          vagas={vagasDaRegua(tabs)}
          vestidas={vestidas}
          cards={cartas}
          vaga={estado.vaga}
          bloqueada={!preparando}
          brilho={pontuadas.brilho}
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
          tentativa={props.tentativa}
          onAba={(index) => dispatch({ type: "aba", index })}
          onItem={(aba, item) => {
            setAviso(null);
            dispatch({ type: "aplicar", aba, item, tabs });
          }}
          onNaoCabe={naoCabe}
          onComando={(c) => disparar(c)}
          onEntregar={entregar}
          acao={
            <NucleoActionPanel nucleo={codigo} variante={variante} passos={acao.passos} mostrados={acao.mostrados} onPular={acao.pular} esperando={acao.aberta}>
              {acao.tipo && (
                <NucleoTrigger
                  tipo={acao.tipo}
                  aberta={acao.aberta}
                  usado={acao.usado || acionou}
                  cartas={cartas}
                  vestidas={vestidas}
                  vagas={vagasDaRegua(tabs).map((v) => v.tab.id)}
                  ocupado={!!props.acionando}
                  erro={props.erroAcionar ?? null}
                  acaoDe={acaoDaCarta}
                  onAcionar={onAcionar ? acionar : undefined}
                />
              )}
            </NucleoActionPanel>
          }
          resultado={resultado ? <NucleoResult codigo={codigo} resultado={resultado} cartas={pontuadas.lista} semPlacar={semPlacar(definicao)} onAgain={onAgain ?? SEM_FIM} /> : null}
        />
        {estado.objetivo && (
          <NucleoObjectiveDetails definicao={definicao} variante={variante} onFechar={() => disparar({ acao: "VER_OBJETIVO" })}>
            <NucleoHelp acoes={definicao.acoes} gamepad={gamepad} ampliar={definicao.recursos.includes("CARTAS")} />
          </NucleoObjectiveDetails>
        )}
      </div>
      {zoom.ampliada && <NucleoCardZoom card={zoom.ampliada} itens={efeitos.itens(zoom.ampliada.id)} onFechar={zoom.fechar} />}
    </div>
  );
}

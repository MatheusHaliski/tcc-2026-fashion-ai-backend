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
import { EsporteResumo, resultadoSemLances } from "@/components/flair/esporte/esporte-resumo";
import { NucleoActionSlot } from "@/components/flair/nucleos/nucleo-action-slot";
import { MODELO_CASA, type Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { NucleoApresentacao } from "@/components/flair/nucleos/nucleo-apresentacao";
import { NucleoCardZoom } from "@/components/flair/nucleos/nucleo-card-zoom";
import { NucleoHelp } from "@/components/flair/nucleos/nucleo-controls";
import { NucleoDeckBand } from "@/components/flair/nucleos/nucleo-deck-band";
import { NucleoObjectiveDetails } from "@/components/flair/nucleos/nucleo-objective";
import { NucleoResult } from "@/components/flair/nucleos/nucleo-result";
import { NucleoSlotRuler } from "@/components/flair/nucleos/nucleo-slot-ruler";
import { NucleoStage } from "@/components/flair/nucleos/nucleo-stage";
import type { AcionamentoPedido } from "@/components/flair/nucleos/nucleo-trigger";
import { useCardFx } from "@/components/flair/nucleos/use-card-fx";
import { useCardZoom } from "@/components/flair/nucleos/use-card-zoom";
import { useFxPrefs } from "@/components/flair/nucleos/use-fx-prefs";
import { useNucleoAction } from "@/components/flair/nucleos/use-nucleo-action";
import { useNucleoBriefing } from "@/components/flair/nucleos/use-nucleo-briefing";
import { useNucleoComandos } from "@/components/flair/nucleos/use-nucleo-comandos";
import { useNucleoEffects } from "@/components/flair/nucleos/use-nucleo-effects";
import { useNucleoSinais } from "@/components/flair/nucleos/use-nucleo-sinais";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { useLookDosRecursos } from "@/components/flair/nucleos/recursos/use-look-dos-recursos";
import { useRecursosDaPartida } from "@/components/flair/nucleos/recursos/use-recursos-da-partida";
import { NucleoRodaRecursos } from "@/components/flair/nucleos/recursos/nucleo-roda-recursos";
import { useCinemaDaPartida } from "@/components/flair/cinema/use-cinema-da-partida";
import { CinemaOverlay } from "@/components/flair/cinema/cinema-overlay";
import { useNucleoViewport } from "@/components/flair/nucleos/use-nucleo-viewport";
import { useModoPorCartas } from "@/components/flair/nucleos/use-modo-por-cartas";
import { useResultCards } from "@/components/flair/nucleos/use-result-cards";
import { lookComTroca } from "@/lib/flair/nucleos/action-fx";
import { protagonistaEfetiva } from "@/lib/flair/nucleos/avatares";
import { boardComLook, boardInicial, boardReducer } from "@/lib/flair/nucleos/board";
import { lerRascunho, useRascunho } from "@/components/flair/nucleos/use-rascunho";
import { vagasDaRegua, type ItemDaFileira } from "@/lib/flair/nucleos/deck-row";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { pecasDoLook } from "@/lib/flair/nucleos/look";
import { pecasDasZonas } from "@/lib/flair/nucleos/pecas-pintadas";
import { acionamentoDe, type Momento } from "@/lib/flair/nucleos/moments";
import { classesDoQuadro, estiloDoQuadro } from "@/lib/flair/nucleos/quadro";
import { respostaObrigatoria, vagasQueFaltam } from "@/lib/flair/nucleos/rodadas";
import { semPlacar, varianteDaCena } from "@/lib/flair/nucleos/variante";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { buildTabs, temEscolha, type Selecao } from "@/lib/flair/nucleos/selection";
import type { AvatarTipo, NucleoDefinicao, NucleoPartida, NucleoResultado } from "@/lib/flair/nucleos/types";

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
  /** a partida aberta: a rodada e o que o jogo revelou ao entrar */
  partida?: NucleoPartida | null;
}

const SEM_FIM = () => undefined;
/** nenhum acionamento de hoje dispara ação de cor (a troca de peça do esporte virou a mão de cartas) */
const SEM_ACAO_DE_COR = () => null;

export function NucleoGame(props: Props) {
  const { definicao, cartas, entregando, erro, onEntregar, momento = "PREPARACAO", resultado = null, onFimAcao, onAgain, onAcionar, onPrevia } = props;
  const tx = useNucleoText();
  const codigo = definicao.codigo;
  const config = NUCLEOS[codigo];
  const layout = useNucleoViewport();
  const reduzido = useReducedMotion();
  const fx = useFxPrefs();
  const tabs = useMemo(() => buildTabs(definicao, cartas), [definicao, cartas]);
  // o rascunho da preparação: por partida nos jogos de deck; por jogo e rodada nos de zonas (a partida abre na prévia)
  const rascunho = definicao.deck && !definicao.deck.semDeck ? props.partida?.id : `${codigo}.${definicao.rodada ?? ""}`;
  const [estado, dispatch] = useReducer(boardReducer, undefined, () => boardComLook(boardInicial(), props.partida?.vestidas, lerRascunho<Selecao>(rascunho) ?? props.partida?.rascunho));
  const [aviso, setAviso] = useState<string | null>(null);
  const perfil = useMirrorAvatar();
  const [escolha, setEscolha] = useState<AvatarTipo | null>(null);
  const efetiva = protagonistaEfetiva(config.avatares.protagonista, escolha, !!perfil.avatar);
  const protagonista: Protagonista = efetiva === "PROPRIO" ? { avatar: perfil.avatar, sexo: perfil.sex, corpo: perfil.body } : MODELO_CASA;
  const apresentacao = useNucleoBriefing(props.partida, props.tentativa);
  /** o look em cena: o da entrega com a troca do intervalo que o servidor aplicou (ou o look-alvo, enquanto está à vista) */
  const vestidas = useMemo(() => apresentacao.alvoAVista ?? lookComTroca(estado.sel.cartas, resultado), [apresentacao.alvoAVista, estado.sel.cartas, resultado]);
  const pecas = useMemo(() => (Object.keys(vestidas).length ? pecasDoLook(vestidas, cartas) : pecasDasZonas(codigo, estado.sel.zonas)), [vestidas, cartas, codigo, estado.sel.zonas]);
  /** a pessoa já acionou uma carta nesta partida (vale até o servidor confirmar ou recusar) */
  const [acionou, setAcionou] = useState(false);
  const efeitos = useNucleoEffects(codigo, cartas, definicao.recursos.includes("CARTAS"), { partida: props.partida?.id, rodada: definicao.rodada });
  const preparando = momento === "PREPARACAO";
  useRascunho(rascunho, preparando, estado.sel, !temEscolha(estado.sel), resultado?.status === "ENTREGUE", rascunho === props.partida?.id);
  const acionamento = acionamentoDe(codigo);
  const faltaResposta = respostaObrigatoria(definicao) && !estado.sel.resposta;
  const pronto = temEscolha(estado.sel) && !faltaResposta && vagasQueFaltam(definicao, estado.sel.cartas).length === 0;
  const emFoco = tabs[estado.aba]?.items[estado.item];
  const zoom = useCardZoom(emFoco?.kind === "carta" ? emFoco.card : null, preparando);
  const entrada = useCardFx({ nucleo: codigo, vestidas: estado.sel.cartas, cards: cartas, itens: efeitos.itens, ativo: preparando, reduzido, prefs: fx.prefs });
  const acao = useNucleoAction({ nucleo: codigo, momento, resultado, automatico: !!config.automatico, reduzido, prefs: fx.prefs, onFim: onFimAcao ?? SEM_FIM });

  useNucleoSinais({ codigo, sel: estado.sel, acionamento, preparando, efetiva, onPrevia });
  /** a regra peça-recurso: os atributos do look e o que a última peça vestida mudou (a roda no palco) */
  const recursos = useLookDosRecursos(vestidas, efeitos.perfil, preparando, props.previa);
  const usoDeRecursos = useRecursosDaPartida(props.partida?.id, cartas, efeitos.perfil, momento !== "RESULTADO", definicao.deck?.semDeck ? vestidas : undefined);
  const cinema = useCinemaDaPartida({ codigo, partida: props.partida?.id, momento, resultado, reduzido });
  useEffect(() => {
    setAcionou(false);
  }, [props.erroAcionar, resultado]);
  const variante = varianteDaCena(codigo, estado.sel.resposta, props.tentativa, props.partida);
  const entregar = () => {
    if (!preparando || !pronto || entregando) return;
    if (acionamento?.tipo === "ESPELHO") emitirFx({ tipo: "acionamento", nucleo: codigo, acionamento: "ESPELHO" });
    onEntregar(estado.sel, efetiva);
  };
  const { disparar, gamepad } = useNucleoComandos({ codigo, acoes: definicao.acoes, momento, tabs, pausado: estado.objetivo, ativo: !entregando && !zoom.ampliada, acaoPropria: codigo === "FASHION_SPORTS", cena: { tocando: !!cinema.cutscene, pular: cinema.pular }, entreLances: acao.aberta,
    dispatch, entregar, limparAviso: () => setAviso(null) });

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

  const doEsporte = codigo === "FASHION_SPORTS";
  /** Fashion Sports e Fashion Detective jogados por cartas: o palco e a faixa de baixo do jogo (use-modo-por-cartas) */
  const modo = useModoPorCartas({ codigo, rodada: definicao.rodada, momento, resultado, escolhida: estado.sel.resposta, acao, cartas, vestidas: estado.sel.cartas, itens: efeitos.itens,
    pecas, protagonista, semente: props.partida?.semente, ocupado: !!props.acionando, erro: props.erroAcionar ?? null, acionar,
    extra: <><NucleoRodaRecursos recursos={usoDeRecursos} reduzido={reduzido} efeitos={fx.prefs.efeitos} />{doEsporte && <CinemaOverlay cinema={cinema} />}</> });
  const partida = modo.esporte;

  const pontuadas = useResultCards({ momento, resultado, vestidas, cards: cartas, efeitos: efeitos.porCarta });

  return (
    <div className={classesDoQuadro(layout)} style={estiloDoQuadro(layout)} data-testid="nucleo-game" data-momento={momento} data-porte={layout.porte} data-quadro={layout.quadro} data-reduced={reduzido || undefined} data-fx={fx.prefs.efeitos ? "on" : "off"}>
      <p className="sr-only" role="status" data-testid="nucleo-moment">{tx.t("flair3d.ui.moment.label", { momento: tx.t(`flair3d.ui.moment.${momento}`) })}</p>
      {modo.palco ?? (
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
          variante={variante} semente={props.partida?.semente}
          zonas={estado.sel.zonas} maquiagem={estado.sel.maquiagem}
          prefs={fx.prefs}
          onPref={fx.alternar}
          entrada={entrada} recursos={recursos} usoDeRecursos={usoDeRecursos} cinema={cinema} onFimDesfile={acao.pular} entreLances={acao.aberta}
          onExecucao={(toques) => acionar({ tipo: "EXECUCAO", execucao: { toques } })}
          reduzido={reduzido}
          passos={acao.passos}
          mostrados={acao.mostrados}
          gamepad={gamepad}
          onComando={(c) => disparar(c)}
        />
      )}
      <div className="n3d-lower">
        {preparando && <NucleoApresentacao definicao={definicao} partida={props.partida} tentativa={props.tentativa} apresentacao={apresentacao} cartas={cartas} efeitos={efeitos.itens} />}
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
          briefing={apresentacao.resumo}
          onAba={(index) => dispatch({ type: "aba", index })}
          onItem={(aba, item) => {
            setAviso(null);
            dispatch({ type: "aplicar", aba, item, tabs });
          }}
          onNaoCabe={naoCabe}
          onComando={(c) => disparar(c)}
          onEntregar={entregar}
          acao={modo.acao ?? (
              <NucleoActionSlot nucleo={codigo} variante={variante} acao={acao} acionou={acionou} cartas={cartas} vestidas={vestidas}
                vagas={vagasDaRegua(tabs).map((v) => v.tab.id)} ocupado={!!props.acionando} erro={props.erroAcionar ?? null}
                acaoDe={SEM_ACAO_DE_COR} itens={efeitos.itens} onAcionar={onAcionar ? acionar : undefined} />
          )}
          resultado={resultado ? (
            <NucleoResult codigo={codigo} resultado={doEsporte ? resultadoSemLances(resultado) : resultado} cartas={pontuadas.lista} semPlacar={semPlacar(definicao)} rodada={definicao.rodada} onAgain={onAgain ?? SEM_FIM}>
              {doEsporte && <EsporteResumo esporte={partida} cartas={cartas} />}
            </NucleoResult>
          ) : null}
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

"use client";
/**
 * O painel do desfile jogável na tela: quantas marcas faltam, a deixa da execução (o botão pedido com a janela de tempo
 * correndo, components/flair/nucleos/use-execucao-do-desfile.ts), a nota de cada marca, o recurso que o erro drena e,
 * na ponta com a execução feita, o botão da pose final (□). Nos jogos de zonas é a fase de uso: a deixa traz o lance
 * seguro e o ousado e a fase tem prazo (fase-de-uso-hud.tsx); na rodada zonas, o momento-chave e a mão de cartas
 * (fase-de-uso-mao.tsx). Avisa a tela quando a pose final acabou, para revelar o
 * resultado. Lido pelo leitor de tela.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { DeixaDeUso, PrazoDaFase, lancesDoJogo } from "@/components/flair/nucleos/fase-de-uso-hud";
import { DeixaDaChave, MaoDeUso, textoDaChave } from "@/components/flair/nucleos/fase-de-uso-mao";
import { useExecucaoDoDesfile } from "@/components/flair/nucleos/use-execucao-do-desfile";
import { useMaoDeUso } from "@/components/flair/nucleos/use-mao-de-uso";
import { ConsoleDaFaseDeUso, DeixaCurta } from "@/components/flair/nucleos/fase-de-uso-console";
import { usaConsoleNaFase } from "@/components/flair/nucleos/use-console-da-fase-de-uso";
import { assinarFx, emitirFx } from "@/lib/flair/nucleos/fx-events";
import { GLIFO, notaDe, pedidoDe, restanteDepois, type Toque } from "@/lib/flair/nucleos/movimento/execucao";
import { nomeDoRecurso } from "@/lib/flair/recursos/desgaste";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

interface Props {
  codigo: NucleoCodigo;
  onFim: () => void;
  /** a última resposta do servidor (traz o pedido da execução) e o envio dos toques */
  resultado?: NucleoResultado | null;
  onExecucao?: (toques: Toque[]) => void;
  reduzido?: boolean;
}

export function DesfileHud({ codigo, onFim, resultado, onExecucao, reduzido = false }: Props) {
  const tx = useNucleoText();
  const [p, setP] = useState({ alcancadas: 0, total: 3, naPonta: false });
  const lances = pedidoDe(resultado)?.risco?.lances;
  const mao = useMaoDeUso(codigo, lances);
  const { pedido, deixa, notas, ousadias, prazo } = useExecucaoDoDesfile(codigo, resultado, reduzido, onExecucao, mao.paraAMarca);
  const risco = pedido?.risco;
  const gesto = tx.ou(`flair3d.desfile.acao.${codigo}`, tx.t("flair3d.desfile.acao.padrao"));
  useEffect(() => assinarFx((e) => {
    if (e.nucleo !== codigo) return;
    if (e.tipo === "desfile") setP({ alcancadas: e.alcancadas, total: e.total, naPonta: e.naPonta });
    if (e.tipo === "desfile-fim") onFim();
  }), [codigo, onFim]);
  const esperando = !!pedido && notas.length >= pedido.botoes.length;
  const total = pedido?.botoes.length ?? p.total;
  const fase = tx.ou(`flair3d.uso.titulo.${codigo}`, "");
  // a fase de uso em curso ou já conferida pelo servidor (no ateliê, sem ela, vale o painel comum)
  const emUso = !!risco || (!!fase && !!notaDe(resultado));
  const texto = deixa
    ? deixa.chave
      ? textoDaChave(tx, deixa)
      : deixa.ousado && risco
      ? tx.t("flair3d.uso.deixa", { ...lancesDoJogo(tx, codigo), botaoSeguro: GLIFO[deixa.botao], botaoOusado: GLIFO[deixa.ousado], custo: risco.custo })
      : tx.t("flair3d.execucao.deixa", { botao: GLIFO[deixa.botao] })
    : pedido
      ? tx.t(esperando ? "flair3d.execucao.enviando" : risco ? "flair3d.uso.marcas" : "flair3d.desfile.marcas", { alcancadas: p.alcancadas, total, fase })
      : tx.t(p.naPonta ? "flair3d.desfile.ponta" : emUso ? "flair3d.uso.fim" : "flair3d.desfile.marcas", { alcancadas: p.alcancadas, total, acao: gesto, fase });
  // perfil console (jogos de zonas): HUD mínimo na cena; o texto longo fica para o leitor de tela
  const console_ = usaConsoleNaFase(codigo) && emUso;
  const janela = { "--n3d-janela": `${deixa?.janelaMs ?? 0}ms` } as CSSProperties;
  return (
    <div className="n3d-desfile" data-testid="desfile-hud" data-ponta={p.naPonta || undefined} data-deixa={deixa?.botao} data-uso={emUso ? "" : undefined} data-console={console_ || undefined}>
      {console_ && <DeixaCurta codigo={codigo} deixa={deixa} />}
      {!console_ && deixa?.chave && <DeixaDaChave deixa={deixa} />}
      {!console_ && deixa && risco && !deixa.chave && <DeixaDeUso codigo={codigo} deixa={deixa} custo={risco.custo} />}
      {deixa && !risco && <span key={deixa.marca} className="n3d-deixa" style={janela} aria-hidden>{GLIFO[deixa.botao]}</span>}
      <p role="status" className={console_ ? "sr-only" : undefined}>{texto}</p>
      {pedido && (
        <span className="n3d-execucao" data-testid="execucao-notas">
          {notas.map((n, i) => <i key={i} data-nota={n} title={tx.t(`flair3d.execucao.nota.${n}`)}>{console_ ? "●" : tx.t(`flair3d.execucao.nota.${n}`)}</i>)}
          {!esperando && onExecucao && (
            <button type="button" className="n3d-desfile-seguir" onClick={() => onExecucao([])} title={tx.t("flair3d.execucao.seguir")}>{tx.t(console_ ? "flair3d.uso.console.seguir" : "flair3d.execucao.seguir")}</button>
          )}
          <b>{tx.t("flair3d.execucao.recurso", { recurso: nomeDoRecurso(tx.ou, codigo, pedido.recurso), n: restanteDepois(pedido, notas, ousadias) })}</b>
          <PrazoDaFase prazo={prazo} parado={esperando} />
        </span>
      )}
      {console_ && (
        <ConsoleDaFaseDeUso codigo={codigo} ativo={!esperando} deixa={deixa} cartas={mao.cartas} armada={mao.armada} disponivel={(c) => mao.disponivel(c, notas.length)} armar={mao.armar} />
      )}
      {!console_ && lances && !esperando && (
        <MaoDeUso cartas={mao.cartas} lances={lances} armada={mao.armada} usos={mao.usos} marca={notas.length} disponivel={mao.disponivel} armar={mao.armar} />
      )}
      {!pedido && p.naPonta && (
        <button type="button" className="n3d-desfile-pose" onClick={() => emitirFx({ tipo: "desfile-pose", nucleo: codigo })}>
          □ {gesto}
        </button>
      )}
    </div>
  );
}

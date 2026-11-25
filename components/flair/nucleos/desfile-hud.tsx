"use client";
/**
 * O painel do desfile jogável na tela: quantas marcas faltam, a deixa da execução (o botão pedido com a janela de tempo
 * correndo, components/flair/nucleos/use-execucao-do-desfile.ts), a nota de cada marca, o recurso que o erro drena e,
 * na ponta com a execução feita, o botão da pose final (□). Avisa a tela quando a pose final acabou, para revelar o
 * resultado. Lido pelo leitor de tela.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { useExecucaoDoDesfile } from "@/components/flair/nucleos/use-execucao-do-desfile";
import { assinarFx, emitirFx } from "@/lib/flair/nucleos/fx-events";
import { GLIFO, restanteDepois, type Toque } from "@/lib/flair/nucleos/movimento/execucao";
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
  const { pedido, deixa, notas } = useExecucaoDoDesfile(codigo, resultado, reduzido, onExecucao);
  const gesto = tx.ou(`flair3d.desfile.acao.${codigo}`, tx.t("flair3d.desfile.acao.padrao"));
  useEffect(() => assinarFx((e) => {
    if (e.nucleo !== codigo) return;
    if (e.tipo === "desfile") setP({ alcancadas: e.alcancadas, total: e.total, naPonta: e.naPonta });
    if (e.tipo === "desfile-fim") onFim();
  }), [codigo, onFim]);
  const esperando = !!pedido && notas.length >= pedido.botoes.length;
  const texto = deixa
    ? tx.t("flair3d.execucao.deixa", { botao: GLIFO[deixa.botao] })
    : pedido
      ? tx.t(esperando ? "flair3d.execucao.enviando" : "flair3d.desfile.marcas", { alcancadas: p.alcancadas, total: p.total })
      : tx.t(p.naPonta ? "flair3d.desfile.ponta" : "flair3d.desfile.marcas", { alcancadas: p.alcancadas, total: p.total, acao: gesto });
  const janela = { "--n3d-janela": `${deixa?.janelaMs ?? 0}ms` } as CSSProperties;
  return (
    <div className="n3d-desfile" data-testid="desfile-hud" data-ponta={p.naPonta || undefined} data-deixa={deixa?.botao}>
      {deixa && <span key={deixa.marca} className="n3d-deixa" style={janela} aria-hidden>{GLIFO[deixa.botao]}</span>}
      <p role="status">{texto}</p>
      {pedido && (
        <span className="n3d-execucao" data-testid="execucao-notas">
          {notas.map((n, i) => <i key={i} data-nota={n}>{tx.t(`flair3d.execucao.nota.${n}`)}</i>)}
          {!esperando && onExecucao && (
            <button type="button" className="n3d-desfile-seguir" onClick={() => onExecucao([])}>{tx.t("flair3d.execucao.seguir")}</button>
          )}
          <b>{tx.t("flair3d.execucao.recurso", { recurso: tx.ou(`flair3d.ui.recurso.${pedido.recurso}`, pedido.recurso), n: restanteDepois(pedido, notas) })}</b>
        </span>
      )}
      {!pedido && p.naPonta && (
        <button type="button" className="n3d-desfile-pose" onClick={() => emitirFx({ tipo: "desfile-pose", nucleo: codigo })}>
          □ {gesto}
        </button>
      )}
    </div>
  );
}

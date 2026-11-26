"use client";
/**
 * Um elenco (/flair/elencos/[elenco]) em quebra-cabeça: a imagem do elenco cortada em peças em cima, as vagas (uma por
 * peça, com o que cada uma pede) embaixo e a bandeja de cartas presa ao pé da tela. A carta que cumpre o pedido encaixa
 * a peça; o deck inteiro completa o quebra-cabeça, a entrega sai sozinha e o modal de conclusão abre com o vídeo.
 * Teclado, toque e gamepad pelo mesmo hook dos núcleos (ver use-elenco-jogo.ts).
 */
import { useState } from "react";
import Link from "next/link";
import { EmptyState, PageHeader, SkeletonGrid, UiIcon } from "@/components/ui";
import { ElencoCompleto } from "@/components/flair/elencos/elenco-completo";
import { ElencoPuzzle } from "@/components/flair/elencos/elenco-puzzle";
import { ElencoRequirements } from "@/components/flair/elencos/elenco-requirements";
import { ElencoVagas } from "@/components/flair/elencos/elenco-vagas";
import { useElenco } from "@/components/flair/elencos/use-elenco";
import { useElencoJogo } from "@/components/flair/elencos/use-elenco-jogo";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { Bandeja } from "@/components/flair/montagem/bandeja";
import { useNucleoControls } from "@/components/flair/nucleos/use-nucleo-controls";
import { elencoDaRota } from "@/lib/flair/elencos/formacoes";
import { encaixadas, estadosDasPecas } from "@/lib/flair/elencos/progresso";
import { quebraCabecaDe, type QuebraCabeca } from "@/lib/flair/elencos/quebra-cabecas";
import type { Comando } from "@/lib/flair/nucleos/controls";
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

const ACOES: NucleoAcao[] = ["NAVEGAR", "VESTIR", "TIRAR", "ENTREGAR", "VER_OBJETIVO"];
const BOTOES: { id: string; cmd: Comando }[] = [
  { id: "prev", cmd: { acao: "NAVEGAR", dir: -1, eixo: "x" } },
  { id: "next", cmd: { acao: "NAVEGAR", dir: 1, eixo: "x" } },
  { id: "open", cmd: { acao: "VESTIR" } },
  { id: "remove", cmd: { acao: "TIRAR" } },
  { id: "requirements", cmd: { acao: "VER_OBJETIVO" } },
];
const COLUNAS: Record<string, number> = { grade: 2, jigsaw: 4, setores: 4, cacos: 4 };

function Elenco({ codigo, qc }: { codigo: string; qc: QuebraCabeca }) {
  const tx = useElencoText();
  const m = useElenco(codigo);
  const j = useElencoJogo(m, codigo === "CELEBRACAO_ARENA" ? 3 : COLUNAS[qc.forma]);
  const [fechado, setFechado] = useState(false);
  const { disparar } = useNucleoControls({ acoes: ACOES, onComando: j.onComando, ativo: !m.entregando });
  if (m.carregando || m.carregandoCartas) return <SkeletonGrid n={3} />;
  if (!m.elenco || !j.atual) return <EmptyState title={tx.t("flair3d.elencos.notFound")} />;
  const atual = j.atual;
  const nome = tx.elenco(codigo);
  const completo = !!m.resultado?.ok;
  const estados = estadosDasPecas(m.elenco.vagas, m.cartas, m.conferencia, m.conferidas);
  const certas = completo ? m.elenco.vagas.length : encaixadas(estados);
  const bandeja = j.aberta && !completo;
  return (
    <div className="ep-game" data-testid="elenco-game">
      {m.offline && <p className="n3d-offline" role="status">{tx.t("flair3d.ui.offline")}</p>}
      <ElencoPuzzle qc={qc} nome={nome} estados={m.elenco.vagas.map((v) => estados[v.chave])} chaves={m.elenco.vagas.map((v) => v.chave)}
        selecionada={completo ? undefined : atual.chave} completo={completo} onPeca={completo ? undefined : j.selecionar} />
      <ElencoRequirements requisitos={m.elenco.requisitos} conf={m.conferencia} encaixadas={certas} total={m.elenco.vagas.length}
        aberto={j.requisitos} onToggle={() => disparar({ acao: "VER_OBJETIVO" })} />
      <ElencoVagas vagas={m.elenco.vagas} cartas={m.cartas} banco={m.banco} estados={estados} selecionada={atual.chave} onVaga={j.selecionar}
        pegar={completo ? undefined : j.pegar} />
      <div className="n3d-pad" role="toolbar" aria-label={tx.t("flair3d.ui.controls.toolbar")}>
        {BOTOES.map((b) => <button key={b.id} type="button" className="n3d-pad-btn" onClick={() => disparar(b.cmd)}>{tx.t(`flair3d.elencos.button.${b.id}`)}</button>)}
        <button type="button" className="n3d-pad-btn" onClick={j.desfazer} disabled={!m.podeDesfazer}>{tx.t("flair.mesa.undo")}</button>
      </div>
      <p className="mk-effect">{tx.t("flair3d.elencos.help")}</p>
      {m.erroConferir && <p className="n3d-error" role="alert">{tx.t("flair3d.elencos.checkError", { msg: m.erroConferir.message })}</p>}
      {m.erroEntrega && <p className="n3d-error" role="alert">{tx.t("flair3d.ui.submitError", { msg: m.erroEntrega.message })}</p>}
      {completo ? (
        <button type="button" className="btn btn-primary n3d-submit" onClick={() => setFechado(false)}>{tx.t("flair3d.elencos.complete.again")}</button>
      ) : (
        <button type="button" className="btn btn-primary n3d-submit" disabled={!j.pronto} onClick={() => void m.entregar()}>
          {tx.t(m.entregando ? "flair3d.ui.submitting" : "flair3d.elencos.submit")}
        </button>
      )}
      {m.resultado?.ok && <ElencoCompleto qc={qc} nome={nome} edicao={m.resultado.edicao} aberto={!fechado} onFechar={() => setFechado(true)} />}
      {bandeja && (
        <Bandeja vagaId={atual.chave} vaga={tx.t("flair3d.elencos.pieceName", { n: j.indice(atual.chave) })} aceita={tx.pede(atual)} opcoes={j.opcoes} estrita
          foco={j.foco} temCarta={!!m.cartas[atual.chave]} podeDesfazer={m.podeDesfazer} onEscolher={j.escolher} onTirar={() => j.tirar(atual.chave)}
          onDesfazer={j.desfazer} onFechar={j.fechar} pegar={j.pegar} posicao={tx.posicao} atributo={tx.atributo} aviso={j.aviso} />
      )}
    </div>
  );
}

export function ElencoScreen({ elenco }: { elenco: string }) {
  const tx = useElencoText();
  const codigo = elencoDaRota(elenco);
  const qc = codigo ? quebraCabecaDe(codigo) : null;
  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair/elencos" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{tx.t("flair3d.elencos.back")}</Link>
        <PageHeader title={codigo ? tx.elenco(codigo) : tx.t("flair3d.elencos.title")} kicker={tx.t("flair3d.elencos.kicker")} />
      </div>
      {codigo && qc ? <Elenco key={codigo} codigo={codigo} qc={qc} /> : <EmptyState title={tx.t("flair3d.elencos.notFound")} />}
    </>
  );
}

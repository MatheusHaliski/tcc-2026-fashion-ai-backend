"use client";
/**
 * Um elenco (/flair/elencos/[elenco]), sem cenário 3D: o quebra-cabeça da arte em cima e o tabuleiro embaixo, com a
 * química, os requisitos, a gaveta de cartas por vaga e a entrega. Teclado, toque e gamepad pelo mesmo hook dos
 * núcleos: setas/direcional escolhem a vaga (ou a carta, com a gaveta aberta), Espaço/A abre a gaveta e põe a carta,
 * Backspace/B tira (ou fecha a gaveta), Enter/Start entrega, O/Select mostra os requisitos.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState, PageHeader, SkeletonGrid, UiIcon } from "@/components/ui";
import { ElencoBoard } from "@/components/flair/elencos/elenco-board";
import { ElencoDrawer } from "@/components/flair/elencos/elenco-drawer";
import { ElencoJigsaw } from "@/components/flair/elencos/elenco-jigsaw";
import { ElencoRequirements } from "@/components/flair/elencos/elenco-requirements";
import { useElenco } from "@/components/flair/elencos/use-elenco";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { useNucleoControls } from "@/components/flair/nucleos/use-nucleo-controls";
import { estadoDasPecas, gradeDe, ordemDeLeitura, posicaoDaVaga, vagaVizinha } from "@/lib/flair/elencos/board";
import { arteDoElenco, elencoDaRota } from "@/lib/flair/elencos/formacoes";
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

function Elenco({ codigo }: { codigo: string }) {
  const tx = useElencoText();
  const m = useElenco(codigo);
  const vagas = useMemo(() => ordemDeLeitura(m.elenco?.vagas ?? []), [m.elenco]);
  const [vaga, setVaga] = useState<string>("");
  const [gaveta, setGaveta] = useState(false);
  const [foco, setFoco] = useState(0);
  const [requisitos, setRequisitos] = useState(true);
  const atual = vagas.find((v) => v.chave === vaga) ?? vagas[0];
  const doDrawer = useMemo(() => (atual ? m.banco.filter((c) => c.position === atual.posicao) : []), [atual, m.banco]);
  const pronto = !!m.conferencia?.ok && !m.entregando && !m.resultado;

  const abrir = (chave: string) => {
    setVaga(chave);
    setGaveta(true);
    setFoco(0);
  };
  const escolher = (cardId: string) => {
    if (!atual) return;
    m.por(atual.chave, cardId);
    setGaveta(false);
  };
  const onComando = (c: Comando) => {
    if (!atual) return;
    const dir = c.dir ?? 1;
    if (c.acao === "NAVEGAR" && gaveta) setFoco((f) => Math.min(Math.max(0, doDrawer.length - 1), Math.max(0, f + (c.eixo === "y" ? dir * 4 : dir))));
    else if (c.acao === "NAVEGAR") setVaga(vagaVizinha(vagas, atual.chave, dir, c.eixo ?? "x"));
    else if (c.acao === "VESTIR" && gaveta && doDrawer[foco]) escolher(doDrawer[foco].id);
    else if (c.acao === "VESTIR") abrir(atual.chave);
    else if (c.acao === "TIRAR" && gaveta) setGaveta(false);
    else if (c.acao === "TIRAR") m.tirar(atual.chave);
    else if (c.acao === "VER_OBJETIVO") setRequisitos((r) => !r);
    else if (c.acao === "ENTREGAR" && pronto) void m.entregar();
  };
  const { disparar } = useNucleoControls({ acoes: ACOES, onComando, ativo: !m.entregando });

  if (m.carregando || m.carregandoCartas) return <SkeletonGrid n={3} />;
  if (!m.elenco || !atual) return <EmptyState title={tx.t("flair3d.elencos.notFound")} />;
  const grade = gradeDe(m.elenco.vagas);
  const revelado = m.resultado?.ok
    ? {
        edicao: m.resultado.edicao,
        fotos: m.elenco.vagas.filter((v) => m.cartas[v.chave]).map((v) => {
          const card = m.banco.find((c) => c.id === m.cartas[v.chave]);
          return { chave: v.chave, ...posicaoDaVaga(v, grade), url: card?.imageUrl ?? null, nome: card?.name ?? "" };
        }),
      }
    : null;
  return (
    <div className="el-game" data-testid="elenco-game">
      {m.offline && <p className="n3d-offline" role="status">{tx.t("flair3d.ui.offline")}</p>}
      <ElencoJigsaw arte={arteDoElenco(codigo)} nome={tx.elenco(codigo)} estados={estadoDasPecas(m.elenco.linhas, m.cartas, m.conferencia)} revelado={revelado} />
      <ElencoBoard elenco={m.elenco} cartas={m.cartas} banco={m.banco} conf={m.conferencia} selecionada={atual.chave} onVaga={abrir} />
      {gaveta && (
        <ElencoDrawer posicao={atual.posicao} cartas={doDrawer} foco={foco} atual={m.cartas[atual.chave] ?? null}
          onEscolher={(c) => escolher(c.id)} onFechar={() => setGaveta(false)} />
      )}
      <ElencoRequirements requisitos={m.elenco.requisitos} conf={m.conferencia} aberto={requisitos} onToggle={() => disparar({ acao: "VER_OBJETIVO" })} />
      <div className="n3d-pad" role="toolbar" aria-label={tx.t("flair3d.ui.controls.toolbar")}>
        {BOTOES.map((b) => <button key={b.id} type="button" className="n3d-pad-btn" onClick={() => disparar(b.cmd)}>{tx.t(`flair3d.elencos.button.${b.id}`)}</button>)}
      </div>
      <p className="mk-effect">{tx.t("flair3d.elencos.help")}</p>
      {m.erroConferir && <p className="n3d-error" role="alert">{tx.t("flair3d.elencos.checkError", { msg: m.erroConferir.message })}</p>}
      {m.erroEntrega && <p className="n3d-error" role="alert">{tx.t("flair3d.ui.submitError", { msg: m.erroEntrega.message })}</p>}
      <button type="button" className="btn btn-primary n3d-submit" disabled={!pronto} onClick={() => void m.entregar()}>
        {tx.t(m.entregando ? "flair3d.ui.submitting" : "flair3d.elencos.submit")}
      </button>
    </div>
  );
}

export function ElencoScreen({ elenco }: { elenco: string }) {
  const tx = useElencoText();
  const codigo = elencoDaRota(elenco);
  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair/elencos" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{tx.t("flair3d.elencos.back")}</Link>
        <PageHeader title={codigo ? tx.elenco(codigo) : tx.t("flair3d.elencos.title")} kicker={tx.t("flair3d.elencos.kicker")} />
      </div>
      {codigo ? <Elenco key={codigo} codigo={codigo} /> : <EmptyState title={tx.t("flair3d.elencos.notFound")} />}
    </>
  );
}

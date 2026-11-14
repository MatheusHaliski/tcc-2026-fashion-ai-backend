"use client";
/**
 * Tela de um núcleo (/flair/3d/[nucleo]) pelos quatro momentos da partida: deck (núcleos com deck), preparação, ação
 * e resultado, os três últimos dentro do quadro de jogo. Sem resposta da API, a definição do arquivo do núcleo mantém
 * a tela de pé (o servidor continua decidindo a nota).
 */
import { useState } from "react";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, SkeletonGrid, UiIcon } from "@/components/ui";
import { NucleoDeck } from "@/components/flair/nucleos/nucleo-deck";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { useNucleoMatch } from "@/components/flair/nucleos/use-nucleo-match";
import { useNucleoMoments } from "@/components/flair/nucleos/use-nucleo-moments";
import { useNucleoPreview } from "@/components/flair/nucleos/use-nucleo-preview";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { codigoDaRota } from "@/lib/flair/nucleos/registry";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

function Partida({ codigo }: { codigo: NucleoCodigo }) {
  const tx = useNucleoText();
  const m = useNucleoMatch(codigo);
  const d = m.definicao;
  /** cada "jogar de novo" começa uma tela de jogo nova (seleção, câmera e efeitos zerados) */
  const [rodada, setRodada] = useState(0);
  const previa = useNucleoPreview({ partida: m.garantirPartida });
  const jogarDeNovo = () => {
    setRodada((r) => r + 1);
    previa.limpar();
    m.reiniciar();
  };
  const { momento, fimDaAcao, reabrir } = useNucleoMoments({ codigo, semDeck: m.semDeck, precisaDeck: m.precisaDeck, entregue: !!m.resultado });
  /** fim da ação: a partida que segue ABERTA (LABIRINTO) volta à preparação com a tentativa guardada */
  const fim = () => {
    if (m.resultado?.status !== "ABERTA") return fimDaAcao();
    m.retomar();
    reabrir();
  };
  const cabecalho = (
    <div className="flair-section-head">
      <Link href="/flair/3d" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{tx.t("flair3d.ui.back")}</Link>
      <PageHeader title={tx.nome(codigo)} kicker={tx.t("flair3d.ui.number", { n: d.numero })}
        actions={<div className="flex flex-wrap gap-2">{d.recursos.map((r) => <Badge key={r} tone="thread">{tx.t(`flair3d.ui.recurso.${r}`)}</Badge>)}</div>} />
    </div>
  );
  let corpo;
  if (m.carregando || (m.banco.loading && !m.banco.data && d.recursos.includes("CARTAS"))) {
    corpo = <SkeletonGrid n={3} />;
  } else if (m.precisaDeck && d.deck) {
    corpo = <NucleoDeck codigo={codigo} regras={d.deck} cartas={m.todas} entrando={m.entrando} erro={m.erroEntrar} onEntrar={(deck) => void m.entrar(deck)} />;
  } else {
    corpo = (
      <NucleoGame
        key={rodada}
        definicao={d}
        cartas={m.cartasDaPartida}
        momento={momento === "DECK" ? "PREPARACAO" : momento}
        resultado={m.resultado}
        entregando={m.entregando}
        erro={m.erroEntrega}
        previa={previa.previa}
        onPrevia={previa.pedir}
        tentativa={m.tentativa}
        onEntregar={(sel, avatar) => {
          previa.limpar();
          void m.entregar(sel, avatar);
        }}
        onAcionar={(p) => void m.acionar({ cardId: p.cardId, vaga: p.vaga })}
        acionando={m.acionando}
        erroAcionar={m.erroAcionar}
        onFimAcao={fim}
        onAgain={jogarDeNovo}
      />
    );
  }
  const noQuadro = !m.precisaDeck && !m.carregando;
  return (
    <>
      {!noQuadro && cabecalho}
      {m.definicaoErro && <p className="n3d-offline" role="status">{tx.t("flair3d.ui.offline")}</p>}
      {corpo}
    </>
  );
}

export function NucleoScreen({ nucleo }: { nucleo: string }) {
  const tx = useNucleoText();
  const codigo = codigoDaRota(nucleo);
  if (!codigo) {
    return <EmptyState title={tx.t("flair3d.ui.notFound")} action={<Link href="/flair/3d" className="btn btn-sm">{tx.t("flair3d.ui.back")}</Link>} />;
  }
  return <Partida key={codigo} codigo={codigo} />;
}

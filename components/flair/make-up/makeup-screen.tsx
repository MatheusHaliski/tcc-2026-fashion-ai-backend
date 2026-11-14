"use client";
/** Um brief do MAKE UP (/flair/make-up/[brief]): bloqueio por nível (403 do servidor), jogo e resultado com Prestígio. */
import Link from "next/link";
import { EmptyState, PageHeader, SkeletonGrid, UiIcon } from "@/components/ui";
import { MakeUpGame } from "@/components/flair/make-up/makeup-game";
import { MakeUpResult, useBriefText } from "@/components/flair/make-up/makeup-panels";
import { useMakeUpBrief } from "@/components/flair/make-up/use-makeup-brief";
import { briefDaRota } from "@/lib/flair/make-up/briefs";

function Brief({ codigo }: { codigo: string }) {
  const tx = useBriefText();
  const m = useMakeUpBrief(codigo);
  let corpo;
  if (m.carregando) {
    corpo = <SkeletonGrid n={3} />;
  } else if (m.bloqueado) {
    corpo = <EmptyState title={tx.t("flair3d.makeup.locked", { nivel: m.brief.nivelMin })} />;
  } else if (m.resultado) {
    corpo = <MakeUpResult codigo={codigo} resultado={m.resultado} onAgain={m.reiniciar} />;
  } else {
    corpo = <MakeUpGame brief={m.brief} cartas={m.cartas} entregando={m.entregando} erro={m.erro} onEntregar={(sel) => void m.entregar(sel)} />;
  }
  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair/make-up" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{tx.t("flair3d.makeup.back")}</Link>
        <PageHeader title={tx.brief(codigo)} kicker={tx.t("flair3d.makeup.level", { n: m.brief.nivelMin })} />
      </div>
      {m.offline && <p className="n3d-offline" role="status">{tx.t("flair3d.ui.offline")}</p>}
      {corpo}
    </>
  );
}

export function MakeUpScreen({ brief }: { brief: string }) {
  const tx = useBriefText();
  const codigo = briefDaRota(brief);
  if (!codigo) {
    return <EmptyState title={tx.t("flair3d.makeup.notFound")} action={<Link href="/flair/make-up" className="btn btn-sm">{tx.t("flair3d.makeup.back")}</Link>} />;
  }
  return <Brief key={codigo} codigo={codigo} />;
}

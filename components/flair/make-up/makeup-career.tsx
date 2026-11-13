"use client";
/**
 * Carreira do FLAIR 3D MAKE UP (/flair/make-up): nível, Prestígio, progresso até o próximo nível e a lista de briefs
 * com cadeado (nível mínimo) e as melhores estrelas. Sem a API, mostra os briefs da base sem carreira.
 */
import Link from "next/link";
import { cn, PageHeader, UiIcon } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";
import { useBriefText } from "@/components/flair/make-up/makeup-panels";
import { buscarCarreira, listarBriefs } from "@/lib/flair/make-up/api";
import { BRIEFS, rotaDoBrief } from "@/lib/flair/make-up/briefs";
import type { BriefResumo } from "@/lib/flair/make-up/types";

export function MakeUpCareer() {
  const tx = useBriefText();
  const carreira = useApi((signal) => buscarCarreira(signal), []);
  const lista = useApi((signal) => listarBriefs(signal), []);
  const c = carreira.data;
  const briefs: BriefResumo[] = lista.data?.briefs ?? BRIEFS.map((b) => ({ codigo: b.codigo, nivelMin: b.nivelMin, liberado: b.nivelMin <= (c?.nivel ?? 1), melhoresEstrelas: 0 }));
  const total = c ? c.prestigio + c.faltaParaProximo : 0;
  const pct = c && total > 0 ? Math.round((c.prestigio / total) * 100) : 0;
  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{tx.t("flair.hub.back")}</Link>
        <PageHeader title={tx.t("flair3d.makeup.title")} lead={tx.t("flair3d.makeup.lead")} />
      </div>
      {c && (
        <section className="mk-career" aria-label={tx.t("flair3d.makeup.career")} data-testid="makeup-career">
          <p className="mk-level">{tx.t("flair3d.makeup.level", { n: c.nivel })}</p>
          <p>{tx.t("flair3d.makeup.prestige", { n: c.prestigio })}</p>
          <div className="mk-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={tx.t("flair3d.makeup.progress", { n: c.faltaParaProximo })}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="text-muted">{tx.t("flair3d.makeup.progress", { n: c.faltaParaProximo })}</p>
        </section>
      )}
      <ul className="mk-briefs" data-testid="makeup-briefs">
        {briefs.map((b) => {
          const conteudo = (
            <>
              <span className="mk-brief-name">{tx.brief(b.codigo)}</span>
              <span className="text-muted">{tx.t("flair3d.makeup.level", { n: b.nivelMin })}</span>
              <span className="n3d-stars" aria-label={tx.t("flair3d.makeup.best", { n: b.melhoresEstrelas })}>
                {[1, 2, 3].map((i) => <span key={i} className={cn("n3d-star", i <= b.melhoresEstrelas && "is-on")} aria-hidden>★</span>)}
              </span>
              {!b.liberado && <span className="mk-lock">{tx.t("flair3d.makeup.locked", { nivel: b.nivelMin })}</span>}
            </>
          );
          return (
            <li key={b.codigo} className={cn("mk-brief", !b.liberado && "is-locked")}>
              {b.liberado ? <Link href={rotaDoBrief(b.codigo)} className="mk-brief-link">{conteudo}</Link> : <div className="mk-brief-link" aria-disabled="true">{conteudo}</div>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

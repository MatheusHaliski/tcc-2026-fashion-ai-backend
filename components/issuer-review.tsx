"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog, ErrorState, Skeleton, cn } from "@/components/ui";

/**
 * RF1.CA07/CA09 — Painel do examinador: o dono de um perfil de marca/celebridade acompanha a análise do cadastro pelos
 * administradores do FashionAI (enviado → e-mail confirmado → administradores avisados → decisão). Funciona com o perfil
 * ainda pendente (GET /api/me/issuer-review), ao contrário do dashboard do emissor, que só abre depois da aprovação.
 */
export type ReviewStatus = "PENDENTE" | "APROVADO" | "RECUSADO" | "SUSPENSO";
export interface IssuerReview { profileType: "MARCA" | "CELEBRIDADE"; name: string; status: ReviewStatus; submittedAt?: string | null; emailVerified: boolean; adminsNotified: boolean; decidedAt?: string | null; reason?: string | null }

const TONE: Record<ReviewStatus, string> = { PENDENTE: "is-pending", APROVADO: "is-ok", RECUSADO: "is-bad", SUSPENSO: "is-bad" };

export function useIssuerReview(enabled = true) {
  return useApi<IssuerReview>((signal) => api.get("/api/me/issuer-review", { signal }), [], { enabled });
}

export function ReviewPill({ status }: { status: ReviewStatus }) {
  const { t } = useI18n();
  return <span className={cn("review-pill", TONE[status])}>{t(`issuerReview.status.${status}`)}</span>;
}

/** Linha do tempo da análise (também usada inline no /dashboard enquanto o perfil não é aprovado). */
export function IssuerReviewPanel({ data }: { data: IssuerReview }) {
  const { t, fmtDateTime } = useI18n();
  const kind = t(data.profileType === "CELEBRIDADE" ? "issuerReview.tipo_celebridade" : "issuerReview.tipo_marca");
  const decided = data.status !== "PENDENTE";
  const steps: { done: boolean; current?: boolean; bad?: boolean; title: string; body?: React.ReactNode }[] = [
    { done: true, title: t("issuerReview.passo_enviado"), body: data.submittedAt ? fmtDateTime(data.submittedAt) : undefined },
    { done: data.emailVerified, current: !data.emailVerified, title: data.emailVerified ? t("issuerReview.passo_email_ok") : t("issuerReview.passo_email_pendente"),
      body: data.emailVerified ? undefined : <Link href="/verify-email" className="underline">{t("issuerReview.confirmar_email")}</Link> },
    { done: data.adminsNotified || decided, title: t("issuerReview.passo_admins"), body: data.adminsNotified ? t("issuerReview.admins_avisados") : t("issuerReview.admins_fila") },
    { done: decided, current: !decided && data.emailVerified, bad: data.status === "RECUSADO" || data.status === "SUSPENSO",
      title: decided ? t(`issuerReview.decisao.${data.status}`) : t("issuerReview.passo_em_analise"),
      body: decided ? <>{data.decidedAt && <span className="block">{fmtDateTime(data.decidedAt)}</span>}{data.reason && <span className="block">{t("issuerReview.motivo", { v: data.reason })}</span>}</> : t("issuerReview.em_analise_dica") },
  ];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="type-body"><b>{data.name}</b> · {kind}</p>
        <ReviewPill status={data.status} />
      </div>
      <ol className="review-steps">
        {steps.map((s, i) => (
          <li key={i} className={cn(s.done && "is-done", s.current && "is-current", s.bad && "is-bad")} aria-current={s.current ? "step" : undefined}>
            <span className="review-dot" aria-hidden>{s.bad ? "×" : s.done ? "✓" : i + 1}</span>
            <div className="min-w-0"><p className="type-body-sm font-semibold">{s.title}</p>{s.body && <p className="type-caption text-muted">{s.body}</p>}</div>
          </li>
        ))}
      </ol>
      {data.status === "APROVADO" && <Link href="/dashboard" className="btn btn-sm mt-3">{t("issuerReview.abrir_metricas")}</Link>}
      {(data.status === "RECUSADO" || data.status === "SUSPENSO") && <Link href="/settings" className="btn btn-sm mt-3">{t("issuerReview.revisar_cadastro")}</Link>}
    </div>
  );
}

/** Botão do cabeçalho do perfil (só para o dono): mostra o status e abre o painel. */
export function IssuerReviewButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const review = useIssuerReview();
  const status = review.data?.status;
  return (
    <>
      <Button size="sm" onClick={() => { setOpen(true); review.reload(); }} aria-haspopup="dialog">
        {t("issuerReview.painel")}{status && <ReviewPill status={status} />}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("issuerReview.painel")} footer={<Button size="sm" onClick={() => review.reload()} loading={review.loading}>{t("issuerReview.atualizar")}</Button>}>
        {review.error ? <ErrorState error={review.error} onRetry={review.reload} /> : !review.data ? <Skeleton className="h-40" /> : <IssuerReviewPanel data={review.data} />}
      </Dialog>
    </>
  );
}

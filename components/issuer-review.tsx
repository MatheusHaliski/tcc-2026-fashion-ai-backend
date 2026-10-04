"use client";
import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import { Badge, Button, Card, ErrorState, Field, Input, Skeleton, Textarea, cn, useToast } from "@/components/ui";
import { PhotoPicker } from "@/components/photo-picker";

/**
 * Central do emissor (RF1.CA07–CA09): o dono de um perfil de marca ou de celebridade acompanha a verificação
 * (docs/politicas/VERIFICACAO_MARCAS_E_CELEBRIDADES.md) — status e linha do tempo, o que o analista pediu, o reenvio,
 * o código de verificação e os critérios da política com o que o sistema já conferiu. Funciona com o perfil ainda
 * pendente (GET /api/me/issuer-review), ao contrário do dashboard do emissor, que só abre depois da aprovação.
 */
export type ReviewStatus = "PENDENTE" | "AJUSTES" | "APROVADO" | "RECUSADO" | "SUSPENSO";
export type IssuerKind = "MARCA" | "CELEBRIDADE";
/** Resultado da verificação automática: OK (o sistema confirmou), FALHA (bloqueia se obrigatório), ANALISTA (só o analista confirma). */
export type AutoCheck = "OK" | "FALHA" | "ANALISTA";
export interface PolicyCheck { code: string; mandatory: boolean; auto: AutoCheck; detail?: string }
export interface IssuerReview {
  profileType: IssuerKind; name: string; slug?: string; status: ReviewStatus; submittedAt?: string | null; firstSubmittedAt?: string | null;
  attempts: number; maxAttempts: number; canResubmit: boolean; emailVerified: boolean; adminsNotified: boolean; slaBusinessDays: number;
  decidedAt?: string | null; reasons: string[]; notes?: string | null; verificationCode: string; checks: PolicyCheck[]; policyVersion: string;
  editable: { storeUrl?: string | null; commercialContact?: string | null; verificationUrl?: string | null; representationContact?: string | null; hasDocument?: boolean; documentKind?: "identity" | "activity-proof" };
}

const TONE: Record<ReviewStatus, string> = { PENDENTE: "is-pending", AJUSTES: "is-pending", APROVADO: "is-ok", RECUSADO: "is-bad", SUSPENSO: "is-bad" };
const NEGATIVE: ReviewStatus[] = ["AJUSTES", "RECUSADO", "SUSPENSO"];

export function useIssuerReview(enabled = true) {
  return useApi<IssuerReview>((signal) => api.get("/api/me/issuer-review", { signal }), [], { enabled });
}

export function ReviewPill({ status }: { status: ReviewStatus }) {
  const { t } = useI18n();
  return <span className={cn("review-pill", TONE[status])}>{t(`issuerReview.status.${status}`)}</span>;
}

/** Botão do cabeçalho do perfil (só para o dono): leva à aba Central do emissor e mostra o status da verificação. */
export function IssuerCenterButton({ status, onOpen }: { status?: ReviewStatus; onOpen: () => void }) {
  const { t } = useI18n();
  return <Button size="sm" onClick={onOpen}>{t("issuerReview.central")}{status && <ReviewPill status={status} />}</Button>;
}

/** Um critério da política com o que o sistema já conferiu (o resto o analista confere). */
export function PolicyCheckRow({ c, kind, children }: { c: PolicyCheck; kind: IssuerKind; children?: React.ReactNode }) {
  const { t } = useI18n();
  const state = c.auto === "OK" ? "ok" : c.auto === "FALHA" ? (c.mandatory ? "bad" : "warn") : "manual";
  const detail = !c.detail ? null : c.code === "NOTORIEDADE" ? t("issuerPolicy.seguidores_declarados", { n: Number(c.detail) })
    : c.code === "ATIVIDADE_MODA" ? label(c.detail) : c.detail;
  return (
    <li className={cn("policy-check", `is-${state}`)}>
      {children ?? <span className="policy-mark" aria-hidden>{state === "ok" ? "✓" : state === "manual" ? "•" : "!"}</span>}
      <div className="min-w-0">
        <p className="type-body-sm font-semibold">{t(`issuerPolicy.${kind}.${c.code}`)}{" "}
          <span className={cn("policy-tag", c.mandatory && "is-required")}>{c.mandatory ? t("issuerPolicy.obrigatorio") : t("issuerPolicy.complementar")}</span></p>
        <p className="type-caption text-muted">{t(`issuerPolicy.${kind}.${c.code}.dica`)}</p>
        <p className="type-caption policy-state">{t(`issuerPolicy.estado.${state}`)}{detail && <> · {detail}</>}</p>
      </div>
    </li>
  );
}

/** Aba Central do emissor: tudo o que o dono do perfil precisa durante e depois da verificação. */
export function IssuerCenter({ review, onTab }: { review: ReturnType<typeof useIssuerReview>; onTab?: (tab: string) => void }) {
  if (review.error) return <ErrorState error={review.error} onRetry={review.reload} />;
  if (!review.data) return <Skeleton className="h-64" />;
  const d = review.data;
  return (
    <div className="issuer-center">
      <div className="grid min-w-0 content-start gap-4">
        <StatusCard d={d} onReload={review.reload} reloading={review.loading} onTab={onTab} />
        {NEGATIVE.includes(d.status) && <Feedback d={d} />}
        {(d.status === "AJUSTES" || d.status === "RECUSADO") && <Resubmit d={d} onDone={review.reload} />}
        {/* no celular o código vem antes dos critérios (é o que a pessoa precisa fazer); no desktop fica na lateral */}
        {d.status !== "APROVADO" && <div className="lg:hidden"><CodeCard d={d} /></div>}
        <Requirements d={d} />
      </div>
      <aside className="grid min-w-0 content-start gap-4">
        {d.status !== "APROVADO" && <div className="hidden lg:block"><CodeCard d={d} /></div>}
        <RulesCard d={d} />
      </aside>
    </div>
  );
}

function StatusCard({ d, onReload, reloading, onTab }: { d: IssuerReview; onReload: () => void; reloading: boolean; onTab?: (tab: string) => void }) {
  const { t, fmtDateTime } = useI18n();
  const kind = t(d.profileType === "CELEBRIDADE" ? "issuerReview.tipo_celebridade" : "issuerReview.tipo_marca");
  const decided = d.status !== "PENDENTE";
  const steps: { done: boolean; current?: boolean; bad?: boolean; title: string; body?: React.ReactNode }[] = [
    { done: true, title: d.attempts > 1 ? t("issuerReview.passo_reenviado") : t("issuerReview.passo_enviado"), body: d.submittedAt ? fmtDateTime(d.submittedAt) : undefined },
    { done: d.emailVerified, current: !d.emailVerified, title: d.emailVerified ? t("issuerReview.passo_email_ok") : t("issuerReview.passo_email_pendente"),
      body: d.emailVerified ? undefined : <><span className="block">{t("issuerReview.email_antes_da_analise")}</span><Link href="/verify-email" className="underline">{t("issuerReview.confirmar_email")}</Link></> },
    { done: true, title: t("issuerReview.passo_fila"), body: d.adminsNotified ? t("issuerReview.fila_avisados") : t("issuerReview.fila_sem_aviso") },
    { done: d.status === "APROVADO", current: (!decided && d.emailVerified) || d.status === "AJUSTES", bad: d.status === "RECUSADO" || d.status === "SUSPENSO",
      title: decided ? t(`issuerReview.decisao.${d.status}`) : t("issuerReview.passo_em_analise"),
      body: !decided ? t("issuerReview.prazo", { n: d.slaBusinessDays })
        : <>{d.decidedAt && <span className="block">{fmtDateTime(d.decidedAt)}</span>}{d.status === "AJUSTES" && <span className="block">{t("issuerReview.ajustes_dica")}</span>}</> },
  ];
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="type-h3">{t("issuerReview.status_titulo")}</h2>
          <p className="type-body-sm"><b>{d.name}</b> · {kind}<ReviewPill status={d.status} /></p>
          <p className="type-caption text-muted">{t("issuerReview.envio_n_de", { n: d.attempts, max: d.maxAttempts })}</p>
        </div>
        <Button size="sm" onClick={onReload} loading={reloading}>{t("issuerReview.atualizar")}</Button>
      </div>
      <ol className="review-steps">
        {steps.map((s, i) => (
          <li key={i} className={cn(s.done && "is-done", s.current && "is-current", s.bad && "is-bad")} aria-current={s.current ? "step" : undefined}>
            <span className="review-dot" aria-hidden>{s.bad ? "×" : s.done ? "✓" : i + 1}</span>
            <div className="min-w-0"><p className="type-body-sm font-semibold">{s.title}</p>{s.body && <div className="type-caption text-muted">{s.body}</div>}</div>
          </li>
        ))}
      </ol>
      {d.status === "APROVADO" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/dashboard" className="btn btn-sm btn-primary">{t("issuerReview.abrir_dashboard")}</Link>
          {onTab && <><Button size="sm" onClick={() => onTab("SELOS")}>{t("issuerReview.criar_selos")}</Button><Button size="sm" onClick={() => onTab("PROMOCOES")}>{t("issuerReview.promocoes")}</Button><Button size="sm" onClick={() => onTab("METRICAS")}>{t("issuerReview.metricas")}</Button></>}
        </div>
      )}
      {d.status !== "APROVADO" && <p className="mt-4 rounded-md bg-surface-2 p-2 type-caption text-muted">{t("issuerReview.liberado_apos_aprovacao")}</p>}
    </Card>
  );
}

function Feedback({ d }: { d: IssuerReview }) {
  const { t } = useI18n();
  return (
    <Card className="issuer-feedback">
      <h3 className="type-h3">{d.status === "AJUSTES" ? t("issuerReview.o_que_corrigir") : t("issuerReview.motivo_da_decisao")}</h3>
      {d.reasons.length > 0 && <ul className="mt-2 grid gap-1 type-body-sm">{d.reasons.map((r) => <li key={r}>• {t(`issuerPolicy.motivo.${r}`)}</li>)}</ul>}
      {d.notes && <p className="mt-2 type-body-sm"><b>{t("issuerReview.observacao_analista")}</b> {d.notes}</p>}
    </Card>
  );
}

function Resubmit({ d, onDone }: { d: IssuerReview; onDone: () => void }) {
  const { t } = useI18n(); const toast = useToast();
  const celeb = d.profileType === "CELEBRIDADE";
  const [f, setF] = useState({ link: (celeb ? d.editable.verificationUrl : d.editable.storeUrl) ?? "", contact: (celeb ? d.editable.representationContact : d.editable.commercialContact) ?? "", message: "" });
  const [doc, setDoc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<Record<string, string>>({});
  if (!d.canResubmit) return <Card><p className="type-body-sm">{t("issuerReview.limite_atingido", { max: d.maxAttempts })}</p></Card>;
  async function send() {
    setBusy(true); setErr({});
    try {
      await api.post("/api/me/issuer-review/resubmit", { message: f.message || null, documentUrl: doc,
        ...(celeb ? { verificationUrl: f.link || null, representationContact: f.contact || null } : { storeUrl: f.link || null, commercialContact: f.contact || null }) });
      toast.success(t("issuerReview.reenviado")); onDone();
    } catch (e) {
      if (e instanceof ApiError) setErr(Object.fromEntries(Object.entries(e.fields).filter(([, v]) => typeof v === "string")) as Record<string, string>);
      toast.fromError(e);
    } finally { setBusy(false); }
  }
  const linkKey = celeb ? "verificationUrl" : "storeUrl";
  return (
    <Card>
      <h3 className="type-h3">{t("issuerReview.reenviar_titulo")}</h3>
      <p className="mb-3 type-caption text-muted">{t("issuerReview.reenviar_dica", { n: d.maxAttempts - d.attempts })}</p>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label={t(celeb ? "issuerReview.campo_link_oficial" : "issuerReview.campo_site")} id="rs-link" error={err[linkKey]}>
          <Input id="rs-link" type="url" inputMode="url" placeholder="https://" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
        </Field>
        <Field label={t(celeb ? "issuerReview.campo_representante" : "issuerReview.campo_contato")} id="rs-contact">
          <Input id="rs-contact" maxLength={160} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
        </Field>
      </div>
      <PhotoPicker kind={d.editable.documentKind ?? (celeb ? "identity" : "activity-proof")} value={doc} onChange={setDoc} error={err.documentUrl}
        label={t(celeb ? "issuerReview.novo_documento_identidade" : "issuerReview.novo_comprovante")} hint={t("issuerReview.documento_dica")} />
      <Field label={t("issuerReview.mensagem_ao_analista")} id="rs-msg" hint={t("issuerReview.mensagem_dica")}>
        <Textarea id="rs-msg" maxLength={600} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      </Field>
      <Button variant="primary" onClick={send} loading={busy}>{t("issuerReview.reenviar")}</Button>
    </Card>
  );
}

function Requirements({ d }: { d: IssuerReview }) {
  const { t } = useI18n();
  return (
    <Card>
      <h3 className="type-h3">{t("issuerReview.requisitos")}</h3>
      <p className="mb-3 type-caption text-muted">{t("issuerReview.requisitos_dica")}</p>
      <ul className="policy-checks">{d.checks.map((c) => <PolicyCheckRow key={c.code} c={c} kind={d.profileType} />)}</ul>
    </Card>
  );
}

function CodeCard({ d }: { d: IssuerReview }) {
  const { t } = useI18n(); const toast = useToast();
  async function copy() { try { await navigator.clipboard.writeText(d.verificationCode); toast.success(t("issuerReview.codigo_copiado")); } catch { /* sem área de transferência: o código continua visível */ } }
  return (
    <Card>
      <h3 className="type-h3">{t("issuerReview.codigo")}</h3>
      <div className="mt-2 flex items-center gap-2"><code className="issuer-code">{d.verificationCode}</code><Button size="sm" onClick={copy}>{t("issuerReview.copiar")}</Button></div>
      <p className="mt-2 type-caption text-muted">{t(d.profileType === "CELEBRIDADE" ? "issuerReview.codigo_dica_celebridade" : "issuerReview.codigo_dica_marca")}</p>
    </Card>
  );
}

function RulesCard({ d }: { d: IssuerReview }) {
  const { t } = useI18n();
  return (
    <Card>
      <h3 className="type-h3">{t("issuerReview.regras")}</h3>
      <ul className="mt-2 grid gap-2 type-caption text-muted">
        <li>• {t("issuerReview.regra_prazo", { n: d.slaBusinessDays })}</li>
        <li>• {t("issuerReview.regra_envios", { max: d.maxAttempts })}</li>
        <li>• {t("issuerReview.regra_documentos")}</li>
        <li>• {t("issuerReview.regra_aprovacao")}</li>
      </ul>
      <p className="mt-3 type-caption text-faint">{t("issuerReview.versao_politica", { v: d.policyVersion })}</p>
    </Card>
  );
}

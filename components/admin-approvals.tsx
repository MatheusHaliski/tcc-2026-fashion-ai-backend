"use client";
import { useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import { Avatar, Badge, Button, Card, Chip, Dialog, EmptyState, Field, Textarea, cn, useToast } from "@/components/ui";
import { PolicyCheckRow, ReviewPill, type IssuerKind, type PolicyCheck, type ReviewStatus } from "@/components/issuer-review";

/**
 * Fila de verificação de marcas e celebridades (RF1.CA08), pela política (docs/politicas/VERIFICACAO_MARCAS_E_CELEBRIDADES.md):
 * cada pedido é um dossiê — dados do cadastro, verificações automáticas, documentos (abertos um a um e auditados) e a
 * checklist dos critérios. Aprovar exige e-mail confirmado e todos os obrigatórios conferidos; pedir ajustes e recusar
 * exigem ao menos um motivo padronizado. O servidor confere as mesmas regras.
 */
export interface Dossier {
  user: UserCard; kind: IssuerKind; name: string; slug: string; status: ReviewStatus; email: string; emailVerified: boolean; createdAt: string; submittedAt: string; decidedAt?: string | null;
  /** início do prazo: e-mail confirmado (1º envio) ou reenvio; nulo enquanto o e-mail não é confirmado */
  reviewableSince?: string | null;
  attempts: number; ownerMessage?: string | null; lastReasons: string[]; lastNotes?: string | null; verificationCode: string; checks: PolicyCheck[];
  data: Record<string, unknown>; documents: { kind: string; available: boolean }[];
}
export interface ReviewQueue { pending: Dossier[]; waitingOwner: Dossier[]; reasons: string[]; policyVersion: string; slaBusinessDays: number; maxSubmissions: number }

/** Consulta pública do CNPJ na Receita Federal (situação cadastral e razão social). */
const RECEITA_CNPJ = "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp";
const BRAND_FIELDS = ["razaoSocial", "nomeFantasia", "cnpj", "fashionCategory", "storeUrl", "commercialContact", "officialHashtag", "country"];
const CELEB_FIELDS = ["stageName", "realName", "birthDate", "areas", "verificationUrl", "followers", "professionalHistory", "representationContact", "fashionInterests", "sealConsentGranted"];

/** Dias úteis (seg–sex) desde a data: o prazo da política conta dias úteis. */
export function businessDaysSince(iso: string, now = new Date()): number {
  const d = new Date(iso); let n = 0;
  for (const c = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); c <= now; c.setDate(c.getDate() + 1)) if (c.getDay() !== 0 && c.getDay() !== 6) n++;
  return n;
}

export function AdminApprovals({ queue, onChanged }: { queue: ReviewQueue; onChanged: () => void }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4">
      <p className="type-caption text-muted">{t("adminApprovals.intro", { n: queue.slaBusinessDays, v: queue.policyVersion })}</p>
      {queue.pending.length === 0 ? <EmptyState title={t("admin.users.nenhum_perfil_aguardando_validacao")} />
        : queue.pending.map((d) => <DossierCard key={d.user.id} d={d} reasons={queue.reasons} sla={queue.slaBusinessDays} onDecided={onChanged} />)}
      {queue.waitingOwner.length > 0 && (
        <section>
          <h2 className="type-h3 mb-2">{t("adminApprovals.aguardando_solicitante", { n: queue.waitingOwner.length })}</h2>
          <ul className="fai-list surface">{queue.waitingOwner.map((d) => <WaitingRow key={d.user.id} d={d} onDecided={onChanged} />)}</ul>
        </section>
      )}
    </div>
  );
}

function fieldValue(key: string, v: unknown, t: (k: string, a?: Record<string, unknown>) => string): React.ReactNode {
  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return <span className="text-faint">—</span>;
  if (key === "storeUrl" || key === "verificationUrl") return <a href={String(v)} target="_blank" rel="noopener noreferrer nofollow" className="underline break-all">{String(v)}</a>;
  if (key === "cnpj") return <>{String(v)} · <a href={RECEITA_CNPJ} target="_blank" rel="noopener noreferrer" className="underline">{t("adminApprovals.consultar_receita")}</a></>;
  if (key === "fashionCategory") return label(String(v));
  if (key === "sealConsentGranted") return v ? t("adminApprovals.sim") : t("adminApprovals.nao");
  if (key === "followers" && typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, n]) => `${k}: ${n}`).join(" · ") || "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function DossierCard({ d, reasons, sla, onDecided }: { d: Dossier; reasons: string[]; sla: number; onDecided: () => void }) {
  const { t, fmtDateTime } = useI18n(); const toast = useToast();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<string[]>([]); const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [doc, setDoc] = useState<{ url: string; kind: string } | null>(null);
  const waited = d.reviewableSince ? businessDaysSince(d.reviewableSince) : null;   // o prazo só corre com o e-mail confirmado
  const ok = (c: PolicyCheck) => c.auto === "OK" || (c.auto === "ANALISTA" && !!checked[c.code]);
  const openMandatory = d.checks.filter((c) => c.mandatory && !ok(c));
  const canApprove = d.emailVerified && openMandatory.length === 0;
  const canNegative = picked.length > 0 && (!picked.includes("OUTRO") || notes.trim().length > 0);
  const fields = d.kind === "CELEBRIDADE" ? CELEB_FIELDS : BRAND_FIELDS;
  async function decide(decision: "APROVAR" | "AJUSTES" | "RECUSAR") {
    setBusy(decision);
    try {
      await api.post(`/api/admin/approvals/${d.user.id}`, { decision, reasons: decision === "APROVAR" ? [] : picked, notes: notes.trim() || null, checklist: checked });
      toast.success(t(`adminApprovals.feito.${decision}`)); onDecided();
    } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  async function openDoc(kind: string) {
    try { setDoc({ url: await api.blobUrl(`/api/admin/approvals/${d.user.id}/documents/${kind}`), kind }); } catch (e) { toast.fromError(e); }
  }
  function closeDoc() { if (doc) URL.revokeObjectURL(doc.url); setDoc(null); }
  return (
    <Card className="dossier">
      <header className="flex flex-wrap items-start gap-3">
        <Avatar src={mediaUrl(d.user.avatarUrl)} name={d.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="type-h3">{d.name} <ReviewPill status={d.status} /></p>
          <p className="type-caption text-muted"><Link href={`/brands/${d.slug}`} className="underline">@{d.user.username}</Link> · {t(`adminApprovals.tipo.${d.kind}`)} · {t("adminApprovals.envio", { n: d.attempts })} · {fmtDateTime(d.submittedAt)}</p>
        </div>
        <Badge tone={waited != null && waited > sla ? "mark" : "chalk"}>{waited == null ? t("adminApprovals.aguardando_email") : waited > sla ? t("adminApprovals.atrasado", { n: waited }) : t("adminApprovals.aguardando", { n: waited })}</Badge>
      </header>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="label">{t("adminApprovals.dados")}</p>
          <dl className="dossier-fields">
            <dt>{t("adminApprovals.campo.email")}</dt>
            <dd>{d.email} {d.emailVerified ? <Badge tone="thread">{t("adminApprovals.email_confirmado")}</Badge> : <Badge tone="mark">{t("adminApprovals.email_pendente")}</Badge>}</dd>
            {fields.map((k) => <div key={k} className="contents"><dt>{t(`adminApprovals.campo.${k}`)}</dt><dd>{fieldValue(k, d.data[k], t)}</dd></div>)}
          </dl>
          <p className="label mt-3">{t("adminApprovals.documentos")}</p>
          <div className="flex flex-wrap gap-2">
            {d.documents.map((x) => x.available
              ? <Button key={x.kind} size="sm" onClick={() => openDoc(x.kind)}>{t(`adminApprovals.doc.${x.kind}`)}</Button>
              : <span key={x.kind} className="type-caption text-mark">{t("adminApprovals.sem_documento", { doc: t(`adminApprovals.doc.${x.kind}`) })}</span>)}
          </div>
          <p className="mt-3 type-caption text-muted">{t("adminApprovals.codigo", { code: d.verificationCode })}</p>
          {d.ownerMessage && <p className="mt-3 rounded-md bg-surface-2 p-2 type-body-sm"><b>{t("adminApprovals.mensagem_solicitante")}</b> {d.ownerMessage}</p>}
          {d.attempts > 1 && d.lastReasons.length > 0 && <p className="mt-2 type-caption text-muted">{t("adminApprovals.decisao_anterior", { list: d.lastReasons.map((r) => t(`issuerPolicy.motivo.${r}`)).join("; ") })}{d.lastNotes ? ` — ${d.lastNotes}` : ""}</p>}
        </div>
        <div className="min-w-0">
          <p className="label">{t("adminApprovals.checklist")}</p>
          <ul className="policy-checks">
            {d.checks.map((c) => (
              <PolicyCheckRow key={c.code} c={c} kind={d.kind}>
                <input type="checkbox" className="mt-1 h-4 w-4" aria-label={t(`issuerPolicy.${d.kind}.${c.code}`)}
                  checked={c.auto === "OK" || (c.auto === "ANALISTA" && !!checked[c.code])} disabled={c.auto !== "ANALISTA"}
                  onChange={(e) => setChecked((m) => ({ ...m, [c.code]: e.target.checked }))} />
              </PolicyCheckRow>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 border-t border-line-soft pt-3">
        <p className="label">{t("adminApprovals.motivos")}</p>
        <p className="mb-2 type-caption text-muted">{t("adminApprovals.motivos_dica")}</p>
        <div className="flex flex-wrap gap-1.5">{reasons.map((r) => <Chip key={r} active={picked.includes(r)} onClick={() => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]))}>{t(`issuerPolicy.motivo_curto.${r}`)}</Chip>)}</div>
        <Field label={t("adminApprovals.observacao")} id={`notes-${d.user.id}`} hint={t("adminApprovals.observacao_dica")} className="mt-3">
          <Textarea id={`notes-${d.user.id}`} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={!canApprove || !!busy} loading={busy === "APROVAR"} onClick={() => decide("APROVAR")}>{t("common.aprovar")}</Button>
          <Button disabled={!canNegative || !!busy} loading={busy === "AJUSTES"} onClick={() => decide("AJUSTES")}>{t("adminApprovals.pedir_ajustes")}</Button>
          <Button variant="danger" disabled={!canNegative || !!busy} loading={busy === "RECUSAR"} onClick={() => decide("RECUSAR")}>{t("common.rejeitar")}</Button>
          <span className={cn("type-caption", canApprove ? "text-muted" : "text-mark")} aria-live="polite">
            {!d.emailVerified ? t("adminApprovals.bloqueio_email") : openMandatory.length > 0 ? t("adminApprovals.bloqueio_criterios", { n: openMandatory.length }) : t("adminApprovals.pronto_para_aprovar")}
          </span>
        </div>
      </div>
      <Dialog open={!!doc} onClose={closeDoc} size="lg" title={doc ? t(`adminApprovals.doc.${doc.kind}`) : ""}>
        {doc && <img src={doc.url} alt={t(`adminApprovals.doc.${doc.kind}`)} className="mx-auto max-h-[70vh] w-auto rounded" />}
        <p className="mt-2 type-caption text-muted">{t("adminApprovals.doc_privado")}</p>
      </Dialog>
    </Card>
  );
}

/** Pedido com ajustes solicitados: espera a pessoa; sem resposta em 30 dias, o analista pode recusar (política §5). */
function WaitingRow({ d, onDecided }: { d: Dossier; onDecided: () => void }) {
  const { t } = useI18n(); const toast = useToast();
  const days = Math.floor((Date.now() - new Date(d.decidedAt ?? d.submittedAt).getTime()) / 86400000);
  async function expire() {
    try {
      await api.post(`/api/admin/approvals/${d.user.id}`, { decision: "RECUSAR", reasons: d.lastReasons.length ? d.lastReasons : ["DADOS_INCOMPLETOS"], notes: t("adminApprovals.sem_resposta_nota") });
      toast.success(t("adminApprovals.feito.RECUSAR")); onDecided();
    } catch (e) { toast.fromError(e); }
  }
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <Avatar src={mediaUrl(d.user.avatarUrl)} name={d.name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="type-body"><b>{d.name}</b> · @{d.user.username} · {t(`adminApprovals.tipo.${d.kind}`)}</p>
        <p className="type-caption text-muted">{d.lastReasons.map((r) => t(`issuerPolicy.motivo_curto.${r}`)).join(" · ")}</p>
      </div>
      {days >= 30 && <Button size="sm" variant="danger" onClick={expire}>{t("adminApprovals.recusar_sem_resposta")}</Button>}
    </li>
  );
}

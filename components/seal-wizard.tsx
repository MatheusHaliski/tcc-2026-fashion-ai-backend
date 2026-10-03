"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { label } from "@/lib/api/taxonomy";
import { Button, Chip, Field, Input, SegmentPicker, Select, Stepper, useToast } from "@/components/ui";
import { SealCreator } from "@/components/seal-creator";
import { DEFAULT_DESIGN, SEAL_FORMATS, SealFormatPreview, type SealDesign, type SealFormat } from "@/components/seal-medallion";

/**
 * RF25 — Criar Selo em janela segmentada, como o criador de looks (RF5/RF13):
 *  1. Modo — manual ou com IA; com IA abre o Copilot "Definir selo" já com a tag #createsealpolicy;
 *  2. Detalhes — a política do selo (SealPolicy) por seletores, sem campo de texto;
 *  3. Aparência — a arte do selo: formato (circular, folha/selo postal, Fashion AI) e o desenho do medalhão;
 *  4. Revisar & Salvar — prévia, regras que o servidor vai aplicar e o botão salvar.
 */
export type SealPolicy = Record<string, unknown> & {
  tier?: string; name_proposals?: string[]; rationale?: string;
  eligibility?: { min_pieces_from_issuer?: number; min_confidence?: number; collections?: string[] };
  review?: { mode?: string; auto_threshold?: number | null; manual_below?: number | null; sla_hours?: number };
  validity?: { months?: number | null; expires_with_campaign?: boolean };
  quota?: { total?: number | null; per_user?: number; on_exceed?: string };
  promotion?: { promotion_id?: string | null; create?: { type?: string; discount_percent?: number | null; per_user?: number } | null };
  aesthetics?: { format?: string; material?: string };
};
export interface SealWizardValue {
  id?: string; name: string; status: string; design: SealDesign; format: SealFormat; policy: SealPolicy;
  availableFrom: string; availableUntil: string;
}
interface Issue { code: string; message: string; ca?: string; kind?: string }
interface Draft { policy: SealPolicy; status: string; understood: string[]; warnings: Issue[]; blocking: Issue[]; text: string }
interface PromotionOption { id: string; title: string; type?: string }

const TAG = "#createsealpolicy";
const TIERS = ["PECA", "LOOK", "PERFIL"] as const;
const CONFIDENCE = [0.6, 0.72, 0.8, 0.9];
const MONTHS = [3, 6, 12, 24];
const QUOTAS = [100, 300, 500, 1000, 2000, 5000];
const PER_USER = [1, 2, 3, 5];
const PROMO_TYPES = ["DESCONTO_ECOMMERCE", "CUPOM_LOJA", "FRETE_GRATIS", "BRINDE", "ACESSO_ANTECIPADO", "EVENTO"];
const DISCOUNTS = [5, 10, 15, 20, 25, 30, 40, 50];
/** Padrões do doc 06 (P01, P05, P09, P13, P15, P17) como atalhos da janela "Definir selo". */
const EXAMPLES = ["p01", "p05", "p09", "p13", "p15", "p17"] as const;

export function blankPolicy(celebrity: boolean): SealPolicy {
  return {
    tier: "LOOK", eligibility: { min_pieces_from_issuer: 2, min_confidence: 0.72, collections: [] },
    review: { mode: "manual", auto_threshold: null, manual_below: null, sla_hours: 48 }, validity: { months: 12, expires_with_campaign: false },
    quota: { total: celebrity ? 300 : null, per_user: 1, on_exceed: "queue" }, promotion: { promotion_id: null, create: null },
    aesthetics: { format: "CIRCULAR", material: celebrity ? "vidro" : "tecido" }, name_proposals: [],
  };
}

export function SealWizard({ value, onChange, onSave, saving, promotions, premium }: {
  value: SealWizardValue; onChange: (v: SealWizardValue) => void; onSave: () => void; saving?: boolean;
  promotions?: PromotionOption[]; premium?: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const steps = [t("sealWizard.passo_modo"), t("sealWizard.passo_detalhes"), t("sealWizard.passo_aparencia"), t("sealWizard.passo_revisar")];
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"MANUAL" | "IA" | null>(value.id ? "MANUAL" : null);
  const [review, setReview] = useState<Draft | null>(null);
  const p = value.policy;
  const set = (patch: Partial<SealWizardValue>) => onChange({ ...value, ...patch });
  const setPolicy = (patch: SealPolicy) => set({ policy: { ...p, ...patch } });

  // Revisar: o servidor reavalia a política (mensagem vazia não altera nada) e devolve avisos e bloqueios.
  useEffect(() => {
    if (step !== 3) return;
    let alive = true;
    api.post<Draft>("/api/seals/policy/draft", { prompt: "", policy: withFormat(p, value.format) }).then((r) => { if (alive) setReview(r); }).catch((e) => toast.fromError(e));
    return () => { alive = false; };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const names = useMemo(() => {
    const base = [...(p.name_proposals ?? [])];
    const year = new Date().getFullYear();
    for (const n of [t(`sealWizard.nome_${(p.tier ?? "LOOK").toLowerCase()}`, { year }), t("sealWizard.nome_oficial", { year })]) if (!base.includes(n)) base.push(n);
    if (value.name && !base.includes(value.name)) base.unshift(value.name);
    return base;
  }, [p.name_proposals, p.tier, value.name, t]);
  useEffect(() => { if (!value.name && names[0]) set({ name: names[0] }); }, [names[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  const canGo = (i: number) => i === 0 || mode !== null;
  return (
    <div className="grid gap-4">
      <Stepper steps={steps} current={step} onStep={setStep} label={t("sealWizard.etapas")} canGo={canGo} />

      {step === 0 && (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className="seal-mode-tile" aria-pressed={mode === "MANUAL"} onClick={() => setMode("MANUAL")}>
              <b>{t("sealWizard.modo_manual")}</b><span className="type-caption text-muted">{t("sealWizard.modo_manual_dica")}</span>
            </button>
            <button type="button" className="seal-mode-tile" aria-pressed={mode === "IA"} onClick={() => setMode("IA")}>
              <b>{t("sealWizard.modo_ia")}</b><span className="type-caption text-muted">{t("sealWizard.modo_ia_dica", { tag: TAG })}</span>
            </button>
          </div>
          {mode === "IA" && <SealCopilot policy={withFormat(p, value.format)} onPolicy={(np) => { set({ policy: np, format: (np.aesthetics?.format as SealFormat) ?? value.format, name: np.name_proposals?.[0] ?? value.name }); }} onDone={() => setStep(1)} />}
          <div className="flex justify-end"><Button variant="primary" disabled={!mode} onClick={() => setStep(1)}>{t("sealWizard.continuar")}</Button></div>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3">
          <Field label={t("sealWizard.nome")} id="sw-name">
            <Select id="sw-name" value={value.name} onChange={(e) => set({ name: e.target.value })}>{names.map((n) => <option key={n} value={n}>{n}</option>)}</Select>
          </Field>
          <SegmentPicker label={t("sealWizard.nivel")} value={(p.tier ?? "LOOK") as (typeof TIERS)[number]} onChange={(tier) => setPolicy({ tier, eligibility: { ...p.eligibility, min_pieces_from_issuer: tier === "PECA" ? 1 : Math.max(2, p.eligibility?.min_pieces_from_issuer ?? 2) }, ...(tier === "PERFIL" ? { review: { ...p.review, mode: "manual", auto_threshold: null } } : {}) })}
            options={TIERS.map((x) => ({ id: x, label: t(`sealWizard.tier_${x.toLowerCase()}`) }))} />
          <p className="type-caption text-muted">{t(`sealWizard.tier_${(p.tier ?? "LOOK").toLowerCase()}_dica`)}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {p.tier === "LOOK" && <Field label={t("sealWizard.min_pecas")} id="sw-min"><Select id="sw-min" value={String(p.eligibility?.min_pieces_from_issuer ?? 2)} onChange={(e) => setPolicy({ eligibility: { ...p.eligibility, min_pieces_from_issuer: Number(e.target.value) } })}>{[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>}
            {p.tier !== "PERFIL" && <Field label={t("sealWizard.confianca")} id="sw-conf"><Select id="sw-conf" value={String(p.eligibility?.min_confidence ?? 0.72)} onChange={(e) => setPolicy({ eligibility: { ...p.eligibility, min_confidence: Number(e.target.value) } })}>{CONFIDENCE.map((c) => <option key={c} value={c}>{Math.round(c * 100)}%</option>)}</Select></Field>}
            <Field label={t("sealWizard.revisao")} id="sw-review"><Select id="sw-review" value={p.review?.mode ?? "manual"} disabled={p.tier === "PERFIL" || premium} onChange={(e) => setPolicy({ review: { ...p.review, mode: e.target.value, auto_threshold: e.target.value === "manual" ? null : p.review?.auto_threshold ?? 0.85, manual_below: e.target.value === "hybrid" ? p.eligibility?.min_confidence ?? 0.72 : null } })}>{["manual", "hybrid", "auto"].map((m) => <option key={m} value={m}>{t(`sealWizard.revisao_${m}`)}</option>)}</Select></Field>
            {p.review?.mode !== "manual" && p.tier !== "PERFIL" && <Field label={t("sealWizard.auto_acima")} id="sw-auto"><Select id="sw-auto" value={String(p.review?.auto_threshold ?? 0.85)} onChange={(e) => setPolicy({ review: { ...p.review, auto_threshold: Number(e.target.value) } })}>{[0.8, 0.85, 0.9, 0.95].map((c) => <option key={c} value={c}>{Math.round(c * 100)}%</option>)}</Select></Field>}
            <Field label={t("sealWizard.validade")} id="sw-months"><Select id="sw-months" value={String(p.validity?.months ?? 12)} onChange={(e) => setPolicy({ validity: { ...p.validity, months: Number(e.target.value) } })}>{MONTHS.map((m) => <option key={m} value={m}>{t("sealWizard.meses", { n: m })}</option>)}</Select></Field>
            <Field label={t("sealWizard.teto")} id="sw-quota"><Select id="sw-quota" value={p.quota?.total == null ? "" : String(p.quota.total)} onChange={(e) => setPolicy({ quota: { ...p.quota, total: e.target.value ? Number(e.target.value) : null } })}>
              {!(premium || p.tier === "PERFIL") && <option value="">{t("sealWizard.sem_teto")}</option>}{QUOTAS.map((q) => <option key={q} value={q}>{q.toLocaleString()}</option>)}</Select></Field>
            <Field label={t("sealWizard.por_usuario")} id="sw-peruser"><Select id="sw-peruser" value={String(p.quota?.per_user ?? 1)} onChange={(e) => setPolicy({ quota: { ...p.quota, per_user: Number(e.target.value) } })}>{PER_USER.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
            <Field label={t("sealWizard.promocao")} id="sw-promo" hint={t("sealWizard.promocao_dica")}>
              <Select id="sw-promo" value={p.promotion?.promotion_id ? `id:${p.promotion.promotion_id}` : p.promotion?.create?.type ? `new:${p.promotion.create.type}` : ""}
                onChange={(e) => { const v = e.target.value; setPolicy({ promotion: v.startsWith("id:") ? { promotion_id: v.slice(3), create: null } : v.startsWith("new:") ? { promotion_id: null, create: { type: v.slice(4), discount_percent: p.promotion?.create?.discount_percent ?? 15, per_user: 1 } } : { promotion_id: null, create: null } }); }}>
                <option value="">{t("sealWizard.escolha")}</option>
                {(promotions ?? []).length > 0 && <optgroup label={t("sealWizard.promocoes_existentes")}>{(promotions ?? []).map((pr) => <option key={pr.id} value={`id:${pr.id}`}>{pr.title}</option>)}</optgroup>}
                <optgroup label={t("sealWizard.criar_com_o_selo")}>{PROMO_TYPES.map((x) => <option key={x} value={`new:${x}`}>{label(x.toLowerCase())}</option>)}</optgroup>
              </Select>
            </Field>
            {p.promotion?.create && ["DESCONTO_ECOMMERCE", "CUPOM_LOJA"].includes(p.promotion.create.type ?? "") && <Field label={t("sealWizard.desconto")} id="sw-disc"><Select id="sw-disc" value={String(p.promotion.create.discount_percent ?? 15)} onChange={(e) => setPolicy({ promotion: { ...p.promotion, create: { ...p.promotion!.create, discount_percent: Number(e.target.value) } } })}>{DISCOUNTS.map((d) => <option key={d} value={d}>{d}%</option>)}</Select></Field>}
            <Field label={t("common.disponivel_a_partir_de")} id="sw-from" hint={t("common.vazio_imediato")}><Input id="sw-from" type="datetime-local" value={value.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} /></Field>
            <Field label={t("common.expira_em")} id="sw-until" hint={t("common.vazio_sem_expiracao")}><Input id="sw-until" type="datetime-local" value={value.availableUntil} onChange={(e) => set({ availableUntil: e.target.value })} /></Field>
          </div>
          <div className="flex justify-between"><Button onClick={() => setStep(0)}>{t("sealWizard.voltar")}</Button><Button variant="primary" onClick={() => setStep(2)}>{t("sealWizard.continuar")}</Button></div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4">
          <div>
            <p className="label mb-2">{t("sealWizard.formato")}</p>
            <div className="grid grid-cols-3 gap-3">
              {SEAL_FORMATS.map((f) => (
                <button key={f.id} type="button" className="seal-format-tile" aria-pressed={value.format === f.id} onClick={() => set({ format: f.id, policy: { ...p, aesthetics: { ...p.aesthetics, format: f.id } } })}>
                  <img src={f.thumb} alt="" loading="lazy" /><b className="type-caption">{t(`sealWizard.formato_${f.id.toLowerCase()}`)}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
            <div className="grid justify-items-center gap-2"><SealFormatPreview format={value.format} design={value.design} size={160} premium={premium} title={value.name} /><span className="type-caption text-muted">{value.name}</span></div>
            <div><p className="label mb-1">{t("sealWizard.desenho")}</p><SealCreator value={value.design} onChange={(d) => set({ design: d })} premium={premium} /></div>
          </div>
          <div className="flex justify-between"><Button onClick={() => setStep(1)}>{t("sealWizard.voltar")}</Button><Button variant="primary" onClick={() => setStep(3)}>{t("sealWizard.continuar")}</Button></div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[auto,1fr] sm:items-start">
            <SealFormatPreview format={value.format} design={value.design} size={140} premium={premium} title={value.name} />
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 type-body-sm">
              <dt className="text-muted">{t("sealWizard.nome")}</dt><dd>{value.name}</dd>
              <dt className="text-muted">{t("sealWizard.nivel")}</dt><dd>{t(`sealWizard.tier_${(p.tier ?? "LOOK").toLowerCase()}`)}</dd>
              <dt className="text-muted">{t("sealWizard.formato")}</dt><dd>{t(`sealWizard.formato_${value.format.toLowerCase()}`)}</dd>
              <dt className="text-muted">{t("sealWizard.revisao")}</dt><dd>{t(`sealWizard.revisao_${p.review?.mode ?? "manual"}`)}</dd>
              <dt className="text-muted">{t("sealWizard.validade")}</dt><dd>{t("sealWizard.meses", { n: p.validity?.months ?? 12 })}</dd>
              <dt className="text-muted">{t("sealWizard.teto")}</dt><dd>{p.quota?.total ?? t("sealWizard.sem_teto")} · {t("sealWizard.por_usuario_curto", { n: p.quota?.per_user ?? 1 })}</dd>
              {p.rationale && <><dt className="text-muted">{t("sealWizard.copilot")}</dt><dd>{p.rationale}</dd></>}
            </dl>
          </div>
          {review && <IssueList blocking={review.blocking} warnings={review.warnings} />}
          <div className="flex justify-between"><Button onClick={() => setStep(2)}>{t("sealWizard.voltar")}</Button>
            <Button variant="primary" disabled={saving || value.name.trim().length < 2 || (review?.blocking.length ?? 0) > 0} onClick={onSave}>{t("sealWizard.salvar")}</Button></div>
        </div>
      )}
    </div>
  );
}

function withFormat(p: SealPolicy, format: SealFormat): SealPolicy {
  return { ...p, aesthetics: { ...p.aesthetics, format } };
}

function IssueList({ blocking, warnings }: { blocking: Issue[]; warnings: Issue[] }) {
  const { t } = useI18n();
  if (!blocking.length && !warnings.length) return <p className="type-body-sm text-status-good">{t("sealWizard.politica_valida")}</p>;
  return (
    <ul className="grid gap-1 type-body-sm">
      {blocking.map((i) => <li key={i.code} className="tag-fix"><span>{i.message}</span>{i.ca && <span className="type-caption text-muted">{i.ca}</span>}</li>)}
      {warnings.map((i) => <li key={i.code} className="type-caption text-muted">⚠ {i.message}{i.ca ? ` · ${i.ca}` : ""}</li>)}
    </ul>
  );
}

/** Janela "Definir selo" (Copilot com #createsealpolicy): cada mensagem ajusta a política atual. */
function SealCopilot({ policy, onPolicy, onDone }: { policy: SealPolicy; onPolicy: (p: SealPolicy) => void; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [text, setText] = useState(`${TAG} `);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ role: "user" | "copilot"; text: string; draft?: Draft }[]>([{ role: "copilot", text: t("sealWizard.copilot_ola", { tag: TAG }) }]);
  const current = useRef(policy);
  current.current = policy;
  async function send(msg: string) {
    const prompt = msg.includes(TAG) ? msg : `${TAG} ${msg}`;
    if (!prompt.replace(TAG, "").trim()) return;
    setBusy(true);
    setLog((l) => [...l, { role: "user", text: prompt }]);
    try {
      const r = await api.post<Draft>("/api/seals/policy/draft", { prompt, policy: current.current });
      onPolicy(r.policy);
      setLog((l) => [...l, { role: "copilot", text: r.text, draft: r }]);
      setText(`${TAG} `);
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  const last = [...log].reverse().find((m) => m.draft)?.draft;
  return (
    <section className="seal-copilot" aria-label={t("sealWizard.copilot_titulo")}>
      <p className="type-label">{t("sealWizard.copilot_titulo")}</p>
      <div className="grid gap-2" aria-live="polite">
        {log.map((m, i) => <p key={i} className={`seal-copilot-bubble type-body-sm ${m.role === "user" ? "is-user" : ""}`}>{m.text}</p>)}
      </div>
      {last && <IssueList blocking={last.blocking} warnings={last.warnings} />}
      <div className="flex flex-wrap gap-2">{EXAMPLES.map((k) => <Chip key={k} onClick={() => send(t(`sealWizard.exemplo_${k}`))}>{t(`sealWizard.exemplo_${k}_curto`)}</Chip>)}</div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <Input autoFocus aria-label={t("sealWizard.copilot_mensagem")} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
        <Button type="submit" variant="primary" disabled={busy}>{t("sealWizard.enviar")}</Button>
      </form>
      {last && <div className="flex justify-end"><Button variant="primary" onClick={onDone}>{t("sealWizard.usar_politica")}</Button></div>}
    </section>
  );
}

export { DEFAULT_DESIGN };

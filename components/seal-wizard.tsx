"use client";
import { useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Chip, Field, Input, SegmentPicker, Select, Stepper, Textarea, cn, useToast } from "@/components/ui";
import { ELEMENTS, MATERIALS, SealMedallion, sealKind, type SealDesign } from "@/components/seal-medallion";
import { SealCreator } from "@/components/seal-creator";
import { EMPTY_POLICY, cleanPolicy, describePolicy, type SealPolicy, type SealTierId } from "@/components/seal-policy-editor";
import { CIRCULAR_TEMPLATES, FAI_TEMPLATES, FIRST_TEMPLATE, FOLHA_TEMPLATES, FOLHA_TEXT_LIMITS, LABEL_MAX, SEAL_KINDS, folhaTemplate, type FolhaSlotKey, type SealKind } from "@/lib/seals/templates";
import { SealReferencePreview } from "@/components/seal-reference-model";
import { SealCoreEditor } from "@/components/seal-core-editor";

/**
 * Criação exclusivamente pelo Copilot #createsealpolicy: pedido → modelo de referência → arte → revisão.
 * A política só muda em nova rodada do Copilot; os ajustes de apresentação e disponibilidade são independentes.
 */
export interface SealFormState { open: boolean; id?: string; name: string; tier: SealTierId; policyText: string; usageLimit: string; status: string; availableFrom: string; availableUntil: string; design: SealDesign; policy: SealPolicy }
interface Draft { status: "VALID" | "INCOMPLETE"; name: string; tier: SealTierId; policy?: SealPolicy; design: SealDesign; reasons: string[]; questions: string[]; sources: string[] }

/** Desenho como aparece no selo: a folha sem título usa o nome do selo (o backend grava o mesmo ao salvar). */
export function displayDesign(d: SealDesign, name: string): SealDesign {
  return sealKind(d) === "FOLHA" && !d.label?.trim() ? { ...d, label: name.trim().slice(0, LABEL_MAX) || null } : d;
}

export function SealWizard({ form, setForm, premium, brandName, onSave }: { form: SealFormState; setForm: Dispatch<SetStateAction<SealFormState>>; premium?: boolean; brandName?: string | null; onSave: () => Promise<boolean> }) {
  const { t } = useI18n();
  const toast = useToast();
  const editing = !!form.id;
  const [request, setRequest] = useState("");
  const [pendingRequest, setPendingRequest] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [ready, setReady] = useState(!!form.policy.referenceModel);
  const [step, setStep] = useState(editing && form.policy.referenceModel ? 1 : 0);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const steps = [t("sealCopilot.title"), t("sealWizard.passo_dados"), t("sealWizard.passo_arte"), t("sealWizard.passo_revisar")];
  const named = form.name.trim().length >= 2;
  const canGo = (i: number) => !drafting && (i === 0 || ((ready || editing) && (i < 3 || named)));

  async function chooseAi() {
    if (!request.trim()) return;
    const message = pendingRequest ? `${pendingRequest}\n${request.trim()}` : `#createsealpolicy ${request.trim()}`;
    if (message.length > 6000) return;
    setDrafting(true);
    try {
      const d = await api.post<Draft>("/api/copilot/seal-policy", { tier: form.tier, message, previousPolicy: cleanPolicy(form.policy) });
      setReasons(d.reasons ?? []); setQuestions(d.questions ?? []); setSources(d.sources ?? []);
      if (d.status !== "VALID" || !d.policy?.referenceModel) {
        setPendingRequest(message); setRequest(""); setReady(false); return;
      }
      setForm((f) => ({ ...f, name: d.name, tier: d.tier, policy: { ...EMPTY_POLICY, ...d.policy }, design: d.design, policyText: "", usageLimit: d.tier === "PERFIL" ? "" : f.usageLimit }));
      setReady(true); setPendingRequest(""); setRequest(""); setStep(1);
    } catch (e) { toast.fromError(e); } finally { setDrafting(false); }
  }
  async function save() { setSaving(true); try { await onSave(); } finally { setSaving(false); } }

  return (
    <div>
      <Stepper steps={steps} current={step} onStep={setStep} label={t("sealWizard.etapas")} canGo={canGo} />
      <div className="mt-4">
        {step === 0 && (
          <section aria-label={t("sealCopilot.title")}>
            <p className="type-h3">{t("sealCopilot.title")}</p>
            <p className="help mt-2">{t("sealCopilot.hint")}</p>
            <p className="type-caption mt-2">#createsealpolicy</p>
            {brandName && <p className="type-caption">{brandName}</p>}
            {pendingRequest && <p className="type-body-sm mt-2">{pendingRequest}</p>}
            {questions.length > 0 && <ul className="help mt-2" role="status">{questions.map((q) => <li key={q}>{q}</li>)}</ul>}
            <SegmentPicker label={t("sealPolicy.nivel")} value={form.tier} onChange={(tier: SealTierId) => {
              if (drafting) return;
              setForm((f) => ({ ...f, tier })); setReady(false); setQuestions([]); setPendingRequest("");
            }} options={[{ id: "PERFIL", label: t("sealCopilot.profile") }, { id: "PECA", label: t("sealPolicy.nivel_peca") }, { id: "LOOK", label: t("sealPolicy.nivel_look") }]} />
            {form.tier === "PERFIL" && <p className="help mt-2">{t("sealCopilot.profile_hint")}</p>}
            <Field label={t("sealCopilot.request")} id="seal-request" required>
              <Textarea id="seal-request" value={request} maxLength={Math.max(0, 5900 - pendingRequest.length)} disabled={drafting}
                placeholder={t("sealCopilot.example")} onChange={(e) => setRequest(e.target.value)} />
            </Field>
            <Button type="button" variant="primary" loading={drafting} disabled={!request.trim()} onClick={chooseAi}>{t("sealCopilot.generate")}</Button>
            {pendingRequest && <Button type="button" onClick={() => { setPendingRequest(""); setQuestions([]); setRequest(""); }}>{t("sealCopilot.restart")}</Button>}
          </section>
        )}
        {step === 1 && (
          <div>
            {reasons.length > 0 && (
              <div className="seal-ai-note mb-3" role="note">
                <p className="type-body-sm font-semibold">{t("sealCopilot.explanation")}</p>
                <ul className="type-caption">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            )}
            <Field label={t("common.nome")} id="sname" required><Input id="sname" value={form.name} maxLength={160} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <div className="mb-3">
              <p className="label">{t("sealWizard.politica")}</p>
              {form.policy.referenceModel && <SealReferencePreview model={form.policy.referenceModel} />}
              {sources.length > 0 && <div className="mt-2"><p className="label">{t("sealCopilot.sources")}</p><ul className="help">{sources.map((source) => <li key={source}>{source}</li>)}</ul></div>}
              <Button type="button" className="mt-2" onClick={() => setStep(0)}>{t("sealCopilot.adjust")}</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("common.disponivel_a_partir_de")} id="sfrom" hint={t("common.vazio_imediato")}><Input id="sfrom" type="datetime-local" value={form.availableFrom} onChange={(e) => setForm((f) => ({ ...f, availableFrom: e.target.value }))} /></Field>
              <Field label={t("common.expira_em")} id="suntil" hint={t("common.vazio_sem_expiracao")}><Input id="suntil" type="datetime-local" value={form.availableUntil} onChange={(e) => setForm((f) => ({ ...f, availableUntil: e.target.value }))} /></Field>
            </div>
            {form.tier !== "PERFIL" && <Field label={t("brands.slug.limite_de_emissoes")} id="slimit"><Input id="slimit" type="number" min={1} value={form.usageLimit} onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))} /></Field>}
          </div>
        )}
        {step === 2 && <SealArt design={form.design} name={form.name} premium={premium} onChange={(design) => setForm((f) => ({ ...f, design }))} />}
        {step === 3 && <><SealReview form={form} premium={premium} onEdit={setStep} />{form.policy.referenceModel && <SealReferencePreview model={form.policy.referenceModel} />}</>}
      </div>
      <div className="seal-wizard-nav">
        {step > 0 ? <Button type="button" onClick={() => setStep(step - 1)}>{t("common.back")}</Button> : <span />}
        {step < 3 ? (
          <Button type="button" variant="primary" disabled={!canGo(step + 1)} onClick={() => setStep(step + 1)} title={!named && step === 2 ? t("sealWizard.falta_nome") : undefined}>{t("common.next")}</Button>
        ) : (
          <Button type="button" variant="primary" loading={saving} disabled={!named || !ready || drafting} onClick={save}>{t("sealWizard.salvar_selo")}</Button>
        )}
      </div>
    </div>
  );
}

/** Etapa "Arte": tipo do selo e o modelo; a escolha vale para o selo editado (prévia ao vivo e o JSON salvo). */
export function SealArt({ design, name, premium, onChange }: { design: SealDesign; name: string; premium?: boolean; onChange: (d: SealDesign) => void }) {
  const { t } = useI18n();
  const kind = sealKind(design);
  // último modelo usado em cada tipo: trocar de tipo e voltar não perde a escolha
  const last = useRef<Record<SealKind, string>>({ ...FIRST_TEMPLATE, ...(design.template ? { [kind]: design.template } : {}) });
  const circularSource: "TEMPLATE" | "CUSTOM" = kind === "CIRCULAR" && design.mode !== "TEMPLATE" ? "CUSTOM" : "TEMPLATE";
  const shown = displayDesign(design, name);

  function setKind(k: SealKind) {
    if (k === kind) return;
    if (design.template) last.current[kind] = design.template;
    onChange({ ...design, kind: k, mode: "TEMPLATE", template: last.current[k] });
  }
  const pick = (id: string) => { last.current[kind] = id; onChange({ ...design, kind, mode: "TEMPLATE", template: id }); };
  const setElement = (patch: Record<string, unknown>) => onChange({ ...design, element: { ...(design.element ?? {}), ...patch } });
  const kinds = SEAL_KINDS.map((k) => ({ id: k, label: t(`sealWizard.tipo.${k}`) }));
  const elementId = design.element?.id ?? "BAG";
  const elementEditor = (
    <>
      <div className="mb-2 flex flex-wrap gap-2">{ELEMENTS.map((e) => <Chip key={e.id} active={elementId === e.id} onClick={() => setElement({ id: e.id })}>{e.label}</Chip>)}</div>
      <div className="grid grid-cols-3 gap-2">
        {(elementId === "BAG" || elementId === "MONOGRAM") && <Field label={t("sealCreator.texto_ate_3_caracteres")} id="etext"><Input id="etext" value={design.element?.text ?? "FAI"} maxLength={3} onChange={(e) => setElement({ text: e.target.value.toUpperCase().replace(/[^A-Z0-9&+]/g, "") })} /></Field>}
        <Field label={t("sealCreator.material", { lbl: t("sealCreator.elemento") })} id="emat"><Select id="emat" value={design.element?.material ?? "FOSCO"} onChange={(e) => setElement({ material: e.target.value })}>{MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
        <Field label={t("sealCreator.cor", { lbl: t("sealCreator.elemento") })} id="ecor"><input id="ecor" type="color" className="input h-9 w-full p-1" value={design.element?.color ?? "#2B2622"} onChange={(e) => setElement({ color: e.target.value.toUpperCase() })} /></Field>
      </div>
    </>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[224px_1fr]">
      <div className="flex flex-col items-center gap-2">
        <SealMedallion design={shown} size={200} premium={premium} title={t("sealCreator.pre_visualizacao_do_selo")} />
        <div className="flex items-end gap-3 text-center">
          <div><SealMedallion design={shown} size={44} premium={premium} /><p className="type-caption text-muted">{t("sealCreator.card_do_look")}</p></div>
          <div><SealMedallion design={shown} size={36} premium={premium} /><p className="type-caption text-muted">{t("sealCreator.card_da_peca")}</p></div>
        </div>
        <p className="type-caption text-muted text-center">{t(`sealWizard.tipo_dica.${kind}`)}</p>
      </div>
      <div className="min-w-0">
        <p className="label mb-1">{t("sealWizard.tipo_do_selo")}</p>
        <SegmentPicker options={kinds} value={kind} onChange={setKind} label={t("sealWizard.tipo_do_selo")} className="mb-3" />
        {kind === "CIRCULAR" && (
          <>
            <SegmentPicker options={[{ id: "TEMPLATE", label: t("sealWizard.modelos") }, { id: "CUSTOM", label: t("sealWizard.personalizado") }]} value={circularSource} label={t("sealWizard.origem_da_arte")} className="mb-3"
              onChange={(v) => onChange(v === "TEMPLATE" ? { ...design, kind, mode: "TEMPLATE", template: last.current.CIRCULAR } : { ...design, kind, mode: design.uploadUrl ? "UPLOAD" : "GENERATED", template: null })} />
            {circularSource === "CUSTOM" ? <SealCreator value={design} onChange={(d) => onChange({ ...d, kind: "CIRCULAR", template: null })} premium={premium} /> : (
              <>
                <Gallery label={t("sealWizard.modelos_circulares")} items={CIRCULAR_TEMPLATES.map((x) => ({ id: x.id, src: x.src }))} value={design.template} onPick={pick} round />
                <div className="mt-3"><SealCoreEditor design={design} onChange={onChange} elementEditor={elementEditor} /></div>
              </>
            )}
          </>
        )}
        {kind === "FOLHA" && (
          <>
            <Gallery label={t("sealWizard.modelos_folha")} items={FOLHA_TEMPLATES.map((x) => ({ id: x.id, src: x.src }))} value={design.template} onPick={pick} sheet
              render={(id) => <SealMedallion design={{ ...shown, template: id }} size={64} />} />
            <FolhaTexts design={design} name={name} onChange={onChange} />
            <div className="mt-3"><SealCoreEditor design={design} onChange={onChange} folha /></div>
          </>
        )}
        {kind === "FASHIONAI" && <Gallery label={t("sealWizard.modelos_fai")} items={FAI_TEMPLATES.map((x) => ({ id: x.id, src: x.src }))} value={design.template} onPick={pick} round />}
      </div>
    </div>
  );
}

/** Todos os textos da folha escolhida, editáveis; vazio = texto padrão do modelo (título vazio = nome do selo). */
function FolhaTexts({ design, name, onChange }: { design: SealDesign; name: string; onChange: (d: SealDesign) => void }) {
  const { t } = useI18n();
  const tpl = folhaTemplate(design.template);
  if (!tpl) return null;
  const emblemShown = (design.core?.mode ?? "ELEMENT") === "ELEMENT";
  const keys = (["title", "series", "subtitle", "style", "caption", "year", "emblem"] as FolhaSlotKey[]).filter((k) => tpl.slots[k] && (k !== "emblem" || emblemShown));
  const get = (k: FolhaSlotKey) => (k === "title" ? design.label : k === "caption" ? design.caption : design.texts?.[k]) ?? "";
  const set = (k: FolhaSlotKey, v: string) => onChange(k === "title" ? { ...design, label: v } : k === "caption" ? { ...design, caption: v } : { ...design, texts: { ...(design.texts ?? {}), [k]: v } });
  return (
    <fieldset className="mt-3">
      <legend className="label mb-1">{t("sealWizard.textos_da_folha")}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {keys.map((k) => (
          <Field key={k} label={t(`sealWizard.texto.${k}`)} id={`ft-${k}`} hint={t("sealWizard.texto_dica", { n: FOLHA_TEXT_LIMITS[k] })}>
            <Input id={`ft-${k}`} value={get(k)} maxLength={FOLHA_TEXT_LIMITS[k]} placeholder={k === "title" ? name.trim().slice(0, LABEL_MAX) : tpl.slots[k]?.text} onChange={(e) => set(k, e.target.value)} />
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

function Gallery({ label, items, value, onPick, round, sheet, render }: { label: string; items: { id: string; src: string }[]; value?: string | null; onPick: (id: string) => void; round?: boolean; sheet?: boolean; render?: (id: string) => ReactNode }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={label} className={cn("seal-gallery", sheet && "is-sheet")}>
      {items.map((x, i) => (
        <button key={x.id} type="button" role="radio" aria-checked={value === x.id} aria-label={t("sealWizard.modelo_n", { n: i + 1 })} className={cn("seal-gallery-item", value === x.id && "is-active")} onClick={() => onPick(x.id)}>
          {render ? render(x.id) : <img src={x.src} alt="" loading="lazy" className={round ? "rounded-full" : undefined} />}
        </button>
      ))}
    </div>
  );
}

function SealReview({ form, premium, onEdit }: { form: SealFormState; premium?: boolean; onEdit: (step: number) => void }) {
  const { t, fmtDateTime } = useI18n();
  const policy = cleanPolicy(form.policy);
  const kind = sealKind(form.design);
  const shown = displayDesign(form.design, form.name);
  const rows: { k: string; v: React.ReactNode; step: number }[] = [
    { k: t("common.nome"), v: form.name.trim() || <span className="text-muted">{t("sealWizard.falta_nome")}</span>, step: 1 },
    { k: t("sealPolicy.nivel"), v: t(form.tier === "PERFIL" ? "sealCopilot.profile" : form.tier === "PECA" ? "sealPolicy.nivel_peca" : "sealPolicy.nivel_look"), step: 1 },
    { k: t("sealWizard.politica"), v: policy ? describePolicy(policy, form.tier) : form.policyText || t("sealWizard.sem_politica"), step: 1 },
    { k: t("sealWizard.validade"), v: `${form.availableFrom ? fmtDateTime(form.availableFrom) : t("sealWizard.imediato")} → ${form.availableUntil ? fmtDateTime(form.availableUntil) : t("sealWizard.sem_expiracao")}`, step: 1 },
    ...(form.tier === "PERFIL" ? [] : [{ k: t("brands.slug.limite_de_emissoes"), v: form.usageLimit || "∞", step: 1 }]),
    { k: t("sealWizard.tipo_do_selo"), v: t(`sealWizard.tipo.${kind}`), step: 2 },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-[224px_1fr]">
      <div className="flex flex-col items-center gap-2">
        <SealMedallion design={shown} size={200} premium={premium} title={form.name} />
        <div className="flex items-end gap-3"><SealMedallion design={shown} size={44} premium={premium} /><SealMedallion design={shown} size={36} premium={premium} /></div>
      </div>
      <dl className="seal-review">
        {rows.map((r) => (
          <div key={r.k}>
            <dt className="label">{r.k}</dt>
            <dd className="type-body-sm">{r.v} <button type="button" className="link type-caption" onClick={() => onEdit(r.step)}>{t("common.edit")}</button></dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

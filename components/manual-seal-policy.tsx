"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Field, Select, Switch } from "@/components/ui";
import { SealPolicyEditor, cleanPolicy, describePolicy, type SealPolicy, type SealTierId } from "@/components/seal-policy-editor";

/** Explicit profile prerequisites: a disabled switch removes them from the payload. */
export function ManualSealPolicy({ value, onChange, tier, onTier, brandName }: { value: SealPolicy; onChange: (value: SealPolicy) => void; tier: SealTierId; onTier: (tier: SealTierId) => void; brandName?: string | null }) {
  const { t } = useI18n(); const { user } = useAuth();
  const available = useApi<{ id: string; name: string; tier: string; status: string }[]>((signal) => api.get(`/api/users/${user?.id}/seals`, { signal }), [user?.id], { enabled: !!user && tier === "PERFIL" });
  const [target, setTarget] = useState<"PECA" | "LOOK" | "BOTH">(value.referenceModel?.target ?? "BOTH");
  const [required, setRequired] = useState(!!value.referenceModel?.earnedSeals);
  const [sealId, setSealId] = useState(value.referenceModel?.earnedSeals?.rules[0]?.sealId ?? "");
  const emit = (policy: SealPolicy, nextTarget = target, nextRequired = required, nextSeal = sealId) => {
    const base: SealPolicy = { ...policy, generationMode: "MANUAL", referenceModel: undefined, aiInferenceId: undefined };
    if (tier !== "PERFIL") { onChange(base); return; }
    const selected = available.data?.find(s => s.id === nextSeal);
    if (nextRequired && !selected) { onChange(base); return; }
    const description = describePolicy(base, nextTarget === "PECA" ? "PECA" : "LOOK") || t("manualSeal.allEligible");
    onChange({ ...base, referenceModel: { version: 1, tier: "PERFIL", target: nextTarget, title: t("manualSeal.profileTitle"), description, match: base.match,
      minPieces: 1, pieces: (base.rules.length ? base.rules : [{ quantifier: "AT_LEAST" as const, count: 1 }]).map(rule => ({ quantifier: rule.quantifier, count: rule.count ?? 1, ...(rule.color ? { color: rule.color } : {}), ...(rule.brand ? { brand: rule.brand } : {}), ...(rule.category ? { category: rule.category } : {}), ...(rule.subcategory ? { subcategory: rule.subcategory } : {}) })),
      ...(nextRequired && selected ? { earnedSeals: { match: "ALL", rules: [{ sealId: selected.id, name: selected.name, scope: nextTarget === "PECA" ? "PIECES" : "ANY", minCount: 1 }] } } : {}) } });
  };
  return <div className="grid gap-3">
    <Field label={t("sealPolicy.nivel")} id="manual-seal-tier"><Select id="manual-seal-tier" value={tier} onChange={e => onTier(e.target.value as SealTierId)}>{(["PECA", "LOOK", "PERFIL"] as const).map(id => <option key={id} value={id}>{t(id === "PERFIL" ? "sealCopilot.profile" : id === "PECA" ? "sealPolicy.nivel_peca" : "sealPolicy.nivel_look")}</option>)}</Select></Field>
    {tier === "PERFIL" && <>
      <p className="type-body-sm">{t("sealCopilot.profile_hint")}</p>
      <Field label={t("manualSeal.target")} id="manual-seal-target"><Select id="manual-seal-target" value={target} onChange={e => { const next = e.target.value as typeof target; setTarget(next); emit(value, next); }}><option value="PECA">{t("sealPolicy.nivel_peca")}</option><option value="LOOK">{t("sealPolicy.nivel_look")}</option><option value="BOTH">{t("manualSeal.both")}</option></Select></Field>
      <Switch label={t("manualSeal.requireEarned")} checked={required} onChange={next => { setRequired(next); emit(value, target, next); }} />
      {required && <Field label={t("manualSeal.chooseEarned")} id="manual-earned"><Select id="manual-earned" value={sealId} onChange={e => { setSealId(e.target.value); emit(value, target, true, e.target.value); }}><option value="">{t("manualSeal.chooseEarned")}</option>{(available.data ?? []).filter(s => s.tier !== "PERFIL" && s.status === "ACTIVE").map(s => <option key={s.id} value={s.id}>{s.name} · {s.tier}</option>)}</Select>{(available.loading || available.error || !sealId) && <p role="status" className="type-body-sm">{t("manualSeal.earnedNeeded")}</p>}</Field>}
    </>}
    <SealPolicyEditor value={{ ...value, referenceModel: undefined }} onChange={emit} tier={tier === "PERFIL" ? target === "PECA" ? "PECA" : "LOOK" : tier} onTier={next => { if (tier !== "PERFIL") onTier(next); }} brandName={brandName} />
    {!cleanPolicy(value) && <p className="type-body-sm">{t("sealPolicy.sem_regras")}</p>}
  </div>;
}

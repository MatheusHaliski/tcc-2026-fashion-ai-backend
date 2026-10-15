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
  const [sealIds, setSealIds] = useState<string[]>(value.referenceModel?.earnedSeals?.rules.map(rule => rule.sealId) ?? []);
  const [earnedMatch, setEarnedMatch] = useState<"ALL" | "ANY">(value.referenceModel?.earnedSeals?.match ?? "ALL");
  const emit = (policy: SealPolicy, nextTarget = target, nextRequired = required, nextSeals = sealIds, nextMatch = earnedMatch) => {
    const base: SealPolicy = { ...policy, generationMode: "MANUAL", referenceModel: undefined, aiInferenceId: undefined };
    if (tier !== "PERFIL") { onChange(base); return; }

    const description = describePolicy(base, nextTarget === "PECA" ? "PECA" : "LOOK") || t("manualSeal.allEligible");
    onChange({ ...base, referenceModel: { version: 1, tier: "PERFIL", target: nextTarget, title: t("manualSeal.profileTitle"), description, match: base.match,
      minPieces: 1, pieces: (base.rules.length ? base.rules : [{ quantifier: "AT_LEAST" as const, count: 1 }]).map(rule => ({ quantifier: rule.quantifier, count: rule.count ?? 1, ...(rule.color ? { color: rule.color } : {}), ...(rule.brand ? { brand: rule.brand } : {}), ...(rule.category ? { category: rule.category } : {}), ...(rule.subcategory ? { subcategory: rule.subcategory } : {}) })),
      ...(nextRequired ? { earnedSeals: { match: nextMatch, rules: nextSeals.map(id => ({ sealId: id, name: available.data?.find(s => s.id === id)?.name, scope: nextTarget === "PECA" ? "PIECES" as const : "ANY" as const, minCount: 1 })) } } : {}) } });
  };
  return <div className="grid gap-3">
    <Field label={t("sealPolicy.nivel")} id="manual-seal-tier"><Select id="manual-seal-tier" value={tier} onChange={e => onTier(e.target.value as SealTierId)}>{(["PECA", "LOOK", "PERFIL"] as const).map(id => <option key={id} value={id}>{t(id === "PERFIL" ? "sealCopilot.profile" : id === "PECA" ? "sealPolicy.nivel_peca" : "sealPolicy.nivel_look")}</option>)}</Select></Field>
    {tier === "PERFIL" && <>
      <p className="type-body-sm">{t("sealCopilot.profile_hint")}</p>
      <Field label={t("manualSeal.target")} id="manual-seal-target"><Select id="manual-seal-target" value={target} onChange={e => { const next = e.target.value as typeof target; setTarget(next); emit(value, next); }}><option value="PECA">{t("sealPolicy.nivel_peca")}</option><option value="LOOK">{t("sealPolicy.nivel_look")}</option><option value="BOTH">{t("manualSeal.both")}</option></Select></Field>
      <Switch label={t("manualSeal.requireEarned")} checked={required} onChange={next => { setRequired(next); emit(value, target, next); }} />
      {required && <fieldset className="grid gap-2"><legend>{t("manualSeal.chooseEarned")}</legend>
        <Field label={t("profilePolicy.match")} id="manual-earned-match"><Select id="manual-earned-match" value={earnedMatch} onChange={e => { const next = e.target.value as "ALL" | "ANY"; setEarnedMatch(next); emit(value, target, true, sealIds, next); }}><option value="ANY">{t("profilePolicy.any")}</option><option value="ALL">{t("profilePolicy.all")}</option></Select></Field>
        <p className="type-body-sm">{t("profilePolicy.hint")}</p>
        {(available.data ?? []).filter(s => s.tier !== "PERFIL" && s.status === "ACTIVE").map(seal => <label key={seal.id} className="flex items-center gap-2"><input type="checkbox" checked={sealIds.includes(seal.id)} onChange={e => { const next = e.target.checked ? [...sealIds, seal.id] : sealIds.filter(id => id !== seal.id); setSealIds(next); emit(value, target, true, next); }} />{seal.name} · {seal.tier}</label>)}
        {(available.loading || available.error || !sealIds.length) && <p role="status" className="type-body-sm">{t("manualSeal.earnedNeeded")}</p>}
      </fieldset>}
    </>}
    <SealPolicyEditor value={{ ...value, referenceModel: undefined }} onChange={emit} tier={tier === "PERFIL" ? target === "PECA" ? "PECA" : "LOOK" : tier} onTier={next => { if (tier !== "PERFIL") onTier(next); }} brandName={brandName} />
    {!cleanPolicy(value) && <p className="type-body-sm">{t("sealPolicy.sem_regras")}</p>}
  </div>;
}

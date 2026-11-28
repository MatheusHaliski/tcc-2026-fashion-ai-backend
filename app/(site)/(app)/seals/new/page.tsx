"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/app-shell";
import { SealWizard, type SealFormState } from "@/components/seal-wizard";
import { DEFAULT_DESIGN } from "@/components/seal-medallion";
import { cleanPolicy, EMPTY_POLICY } from "@/components/seal-policy-editor";
import { useApi } from "@/lib/hooks/use-api";
import type { DigitalOffer } from "@/components/fai-store/digital-offer";
import { useToast } from "@/components/ui";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { localInputToIso } from "@/lib/seals/availability";

export default function CreateSealPage() {
  return <RequireAuth><Suspense><SealCreator /></Suspense></RequireAuth>;
}

function SealCreator() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const template = useSearchParams().get("template");
  const purchases = useApi<DigitalOffer[]>((signal) => api.get("/api/fai-store/purchases", { signal }), [],
    { enabled: !!template });
  const design = purchases.data?.find((offer) => offer.code === template)?.design;
  const [form, setForm] = useState<SealFormState>({
    open: true, name: "", tier: "LOOK", policyText: "", usageLimit: "", status: "ACTIVE",
    design: DEFAULT_DESIGN, policy: EMPTY_POLICY, availableFrom: "", availableUntil: "",
  });

  useEffect(() => { if (design) setForm((current) => ({ ...current, design })); }, [design]);

  async function save() {
    const policy = cleanPolicy(form.policy);
    try {
      await api.post("/api/seals", {
        name: form.name.trim(), tier: form.tier, policy, policyText: policy ? null : form.policyText || null,
        status: form.status, usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        grantValidityDays: form.grantValidityDays ? Number(form.grantValidityDays) : null,
        availableFrom: localInputToIso(form.availableFrom), availableUntil: localInputToIso(form.availableUntil),
        design: form.design,
      });
      toast.success(t("brands.slug.selo_criado", { name: form.name }));
      router.back();
      return true;
    } catch (error) {
      toast.fromError(error);
      return false;
    }
  }

  return (
    <>
      <h1 className="type-h1 mb-4">{t("brands.slug.novo_selo")}</h1>
      <SealWizard form={form} setForm={setForm} onSave={save} />
    </>
  );
}

"use client";
import { use } from "react";
import { api } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { RequireAuth } from "@/components/app-shell";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { SchemeBuilder } from "@/components/scheme-builder";
import { HypeInline } from "@/components/hype/hype-inline";

export default function EditSchemePage({ params }: { params: Promise<{ id: string }> }) {
  const id = encodeURIComponent(use(params).id);   /* vai direto para caminhos da API: nada de "../" vindo da URL */ const { t } = useI18n();
  const { data, loading, error, reload } = useApi<{ scheme: SchemeView }>((signal) => api.get(`/api/schemes/${id}`, { signal }), [id]);
  return (
    <RequireAuth>
      <PageHeader title={t("scheme.edit")} kicker="RF9" />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <Skeleton className="h-96" />}
      {/* RF53 (P3-08): o look já existe e tem o próprio Hype (sinais do look) — à parte da prévia do editor, que é a média das peças */}
      {data?.scheme && <div className="mb-4 flex flex-wrap items-center gap-2"><span className="label mb-0">{t("hypeBuilder.current_hype")}</span><HypeInline type="SCHEME" id={data.scheme.id} name={data.scheme.title} /></div>}
      {data?.scheme && <SchemeBuilder initial={data.scheme} />}
    </RequireAuth>
  );
}

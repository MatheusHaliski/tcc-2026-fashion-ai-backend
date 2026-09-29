"use client";
import { use } from "react";
import { api } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { RequireAuth } from "@/components/app-shell";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { SchemeBuilder } from "@/components/scheme-builder";

export default function EditSchemePage({ params }: { params: Promise<{ id: string }> }) {
  const id = encodeURIComponent(use(params).id);   /* vai direto para caminhos da API: nada de "../" vindo da URL */ const { t } = useI18n();
  const { data, loading, error, reload } = useApi<{ scheme: SchemeView }>((signal) => api.get(`/api/schemes/${id}`, { signal }), [id]);
  return (
    <RequireAuth>
      <PageHeader title={t("scheme.edit")} kicker="RF9" />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <Skeleton className="h-96" />}
      {data?.scheme && <SchemeBuilder initial={data.scheme} />}
    </RequireAuth>
  );
}

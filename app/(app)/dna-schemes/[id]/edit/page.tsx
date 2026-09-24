"use client";
import { use } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { DnaBuilder } from "@/components/dna-builder";
import type { DnaView } from "@/components/dna-card";

export default function EditDnaSchemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<DnaView>((signal) => api.get(`/api/dna-schemes/${id}`, { signal }), [id]);
  return (
    <RequireAuth>
      <PageHeader title="Editar DNA de estilo" kicker="RF13" />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <Skeleton className="h-96" />}
      {data && <DnaBuilder initial={data} />}
    </RequireAuth>
  );
}

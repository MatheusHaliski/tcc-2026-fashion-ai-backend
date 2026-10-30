"use client";

import { api } from "@/lib/api/client";

import { useAuth } from "@/lib/auth/session";

import { useApi } from "@/lib/hooks/use-api";

import { ErrorState, Skeleton } from "@/components/ui";

import { InteractionBar } from "@/components/interactions";

import { DnaCard, type DnaView } from "@/components/dna-card";

export function ExpandedDna({ id }: { id: string }) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<DnaView>((signal) => api.get(`/api/dna-schemes/${id}`, { signal, anonymous: !user }), [id, !!user]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  return <DnaCard dna={data} expanded extra={<InteractionBar type="DNA_SCHEME" id={data.id ?? id} counters={{ ...data.counters, views: 0, saves: 0, reactions: {} }} viewer={{ liked: false, reactions: [], saved: false, canEdit: data.canEdit, following: false }} ownerId={data.owner.id} onChange={reload} />} />;
}

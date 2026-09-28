"use client";
import { useEffect, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, EmptyState, PageHeader, Skeleton, useToast } from "@/components/ui";

interface Item { id: string; targetType: string; targetId: string; userId?: string; excerpt?: string; categories?: string[]; confidence?: number; createdAt: string; imageUrl?: string; imageEndpoint?: string; upload?: { kind: string; engine: string } }
const KIND: Record<string, string> = { PROFILE_AVATAR: "admin.moderation.kind_avatar", PROFILE_COVER: "admin.moderation.kind_capa", PHOTO: "admin.moderation.kind_foto" };

/** Foto retida pela moderação: fica em restricted/, então só sai pelo endpoint autenticado do admin (nunca por URL pública). */
function HeldImage({ endpoint }: { endpoint: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null; let live = true;
    api.blobUrl(endpoint).then((u) => { url = u; if (live) setSrc(u); else URL.revokeObjectURL(u); }).catch(() => setSrc(null));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [endpoint]);
  return src ? <img src={src} alt="" className="h-24 w-24 rounded object-cover" /> : <div className="h-24 w-24 rounded surface-2" aria-hidden />;
}
function Moderation() {
  const { fmtDateTime, t } = useI18n(); const toast = useToast();
  const { data, loading, reload } = useApi<Item[]>((signal) => api.get("/api/admin/moderation", { signal }), []);
  async function decide(id: string, approve: boolean) { try { await api.post(`/api/admin/moderation/${id}`, { approve, reason: approve ? "" : t("admin.moderation.conteudo_fora_da_politica") }); reload(); } catch (e) { toast.fromError(e); } }
  return (
    <>
      <PageHeader title={t("admin.moderation.fila_de_moderacao")} kicker={t("admin.moderation.admin_rf4_content_moderator")} lead={t("admin.moderation.a_ia_nunca_aprova_por")} />
      {loading ? <Skeleton className="h-40" /> : (data ?? []).length === 0 ? <EmptyState title={t("admin.moderation.fila_vazia")} /> : <ul className="fai-list surface">{(data ?? []).map((m) => <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">{m.imageEndpoint ? <HeldImage endpoint={m.imageEndpoint} /> : m.imageUrl && <img src={mediaUrl(m.imageUrl)} alt="" className="h-16 w-16 rounded object-cover" />}<div className="min-w-0 flex-1"><p className="type-body">{m.upload ? t("admin.moderation.foto_retida") : m.targetType} · <span className="type-data">{m.targetId.slice(0, 8)}</span> · {fmtDateTime(m.createdAt)}</p><p className="type-body-sm text-muted">{m.upload ? t("admin.moderation.foto_retida_origem", { origem: t(KIND[m.upload.kind] ?? KIND.PHOTO), motor: m.upload.engine }) : m.excerpt}</p><div className="mt-1 flex gap-1">{(m.categories ?? []).map((c) => <Badge key={c} tone="mark">{c}</Badge>)}{m.confidence != null && <Badge>{Math.round(m.confidence * 100)}%</Badge>}</div></div><Button size="sm" variant="primary" onClick={() => decide(m.id, true)}>{t("common.aprovar")}</Button><Button size="sm" variant="danger" onClick={() => decide(m.id, false)}>{t("common.rejeitar")}</Button></li>)}</ul>}
    </>
  );
}
export default function ModerationPage() { return <RequireAuth admin><Moderation /></RequireAuth>; }

"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";

import { api } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";

import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";

import { Button, Dialog, ErrorState, Skeleton, useToast } from "@/components/ui";

import { FaiIcon } from "@/components/fai-icon";
import { SchemeCard } from "@/components/scheme-card";

import { MannequinPhotoButton } from "@/components/mannequin-photo";

import { SchemeImprovementDialog } from "@/components/scheme-improvement-dialog";

interface SchemeDetail { scheme: SchemeView; canEdit?: boolean }

export function ExpandedScheme({ id, headerExtra }: { id: string; headerExtra?: ReactNode }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const { data, error, loading, reload } = useApi<SchemeDetail>((signal) => api.get(`/api/schemes/${id}`, { signal, anonymous: !user }), [id, !!user]);
  const [improve, setImprove] = useState(false);
  const [sealSuggest, setSealSuggest] = useState<{ candidates?: { bondId?: string; name: string; kind: string; confidence: number; reason?: string; targetOwnerId: string }[]; message?: string } | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const s = data.scheme; const mine = !!user && s.owner?.id === user.id;
  async function dailyLook() { try { await api.post("/api/me/daily-look", { schemeId: s.id }); toast.success(t("schemes.id.look_do_dia")); reload(); } catch (e) { toast.fromError(e); } }
  async function publish() { try { await api.post(`/api/schemes/${s.id}/publication`, { visibility: "PUBLIC" }); toast.success(t("scheme.published")); reload(); } catch (e) { toast.fromError(e); } }
  // a API devolve "suggestions" (vínculos SUGGESTED); a lista usa nome, tipo, confiança e o porquê de cada um
  async function suggestSeals() {
    try {
      const r = await api.get<{ suggestions?: { id: string; kind: string; confidence: number; justification?: string; target: { id: string; displayName?: string; username: string } }[]; message?: string }>(`/api/schemes/${s.id}/seal-suggestions`);
      setSealSuggest({ message: r.message, candidates: (r.suggestions ?? []).map((x) => ({ bondId: x.id, name: x.target.displayName || x.target.username, kind: x.kind, confidence: Number(x.confidence), reason: x.justification, targetOwnerId: x.target.id })) });
    } catch (e) { toast.fromError(e); }
  }
  async function acceptBond(c: { bondId?: string; targetOwnerId: string }) { try { if (c.bondId) await api.post(`/api/seal-bonds/${c.bondId}/accept`, { imageRightsConsent: true }); else await api.post(`/api/schemes/${s.id}/seal-bonds`, { targetOwnerId: c.targetOwnerId, imageRightsConsent: true }); toast.success(t("schemes.id.vinculo_enviado_para_revisao_da")); setSealSuggest(null); reload(); } catch (e) { toast.fromError(e); } }
  const footer = (
    <>
      {mine && s.status !== "PUBLISHED" && <Button size="sm" variant="primary" onClick={publish}><FaiIcon id="ACT-11" size={20} variant="glyph" decorative />{t("common.publish")}</Button>}
      {mine && !s.lookDoDia && <Button size="sm" onClick={dailyLook}><FaiIcon id="ACT-36" size={20} variant="glyph" decorative />{t("expanded.marcar_look_do_dia")}</Button>}
      {user && <Link href={`/try-on?scheme=${s.id}`} className="btn btn-sm"><FaiIcon id="NAV-07" size={20} variant="glyph" decorative />{t("scheme.tryOn")}</Link>}
      {mine && <Link href={`/schemes/${s.id}/photo`} className="btn btn-sm"><FaiIcon id="NAV-10" size={20} variant="glyph" decorative />{t("pieceDetail.editar_imagem")}</Link>}
      {mine && <MannequinPhotoButton kind="scheme" id={s.id} title={s.title} current={s.mannequinImageUrl} onSaved={reload} />}
      {mine && <Button size="sm" onClick={suggestSeals}><FaiIcon id="ACT-26" size={20} variant="glyph" decorative />{t("schemes.id.suggestSeals")}</Button>}
      {mine && <Button size="sm" onClick={() => setImprove(true)}><FaiIcon id="ACT-09" size={20} variant="glyph" decorative />{t("scheme.improve")}</Button>}
    </>
  );
  return (
    <>
      <SchemeCard scheme={s} href={`/schemes/${s.id}`} expanded footer={footer} headerExtra={headerExtra} />
      {improve && <SchemeImprovementDialog key={s.id} id={s.id} onClose={() => setImprove(false)} onSaved={reload} />}
      <Dialog open={!!sealSuggest} onClose={() => setSealSuggest(null)} title={t("schemes.id.vinculos_de_selo_sugeridos_rf21")}>
        {sealSuggest?.message && <p className="type-body text-muted mb-2">{sealSuggest.message}</p>}
        <div className="grid gap-2">{(sealSuggest?.candidates ?? []).map((c, i) => <div key={i} className="list-row flex items-center gap-3"><div className="flex-1"><p className="type-body"><b>{c.name}</b> <span className="text-faint">· {c.kind === "CELEBRITY" ? t("schemeBuilder.selo_celebridade") : t("schemeBuilder.selo_marca")}</span></p><p className="type-caption text-muted">{t("schemes.id.confianca", { Math: Math.round(c.confidence * 100), value: c.reason ? `· ${c.reason}` : "" })}</p></div><Button size="sm" variant="primary" onClick={() => acceptBond(c)}>{t("schemes.id.vincular")}</Button></div>)}</div>
        {sealSuggest && (sealSuggest.candidates ?? []).length === 0 && <p className="type-body">{t("schemes.id.nenhuma_sugestao_agora_voce_pode")}</p>}
      </Dialog>
    </>
  );
}

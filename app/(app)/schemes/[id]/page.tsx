"use client";
import { SealMedallion } from "@/components/seal-medallion";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, API_BASE, mediaUrl, tokenStore } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { ActionMenu, Badge, Button, Dialog, ErrorState, Field, Input, Skeleton, useToast } from "@/components/ui";
import { toSealBadges, SchemeCard, hypeColor, hypeBand } from "@/components/scheme-card";
import { InteractionBar } from "@/components/interactions";
import { MannequinPhotoButton } from "@/components/mannequin-photo";
import { FaiIcon } from "@/components/fai-icon";
import { BrandLogo } from "@/components/brand-logo";

interface Detail { scheme: SchemeView; seals?: { id: string; name: string; tier?: string; iconUrl?: string; ownerName?: string; status?: string }[]; bonds?: unknown[]; hype?: { hype?: number; band?: { label: string } }; [k: string]: unknown; }

export default function SchemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t, fmtMoney, relative, rich } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const { data, loading, error, reload } = useApi<Detail>((signal) => api.get(`/api/schemes/${id}`, { signal, anonymous: !user }), [id, !!user]);
  const [expanded, setExpanded] = useState(false); const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [improve, setImprove] = useState(false); const [instruction, setInstruction] = useState(""); const [diff, setDiff] = useState<Record<string, unknown> | null>(null); const [busy, setBusy] = useState(false);
  const [sealSuggest, setSealSuggest] = useState<{ candidates?: { bondId?: string; name: string; kind: string; confidence: number; reason?: string; targetOwnerId: string }[]; message?: string } | null>(null);
  const s = data?.scheme; const mine = !!user && s?.owner?.id === user.id;
  useEffect(() => {
    if (!s) return;
    let revoked: string | null = null;
    const url = `${API_BASE}/api/schemes/${s.id}/card.png?expanded=${expanded}`;
    // Logado, sempre via token (a visibilidade efetiva também depende do perfil do dono); visitante usa a URL pública.
    if (tokenStore.access) api.blobUrl(`/api/schemes/${s.id}/card.png?expanded=${expanded}`).then((u) => { revoked = u; setCardUrl(u); }).catch(() => setCardUrl(null));
    else if (s.visibility === "PUBLIC" && s.status === "PUBLISHED") setCardUrl(url);
    else setCardUrl(null);
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [s, expanded]);
  async function post(path: string, body?: unknown, ok?: string) { try { const r = await api.post<Record<string, unknown>>(`/api/schemes/${id}/${path}`, body); if (ok) toast.success(ok); reload(); return r; } catch (e) { toast.fromError(e); } }
  async function askImprove() { setBusy(true); try { setDiff(await api.post(`/api/schemes/${id}/improvements`, { instruction })); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function applyDiff() { if (!diff) return; setBusy(true); try { await api.post(`/api/schemes/${id}/improvements/apply`, diff); toast.success(t("common.saved")); setImprove(false); setDiff(null); reload(); } catch (e) { toast.fromError(e); } finally { setBusy(false); } }
  async function suggestSeals() { try { setSealSuggest(await api.get(`/api/schemes/${id}/seal-suggestions`)); } catch (e) { toast.fromError(e); } }
  async function acceptBond(c: { bondId?: string; targetOwnerId: string }) { try { if (c.bondId) await api.post(`/api/seal-bonds/${c.bondId}/accept`, { imageRightsConsent: true }); else await api.post(`/api/schemes/${id}/seal-bonds`, { targetOwnerId: c.targetOwnerId, imageRightsConsent: true }); toast.success(t("schemes.id.vinculo_enviado_para_revisao_da")); setSealSuggest(null); reload(); } catch (e) { toast.fromError(e); } }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !s) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-96" /><Skeleton className="h-80" /></div>;
  const seals = data?.seals ?? [];
  const badges = toSealBadges(data?.scheme?.sealBadges ?? []);
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <div>
          <SchemeCard scheme={s} href="#" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setExpanded((e) => !e)} aria-pressed={expanded}>{expanded ? t("schemes.id.showCompact") : t("schemes.id.showExpanded")}</Button>
            {cardUrl && <a className="btn btn-sm" href={cardUrl} download={`look-${s.id}.png`}><FaiIcon id="ACT-17" size={20} variant="glyph" decorative />{t("schemes.id.downloadImage")}</a>}
          </div>
          {expanded && cardUrl && <img src={cardUrl} alt={t("schemes.id.card_renderizado", { title: s.title })} className="mt-3 w-full rounded border border-line-soft" />}
        </div>
        <div>
          <p className="type-label text-muted">{s.origin === "AUTOPILOTO" ? t("nav.autopilot") : s.creationMode === "AI_ASSISTED" ? t("schemes.id.composto_com_ia") : t("scheme.manual")} · {relative(s.publishedAt ?? s.createdAt)}</p>
          <h1 className="type-display text-ink">{s.title}</h1>
          <p className="type-body text-muted mt-1">{rich("common.por", { username: s.owner.username }, { 0: ($c) => <Link href={`/u/${s.owner.username}`} className="underline">{$c}</Link> })}{s.remixedFromId && <>{t("schemes.id.remix")}</>}</p>
          {s.description && <p className="type-body mt-3">{s.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1">{[...(s.occasion ?? []), ...(s.style ?? [])].map((x) => <Badge key={x}>{label(x)}</Badge>)}{s.season && <Badge tone="thread">{label(s.season.toLowerCase())}</Badge>}{s.lookDoDia && <Badge tone="chalk">{t("lookbook.daily")}</Badge>}{s.status !== "PUBLISHED" && <Badge>{label(s.status.toLowerCase())}</Badge>}{s.revalidationPending && <Badge tone="mark">{t("schemes.id.selo_em_revalidacao")}</Badge>}</div>
          {s.hypeScore != null && (
            <div className="hype-panel mt-4">
              <span className="hero-number text-4xl" style={{ color: hypeColor(s.hypeScore) }}>{Math.round(s.hypeScore)}</span>
              <div className="min-w-0">
                <p className="font-semibold">{t("hype.label")}{hypeBand(s.hypeScore) && <> · {hypeBand(s.hypeScore) === "hot" ? t("hype.hot") : t("hype.rising")}</>}</p>
                <p className="type-body-sm text-muted">{t("hype.explain")}</p>
              </div>
            </div>
          )}
          <h2 className="type-h3 mt-5 mb-2">{t("scheme.pieces")} ({s.items.length}){s.totalPrice != null && <span className="ml-2 type-data text-muted">{fmtMoney(s.totalPrice, "BRL")}</span>}</h2>
          <ul className="divide-y divide-line-soft surface">
            {s.items.map((it) => (
              <li key={it.wardrobeItemId} className="flex items-center gap-3 p-2">
                <img src={mediaUrl(it.piece?.thumbnailUrl ?? it.piece?.imageUrl ?? (it.imageUrl as string))} alt="" className="h-12 w-12 rounded bg-surface-2 object-contain" />
                <div className="min-w-0 flex-1"><p className="truncate type-body">{it.piece?.name ?? (it.name as string) ?? it.slot}</p><p className="flex items-center gap-1.5 type-caption text-muted">{label(it.slot.toLowerCase())} · {it.piece?.brandName ? <BrandLogo name={it.piece.brandName} src={it.piece.brandLogoUrl} size={18} withName /> : label(it.piece?.subcategory)}{it.piece?.notAvailableAnymore && t("common.indisponivel")}</p></div>
                <Link href={`/pieces/${it.wardrobeItemId}?fromScheme=${s.id}`} className="btn btn-sm">{t("common.see")}</Link>
              </li>
            ))}
          </ul>
          {(badges.length > 0 || seals.length > 0) && <div className="mt-4"><p className="label">{t("schemes.id.selos")}</p>{badges.length > 0 && <div className="mb-2 flex flex-wrap items-center gap-3">{badges.map((b, i) => <span key={i} className="flex items-center gap-2"><SealMedallion design={b.design} size={56} premium={b.premium} title={b.name ?? b.label} /><span className="type-body-sm"><b>{b.name ?? b.label}</b><br /><span className="text-muted">@{b.owner} · {b.tier}</span></span></span>)}</div>}<div className="flex flex-wrap gap-2">{seals.map((sl) => <span key={sl.id} className="chip">{sl.iconUrl && <img src={mediaUrl(sl.iconUrl)} alt="" className="h-5 w-5" />}{sl.name}{sl.status && sl.status !== "APPROVED" && <span className="text-faint"> · {label(sl.status.toLowerCase())}</span>}</span>)}</div></div>}
          <div className="mt-4 flex flex-wrap gap-2">
            {mine && (
              <>
                {s.status !== "PUBLISHED"
                  ? <Button variant="primary" onClick={() => post("publication", { visibility: "PUBLIC" }, t("scheme.published"))}><FaiIcon id="ACT-11" size={20} variant="glyph" decorative />{t("common.publish")}</Button>
                  : <Link href={`/schemes/${s.id}/edit`} className="btn btn-primary"><FaiIcon id="SOC-11" size={20} variant="glyph" decorative />{t("common.edit")}</Link>}
                {s.status !== "PUBLISHED" && <Link href={`/schemes/${s.id}/edit`} className="btn"><FaiIcon id="SOC-11" size={20} variant="glyph" decorative />{t("common.edit")}</Link>}
                <Link href={`/try-on?scheme=${s.id}`} className="btn"><FaiIcon id="NAV-07" size={20} variant="glyph" decorative />{t("scheme.tryOn")}</Link>
                <MannequinPhotoButton kind="scheme" id={s.id} title={s.title} current={s.mannequinImageUrl} onSaved={reload} />
                <ActionMenu label={t("common.moreOptions")} items={[
                  { label: t("scheme.improve"), onSelect: () => setImprove(true), icon: <FaiIcon id="ACT-09" size={20} variant="glyph" decorative /> },
                  { label: t("schemes.id.markFavorite"), onSelect: () => { post("flags", { favorite: true }, t("schemes.id.markedFavorite")); }, icon: <FaiIcon id="SOC-06" size={20} variant="glyph" decorative /> },
                  { label: t("scheme.dailyLook"), hidden: !!s.lookDoDia, onSelect: async () => { try { await api.post("/api/me/daily-look", { schemeId: s.id }); toast.success(t("schemes.id.look_do_dia")); reload(); } catch (e) { toast.fromError(e); } }, icon: <FaiIcon id="ACT-36" size={20} variant="glyph" decorative /> },
                  { label: t("schemes.id.suggestSeals"), onSelect: suggestSeals, icon: <FaiIcon id="ACT-26" size={20} variant="glyph" decorative /> },
                  { label: t("scheme.archive"), danger: true, onSelect: () => setConfirmArchive(true) },
                ]} />
              </>
            )}
          </div>
          <div className="mt-4"><InteractionBar type="SCHEME" id={s.id} counters={s.counters} viewer={s.viewer} ownerId={s.owner.id} onChange={reload} title={s.title} /></div>
        </div>
      </div>
      <Dialog open={improve} onClose={() => setImprove(false)} title={t("scheme.improve")} footer={diff ? <><Button onClick={() => setDiff(null)}>{t("common.cancel")}</Button><Button variant="primary" onClick={applyDiff} loading={busy}>{t("dashboard.apply")}</Button></> : <Button variant="primary" onClick={askImprove} loading={busy} disabled={!instruction.trim()}>{t("scheme.generate")}</Button>}>
        {!diff ? <Field label={t("scheme.instruction")} id="instruction"><Input id="instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={t("schemes.id.ex_deixe_mais_formal_trocando")} /></Field>
          : <div className="type-body"><p className="mb-2 text-muted">{String(diff.message ?? diff.explanation ?? t("schemes.id.mudancas_propostas"))}</p><ChangeList value={diff.diff ?? diff.changes ?? diff} /></div>}
      </Dialog>
      <Dialog open={!!sealSuggest} onClose={() => setSealSuggest(null)} title={t("schemes.id.vinculos_de_selo_sugeridos_rf21")}>
        {sealSuggest?.message && <p className="type-body text-muted mb-2">{sealSuggest.message}</p>}
        <ul className="divide-y divide-line-soft">{(sealSuggest?.candidates ?? []).map((c, i) => <li key={i} className="flex items-center gap-3 py-2"><div className="flex-1"><p className="type-body"><b>{c.name}</b> <span className="text-faint">· {c.kind}</span></p><p className="type-caption text-muted">{t("schemes.id.confianca", { Math: Math.round(c.confidence * 100), value: c.reason ? `· ${c.reason}` : "" })}</p></div><Button size="sm" variant="primary" onClick={() => acceptBond(c)}>{t("schemes.id.vincular")}</Button></li>)}</ul>
        {sealSuggest && (sealSuggest.candidates ?? []).length === 0 && <p className="type-body">{t("schemes.id.nenhuma_sugestao_agora_voce_pode")}</p>}
      </Dialog>
      <Dialog open={confirmArchive} onClose={() => setConfirmArchive(false)} title={t("schemes.id.archiveTitle")}
        footer={<><Button onClick={() => setConfirmArchive(false)}>{t("common.cancel")}</Button><Button variant="danger" onClick={async () => { setConfirmArchive(false); await post("archive", undefined, t("schemes.id.archived")); router.push("/lookbook"); }}>{t("scheme.archive")}</Button></>}>
        <p className="type-body">{t("schemes.id.archiveBody")}</p>
      </Dialog>
    </>
  );
}

/** Mostra as mudanças propostas pela IA como lista legível (campo → valor), em vez de JSON cru. */
function ChangeList({ value }: { value: unknown }) {
  const rows: [string, string][] = [];
  const text = (v: unknown): string => v == null ? "—" : typeof v === "object" ? (Array.isArray(v) ? v.map(text).join(", ") : Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${text(x)}`).join(" · ")) : String(v);
  if (Array.isArray(value)) value.forEach((v, i) => rows.push([String(i + 1), text(v)]));
  else if (value && typeof value === "object") Object.entries(value as Record<string, unknown>).filter(([k]) => !["message", "explanation"].includes(k)).forEach(([k, v]) => rows.push([k, text(v)]));
  else rows.push(["", text(value)]);
  return <dl className="change-list">{rows.map(([k, v], i) => <div key={i}>{k && <dt>{k}</dt>}<dd>{v}</dd></div>)}</dl>;
}

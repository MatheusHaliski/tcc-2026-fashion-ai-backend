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
import { Badge, Button, Card, Dialog, ErrorState, Field, Input, Skeleton, useToast } from "@/components/ui";
import { toSealBadges, SchemeCard, hypeColor } from "@/components/scheme-card";
import { InteractionBar } from "@/components/interactions";
import { MannequinPhotoButton } from "@/components/mannequin-photo";
import { FaiIcon } from "@/components/fai-icon";
import { BrandLogo } from "@/components/brand-logo";

interface Detail { scheme: SchemeView; seals?: { id: string; name: string; tier?: string; iconUrl?: string; ownerName?: string; status?: string }[]; bonds?: unknown[]; hype?: { hype?: number; band?: { label: string } }; [k: string]: unknown; }

export default function SchemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t, fmtMoney, relative } = useI18n(); const { user } = useAuth(); const toast = useToast(); const router = useRouter();
  const { data, loading, error, reload } = useApi<Detail>((signal) => api.get(`/api/schemes/${id}`, { signal, anonymous: !user }), [id, !!user]);
  const [expanded, setExpanded] = useState(false); const [cardUrl, setCardUrl] = useState<string | null>(null);
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
  async function acceptBond(c: { bondId?: string; targetOwnerId: string }) { try { if (c.bondId) await api.post(`/api/seal-bonds/${c.bondId}/accept`, { imageRightsConsent: true }); else await api.post(`/api/schemes/${id}/seal-bonds`, { targetOwnerId: c.targetOwnerId, imageRightsConsent: true }); toast.success("Vínculo enviado para revisão da marca."); setSealSuggest(null); reload(); } catch (e) { toast.fromError(e); } }
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
            <Button size="sm" onClick={() => setExpanded((e) => !e)} aria-pressed={expanded}>{t("scheme.card")} {expanded ? "compacto" : "ampliado"}</Button>
            {cardUrl && <a className="btn btn-sm" href={cardUrl} download={`look-${s.id}.png`}><FaiIcon id="ACT-17" size={24} decorative />PNG</a>}
          </div>
          {cardUrl && <img src={cardUrl} alt={`card renderizado: ${s.title}`} className="mt-3 rounded border border-line-soft" />}
        </div>
        <div>
          <p className="type-label text-muted">{s.origin === "AUTOPILOTO" ? "Autopiloto" : s.creationMode === "AI" ? "Composto com IA" : "Manual"} · {relative(s.publishedAt ?? s.createdAt)}</p>
          <h1 className="type-display text-ink">{s.title}</h1>
          <p className="type-body text-muted mt-1">por <Link href={`/u/${s.owner.username}`} className="underline">@{s.owner.username}</Link>{s.remixedFromId && <> · remix</>}</p>
          {s.description && <p className="type-body mt-3">{s.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1">{[...(s.occasion ?? []), ...(s.style ?? [])].map((x) => <Badge key={x}>{label(x)}</Badge>)}{s.season && <Badge tone="thread">{label(s.season.toLowerCase())}</Badge>}{s.lookDoDia && <Badge tone="chalk">Look do Dia</Badge>}{s.status !== "PUBLISHED" && <Badge>{label(s.status.toLowerCase())}</Badge>}{s.revalidationPending && <Badge tone="mark">selo em revalidação</Badge>}</div>
          {s.hypeScore != null && <div className="mt-3 flex items-center gap-3"><span className="hero-number text-4xl" style={{ color: hypeColor(s.hypeScore) }}>{Math.round(s.hypeScore)}</span><div><p className="label">Hype Score</p><p className="type-caption text-muted">{data?.hype?.band?.label ?? ""} · global {s.hypeScoreGlobal != null ? Math.round(s.hypeScoreGlobal) : "—"}</p></div></div>}
          <h2 className="type-h3 mt-5 mb-2">{t("scheme.pieces")} ({s.items.length}){s.totalPrice != null && <span className="ml-2 type-data text-muted">{fmtMoney(s.totalPrice, "BRL")}</span>}</h2>
          <ul className="divide-y divide-line-soft surface">
            {s.items.map((it) => (
              <li key={it.wardrobeItemId} className="flex items-center gap-3 p-2">
                <img src={mediaUrl(it.piece?.thumbnailUrl ?? it.piece?.imageUrl ?? (it.imageUrl as string))} alt="" className="h-12 w-12 rounded bg-surface-2 object-contain" />
                <div className="min-w-0 flex-1"><p className="truncate type-body">{it.piece?.name ?? (it.name as string) ?? it.slot}</p><p className="flex items-center gap-1.5 type-caption text-muted">{label(it.slot.toLowerCase())} · {it.piece?.brandName ? <BrandLogo name={it.piece.brandName} src={it.piece.brandLogoUrl} size={18} withName /> : label(it.piece?.subcategory)}{it.piece?.notAvailableAnymore && " · indisponível"}</p></div>
                <Link href={`/pieces/${it.wardrobeItemId}?fromScheme=${s.id}`} className="btn btn-sm">{t("common.see")}</Link>
              </li>
            ))}
          </ul>
          {(badges.length > 0 || seals.length > 0) && <div className="mt-4"><p className="label">Selos</p>{badges.length > 0 && <div className="mb-2 flex flex-wrap items-center gap-3">{badges.map((b, i) => <span key={i} className="flex items-center gap-2"><SealMedallion design={b.design} size={56} premium={b.premium} title={b.name ?? b.label} /><span className="type-body-sm"><b>{b.name ?? b.label}</b><br /><span className="text-muted">@{b.owner} · {b.tier}</span></span></span>)}</div>}<div className="flex flex-wrap gap-2">{seals.map((sl) => <span key={sl.id} className="chip">{sl.iconUrl && <img src={mediaUrl(sl.iconUrl)} alt="" className="h-5 w-5" />}{sl.name}{sl.status && sl.status !== "APPROVED" && <span className="text-faint"> · {label(sl.status.toLowerCase())}</span>}</span>)}</div></div>}
          <div className="mt-4 flex flex-wrap gap-2">
            {mine && (
              <>
                <Link href={`/schemes/${s.id}/edit`} className="btn"><FaiIcon id="SOC-11" size={24} decorative />{t("common.edit")}</Link>
                {s.status !== "PUBLISHED" && <Button variant="accent" onClick={() => post("publication", { visibility: "PUBLIC" }, t("scheme.published"))}><FaiIcon id="ACT-11" size={24} decorative />{t("common.publish")}</Button>}
                <Button onClick={() => setImprove(true)}><FaiIcon id="ACT-09" size={24} decorative />{t("scheme.improve")}</Button>
                <Button onClick={() => post("flags", { favorite: true }, t("common.saved"))}>{t("common.favorite")}</Button>
                {!s.lookDoDia && <Button onClick={async () => { try { await api.post("/api/me/daily-look", { schemeId: s.id }); toast.success("Look do Dia ✓"); reload(); } catch (e) { toast.fromError(e); } }}>{t("scheme.dailyLook")}</Button>}
                <Button onClick={suggestSeals}><FaiIcon id="ACT-26" size={24} decorative />Selos</Button>
                <Link href={`/try-on?scheme=${s.id}`} className="btn"><FaiIcon id="NAV-07" size={24} decorative />{t("scheme.tryOn")}</Link>
                <MannequinPhotoButton kind="scheme" id={s.id} title={s.title} current={s.mannequinImageUrl} onSaved={reload} />
                <Button variant="danger" onClick={async () => { await post("archive", undefined, t("scheme.archive") + " ✓"); router.push("/lookbook"); }}>{t("scheme.archive")}</Button>
              </>
            )}
          </div>
          <div className="mt-4"><InteractionBar type="SCHEME" id={s.id} counters={s.counters} viewer={s.viewer} ownerId={s.owner.id} onChange={reload} title={s.title} /></div>
        </div>
      </div>
      <Dialog open={improve} onClose={() => setImprove(false)} title={t("scheme.improve")} footer={diff ? <><Button onClick={() => setDiff(null)}>{t("common.cancel")}</Button><Button variant="primary" onClick={applyDiff} loading={busy}>Aplicar</Button></> : <Button variant="primary" onClick={askImprove} loading={busy} disabled={!instruction.trim()}>{t("scheme.generate")}</Button>}>
        {!diff ? <Field label={t("scheme.instruction")} id="instruction"><Input id="instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="ex.: deixe mais formal trocando o calçado" /></Field>
          : <div className="type-body"><p className="mb-2 text-muted">{String(diff.message ?? diff.explanation ?? "Mudanças propostas:")}</p><pre className="max-h-64 overflow-auto rounded bg-surface-2 p-2 type-caption">{JSON.stringify(diff.diff ?? diff.changes ?? diff, null, 2)}</pre></div>}
      </Dialog>
      <Dialog open={!!sealSuggest} onClose={() => setSealSuggest(null)} title="Vínculos de selo sugeridos (RF21)">
        {sealSuggest?.message && <p className="type-body text-muted mb-2">{sealSuggest.message}</p>}
        <ul className="divide-y divide-line-soft">{(sealSuggest?.candidates ?? []).map((c, i) => <li key={i} className="flex items-center gap-3 py-2"><div className="flex-1"><p className="type-body"><b>{c.name}</b> <span className="text-faint">· {c.kind}</span></p><p className="type-caption text-muted">confiança {Math.round(c.confidence * 100)}% {c.reason ? `· ${c.reason}` : ""}</p></div><Button size="sm" variant="primary" onClick={() => acceptBond(c)}>Vincular</Button></li>)}</ul>
        {sealSuggest && (sealSuggest.candidates ?? []).length === 0 && <p className="type-body">Nenhuma sugestão agora. Você pode vincular manualmente pelo perfil da marca.</p>}
      </Dialog>
      <Card className="mt-6 hidden"><p>{t("common.loading")}</p></Card>
    </>
  );
}

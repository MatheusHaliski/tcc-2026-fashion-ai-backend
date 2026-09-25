"use client";
import { useEffect, use, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView, SchemeView, UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Avatar, Badge, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, SkeletonGrid, Tabs, Textarea, useToast } from "@/components/ui";
import { SchemeCard, toSealBadges } from "@/components/scheme-card";
import { SealCreator } from "@/components/seal-creator";
import { DEFAULT_DESIGN, SealMedallion, type SealDesign } from "@/components/seal-medallion";
import { PieceCard } from "@/components/piece-card";
import { BrandFlairTab } from "@/components/flair/brand-flair-tab";
import { BrandCouponsTab, BRAND_PROMO_TYPES, CELEB_PROMO_TYPES } from "@/components/coupons/brand-coupons-tab";
import { FaiIcon } from "@/components/fai-icon";
import { BrandLogo } from "@/components/brand-logo";
import { ProfileHeader } from "@/components/profile-header";
import { CollectionsTab, ErasTab } from "@/components/showcase/showcase-tabs";
import { WardrobeCreatorTab } from "@/components/room3d/wardrobe-creator";
import { RoomStore } from "@/components/room3d/room-store";

interface Seal { id: string; name: string; tier: string; policyText?: string; iconUrl?: string; status: string; available?: boolean; unavailableReason?: string | null; usageCount?: number; usageLimit?: number | null; premium?: boolean; availableFrom?: string | null; availableUntil?: string | null; design?: SealDesign | null; }
interface Promotion { id: string; type: string; title: string; description?: string; rules?: string; discountPercent?: number; status: string; eligible?: boolean; requiredSealId?: string; redemptions?: number; }
interface Profile { user?: UserCard; brand?: Record<string, unknown>; celebrity?: Record<string, unknown>; header: { userId?: string; username?: string; name?: string; slug?: string; logoUrl?: string | null; avatarUrl?: string | null; userAvatarUrl?: string | null; coverUrl?: string | null; bio?: string | null; storeUrl?: string | null; status?: string; kind?: string; profileType?: string; verified?: boolean; premium?: boolean; category?: string | null; followers?: number; following: number; pieces?: number; schemes?: number; activeSeals: number; viewerFollows: boolean; metrics?: Record<string, number> }; mode?: string; tabs?: ({ id: string; label: string; adminOnly?: boolean } | string)[]; admin?: boolean; store?: { url?: string; hashtag?: string }; [k: string]: unknown; }
const TIERS = ["LOOK", "PECA", "PERFIL"];

export default function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params); const { t, fmtDate, rich } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Profile>((signal) => api.get(`/api/institutional/${encodeURIComponent(slug)}`, { signal, anonymous: !user }), [slug, !!user]);
  const [tab, setTab] = useState("ESQUEMAS_DESTAQUE"); const [flairNew, setFlairNew] = useState(0);
  useEffect(() => { const q = new URLSearchParams(window.location.search).get("tab"); if (q) setTab(q.toUpperCase()); }, []);
  const ownerId = data?.header?.userId ?? data?.user?.id;
  const seals = useApi<Seal[]>((signal) => api.get(`/api/users/${ownerId}/seals`, { signal, anonymous: !user }), [ownerId, !!user], { enabled: !!ownerId });
  const promos = useApi<Promotion[]>((signal) => api.get(`/api/users/${ownerId}/promotions`, { signal, anonymous: !user }), [ownerId, !!user], { enabled: !!ownerId });
  type SealBadgeSource = NonNullable<Parameters<typeof toSealBadges>[0]>[number];
  type HighlightedPieces = { piece: PieceView; author?: UserCard; schemeId?: string; schemeTitle?: string; seals?: SealBadgeSource[] }[];
  type SavedSchemes = { scheme: SchemeView; author?: UserCard; savedAt?: string }[];
  type SavedPieces = { piece: PieceView; author?: UserCard; snapshot?: boolean; savedAt?: string }[];
  type Catalog = { piece: PieceView; looks: number; neverInLook: boolean }[];
  type Consecrated = { scheme: SchemeView; seals: SealBadgeSource[] }[];
  // Esquemas e peças sempre em abas separadas (RF14/RF22): cada aba carrega um único tipo de conteúdo.
  const tabData = useApi<HighlightedPieces | Catalog | Consecrated | SavedSchemes | SavedPieces>((signal) => api.get(`/api/institutional/${encodeURIComponent(slug)}/tabs/${tab === "LOOKS_CONSAGRADOS" && data?.mode === "ADMINISTRADOR" ? "MEUS_ESQUEMAS" : tab}`, { signal, anonymous: !user }), [slug, tab, !!user, data?.mode], { enabled: ["ESQUEMAS_DESTAQUE", "PECAS_DESTAQUE", "CATALOGO", "LOOKS_CONSAGRADOS", "ESQUEMAS_SALVOS", "PECAS_SALVAS"].includes(tab) && !!data });
  const badges = toSealBadges;
  const emptySeal = { open: false, name: "", tier: "LOOK", policyText: "", usageLimit: "", status: "ACTIVE", availableFrom: "", availableUntil: "", design: DEFAULT_DESIGN as SealDesign };
  const [sealForm, setSealForm] = useState<{ open: boolean; id?: string; name: string; tier: string; policyText: string; usageLimit: string; status: string; availableFrom: string; availableUntil: string; design: SealDesign }>(emptySeal);
  const [promoForm, setPromoForm] = useState<{ open: boolean; id?: string; type: string; title: string; description: string; rules: string; discountPercent: string }>({ open: false, type: "DESCONTO_ECOMMERCE", title: "", description: "", rules: "", discountPercent: "" });
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-64" />;
  const admin = data.admin ?? data.mode === "ADMINISTRADOR"; const brand = data.brand ?? data.celebrity ?? {}; const h = data.header;
  const isCeleb = (data.user?.profileType ?? h.profileType ?? h.kind) === "CELEBRIDADE" || h.premium === true || String(h.kind ?? "").toUpperCase().includes("CELEB");
  const owner: UserCard = data.user ?? ({ id: h.userId ?? "", username: h.username ?? h.slug ?? "", displayName: h.name ?? h.username ?? "", avatarUrl: h.logoUrl ?? null, profileType: isCeleb ? "CELEBRIDADE" : "MARCA", verified: h.verified } as unknown as UserCard);
  const tabs = [...(isCeleb ? [{ id: "ERAS", label: t("brands.slug.eras") }] : [{ id: "COLECOES", label: t("common.colecoes") }]), { id: "ESQUEMAS_DESTAQUE", label: t("brands.slug.esquemas_em_destaque") }, { id: "PECAS_DESTAQUE", label: t("brands.slug.pecas_em_destaque") }, { id: "LOOKS_CONSAGRADOS", label: admin ? t("lookbook.looks") : t("brands.slug.looks_consagrados") }, { id: "CATALOGO", label: t("brands.slug.catalogo_de_pecas") }, { id: "SELOS", label: t("brands.slug.selos", { value: seals.data?.length ?? data.header.activeSeals }) }, { id: "PROMOCOES", label: t("brands.slug.promocoes") }, { id: "FLAIR", label: admin ? t("brands.slug.minhas_combinacoes_flair") : t("brands.slug.combinacoes_flair") }, ...(admin ? [{ id: "CUPONS", label: t("brands.slug.meus_cupons_promocionais") }] : []), { id: "GUARDA_ROUPA", label: admin ? t("brands.slug.criar_guarda_roupa_3d") : t("brands.slug.guarda_roupa_3d") },
    ...(admin ? [{ id: "ESQUEMAS_SALVOS", label: t("brands.slug.esquemas_salvos") }, { id: "PECAS_SALVAS", label: t("lookbook.savedPieces") }, { id: "REVISAO", label: t("brands.slug.revisao_de_vinculos") }, { id: "METRICAS", label: t("brands.slug.metricas") }] : [])];
  async function follow() { try { if (data!.header.viewerFollows) await api.delete(`/api/users/${ownerId}/followers/me`); else await api.post(`/api/users/${ownerId}/followers`); reload(); } catch (e) { toast.fromError(e); } }
  async function saveSeal() {
    const iso = (v: string) => (v ? new Date(v).toISOString() : null);
    const body = { name: sealForm.name, tier: sealForm.tier, policyText: sealForm.policyText, usageLimit: sealForm.usageLimit ? Number(sealForm.usageLimit) : null, status: sealForm.status, availableFrom: iso(sealForm.availableFrom), availableUntil: iso(sealForm.availableUntil), design: sealForm.design };
    try { if (sealForm.id) await api.put(`/api/seals/${sealForm.id}`, body); else await api.post("/api/seals", body); setSealForm({ ...sealForm, open: false }); toast.success(t("common.saved")); seals.reload(); } catch (e) { toast.fromError(e); }
  }
  async function savePromo() {
    const body = { type: promoForm.type, title: promoForm.title, description: promoForm.description, rules: promoForm.rules, discountPercent: promoForm.discountPercent ? Number(promoForm.discountPercent) : null };
    try { if (promoForm.id) await api.put(`/api/promotions/${promoForm.id}`, body); else await api.post("/api/promotions", body); setPromoForm({ ...promoForm, open: false }); toast.success(t("common.saved")); promos.reload(); } catch (e) { toast.fromError(e); }
  }
  async function redeem(p: Promotion) { try { const r = await api.post<{ code?: string; message?: string }>(`/api/promotions/${p.id}/redemptions`); toast.success(r.message ?? t("brands.slug.codigo", { code: r.code })); promos.reload(); } catch (e) { toast.fromError(e); } }
  const td = tabData.data;
  // Na troca de aba, o hook ainda guarda os dados da aba anterior por um render: cada aba só lê itens do próprio tipo.
  const only = <T,>(key: "scheme" | "piece") => (Array.isArray(td) ? (td as Record<string, unknown>[]).filter((e) => e && typeof e === "object" && e[key]) : []) as T;
  return (
    <>
      <ProfileHeader username={h.username ?? owner.username} displayName={(brand.brandName as string) ?? (brand.stageName as string) ?? h.name ?? owner.displayName}
        verified={owner.verified || h.status === "Validada" || h.status === "Verificada"} kindLabel={isCeleb ? "Celebridade" : "Marca"} cover={h.coverUrl}
        category={[(brand.fashionCategory as string) ?? h.category ?? ((brand.areas as string[]) ?? []).join(", "), brand.officialHashtag ? `#${String(brand.officialHashtag).replace(/^#/, "")}` : null, `${data.header.activeSeals} selos ativos`].filter(Boolean).join(" · ")}
        bio={h.bio} link={data.store?.url ? { href: data.store.url, label: data.store.url.replace(/^https?:\/\//, "") } : h.storeUrl ? { href: h.storeUrl, label: h.storeUrl.replace(/^https?:\/\//, "") } : null}
        photoUrl={h.userAvatarUrl ?? (isCeleb ? ((brand.officialPhotoUrl as string) ?? h.avatarUrl ?? owner.avatarUrl) : null)}
        photo={!h.userAvatarUrl && !isCeleb ? <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white"><BrandLogo name={(brand.brandName as string) ?? owner.displayName} src={(brand.logoUrl as string) ?? h.logoUrl ?? undefined} size={120} /></span> : undefined}
        counts={{ pieces: h.pieces, schemes: h.schemes, followers: h.followers, following: h.following }}
        actions={<>{!admin && user && <Button size="sm" variant={data.header.viewerFollows ? "default" : "primary"} onClick={follow}><FaiIcon id="SOC-12" size={24} active={data.header.viewerFollows} decorative />{data.header.viewerFollows ? t("lookbook.unfollow") : t("lookbook.follow")}</Button>}{admin && <Link href="/settings" className="btn btn-sm">{t("common.editar_perfil")}</Link>}<Button size="sm" onClick={() => setTab(isCeleb ? "ERAS" : "COLECOES")}>{isCeleb ? t("brands.slug.eras") : t("common.colecoes")}</Button></>} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "ERAS" && isCeleb && <ErasTab slug={slug} admin={admin} />}
      {tab === "COLECOES" && !isCeleb && <CollectionsTab slug={slug} admin={admin} />}
      {tab === "FLAIR" && <BrandFlairTab slug={slug} autoNew={flairNew} />}
      {tab === "GUARDA_ROUPA" && (admin ? <WardrobeCreatorTab /> : user ? <RoomStore creatorSlug={slug} compact /> : <EmptyState title={t("brands.slug.entre_para_ver_os_itens")} hint={t("brands.slug.componentes_e_guarda_roupas_inteiros")} />)}
      {tab === "CUPONS" && admin && <BrandCouponsTab ownerId={ownerId ?? ""} celebrity={isCeleb} onCreateFlair={() => { setTab("FLAIR"); setFlairNew((n) => n + 1); }} />}
      {tab === "ESQUEMAS_DESTAQUE" && (tabData.loading ? <SkeletonGrid /> : only<Consecrated>("scheme").length ? <><p className="type-body-sm text-muted mb-3">{t("brands.slug.looks_de_qualquer_usuario_que")}</p><div className="grid-looks">{only<Consecrated>("scheme").map((e) => <SchemeCard key={e.scheme.id} scheme={e.scheme} seals={badges(e.seals)} />)}</div></> : <EmptyState title={t("brands.slug.nenhum_esquema_em_destaque_ainda")} hint={t("brands.slug.aparecem_aqui_os_looks_que")} />)}
      {tab === "PECAS_DESTAQUE" && (tabData.loading ? <SkeletonGrid /> : only<HighlightedPieces>("piece").length ? <><p className="type-body-sm text-muted mb-3">{t("brands.slug.pecas_que_compoem_os_looks")}</p><div className="grid-cards">{only<HighlightedPieces>("piece").map((e) => <PieceCard key={e.piece.id} piece={e.piece} seals={badges(e.seals)} extra={<span className="caption">{rich("brands.slug.no_look", { schemeTitle: e.schemeTitle, value: e.author ? ` · @${e.author.username}` : "" }, { 0: ($c) => <Link className="underline" href={`/schemes/${e.schemeId}`}>{$c}</Link> })}</span>} />)}</div></> : <EmptyState title={t("brands.slug.nenhuma_peca_em_destaque_ainda")} hint={t("brands.slug.as_pecas_dos_looks_com")} />)}
      {tab === "ESQUEMAS_SALVOS" && admin && (tabData.loading ? <SkeletonGrid /> : only<SavedSchemes>("scheme").length ? <div className="grid-looks">{only<SavedSchemes>("scheme").map((e) => <SchemeCard key={e.scheme.id} scheme={e.scheme} />)}</div> : <EmptyState title={t("brands.slug.nenhum_esquema_salvo")} />)}
      {tab === "PECAS_SALVAS" && admin && (tabData.loading ? <SkeletonGrid /> : only<SavedPieces>("piece").length ? <div className="grid-cards">{only<SavedPieces>("piece").map((e) => <PieceCard key={e.piece.id} piece={e.piece} extra={e.author ? <span className="caption">{t("brands.slug.de_2", { username: e.author.username, value: e.snapshot ? t("brands.slug.arquivada_pelo_autor") : "" })}</span> : undefined} />)}</div> : <EmptyState title={t("common.nenhuma_peca_salva")} />)}
      {tab === "LOOKS_CONSAGRADOS" && (tabData.loading ? <SkeletonGrid /> : only<Consecrated>("scheme").length ? <div className="grid-looks">{only<Consecrated>("scheme").map((e) => <SchemeCard key={e.scheme.id} scheme={e.scheme} seals={badges(e.seals)} />)}</div> : <EmptyState title={t("common.empty")} />)}
      {tab === "CATALOGO" && (tabData.loading ? <SkeletonGrid /> : only<Catalog>("piece").length ? <div className="grid-cards">{only<Catalog>("piece").map((e) => <PieceCard key={e.piece.id} piece={e.piece} extra={<span className="caption tabular">{t("brands.slug.looks", { looks: e.looks, value: e.neverInLook ? t("brands.slug.nunca_usada_em_look") : "" })}</span>} />)}</div> : <EmptyState title={t("common.empty")} />)}
      {tab === "SELOS" && (
        <>
          <p className="type-body text-muted mb-3">{admin ? t("brands.slug.so_o_dono_deste_perfil") : t("brands.slug.selos_concedidos_por_este_perfil")}</p>
          {admin && <Button className="mb-3" variant="primary" onClick={() => setSealForm({ ...emptySeal, open: true })}><FaiIcon id={isCeleb ? "ACT-27" : "ACT-26"} size={24} decorative />{t("brands.slug.novo_selo")}</Button>}
          {seals.loading ? <SkeletonGrid n={3} h="h-32" /> : (seals.data ?? []).length === 0 ? <EmptyState title={t("brands.slug.nenhum_selo_ainda")} /> : <div className="grid-cards">{(seals.data ?? []).map((s) => (
            <Card key={s.id} className={s.premium ? "bg-gradient-to-br from-surface to-surface-3" : ""}>
              <div className="flex items-start gap-3"><SealMedallion design={s.design ?? DEFAULT_DESIGN} size={56} premium={s.premium} title={s.name} /><div className="min-w-0 flex-1"><p className="type-h3">{s.name}</p><p className="type-caption text-muted">{label(s.tier.toLowerCase())} · {s.available ? t("brands.slug.disponivel") : s.unavailableReason ?? label(s.status.toLowerCase())}</p></div></div>
              {s.policyText && <p className="mt-2 type-body-sm">{s.policyText}</p>}
              <p className="mt-2 type-data text-faint tabular">{t("brands.slug.emissoes", { value: s.usageCount ?? 0, value2: s.usageLimit ? `/${s.usageLimit}` : "" })}{(s.availableFrom || s.availableUntil) && <>{t("brands.slug.valido", { value: s.availableFrom ? t("brands.slug.de", { date: fmtDate(s.availableFrom) }) : "", value2: s.availableUntil ? t("common.ate", { date: fmtDate(s.availableUntil) }) : "" })}</>}</p>
              {admin && <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => setSealForm({ open: true, id: s.id, name: s.name, tier: s.tier, policyText: s.policyText ?? "", usageLimit: s.usageLimit?.toString() ?? "", status: s.status, availableFrom: s.availableFrom ? s.availableFrom.slice(0, 16) : "", availableUntil: s.availableUntil ? s.availableUntil.slice(0, 16) : "", design: s.design ?? DEFAULT_DESIGN })}>{t("common.edit")}</Button><Button size="sm" variant="danger" onClick={async () => { try { await api.put(`/api/seals/${s.id}`, { name: s.name, tier: s.tier, policyText: s.policyText, usageLimit: s.usageLimit, availableFrom: s.availableFrom, availableUntil: s.availableUntil, status: s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }); seals.reload(); } catch (e) { toast.fromError(e); } }}>{s.status === "ACTIVE" ? t("common.desativar") : t("brands.slug.ativar")}</Button></div>}
            </Card>))}</div>}
        </>
      )}
      {tab === "PROMOCOES" && (
        <>
          {admin && <Button className="mb-3" variant="primary" onClick={() => setPromoForm({ open: true, type: "DESCONTO_ECOMMERCE", title: "", description: "", rules: "", discountPercent: "" })}>{t("brands.slug.nova_promocao")}</Button>}
          {promos.loading ? <SkeletonGrid n={3} h="h-32" /> : (promos.data ?? []).length === 0 ? <EmptyState title={t("common.nenhuma_promocao_ativa")} /> : <div className="grid-cards">{(promos.data ?? []).map((p) => (
            <Card key={p.id}><Badge tone="chalk">{label(p.type.toLowerCase())}</Badge><p className="type-h3 mt-2">{p.title}</p>{p.description && <p className="type-body-sm text-muted mt-1">{p.description}</p>}{p.discountPercent != null && <p className="hero-number text-3xl mt-2">{p.discountPercent}%</p>}{p.rules && <p className="type-caption text-faint mt-1">{p.rules}</p>}
              <div className="mt-3 flex flex-wrap gap-2">{!admin && user && <Button size="sm" variant="primary" disabled={p.eligible === false} onClick={() => redeem(p)}>{p.eligible === false ? t("brands.slug.precisa_do_selo") : t("common.resgatar")}</Button>}{admin && <><Button size="sm" onClick={() => setPromoForm({ open: true, id: p.id, type: p.type, title: p.title, description: p.description ?? "", rules: p.rules ?? "", discountPercent: p.discountPercent?.toString() ?? "" })}>{t("common.edit")}</Button><Select aria-label={t("brands.slug.status")} className="w-auto py-1" value={p.status} onChange={async (e) => { try { await api.put(`/api/promotions/${p.id}/status`, { status: e.target.value }); promos.reload(); } catch (err) { toast.fromError(err); } }}>{["DRAFT", "ACTIVE", "PAUSED", "ENDED"].map((s) => <option key={s} value={s}>{label(s.toLowerCase())}</option>)}</Select></>}</div></Card>))}</div>}
        </>
      )}
      {tab === "REVISAO" && admin && <ReviewQueue />}
      {tab === "METRICAS" && admin && <IssuerMetrics />}
      <Dialog open={sealForm.open} onClose={() => setSealForm({ ...sealForm, open: false })} title={sealForm.id ? t("brands.slug.editar_selo") : t("brands.slug.novo_selo")} footer={<Button variant="primary" onClick={saveSeal} disabled={sealForm.name.trim().length < 2}>{t("common.save")}</Button>}>
        <Field label={t("common.nome")} id="sname" required><Input id="sname" value={sealForm.name} onChange={(e) => setSealForm({ ...sealForm, name: e.target.value })} /></Field>
        <div className="mb-3"><p className="label mb-1">{t("brands.slug.desenho_do_selo_proporcoes_do")}</p><SealCreator value={sealForm.design} onChange={(dd) => setSealForm({ ...sealForm, design: dd })} premium={isCeleb} /></div>
        <Field label={t("brands.slug.nivel")} id="stier"><Select id="stier" value={sealForm.tier} onChange={(e) => setSealForm({ ...sealForm, tier: e.target.value })}>{TIERS.map((x) => <option key={x} value={x}>{label(x.toLowerCase())}</option>)}</Select></Field>
        <Field label={t("brands.slug.politica_criterios_promocionais_a_ia")} id="spolicy"><Textarea id="spolicy" value={sealForm.policyText} onChange={(e) => setSealForm({ ...sealForm, policyText: e.target.value })} maxLength={2000} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label={t("common.disponivel_a_partir_de")} id="sfrom" hint={t("common.vazio_imediato")}><Input id="sfrom" type="datetime-local" value={sealForm.availableFrom} onChange={(e) => setSealForm({ ...sealForm, availableFrom: e.target.value })} /></Field><Field label={t("common.expira_em")} id="suntil" hint={t("common.vazio_sem_expiracao")}><Input id="suntil" type="datetime-local" value={sealForm.availableUntil} onChange={(e) => setSealForm({ ...sealForm, availableUntil: e.target.value })} /></Field></div>
        <Field label={t("brands.slug.limite_de_emissoes")} id="slimit"><Input id="slimit" type="number" min={1} value={sealForm.usageLimit} onChange={(e) => setSealForm({ ...sealForm, usageLimit: e.target.value })} /></Field>
      </Dialog>
      <Dialog open={promoForm.open} onClose={() => setPromoForm({ ...promoForm, open: false })} title={promoForm.id ? t("brands.slug.editar_promocao") : t("brands.slug.nova_promocao")} footer={<Button variant="primary" onClick={savePromo} disabled={!promoForm.title.trim()}>{t("common.save")}</Button>}>
        <Field label={t("common.tipo")} id="ptype"><Select id="ptype" value={promoForm.type} onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value })}>{(isCeleb ? CELEB_PROMO_TYPES : BRAND_PROMO_TYPES).map((x) => <option key={x} value={x}>{label(x.toLowerCase())}</option>)}</Select></Field>
        <Field label={t("scheme.title")} id="ptitle" required><Input id="ptitle" value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })} /></Field>
        <Field label={t("common.descricao")} id="pdesc"><Textarea id="pdesc" value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} /></Field>
        <Field label={t("common.regras")} id="prules"><Textarea id="prules" value={promoForm.rules} onChange={(e) => setPromoForm({ ...promoForm, rules: e.target.value })} /></Field>
        <Field label={t("common.desconto")} id="pdisc"><Input id="pdisc" type="number" min={0} max={100} value={promoForm.discountPercent} onChange={(e) => setPromoForm({ ...promoForm, discountPercent: e.target.value })} /></Field>
      </Dialog>
    </>
  );
}

function ReviewQueue() {
  const { rich, t } = useI18n();
  const toast = useToast();
  const { data, loading, reload } = useApi<{ id: string; scheme?: SchemeView; requestedBy?: UserCard; seal?: { name: string }; confidence?: number; basis?: string; createdAt?: string }[]>((signal) => api.get("/api/seal-bonds/review-queue", { signal }), []);
  async function decide(id: string, approve: boolean) { try { await api.post(`/api/seal-bonds/${id}/review`, { approve, reason: approve ? null : t("brands.slug.nao_atende_a_politica_do") }); reload(); } catch (e) { toast.fromError(e); } }
  if (loading) return <Skeleton className="h-40" />;
  if (!data || data.length === 0) return <EmptyState title={t("brands.slug.nenhum_vinculo_aguardando_revisao")} />;
  return <ul className="surface divide-y divide-line-soft">{data.map((b) => <li key={b.id} className="flex flex-wrap items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="type-body">{rich("brands.slug.por", { value: b.scheme?.title ?? t("common.look"), value2: b.requestedBy?.username ?? b.scheme?.owner?.username }, { 0: ($c) => <b>{$c}</b> })}</p><p className="type-caption text-muted">{t("brands.slug.selo", { value: b.seal?.name ?? "", value2: b.basis ?? "", value3: b.confidence != null ? t("brands.slug.confianca", { Math: Math.round(b.confidence * 100) }) : "" })}</p></div>{b.scheme && <Link href={`/schemes/${b.scheme.id}`} className="btn btn-sm">{t("brands.slug.ver_look")}</Link>}<Button size="sm" variant="primary" onClick={() => decide(b.id, true)}>{t("common.aprovar")}</Button><Button size="sm" variant="danger" onClick={() => decide(b.id, false)}>{t("common.rejeitar")}</Button></li>)}</ul>;
}
function IssuerMetrics() {
  const { t } = useI18n();
  const { data, loading } = useApi<Record<string, unknown>>((signal) => api.get("/api/me/issuer-metrics", { signal }), []);
  if (loading || !data) return <Skeleton className="h-40" />;
  return <div className="grid gap-3 sm:grid-cols-3">{Object.entries(data).filter(([, v]) => typeof v === "number" || typeof v === "string").map(([k, v]) => <Card key={k}><p className="label">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</p><p className="hero-number text-3xl">{String(v)}</p></Card>)}<Link href="/dashboard" className="btn sm:col-span-3">{t("brands.slug.abrir_dashboard_do_emissor")}</Link></div>;
}

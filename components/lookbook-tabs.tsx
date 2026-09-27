"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, mediaUrl, qs } from "@/lib/api/client";
import type { Page, PieceView, SchemeView, UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { MyCoupons } from "@/components/coupons/my-coupons";
import { Avatar, Button, Card, Chip, EmptyState, ErrorState, Field, Input, Pagination, SegmentPicker, Select, Skeleton, SkeletonGrid, Tabs, useToast } from "@/components/ui";
import { DnaCard, type DnaView } from "@/components/dna-card";
import { SchemeCard, hypeColor } from "@/components/scheme-card";
import { PieceCard } from "@/components/piece-card";
import { FaiIcon } from "@/components/fai-icon";
import { LookExports } from "@/components/look-exports";

interface Overview { owner: UserCard; self: boolean; visible: boolean; institutional: boolean; tabs: { id: string; label: string; count: number }[]; emptyCloset?: { message: string; action: { label: string; href: string } } | null; panelVersion?: string; groupingSuggestionsAvailable?: boolean; }
export type TabId = "closet" | "looks" | "dna" | "saved_looks" | "saved_pieces" | "daily" | "capsule" | "groups" | "coupons";
/** categorias das peças (RF4): só as quatro — peça única não existe mais no formulário */
const CATEGORIES = ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece"];
/** estado da peça no closet (valores aceitos por WardrobeService.stateMatches); "venda" = sub-aba Peças à venda (RF4.CA8) */
const STATES = ["", "disponivel", "indisponivel", "venda"] as const;

/** Lookbook (RF6) — usado no próprio perfil (/lookbook) e no perfil de terceiros (/u/[username]). */
export function LookbookTabs({ ownerId, initialTab = "closet" }: { ownerId: string; initialTab?: TabId }) {
  const { t } = useI18n(); const { user } = useAuth();
  const { data: ov, loading, error, reload } = useApi<Overview>((signal) => api.get(`/api/users/${ownerId}/lookbook`, { signal, anonymous: !user }), [ownerId, !!user]);
  const [tab, setTab] = useState<TabId>(initialTab);
  // um link para a própria página com outro ?tab= (ex.: "Marcar um look salvo" na aba Look do dia) troca a aba
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !ov) return <Skeleton className="h-64" />;
  if (!ov.visible) return <EmptyState title={t("lookbookTabs.perfil_privado")} hint={t("lookbookTabs.siga_esta_pessoa_para_ver")} />;
  // Peças e esquemas nunca dividem aba: Closet e Peças salvas (peças) × Looks e Looks salvos (esquemas).
  const count = (id: string) => ov.tabs.find((x) => x.id === id)?.count;
  const tabs = [{ id: "closet" as TabId, label: t("lookbook.closet"), count: count("closet") }, { id: "looks" as TabId, label: t("lookbook.looks"), count: count("looks") },
    ...(ov.self ? [{ id: "dna" as TabId, label: t("lookbook.dna") }] : []),
    ...(ov.self ? [{ id: "saved_looks" as TabId, label: t("lookbook.savedLooks"), count: count("saved_looks") }, { id: "saved_pieces" as TabId, label: t("lookbook.savedPieces"), count: count("saved_pieces") },
      { id: "daily" as TabId, label: t("lookbook.daily") }, { id: "capsule" as TabId, label: t("lookbook.capsule"), count: count("capsule") }] : []), { id: "groups" as TabId, label: t("lookbook.groups") },
    ...(ov.self ? [{ id: "coupons" as TabId, label: t("common.meus_cupons_resgatados") }] : [])];
  return (
    <>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "closet" && <ClosetTab ownerId={ownerId} self={ov.self} empty={ov.emptyCloset} />}
      {tab === "looks" && <LooksTab ownerId={ownerId} self={ov.self} />}
      {tab === "dna" && ov.self && <DnaLooksTab />}
      {tab === "saved_looks" && ov.self && <SavedLooksTab />}
      {tab === "saved_pieces" && ov.self && <SavedPiecesTab />}
      {tab === "daily" && ov.self && <DailyTab />}
      {tab === "capsule" && ov.self && <CapsuleTab />}
      {tab === "coupons" && ov.self && <MyCoupons />}
      {tab === "groups" && <GroupsTab ownerId={ownerId} self={ov.self} suggestions={!!ov.groupingSuggestionsAvailable} />}
    </>
  );
}

function ClosetTab({ ownerId, self, empty }: { ownerId: string; self: boolean; empty?: Overview["emptyCloset"] }) {
  const { t } = useI18n(); const { user } = useAuth(); const [page, setPage] = useState(0); const [category, setCategory] = useState(""); const [state, setState] = useState<(typeof STATES)[number]>("");
  const { data, loading } = useApi<Page<PieceView>>((signal) => api.get(`/api/users/${ownerId}/closet${qs({ page, size: 24, category, state })}`, { signal, anonymous: !user }), [ownerId, page, category, state, !!user]);
  const stateLabel = (v: string) => v === "" ? t("common.all") : v === "disponivel" ? t("common.available") : v === "indisponivel" ? t("common.unavailable") : t("common.forSale");
  const filtered = !!category || !!state;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentPicker label={t("closet.state")} value={state} onChange={(v) => { setState(v); setPage(0); }} options={STATES.map((v) => ({ id: v, label: stateLabel(v) }))} />
        <SegmentPicker label={t("common.category")} value={category} onChange={(v) => { setCategory(v); setPage(0); }} options={["", ...CATEGORIES].map((c) => ({ id: c, label: c ? label(c) : t("common.all") }))} />
      </div>
      {loading ? <SkeletonGrid /> : !data || data.items.length === 0
        ? <EmptyState title={filtered ? t("common.empty") : empty?.message ?? t("closet.empty")} action={self && !filtered ? <Link href="/pieces/new" className="btn btn-primary">{empty?.action?.label ?? t("closet.addPiece")}</Link> : undefined} />
        : <><div className="grid-cards">{data.items.map((p) => <PieceCard key={p.id} piece={p} />)}</div><Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={data.size} onPage={setPage} /></>}
    </>
  );
}

/** Meus looks DNA de estilo: os cards criados na aba DNA (RF13) ficam aqui, no perfil. */
function DnaLooksTab() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useApi<DnaView[]>((signal) => api.get("/api/me/dna-schemes", { signal }), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <SkeletonGrid />;
  const list = data ?? [];
  if (list.length === 0) return <EmptyState title={t("dna.nenhum_dna_de_estilo_ainda")} hint={t("dna.monte_o_primeiro_com_2")} action={<Link href="/dna" className="btn btn-primary">{t("lookbook.criar_look_dna")}</Link>} />;
  return <div className="grid-looks">{list.map((d) => <DnaCard key={d.id ?? d.title} dna={d} href={d.id ? `/dna-schemes/${d.id}` : undefined} />)}</div>;
}

function LooksTab({ ownerId, self }: { ownerId: string; self: boolean }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast(); const [page, setPage] = useState(0); const [occasion, setOccasion] = useState(""); const [state, setState] = useState("");
  const mine = useApi<Page<SchemeView>>((signal) => api.get(`/api/me/schemes${qs({ page, size: 12, occasion, state })}`, { signal }), [page, occasion, state], { enabled: self });
  const theirs = useApi<{ schemes: SchemeView[] }>((signal) => api.get(`/api/profiles/${ownerId}`, { signal, anonymous: !user }), [ownerId, !!user], { enabled: !self });
  if (!self) { const list = theirs.data?.schemes ?? []; return theirs.loading ? <SkeletonGrid /> : list.length === 0 ? <EmptyState title={t("common.empty")} /> : <div className="grid-looks">{list.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>; }
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2"><Select aria-label={t("common.occasion")} value={occasion} onChange={(e) => { setOccasion(e.target.value); setPage(0); }}><option value="">{t("common.occasion")}: {t("common.all")}</option>{["casual", "work", "party", "formal", "sport", "travel", "date"].map((o) => <option key={o} value={o}>{label(o)}</option>)}</Select>
        <Select aria-label={t("lookbookTabs.estado")} value={state} onChange={(e) => { setState(e.target.value); setPage(0); }}><option value="">{t("common.all")}</option><option value="favoritos">{t("common.favorite")}</option><option value="publicados">{t("common.public")}</option><option value="rascunhos">{t("lookbookTabs.rascunhos")}</option><option value="arquivados">{t("lookbookTabs.arquivados")}</option></Select>
      </div>
      {mine.loading ? <SkeletonGrid /> : (mine.data?.items.length ?? 0) === 0 ? <EmptyState title={t("common.empty")} /> : <><div className="grid-looks">{mine.data!.items.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div><Pagination page={mine.data!.page} hasMore={mine.data!.hasMore} total={mine.data!.total} size={mine.data!.size} onPage={setPage} /></>}
    </>
  );
}

/** Looks salvos (RF6.CA09–CA13) — só esquemas salvos de outras pessoas; os próprios ficam em "Meus looks". */
function SavedLooksTab() {
  const { t } = useI18n(); const toast = useToast(); const [page, setPage] = useState(0); const [occasion, setOccasion] = useState("");
  const { data, loading, reload } = useApi<Page<{ scheme: SchemeView; favorite?: boolean; origin?: string; originLabel?: string; savedAt?: string }>>((signal) => api.get(`/api/me/saved-looks${qs({ page, size: 24, occasion })}`, { signal }), [page, occasion]);
  const list = (data?.items ?? []).filter((x) => x.origin !== "PROPRIO");
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2"><Select aria-label={t("common.occasion")} value={occasion} onChange={(e) => { setOccasion(e.target.value); setPage(0); }}><option value="">{t("common.occasion")}: {t("common.all")}</option>{["casual", "work", "party", "formal", "sport", "travel", "date"].map((o) => <option key={o} value={o}>{label(o)}</option>)}</Select></div>
      {loading ? <SkeletonGrid /> : list.length === 0 ? <EmptyState title={t("lookbookTabs.nenhum_look_salvo")} hint={t("lookbookTabs.use_o_botao_salvar_em")} /> : <div className="grid-looks">{list.map((x) => <SchemeCard key={x.scheme.id} scheme={x.scheme} extra={<><span className="caption">{x.originLabel}</span><Button size="sm" aria-pressed={x.favorite} onClick={async () => { try { await api.put(`/api/me/saved-looks/${x.scheme.id}/favorite`, { favorite: !x.favorite }); reload(); } catch (e) { toast.fromError(e); } }}><FaiIcon id="SOC-06" size={24} active={x.favorite} decorative />{t("common.favorite")}</Button><Button size="sm" onClick={async () => { try { await api.delete(`/api/me/saved-looks/${x.scheme.id}`); reload(); } catch (e) { toast.fromError(e); } }}>{t("common.remove")}</Button></>} />)}</div>}
      {data && data.total > data.size && <Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={data.size} onPage={setPage} />}
    </>
  );
}

/** Peças salvas — aba própria, separada dos looks salvos. */
function SavedPiecesTab() {
  const { t } = useI18n(); const toast = useToast(); const [page, setPage] = useState(0); const [category, setCategory] = useState("");
  const { data, loading, reload } = useApi<Page<{ piece: PieceView; author?: UserCard; favorite?: boolean; originLabel?: string; snapshot?: boolean }>>((signal) => api.get(`/api/me/saved-pieces${qs({ page, size: 24, category })}`, { signal }), [page, category]);
  return (
    <>
      <div className="mb-3"><SegmentPicker label={t("common.category")} value={category} onChange={(v) => { setCategory(v); setPage(0); }} options={["", ...CATEGORIES].map((c) => ({ id: c, label: c ? label(c) : t("common.all") }))} /></div>
      {loading ? <SkeletonGrid /> : (data?.items.length ?? 0) === 0 ? <EmptyState title={t("common.nenhuma_peca_salva")} hint={t("lookbookTabs.salve_pecas_de_outras_pessoas")} /> : <div className="grid-cards">{data!.items.map((x) => <PieceCard key={x.piece.id} piece={x.piece} extra={<><span className="caption">{x.originLabel}{x.snapshot ? t("lookbookTabs.arquivada") : ""}</span><Button size="sm" aria-pressed={x.favorite} onClick={async () => { try { await api.put(`/api/interactions/PIECE/${x.piece.id}/saves/favorite`, { favorite: !x.favorite }); reload(); } catch (e) { toast.fromError(e); } }}><FaiIcon id="SOC-06" size={24} active={x.favorite} decorative />{t("common.favorite")}</Button><Button size="sm" onClick={async () => { try { await api.post(`/api/interactions/PIECE/${x.piece.id}/saves`); reload(); } catch (e) { toast.fromError(e); } }}>{t("common.remove")}</Button></>} />)}</div>}
      {data && data.total > data.size && <Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={data.size} onPage={setPage} />}
    </>
  );
}

function DailyTab() {
  const { t, fmtDate } = useI18n(); const toast = useToast(); const [withAi, setWithAi] = useState(false);
  const { data, loading, reload } = useApi<{ panelVersion: string; panelVersions: { code: string; name: string; emphasis?: string; hype?: string; bestFor?: string }[]; today?: { date?: string; feedback?: string | null; source?: string } | null; scheme?: SchemeView; panel?: Record<string, unknown>; empty?: { message: string; actions?: { label: string; href: string }[] }; history?: { date: string; scheme?: SchemeView; feedback?: string | null; hype?: number }[]; feedbackReminder?: { show?: boolean; message?: string }; feedbackOptions?: string[] }>((signal) => api.get(`/api/me/daily-look-tab?withAi=${withAi}`, { signal }), [withAi]);
  // recarregar (depois de trocar a versão do painel) mantém a aba na tela: a lista não some e o foco fica nela
  if (!data) return <Skeleton className="h-64" />;
  const panel = data.panel ?? {}; const hype = Number(panel.hype ?? panel.score ?? data.scheme?.hypeScore ?? 0);
  const metrics = (panel.metrics ?? panel.components ?? {}) as Record<string, number | { value?: number; label?: string }>;
  async function feedback(fb: string) { if (!data?.today?.date) return; try { await api.put(`/api/me/daily-looks/${data.today.date}/feedback`, { feedback: fb }); toast.success(t("lookbookTabs.obrigado_isso_melhora_suas_recomendacoes")); reload(); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div>{data.scheme && <SchemeCard scheme={data.scheme} />}{data.scheme && <LookExports scheme={data.scheme} hype={hype} bandLabel={typeof panel.band === "object" && panel.band ? (panel.band as { label?: string }).label : undefined} date={data.today?.date} />}{!data.scheme && <EmptyState title={data.empty?.message ?? t("lookbookTabs.nenhum_look_do_dia")} action={(data.empty?.actions ?? []).map((a) => <Link key={a.href} href={a.href === "/add-piece" ? "/pieces/new" : a.href.startsWith("/create") ? "/schemes/new" : a.href} className="btn btn-primary">{a.label}</Link>)} />}</div>
      <div>
        <Card className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2"><h2 className="type-h3">{t("lookbook.hype")} · {t("lookbook.panel")}</h2>
            <Select aria-label={t("lookbookTabs.versao_do_painel")} className="w-auto" value={data.panelVersion} onChange={async (e) => { try { await api.put("/api/me/hype-panel-version", { version: e.target.value }); reload(); } catch (err) { toast.fromError(err); } }}>{data.panelVersions.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}</Select></div>
          {data.scheme ? (
            <div className={`grid gap-3 ${data.panelVersion === "PASSARELA" ? "grid-cols-[80px_1fr]" : ""}`}>
              {data.panelVersion === "PASSARELA" ? <div className="flex h-40 items-end rounded bg-surface-2 p-1"><div className="w-full rounded" style={{ height: `${hype}%`, background: hypeColor(hype) }} /></div> : null}
              <div>
                <p className="hero-number text-5xl" style={{ color: hypeColor(hype) }}>{Math.round(hype)}</p>
                <p className="type-caption text-muted">{String(panel.bandLabel ?? (typeof panel.band === "object" && panel.band ? (panel.band as { label?: string }).label ?? "" : panel.band ?? ""))} {panel.topPercentWeekly != null ? t("lookbookTabs.top_da_semana", { topPercentWeekly: panel.topPercentWeekly }) : ""}</p>
                {data.panelVersion !== "PASSARELA" && <div className="hype-bar mt-2"><i style={{ width: `${hype}%`, background: hypeColor(hype) }} /></div>}
                <dl className="mt-3 grid grid-cols-2 gap-2 type-body-sm">{Object.entries(metrics).map(([k, v]) => <div key={k}><dt className="label">{typeof v === "object" && v?.label ? v.label : k}</dt><dd className="type-data">{typeof v === "object" ? v?.value ?? "—" : v}</dd></div>)}</dl>
                {typeof panel.tip === "string" && <p className="mt-3 rounded bg-chalk-soft p-2 type-body-sm">💡 {panel.tip}</p>}
                {typeof panel.advice === "string" && <p className="mt-3 rounded bg-chalk-soft p-2 type-body-sm">💡 {panel.advice}</p>}
                <label className="mt-2 flex items-center gap-2 type-caption"><input type="checkbox" checked={withAi} onChange={(e) => setWithAi(e.target.checked)} />{" "}{t("lookbookTabs.dica_com_ia_style_advisor")}</label>
              </div>
            </div>
          ) : <p className="type-body text-muted">{t("lookbookTabs.marque_um_look_como_look")}</p>}
        </Card>
        {data.today && (data.today.feedback == null) && <Card className="mb-4"><p className="type-body mb-2">{data.feedbackReminder?.message ?? t("lookbookTabs.como_foi_o_look_de")}</p><div className="flex gap-2">{(data.feedbackOptions ?? ["ADOREI", "NAO_USEI", "NAO_GOSTEI"]).map((o) => <Button key={o} onClick={() => feedback(o)}>{o === "ADOREI" ? t("lookbookTabs.adorei") : o === "NAO_USEI" ? t("lookbookTabs.nao_usei") : t("lookbookTabs.nao_gostei")}</Button>)}</div></Card>}
        <Card><h2 className="type-h3 mb-2">{t("common.historico")}</h2>{(data.history ?? []).length === 0 ? <p className="type-body text-muted">{t("common.empty")}</p> : <ul className="fai-list">{(data.history ?? []).map((h) => <li key={h.date} className="flex items-center justify-between py-2 type-body-sm"><span>{fmtDate(h.date)} · {h.scheme?.title ?? ""}</span><span className="type-data">{h.feedback ?? "—"}{h.hype != null ? t("lookbookTabs.hype", { Math: Math.round(h.hype) }) : ""}</span></li>)}</ul>}</Card>
      </div>
    </div>
  );
}

function CapsuleTab() {
  const { t } = useI18n();
  const [category, setCategory] = useState("");
  const { data, loading } = useApi<{ empty?: { message: string }; basePieces: number; looks: number; factor: number; filters?: string[]; cards?: { piece?: PieceView; looks?: number; usage?: number; [k: string]: unknown }[]; note?: string }>((signal) => api.get(`/api/me/capsule${qs({ category })}`, { signal }), [category]);
  if (loading || !data) return <Skeleton className="h-48" />;
  if (data.empty) return <EmptyState title={data.empty.message} />;
  return (<><div className="mb-3 flex flex-wrap items-center gap-2"><span className="hero-number text-3xl">{data.factor}×</span><span className="type-body text-muted">{t("lookbookTabs.looks_com_pecas_base", { looks: data.looks, basePieces: data.basePieces })}</span><span className="ml-auto flex flex-wrap gap-1">{(data.filters ?? []).map((f) => <Chip key={f} active={(f === "Tudo" ? "" : f) === category} onClick={() => setCategory(f === "Tudo" ? "" : f)}>{f === "Tudo" ? f : label(f)}</Chip>)}</span></div>
    <div className="grid-cards">{(data.cards ?? []).map((c, i) => c.piece ? <PieceCard key={i} piece={c.piece} extra={<span className="caption tabular">{t("lookbookTabs.looks_nesta_capsula", { value: c.looks ?? c.usage ?? 0 })}</span>} /> : null)}</div>{data.note && <p className="mt-3 type-caption text-faint">{data.note}</p>}</>);
}

function GroupsTab({ ownerId, self, suggestions }: { ownerId: string; self: boolean; suggestions: boolean }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast(); const [form, setForm] = useState({ type: "COLECAO", label: "", description: "" }); const [open, setOpen] = useState<string | null>(null);
  const groups = useApi<{ id: string; label: string; type: string; description?: string; coverUrl?: string; count?: number }[]>((signal) => api.get(`/api/users/${ownerId}/groupings`, { signal, anonymous: !user }), [ownerId, !!user]);
  const hype = useApi<{ id: string; label?: string; name?: string; members?: unknown[]; similarity?: number }[]>((signal) => api.get("/api/me/hype-groups?type=SCHEME", { signal }), [], { enabled: self });
  const schemes = useApi<SchemeView[]>((signal) => api.get(`/api/groupings/${open}/schemes`, { signal, anonymous: !user }), [open], { enabled: !!open });
  async function create() { try { await api.post("/api/groupings", form); setForm({ type: "COLECAO", label: "", description: "" }); groups.reload(); } catch (e) { toast.fromError(e); } }
  async function suggest() { try { const r = await api.post<{ created?: number; groups?: unknown[]; message?: string }>("/api/me/hype-groups/suggestions?type=SCHEME"); toast.success(r.message ?? t("lookbookTabs.grupos_sugeridos", { value: r.created ?? r.groups?.length ?? 0 })); hype.reload(); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div>
        {self && <Card className="mb-4"><h2 className="type-h3 mb-2">{t("lookbookTabs.novo_agrupamento")}</h2><Field label={t("common.tipo")} id="gtype"><Select id="gtype" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{["COLECAO", "TEMPORADA", "EDITORIAL", "CAPSULA", "VIAGEM"].map((x) => <option key={x} value={x}>{label(x.toLowerCase())}</option>)}</Select></Field><Field label={t("common.nome")} id="glabel"><Input id="glabel" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field><Button variant="primary" onClick={create} disabled={!form.label.trim()}>{t("common.add")}</Button></Card>}
        {self && suggestions && <Card className="mb-4"><h2 className="type-h3 mb-1">{t("lookbookTabs.hypegroups_ia")}</h2><p className="type-caption text-muted mb-2">{t("lookbookTabs.agrupa_looks_com_similaridade_0")}</p><Button size="sm" onClick={suggest}>{t("lookbookTabs.sugerir_grupos")}</Button><ul className="fai-list mt-2">{(hype.data ?? []).map((g) => <li key={g.id} className="flex items-center justify-between py-1 type-body-sm"><span>{g.label ?? g.name}</span><button type="button" className="underline type-caption" onClick={async () => { await api.delete(`/api/me/hype-groups/${g.id}`); hype.reload(); }}>{t("common.remove")}</button></li>)}</ul></Card>}
        <ul className="fai-list surface">{(groups.data ?? []).map((g) => <li key={g.id}><button type="button" className={`flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2 ${open === g.id ? "bg-surface-2" : ""}`} onClick={() => setOpen(g.id)}><Avatar src={mediaUrl(g.coverUrl)} name={g.label} size={36} /><span className="flex-1"><b>{g.label}</b><span className="block type-caption text-muted">{label(g.type.toLowerCase())}{g.count != null ? ` · ${g.count}` : ""}</span></span></button></li>)}{(groups.data ?? []).length === 0 && <li className="p-3 type-body text-muted">{t("common.empty")}</li>}</ul>
      </div>
      <div>{open ? schemes.loading ? <SkeletonGrid /> : <div className="grid-looks">{(schemes.data ?? []).map((s) => <SchemeCard key={s.id} scheme={s} />)}</div> : <p className="type-body text-muted">{t("lookbookTabs.selecione_um_agrupamento")}</p>}</div>
    </div>
  );
}

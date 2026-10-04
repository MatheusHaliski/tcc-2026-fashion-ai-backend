"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, mediaUrl, qs } from "@/lib/api/client";
import type { Page, PieceView, SchemeView, UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { HypeWardrobeInsights } from "@/components/hype/hype-insights";
import { Avatar, Button, Card, Chip, Dropdown, EmptyState, ErrorState, Field, Input, Pagination, SegmentPicker, Skeleton, SkeletonGrid, Tabs, useToast } from "@/components/ui";
import { DnaCard, type DnaView } from "@/components/dna-card";
import { SchemeCard } from "@/components/scheme-card";
import { hypeColor } from "@/lib/hype/model";
import { PieceCard } from "@/components/piece-card";
import { FaiIcon } from "@/components/fai-icon";
import { LookExports } from "@/components/look-exports";

interface Overview { owner: UserCard; self: boolean; visible: boolean; institutional: boolean; tabs: { id: string; label: string; count: number }[]; emptyCloset?: { message: string; action: { label: string; href: string } } | null; panelVersion?: string; groupingSuggestionsAvailable?: boolean; }
/**
 * Abas do Lookbook (docs/hype/01-AUDITORIA_E_PROPOSTA_IA.md §3.3). "Salvos" reúne looks e peças salvos (SegmentPicker,
 * ids antigos saved_looks/saved_pieces viram alias); "Meus cupons resgatados" saiu (era o mesmo componente de /coupons).
 */
export type TabId = "closet" | "looks" | "dna" | "saved" | "daily" | "capsule" | "groups" | "insights";
export type SavedView = "looks" | "pieces";
/** categorias das peças (RF4): só as quatro — peça única não existe mais no formulário */
const CATEGORIES = ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece"];
/** estado da peça no closet (valores aceitos por WardrobeService.stateMatches); "venda" = sub-aba Peças à venda (RF4.CA8) */
const STATES = ["", "disponivel", "indisponivel", "venda"] as const;

/** Lookbook (RF6) — usado no próprio perfil (/lookbook) e no perfil de terceiros (/u/[username]). */
export function LookbookTabs({ ownerId, initialTab = "closet", initialSaved = "looks" }: { ownerId: string; initialTab?: TabId; initialSaved?: SavedView }) {
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
  const saved = (count("saved_looks") ?? 0) + (count("saved_pieces") ?? 0);
  const tabs = [{ id: "closet" as TabId, label: t("lookbook.closet"), count: count("closet") }, { id: "looks" as TabId, label: t("lookbook.looks"), count: count("looks") },
    ...(ov.self ? [{ id: "saved" as TabId, label: t("lookbook.saved"), count: saved }, { id: "dna" as TabId, label: t("lookbook.dna") },
      { id: "daily" as TabId, label: t("lookbook.daily") }, { id: "capsule" as TabId, label: t("lookbook.capsule"), count: count("capsule") }] : []), { id: "groups" as TabId, label: t("lookbook.groups") },
    ...(ov.self ? [{ id: "insights" as TabId, label: t("lookbook.insights") }] : [])];
  return (
    <>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "closet" && <ClosetTab ownerId={ownerId} self={ov.self} empty={ov.emptyCloset} />}
      {tab === "looks" && <LooksTab ownerId={ownerId} self={ov.self} />}
      {tab === "dna" && ov.self && <DnaLooksTab />}
      {tab === "saved" && ov.self && <SavedTab initial={initialSaved} looks={count("saved_looks")} pieces={count("saved_pieces")} />}
      {tab === "daily" && ov.self && <DailyTab />}
      {tab === "capsule" && ov.self && <CapsuleTab />}
      {tab === "insights" && ov.self && <HypeWardrobeInsights />}
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
      <div className="mb-3 flex flex-wrap gap-2"><Dropdown label={t("common.occasion")} prefix={`${t("common.occasion")}:`} value={occasion} onChange={(v) => { setOccasion(v); setPage(0); }} options={[{ id: "", label: t("common.all") }, ...["casual", "work", "party", "formal", "sport", "travel", "date"].map((o) => ({ id: o, label: label(o) }))]} />
        <Dropdown label={t("closet.state")} prefix={`${t("closet.state")}:`} value={state} onChange={(v) => { setState(v); setPage(0); }} options={[{ id: "", label: t("common.all") }, { id: "favoritos", label: t("common.favorite") }, { id: "publicados", label: t("common.public") }, { id: "rascunhos", label: t("lookbookTabs.rascunhos") }, { id: "arquivados", label: t("lookbookTabs.arquivados") }]} />
      </div>
      {mine.loading ? <SkeletonGrid /> : (mine.data?.items.length ?? 0) === 0 ? <EmptyState title={t("common.empty")} /> : <><div className="grid-looks">{mine.data!.items.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div><Pagination page={mine.data!.page} hasMore={mine.data!.hasMore} total={mine.data!.total} size={mine.data!.size} onPage={setPage} /></>}
    </>
  );
}

/** Looks salvos (RF6.CA09–CA13) — só esquemas salvos de outras pessoas; os próprios ficam em "Meus looks". */
/** Salvos: looks e peças salvos numa aba só — o SegmentPicker troca a lista (uma de cada vez, nunca empilhadas). */
function SavedTab({ initial, looks, pieces }: { initial: SavedView; looks?: number; pieces?: number }) {
  const { t } = useI18n();
  const [view, setView] = useState<SavedView>(initial);
  useEffect(() => { setView(initial); }, [initial]);
  return (
    <>
      <SegmentPicker label={t("lookbook.saved")} value={view} onChange={setView} className="mb-3"
        options={[{ id: "looks", label: t("lookbook.savedLooks"), count: looks }, { id: "pieces", label: t("lookbook.savedPieces"), count: pieces }]} />
      {view === "looks" ? <SavedLooksTab /> : <SavedPiecesTab />}
    </>
  );
}

function SavedLooksTab() {
  const { t } = useI18n(); const toast = useToast(); const [page, setPage] = useState(0); const [occasion, setOccasion] = useState("");
  const { data, loading, reload } = useApi<Page<{ scheme: SchemeView; favorite?: boolean; origin?: string; originLabel?: string; savedAt?: string }>>((signal) => api.get(`/api/me/saved-looks${qs({ page, size: 24, occasion })}`, { signal }), [page, occasion]);
  const list = (data?.items ?? []).filter((x) => x.origin !== "PROPRIO");
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2"><Dropdown label={t("common.occasion")} prefix={`${t("common.occasion")}:`} value={occasion} onChange={(v) => { setOccasion(v); setPage(0); }} options={[{ id: "", label: t("common.all") }, ...["casual", "work", "party", "formal", "sport", "travel", "date"].map((o) => ({ id: o, label: label(o) }))]} /></div>
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
  const { data, loading, reload } = useApi<{ panelVersion: string; panelVersions: { code: string; name: string; emphasis?: string; hype?: string; bestFor?: string }[]; today?: { date?: string; feedback?: string | null; source?: string } | null; scheme?: SchemeView; panel?: Record<string, unknown>; empty?: { message: string; actions?: { label: string; href: string }[] }; history?: { date: string; title?: string; scheme?: SchemeView; feedback?: string | null; hypeScore?: number | null; hype?: number }[]; feedbackReminder?: { show?: boolean; message?: string }; feedbackOptions?: string[] }>((signal) => api.get(`/api/me/daily-look-tab?withAi=${withAi}`, { signal }), [withAi]);
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
            <Dropdown label={t("lookbookTabs.versao_do_painel")} value={data.panelVersion} onChange={async (v) => { try { await api.put("/api/me/hype-panel-version", { version: v }); reload(); } catch (err) { toast.fromError(err); } }} options={data.panelVersions.map((v) => ({ id: v.code, label: v.name }))} /></div>
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
        <Card><h2 className="type-h3 mb-2">{t("common.historico")}</h2>{(data.history ?? []).length === 0 ? <p className="type-body text-muted">{t("common.empty")}</p> : <ul className="fai-list">{(data.history ?? []).map((h) => <li key={h.date} className="flex items-center justify-between py-2 type-body-sm"><span>{fmtDate(h.date)} · {h.title ?? h.scheme?.title ?? ""}</span><span className="type-data">{h.feedback ?? "—"}{(h.hypeScore ?? h.hype) != null ? t("lookbookTabs.hype", { Math: Math.round(Number(h.hypeScore ?? h.hype)) }) : ""}</span></li>)}</ul>}</Card>
      </div>
    </div>
  );
}

/**
 * Minha Cápsula & Versatilidade (RF6): a anatomia da prancha DNA "Cápsula & versatilidade" (B4) aplicada ao guarda-roupa
 * inteiro. Barra de estatísticas (peças-base · looks · fator), filtro por categoria e grade de peças-base ordenada por
 * uso, cada card com o chip de categoria e o badge ×N (em quantos looks a peça aparece).
 */
function CapsuleTab() {
  const { t } = useI18n();
  const [category, setCategory] = useState("");
  const { data, loading } = useApi<{ empty?: { message: string }; basePieces: number; looks: number; factor: number; filters?: string[]; cards?: { piece?: PieceView; looks?: number; usage?: number; [k: string]: unknown }[]; note?: string }>((signal) => api.get(`/api/me/capsule${qs({ category })}`, { signal }), [category]);
  if (loading || !data) return <Skeleton className="h-48" />;
  if (data.empty) return <EmptyState title={data.empty.message} action={<Link href="/schemes/new" className="btn btn-primary">{t("lookbookTabs.criar_primeiro_look")}</Link>} />;
  const cards = [...(data.cards ?? [])].filter((c) => c.piece).sort((a, b) => (b.looks ?? b.usage ?? 0) - (a.looks ?? a.usage ?? 0));
  const catOf = (p: PieceView) => label(p.category);
  return (<>
    <div className="capsule-chips">{(data.filters ?? []).map((f) => <Chip key={f} active={(f === "Tudo" ? "" : f) === category} onClick={() => setCategory(f === "Tudo" ? "" : f)}>{f === "Tudo" ? t("common.all") : label(f)}</Chip>)}</div>
    <div className="capsule-stats">
      <div className="capsule-stat"><span className="num tabular">{data.basePieces}</span><span className="lbl">{t("lookbookTabs.pecas_base")}</span></div>
      <div className="capsule-stat"><span className="num tabular">{data.looks}</span><span className="lbl">{t("lookbookTabs.looks_no_guarda_roupa")}</span></div>
      <div className="capsule-stat"><span className="num tabular">{Number(data.factor).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span><span className="lbl">{t("lookbookTabs.fator_de_versatilidade")}</span></div>
    </div>
    <div className="capsule-grid">{cards.map((c, i) => { const p = c.piece!; const n = c.looks ?? c.usage ?? 0; return (
      <Link key={p.id ?? i} href={`/pieces/${p.id}`} className="capsule-piece" aria-label={`${p.name} · ${t("lookbookTabs.looks_nesta_capsula", { value: n })}`}>
        <span className="capsule-ph">{(p.thumbnailUrl || p.imageUrl) && <img src={mediaUrl(p.thumbnailUrl ?? p.imageUrl)} alt="" loading="lazy" />}</span>
        <span className="capsule-cat">{catOf(p)}</span>
        <span className="capsule-badge tabular">×{n}</span>
        <span className="capsule-body"><span className="capsule-name">{p.name}</span><span className="capsule-brand">{(p.brandName ?? "").toUpperCase()}</span></span>
      </Link>); })}</div>
    {data.note && <p className="mt-3 type-caption text-faint">{data.note}</p>}
  </>);
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
        {self && <Card className="mb-4"><h2 className="type-h3 mb-2">{t("lookbookTabs.novo_agrupamento")}</h2><Field label={t("common.tipo")} id="gtype"><Dropdown id="gtype" label={t("common.tipo")} value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={["COLECAO", "TEMPORADA", "EDITORIAL", "CAPSULA", "VIAGEM"].map((x) => ({ id: x, label: label(x.toLowerCase()) }))} /></Field><Field label={t("common.nome")} id="glabel"><Input id="glabel" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field><Button variant="primary" onClick={create} disabled={!form.label.trim()}>{t("common.add")}</Button></Card>}
        {self && suggestions && <Card className="mb-4"><h2 className="type-h3 mb-1">{t("lookbookTabs.hypegroups_ia")}</h2><p className="type-caption text-muted mb-2">{t("lookbookTabs.agrupa_looks_com_similaridade_0")}</p><Button size="sm" onClick={suggest}>{t("lookbookTabs.sugerir_grupos")}</Button><ul className="fai-list mt-2">{(hype.data ?? []).map((g) => <li key={g.id} className="flex items-center justify-between py-1 type-body-sm"><span>{g.label ?? g.name}</span><button type="button" className="underline type-caption" onClick={async () => { await api.delete(`/api/me/hype-groups/${g.id}`); hype.reload(); }}>{t("common.remove")}</button></li>)}</ul></Card>}
        <ul className="fai-list surface">{(groups.data ?? []).map((g) => <li key={g.id}><button type="button" className={`flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2 ${open === g.id ? "bg-surface-2" : ""}`} onClick={() => setOpen(g.id)}><Avatar src={mediaUrl(g.coverUrl)} name={g.label} size={36} /><span className="flex-1"><b>{g.label}</b><span className="block type-caption text-muted">{label(g.type.toLowerCase())}{g.count != null ? ` · ${g.count}` : ""}</span></span></button></li>)}{(groups.data ?? []).length === 0 && <li className="p-3 type-body text-muted">{t("common.empty")}</li>}</ul>
      </div>
      <div>{open ? schemes.loading ? <SkeletonGrid /> : <div className="grid-looks">{(schemes.data ?? []).map((s) => <SchemeCard key={s.id} scheme={s} />)}</div> : <p className="type-body text-muted">{t("lookbookTabs.selecione_um_agrupamento")}</p>}</div>
    </div>
  );
}

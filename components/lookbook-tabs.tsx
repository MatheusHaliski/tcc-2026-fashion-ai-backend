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
import { HypeBadge } from "@/components/hype/hype-badge";
import { HypeBreakdown } from "@/components/hype/hype-breakdown";
import { HypeInline } from "@/components/hype/hype-inline";
import { HypeStateNotice } from "@/components/hype/hype-state-notice";
import { HypeTrendIndicator } from "@/components/hype/hype-trend-indicator";
import { InsightStrip } from "@/components/insights/insight-strip";
import { Avatar, Button, Card, Chip, Dropdown, EmptyState, ErrorState, Field, Input, Pagination, SegmentPicker, Skeleton, SkeletonGrid, Tabs, useToast } from "@/components/ui";
import { DnaCard, type DnaView } from "@/components/dna-card";
import { SchemeCard } from "@/components/scheme-card";
import { DIMENSION_ORDER, displayScore, hypeViewState, levelTone } from "@/lib/hype/model";
import { primeHype, useHypeSummary } from "@/lib/hype/use-hype";
import type { HypeLevel, HypeSummary } from "@/lib/hype/types";
import { PieceCard } from "@/components/piece-card";
import { FaiIcon } from "@/components/fai-icon";
import { LookExports } from "@/components/look-exports";
import { SavedLooks } from "@/components/looks/saved-looks";

interface Overview { owner: UserCard; self: boolean; visible: boolean; institutional: boolean; tabs: { id: string; label: string; count: number }[]; emptyCloset?: { message: string; action: { label: string; href: string } } | null; panelVersion?: string; groupingSuggestionsAvailable?: boolean; }
/**
 * Abas do Lookbook (docs/hype/01-AUDITORIA_E_PROPOSTA_IA.md §3.3) — vitrine social e identidade, sem repetir o que tem
 * tela própria: Peças · Looks · Publicações · Favoritos · Salvos (dono) · DNA de estilo (dono) · Look do dia (dono) ·
 * Cápsula (dono) · Agrupamentos · Insights (dono).
 * - Looks: os looks publicados, iguais para o dono e para quem visita; a gestão (origem, estado, ocasião, rascunhos e
 *   arquivados) mudou para /looks ("Gerenciar meus looks").
 * - Publicações: looks publicados + peças visíveis, em ordem cronológica. Favoritos: SegmentPicker Looks | Peças.
 * - Salvos: looks e peças salvos (SegmentPicker; ids antigos saved_looks/saved_pieces viram alias).
 * "Meus cupons resgatados" saiu (era o mesmo componente de /coupons).
 */
export type TabId = "closet" | "looks" | "publications" | "favorites" | "dna" | "saved" | "daily" | "capsule" | "groups" | "insights";
export type SavedView = "looks" | "pieces";
/** categorias das peças (RF4): só as quatro — peça única não existe mais no formulário */
const CATEGORIES = ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece"];
/** estado da peça no closet (valores aceitos por WardrobeService.stateMatches); "venda" = sub-aba Peças à venda (RF4.CA8); "doar" = para doar */
const STATES = ["", "disponivel", "indisponivel", "venda", "doar"] as const;

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
  // Looks do dono: a contagem do overview inclui rascunhos, e a aba mostra só os publicados — sem número para não divergir
  const tabs = [{ id: "closet" as TabId, label: t("lookbook.closet"), count: count("closet") }, { id: "looks" as TabId, label: t("lookbook.looks"), count: ov.self ? undefined : count("looks") },
    { id: "publications" as TabId, label: t("lookbook.publications"), count: count("publications") }, { id: "favorites" as TabId, label: t("lookbook.favorites"), count: count("favorites") },
    ...(ov.self ? [{ id: "saved" as TabId, label: t("lookbook.saved"), count: saved }, { id: "dna" as TabId, label: t("lookbook.dna") },
      { id: "daily" as TabId, label: t("lookbook.daily") }, { id: "capsule" as TabId, label: t("lookbook.capsule"), count: count("capsule") }] : []), { id: "groups" as TabId, label: t("lookbook.groups") },
    ...(ov.self ? [{ id: "insights" as TabId, label: t("lookbook.insights") }] : [])];
  return (
    <>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "closet" && <ClosetTab ownerId={ownerId} self={ov.self} empty={ov.emptyCloset} />}
      {tab === "looks" && <LooksTab ownerId={ownerId} self={ov.self} />}
      {tab === "publications" && <PublicationsTab ownerId={ownerId} />}
      {tab === "favorites" && <FavoritesTab ownerId={ownerId} />}
      {tab === "dna" && ov.self && <DnaLooksTab />}
      {tab === "saved" && ov.self && <SavedTab initial={initialSaved} looks={count("saved_looks")} pieces={count("saved_pieces")} />}
      {tab === "daily" && ov.self && <DailyTab />}
      {tab === "capsule" && ov.self && <CapsuleTab />}
      {tab === "insights" && ov.self && <><InsightStrip context="CLOSET" className="mb-4" /><HypeWardrobeInsights /></>}
      {tab === "groups" && <GroupsTab ownerId={ownerId} self={ov.self} suggestions={!!ov.groupingSuggestionsAvailable} />}
    </>
  );
}

function ClosetTab({ ownerId, self, empty }: { ownerId: string; self: boolean; empty?: Overview["emptyCloset"] }) {
  const { t } = useI18n(); const { user } = useAuth(); const [page, setPage] = useState(0); const [category, setCategory] = useState(""); const [state, setState] = useState<(typeof STATES)[number]>("");
  const { data, loading } = useApi<Page<PieceView>>((signal) => api.get(`/api/users/${ownerId}/closet${qs({ page, size: 24, category, state })}`, { signal, anonymous: !user }), [ownerId, page, category, state, !!user]);
  const stateLabel = (v: string) => v === "" ? t("common.all") : v === "disponivel" ? t("common.available") : v === "indisponivel" ? t("common.unavailable") : v === "doar" ? t("common.forDonation") : t("common.forSale");
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

/** Ordenação da aba Looks (P3-02): é ordenação, não aba nem filtro. Valores aceitos por GET /api/profiles/{id}?sort=. */
type LookSort = "recent" | "hype_desc" | "growth";

/**
 * Looks: a vitrine — os looks publicados, os mesmos para o dono e para quem visita. Filtros, rascunhos e arquivados
 * (a gestão) ficam em /looks; o dono tem o atalho discreto "Gerenciar meus looks". Ordenar por Hype (P3-02): o dono
 * ordena pelo próprio Hype pessoal; quem visita, só pelo Hype público — look sem Hype fica no fim (nunca vale 0).
 */
function LooksTab({ ownerId, self }: { ownerId: string; self: boolean }) {
  const { t } = useI18n(); const { user } = useAuth(); const [sort, setSort] = useState<LookSort>("recent");
  // "Recentes" é a rota de sempre; as outras ordens mandam ?sort= (o backend respeita a privacidade do Hype)
  const { data, loading, error, reload } = useApi<{ schemes: SchemeView[] }>((signal) => api.get(`/api/profiles/${ownerId}${qs({ sort: sort === "recent" ? undefined : sort })}`, { signal, anonymous: !user }), [ownerId, !!user, sort]);
  const list = data?.schemes ?? [];
  return (
    <>
      <div className="lookbook-sort">
        <Dropdown label={t("hypeLookbook.ordenar")} prefix={t("hypeLookbook.ordenar_prefixo")} value={sort} onChange={setSort}
          options={[{ id: "recent", label: t("hypeLookbook.ordem.recent") }, { id: "hype_desc", label: t("hypeLookbook.ordem.hype_desc") }, { id: "growth", label: t("hypeLookbook.ordem.growth") }]} />
        {sort !== "recent" && <span className="type-caption text-muted">{self ? t("hypeLookbook.ordem_pessoal") : t("hypeLookbook.ordem_publica")}</span>}
        {self && <p className="lookbook-manage"><Link href="/looks" className="lookbook-manage-link">{t("lookbook.manageLooks")} →</Link></p>}
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <SkeletonGrid />
        : list.length === 0 ? <EmptyState title={t("lookbook.noPublishedLooks")} action={self ? <Link href="/schemes/new" className="btn btn-primary">{t("scheme.create")}</Link> : undefined} />
        : <div className="grid-looks">{list.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>}
    </>
  );
}

/** Uma publicação do perfil (GET /api/users/{id}/publications): look publicado ou peça visível. */
type Publication = { type: "LOOK" | "PIECE"; at: string; scheme?: SchemeView; piece?: PieceView };

/** Publicações: o que o perfil mostra ao mundo, em ordem cronológica (looks e peças na mesma grade). */
function PublicationsTab({ ownerId }: { ownerId: string }) {
  const { t } = useI18n(); const { user } = useAuth(); const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useApi<Page<Publication>>((signal) => api.get(`/api/users/${ownerId}/publications${qs({ page, size: 24 })}`, { signal, anonymous: !user }), [ownerId, page, !!user]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <SkeletonGrid />;
  const items = (data?.items ?? []).filter((x) => (x.type === "LOOK" ? x.scheme : x.piece));
  if (!data || items.length === 0) return <EmptyState title={t("lookbook.noPublications")} hint={t("lookbook.publicationsHint")} />;
  return (
    <>
      <div className="grid-cards">{items.map((x) => x.type === "LOOK"
        ? <SchemeCard key={`look-${x.scheme!.id}`} scheme={x.scheme!} compact />
        : <PieceCard key={`piece-${x.piece!.id}`} piece={x.piece!} />)}</div>
      <Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={data.size} onPage={setPage} />
    </>
  );
}

/** Favoritos: peças e looks que o dono marcou como favoritos, uma lista de cada vez (SegmentPicker Looks | Peças). */
function FavoritesTab({ ownerId }: { ownerId: string }) {
  const { t } = useI18n(); const { user } = useAuth(); const [picked, setPicked] = useState<SavedView | null>(null);
  const { data, loading, error, reload } = useApi<{ pieces?: PieceView[]; looks?: SchemeView[] }>((signal) => api.get(`/api/users/${ownerId}/favorites`, { signal, anonymous: !user }), [ownerId, !!user]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <SkeletonGrid />;
  const looks = data.looks ?? []; const pieces = data.pieces ?? [];
  // sem escolha, abre na lista que tem itens (looks primeiro)
  const view: SavedView = picked ?? (looks.length === 0 && pieces.length > 0 ? "pieces" : "looks");
  return (
    <>
      <SegmentPicker label={t("lookbook.favorites")} value={view} onChange={setPicked} className="mb-3"
        options={[{ id: "looks", label: t("lookbook.looks"), count: looks.length }, { id: "pieces", label: t("lookbook.closet"), count: pieces.length }]} />
      {view === "looks"
        ? looks.length === 0 ? <EmptyState title={t("lookbook.noFavoriteLooks")} /> : <div className="grid-looks">{looks.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>
        : pieces.length === 0 ? <EmptyState title={t("lookbook.noFavoritePieces")} /> : <div className="grid-cards">{pieces.map((p) => <PieceCard key={p.id} piece={p} />)}</div>}
    </>
  );
}

/** Salvos: looks e peças salvos numa aba só — o SegmentPicker troca a lista (uma de cada vez, nunca empilhadas). */
function SavedTab({ initial, looks, pieces }: { initial: SavedView; looks?: number; pieces?: number }) {
  const { t } = useI18n();
  const [view, setView] = useState<SavedView>(initial);
  useEffect(() => { setView(initial); }, [initial]);
  return (
    <>
      <SegmentPicker label={t("lookbook.saved")} value={view} onChange={setView} className="mb-3"
        options={[{ id: "looks", label: t("lookbook.savedLooks"), count: looks }, { id: "pieces", label: t("lookbook.savedPieces"), count: pieces }]} />
      {view === "looks" ? <SavedLooks /> : <SavedPiecesTab />}
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

/**
 * Painel do Look do Dia (HypeScoreService.panel): `v2` = HypeScore v2 do look (P2-13, Hype pessoal do dono — o Look do
 * Dia é sempre dele) e `magazineCover` = capa liberada pela faixa v2. Os demais campos são v1 (deprecados) e não aparecem.
 */
interface DailyPanel { v2?: HypeSummary | null; magazineCover?: { unlocked: boolean; minLevel: HypeLevel } | null; tip?: unknown; advice?: unknown; [legacyV1: string]: unknown }
/** Linha do histórico (DailyLookService.view): `schemeId` é a chave do Hype v2 (P1-06); `hypeScore` é o v1 legado. */
interface DailyHistoryRow { date: string; schemeId?: string; title?: string; scheme?: SchemeView; feedback?: string | null; /** @deprecated v1 */ hypeScore?: number | null }
interface DailyTabData { panelVersion: string; panelVersions: { code: string; name: string; emphasis?: string; hype?: string; bestFor?: string }[]; today?: { date?: string; feedback?: string | null; source?: string } | null; scheme?: SchemeView; panel?: DailyPanel; empty?: { message: string; actions?: { label: string; href: string }[] }; history?: DailyHistoryRow[]; feedbackReminder?: { show?: boolean; message?: string }; feedbackOptions?: string[] }

/** HypeBadge v2 de uma linha do histórico (lote: todas as linhas viram uma requisição a /api/hype/summaries). */
function DailyHistoryHype({ id }: { id?: string }) {
  const hype = useHypeSummary("SCHEME", id);
  if (!id) return null;
  return <HypeBadge state={hypeViewState(hype.summary, hype)} summary={hype.summary} />;
}

/**
 * Look do Dia (RF6): o número do painel é o HypeScore v2 do look em todas as 6 versões visuais (P2-13) — a versão muda
 * só a apresentação. Faixa sempre em texto; "sem dados" vira "Dados insuficientes"/"Hype ainda não calculado", nunca 0.
 * Ao lado, a análise completa do look (HypeInline) e, no histórico, o HypeBadge v2 de cada dia (P1-06).
 */
function DailyTab() {
  const { t, fmtDate } = useI18n(); const toast = useToast(); const [withAi, setWithAi] = useState(false);
  const { data, loading, reload } = useApi<DailyTabData>((signal) => api.get(`/api/me/daily-look-tab?withAi=${withAi}`, { signal }), [withAi]);
  // o painel já traz o resumo v2 do look: alimenta o cache para o card e a análise não pedirem de novo
  const primed = data?.scheme?.id && data.panel?.v2 ? { id: data.scheme.id, v2: data.panel.v2 } : null;
  useEffect(() => { if (primed) primeHype("SCHEME", { [primed.id]: primed.v2 }); }, [primed?.id, primed?.v2]); // eslint-disable-line react-hooks/exhaustive-deps
  // recarregar (depois de trocar a versão do painel) mantém a aba na tela: a lista não some e o foco fica nela
  if (!data) return <Skeleton className="h-64" />;
  const v2 = data.panel?.v2 ?? null;
  const state = hypeViewState(v2 ?? undefined, { loading: loading && !data.panel });
  const score = state.kind === "available" ? state.score : null;
  const level = state.kind === "available" ? state.level : null;
  const version = data.panelVersion;
  const bar = score != null ? <div className="hype-bar mt-2"><i style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: "var(--thread)" }} /></div> : null;
  async function feedback(fb: string) { if (!data?.today?.date) return; try { await api.put(`/api/me/daily-looks/${data.today.date}/feedback`, { feedback: fb }); toast.success(t("lookbookTabs.obrigado_isso_melhora_suas_recomendacoes")); reload(); } catch (e) { toast.fromError(e); } }
  return (<>
    <InsightStrip context="HISTORY" collapsible className="mb-4" />
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div>{data.scheme && <SchemeCard scheme={data.scheme} />}{data.scheme && <LookExports scheme={data.scheme} score={score} level={level} date={data.today?.date} />}{!data.scheme && <EmptyState title={data.empty?.message ?? t("lookbookTabs.nenhum_look_do_dia")} action={(data.empty?.actions ?? []).map((a) => <Link key={a.href} href={a.href === "/add-piece" ? "/pieces/new" : a.href.startsWith("/create") ? "/schemes/new" : a.href.endsWith("?tab=looks") ? "/looks" : a.href} className="btn btn-primary">{a.label}</Link>)} />}</div>
      <div>
        <Card className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2"><h2 className="type-h3">{t("lookbook.hype")} · {t("lookbook.panel")}</h2>
            <Dropdown label={t("lookbookTabs.versao_do_painel")} value={data.panelVersion} onChange={async (v) => { try { await api.put("/api/me/hype-panel-version", { version: v }); reload(); } catch (err) { toast.fromError(err); } }} options={data.panelVersions.map((v) => ({ id: v.code, label: v.name }))} /></div>
          {data.scheme ? (
            <div className={`grid gap-3 ${version === "PASSARELA" ? "grid-cols-[80px_1fr]" : ""}`} data-panel-version={version}>
              {version === "PASSARELA" ? <div className="flex h-40 items-end rounded bg-surface-2 p-1" aria-hidden>{score != null && <div className="w-full rounded" style={{ height: `${Math.max(0, Math.min(100, score))}%`, background: "var(--thread)" }} />}</div> : null}
              <div>
                {score != null && level ? <>
                  <p className={`hero-number ${version === "EDITORIAL_MINIMAL" ? "text-3xl" : "text-5xl"}`} aria-label={t("hype.badge.aria", { score: displayScore(score), level: t(`hype.level.${level}`) })}>{displayScore(score)}</p>
                  <p className="lb-hype-line"><span className={`hype-level-chip ${levelTone(level)}`}>{t(`hype.level.${level}`)}</span><HypeTrendIndicator summary={v2} />{v2?.stale && <span className="type-caption text-faint">{t("hype.state.stale")}</span>}</p>
                </> : <HypeStateNotice state={state} />}
                {version !== "PASSARELA" && version !== "EDITORIAL_MINIMAL" && bar}
                {version === "RAIO_X_ESTILO" && score != null && <HypeBreakdown type="SCHEME" dimensions={v2?.dimensions} list={DIMENSION_ORDER} />}
                <p className="mt-2 type-caption text-muted">{t("hypeLookbook.painel_v2_dica")}</p>
                {typeof data.panel?.tip === "string" && <p className="mt-3 rounded bg-chalk-soft p-2 type-body-sm">💡 {data.panel.tip}</p>}
                {typeof data.panel?.advice === "string" && <p className="mt-3 rounded bg-chalk-soft p-2 type-body-sm">💡 {data.panel.advice}</p>}
                <label className="mt-2 flex items-center gap-2 type-caption"><input type="checkbox" checked={withAi} onChange={(e) => setWithAi(e.target.checked)} />{" "}{t("lookbookTabs.dica_com_ia_style_advisor")}</label>
                <HypeInline type="SCHEME" id={data.scheme.id} name={data.scheme.title} />
              </div>
            </div>
          ) : <p className="type-body text-muted">{t("lookbookTabs.marque_um_look_como_look")}</p>}
        </Card>
        {data.today && (data.today.feedback == null) && <Card className="mb-4"><p className="type-body mb-2">{data.feedbackReminder?.message ?? t("lookbookTabs.como_foi_o_look_de")}</p><div className="flex gap-2">{(data.feedbackOptions ?? ["ADOREI", "NAO_USEI", "NAO_GOSTEI"]).map((o) => <Button key={o} onClick={() => feedback(o)}>{o === "ADOREI" ? t("lookbookTabs.adorei") : o === "NAO_USEI" ? t("lookbookTabs.nao_usei") : t("lookbookTabs.nao_gostei")}</Button>)}</div></Card>}
        <Card><h2 className="type-h3 mb-2">{t("common.historico")}</h2>{(data.history ?? []).length === 0 ? <p className="type-body text-muted">{t("common.empty")}</p> : <ul className="fai-list">{(data.history ?? []).map((h) => <li key={h.date} className="flex items-center justify-between gap-2 py-2 type-body-sm"><span>{fmtDate(h.date)} · {h.title ?? h.scheme?.title ?? ""}</span><span className="flex items-center gap-2"><span className="type-data">{h.feedback ?? "—"}</span><DailyHistoryHype id={h.schemeId ?? h.scheme?.id} /></span></li>)}</ul>}</Card>
      </div>
    </div>
  </>);
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
    {/* insights da cápsula (RF53): redescoberta antes de compra, peças-base paradas, versatilidade — acima dos números */}
    <InsightStrip context="CAPSULE" params={{ category }} className="mb-4" />
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

/**
 * Agrupamento sugerido do acervo (LookbookService.groups): cluster por SIMILARIDADE de estilo, ocasião, cor, marca e tipo
 * — não é Hype. `hype` = Hype médio v2 dos membros, mostrado à parte (avgScore nulo = nenhum membro com Hype, nunca 0).
 */
interface SimilarityGroup { id: string; label?: string; name?: string; kind?: string; count?: number; hype?: { avgScore: number | null; level: HypeLevel | null; items: number; members: number } | null }

/** "Hype médio 72 · Em alta" ao lado do agrupamento; sem base, "Hype médio: —" (sem número inventado). */
function SimilarityGroupHype({ hype }: { hype?: SimilarityGroup["hype"] }) {
  const { t } = useI18n();
  if (!hype) return null;
  if (hype.avgScore == null) return <span className="block type-caption text-faint" title={t("hype.state.insufficient")}>{t("hypeLookbook.grupo_hype_vazio")}</span>;
  return (
    <span className="lb-hype-line type-caption text-muted">{t("hypeLookbook.grupo_hype", { n: displayScore(hype.avgScore), items: hype.items, members: hype.members })}
      {hype.level && <span className={`hype-level-chip ${levelTone(hype.level)}`}>{t(`hype.level.${hype.level}`)}</span>}</span>
  );
}

function GroupsTab({ ownerId, self, suggestions }: { ownerId: string; self: boolean; suggestions: boolean }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast(); const [form, setForm] = useState({ type: "COLECAO", label: "", description: "" }); const [open, setOpen] = useState<string | null>(null);
  const groups = useApi<{ id: string; label: string; type: string; description?: string; coverUrl?: string; count?: number }[]>((signal) => api.get(`/api/users/${ownerId}/groupings`, { signal, anonymous: !user }), [ownerId, !!user]);
  // agrupamentos SUGERIDOS por similaridade (P3-04; a rota antiga /api/me/hype-groups é só um apelido deprecado)
  const similar = useApi<SimilarityGroup[]>((signal) => api.get("/api/me/similarity-groups?type=SCHEME", { signal }), [], { enabled: self });
  const schemes = useApi<SchemeView[]>((signal) => api.get(`/api/groupings/${open}/schemes`, { signal, anonymous: !user }), [open], { enabled: !!open });
  async function create() { try { await api.post("/api/groupings", form); setForm({ type: "COLECAO", label: "", description: "" }); groups.reload(); } catch (e) { toast.fromError(e); } }
  async function suggest() { try { const r = await api.post<{ created?: number; groups?: unknown[]; message?: string }>("/api/me/similarity-groups/suggestions?type=SCHEME"); toast.success(r.message ?? t("lookbookTabs.grupos_sugeridos", { value: r.created ?? r.groups?.length ?? 0 })); similar.reload(); } catch (e) { toast.fromError(e); } }
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div>
        {self && <Card className="mb-4"><h2 className="type-h3 mb-2">{t("lookbookTabs.novo_agrupamento")}</h2><Field label={t("common.tipo")} id="gtype"><Dropdown id="gtype" label={t("common.tipo")} value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={["COLECAO", "TEMPORADA", "EDITORIAL", "CAPSULA", "VIAGEM"].map((x) => ({ id: x, label: label(x.toLowerCase()) }))} /></Field><Field label={t("common.nome")} id="glabel"><Input id="glabel" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field><Button variant="primary" onClick={create} disabled={!form.label.trim()}>{t("common.add")}</Button></Card>}
        {self && suggestions && <Card className="mb-4"><h2 className="type-h3 mb-1">{t("hypeLookbook.grupos_titulo")}</h2><p className="type-caption text-muted mb-2">{t("hypeLookbook.grupos_dica")}</p><Button size="sm" onClick={suggest}>{t("lookbookTabs.sugerir_grupos")}</Button>
          <ul className="fai-list mt-2">{(similar.data ?? []).map((g) => <li key={g.id} className="flex items-center justify-between gap-2 py-1 type-body-sm"><span className="min-w-0"><span className="block truncate">{g.label ?? g.name}</span><SimilarityGroupHype hype={g.hype} /></span><button type="button" className="underline type-caption" onClick={async () => { try { await api.delete(`/api/me/similarity-groups/${g.id}`); similar.reload(); } catch (e) { toast.fromError(e); } }}>{t("common.remove")}</button></li>)}</ul></Card>}
        <ul className="fai-list surface">{(groups.data ?? []).map((g) => <li key={g.id}><button type="button" className={`flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2 ${open === g.id ? "bg-surface-2" : ""}`} onClick={() => setOpen(g.id)}><Avatar src={mediaUrl(g.coverUrl)} name={g.label} size={36} /><span className="flex-1"><b>{g.label}</b><span className="block type-caption text-muted">{label(g.type.toLowerCase())}{g.count != null ? ` · ${g.count}` : ""}</span></span></button></li>)}{(groups.data ?? []).length === 0 && <li className="p-3 type-body text-muted">{t("common.empty")}</li>}</ul>
      </div>
      <div>{open ? schemes.loading ? <SkeletonGrid /> : <div className="grid-looks">{(schemes.data ?? []).map((s) => <SchemeCard key={s.id} scheme={s} />)}</div> : <p className="type-body text-muted">{t("lookbookTabs.selecione_um_agrupamento")}</p>}</div>
    </div>
  );
}

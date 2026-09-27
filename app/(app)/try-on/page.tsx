"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError, mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import dynamic from "next/dynamic";
import { retryImport } from "@/lib/chunk-recovery";
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, SegmentPicker, Select, Skeleton, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import type { AvatarView } from "@/components/three/avatar-viewer";
import { validateBody } from "@/lib/avatar3d/body-spec";

const AvatarViewer = dynamic(() => retryImport(() => import("@/components/three/avatar-viewer")), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });

type Sex = "MASCULINO" | "FEMININO";
type Layer = "BASE" | "INTERMEDIATE" | "OUTER" | "ACCESSORY";
interface Box { x: number; y: number; w: number; h: number; }
interface Mannequin { sex: Sex; build: string; skinTone?: string | null; skinHex: string; width: number; height: number; shoulderW: number; waistW: number; hipW: number; headR: number; landmarks: Record<string, { x: number; y: number }>; anchors: Record<string, Box>; levels?: Record<string, number>; params?: Record<string, number>; }
/** De onde vem o manequim: "avatar" (digital double do perfil: sexo, corpo medido/informado e pele) ou "preferences" (genérico). */
interface Identity { source: "avatar" | "preferences"; sex: Sex; sexSource: string; skinHex: string; skinSource: "observed" | "preference"; heightCm?: number | null; sources: Record<string, string>; warnings: string[]; }
/** Cada peça elegível chega com a camada, a âncora no corpo e a chave de substituição calculadas pelo servidor. */
interface Entry { piece: PieceView; slot: string; layer: Layer; anchor: string; replacementKey: string; backgroundRemoved: boolean; }
interface State { mannequin: Mannequin; sex: Sex; skinTones: Record<string, string>; builds: string[]; layers: Layer[]; pieces: Partial<Record<Layer, Entry[]>>; externalAvailable: boolean; identity?: Identity; avatar?: Avatar3dRef | null; }
/** slot do provador → slot do manequim 3D (mesma peça, mesmo corpo). */
const SLOT3D: Record<string, string> = { TOP: "upper", OUTERWEAR: "outer_layer", BOTTOM: "lower", FULL_BODY: "dress", SHOES: "shoes", ACCESSORY: "accessory" };
const toLook3d = (e: Entry): Look3dPiece => ({ id: e.piece.id, name: e.piece.name, slot: SLOT3D[e.slot] ?? "accessory", category: e.piece.category, subcategory: e.piece.subcategory, imageUrl: e.piece.imageUrl ?? e.piece.thumbnailUrl, colorHex: e.piece.colorHex, model3dUrl: e.piece.model3dUrl ?? null, defaultImage: e.piece.defaultImage });
const MEASURES = ["stature", "shoulderW", "chestW", "waistW", "hipW"] as const;
interface Render { imageUrl: string; photoId?: string; pieceIds: string[]; warnings?: string[]; replaced?: string[]; stages?: { name: string; provider?: string; ms?: number }[]; costUsd?: number; totalMs?: number; fallbackUsed?: boolean; message?: string; explanation?: { provider?: string }; }

const LAYER_ORDER: Layer[] = ["BASE", "INTERMEDIATE", "OUTER", "ACCESSORY"];
const LAYER_LABEL: Record<Layer, string> = { get BASE() { return tr("common.base"); }, get INTERMEDIATE() { return tr("tryOn.intermediaria"); }, get OUTER() { return tr("tryOn.externa"); }, get ACCESSORY() { return tr("common.acessorio"); } };
const BUILD_LABEL: Record<string, string> = { get SLIM() { return tr("tryOn.magro"); }, get MEDIUM() { return tr("tryOn.medio"); }, get ATHLETIC() { return tr("tryOn.atletico"); }, get CURVY() { return tr("tryOn.curvilineo"); }, get PLUS() { return tr("tryOn.plus_size"); } };
const DRAG_TYPE = "text/fai-piece";

/**
 * CA03 no cliente — a peça nova ocupa a camada/âncora dela; a que estava lá sai e o usuário é avisado. Peça inteira
 * (vestido, macacão) tira parte de cima e de baixo; parte de cima/baixo tira a peça inteira.
 */
function dress(current: string[], id: string, byId: Map<string, Entry>): { next: string[]; notices: string[] } {
  const e = byId.get(id); if (!e) return { next: current, notices: [] };
  const notices: string[] = [];
  const next = current.filter((other) => {
    if (other === id) return false;
    const o = byId.get(other); if (!o) return false;
    if (o.replacementKey === e.replacementKey) { notices.push(tr("tryOn.substituiu_na_camada", { name: e.piece.name, name2: o.piece.name, toLowerCase: LAYER_LABEL[e.layer].toLowerCase() })); return false; }
    if (e.slot === "FULL_BODY" && (o.slot === "TOP" || o.slot === "BOTTOM")) { notices.push(tr("tryOn.peca_inteira_substituiu", { name: e.piece.name, name2: o.piece.name })); return false; }
    if (o.slot === "FULL_BODY" && (e.slot === "TOP" || e.slot === "BOTTOM")) { notices.push(tr("tryOn.substituiu_a_peca_inteira", { name: e.piece.name, name2: o.piece.name })); return false; }
    return true;
  });
  return { next: [...next, id], notices };
}

/** Manequim vetorial com a mesma geometria do compositor local (TryOnCompositor.drawMannequin), para a prévia bater com o render. */
function MannequinBody({ m }: { m: Mannequin }) {
  const W = m.width, H = m.height, cx = W / 2, male = m.sex === "MASCULINO";
  const shoulder = m.shoulderW * W, waist = m.waistW * W, hip = m.hipW * W, headR = m.headR * W;
  // níveis do corpo: com avatar vêm das mesmas fórmulas do corpo 3D; sem avatar, os do manequim genérico
  const lv = m.levels ?? { headTop: 0.045, shoulder: 0.205, waist: male ? 0.455 : 0.43, hip: 0.52, crotch: 0.52, ankle: 0.9 };
  const yS = lv.shoulder * H, yW = lv.waist * H, yH = (m.params ? lv.crotch : lv.hip) * H, yA = lv.ankle * H, yTop = lv.headTop * H;
  const legs = [-1, 1].map((sd) => {
    const outer = cx + sd * hip / 2, inner = cx + sd * hip * 0.04, ankle = cx + sd * hip * 0.2;
    return { d: `M ${outer} ${yH - 10} C ${outer + sd * 6} ${0.62 * H} ${ankle + sd * 26} ${0.78 * H} ${ankle + sd * 16} ${yA} L ${ankle - sd * 14} ${yA} C ${ankle - sd * 20} ${0.78 * H} ${inner} ${0.64 * H} ${inner} ${yH + 20} Z`, foot: [ankle + sd * 6, yA + 9] };
  });
  const arms = [-1, 1].map((sd) => {
    const sx = cx + sd * shoulder / 2, wx = cx + sd * (shoulder / 2 + 0.045 * W);
    return { d: `M ${sx - sd * 6} ${yS + 6} C ${sx + sd * 30} ${yS + 40} ${wx + sd * 20} ${0.4 * H} ${wx + sd * 12} ${0.505 * H} L ${wx - sd * 14} ${0.505 * H} C ${wx - sd * 8} ${0.4 * H} ${sx - sd * 6} ${yS + 90} ${sx - sd * 22} ${yS + 40} Z`, hand: [wx + sd * 2 - 1, 0.505 * H + 20] };
  });
  const torso = `M ${cx - shoulder / 2} ${yS} C ${cx - shoulder / 2 - 4} ${yS + 80} ${cx - waist / 2} ${yW - 60} ${cx - waist / 2} ${yW} C ${cx - waist / 2} ${yW + 30} ${cx - hip / 2} ${yH - 30} ${cx - hip / 2} ${yH} L ${cx + hip / 2} ${yH} C ${cx + hip / 2} ${yH - 30} ${cx + waist / 2} ${yW + 30} ${cx + waist / 2} ${yW} C ${cx + waist / 2} ${yW - 60} ${cx + shoulder / 2 + 4} ${yS + 80} ${cx + shoulder / 2} ${yS} C ${cx + shoulder / 4} ${yS - 22} ${cx - shoulder / 4} ${yS - 22} ${cx - shoulder / 2} ${yS} Z`;
  return (
    <g>
      <defs><linearGradient id="tryon-skin" x1="0" x2="1"><stop offset="0" stopColor={m.skinHex} stopOpacity=".78" /><stop offset=".5" stopColor={m.skinHex} /><stop offset="1" stopColor={m.skinHex} stopOpacity=".78" /></linearGradient></defs>
      <rect width={W} height={H} fill="#EFECE7" />
      <g fill="url(#tryon-skin)">
        {legs.map((l, i) => <g key={i}><path d={l.d} /><ellipse cx={l.foot[0]} cy={l.foot[1]} rx={26} ry={15} /></g>)}
        {arms.map((a, i) => <g key={i}><path d={a.d} /><ellipse cx={a.hand[0]} cy={a.hand[1]} rx={15} ry={24} /></g>)}
        <path d={torso} stroke="rgba(0,0,0,.12)" strokeWidth="1.2" />
      </g>
      <path d={`M ${cx - hip / 2 + 2} ${yH - 34} L ${cx + hip / 2 - 2} ${yH - 34} L ${cx + hip * 0.12} ${yH + 38} L ${cx - hip * 0.12} ${yH + 38} Z`} fill="#B9B4AD" />
      {!male && <rect x={cx - shoulder * 0.36} y={yS + 58} width={shoulder * 0.72} height={62} rx={15} fill="#B9B4AD" />}
      <rect x={cx - headR * 0.45} y={yTop + headR * 2.1} width={headR * 0.9} height={Math.max(8, yS - (yTop + headR * 2.1))} rx={9} fill={m.skinHex} />
      <ellipse cx={cx} cy={yTop + headR * 1.225} rx={headR} ry={headR * 1.225} fill="url(#tryon-skin)" />
    </g>
  );
}

function TryOnInner() {
  const { t, rich } = useI18n(); const toast = useToast(); const sp = useSearchParams();
  const { data, loading, error, reload } = useApi<State>((signal) => api.get("/api/try-on", { signal }), []);
  const [dressed, setDressed] = useState<string[]>([]);
  const [render, setRender] = useState<Render | null>(null); const [busy, setBusy] = useState(false); const [title, setTitle] = useState("");
  const [over, setOver] = useState(false); const [confirmClear, setConfirmClear] = useState(false); const [fixing, setFixing] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  // digital double: com avatar, o palco mostra o mesmo personagem 3D do perfil (vestido com as peças); a silhueta 2D é a projeção dele
  const [stage, setStage] = useState<"avatar" | "silhueta">("avatar"); const [view3d, setView3d] = useState<AvatarView>("front");
  const byId = useMemo(() => { const m = new Map<string, Entry>(); LAYER_ORDER.forEach((l) => (data?.pieces[l] ?? []).forEach((e) => m.set(e.piece.id, e))); return m; }, [data]);
  // peças que já vieram de um look (?scheme=) entram na ordem de camadas
  useEffect(() => {
    const s = sp.get("scheme"); if (!s || !data) return;
    api.get<{ scheme: { items: { wardrobeItemId: string }[] } }>(`/api/schemes/${s}`).then((r) => {
      let cur: string[] = []; r.scheme.items.forEach((i) => { cur = dress(cur, i.wardrobeItemId, byId).next; }); setDressed(cur);
    }).catch(() => undefined);
  }, [sp, data, byId]);
  // uma peça que deixou de ser compatível (troca de manequim) sai do corpo
  useEffect(() => { setDressed((d) => d.filter((id) => byId.has(id))); }, [byId]);

  function put(id: string) {
    const r = dress(dressed, id, byId); setDressed(r.next); setRender(null); setNotices(r.notices); r.notices.forEach((n) => toast.info(n));
  }
  function takeOff(id: string) { setDressed((d) => d.filter((x) => x !== id)); setRender(null); }
  async function savePrefs(patch: { skinTone?: string; build?: string }) { try { await api.put("/api/try-on/preferences", patch); setRender(null); reload(); } catch (e) { toast.fromError(e); } }
  async function doRender() {
    setBusy(true);
    try { const r = await api.post<Render>("/api/try-on/renders", { sex: data?.sex, pieceIds: dressed }); setRender(r); if (r.message) toast.info(r.message); } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function removeBg(id: string) {
    setFixing(id);
    try { const r = await api.post<{ ok: boolean; message?: string }>(`/api/pieces/${id}/background-removal`); if (r.ok) { toast.success(t("tryOn.fundo_removido_a_peca_agora")); reload(); } else toast.info(r.message ?? t("tryOn.nao_deu_para_remover_o")); } catch (e) { toast.fromError(e); } finally { setFixing(null); }
  }
  async function saveScheme() {
    try { const r = await api.post<{ schemeId?: string }>("/api/try-on/schemes", { pieceIds: dressed, title: title || undefined, tryOnUrl: render?.imageUrl ?? null }); toast.success(t("scheme.saved")); if (r.schemeId) window.location.href = `/schemes/${r.schemeId}`; } catch (e) { toast.fromError(e); }
  }

  if (error instanceof ApiError && error.code === "ACERVO_VAZIO") return <><PageHeader title={t("nav.tryon")} kicker="RF18" /><EmptyState title={t("tryOn.seu_guarda_roupa_ainda_esta")} hint={error.message} action={<Link href="/add-piece" className="btn btn-primary">{t("common.cadastrar_peca")}</Link>} /></>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const m = data.mannequin;
  const on = LAYER_ORDER.flatMap((l) => dressed.map((id) => byId.get(id)).filter((e): e is Entry => !!e && e.layer === l));
  const approximate = on.filter((e) => !e.backgroundRemoved);
  const skin = m.skinTone ?? "media";
  const avatar = data.avatar ?? null; const identity = data.identity;
  const bodyParams = avatar ? validateBody(avatar.model?.body)?.params ?? null : null;
  const sourceLabel = (src?: string) => src === "observed" ? t("tryOn.fonte_observed") : src === "user" ? t("tryOn.fonte_user") : src === "estimated" ? t("tryOn.fonte_estimated") : t("tryOn.fonte_default");
  const measureLabel: Record<(typeof MEASURES)[number], string> = { stature: t("tryOn.m_stature"), shoulderW: t("tryOn.m_shoulderW"), chestW: t("tryOn.m_chestW"), waistW: t("tryOn.m_waistW"), hipW: t("tryOn.m_hipW") };
  return (
    <>
      <PageHeader title={t("nav.tryon")} kicker="RF18" lead={t("tryOn.arraste_uma_peca_ate_o", { value: data.externalAvailable ? t("tryOn.o_render_final_usa_try") : t("tryOn.o_render_final_usa_o") })} />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="grid content-start gap-3">
          <Card pad={false}>
            <div className={`tryon-stage ${over ? "is-over" : ""}`} aria-label={t("tryOn.manequim_solte_uma_peca_aqui")} role="region"
              onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setOver(true); } }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData(DRAG_TYPE); if (id) put(id); }}>
              {render?.imageUrl ? <img src={mediaUrl(render.imageUrl)} alt={t("tryOn.look_provado_no_manequim")} className="h-full w-full object-contain" /> : avatar && stage === "avatar" ? (
                <div className="h-full w-full" aria-label={t("tryOn.manequim_com_peca_s", { toLowerCase: m.sex.toLowerCase(), onCount: on.length })}>
                  <AvatarViewer avatar={avatar} sex={data.sex} body={bodyParams} pieces={on.map(toLook3d)} view={view3d} framing="full" controls={false} background="#EFECE7" />
                </div>
              ) : (
                <svg viewBox={`0 0 ${m.width} ${m.height}`} className="h-full w-full" role="img" aria-label={t("tryOn.manequim_com_peca_s", { toLowerCase: m.sex.toLowerCase(), onCount: on.length })}>
                  <MannequinBody m={m} />
                  {on.map((e, i) => {
                    const b = m.anchors[e.anchor] ?? m.anchors[e.slot]; if (!b) return null; const src = mediaUrl(e.piece.imageUrl ?? e.piece.thumbnailUrl); if (!src) return null;
                    return <image key={e.piece.id} href={src} x={b.x * m.width} y={b.y * m.height} width={b.w * m.width} height={b.h * m.height} preserveAspectRatio={e.slot === "SHOES" || e.anchor === "feet" ? "xMidYMax meet" : e.slot === "ACCESSORY" ? "xMidYMid meet" : "xMidYMin meet"}
                      style={e.backgroundRemoved ? undefined : { mixBlendMode: "multiply", opacity: 0.92 }} data-layer={e.layer} data-order={i} />;
                  })}
                </svg>
              )}
              {!on.length && !render && <p className="tryon-drop-hint">{t("tryOn.solte_uma_peca_aqui")}</p>}
              {render && <Badge tone="thread" className="absolute left-2 top-2">{t("tryOn.render", { value: render.fallbackUsed ? t("common.local") : render.explanation?.provider ?? "" })}</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2 p-3">
              {avatar ? (
                <>
                  <SegmentPicker label={t("common.manequim")} value={stage} onChange={(v) => { setStage(v); setRender(null); }} options={[{ id: "avatar", label: t("tryOn.avatar_3d") }, { id: "silhueta", label: t("tryOn.silhueta_2d") }]} />
                  {stage === "avatar" && <SegmentPicker label={t("tryOn.vista")} value={view3d} onChange={setView3d} options={[{ id: "front", label: t("tryOn.vista_frente") }, { id: "profile", label: t("tryOn.vista_perfil") }, { id: "back", label: t("tryOn.vista_costas") }]} />}
                </>
              ) : (
                // sem escolha de sexo: o manequim é o do perfil (sexo do cadastro), o mesmo do Avatar 3D quando ele existir
                <span className="type-caption text-muted">{t("tryOn.manequim_do_perfil")}</span>
              )}
              <Button size="sm" variant="ghost" className="ml-auto" disabled={!dressed.length && !render} onClick={() => setConfirmClear(true)}><FaiIcon id="ACT-24" size={24} decorative />{t("common.limpar")}</Button>
            </div>
          </Card>
          <Card>
            {avatar && identity ? (
              <>
                <p className="label">{t("tryOn.identidade")}</p>
                <p className="type-body-sm">{t("tryOn.manequim_e_seu_avatar")}</p>
                <div className="fai-list mt-2 type-caption">
                  <p className="list-row flex items-center gap-2"><span aria-hidden className="piece-swatch" style={{ background: identity.skinHex }} />{identity.skinSource === "observed" ? t("tryOn.pele_medida") : t("tryOn.pele_preferencia")}</p>
                  {MEASURES.map((k) => <p key={k} className="list-row flex items-center justify-between gap-2"><span>{measureLabel[k]}</span><span className={`badge src-${identity.sources[k] ?? "default"}`}>{sourceLabel(identity.sources[k])}</span></p>)}
                </div>
                <p className="mt-2 type-caption text-muted">{t("tryOn.previa_3d_nota")}</p>
                <Link href="/avatar" className="btn btn-sm mt-2"><FaiIcon id="ACT-21" size={20} variant="glyph" decorative />{t("tryOn.ajustar_no_avatar")}</Link>
              </>
            ) : (
              <>
                <p className="mb-2 rounded-md border border-line-soft bg-surface-2 p-2 type-caption">{t("tryOn.sem_avatar_crie")} <Link href="/avatar" className="underline">{t("tryOn.ajustar_no_avatar")}</Link></p>
                <p className="label">{rich("tryOn.tom_de_pele_salvo_no", undefined, { 0: ($c) => <span className="type-caption text-faint">{$c}</span> })}</p>
                <div className="mb-2 flex flex-wrap gap-1.5">{Object.entries(data.skinTones).map(([id, hex]) => <button key={id} type="button" title={label(id)} aria-label={t("tryOn.tom_de_pele", { label: label(id) })} aria-pressed={skin === id} className={`h-7 w-7 rounded-full border-2 ${skin === id ? "border-mark" : "border-line-soft"}`} style={{ background: hex }} onClick={() => savePrefs({ skinTone: id })} />)}</div>
                <Field label={t("tryOn.porte")} id="build"><Select id="build" value={m.build} onChange={(e) => savePrefs({ build: e.target.value })}>{data.builds.map((b) => <option key={b} value={b}>{BUILD_LABEL[b] ?? b.toLowerCase()}</option>)}</Select></Field>
              </>
            )}
          </Card>
          {render && <Card><p className="label">{t("tryOn.render_2")}</p><p className="type-caption text-muted">{t("tryOn.ms_2", { value: render.fallbackUsed ? t("tryOn.compositor_local") : render.explanation?.provider ?? "", value2: render.totalMs ?? 0, value3: render.costUsd ? t("tryOn.us", { costUsd: render.costUsd }) : "" })}</p>{render.stages?.length ? <ul className="type-caption">{render.stages.map((s, i) => <li key={i}>{s.name} · {s.provider ?? ""} {s.ms ? t("common.ms", { ms: s.ms }) : ""}</li>)}</ul> : null}{render.warnings?.length ? <ul className="mt-2 grid gap-1 type-caption text-muted">{render.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}</ul> : null}</Card>}
        </div>
        <div className="grid content-start gap-4">
          <Card>
            <div className="mb-2 flex items-center justify-between gap-2"><h2 className="type-h3">{t("tryOn.no_manequim")}</h2><span className="type-caption text-muted">{t("tryOn.peca_s_ordem_de_vestir", { onCount: on.length })}</span></div>
            {!on.length ? <p className="type-body text-muted">{t("tryOn.nada_ainda_arraste_uma_peca")}</p> : (
              <ol className="tryon-layers">{LAYER_ORDER.map((l) => { const list = on.filter((e) => e.layer === l); return (
                <li key={l} className={list.length ? "" : "is-empty"}><span className="tryon-layer-name">{LAYER_LABEL[l]}</span>
                  <div className="flex flex-wrap gap-1.5">{list.length ? list.map((e) => (
                    <span key={e.piece.id} className="tryon-worn"><img src={mediaUrl(e.piece.thumbnailUrl ?? e.piece.imageUrl)} alt="" />{e.piece.name}
                      {!e.backgroundRemoved && <Badge tone="chalk">{t("tryOn.sobreposicao_aproximada")}</Badge>}
                      <button type="button" aria-label={t("tryOn.tirar", { name: e.piece.name })} onClick={() => takeOff(e.piece.id)}>✕</button></span>)) : <span className="type-caption text-faint">—</span>}</div>
                </li>); })}</ol>
            )}
            {notices.length > 0 && <p className="mt-2 type-caption text-thread" role="status">{notices.join(" ")}</p>}
            {approximate.length > 0 && (
              <div className="mt-3 rounded-md border border-line-soft bg-surface-2 p-2 type-caption" role="note">
                <p>{rich("tryOn.peca_s_com_fundo_na", { approximateCount: approximate.length }, { 0: ($c) => <b>{$c}</b> })}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">{approximate.map((e) => <Button key={e.piece.id} size="sm" loading={fixing === e.piece.id} onClick={() => removeBg(e.piece.id)}>{t("tryOn.remover_fundo", { name: e.piece.name })}</Button>)}</div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={doRender} loading={busy} disabled={!on.length}><FaiIcon id="NAV-07" size={24} decorative />{t("tryOn.provar", { onCount: on.length })}</Button>
              <Input aria-label={t("tryOn.titulo_do_look")} className="max-w-xs" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("tryOn.titulo_do_look_opcional")} />
              <Button onClick={saveScheme} disabled={!on.length}><FaiIcon id="ACT-25" size={24} decorative />{t("common.salvar_como_look")}</Button>
            </div>
            <p className="mt-1 type-caption text-faint">{t("tryOn.o_look_salvo_entra_em")}</p>
          </Card>
          {LAYER_ORDER.map((layer) => { const list = data.pieces[layer] ?? []; if (!list.length) return null; return (
            <section key={layer} aria-label={t("tryOn.acervo_camada", { LAYER_LABEL: LAYER_LABEL[layer] })}><h2 className="type-h3 mb-2">{LAYER_LABEL[layer]} <span className="type-caption text-muted">· {list.length}</span></h2>
              <div className="flex flex-wrap gap-2">{list.map((e) => { const worn = dressed.includes(e.piece.id); return (
                <button key={e.piece.id} type="button" draggable aria-pressed={worn} title={worn ? t("tryOn.tirar_do_manequim") : t("tryOn.arraste_ao_manequim_ou_toque")}
                  onDragStart={(ev) => { ev.dataTransfer.setData(DRAG_TYPE, e.piece.id); ev.dataTransfer.effectAllowed = "copy"; }}
                  onClick={() => (worn ? takeOff(e.piece.id) : put(e.piece.id))}
                  className={`tryon-rack-item ${worn ? "is-worn" : ""}`}>
                  <img src={mediaUrl(e.piece.thumbnailUrl ?? e.piece.imageUrl)} alt="" className="aspect-square w-full object-contain" draggable={false} />
                  <span className="block truncate type-caption">{e.piece.name}</span>
                  {!e.backgroundRemoved && <span className="tryon-bg-flag" title={t("tryOn.fundo_nao_removido_sobreposicao")}>{t("tryOn.fundo")}</span>}
                </button>); })}</div>
            </section>); })}
        </div>
      </div>
      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} title={t("tryOn.limpar_o_manequim")}
        footer={<><Button onClick={() => setConfirmClear(false)}>{t("common.cancel")}</Button><Button variant="primary" onClick={() => { setDressed([]); setRender(null); setNotices([]); setConfirmClear(false); toast.info(t("tryOn.manequim_limpo_suas_pecas_continuam")); }}>{t("common.limpar")}</Button></>}>
        <p className="type-body">{t("tryOn.todas_as_peca_s_saem", { onCount: on.length })}</p>
      </Dialog>
    </>
  );
}
export default function TryOnPage() { return <RequireAuth><Suspense><TryOnInner /></Suspense></RequireAuth>; }

"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError, mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import dynamic from "next/dynamic";
import { retryImport } from "@/lib/chunk-recovery";
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, Field, PageHeader, SegmentPicker, Select, Skeleton, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import type { Avatar3dRef, Look3dPiece } from "@/components/three/common";
import type { AvatarView } from "@/components/three/avatar-viewer";
import { validateBody } from "@/lib/avatar3d/body-spec";

const AvatarViewer = dynamic(() => retryImport(() => import("@/components/three/avatar-viewer")), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });

/*
 * Provador (RF18) — experimentar peças no próprio corpo, sem criar look nem post.
 *  - Quatro lugares, pela CATEGORIA gravada da peça: parte de cima, parte de baixo, calçado, acessório. Tocar numa peça
 *    veste no lugar dela e troca só aquele lugar; os outros continuam.
 *  - O palco é o Avatar 3D da pessoa (o mesmo do perfil). Sem avatar, o manequim de referência, identificado como tal.
 *  - A roupa é uma PRÉVIA: a foto da peça projetada no molde do corpo. O FashionAI ainda não tem malha de roupa vestível
 *    com articulações; a tela diz isso em vez de chamar a sobreposição de prova 3D.
 *  - As escolhas ficam só nesta sessão do navegador (sessionStorage).
 */
type SlotKey = "upper_piece" | "lower_piece" | "shoes_piece" | "accessory_piece";
const SLOTS: SlotKey[] = ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece"];
type Sex = "MASCULINO" | "FEMININO";
interface Box { x: number; y: number; w: number; h: number; }
interface Mannequin { sex: Sex; build: string; skinTone?: string | null; skinHex: string; width: number; height: number; shoulderW: number; waistW: number; hipW: number; headR: number; landmarks: Record<string, { x: number; y: number }>; anchors: Record<string, Box>; levels?: Record<string, number>; params?: Record<string, number>; }
interface Identity { source: "avatar" | "preferences"; sex: Sex; sexSource: string; skinHex: string; skinSource: "observed" | "preference"; heightCm?: number | null; sources: Record<string, string>; warnings: string[]; }
/** Peça elegível: lugar (categoria), forma de vestir no corpo (molde 3D/âncora 2D) e se a foto já está sem fundo. */
interface Entry { piece: PieceView; slot: SlotKey; wear: string; anchor: string; backgroundRemoved: boolean; }
interface State { mannequin: Mannequin; sex: Sex; skinTones: Record<string, string>; builds: string[]; slots: SlotKey[]; pieces: Record<SlotKey, Entry[]>; needsReview?: Entry[]; identity?: Identity; avatar?: Avatar3dRef | null; }
type Worn = Partial<Record<SlotKey, string>>;

/** forma de vestir → molde do manequim 3D */
const WEAR3D: Record<string, string> = { TOP: "upper", OUTERWEAR: "outer_layer", BOTTOM: "lower", FULL_BODY: "dress", SHOES: "shoes", ACCESSORY: "accessory" };
// a prévia sempre usa a foto projetada no molde do corpo: o modelo 3D gerado da peça (RF16) é um objeto, não uma roupa com
// articulações — colocá-lo sobre o corpo daria uma peça rígida flutuando
const toLook3d = (e: Entry): Look3dPiece => ({ id: e.piece.id, name: e.piece.name, slot: WEAR3D[e.wear] ?? "accessory", category: e.piece.category, subcategory: e.piece.subcategory, imageUrl: e.piece.imageUrl ?? e.piece.thumbnailUrl, colorHex: e.piece.colorHex, model3dUrl: null, defaultImage: e.piece.defaultImage });
const MEASURES = ["stature", "shoulderW", "chestW", "waistW", "hipW"] as const;
const SESSION_KEY = "fai.tryon.worn";

function readSession(): Worn { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "{}") as Worn; } catch { return {}; } }
function writeSession(w: Worn) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(w)); } catch { /* navegação privada: só não lembra */ } }

/** Silhueta 2D derivada da MESMA identidade (níveis e larguras do corpo do avatar): usada só como "Prévia 2D". */
function MannequinBody({ m }: { m: Mannequin }) {
  const W = m.width, H = m.height, cx = W / 2, male = m.sex === "MASCULINO";
  const shoulder = m.shoulderW * W, waist = m.waistW * W, hip = m.hipW * W, headR = m.headR * W;
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
  const { t } = useI18n(); const toast = useToast(); const sp = useSearchParams();
  const { data, loading, error, reload } = useApi<State>((signal) => api.get("/api/try-on", { signal }), []);
  const [worn, setWorn] = useState<Worn>({});
  const [confirmClear, setConfirmClear] = useState(false); const [fixing, setFixing] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [stage, setStage] = useState<"3d" | "2d">("3d"); const [view3d, setView3d] = useState<AvatarView>("front");
  const rackRefs = useRef<Partial<Record<SlotKey, HTMLElement | null>>>({});
  const byId = useMemo(() => { const m = new Map<string, Entry>(); SLOTS.forEach((s) => (data?.pieces?.[s] ?? []).forEach((e) => m.set(e.piece.id, e))); return m; }, [data]);
  const slotName: Record<SlotKey, string> = { upper_piece: t("tryOn.slot_upper"), lower_piece: t("tryOn.slot_lower"), shoes_piece: t("tryOn.slot_shoes"), accessory_piece: t("tryOn.slot_accessory") };

  // sessão de prova: lembra as quatro escolhas enquanto a pessoa navega (só neste navegador; nada vai para o servidor)
  useEffect(() => { if (!data) return; const saved = readSession(); const ok: Worn = {}; SLOTS.forEach((s) => { const id = saved[s]; if (id && byId.get(id)?.slot === s) ok[s] = id; }); setWorn(ok); }, [data, byId]);
  // peças de um look (?scheme=): cada uma no seu lugar
  useEffect(() => {
    const s = sp.get("scheme"); if (!s || !data) return;
    api.get<{ scheme: { items: { wardrobeItemId: string }[] } }>(`/api/schemes/${s}`).then((r) => {
      const next: Worn = {}; r.scheme.items.forEach((i) => { const e = byId.get(i.wardrobeItemId); if (e) next[e.slot] = e.piece.id; }); setWorn(next); writeSession(next);
    }).catch(() => undefined);
  }, [sp, data, byId]);

  function choose(e: Entry) {
    const next = { ...worn, [e.slot]: e.piece.id }; setWorn(next); writeSession(next);
    setStatus(t("tryOn.vestiu_no_lugar", { name: e.piece.name, slot: slotName[e.slot] }));
  }
  function remove(slot: SlotKey) {
    const next = { ...worn }; delete next[slot]; setWorn(next); writeSession(next); setStatus(t("tryOn.lugar_vazio_status", { slot: slotName[slot] }));
  }
  async function savePrefs(patch: { skinTone?: string; build?: string }) { try { await api.put("/api/try-on/preferences", patch); reload(); } catch (e) { toast.fromError(e); } }
  async function removeBg(id: string) {
    setFixing(id);
    try { const r = await api.post<{ ok: boolean; message?: string }>(`/api/pieces/${id}/background-removal`); if (r.ok) { toast.success(t("tryOn.fundo_removido_a_peca_agora")); reload(); } else toast.info(r.message ?? t("tryOn.nao_deu_para_remover_o")); } catch (e) { toast.fromError(e); } finally { setFixing(null); }
  }

  if (error instanceof ApiError && error.code === "ACERVO_VAZIO") return <><PageHeader title={t("nav.tryon")} kicker="RF18" /><EmptyState title={t("tryOn.seu_guarda_roupa_ainda_esta")} hint={error.message} action={<Link href="/pieces/new" className="btn btn-primary">{t("common.cadastrar_peca")}</Link>} /></>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const m = data.mannequin;
  const on = SLOTS.map((s) => (worn[s] ? byId.get(worn[s]!) : undefined)).filter((e): e is Entry => !!e);
  // peça inteira na parte de cima cobre a parte de baixo: a de baixo fica guardada e não é desenhada
  const fullBody = on.find((e) => e.wear === "FULL_BODY");
  const shown = fullBody ? on.filter((e) => e.slot !== "lower_piece") : on;
  const avatar = data.avatar ?? null; const identity = data.identity;
  const bodyParams = avatar ? validateBody(avatar.model?.body)?.params ?? null : null;
  const skin = m.skinTone ?? "media";
  const sourceLabel = (src?: string) => src === "observed" ? t("tryOn.fonte_observed") : src === "user" ? t("tryOn.fonte_user") : src === "estimated" ? t("tryOn.fonte_estimated") : t("tryOn.fonte_default");
  const measureLabel: Record<(typeof MEASURES)[number], string> = { stature: t("tryOn.m_stature"), shoulderW: t("tryOn.m_shoulderW"), chestW: t("tryOn.m_chestW"), waistW: t("tryOn.m_waistW"), hipW: t("tryOn.m_hipW") };
  const pieceNote = (e: Entry) => e.piece.model3dStatus === "COMPLETED" ? t("tryOn.peca_3d_objeto") : t("tryOn.peca_sem_3d");
  return (
    <>
      <PageHeader title={t("nav.tryon")} kicker="RF18" lead={t("tryOn.lead_slots")} />
      <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
        <div className="grid content-start gap-3">
          <Card pad={false}>
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3">
              <Badge tone={avatar ? "thread" : "chalk"}>{avatar ? t("tryOn.seu_avatar_badge") : t("tryOn.referencia_badge")}</Badge>
              <Badge tone="chalk">{stage === "3d" ? t("tryOn.previa_projetada_badge") : t("tryOn.previa_2d_badge")}</Badge>
            </div>
            <div className="tryon-stage" role="region" aria-label={t("tryOn.palco_aria", { n: shown.length })}>
              {stage === "3d" ? (
                <div className="h-full w-full">
                  <AvatarViewer avatar={avatar} sex={data.sex} build={m.build} skinTone={avatar ? null : m.skinTone} body={bodyParams} pieces={shown.map(toLook3d)} view={view3d} framing="full" controls background="#EFECE7" />
                </div>
              ) : (
                <svg viewBox={`0 0 ${m.width} ${m.height}`} className="h-full w-full" role="img" aria-label={t("tryOn.previa_2d_aria", { n: shown.length })}>
                  <MannequinBody m={m} />
                  {shown.map((e) => {
                    const b = m.anchors[e.anchor] ?? m.anchors[e.wear]; if (!b) return null; const src = mediaUrl(e.piece.imageUrl ?? e.piece.thumbnailUrl); if (!src) return null;
                    return <image key={e.piece.id} href={src} x={b.x * m.width} y={b.y * m.height} width={b.w * m.width} height={b.h * m.height} preserveAspectRatio={e.slot === "shoes_piece" ? "xMidYMax meet" : e.slot === "accessory_piece" ? "xMidYMid meet" : "xMidYMin meet"}
                      style={e.backgroundRemoved || e.piece.defaultImage ? undefined : { mixBlendMode: "multiply", opacity: 0.92 }} />;
                  })}
                </svg>
              )}
            </div>
            <div className="grid gap-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <SegmentPicker label={t("tryOn.modo")} value={stage} onChange={setStage} options={[{ id: "3d", label: avatar ? t("tryOn.avatar_3d") : t("tryOn.manequim_3d_referencia") }, { id: "2d", label: t("tryOn.previa_2d") }]} />
                <Button size="sm" variant="ghost" className="ml-auto" disabled={!on.length} onClick={() => setConfirmClear(true)}><FaiIcon id="ACT-24" size={24} decorative />{t("common.limpar")}</Button>
              </div>
              {stage === "3d" && <SegmentPicker label={t("tryOn.vista")} value={view3d} onChange={setView3d} options={[{ id: "front", label: t("tryOn.vista_frente") }, { id: "profile", label: t("tryOn.vista_perfil") }, { id: "back", label: t("tryOn.vista_costas") }]} />}
              {stage === "3d" && <p className="type-caption text-muted">{t("tryOn.girar_dica")}</p>}
              <p className="type-caption text-muted" role="note">{stage === "3d" ? t("tryOn.nao_e_prova_3d") : t("tryOn.previa_2d_nota")}</p>
            </div>
          </Card>
          <Card>
            {avatar && identity ? (
              <>
                <p className="label">{t("tryOn.identidade")}</p>
                <p className="type-body-sm">{t("tryOn.manequim_e_seu_avatar")}</p>
                {!bodyParams && <p className="mt-2 rounded-md border border-line-soft bg-surface-2 p-2 type-caption" role="note">{t("tryOn.corpo_referencia_aviso")}</p>}
                <div className="fai-list mt-2 type-caption">
                  <p className="list-row flex items-center gap-2"><span aria-hidden className="piece-swatch" style={{ background: identity.skinHex }} />{identity.skinSource === "observed" ? t("tryOn.pele_medida") : t("tryOn.pele_preferencia")}</p>
                  {MEASURES.map((k) => <p key={k} className="list-row flex items-center justify-between gap-2"><span>{measureLabel[k]}</span><span className={`badge src-${identity.sources[k] ?? "default"}`}>{sourceLabel(identity.sources[k])}</span></p>)}
                </div>
                <Link href="/avatar" className="btn btn-sm mt-2"><FaiIcon id="ACT-21" size={20} variant="glyph" decorative />{t("tryOn.ajustar_no_avatar")}</Link>
              </>
            ) : (
              <>
                <p className="mb-2 type-body-sm">{t("tryOn.sem_avatar_cta")}</p>
                <Link href="/avatar" className="btn btn-primary btn-sm mb-3"><FaiIcon id="ACT-21" size={20} variant="glyph" decorative />{t("tryOn.criar_avatar")}</Link>
                <p className="label">{t("tryOn.tom_de_pele_referencia")}</p>
                <div className="mb-2 flex flex-wrap gap-1.5">{Object.entries(data.skinTones).map(([id, hex]) => <button key={id} type="button" title={label(id)} aria-label={t("tryOn.tom_de_pele", { label: label(id) })} aria-pressed={skin === id} className={`h-7 w-7 rounded-full border-2 ${skin === id ? "border-mark" : "border-line-soft"}`} style={{ background: hex }} onClick={() => savePrefs({ skinTone: id })} />)}</div>
                <Field label={t("tryOn.porte")} id="build"><Select id="build" value={m.build} onChange={(e) => savePrefs({ build: e.target.value })}>{data.builds.map((b) => <option key={b} value={b}>{t(`tryOn.porte_${b.toLowerCase()}`)}</option>)}</Select></Field>
              </>
            )}
          </Card>
        </div>
        <div className="grid content-start gap-4">
          <Card>
            <h2 className="type-h3 mb-2">{t("tryOn.vestindo_agora")}</h2>
            <div className="tryon-slots">
              {SLOTS.map((s) => { const e = worn[s] ? byId.get(worn[s]!) : undefined; const covered = s === "lower_piece" && !!fullBody && !!e; return (
                <div key={s} className={`tryon-slot ${e ? "is-filled" : ""}`} data-slot={s}>
                  <span className="tryon-slot-name">{slotName[s]}</span>
                  {e ? (
                    <div className="tryon-slot-body">
                      <img src={mediaUrl(e.piece.thumbnailUrl ?? e.piece.imageUrl)} alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate type-body-sm font-medium">{e.piece.name}</p>
                        <p className="type-caption text-muted">{covered ? t("tryOn.coberta_pela_peca_inteira", { name: fullBody!.piece.name }) : pieceNote(e)}</p>
                        {!e.backgroundRemoved && !e.piece.defaultImage && <p className="type-caption"><span className="text-muted">{t("tryOn.foto_com_fundo")}</span> <Button size="sm" variant="ghost" loading={fixing === e.piece.id} onClick={() => removeBg(e.piece.id)}>{t("tryOn.remover_fundo_curto")}</Button></p>}
                        {e.piece.model3dStatus !== "COMPLETED" && <Link href={`/pieces/${e.piece.id}`} className="type-caption underline">{t("tryOn.gerar_modelo_3d")}</Link>}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button size="sm" onClick={() => rackRefs.current[s]?.scrollIntoView({ behavior: "smooth", block: "start" })}>{t("tryOn.trocar")}</Button>
                        <Button size="sm" variant="ghost" aria-label={t("tryOn.remover_de", { name: e.piece.name, slot: slotName[s] })} onClick={() => remove(s)}>{t("tryOn.remover")}</Button>
                      </div>
                    </div>
                  ) : <p className="type-caption text-faint">{t("tryOn.slot_vazio", { slot: slotName[s].toLowerCase() })}</p>}
                </div>); })}
            </div>
            <p className="sr-only" role="status" aria-live="polite">{status}</p>
          </Card>
          {SLOTS.map((s) => { const list = data.pieces?.[s] ?? []; return (
            <section key={s} ref={(el) => { rackRefs.current[s] = el; }} aria-label={t("tryOn.guarda_roupa_lugar", { slot: slotName[s] })} className="scroll-mt-20">
              <h2 className="type-h3 mb-2">{slotName[s]} <span className="type-caption text-muted">· {list.length}</span></h2>
              {list.length === 0 ? <p className="type-caption text-muted">{t("tryOn.nenhuma_peca_neste_lugar")} <Link href="/pieces/new" className="underline">{t("common.cadastrar_peca")}</Link></p> : (
                <div className="flex flex-wrap gap-2">{list.map((e) => { const isOn = worn[s] === e.piece.id; return (
                  <div key={e.piece.id} className="grid gap-1">
                    <button type="button" aria-pressed={isOn} title={isOn ? t("tryOn.vestida_toque_para_tirar") : t("tryOn.toque_para_vestir")}
                      onClick={() => (isOn ? remove(s) : choose(e))} className={`tryon-rack-item ${isOn ? "is-worn" : ""}`}>
                      <img src={mediaUrl(e.piece.thumbnailUrl ?? e.piece.imageUrl)} alt="" className="aspect-square w-full object-contain" draggable={false} />
                      <span className="block truncate type-caption">{e.piece.name}</span>
                      {isOn && <span className="tryon-worn-flag">{t("tryOn.vestida")}</span>}
                    </button>
                    <Link href={`/pieces/${e.piece.id}`} className="type-caption text-muted underline">{t("tryOn.revisar_categoria")}</Link>
                  </div>); })}</div>
              )}
            </section>); })}
          {(data.needsReview?.length ?? 0) > 0 && (
            <section aria-label={t("tryOn.precisa_revisao")}>
              <h2 className="type-h3 mb-1">{t("tryOn.precisa_revisao")}</h2>
              <p className="mb-2 type-caption text-muted">{t("tryOn.precisa_revisao_hint")}</p>
              <div className="flex flex-wrap gap-2">{data.needsReview!.map((e) => <Link key={e.piece.id} href={`/pieces/${e.piece.id}`} className="tryon-rack-item"><img src={mediaUrl(e.piece.thumbnailUrl ?? e.piece.imageUrl)} alt="" className="aspect-square w-full object-contain" /><span className="block truncate type-caption">{e.piece.name}</span></Link>)}</div>
            </section>
          )}
        </div>
      </div>
      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} title={t("tryOn.limpar_o_manequim")}
        footer={<><Button onClick={() => setConfirmClear(false)}>{t("common.cancel")}</Button><Button variant="primary" onClick={() => { setWorn({}); writeSession({}); setConfirmClear(false); toast.info(t("tryOn.manequim_limpo_suas_pecas_continuam")); }}>{t("common.limpar")}</Button></>}>
        <p className="type-body">{t("tryOn.todas_as_peca_s_saem", { onCount: on.length })}</p>
      </Dialog>
    </>
  );
}
export default function TryOnPage() { return <RequireAuth><Suspense><TryOnInner /></Suspense></RequireAuth>; }

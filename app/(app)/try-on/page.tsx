"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError, mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Chip, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

type Sex = "MASCULINO" | "FEMININO";
type Layer = "BASE" | "INTERMEDIATE" | "OUTER" | "ACCESSORY";
interface Box { x: number; y: number; w: number; h: number; }
interface Mannequin { sex: Sex; build: string; skinTone?: string | null; skinHex: string; width: number; height: number; shoulderW: number; waistW: number; hipW: number; headR: number; landmarks: Record<string, { x: number; y: number }>; anchors: Record<string, Box>; }
/** Cada peça elegível chega com a camada, a âncora no corpo e a chave de substituição calculadas pelo servidor. */
interface Entry { piece: PieceView; slot: string; layer: Layer; anchor: string; replacementKey: string; backgroundRemoved: boolean; }
interface State { mannequin: Mannequin; sex: Sex; skinTones: Record<string, string>; builds: string[]; layers: Layer[]; pieces: Partial<Record<Layer, Entry[]>>; externalAvailable: boolean; }
interface Render { imageUrl: string; photoId?: string; pieceIds: string[]; warnings?: string[]; replaced?: string[]; stages?: { name: string; provider?: string; ms?: number }[]; costUsd?: number; totalMs?: number; fallbackUsed?: boolean; message?: string; explanation?: { provider?: string }; }

const LAYER_ORDER: Layer[] = ["BASE", "INTERMEDIATE", "OUTER", "ACCESSORY"];
const LAYER_LABEL: Record<Layer, string> = { BASE: "Base", INTERMEDIATE: "Intermediária", OUTER: "Externa", ACCESSORY: "Acessório" };
const BUILD_LABEL: Record<string, string> = { SLIM: "Magro", MEDIUM: "Médio", ATHLETIC: "Atlético", CURVY: "Curvilíneo", PLUS: "Plus size" };
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
    if (o.replacementKey === e.replacementKey) { notices.push(`«${e.piece.name}» substituiu «${o.piece.name}» na camada ${LAYER_LABEL[e.layer].toLowerCase()}.`); return false; }
    if (e.slot === "FULL_BODY" && (o.slot === "TOP" || o.slot === "BOTTOM")) { notices.push(`«${e.piece.name}» (peça inteira) substituiu «${o.piece.name}».`); return false; }
    if (o.slot === "FULL_BODY" && (e.slot === "TOP" || e.slot === "BOTTOM")) { notices.push(`«${e.piece.name}» substituiu a peça inteira «${o.piece.name}».`); return false; }
    return true;
  });
  return { next: [...next, id], notices };
}

/** Manequim vetorial com a mesma geometria do compositor local (TryOnCompositor.drawMannequin), para a prévia bater com o render. */
function MannequinBody({ m }: { m: Mannequin }) {
  const W = m.width, H = m.height, cx = W / 2, male = m.sex === "MASCULINO";
  const shoulder = m.shoulderW * W, waist = m.waistW * W, hip = m.hipW * W, headR = m.headR * W;
  const yS = 0.205 * H, yW = (male ? 0.455 : 0.43) * H, yH = 0.52 * H, yA = 0.9 * H;
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
      <rect x={cx - headR * 0.45} y={0.14 * H} width={headR * 0.9} height={0.075 * H} rx={9} fill={m.skinHex} />
      <ellipse cx={cx} cy={0.045 * H + headR * 1.225} rx={headR} ry={headR * 1.225} fill="url(#tryon-skin)" />
    </g>
  );
}

function TryOnInner() {
  const { t } = useI18n(); const toast = useToast(); const sp = useSearchParams();
  const { data, loading, error, reload } = useApi<State>((signal) => api.get("/api/try-on", { signal }), []);
  const [dressed, setDressed] = useState<string[]>([]);
  const [render, setRender] = useState<Render | null>(null); const [busy, setBusy] = useState(false); const [title, setTitle] = useState("");
  const [over, setOver] = useState(false); const [confirmClear, setConfirmClear] = useState(false); const [fixing, setFixing] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
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
  async function setSex(sex: Sex) {
    if (sex === data?.sex) return;
    try { await api.put("/api/try-on/preferences", { sex }); setRender(null); reload(); toast.success(`Manequim ${sex === "MASCULINO" ? "masculino" : "feminino"} salvo — ele volta assim na próxima sessão.`); } catch (e) { toast.fromError(e); }
  }
  async function savePrefs(patch: { skinTone?: string; build?: string }) { try { await api.put("/api/try-on/preferences", patch); setRender(null); reload(); } catch (e) { toast.fromError(e); } }
  async function doRender() {
    setBusy(true);
    try { const r = await api.post<Render>("/api/try-on/renders", { sex: data?.sex, pieceIds: dressed }); setRender(r); if (r.message) toast.info(r.message); } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function removeBg(id: string) {
    setFixing(id);
    try { const r = await api.post<{ ok: boolean; message?: string }>(`/api/pieces/${id}/background-removal`); if (r.ok) { toast.success("Fundo removido — a peça agora encaixa sem sobra."); reload(); } else toast.info(r.message ?? "Não deu para remover o fundo agora; a sobreposição fica aproximada."); } catch (e) { toast.fromError(e); } finally { setFixing(null); }
  }
  async function saveScheme() {
    try { const r = await api.post<{ schemeId?: string }>("/api/try-on/schemes", { pieceIds: dressed, title: title || undefined, tryOnUrl: render?.imageUrl ?? null }); toast.success(t("scheme.saved")); if (r.schemeId) window.location.href = `/schemes/${r.schemeId}`; } catch (e) { toast.fromError(e); }
  }

  if (error instanceof ApiError && error.code === "ACERVO_VAZIO") return <><PageHeader title={t("nav.tryon")} kicker="RF18" /><EmptyState title="Seu guarda-roupa ainda está vazio" hint={error.message} action={<Link href="/add-piece" className="btn btn-primary">Cadastrar peça</Link>} /></>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const m = data.mannequin;
  const on = LAYER_ORDER.flatMap((l) => dressed.map((id) => byId.get(id)).filter((e): e is Entry => !!e && e.layer === l));
  const approximate = on.filter((e) => !e.backgroundRemoved);
  const skin = m.skinTone ?? "media";
  return (
    <>
      <PageHeader title={t("nav.tryon")} kicker="RF18" lead={`Arraste uma peça até o manequim (ou toque nela). As camadas se ajeitam sozinhas: base → intermediária → externa → acessório. ${data.externalAvailable ? "O render final usa try-on por IA (FASHN) com o compositor local de reserva." : "O render final usa o compositor local por camadas (IA externa desligada ou sem chave)."}`} />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="grid content-start gap-3">
          <Card pad={false}>
            <div className={`tryon-stage ${over ? "is-over" : ""}`} aria-label="manequim — solte uma peça aqui" role="region"
              onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setOver(true); } }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData(DRAG_TYPE); if (id) put(id); }}>
              {render?.imageUrl ? <img src={mediaUrl(render.imageUrl)} alt="look provado no manequim" className="h-full w-full object-contain" /> : (
                <svg viewBox={`0 0 ${m.width} ${m.height}`} className="h-full w-full" role="img" aria-label={`manequim ${m.sex.toLowerCase()} com ${on.length} peça(s)`}>
                  <MannequinBody m={m} />
                  {on.map((e, i) => {
                    const b = m.anchors[e.anchor] ?? m.anchors[e.slot]; if (!b) return null; const src = mediaUrl(e.piece.imageUrl ?? e.piece.thumbnailUrl); if (!src) return null;
                    return <image key={e.piece.id} href={src} x={b.x * m.width} y={b.y * m.height} width={b.w * m.width} height={b.h * m.height} preserveAspectRatio={e.slot === "SHOES" || e.anchor === "feet" ? "xMidYMax meet" : e.slot === "ACCESSORY" ? "xMidYMid meet" : "xMidYMin meet"}
                      style={e.backgroundRemoved ? undefined : { mixBlendMode: "multiply", opacity: 0.92 }} data-layer={e.layer} data-order={i} />;
                  })}
                </svg>
              )}
              {!on.length && !render && <p className="tryon-drop-hint">solte uma peça aqui</p>}
              {render && <Badge tone="thread" className="absolute left-2 top-2">render {render.fallbackUsed ? "local" : render.explanation?.provider ?? ""}</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2 p-3">
              <span className="label mr-1">Manequim</span>
              <Chip active={data.sex === "MASCULINO"} onClick={() => setSex("MASCULINO")}><FaiIcon id="ACT-22" size={24} decorative />Masculino</Chip>
              <Chip active={data.sex === "FEMININO"} onClick={() => setSex("FEMININO")}><FaiIcon id="ACT-23" size={24} decorative />Feminino</Chip>
              <Button size="sm" variant="ghost" className="ml-auto" disabled={!dressed.length && !render} onClick={() => setConfirmClear(true)}><FaiIcon id="ACT-24" size={24} decorative />Limpar</Button>
            </div>
          </Card>
          <Card>
            <p className="label">Tom de pele <span className="type-caption text-faint">· salvo no seu perfil</span></p>
            <div className="mb-2 flex flex-wrap gap-1.5">{Object.entries(data.skinTones).map(([id, hex]) => <button key={id} type="button" title={label(id)} aria-label={`tom de pele ${label(id)}`} aria-pressed={skin === id} className={`h-7 w-7 rounded-full border-2 ${skin === id ? "border-mark" : "border-line-soft"}`} style={{ background: hex }} onClick={() => savePrefs({ skinTone: id })} />)}</div>
            <Field label="Porte" id="build"><Select id="build" value={m.build} onChange={(e) => savePrefs({ build: e.target.value })}>{data.builds.map((b) => <option key={b} value={b}>{BUILD_LABEL[b] ?? b.toLowerCase()}</option>)}</Select></Field>
          </Card>
          {render && <Card><p className="label">Render</p><p className="type-caption text-muted">{render.fallbackUsed ? "compositor local" : render.explanation?.provider ?? ""} · {render.totalMs ?? 0} ms{render.costUsd ? ` · US$ ${render.costUsd}` : ""}</p>{render.stages?.length ? <ul className="type-caption">{render.stages.map((s, i) => <li key={i}>{s.name} · {s.provider ?? ""} {s.ms ? `${s.ms} ms` : ""}</li>)}</ul> : null}{render.warnings?.length ? <ul className="mt-2 grid gap-1 type-caption text-muted">{render.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}</ul> : null}</Card>}
        </div>
        <div className="grid content-start gap-4">
          <Card>
            <div className="mb-2 flex items-center justify-between gap-2"><h2 className="type-h3">No manequim</h2><span className="type-caption text-muted">{on.length} peça(s) · ordem de vestir</span></div>
            {!on.length ? <p className="type-body text-muted">Nada ainda. Arraste uma peça do seu acervo abaixo.</p> : (
              <ol className="tryon-layers">{LAYER_ORDER.map((l) => { const list = on.filter((e) => e.layer === l); return (
                <li key={l} className={list.length ? "" : "is-empty"}><span className="tryon-layer-name">{LAYER_LABEL[l]}</span>
                  <div className="flex flex-wrap gap-1.5">{list.length ? list.map((e) => (
                    <span key={e.piece.id} className="tryon-worn"><img src={mediaUrl(e.piece.thumbnailUrl ?? e.piece.imageUrl)} alt="" />{e.piece.name}
                      {!e.backgroundRemoved && <Badge tone="chalk">sobreposição aproximada</Badge>}
                      <button type="button" aria-label={`tirar ${e.piece.name}`} onClick={() => takeOff(e.piece.id)}>✕</button></span>)) : <span className="type-caption text-faint">—</span>}</div>
                </li>); })}</ol>
            )}
            {notices.length > 0 && <p className="mt-2 type-caption text-thread" role="status">{notices.join(" ")}</p>}
            {approximate.length > 0 && (
              <div className="mt-3 rounded-md border border-line-soft bg-surface-2 p-2 type-caption" role="note">
                <p><b>{approximate.length} peça(s) com fundo na foto.</b> Sem a remoção de fundo, o encaixe no corpo fica aproximado (RF18.CA05).</p>
                <div className="mt-1 flex flex-wrap gap-1.5">{approximate.map((e) => <Button key={e.piece.id} size="sm" loading={fixing === e.piece.id} onClick={() => removeBg(e.piece.id)}>Remover fundo · {e.piece.name}</Button>)}</div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={doRender} loading={busy} disabled={!on.length}><FaiIcon id="NAV-07" size={24} decorative />Provar ({on.length})</Button>
              <Input aria-label="título do look" className="max-w-xs" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do look (opcional)" />
              <Button onClick={saveScheme} disabled={!on.length}><FaiIcon id="ACT-25" size={24} decorative />Salvar como look</Button>
            </div>
            <p className="mt-1 type-caption text-faint">O look salvo entra em Meus Looks com origem “Provador”.</p>
          </Card>
          {LAYER_ORDER.map((layer) => { const list = data.pieces[layer] ?? []; if (!list.length) return null; return (
            <section key={layer} aria-label={`acervo — camada ${LAYER_LABEL[layer]}`}><h2 className="type-h3 mb-2">{LAYER_LABEL[layer]} <span className="type-caption text-muted">· {list.length}</span></h2>
              <div className="flex flex-wrap gap-2">{list.map((e) => { const worn = dressed.includes(e.piece.id); return (
                <button key={e.piece.id} type="button" draggable aria-pressed={worn} title={worn ? "Tirar do manequim" : "Arraste ao manequim ou toque para vestir"}
                  onDragStart={(ev) => { ev.dataTransfer.setData(DRAG_TYPE, e.piece.id); ev.dataTransfer.effectAllowed = "copy"; }}
                  onClick={() => (worn ? takeOff(e.piece.id) : put(e.piece.id))}
                  className={`tryon-rack-item ${worn ? "is-worn" : ""}`}>
                  <img src={mediaUrl(e.piece.thumbnailUrl ?? e.piece.imageUrl)} alt="" className="aspect-square w-full object-contain" draggable={false} />
                  <span className="block truncate type-caption">{e.piece.name}</span>
                  {!e.backgroundRemoved && <span className="tryon-bg-flag" title="fundo não removido — sobreposição aproximada">fundo</span>}
                </button>); })}</div>
            </section>); })}
        </div>
      </div>
      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} title="Limpar o manequim?"
        footer={<><Button onClick={() => setConfirmClear(false)}>Cancelar</Button><Button variant="primary" onClick={() => { setDressed([]); setRender(null); setNotices([]); setConfirmClear(false); toast.info("Manequim limpo. Suas peças continuam no guarda-roupa."); }}>Limpar</Button></>}>
        <p className="type-body">Todas as {on.length} peça(s) saem do manequim. Nada é apagado do seu guarda-roupa nem dos seus looks salvos.</p>
      </Dialog>
    </>
  );
}
export default function TryOnPage() { return <RequireAuth><Suspense><TryOnInner /></Suspense></RequireAuth>; }

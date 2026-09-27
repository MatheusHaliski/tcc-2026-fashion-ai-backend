"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { retryImport } from "@/lib/chunk-recovery";
import * as THREE from "three";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, Button, Card, Dialog, ErrorState, PageHeader, Skeleton, Spinner, Switch, useToast } from "@/components/ui";
import { useWebGL } from "@/components/three/common";
import type { AvatarView } from "@/components/three/avatar-viewer";
import { analyzePhoto, atlasBlob, buildAvatar, type AnalyzedPhoto, type BuiltAvatar } from "@/lib/avatar3d/pipeline";
import { ADJUST_RANGE, DEFAULT_ADJUST, clampAdjust, type AvatarAdjust, type AvatarModel } from "@/lib/avatar3d/model";
import type { Issue } from "@/lib/avatar3d/quality";
import { validateBody, type BodyModel } from "@/lib/avatar3d/body-spec";
import { BodyEditor } from "@/components/avatar3d/body-editor";

const AvatarViewer = dynamic(() => retryImport(() => import("@/components/three/avatar-viewer")), { ssr: false, loading: () => <Skeleton className="h-full" /> });

interface Saved {
  exists: boolean; model?: AvatarModel; adjust?: Partial<AvatarAdjust>; textureUrl?: string; photos?: number;
  warnings?: string[]; publicOnRunway?: boolean; updatedAt?: string;
}

const SLOTS = ["front", "sideA", "sideB"] as const;
const VIEWS: AvatarView[] = ["front", "left34", "right34", "profile"];
const ADJ = Object.keys(ADJUST_RANGE) as (keyof AvatarAdjust)[];
/** Avisos cujo texto na hora da foto leva um número (px, graus, %): o avatar salvo guarda só o código. */
const SAVED_TEXT = new Set(["FACE_SMALL", "LOOK_AT_CAMERA", "HEAD_UP_DOWN", "HEAD_TILT", "FACE_OCCLUDED", "MULTIPLE_FACES", "TURN_MORE", "TURN_LESS"]);

/** Texto de um aviso do filtro de qualidade (RF40.CA02/CA05). Código desconhecido cai no texto genérico. */
function useIssueText() {
  const { t } = useI18n();
  return (i: Pick<Issue, "code" | "params">) => {
    const key = `avatar3d.issue.${i.code}`;
    const s = t(key, i.params ?? {});
    return s === key ? t("avatar3d.issue.OTHER") : s;
  };
}

/** Ajustes finos: faixas pequenas de propósito (ajuste fino, não outra pessoa). */
function AdjustSliders({ value, onChange }: { value: AvatarAdjust; onChange: (a: AvatarAdjust) => void }) {
  const { t, fmtNumber } = useI18n();
  return (
    <div className="grid gap-3">
      {ADJ.map((k) => {
        const [lo, hi, step] = ADJUST_RANGE[k]; const id = `adj-${k}`;
        const shown = k === "headScale" || k === "hairVolume" ? `${fmtNumber(Math.round(value[k] * 100))}%` : k === "neck" ? `${value[k] > 0 ? "+" : ""}${fmtNumber(Math.round(value[k] * 1000) / 10)} cm` : `${value[k] > 0 ? "+" : ""}${fmtNumber(Math.round(value[k] * 100))}%`;
        return (
          <label key={k} htmlFor={id} className="grid gap-1">
            <span className="flex justify-between type-body-sm"><span>{t(`avatar3d.adjust.${k}`)}</span><span className="type-data">{shown}</span></span>
            <input id={id} type="range" min={lo} max={hi} step={step} value={value[k]} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} />
          </label>
        );
      })}
      <Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_ADJUST })}>{t("avatar3d.adjust.reset")}</Button>
    </div>
  );
}

function ViewButtons({ view, onView }: { view: AvatarView; onView: (v: AvatarView) => void }) {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={t("avatar3d.view.label")} className="flex flex-wrap gap-2">
      {VIEWS.map((v) => <Button key={v} size="sm" variant={v === view ? "primary" : "default"} aria-pressed={v === view} onClick={() => onView(v)}>{t(`avatar3d.view.${v}`)}</Button>)}
    </div>
  );
}

/** Criação/refação: fotos → análise no aparelho → prévia → consentimento → salvar (RF40.CA01–CA07). */
function Create({ sex, onSaved, onCancel, initialPublic }: { sex: "FEMININO" | "MASCULINO"; onSaved: () => void; onCancel?: () => void; initialPublic: boolean }) {
  const { t } = useI18n(); const toast = useToast(); const issueText = useIssueText();
  const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const previews = useMemo(() => files.map((f) => (f ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);
  const [busy, setBusy] = useState<"" | "analyze" | "save">("");
  const [photos, setPhotos] = useState<(AnalyzedPhoto | null)[]>([null, null, null]);
  const [built, setBuilt] = useState<BuiltAvatar | null>(null);
  const [failed, setFailed] = useState(false);
  const [adjust, setAdjust] = useState<AvatarAdjust>({ ...DEFAULT_ADJUST });
  const [view, setView] = useState<AvatarView>("front");
  const [consent, setConsent] = useState(false);
  const [pub, setPub] = useState(initialPublic);
  const texture = useMemo(() => {
    if (!built) return null;
    const tex = new THREE.CanvasTexture(built.atlas); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  }, [built]);
  useEffect(() => () => texture?.dispose(), [texture]);

  function pick(i: number, f: File | null) {
    setFiles((xs) => xs.map((x, j) => (j === i ? f : x)));
    setBuilt(null); setFailed(false); setPhotos([null, null, null]);
  }

  async function analyze() {
    setBusy("analyze"); setBuilt(null); setFailed(false);
    try {
      const out: (AnalyzedPhoto | null)[] = [];
      for (let i = 0; i < SLOTS.length; i++) out.push(files[i] ? await analyzePhoto(files[i]!, i === 0 ? "front" : "side") : null);
      setPhotos(out);
      const b = buildAvatar(out.filter((p): p is AnalyzedPhoto => !!p));
      setBuilt(b); setFailed(!b); setView("front");
    } catch {
      toast.error(t("avatar3d.page.erro_processar"));
    } finally { setBusy(""); }
  }

  async function save() {
    if (!built || !consent) return;
    setBusy("save");
    try {
      const fd = new FormData();
      const photosUsed = photos.filter((p) => p && p.fit && !p.issues.some((i) => i.severity === "block")).length;
      fd.append("meta", JSON.stringify({ model: built.model, adjust: clampAdjust(adjust), photos: photosUsed, warnings: built.model.warnings, consent: true, publicOnRunway: pub }));
      fd.append("texture", await atlasBlob(built.atlas), "avatar.jpg");
      await api.upload("/api/me/avatar3d", fd);
      toast.success(t("avatar3d.page.salvo"));
      onSaved();
    } catch (e) { toast.fromError(e); } finally { setBusy(""); }
  }

  const setIssues = built?.set.issues ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="grid content-start gap-3">
        <Card>
          <p className="label">{t("avatar3d.page.fotos")}</p>
          <ul className="mb-3 list-disc pl-5 type-body-sm text-muted">
            <li>{t("avatar3d.page.dica_luz")}</li><li>{t("avatar3d.page.dica_rosto")}</li><li>{t("avatar3d.page.dica_lados")}</li>
          </ul>
          <div className="grid gap-3">
            {SLOTS.map((s, i) => {
              const p = photos[i]; const blocks = p?.issues.filter((x) => x.severity === "block") ?? []; const warns = p?.issues.filter((x) => x.severity === "warn") ?? [];
              return (
                <div key={s} className="grid grid-cols-[72px_1fr] items-start gap-3">
                  <div className="grid aspect-square w-[72px] place-items-center overflow-hidden rounded-md border border-line bg-surface-2">
                    {previews[i] ? <img src={previews[i]!} alt="" className="h-full w-full object-cover" /> : <span className="type-caption text-faint">{i === 0 ? "1" : i === 1 ? "2" : "3"}</span>}
                  </div>
                  <div className="grid gap-1">
                    <label className="type-body-sm font-semibold" htmlFor={`avatar-photo-${s}`}>{t(`avatar3d.slot.${s}`)}</label>
                    <input id={`avatar-photo-${s}`} type="file" accept="image/*" className="type-caption" onChange={(e) => pick(i, e.target.files?.[0] ?? null)} />
                    {p && blocks.length === 0 && <span className="type-caption text-good">✓ {t("avatar3d.page.foto_ok")}</span>}
                    {blocks.map((x) => <span key={x.code} role="alert" className="type-caption text-critical">✕ {issueText(x)}</span>)}
                    {warns.map((x) => <span key={x.code} className="type-caption text-muted">⚠ {issueText(x)}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" loading={busy === "analyze"} disabled={!files[0] || !!busy} onClick={analyze}>{t("avatar3d.page.gerar_previa")}</Button>
            {onCancel && <Button variant="ghost" disabled={!!busy} onClick={onCancel}>{t("common.cancel")}</Button>}
          </div>
          {busy === "analyze" && <p className="mt-2 flex items-center gap-2 type-caption text-muted"><Spinner size={14} />{t("avatar3d.page.processando")}</p>}
          {failed && <p role="alert" className="mt-2 type-body-sm text-critical">{t("avatar3d.page.nao_montou")}</p>}
          <p className="mt-3 type-caption text-faint">{t("avatar3d.page.privacidade")}</p>
        </Card>
        {built && (
          <Card>
            <p className="label">{t("avatar3d.page.ajustes")}</p>
            <AdjustSliders value={adjust} onChange={setAdjust} />
          </Card>
        )}
      </div>
      <div className="grid content-start gap-3">
        <Card>
          <div className="aspect-[4/5] w-full overflow-hidden rounded-md bg-surface-2 sm:aspect-[5/4]">
            {built && texture ? <AvatarViewer avatar={{ model: built.model, adjust, texture }} sex={sex} view={view} />
              : <p className="grid h-full place-items-center p-6 text-center type-body text-muted">{t("avatar3d.page.previa_vazia")}</p>}
          </div>
          {built && <div className="mt-3"><ViewButtons view={view} onView={setView} /></div>}
          {setIssues.length > 0 && <ul className="mt-3 grid gap-1">{setIssues.map((x) => <li key={x.code} className="type-body-sm text-muted">⚠ {issueText(x)}</li>)}</ul>}
        </Card>
        {built && (
          <Card>
            <label className="flex items-start gap-2 type-body-sm">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{t("avatar3d.page.consentimento")}</span>
            </label>
            <div className="mt-3"><Switch checked={pub} onChange={setPub} label={t("avatar3d.page.publico")} hint={t("avatar3d.page.publico_hint")} /></div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" loading={busy === "save"} disabled={!consent || !!busy} onClick={save}>{t("avatar3d.page.salvar")}</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Avatar salvo: prévia, ajustes, visibilidade, refazer e excluir (RF40.CA06, CA08, CA09). */
function Saved({ saved, sex, onRedo, onChanged }: { saved: Saved; sex: "FEMININO" | "MASCULINO"; onRedo: () => void; onChanged: () => void }) {
  const { t, fmtDateTime } = useI18n(); const toast = useToast(); const issueText = useIssueText();
  const [view, setView] = useState<AvatarView>("front");
  const [adjust, setAdjust] = useState<AvatarAdjust>(clampAdjust(saved.adjust));
  const [pub, setPub] = useState(!!saved.publicOnRunway);
  const [busy, setBusy] = useState<"" | "patch" | "delete" | "body">("");
  const [confirm, setConfirm] = useState(false);
  const body = validateBody(saved.model?.body);
  const dirty = JSON.stringify(clampAdjust(saved.adjust)) !== JSON.stringify(adjust);

  async function saveBody(b: BodyModel | null) {
    setBusy("body");
    try { await api.patch("/api/me/avatar3d", { body: b ?? {} }); toast.success(t("avatar3d.body.salvo")); onChanged(); }
    catch (e) { toast.fromError(e); } finally { setBusy(""); }
  }
  async function patch(body: { adjust?: AvatarAdjust; publicOnRunway?: boolean }) {
    setBusy("patch");
    try { await api.patch("/api/me/avatar3d", body); toast.success(t("avatar3d.page.ajustes_salvos")); onChanged(); }
    catch (e) { toast.fromError(e); } finally { setBusy(""); }
  }
  async function remove() {
    setBusy("delete");
    try { await api.delete("/api/me/avatar3d"); setConfirm(false); toast.success(t("avatar3d.page.excluido")); onChanged(); }
    catch (e) { toast.fromError(e); } finally { setBusy(""); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="grid content-start gap-3">
        <Card>
          <p className="label">{t("avatar3d.page.seu_avatar")}</p>
          <p className="type-body-sm">{t("avatar3d.page.feito_com", { n: saved.photos ?? 1 })}{saved.updatedAt ? ` · ${fmtDateTime(saved.updatedAt)}` : ""}</p>
          {(saved.warnings ?? []).length > 0 && <ul className="mt-2 grid gap-1">{saved.warnings!.map((c) => <li key={c} className="type-caption text-muted">⚠ {SAVED_TEXT.has(c) ? t(`avatar3d.saved.${c}`) : issueText({ code: c })}</li>)}</ul>}
          <div className="mt-3"><Switch checked={pub} onChange={(v) => { setPub(v); void patch({ publicOnRunway: v }); }} label={t("avatar3d.page.publico")} hint={t("avatar3d.page.publico_hint")} /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={onRedo} disabled={!!busy}>{t("avatar3d.page.refazer")}</Button>
            <Button variant="ghost" onClick={() => setConfirm(true)} disabled={!!busy}>{t("avatar3d.page.excluir")}</Button>
          </div>
        </Card>
        <Card>
          <p className="label">{t("avatar3d.page.ajustes")}</p>
          <AdjustSliders value={adjust} onChange={setAdjust} />
          <Button className="mt-3" variant="primary" size="sm" loading={busy === "patch"} disabled={!dirty || !!busy} onClick={() => patch({ adjust })}>{t("avatar3d.page.salvar_ajustes")}</Button>
        </Card>
      </div>
      <Card>
        <div className="aspect-[4/5] w-full overflow-hidden rounded-md bg-surface-2 sm:aspect-[5/4]">
          {saved.model && <AvatarViewer avatar={{ model: saved.model, adjust, textureUrl: saved.textureUrl }} sex={sex} view={view} body={body?.params} />}
        </div>
        <div className="mt-3"><ViewButtons view={view} onView={setView} /></div>
        <p className="mt-2 type-caption text-faint">{t("avatar3d.page.onde_aparece")}</p>
      </Card>
      <div className="lg:col-span-2">
        {saved.model && <BodyEditor sex={sex} initial={body} avatar={{ model: saved.model, adjust, textureUrl: saved.textureUrl }} saving={busy === "body"} onSave={saveBody} />}
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t("avatar3d.page.excluir_titulo")}
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>{t("common.cancel")}</Button><Button variant="danger" loading={busy === "delete"} onClick={remove}>{t("avatar3d.page.excluir")}</Button></>}>
        <p className="type-body">{t("avatar3d.page.excluir_texto")}</p>
      </Dialog>
    </div>
  );
}

/** RF40 — aba "Meu Avatar 3D". */
export default function MyAvatar() {
  const { t } = useI18n(); const { me, user } = useAuth(); const webgl = useWebGL();
  const saved = useApi<Saved>((signal) => api.get("/api/me/avatar3d", { signal }), []);
  const [redo, setRedo] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const sex: "FEMININO" | "MASCULINO" = me?.sex === "MASCULINO" ? "MASCULINO" : "FEMININO";
  const header = <PageHeader title={t("avatar3d.page.titulo")} kicker="RF40" lead={t("avatar3d.page.lead")} />;
  if (saved.error) return <>{header}<ErrorState error={saved.error} onRetry={saved.reload} /></>;
  if (saved.loading || !saved.data) return <>{header}<Skeleton className="h-96" /></>;
  const s = saved.data;
  const done = () => { setRedo(false); saved.reload(); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <div ref={top}>
      {header}
      {user?.profileType === "MARCA" && <p className="mb-3"><Badge tone="chalk">{t("avatar3d.page.marca")}</Badge></p>}
      {webgl === false ? (
        <Card><p className="type-body">{t("avatar3d.page.sem_webgl")}</p></Card>
      ) : s.exists && !redo ? (
        <Saved saved={s} sex={sex} onRedo={() => setRedo(true)} onChanged={done} />
      ) : (
        <Create sex={sex} onSaved={done} onCancel={s.exists ? () => setRedo(false) : undefined} initialPublic={s.exists ? !!s.publicOnRunway : true} />
      )}
    </div>
  );
}

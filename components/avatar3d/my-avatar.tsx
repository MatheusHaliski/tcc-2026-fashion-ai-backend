"use client";
import type React from "react";
import { rangeFill } from "@/lib/range-fill";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { retryImport } from "@/lib/chunk-recovery";
import * as THREE from "three";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, Button, Card, Chip, Dialog, ErrorState, FileButton, PageHeader, SegmentPicker, Skeleton, Spinner, Switch, useToast } from "@/components/ui";
import { useWebGL } from "@/components/three/common";
import type { AvatarView } from "@/components/three/avatar-viewer";
import type { HumanParts } from "@/components/three/human-avatar";
import { AVATAR_NOT_DRESSED, downloadBlob, exportAvatarGlb } from "@/lib/avatar3d/human/export-glb";
import { analyzePhoto, atlasBlob, buildAvatar, type AnalyzedPhoto, type BuiltAvatar } from "@/lib/avatar3d/pipeline";
import { ADJUST_RANGE, DEFAULT_ADJUST, SLIDER_ADJUSTS, clampAdjust, type AvatarAdjust, type AvatarHair, type AvatarModel } from "@/lib/avatar3d/model";
import type { AvatarEyes } from "@/lib/avatar3d/iris";
import type { AvatarBrows } from "@/lib/avatar3d/identity/brows";
import { HAIR_TONES, paletteId } from "@/lib/avatar3d/hair-tone";
import { HAIR_CUTS, HAIR_FRINGES } from "@/lib/avatar3d/hair-cut";
import { SEX_CONFIDENT, type SexGuess } from "@/lib/avatar3d/sex-detect";
import type { Sex } from "@/lib/avatar3d/body-spec";
import type { Issue } from "@/lib/avatar3d/quality";
import { validateBody, type BodyModel } from "@/lib/avatar3d/body-spec";
import { BodyEditor } from "@/components/avatar3d/body-editor";
import type { FaceFidelity } from "@/lib/avatar3d/identity/metrics";

const AvatarViewer = dynamic(() => retryImport(() => import("@/components/three/avatar-viewer")), { ssr: false, loading: () => <Skeleton className="h-full" /> });

interface GateView { passed: boolean; failed: string[]; notMeasured?: string[] }
/** AVATAR-ID I1: identidade versionada (versão atual, status do gate, versão aprovada que outras pessoas veem). */
interface IdentityView { identityId?: string; version: number; status: "DRAFT" | "NEEDS_REFINEMENT" | "APPROVED"; approvedVersion?: number | null; quality?: { gate?: GateView } | null }
interface Saved {
  exists: boolean; model?: AvatarModel; adjust?: Partial<AvatarAdjust>; textureUrl?: string; photos?: number;
  warnings?: string[]; publicOnRunway?: boolean; updatedAt?: string; identity?: IdentityView;
}
interface VersionRow { version: number; status: IdentityView["status"]; basedOn?: number | null; current: boolean; approved: boolean; approvedWithWarnings?: boolean; createdAt?: string; gate?: GateView | null }

/** Relatório de qualidade que vai com o avatar: só números agregados (lib/avatar3d/identity), nunca forma ou cor. */
function qualityReport(f: FaceFidelity | null | undefined, skin?: { skinColorError: number | null; seams: number } | null) {
  if (!f) return undefined;
  return {
    reprojectionMm: f.reprojectionMm, asymmetry: f.asymmetry, capture: f.capture, shapePreservation: f.shapePreservation, proportionErrorPct: f.proportionErrorPct,
    ...(skin?.skinColorError != null ? { skinColorError: skin.skinColorError, seams: skin.seams } : {}),
  };
}

/** A prévia já foi medida: fidelidade do rosto calculada e pele assada (com o relatório de cor e costura). */
function isMeasured(p: HumanParts) {
  const ud = p.human.root.userData;
  return p.identity != null && ud.skin === "baked" && ud.skinReport != null;
}

const VIEWS: AvatarView[] = ["front", "left34", "right34", "profile"];
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
function AdjustSliders({ value, onChange, hair, eyes, brows }: { value: AvatarAdjust; onChange: (a: AvatarAdjust) => void; hair?: AvatarHair | null; eyes?: AvatarEyes | null; brows?: AvatarBrows | null }) {
  const { t, fmtNumber } = useI18n();
  return (
    <div className="grid gap-3">
      {SLIDER_ADJUSTS.map((k) => {
        const [lo, hi, step] = ADJUST_RANGE[k]; const id = `adj-${k}`;
        const shown = k === "headScale" || k === "hairVolume" ? `${fmtNumber(Math.round(value[k] * 100))}%` : k === "neck" ? `${value[k] > 0 ? "+" : ""}${fmtNumber(Math.round(value[k] * 1000) / 10)} cm` : `${value[k] > 0 ? "+" : ""}${fmtNumber(Math.round(value[k] * 100))}%`;
        return (
          <label key={k} htmlFor={id} className="grid gap-1">
            <span className="flex justify-between type-body-sm"><span>{t(`avatar3d.adjust.${k}`)}</span><span className="type-data">{shown}</span></span>
            {k === "hairVolume" && hair?.volumeLevel && <span className="type-caption text-muted">{t("avatar3d.hairVolume.detectado", { level: t(`avatar3d.hairVolume.${hair.volumeLevel}`) })}</span>}
            <input id={id} type="range" min={lo} max={hi} step={step} value={value[k]} style={rangeFill(value[k], lo, hi) as React.CSSProperties} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} />
          </label>
        );
      })}
      {hair && !hair.cover && <HairCutPicker value={value.hairCut} onChange={(v) => onChange({ ...value, hairCut: v })} hair={hair} />}
      {hair && !hair.cover && (hair.present || value.hairCut > 0) && <HairFringePicker value={value.hairFringe} onChange={(v) => onChange({ ...value, hairFringe: v })} />}
      {hair && !hair.cover && (hair.color || value.hairCut > 0) && <HairTonePicker value={value.hairTone} onChange={(v) => onChange({ ...value, hairTone: v })} hair={hair} />}
      {eyes && <EyesInfo eyes={eyes} brows={brows} value={value.glasses} onChange={(v) => onChange({ ...value, glasses: v })} />}
      <Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_ADJUST })}>{t("avatar3d.adjust.reset")}</Button>
    </div>
  );
}

/**
 * Olhos (AVATAR-ID I4): a cor da íris lida na foto (amostra + nome; a cor nunca é o único sinal) e, quando a foto tinha
 * óculos de grau, mostrar ou tirar a armação do avatar. Óculos escuros não voltam: só o aviso de que saíram.
 */
function EyesInfo({ eyes, brows, value, onChange }: { eyes: AvatarEyes; brows?: AvatarBrows | null; value: number; onChange: (v: number) => void }) {
  const { t } = useI18n();
  const name = eyes.source === "DEFAULT" ? t("avatar3d.eyes.padrao") : t(`avatar3d.eyes.cls.${eyes.cls}`);
  const density = brows ? (brows.density >= 0.6 ? "cheias" : brows.density >= 0.35 ? "medias" : "ralas") : null;
  return (
    <div className="grid gap-1.5">
      {brows && (
        <span className="flex justify-between gap-2 type-body-sm">
          <span>{t("avatar3d.brows.titulo")}</span>
          <span className="flex items-center gap-1.5 type-caption text-muted" data-testid="avatar-brows">
            <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-[var(--border)]" style={{ background: brows.color }} />
            {t("avatar3d.brows.resumo", { shape: t(`avatar3d.brows.shape.${brows.shape}`), density: t(`avatar3d.brows.density.${density}`) })}
          </span>
        </span>
      )}
      <span className="flex justify-between gap-2 type-body-sm">
        <span>{t("avatar3d.eyes.titulo")}</span>
        <span className="flex items-center gap-1.5 type-caption text-muted" data-testid="avatar-eyes">
          <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-[var(--border)]" style={{ background: eyes.color }} />
          {eyes.right && eyes.left ? t("avatar3d.eyes.heterocromia", { name }) : name}
        </span>
      </span>
      {eyes.glasses === "PRESCRIPTION" && (
        <div role="radiogroup" aria-label={t("avatar3d.adjust.glasses")} className="flex flex-wrap items-center gap-1.5">
          <span className="type-body-sm mr-1">{t("avatar3d.adjust.glasses")}</span>
          <Chip role="radio" aria-checked={value !== 0} active={value !== 0} onClick={() => onChange(1)}>{t("avatar3d.glasses.com")}</Chip>
          <Chip role="radio" aria-checked={value === 0} active={value === 0} onClick={() => onChange(0)}>{t("avatar3d.glasses.sem")}</Chip>
        </div>
      )}
    </div>
  );
}

/**
 * Tom do cabelo: o medido na foto ("Da foto", com o nome do tom detectado) ou um da paleta — do preto ao loiro platinado,
 * acobreado, ruivo, grisalho e branco. Rádios com amostra de cor e nome (a cor nunca é o único sinal).
 */
function HairTonePicker({ value, onChange, hair }: { value: number; onChange: (v: number) => void; hair: AvatarHair }) {
  const { t } = useI18n();
  const detected = hair.tone ? paletteId(hair.tone) : null;
  const nameOf = (id: number) => t(`avatar3d.hairTone.${id}`);
  const detectedName = hair.tone && detected ? `${nameOf(detected)}${hair.tone.family === "ash" || hair.tone.family === "golden" ? ` ${t(`avatar3d.hairTone.family.${hair.tone.family}`)}` : ""}` : null;
  const current = value === 0 ? detectedName ?? t("avatar3d.hairTone.auto") : nameOf(value);
  return (
    <div className="grid gap-1">
      <span className="flex justify-between gap-2 type-body-sm"><span id="adj-hairTone">{t("avatar3d.adjust.hairTone")}</span><span className="type-caption text-muted">{current}</span></span>
      <div role="radiogroup" aria-labelledby="adj-hairTone" className="hair-tones">
        <button type="button" role="radio" aria-checked={value === 0} className="hair-tone is-auto" style={{ background: hair.color ?? undefined }} onClick={() => onChange(0)}
          aria-label={detectedName ? t("avatar3d.hairTone.detectado", { name: detectedName }) : t("avatar3d.hairTone.auto")} title={detectedName ? t("avatar3d.hairTone.detectado", { name: detectedName }) : t("avatar3d.hairTone.auto")}>
          <span aria-hidden>{t("avatar3d.hairTone.auto_curto")}</span>
        </button>
        {HAIR_TONES.map((h) => (
          <button key={h.id} type="button" role="radio" aria-checked={value === h.id} className="hair-tone" style={{ background: h.color }} onClick={() => onChange(h.id)} aria-label={nameOf(h.id)} title={nameOf(h.id)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Corte: o medido na foto ("Da foto", com o nome do corte detectado) ou um dos cortes comuns, masculinos e femininos
 * (raspado, curto, topete, joãozinho, chanel, médio, longo). Troca só o corte: cor e textura seguem as da foto.
 */
function HairCutPicker({ value, onChange, hair }: { value: number; onChange: (v: number) => void; hair: AvatarHair }) {
  const { t } = useI18n();
  const measured = hair.present && hair.length ? t(`avatar3d.hairCut.medido.${hair.length}`) : t("avatar3d.hairCut.medido.bald");
  return (
    <div className="grid gap-1">
      <span className="flex justify-between gap-2 type-body-sm"><span id="adj-hairCut">{t("avatar3d.adjust.hairCut")}</span><span className="type-caption text-muted">{value === 0 ? measured : t(`avatar3d.hairCut.${value}`)}</span></span>
      <div role="radiogroup" aria-labelledby="adj-hairCut" className="flex flex-wrap gap-1.5">
        <Chip role="radio" aria-checked={value === 0} active={value === 0} onClick={() => onChange(0)}>{t("avatar3d.hairCut.0")}</Chip>
        {HAIR_CUTS.map((c) => <Chip key={c.id} role="radio" aria-checked={value === c.id} active={value === c.id} onClick={() => onChange(c.id)}>{t(`avatar3d.hairCut.${c.id}`)}</Chip>)}
      </div>
    </div>
  );
}

/**
 * Franja (HAIR-MOTION): a da foto ou uma escolhida — sem franja, reta (cobre a testa até a sobrancelha, corte reto e
 * simétrico), lateral, cortina ou desfiada. Feita de fios sobre a testa (não de uma superfície), com o mesmo tom.
 */
function HairFringePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-1">
      <span className="flex justify-between gap-2 type-body-sm"><span id="adj-hairFringe">{t("avatar3d.adjust.hairFringe")}</span><span className="type-caption text-muted">{t(`avatar3d.hairFringe.${value}`)}</span></span>
      <div role="radiogroup" aria-labelledby="adj-hairFringe" aria-describedby="adj-hairFringe-hint" className="flex flex-wrap gap-1.5">
        {[0, ...HAIR_FRINGES.map((f) => f.id)].map((id) => <Chip key={id} role="radio" aria-checked={value === id} active={value === id} onClick={() => onChange(id)}>{t(`avatar3d.hairFringe.${id}`)}</Chip>)}
      </div>
      <span id="adj-hairFringe-hint" className="type-caption text-muted">{t("avatar3d.hairFringe.hint")}</span>
    </div>
  );
}

/**
 * Corpo base (feminino/masculino): estimado pelo rosto, no aparelho (lib/avatar3d/sex-detect.ts); quando a estimativa
 * não é segura, vale o do cadastro. A pessoa troca quando quiser — a escolha dela vence as duas.
 */
function BodySexPicker({ value, guess, chosen, onChange }: { value: Sex; guess: SexGuess | null; chosen: boolean; onChange: (s: Sex) => void }) {
  const { t } = useI18n();
  const hint = chosen ? t("avatar3d.sex.escolhido")
    : guess && guess.confidence >= SEX_CONFIDENT && guess.sex === value ? t("avatar3d.sex.detectado", { pct: Math.round(guess.confidence * 100) })
    : guess ? t("avatar3d.sex.cadastro_incerto") : t("avatar3d.sex.cadastro");
  return (
    <div className="grid gap-1.5">
      <span className="type-body-sm" id="avatar-sex">{t("avatar3d.sex.titulo")}</span>
      <SegmentPicker label={t("avatar3d.sex.titulo")} value={value} onChange={onChange}
        options={[{ id: "FEMININO" as Sex, label: t("avatar3d.sex.FEMININO") }, { id: "MASCULINO" as Sex, label: t("avatar3d.sex.MASCULINO") }]} />
      <span className="type-caption text-muted">{hint}</span>
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

/**
 * Criação/refação (RF40.CA01–CA07): o avatar sai de UMA foto — a foto de perfil (RF1). Se ela não servir (sem rosto,
 * rosto pequeno, virado), a pessoa escolhe outra foto aqui mesmo. Análise no aparelho → prévia → consentimento → salvar.
 */
function Create({ sex, onSaved, onCancel, initialPublic }: { sex: "FEMININO" | "MASCULINO"; onSaved: () => void; onCancel?: () => void; initialPublic: boolean }) {
  const { t } = useI18n(); const toast = useToast(); const issueText = useIssueText(); const { user } = useAuth();
  const profileUrl = mediaUrl(user?.avatarUrl);
  const [file, setFile] = useState<Blob | null>(null);
  const [source, setSource] = useState<"profile" | "upload" | null>(null);
  const [profileState, setProfileState] = useState<"loading" | "ok" | "none" | "failed">(profileUrl ? "loading" : "none");
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const [busy, setBusy] = useState<"" | "analyze" | "save">("");
  const [photo, setPhoto] = useState<AnalyzedPhoto | null>(null);
  const [built, setBuilt] = useState<BuiltAvatar | null>(null);
  const [failed, setFailed] = useState(false);
  const [adjust, setAdjust] = useState<AvatarAdjust>({ ...DEFAULT_ADJUST });
  const [view, setView] = useState<AvatarView>("front");
  const [consent, setConsent] = useState(false);
  const [pub, setPub] = useState(initialPublic);
  const [sexChoice, setSexChoice] = useState<Sex | null>(null);        // null = automático (rosto; senão o cadastro)
  // medidas da prévia (fidelidade do rosto e, depois do bake, a pele): presas à prévia que as mediu, para o gate de
  // identidade nunca receber o relatório da prévia anterior nem sair sem ele
  const measured = useRef<{ built: BuiltAvatar; parts: HumanParts } | null>(null);
  const [ready, setReady] = useState<BuiltAvatar | null>(null);         // a prévia cujas medidas já estão prontas
  const bakeWait = useRef(0);
  useEffect(() => () => cancelAnimationFrame(bakeWait.current), []);
  function onHuman(b: BuiltAvatar, p: HumanParts) {
    measured.current = { built: b, parts: p }; setReady(null); cancelAnimationFrame(bakeWait.current);
    const wait = () => {
      if (measured.current?.parts !== p) return;
      if (isMeasured(p)) setReady(b); else bakeWait.current = requestAnimationFrame(wait);
    };
    wait();
  }
  const qualityReady = !!built && ready === built;
  const texture = useMemo(() => {
    if (!built) return null;
    const tex = new THREE.CanvasTexture(built.atlas); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  }, [built]);
  useEffect(() => () => texture?.dispose(), [texture]);

  // A foto de perfil já é a foto do avatar: carrega sozinha, sem pedir outro envio.
  useEffect(() => {
    if (!profileUrl) { setProfileState("none"); return; }
    const ctl = new AbortController();
    fetch(profileUrl, { signal: ctl.signal, mode: "cors" })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => { if (!b.type.startsWith("image/")) throw new Error("tipo"); setFile((f) => f ?? b); setSource((x) => x ?? "profile"); setProfileState("ok"); })
      .catch(() => { if (!ctl.signal.aborted) setProfileState("failed"); });
    return () => ctl.abort();
  }, [profileUrl]);

  function chooseSex(s: Sex) {
    setSexChoice(s);
    if (photo) { const b = buildAvatar([photo], { sex: s, profileSex: sex }); if (b) setBuilt(b); }
  }

  function pick(f: File | null) {
    if (!f) return;
    setFile(f); setSource("upload"); setBuilt(null); setFailed(false); setPhoto(null);
  }

  async function analyze() {
    if (!file) return;
    setBusy("analyze"); setBuilt(null); setFailed(false);
    try {
      const p = await analyzePhoto(file, "front");
      setPhoto(p);
      const b = buildAvatar([p], { sex: sexChoice, profileSex: sex });
      setBuilt(b); setFailed(!b); setView("front");
    } catch {
      toast.error(t("avatar3d.page.erro_processar"));
    } finally { setBusy(""); }
  }

  async function save() {
    const m = measured.current;
    if (!built || !consent || m?.built !== built || !isMeasured(m.parts)) return;
    setBusy("save");
    try {
      const fd = new FormData();
      fd.append("meta", JSON.stringify({ model: built.model, adjust: clampAdjust(adjust), photos: 1, warnings: built.model.warnings, consent: true, publicOnRunway: pub, quality: qualityReport(m.parts.identity, m.parts.human.root.userData.skinReport) }));
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
          <p className="label">{t("avatar3d.page.foto_do_avatar")}</p>
          <p className="mb-2 type-body-sm text-muted">{t("avatar3d.page.uma_foto")}</p>
          <ul className="fai-list mb-3 type-body-sm text-muted">
            <li>{t("avatar3d.page.dica_luz")}</li><li>{t("avatar3d.page.dica_rosto")}</li>
          </ul>
          <div className="flex items-start gap-3">
            <div className="grid aspect-square w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface-2">
              {preview ? <img src={preview} alt={t(source === "profile" ? "avatar3d.page.foto_de_perfil" : "avatar3d.page.foto_escolhida")} className="h-full w-full object-cover" />
                : profileState === "loading" ? <Spinner size={18} /> : <span className="type-caption text-faint">1</span>}
            </div>
            <div className="grid min-w-0 gap-1">
              <p className="type-body-sm font-semibold">{source === "upload" ? t("avatar3d.page.foto_escolhida") : t("avatar3d.page.foto_de_perfil")}</p>
              {!file && profileState === "none" && <p className="type-caption text-muted">{t("avatar3d.page.sem_foto_de_perfil")}</p>}
              {!file && profileState === "failed" && <p className="type-caption text-muted">{t("avatar3d.page.foto_de_perfil_indisponivel")}</p>}
              <FileButton id="avatar-photo" accept="image/*" onFiles={(fs) => pick(fs[0] ?? null)}>{file ? t("avatar3d.page.usar_outra_foto") : t("avatar3d.page.enviar_foto")}</FileButton>
              {photo && !photo.issues.some((x) => x.severity === "block") && <span className="type-caption text-good">✓ {t("avatar3d.page.foto_ok")}</span>}
              {photo?.issues.filter((x) => x.severity === "block").map((x) => <span key={x.code} role="alert" className="type-caption text-critical">✕ {issueText(x)}</span>)}
              {photo?.issues.filter((x) => x.severity === "warn").map((x) => <span key={x.code} className="type-caption text-muted">⚠ {issueText(x)}</span>)}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" loading={busy === "analyze"} disabled={!file || !!busy} onClick={analyze}>{t("avatar3d.page.gerar_previa")}</Button>
            {onCancel && <Button variant="ghost" disabled={!!busy} onClick={onCancel}>{t("common.cancel")}</Button>}
          </div>
          {busy === "analyze" && <p className="mt-2 flex items-center gap-2 type-caption text-muted"><Spinner size={14} />{t("avatar3d.page.processando")}</p>}
          {failed && <p role="alert" className="mt-2 type-body-sm text-critical">{t("avatar3d.page.nao_montou")}</p>}
          <p className="mt-3 type-caption text-faint">{t("avatar3d.page.privacidade")}</p>
        </Card>
        {built && (
          <Card>
            <p className="label">{t("avatar3d.page.ajustes")}</p>
            <div className="mb-3"><BodySexPicker value={built.model.sex ?? sex} guess={built.sexGuess} chosen={!!sexChoice} onChange={chooseSex} /></div>
            <AdjustSliders value={adjust} onChange={setAdjust} hair={built?.model.hair} eyes={built?.model.eyes} brows={built?.model.brows} />
          </Card>
        )}
      </div>
      <div className="grid content-start gap-3">
        <Card>
          <div className="aspect-[4/5] w-full overflow-hidden rounded-md bg-surface-2 sm:aspect-[5/4]">
            {built && texture ? <AvatarViewer avatar={{ model: built.model, adjust, texture }} sex={built.model.sex ?? sex} view={view} onHuman={(p) => onHuman(built, p)} />
              : <p className="grid h-full place-items-center p-6 text-center type-body text-muted">{t("avatar3d.page.previa_vazia")}</p>}
          </div>
          {built && <div className="mt-3"><ViewButtons view={view} onView={setView} /></div>}
          {setIssues.length > 0 && <ul className="fai-list mt-3">{setIssues.map((x) => <li key={x.code} className="type-body-sm text-muted">⚠ {issueText(x)}</li>)}</ul>}
        </Card>
        {built && (
          <Card>
            <label className="flex items-start gap-2 type-body-sm">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{t("avatar3d.page.consentimento")}</span>
            </label>
            <div className="mt-3"><Switch checked={pub} onChange={setPub} label={t("avatar3d.page.publico")} hint={t("avatar3d.page.publico_hint")} /></div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" loading={busy === "save"} disabled={!consent || !!busy || !qualityReady} onClick={save}>{t("avatar3d.page.salvar")}</Button>
              {!qualityReady && <span className="flex items-center gap-2 type-caption text-muted"><Spinner size={14} />{t("avatar3d.page.medindo")}</span>}
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
  const [framing, setFraming] = useState<"bust" | "full">("bust"); const human = useRef<HumanParts | null>(null);
  const [adjust, setAdjust] = useState<AvatarAdjust>(clampAdjust(saved.adjust));
  const [pub, setPub] = useState(!!saved.publicOnRunway);
  const [busy, setBusy] = useState<"" | "patch" | "delete" | "body" | "glb">("");
  const [confirm, setConfirm] = useState(false);
  const body = validateBody(saved.model?.body);
  const dirty = JSON.stringify(clampAdjust(saved.adjust)) !== JSON.stringify(adjust);

  async function saveBody(b: BodyModel | null) {
    setBusy("body");
    try { await api.patch("/api/me/avatar3d", { body: b ?? {} }); toast.success(t("avatar3d.body.salvo")); onChanged(); }
    catch (e) { toast.fromError(e); } finally { setBusy(""); }
  }
  const bodySex: Sex = saved.model?.sex ?? sex;
  async function patch(body: { adjust?: AvatarAdjust; publicOnRunway?: boolean; sex?: Sex }) {
    setBusy("patch");
    try { await api.patch("/api/me/avatar3d", body); toast.success(t("avatar3d.page.ajustes_salvos")); onChanged(); }
    catch (e) { toast.fromError(e); } finally { setBusy(""); }
  }
  async function downloadGlb() {
    const p = human.current; if (!p) return;
    setBusy("glb");
    try { downloadBlob(await exportAvatarGlb(p.human, p.pose, { hair: { live: p.hair, build: p.exportHair } }), "fashionai-avatar.glb"); }
    catch (e) { if (e instanceof Error && e.message === AVATAR_NOT_DRESSED) toast.info(t("avatar3d.page.glb_aguarde_roupa")); else toast.fromError(e); } finally { setBusy(""); }
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
          {(saved.warnings ?? []).length > 0 && <ul className="fai-list mt-2">{saved.warnings!.map((c) => <li key={c} className="type-caption text-muted">⚠ {SAVED_TEXT.has(c) ? t(`avatar3d.saved.${c}`) : issueText({ code: c })}</li>)}</ul>}
          {saved.identity && <IdentityPanel identity={saved.identity} onChanged={onChanged} />}
          <div className="mt-3"><Switch checked={pub} onChange={(v) => { setPub(v); void patch({ publicOnRunway: v }); }} label={t("avatar3d.page.publico")} hint={t("avatar3d.page.publico_hint")} /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={onRedo} disabled={!!busy}>{t("avatar3d.page.refazer")}</Button>
            <Button variant="ghost" onClick={() => setConfirm(true)} disabled={!!busy}>{t("avatar3d.page.excluir")}</Button>
          </div>
        </Card>
        <Card>
          <p className="label">{t("avatar3d.page.ajustes")}</p>
          <div className="mb-3"><BodySexPicker value={bodySex} guess={null} chosen={!!saved.model?.sex} onChange={(v) => { if (v !== bodySex) void patch({ sex: v }); }} /></div>
          <AdjustSliders value={adjust} onChange={setAdjust} hair={saved.model?.hair} eyes={saved.model?.eyes} brows={saved.model?.brows} />
          <Button className="mt-3" variant="primary" size="sm" loading={busy === "patch"} disabled={!dirty || !!busy} onClick={() => patch({ adjust })}>{t("avatar3d.page.salvar_ajustes")}</Button>
        </Card>
      </div>
      <Card>
        <div className="aspect-[4/5] w-full overflow-hidden rounded-md bg-surface-2 sm:aspect-[5/4]">
          {saved.model && <AvatarViewer avatar={{ model: saved.model, adjust, textureUrl: saved.textureUrl }} sex={bodySex} view={view} body={body?.params} framing={framing} onHuman={(p) => { human.current = p; }} />}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ViewButtons view={view} onView={setView} />
          <Button size="sm" variant={framing === "full" ? "primary" : "ghost"} aria-pressed={framing === "full"} onClick={() => setFraming(framing === "full" ? "bust" : "full")}>{t("avatar3d.page.corpo_inteiro")}</Button>
          <Button size="sm" variant="ghost" loading={busy === "glb"} disabled={!!busy} onClick={downloadGlb}>{t("avatar3d.page.baixar_glb")}</Button>
        </div>
        <p className="mt-1 type-caption text-faint">{t("avatar3d.page.baixar_glb_hint")}</p>
        <p className="mt-2 type-caption text-faint">{t("avatar3d.page.onde_aparece")}</p>
      </Card>
      <div className="lg:col-span-2">
        {saved.model && <BodyEditor sex={bodySex} initial={body} avatar={{ model: saved.model, adjust, textureUrl: saved.textureUrl }} saving={busy === "body"} onSave={saveBody} />}
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t("avatar3d.page.excluir_titulo")}
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>{t("common.cancel")}</Button><Button variant="danger" loading={busy === "delete"} onClick={remove}>{t("avatar3d.page.excluir")}</Button></>}>
        <p className="type-body">{t("avatar3d.page.excluir_texto")}</p>
      </Dialog>
    </div>
  );
}

/**
 * AVATAR-ID I1 — estado da identidade: versão atual, se passou no gate, o que reprovou (em palavras, nunca números do
 * rosto), aprovar mesmo assim e voltar para uma versão anterior. Outras pessoas veem sempre a última versão aprovada.
 */
function IdentityPanel({ identity, onChanged }: { identity: IdentityView; onChanged: () => void }) {
  const { t, fmtDateTime } = useI18n(); const toast = useToast();
  const versions = useApi<VersionRow[]>((signal) => api.get("/api/me/avatar3d/versions", { signal }), [identity.version, identity.status]);
  const [busy, setBusy] = useState<string>(""); const [open, setOpen] = useState(false);
  const failed = identity.quality?.gate?.failed ?? [];
  const checks = failed.map((c) => t(`avatar3d.identity.check.${c}`)).join(", ");
  async function act(key: string, path: string, body: unknown, ok: string) {
    setBusy(key);
    try { await api.post(path, body); toast.success(ok); onChanged(); versions.reload(); }
    catch (e) { toast.fromError(e); } finally { setBusy(""); }
  }
  const tone = identity.status === "APPROVED" ? "thread" : identity.status === "NEEDS_REFINEMENT" ? "chalk" : undefined;
  return (
    <div className="mt-3 grid gap-2" data-identity-status={identity.status}>
      <p className="flex flex-wrap items-center gap-2 type-body-sm">
        <span>{t("avatar3d.identity.versao", { n: identity.version })}</span>
        <Badge tone={tone}>{t(`avatar3d.identity.status.${identity.status}`)}</Badge>
      </p>
      {identity.status === "NEEDS_REFINEMENT" && (
        <div role="note" className="rounded-md bg-surface-2 p-2 type-caption">
          <p>{checks ? t("avatar3d.identity.aviso_refinar", { checks }) : t("avatar3d.identity.aviso_refinar_geral")}</p>
          <p className="mt-1 text-muted">{identity.approvedVersion ? t("avatar3d.identity.outros_veem", { n: identity.approvedVersion }) : t("avatar3d.identity.outros_veem_manequim")}</p>
          <Button className="mt-2" size="sm" loading={busy === "approve"} disabled={!!busy}
            onClick={() => act("approve", `/api/me/avatar3d/versions/${identity.version}/approve`, { acceptWarnings: true }, t("avatar3d.identity.aprovada_ok"))}>
            {t("avatar3d.identity.aprovar_mesmo_assim")}
          </Button>
        </div>
      )}
      <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{t("avatar3d.identity.versoes")}{versions.data ? ` · ${versions.data.length}` : ""}</Button>
      {open && (
        <ul className="fai-list" aria-label={t("avatar3d.identity.versoes")}>
          {(versions.data ?? []).map((v) => (
            <li key={v.version} className="flex flex-wrap items-center gap-2 py-1 type-caption">
              <span className="type-data">v{v.version}</span>
              <span>{t(`avatar3d.identity.status.${v.status}`)}{v.approvedWithWarnings ? ` (${t("avatar3d.identity.com_avisos")})` : ""}</span>
              {v.current && <Badge tone="mark">{t("avatar3d.identity.atual")}</Badge>}
              {v.approved && <Badge tone="thread">{t("avatar3d.identity.vista_pelos_outros")}</Badge>}
              {v.createdAt && <span className="text-faint">{fmtDateTime(v.createdAt)}</span>}
              {!v.current && <Button size="sm" variant="ghost" loading={busy === `r${v.version}`} disabled={!!busy}
                onClick={() => act(`r${v.version}`, `/api/me/avatar3d/versions/${v.version}/restore`, {}, t("avatar3d.identity.restaurada"))}>{t("avatar3d.identity.restaurar")}</Button>}
            </li>
          ))}
        </ul>
      )}
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

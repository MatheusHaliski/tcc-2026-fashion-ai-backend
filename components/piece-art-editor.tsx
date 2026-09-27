"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { PieceView } from "@/lib/api/types";
import { api, type ApiError } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Chip, Dialog, Switch, useToast } from "@/components/ui";
import { BackgroundStudio, ContainerColor, SkinPicker, type BgConfig } from "@/components/background-studio";
import { PieceCard } from "@/components/piece-card";
import { ArtStage, artSurfaceProps } from "@/components/piece-art";
import {
  AURA_MAX, EFFECT_LIMIT, FAMILIES, FAMILY_EFFECTS, FAMILY_EMPHASIS, SEASONS, STUDIO_KEYS, activeEffects, constrainEffects, defaultArt, readPieceArt, studioPart, writePieceArt,
  type ArtEffects, type ArtFamily, type ArtVariant, type Emphasis, type PieceArt,
} from "@/lib/piece-art";

const STEPS = ["template", "composition", "art", "surface", "effects", "preview"] as const;
type StepId = (typeof STEPS)[number];
/** Efeitos liga/desliga, na ordem em que aparecem no editor (acabamento e textura têm opções próprias). */
const TOGGLES = ["rim", "glow", "glass", "relief", "collage", "particles"] as const;

/**
 * Editor da arte do card da peça (RF11), na ordem das camadas: template (família e variação) → composição (onde a arte
 * ganha mais área) → fundo artístico (os controles do Background Studio) → superfície interna (skin, cor e sólido/vidro
 * do container) → efeitos (com limite e só os que combinam com a família) → prévia e aplicação. A prévia é o PRÓPRIO
 * {@link PieceCard} do feed, com a mesma largura de uma coluna da grade; nada aqui altera a foto da peça.
 */
export function PieceArtEditor({ value, onChange, piece, styles, occasions, mediaPanel, actions }: {
  /** config completo do fundo (Studio + v2): o editor é controlado */
  value: Record<string, unknown>; onChange: (bg: Record<string, unknown>) => void;
  piece: PieceView; styles?: string[]; occasions?: string[];
  /** fundo da área da peça (a foto de estúdio), quando o contexto permite trocá-lo */
  mediaPanel?: ReactNode;
  /** aplicar / cancelar / restaurar (no detalhe) ou a navegação do cadastro */
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState<StepId>("template");
  const art = readPieceArt(value);
  const studio = studioPart(value) as BgConfig & { skin?: string };
  const emit = (next: PieceArt, patch: Record<string, unknown> = {}) => onChange(writePieceArt(value, next, patch));
  const family = art.template.family;
  const preview = useMemo(() => ({ ...piece, background: value }), [piece, value]);
  const idx = STEPS.indexOf(step);

  function chooseTemplate(f: ArtFamily, v: ArtVariant) {
    // a composição volta à da família (ênfase própria) e só ficam os efeitos que combinam com ela
    emit({ ...art, template: { ...art.template, family: f, variant: v }, composition: { emphasis: FAMILY_EMPHASIS[f][v] }, effects: constrainEffects(art.effects, f) });
  }
  const setEffects = (e: ArtEffects) => emit({ ...art, effects: constrainEffects(e, family) });
  const on = activeEffects(art.effects).length;
  const allowed = new Set(FAMILY_EFFECTS[family]);
  const clearStudio = Object.fromEntries(STUDIO_KEYS.filter((k) => k !== "skin").map((k) => [k, null]));
  const hasStudioArt = STUDIO_KEYS.some((k) => k !== "skin" && value[k] != null && value[k] !== "");

  return (
    <div className="pae">
      <div className="pae-main">
        <ol className="pae-steps" aria-label={t("pieceArt.etapas")}>
          {STEPS.map((s, i) => <li key={s}><button type="button" className="chip" aria-current={step === s ? "step" : undefined} aria-pressed={step === s} onClick={() => setStep(s)}>{i + 1} · {t(`pieceArt.step.${s}`)}</button></li>)}
        </ol>

        {step === "template" && (
          <section aria-labelledby="pae-h-template" className="grid gap-3">
            <h3 id="pae-h-template" className="pae-h">{t("pieceArt.step.template")}</h3>
            <p className="type-caption text-muted">{t("pieceArt.template_ajuda")}</p>
            <div className="pae-families">
              {FAMILIES.map((f) => (
                <div key={f} className="pae-family">
                  <p className="type-body-sm font-semibold">{t(`pieceArt.family.${f}`)}</p>
                  <div className="pae-variants">
                    {(["a", "b"] as const).map((v) => {
                      const current = family === f && art.template.variant === v;
                      return (
                        <button key={v} type="button" className="pae-swatch-btn" aria-pressed={current} onClick={() => chooseTemplate(f, v)}
                          aria-label={t("pieceArt.template_rotulo", { family: t(`pieceArt.family.${f}`), variant: v.toUpperCase(), desc: t(`pieceArt.variant.${f}.${v}`) })}>
                          <Swatch art={{ ...defaultArt(f, v), template: { family: f, variant: v, season: art.template.season } }} pieceHex={piece.colorHex} />
                          <span className="pae-swatch-cap">{v.toUpperCase()} · {t(`pieceArt.variant.${f}.${v}`)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {family === "seasonal" && (
              <div><p className="label">{t("pieceArt.estacao")}</p>
                <div className="flex flex-wrap gap-1.5">{SEASONS.map((s) => <Chip key={s} active={art.template.season === s} onClick={() => emit({ ...art, template: { ...art.template, season: s } })}>{t(`pieceArt.season.${s}`)}</Chip>)}</div></div>
            )}
          </section>
        )}

        {step === "composition" && (
          <section aria-labelledby="pae-h-comp" className="grid gap-3">
            <h3 id="pae-h-comp" className="pae-h">{t("pieceArt.step.composition")}</h3>
            <p className="type-caption text-muted">{t("pieceArt.composicao_ajuda")}</p>
            <div role="radiogroup" aria-labelledby="pae-h-comp" className="pae-variants">
              {(["balanced", "top", "bottom"] as Emphasis[]).map((e) => (
                <button key={e} type="button" role="radio" aria-checked={art.composition.emphasis === e} className="pae-swatch-btn" onClick={() => emit({ ...art, composition: { emphasis: e } })}>
                  <Swatch art={{ ...art, composition: { emphasis: e }, effects: { ...art.effects, motion: false } }} bg={value} pieceHex={piece.colorHex} />
                  <span className="pae-swatch-cap">{t(`pieceArt.emphasis.${e}`)}{FAMILY_EMPHASIS[family][art.template.variant] === e ? ` · ${t("pieceArt.padrao_da_familia")}` : ""}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === "art" && (
          <section aria-labelledby="pae-h-art" className="grid gap-3">
            <h3 id="pae-h-art" className="pae-h">{t("pieceArt.step.art")}</h3>
            <p className="type-caption text-muted">{t("pieceArt.fundo_ajuda")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Chip active={!hasStudioArt} onClick={() => emit(art, clearStudio)}>{t("pieceArt.sem_arte_do_studio")}</Chip>
              {hasStudioArt && <span className="type-caption text-muted">{t("pieceArt.arte_do_studio_ativa")}</span>}
            </div>
            <BackgroundStudio artOnly value={studio} onChange={(v) => emit(art, { ...v })} skin={studio.skin ?? ""} onSkin={(s) => emit(art, { skin: s })} anatomy="" onAnatomy={() => undefined} styles={styles} occasions={occasions} />
          </section>
        )}

        {step === "surface" && (
          <section aria-labelledby="pae-h-surface" className="grid gap-4">
            <h3 id="pae-h-surface" className="pae-h">{t("pieceArt.step.surface")}</h3>
            <p className="type-caption text-muted">{t("pieceArt.superficie_ajuda")}</p>
            <SkinPicker skin={studio.skin ?? ""} onSkin={(s) => emit(art, { skin: s })} />
            <ContainerColor value={{ container: { color: art.surface.color } }} skin={studio.skin ?? ""} onChange={(p) => emit({ ...art, surface: { ...art.surface, color: p.container?.color ?? null } })} />
            <div role="radiogroup" aria-label={t("pieceArt.acabamento_do_container")} className="flex flex-wrap gap-1.5">
              {(["solid", "frosted"] as const).map((s) => <Chip key={s} role="radio" aria-checked={art.surface.style === s} active={art.surface.style === s} onClick={() => emit({ ...art, surface: { ...art.surface, style: s } })}>{t(`pieceArt.surface.${s}`)}</Chip>)}
            </div>
            <div className="rounded-md border border-line-soft p-3">
              <p className="label">{t("pieceArt.fundo_da_area_da_peca")}</p>
              {mediaPanel ?? <p className="type-caption text-muted">{t("pieceArt.fundo_da_area_da_peca_ajuda")}</p>}
            </div>
          </section>
        )}

        {step === "effects" && (
          <section aria-labelledby="pae-h-fx" className="grid gap-3">
            <h3 id="pae-h-fx" className="pae-h">{t("pieceArt.step.effects")}</h3>
            <p className="type-caption text-muted" aria-live="polite">{t("pieceArt.efeitos_limite", { on, max: EFFECT_LIMIT })}</p>
            {allowed.has("aura") && (
              <fieldset className="pae-fx">
                <Switch checked={art.effects.aura.on} onChange={(v) => setEffects({ ...art.effects, aura: { ...art.effects.aura, on: v } })} label={t("pieceArt.fx.aura")} hint={t("pieceArt.fx.aura_ajuda")} />
                {art.effects.aura.on && <div className="grid gap-2 sm:grid-cols-2">
                  <Range label={t("pieceArt.fx.intensidade")} value={art.effects.aura.intensity} max={AURA_MAX} onChange={(n) => setEffects({ ...art.effects, aura: { ...art.effects.aura, intensity: n } })} />
                  <Range label={t("pieceArt.fx.alcance")} value={art.effects.aura.reach} max={1} onChange={(n) => setEffects({ ...art.effects, aura: { ...art.effects.aura, reach: n } })} />
                </div>}
              </fieldset>
            )}
            {TOGGLES.map((k) => {
              const ok = allowed.has(k); const active = !!art.effects[k]; const full = !active && on >= EFFECT_LIMIT;
              return <Switch key={k} checked={active} disabled={!ok || full} onChange={(v) => setEffects({ ...art.effects, [k]: v })} label={t(`pieceArt.fx.${k}`)}
                hint={!ok ? t("pieceArt.fx.nao_combina", { family: t(`pieceArt.family.${family}`) }) : full ? t("pieceArt.fx.limite_atingido") : t(`pieceArt.fx.${k}_ajuda`)} />;
            })}
            <Options label={t("pieceArt.fx.finish")} disabled={!allowed.has("finish")} full={art.effects.finish === "none" && on >= EFFECT_LIMIT} value={art.effects.finish} options={["none", "metallic", "iridescent"]} onChange={(v) => setEffects({ ...art.effects, finish: v as ArtEffects["finish"] })} family={family} />
            <Options label={t("pieceArt.fx.texture")} disabled={!allowed.has("texture")} full={art.effects.texture === "none" && on >= EFFECT_LIMIT} value={art.effects.texture} options={["none", "paper", "fabric", "ceramic"]} onChange={(v) => setEffects({ ...art.effects, texture: v as ArtEffects["texture"] })} family={family} />
            {allowed.has("motion") && <Switch checked={art.effects.motion} disabled={!art.effects.particles && !art.effects.aura.on} onChange={(v) => setEffects({ ...art.effects, motion: v })} label={t("pieceArt.fx.motion")} hint={t("pieceArt.fx.motion_ajuda")} />}
          </section>
        )}

        {step === "preview" && (
          <section aria-labelledby="pae-h-prev" className="grid gap-3">
            <h3 id="pae-h-prev" className="pae-h">{t("pieceArt.step.preview")}</h3>
            <p className="type-caption text-muted">{t("pieceArt.previa_ajuda")}</p>
            <div className="pae-expanded" aria-label={t("pieceArt.previa_ampliada")} role="img">
              <Swatch art={art} bg={value} pieceHex={piece.colorHex} density="expanded" photo={pieceImage(piece)} />
            </div>
          </section>
        )}

        <div className="pae-nav">
          <Button onClick={() => setStep(STEPS[Math.max(0, idx - 1)])} disabled={idx === 0}>{t("common.back")}</Button>
          {idx < STEPS.length - 1 && <Button onClick={() => setStep(STEPS[idx + 1])}>{t("common.next")}</Button>}
          {actions}
        </div>
      </div>
      {/* sem "card-preview": a prévia é idêntica ao card do feed (nem o lugar reservado do selo aparece) */}
      <aside className="pae-preview" aria-label={t("pieceArt.previa_no_feed")}>
        <p className="label">{t("pieceArt.previa_no_feed")}</p>
        <div className="pae-preview-card"><PieceCard piece={preview} href="#" /></div>
        <p className="type-caption text-muted">{t("pieceArt.camadas_legenda")}</p>
      </aside>
    </div>
  );
}

const pieceImage = (p: PieceView) => p.studioFeedUrl ?? p.studioImageUrl ?? p.thumbnailUrl ?? p.imageUrl ?? null;

/** Miniatura das camadas (template e composição): a mesma área artística do card, com um container vazio no lugar do conteúdo. */
function Swatch({ art, bg, pieceHex, density = "compact", photo }: { art: PieceArt; bg?: Record<string, unknown>; pieceHex?: string | null; density?: "compact" | "expanded"; photo?: string | null }) {
  const surface = artSurfaceProps(bg ?? null, art, density);
  return (
    <span {...surface} className={`fai-card ${surface.className} pae-swatch`} style={{ ...surface.style }}>
      <ArtStage bg={bg ?? null} art={art} density={density} pieceHex={pieceHex} />
      <span className="pc-frame"><span className="pc-content">{photo ? <img src={photo} alt="" className="pae-swatch-photo" /> : <span className="pae-swatch-box" />}</span></span>
    </span>
  );
}

function Range({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="grid gap-1 type-body-sm">
      <span>{label} · {Math.round((value / max) * 100)}%</span>
      <input type="range" min={0} max={max} step={0.05} value={Math.min(value, max)} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Options({ label, value, options, onChange, disabled, full, family }: { label: string; value: string; options: string[]; onChange: (v: string) => void; disabled: boolean; full: boolean; family: ArtFamily }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="label">{label}</p>
      {disabled ? <p className="type-caption text-muted">{t("pieceArt.fx.nao_combina", { family: t(`pieceArt.family.${family}`) })}</p> : (
        <div className="flex flex-wrap gap-1.5">{options.map((o) => <Chip key={o} role="radio" aria-checked={value === o} active={value === o} disabled={o !== "none" && full} onClick={() => onChange(o)}>{t(`pieceArt.opt.${o}`)}</Chip>)}</div>
      )}
    </div>
  );
}

/** Tudo que o Studio e a v2 escrevem, zerado: volta ao template Clássico sem arte, sem efeitos e com o container nativo. */
export function restoredArt(prev: Record<string, unknown>): Record<string, unknown> {
  const clear = Object.fromEntries(STUDIO_KEYS.map((k) => [k, null]));
  return writePieceArt(prev, defaultArt(), clear);
}

/**
 * Editor no detalhe da peça (dono): rascunho local — nada muda no card publicado até "Aplicar". Cancelar fecha sem
 * gravar; "Restaurar padrão" só mexe no rascunho. A gravação leva a revisão lida (baseRev): se outra janela aplicou
 * antes, o servidor recusa (409) e o editor avisa em vez de sobrescrever.
 */
export function PieceArtDialog({ piece, open, onClose, onSaved }: { piece: PieceView; open: boolean; onClose: () => void; onSaved: (p: PieceView) => void }) {
  const { t } = useI18n(); const toast = useToast();
  const initial = (piece.background ?? {}) as Record<string, unknown>;
  const [draft, setDraft] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setDraft((piece.background ?? {}) as Record<string, unknown>); setError(null); } }, [open, piece.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  async function apply() {
    setBusy(true); setError(null);
    try {
      const baseRev = typeof initial.rev === "number" ? initial.rev : 0;
      const r = await api.put<{ background: Record<string, unknown> }>(`/api/pieces/${piece.id}/background`, { ...draft, baseRev });
      onSaved({ ...piece, background: r.background ?? draft });
      toast.success(t("pieceArt.aplicada"));
      onClose();
    } catch (e) { setError((e as ApiError).message ?? t("pieceArt.erro_ao_aplicar")); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={onClose} title={t("pieceArt.titulo")} size="xl"
      footer={<>
        <Button onClick={() => setDraft(restoredArt(draft))}>{t("pieceArt.restaurar_padrao")}</Button>
        <span className="grow" />
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={apply} loading={busy} disabled={!dirty}>{t("pieceArt.aplicar")}</Button>
      </>}>
      {error && <p role="alert" className="mb-3 rounded-md bg-mark-soft p-2 type-body-sm">{error}</p>}
      <PieceArtEditor value={draft} onChange={setDraft} piece={piece} styles={piece.style} occasions={piece.occasion} />
    </Dialog>
  );
}

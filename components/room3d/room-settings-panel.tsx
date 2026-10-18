"use client";
import type { ReactNode } from "react";
import { Button, Chip, SegmentPicker, Select, Switch } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { availableViews, cameraViewMeta, type CameraViewId } from "@/lib/room3d/camera-views";
import { DEFAULT_ROOM_SETTINGS, FAVORITE_SLOTS, FOV_RANGE, KELVINS, type RoomSettings } from "@/lib/room3d/room-settings";

/**
 * Configurações do Meu Quarto (no lugar das antigas abas 2.5D/Lista e da lista de posições): no alto, o que se faz a
 * toda hora — luz, roupa do avatar e trocar um móvel —; abaixo, como num jogo de quarto (The Sims), câmera e pontos de
 * vista (cantos do teto, planta, casa de bonecas…), vistas favoritas, paredes, ambiente, gráficos, interface, foto e
 * visitas e acessibilidade. Cada mudança vale na hora na cena ao lado.
 */
export interface RoomSettingsPanelProps {
  settings: RoomSettings;
  onChange: (patch: Partial<RoomSettings>) => void;
  /** a cena 3D existe neste aparelho (sem ela, só o que não depende de câmera) */
  gl: boolean;
  walking: boolean; onWalking: (walking: boolean) => void;
  light: { on: boolean; busy: boolean; intensity: number; onToggle: () => void; onDim: (value: number) => void };
  /** roupa de agora (espelho) e a roupa padrão do quarto (conjunto e/ou peças do guarda-roupa) */
  outfit: { names: string[]; onChange: () => void; onVistaMe: () => void; defaultLabel?: string; onDefault?: () => void };
  onFurniture: () => void; onPhoto: () => void; onKeys: () => void;
  onSaveFavorite: (slot: number) => void; onRecallFavorite: (slot: number) => void; onClearFavorite: (slot: number) => void;
  /** botão da ajuda ilustrada dos controles (tutorial) */
  help?: ReactNode;
}

const GROUPS = ["quarto", "teto", "avatar"] as const;

export function RoomSettingsPanel({ settings: s, onChange, gl, walking, onWalking, light, outfit, onFurniture, onPhoto, onKeys, onSaveFavorite, onRecallFavorite, onClearFavorite, help }: RoomSettingsPanelProps) {
  const { t } = useI18n();
  const views = availableViews(true);
  const forced = cameraViewMeta(s.view).walls;
  const pickView = (id: CameraViewId) => onChange({ view: id, favorite: null });
  return (
    <section className="room-settings" aria-labelledby="room-settings-title" data-testid="room-settings">
      <header className="room-settings-head">
        <h2 id="room-settings-title" className="type-h3">{t("room.settings.title")}</h2>
        {help}
      </header>

      {/* o que se faz a toda hora: luz, roupa e móvel */}
      <div className="room-settings-cards">
        <article className="room-settings-card" aria-labelledby="rs-light">
          <h3 id="rs-light" className="type-label">{t("room.settings.light.title")}</h3>
          <Switch checked={light.on} onChange={() => light.onToggle()} disabled={light.busy} label={t("room.settings.light.ceiling")} />
          <label className="room-settings-range">
            <span>{t("room.light_intensity")}</span>
            <input type="range" min={0} max={100} step={1} value={Math.round(light.intensity * 100)} aria-label={t("room.light_intensity")} onChange={(e) => light.onDim(Number(e.target.value) / 100)} />
            <output className="type-caption tabular">{Math.round(light.intensity * 100)}%</output>
          </label>
        </article>
        <article className="room-settings-card" aria-labelledby="rs-outfit">
          <h3 id="rs-outfit" className="type-label">{t("room.settings.outfit.title")}</h3>
          <p className="type-body-sm">{outfit.names.length ? outfit.names.join(" · ") : t("room.settings.outfit.default")}</p>
          {outfit.defaultLabel && <p className="type-caption text-muted">{outfit.defaultLabel}</p>}
          <div className="room-settings-actions">
            <Button size="sm" variant="primary" onClick={outfit.onChange}>{t("room.settings.outfit.change")}</Button>
            {outfit.onDefault && <Button size="sm" onClick={outfit.onDefault}>{t("room.settings.outfit.choose")}</Button>}
            <Button size="sm" onClick={outfit.onVistaMe}>{t("room.vista_me_2")}</Button>
          </div>
        </article>
        <article className="room-settings-card" aria-labelledby="rs-furniture">
          <h3 id="rs-furniture" className="type-label">{t("room.settings.furniture.title")}</h3>
          <p className="type-caption text-muted">{t("room.settings.furniture.hint")}</p>
          <Button size="sm" onClick={onFurniture}>{t("room.settings.furniture.open")}</Button>
        </article>
      </div>

      {gl && <details className="room-settings-section" open>
        <summary>{t("room.settings.camera.title")}</summary>
        <SegmentPicker label={t("room.settings.camera.mode")} value={walking ? "walk" : "orbit"} onChange={(v) => onWalking(v === "walk")}
          options={[{ id: "walk", label: t("room.settings.camera.walk") }, { id: "orbit", label: t("room.settings.camera.orbit") }]} />
        {GROUPS.map((group) => (
          <div key={group} role="radiogroup" aria-label={t(`room.settings.view.group.${group}`)} className="room-settings-views">
            <p className="type-caption text-muted">{t(`room.settings.view.group.${group}`)}</p>
            {views.filter((v) => v.group === group).map((v) => {
              const off = !!v.walkOnly && !walking;
              return <Chip key={v.id} role="radio" aria-checked={!s.favorite && s.view === v.id} disabled={off} title={off ? t("room.settings.view.walk_only") : undefined}
                onClick={() => pickView(v.id)}>{t(`room.settings.view.${v.id}`)}</Chip>;
            })}
          </div>
        ))}
        <div className="room-settings-favorites" role="group" aria-label={t("room.settings.favorites.title")}>
          <p className="type-caption text-muted">{t("room.settings.favorites.title")}</p>
          <ol>
            {Array.from({ length: FAVORITE_SLOTS }, (_, i) => i + 1).map((slot) => {
              const saved = !!s.favorites[slot - 1];
              return <li key={slot} className={s.favorite === slot ? "is-active" : undefined}>
                <span className="tabular">{slot}</span>
                <Button size="sm" variant="ghost" disabled={!saved} onClick={() => onRecallFavorite(slot)} aria-label={t("room.settings.favorites.go", { n: slot })}>{saved ? t("room.settings.favorites.go_short") : t("room.settings.favorites.empty")}</Button>
                <Button size="sm" variant="ghost" onClick={() => onSaveFavorite(slot)} aria-label={t("room.settings.favorites.save", { n: slot })}>{t("room.settings.favorites.save_short")}</Button>
                {saved && <Button size="sm" variant="ghost" onClick={() => onClearFavorite(slot)} aria-label={t("room.settings.favorites.clear", { n: slot })}>✕</Button>}
              </li>;
            })}
          </ol>
          <p className="type-caption text-muted">{t("room.settings.favorites.keys")}</p>
        </div>
        <Switch checked={s.fov === null} onChange={(auto) => onChange({ fov: auto ? null : 60 })} label={t("room.settings.camera.fov_auto")} />
        {s.fov !== null && <label className="room-settings-range">
          <span>{t("room.settings.camera.fov")}</span>
          <input type="range" min={FOV_RANGE.min} max={FOV_RANGE.max} step={1} value={s.fov} aria-label={t("room.settings.camera.fov")} onChange={(e) => onChange({ fov: Number(e.target.value) })} />
          <output className="type-caption tabular">{s.fov}°</output>
        </label>}
        <label className="room-settings-range">
          <span>{t("room.settings.camera.sensitivity")}</span>
          <input type="range" min={10} max={100} step={5} value={s.sensitivity} aria-label={t("room.settings.camera.sensitivity")} onChange={(e) => onChange({ sensitivity: Number(e.target.value) })} />
          <output className="type-caption tabular">{s.sensitivity}%</output>
        </label>
        <Switch checked={s.invertX} onChange={(v) => onChange({ invertX: v })} label={t("room.settings.camera.invert_x")} />
        <Switch checked={s.invertY} onChange={(v) => onChange({ invertY: v })} label={t("room.settings.camera.invert_y")} />
        <Switch checked={s.follow} onChange={(v) => onChange({ follow: v })} label={t("room.settings.camera.follow")} hint={t("room.settings.camera.follow_hint")} />
        <SegmentPicker label={t("room.settings.camera.transition")} value={s.transition} onChange={(v) => onChange({ transition: v })}
          options={[{ id: "suave", label: t("room.settings.camera.smooth") }, { id: "corte", label: t("room.settings.camera.cut") }]} />
      </details>}

      {gl && <details className="room-settings-section">
        <summary>{t("room.settings.walls.title")}</summary>
        <SegmentPicker label={t("room.settings.walls.title")} value={s.walls} onChange={(v) => onChange({ walls: v })}
          options={[{ id: "inteiras", label: t("room.settings.walls.up") }, { id: "recortadas", label: t("room.settings.walls.cutaway") }, { id: "baixas", label: t("room.settings.walls.down") }]} />
        <p className="type-caption text-muted">{forced && !s.favorite ? t("room.settings.walls.forced", { view: t(`room.settings.view.${s.view}`) }) : t(`room.settings.walls.hint.${s.walls}`)}</p>
      </details>}

      {gl && <details className="room-settings-section">
        <summary>{t("room.settings.ambient.title")}</summary>
        <label className="room-settings-field"><span>{t("room.settings.ambient.period")}</span>
          <Select aria-label={t("room.settings.ambient.period")} value={s.period} onChange={(e) => onChange({ period: e.target.value as RoomSettings["period"] })}>
            {(["auto", "morning", "afternoon", "golden", "night"] as const).map((p) => <option key={p} value={p}>{t(`room.settings.ambient.period_${p}`)}</option>)}
          </Select></label>
        <label className="room-settings-field"><span>{t("room.settings.ambient.kelvin")}</span>
          <Select aria-label={t("room.settings.ambient.kelvin")} value={s.kelvin ?? ""} onChange={(e) => onChange({ kelvin: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{t("room.settings.ambient.kelvin_room")}</option>
            {KELVINS.map((k) => <option key={k} value={k}>{t(`room.settings.ambient.kelvin_${k}`)}</option>)}
          </Select></label>
        <p className="type-caption text-muted">{t("room.settings.ambient.kelvin_hint")}</p>
      </details>}

      {gl && <details className="room-settings-section">
        <summary>{t("room.settings.graphics.title")}</summary>
        <label className="room-settings-field"><span>{t("room.settings.graphics.quality")}</span>
          <Select aria-label={t("room.settings.graphics.quality")} value={s.quality} onChange={(e) => onChange({ quality: e.target.value as RoomSettings["quality"] })}>
            {(["auto", "alta", "leve"] as const).map((q) => <option key={q} value={q}>{t(`room.settings.graphics.quality_${q}`)}</option>)}
          </Select></label>
        <label className="room-settings-field"><span>{t("room.settings.graphics.mirror")}</span>
          <Select aria-label={t("room.settings.graphics.mirror")} value={s.mirror} onChange={(e) => onChange({ mirror: e.target.value as RoomSettings["mirror"] })}>
            {(["auto", "alto", "medio", "desligado"] as const).map((q) => <option key={q} value={q}>{t(`room.settings.graphics.mirror_${q}`)}</option>)}
          </Select></label>
        <Switch checked={s.dynamicRes} onChange={(v) => onChange({ dynamicRes: v })} label={t("room.settings.graphics.dynamic")} hint={t("room.settings.graphics.dynamic_hint")} />
      </details>}

      {gl && <details className="room-settings-section">
        <summary>{t("room.settings.hud.title")}</summary>
        <SegmentPicker label={t("room.settings.hud.title")} value={s.hud} onChange={(v) => onChange({ hud: v })}
          options={[{ id: "completo", label: t("room.settings.hud.full") }, { id: "minimo", label: t("room.settings.hud.minimal") }, { id: "oculto", label: t("room.settings.hud.hidden") }]} />
        <Switch checked={s.viewName} onChange={(v) => onChange({ viewName: v })} label={t("room.settings.hud.view_name")} />
      </details>}

      <details className="room-settings-section">
        <summary>{t("room.settings.more.title")}</summary>
        <div className="room-settings-actions">
          {gl && <Button size="sm" onClick={onPhoto}>{t("room.photo.modo_foto")}</Button>}
          <Button size="sm" onClick={onKeys}>{t("room.settings.more.keys")}</Button>
        </div>
      </details>

      <details className="room-settings-section">
        <summary>{t("room.settings.a11y.title")}</summary>
        <SegmentPicker label={t("room.settings.a11y.motion")} value={s.motion} onChange={(v) => onChange({ motion: v })}
          options={[{ id: "sistema", label: t("room.settings.a11y.motion_system") }, { id: "reduzido", label: t("room.settings.a11y.motion_reduced") }, { id: "normal", label: t("room.settings.a11y.motion_normal") }]} />
        <Switch checked={s.comfort} onChange={(v) => onChange({ comfort: v })} label={t("room.settings.a11y.comfort")} hint={t("room.settings.a11y.comfort_hint")} />
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_ROOM_SETTINGS, favorites: s.favorites })}>{t("room.settings.reset")}</Button>
      </details>
    </section>
  );
}

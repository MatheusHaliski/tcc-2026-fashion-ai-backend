"use client";

import { FaiIcon } from "@/components/fai-icon";
import { Button, Chip, SegmentPicker } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type {
  EnvironmentMode,
  LightMode,
  ResolvedEnvironment,
} from "@/lib/tryon/fitting-room";

export interface FittingControlsProps {
  light: LightMode;
  onLightChange: (light: LightMode) => void;
  mode: EnvironmentMode;
  onModeChange: (mode: EnvironmentMode) => void;
  environment: ResolvedEnvironment;
  itemCount: number;
  onSnapshot: () => void;
  onCopyLink: () => void;
  onSave: () => void;
  onClear: () => void;
}

/** Controlled view controls keep presentation independent of persistence and dialogs. */
export function FittingControls({
  light,
  onLightChange,
  mode,
  onModeChange,
  environment,
  itemCount,
  onSnapshot,
  onCopyLink,
  onSave,
  onClear,
}: FittingControlsProps) {
  const { t } = useI18n();
  const pinnedKey = typeof mode === "object" ? mode.pinned : null;

  return (
    <div className="fitting-controls">
      <div className="fitting-selectors">

        <div className="fitting-control-group">
          <p className="label">{t("tryOn.luz")}</p>
          <SegmentPicker
            label={t("tryOn.luz")}
            value={light}
            onChange={onLightChange}
            options={[
              { id: "store", label: t("tryOn.luz_loja") },
              { id: "daylight", label: t("tryOn.luz_dia") },
              { id: "night", label: t("tryOn.luz_noite") },
            ]}
          />
        </div>

        <div
          className="fitting-control-group fitting-environment-controls"
          role="group"
          aria-label={t("tryOn.ambiente")}
        >
          <p className="label">{t("tryOn.ambiente")}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip active={mode === "auto"} onClick={() => onModeChange("auto")}>
              {t("tryOn.ambiente_auto")}
            </Chip>
            {environment.brands.map((brand) => (
              <Chip
                key={brand.key}
                active={pinnedKey === brand.key}
                onClick={() => onModeChange(
                  pinnedKey === brand.key ? "auto" : { pinned: brand.key }
                )}
                title={t("tryOn.fixar_marca", { marca: brand.name })}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: brand.accent }}
                  aria-hidden
                />
                {brand.name}
              </Chip>
            ))}
            <Chip active={mode === "neutral"} onClick={() => onModeChange("neutral")}>
              {t("tryOn.ambiente_neutro")}
            </Chip>
          </div>
        </div>
      </div>

      <div className="fitting-actions">
        <Button size="sm" onClick={onSnapshot}>
          <FaiIcon id="ACT-07" size={20} decorative />
          {t("tryOn.tirar_foto")}
        </Button>
        <Button size="sm" onClick={onCopyLink} disabled={!itemCount}>
          {t("tryOn.copiar_link")}
        </Button>
        <Button size="sm" onClick={onSave} disabled={!itemCount}>
          {t("tryOn.salvar_prova")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={!itemCount}
          onClick={onClear}
        >
          <FaiIcon id="ACT-24" size={20} decorative />
          {t("common.limpar")}
        </Button>
      </div>

      <div className="fitting-hints">
        <p className="type-caption text-muted">{t("tryOn.girar_dica")}</p>
        <p className="type-caption text-muted" role="note">
          {t("tryOn.previa_lojas_nota")}
        </p>
      </div>
    </div>
  );
}

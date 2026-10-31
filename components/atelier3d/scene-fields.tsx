"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { Field, Input } from "@/components/ui";
import type { MaterialEdit, Vec3 } from "@/lib/atelier3d/document";
import styles from "./editor.module.css";

export function VectorField({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: Vec3;
  onChange: (value: Vec3) => void;
  min?: number;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className={styles.vector}>
        {(["X", "Y", "Z"] as const).map((axis, i) => (
          <label key={axis}>
            {axis}
            <Input
              aria-label={`${label} ${axis}`}
              type="number"
              step="0.01"
              min={min}
              value={Number(value[i].toFixed(5))}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (!Number.isFinite(n) || (min !== undefined && n < min))
                  return;
                const next = [...value] as Vec3;
                next[i] = n;
                onChange(next);
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function MaterialFields({
  material,
  onChange,
}: {
  material: MaterialEdit;
  onChange: (v: Partial<MaterialEdit>) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <h3 className="type-h3">{t("atelier3d.material")}</h3>
      <Field id="material-color" label={t("common.color")}>
        <Input
          id="material-color"
          type="color"
          value={material.color}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </Field>
      {(["roughness", "metalness"] as const).map((field) => (
        <Field
          key={field}
          id={`material-${field}`}
          label={t(`atelier3d.${field}`)}
        >
          <Input
            id={`material-${field}`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={material[field]}
            onChange={(e) => onChange({ [field]: Number(e.target.value) })}
          />
        </Field>
      ))}
      <Field id="texture-repeat" label={t("atelier3d.textureRepeat")}>
        <Input
          id="texture-repeat"
          type="number"
          min={0.01}
          max={100}
          step={0.1}
          value={material.repeat[0]}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            if (n > 0 && n <= 100) onChange({ repeat: [n, n] });
          }}
        />
      </Field>
      <Field id="texture-rotation" label={t("atelier3d.textureRotation")}>
        <Input
          id="texture-rotation"
          type="number"
          min={-360}
          max={360}
          value={Math.round((material.rotation * 180) / Math.PI)}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n)) onChange({ rotation: (n * Math.PI) / 180 });
          }}
        />
      </Field>
    </>
  );
}

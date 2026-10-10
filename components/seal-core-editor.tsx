"use client";
import type React from "react";
import { useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { rangeFill } from "@/lib/range-fill";
import { Button, Field, FileButton, Input, SegmentPicker, useToast } from "@/components/ui";
import type { SealCore, SealCoreMode, SealDesign } from "@/components/seal-medallion";
import { CORE_TEXT_MAX } from "@/lib/seals/templates";

/**
 * RF25 — núcleo editável do selo: no circular é o centro do medalhão; na folha, o emblema central. Três modos:
 * o elemento/emblema da arte, uma imagem enviada pelo emissor (com zoom e texto opcional) ou um texto livre.
 * A imagem vai para POST /api/seals/uploads?purpose=core (qualquer proporção até 4:1, ≥ 64 px) e fica na pasta do emissor.
 */
export const CORE_MIN_PX = 64;

export function SealCoreEditor({ design, onChange, folha, elementEditor }: { design: SealDesign; onChange: (d: SealDesign) => void; folha?: boolean; elementEditor?: React.ReactNode }) {
  const { t } = useI18n();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const core: SealCore = design.core ?? {};
  const mode: SealCoreMode = core.mode ?? "ELEMENT";
  const setCore = (patch: Partial<SealCore>) => onChange({ ...design, core: { ...core, ...patch } });
  const options: { id: SealCoreMode; label: string }[] = [
    { id: "ELEMENT", label: folha ? t("sealCore.emblema_da_arte") : t("sealCore.elemento") },
    { id: "IMAGE", label: t("sealCore.imagem") },
    { id: "TEXT", label: t("sealCore.texto") },
  ];

  async function onFile(file: File) {
    const ok = await new Promise<boolean>((resolve) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(Math.min(img.width, img.height) >= CORE_MIN_PX && Math.max(img.width, img.height) <= 4 * Math.min(img.width, img.height)); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      img.src = url;
    });
    if (!ok) { toast.error(t("sealCore.imagem_invalida", { n: CORE_MIN_PX })); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await api.upload<{ url: string }>("/api/seals/uploads?purpose=core", fd);
      setCore({ mode: "IMAGE", imageUrl: r.url });
    } catch (e) { toast.fromError(e); } finally { setUploading(false); }
  }

  return (
    <section aria-label={folha ? t("sealCore.titulo_folha") : t("sealCore.titulo")}>
      <p className="label mb-1">{folha ? t("sealCore.titulo_folha") : t("sealCore.titulo")}</p>
      <SegmentPicker options={options} value={mode} onChange={(m) => setCore({ mode: m })} label={folha ? t("sealCore.titulo_folha") : t("sealCore.titulo")} className="mb-2" />
      {mode === "ELEMENT" && elementEditor}
      {mode === "IMAGE" && (
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            {core.imageUrl && <img src={mediaUrl(core.imageUrl)} alt={t("sealCore.imagem_enviada")} className="seal-core-thumb" />}
            <FileButton accept="image/png,image/webp,image/jpeg" loading={uploading} onFiles={(fs) => onFile(fs[0])}>{core.imageUrl ? t("common.trocar") : t("sealCore.enviar_imagem")}</FileButton>
            {core.imageUrl && <Button size="sm" type="button" onClick={() => setCore({ mode: "ELEMENT", imageUrl: null })}>{t("sealCore.remover_imagem")}</Button>}
          </div>
          {!core.imageUrl && <p className="type-caption text-muted">{t("sealCore.imagem_dica", { n: CORE_MIN_PX })}</p>}
          {core.imageUrl && (
            <Field label={t("sealCore.zoom", { v: (core.zoom ?? 1).toFixed(1) })} id="czoom">
              <input id="czoom" type="range" min={1} max={3} step={0.1} className="w-full" value={core.zoom ?? 1} style={rangeFill(core.zoom ?? 1, 1, 3) as React.CSSProperties} onChange={(e) => setCore({ zoom: Number(e.target.value) })} />
            </Field>
          )}
          <CoreText core={core} setCore={setCore} label={t("sealCore.texto_sobre_imagem")} defaultColor="#FFFFFF" />
        </div>
      )}
      {mode === "TEXT" && <CoreText core={core} setCore={setCore} label={t("sealCore.texto_do_nucleo")} defaultColor={design.element?.color ?? "#2B2622"} required />}
    </section>
  );
}

/** Texto do núcleo e a cor; sem cor escolhida vale a do renderizador (branco sobre a imagem, cor do elemento no texto). */
function CoreText({ core, setCore, label, required, defaultColor }: { core: SealCore; setCore: (p: Partial<SealCore>) => void; label: string; required?: boolean; defaultColor: string }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-[1fr_5rem] gap-2">
      <Field label={label} id="ctext" required={required} hint={t("sealCore.texto_dica", { n: CORE_TEXT_MAX })}>
        <Input id="ctext" value={core.text ?? ""} maxLength={CORE_TEXT_MAX} onChange={(e) => setCore({ text: e.target.value })} />
      </Field>
      <Field label={t("sealCore.cor_do_texto")} id="ccolor">
        <input id="ccolor" type="color" className="input h-9 w-full p-1" value={core.textColor ?? defaultColor} onChange={(e) => setCore({ textColor: e.target.value.toUpperCase() })} />
      </Field>
    </div>
  );
}

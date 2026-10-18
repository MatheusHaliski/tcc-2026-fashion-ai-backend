"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, FileButton, Spinner, Switch } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { ApiError } from "@/lib/api/client";
import { downloadBlob } from "@/lib/avatar3d/human/export-glb";
import { portraitRefusalKey, similarityBand, stylizedPortraitOnGpu, type StylizedPortrait } from "@/lib/avatar3d/portrait-gpu";

/** Meu Avatar — retrato estilizado (desenho 3D semirrealista) gerado na GPU a partir de uma foto do rosto. */
export function StylizedPortraitCard() {
  const { t } = useI18n();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portrait, setPortrait] = useState<StylizedPortrait | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(file: File) {
    setPhoto(file); setPreview(URL.createObjectURL(file)); setConsent(false); setError(null); setPortrait(null);
  }
  async function generate() {
    if (!photo || !consent) return;
    setBusy(true); setError(null);
    try {
      setPortrait(await stylizedPortraitOnGpu(photo));
    } catch (e) {
      const key = e instanceof ApiError ? portraitRefusalKey(e.details?.reason) : null;
      setError(key ? t(key) : e instanceof ApiError && e.message ? e.message : t("avatar3d.portrait.falhou"));
    } finally { setBusy(false); setConsent(false); }
  }

  async function download(p: StylizedPortrait) {
    downloadBlob(await (await fetch(p.image)).blob(), "meu-retrato-fashionai.jpg");
  }

  const band = portrait ? similarityBand(portrait.identitySimilarity) : null;
  return (
    <Card>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="type-body font-semibold">{t("avatar3d.portrait.titulo")}</h2>
          <Badge tone="chalk">{t("avatar3d.portrait.estilo")}</Badge>
        </div>
        <p className="type-body-sm text-muted">{t("avatar3d.portrait.explica")}</p>
        <div className="flex flex-wrap items-start gap-4">
          {preview && <img src={preview} alt={t("avatar3d.portrait.foto_alt")} className="h-40 w-32 rounded-md object-cover" />}
          {portrait && (
            <figure className="grid gap-1">
              <img src={portrait.image} alt={t("avatar3d.portrait.retrato_alt")} width={portrait.width} height={portrait.height}
                className="h-80 w-auto rounded-md border border-line-soft" />
              <figcaption className="type-caption text-muted">
                {t("avatar3d.portrait.semelhanca", { pct: Math.round(Math.max(0, portrait.identitySimilarity) * 100) })} · {t(`avatar3d.portrait.faixa.${band}`)}
              </figcaption>
            </figure>
          )}
        </div>
        <FileButton id="avatar-portrait-photo" accept="image/jpeg,image/png,image/webp" onFiles={(files) => files[0] && choose(files[0])} disabled={busy}>{photo ? t("avatar3d.portrait.trocar_foto") : t("avatar3d.portrait.escolher_foto")}</FileButton>
        <p className="type-caption text-faint">{t("avatar3d.portrait.dica_foto")}</p>
        <Switch checked={consent} onChange={setConsent} label={t("avatar3d.portrait.consentimento")} disabled={!photo || busy} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void generate()} loading={busy} disabled={!photo || !consent}>
            {portrait ? t("avatar3d.portrait.gerar_outro") : t("avatar3d.portrait.gerar")}
          </Button>
          {portrait && <Button size="sm" variant="ghost" onClick={() => void download(portrait)}>{t("avatar3d.portrait.baixar")}</Button>}
        </div>
        {busy && <p className="flex items-center gap-2 type-caption text-muted"><Spinner size={14} />{t("avatar3d.portrait.gerando")}</p>}
        {error && <p role="alert" className="type-body-sm text-critical">{error}</p>}
        <p className="type-caption text-faint">{t("avatar3d.portrait.privacidade")}</p>
      </div>
    </Card>
  );
}

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog } from "@/components/ui";

const PieceModelViewer = dynamic(() => import("@/components/room3d/piece-model-viewer"), { ssr: false });

/**
 * Etapa 3 — "Ver em 3D" no card do produto do catálogo: o modelo de vitrine publicado do produto, no mesmo visualizador
 * da peça do guarda-roupa. Sem esqueleto: o aviso diz que no avatar a peça aparece pelo molde.
 */
export function CatalogModel3d({ url, name }: { url: string; name: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const resolved = mediaUrl(url);
  if (!resolved) return null;
  return (
    <>
      <Button size="sm" className="mt-2 self-start" onClick={() => setOpen(true)}>{t("model3d.ver")}</Button>
      {open && (
        <Dialog open onClose={() => setOpen(false)} title={name} size="lg"
          footer={<Button size="sm" onClick={() => setOpen(false)}>{t("common.close")}</Button>}>
          <div className="h-[420px] overflow-hidden rounded-lg border border-line-soft">
            <PieceModelViewer url={resolved} name={name} />
          </div>
          <p className="mt-2 type-caption text-muted">{t("model3d.vitrine_aviso")}</p>
        </Dialog>
      )}
    </>
  );
}

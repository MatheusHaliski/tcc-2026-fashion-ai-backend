"use client";
import { useEffect, useState } from "react";
import { tr } from "@/lib/i18n/i18n";
import { isChunkLoadError, reloadOnceForChunk } from "@/lib/chunk-recovery";

/**
 * Tela de erro das fronteiras (app/error.tsx e app/global-error.tsx): nunca a tela branca "Application error".
 * Se o erro é um pedaço de script que sumiu num deploy novo, recarrega sozinha uma vez.
 */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunk = isChunkLoadError(error);
  const [reloading, setReloading] = useState(chunk);
  useEffect(() => { if (chunk && !reloadOnceForChunk()) setReloading(false); }, [chunk]);
  if (reloading) return <main className="grid min-h-[50vh] place-items-center p-6 text-center type-body text-muted" role="status">{tr("errors.atualizando_versao")}</main>;
  return (
    <main className="mx-auto grid min-h-[50vh] max-w-md place-content-center gap-3 p-6 text-center" role="alert">
      <h1 className="type-h2">{chunk ? tr("errors.versao_nova_titulo") : tr("errors.algo_deu_errado")}</h1>
      <p className="type-body text-muted">{chunk ? tr("errors.versao_nova_texto") : tr("errors.algo_deu_errado_texto")}</p>
      {error.digest && <p className="type-caption text-faint">{tr("errors.codigo", { code: error.digest })}</p>}
      <div className="flex justify-center gap-2">
        {!chunk && <button type="button" className="btn" onClick={() => reset()}>{tr("common.retry")}</button>}
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>{tr("errors.recarregar")}</button>
      </div>
    </main>
  );
}

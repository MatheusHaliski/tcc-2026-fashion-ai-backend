"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Button, Card, Dialog, ErrorState, PageHeader, SegmentPicker, Skeleton, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { MirrorStage, MirrorWornStrip, type MirrorMode } from "@/components/mirror/mirror-stage";
import { MirrorControls, useMirrorActions, wornOf, type MirrorData } from "@/components/mirror/mirror-controls";

/*
 * Aba Espelho (RF28): o palco (reflexo 3D ou prévia 2D) e as opções de vestimenta — o mesmo painel que abre dentro do
 * Meu Quarto quando o personagem chega ao espelho (components/mirror/mirror-controls.tsx).
 */
interface State extends MirrorData { origin?: string; interpretation?: Record<string, unknown> | null; actions?: string[] }

function MirrorInner() {
  const { t } = useI18n(); const toast = useToast(); const sp = useSearchParams();
  const { data, loading, error, reload, setData } = useApi<State>((signal) => api.get("/api/me/mirror", { signal }), []);
  const { run } = useMirrorActions<State>(setData, reload);
  // Reflexo 3D (cena viva) ou Prévia 2D (a foto parada do mesmo avatar); ?vista=2d abre direto na prévia
  const [mode, setMode] = useState<MirrorMode>(() => (sp.get("vista") === "2d" ? "2d" : "3d"));
  const [grwm, setGrwm] = useState<{ steps?: { title?: string; text?: string; pieceId?: string }[]; title?: string } | null>(null);
  // vindo do quarto (?piece=): a peça entra na lista do espelho e é vestida (sem duplicar na lista)
  useEffect(() => { const pid = sp.get("piece"); if (pid) api.post<State>("/api/me/mirror/rack", { pieceId: pid }).then(() => api.post<State>("/api/me/mirror/pieces", { pieceId: pid })).then(setData).catch((e) => toast.fromError(e)); }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-96" />;
  const worn = wornOf(data);
  return (
    <>
      <PageHeader title={t("nav.mirror")} kicker="RF28" lead={data.restriction ? t("mirror.desafio_ativo_so_as_pecas", { challenge: data.restriction.challenge }) : t("mirror.monte_o_look_no_espelho")} />
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <Card pad={false} className="min-w-0 overflow-hidden">
          <div className="px-3 pt-3"><SegmentPicker label={t("mirror.modo_aria")} value={mode} onChange={setMode}
            options={[{ id: "3d", label: t("mirror.reflexo_3d") }, { id: "2d", label: t("mirror.previa_2d") }]} /></div>
          <div className="p-3"><MirrorStage slots={data.slots} kelvin={data.light?.kelvin} mode={mode}>
            {worn.length === 0 && (
              <div className="mirror-empty">
                <p className="type-h3">{t("mirror.emptyTitle")}</p>
                <p className="type-body-sm mt-1 text-muted">{t("mirror.emptyHint")}</p>
                <Button size="sm" variant="primary" className="mt-3" onClick={() => document.getElementById("vista-prompt")?.focus()}>{t("mirror.askVistaMe")}</Button>
              </div>
            )}
            {data.postIt && <p className="absolute right-3 top-3 max-w-[150px] rotate-2 bg-chalk-soft p-2 text-xs shadow" role="note">📌 {data.postIt}</p>}
            {data.silhouette && <p className="absolute bottom-3 left-3 type-caption text-muted">{t("mirror.silhueta", { silhouette: data.silhouette })}</p>}
          </MirrorStage>
          {mode === "2d" && <p className="mt-2 type-caption text-muted">{t("mirror.previa_2d_nota")}</p>}</div>
          <div className="px-3 pt-3"><MirrorWornStrip worn={worn} onRemove={(p) => run("rm", () => api.delete(`/api/me/mirror/pieces/${p.id}`))} /></div>
          <div className="flex flex-wrap gap-2 p-3">
            <Button size="sm" onClick={() => run("clear", () => api.delete("/api/me/mirror"))}>{t("common.limpar")}</Button>
            <Button size="sm" onClick={() => run("one", () => api.post("/api/me/mirror/take-one-off"), t("mirror.tirei_uma_coisa"))} disabled={worn.length < 2}><FaiIcon id="ACT-33" size={24} decorative />{t("mirror.tira_uma_coisa")}</Button>
            <Button size="sm" onClick={async () => { const r = await run("grwm", () => api.get("/api/me/mirror/grwm")); if (r) setGrwm(r as typeof grwm); }} disabled={!data.complete}>GRWM</Button>
          </div>
        </Card>
        <MirrorControls<State> data={data} setData={setData} reload={reload} />
      </div>
      <Dialog open={!!grwm} onClose={() => setGrwm(null)} title={grwm?.title ?? t("mirror.grwm_storyboard")}>
        <ol className="fai-list type-body">{(grwm?.steps ?? []).map((s, i) => <li key={i} className="py-1"><b>{s.title}</b> {s.text}</li>)}</ol>
      </Dialog>
    </>
  );
}
export default function MirrorPage() { return <RequireAuth><Suspense><MirrorInner /></Suspense></RequireAuth>; }

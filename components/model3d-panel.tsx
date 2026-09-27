"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { Button, useToast } from "@/components/ui";
import { tr, useI18n } from "@/lib/i18n/i18n";
import { currentIntl } from "@/lib/i18n/state";

/** Resposta de GET/POST /api/pieces/{id}/model3d (Model3dService.status). */
export interface Model3dStatus {
  status?: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | null; label?: string; modelUrl?: string | null; featureEnabled?: boolean;
  providers?: string[]; jobId?: string; provider?: string | null; progress?: number; stages?: { name: string; provider: string; note?: string; at?: string }[];
  queuedAt?: string | null; startedAt?: string | null; finishedAt?: string | null; fallbackUsed?: boolean; error?: string | null; canRetryFree?: boolean;
  freeRetry?: boolean; model?: { kind?: string; vertices?: number; triangles?: number; widthM?: number; heightM?: number; depthM?: number };
}

const STAGE_LABEL: Record<string, string> = {
  get FOTO() { return tr("model3dPanel.foto_sem_fundo"); }, get ENVIO() { return tr("model3dPanel.enviado_ao_provedor"); }, get SILHUETA() { return tr("dna.silhueta"); }, get MALHA() { return tr("model3dPanel.malha"); }, get TEXTURA() { return tr("model3dPanel.textura"); },
  get RECONSTRUCAO() { return tr("model3dPanel.reconstrucao_3d"); }, get ARMAZENAMENTO() { return tr("model3dPanel.arquivo_glb_salvo"); }, get TEMPO_LIMITE() { return tr("model3dPanel.tempo_limite"); },
};
const running = (s?: string | null) => s === "QUEUED" || s === "PROCESSING";

/**
 * RF16 — estado do modelo 3D da peça, vindo do servidor (sobrevive a recarregar a página) e consultado a cada 2,5 s
 * enquanto o job anda (CA01). Só o dono consulta: para quem visita, basta o {@code model3dUrl} da peça.
 */
export function useModel3d(pieceId: string, { enabled, onCompleted }: { enabled: boolean; onCompleted?: (s: Model3dStatus) => void }) {
  const { t } = useI18n(); const toast = useToast();
  const [st, setSt] = useState<Model3dStatus | null>(null); const [busy, setBusy] = useState(false);
  const prev = useRef<string | null | undefined>(undefined);
  const load = useCallback(async () => {
    try { setSt(await api.get<Model3dStatus>(`/api/pieces/${pieceId}/model3d`)); } catch { /* sem permissão ou fora do ar: o controle some */ }
  }, [pieceId]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  useEffect(() => {
    if (!enabled || !running(st?.status)) return;
    const h = setInterval(load, 2500);
    return () => clearInterval(h);
  }, [enabled, st?.status, load]);
  useEffect(() => {
    const s = st?.status;
    if (s === "COMPLETED" && running(prev.current)) { toast.success(t("model3dPanel.modelo_3d_pronto")); onCompleted?.(st!); }
    if (s !== undefined) prev.current = s;
  }, [st, onCompleted, toast, t]);
  async function request() {
    setBusy(true);
    try { const r = await api.post<Model3dStatus>(`/api/pieces/${pieceId}/model3d`); setSt(r); prev.current = r.status; if (r.freeRetry) toast.info(t("model3dPanel.reprocessamento_gratis_nao_conta_na")); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  return { st, busy, request };
}

/** "Relevo a partir da foto" nunca é apresentado como reconstrução fiel da peça. */
const isRelief = (st?: Model3dStatus | null) => st?.model?.kind === "relevo" || (!!st?.provider && /local|relevo/i.test(st.provider));

/**
 * Modelo 3D no fluxo de leitura: um controle compacto e contextual, sem motor, provedor nem diagnóstico (esses ficam
 * nos detalhes técnicos). Não gerado → "Gerar modelo 3D" (dono); processando → barra de progresso; concluído →
 * "Ver em 3D"; falhou → mensagem curta + "Tentar de novo". Visitante vê só "Ver em 3D" quando o modelo existe.
 */
export function Model3dAction({ model, mine, modelUrl, onView }: { model: ReturnType<typeof useModel3d>; mine: boolean; modelUrl?: string | null; onView: () => void }) {
  const { t } = useI18n();
  const st = model.st; const s = st?.status;
  const ready = s === "COMPLETED" || (!!modelUrl && !running(s) && s !== "FAILED");
  if (ready) return (
    <div className="m3d-compact">
      <Button size="sm" onClick={onView}><Cube />{t("model3d.ver")}</Button>
      {isRelief(st) && <span className="type-caption text-muted">{t("model3d.relevo_aviso")}</span>}
    </div>
  );
  if (!mine || !st || (st.featureEnabled === false && !s)) return null;
  if (running(s)) {
    const pct = Math.max(3, Math.min(100, st.progress ?? 5));
    return (
      <div className="m3d-compact is-running" aria-live="polite">
        <span className="type-body-sm">{s === "QUEUED" ? t("model3d.na_fila") : t("model3d.gerando")}</span>
        <span className="m3d-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("model3dPanel.progresso_do_modelo_3d")}><span style={{ width: `${pct}%` }} /></span>
      </div>
    );
  }
  if (s === "FAILED") return (
    <div className="m3d-compact is-failed" role="status">
      <span className="type-body-sm">{t("model3d.falhou")}</span>
      <Button size="sm" onClick={model.request} loading={model.busy}>{st.canRetryFree ? t("model3d.tentar_gratis") : t("common.retry")}</Button>
    </div>
  );
  return <div className="m3d-compact"><Button size="sm" onClick={model.request} loading={model.busy}><Cube />{t("model3dPanel.gerar_modelo_3d")}</Button></div>;
}

function Cube() {
  return <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 2.8 20 7.2v9.6L12 21.2 4 16.8V7.2z" /><path d="M4 7.2 12 11.6l8-4.4M12 11.6v9.6" /></svg>;
}

/** Área técnica (dono): motor, provedor, etapas, dimensões e o motivo da falha — fora do fluxo principal. */
export function Model3dTechnical({ model }: { model: ReturnType<typeof useModel3d> }) {
  const { t } = useI18n();
  const st = model.st;
  if (!st) return null;
  const engines = st.providers?.length ? t("model3dPanel.relevo_local", { join: st.providers.join(" → ") }) : t("model3dPanel.relevo_local_sem_provedor_externo");
  return (
    <div className="grid gap-1 type-caption text-muted">
      <p><b>{t("model3dPanel.modelo_3d")}:</b> {st.status ? (st.label ?? st.status.toLowerCase()) : t("model3d.nao_gerado")}{st.provider ? ` · ${st.provider}` : ""}{st.fallbackUsed ? t("common.plano_b_local") : ""}</p>
      {st.status === "COMPLETED" && st.model && (
        <p>{isRelief(st) ? t("model3dPanel.relevo_3d_a_partir_da") : t("model3dPanel.reconstrucao_3d")}{st.model.vertices ? t("model3dPanel.vertices", { toLocaleString: st.model.vertices.toLocaleString(currentIntl()) }) : ""}
          {st.model.heightM ? t("model3dPanel.cm", { Math: Math.round((st.model.widthM ?? 0) * 100), Math2: Math.round(st.model.heightM * 100), Math3: Math.round((st.model.depthM ?? 0) * 100) }) : ""}</p>
      )}
      {st.status === "FAILED" && <p>{t("model3dPanel.por_que_falhou")} {st.error ?? t("model3dPanel.o_provedor_nao_devolveu_o")} · {st.canRetryFree ? t("model3dPanel.o_primeiro_reprocessamento_e_gratis") : t("model3dPanel.novas_tentativas_usam_a_cota")}</p>}
      <p>{t("model3dPanel.motores_leva_de_segundos_relevo", { engines })}</p>
      {(st.stages?.length ?? 0) > 0 && <ol className="fai-list is-plain">{st.stages!.map((x, i) => <li key={i}>✓ {STAGE_LABEL[x.name] ?? x.name} <span className="text-faint">· {x.provider}{x.note ? ` · ${x.note}` : ""}</span></li>)}</ol>}
      {st.status === "COMPLETED" && <p><button type="button" className="underline" onClick={model.request}>{t("common.gerar_de_novo")}</button></p>}
    </div>
  );
}

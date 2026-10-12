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
  /** o provedor informou o progresso (fila e relevo local não informam: a tela não mostra porcentagem) */
  progressReal?: boolean;
}

const STAGE_LABEL: Record<string, string> = {
  get FOTO() { return tr("model3dPanel.foto_sem_fundo"); }, get ENVIO() { return tr("model3dPanel.enviado_ao_provedor"); }, get SILHUETA() { return tr("dna.silhueta"); }, get MALHA() { return tr("model3dPanel.malha"); }, get TEXTURA() { return tr("model3dPanel.textura"); },
  get RECONSTRUCAO() { return tr("model3dPanel.reconstrucao_3d"); }, get ARMAZENAMENTO() { return tr("model3dPanel.arquivo_glb_salvo"); }, get TEMPO_LIMITE() { return tr("model3dPanel.tempo_limite"); },
};
const running = (s?: string | null) => s === "QUEUED" || s === "PROCESSING";

/**
 * RF16 — estado do modelo 3D da peça, vindo do servidor (sobrevive a recarregar a página) e consultado a cada 2,5 s
 * enquanto o job anda (CA01). Só o dono consulta: para quem visita, basta o {@code model3dUrl} da peça.
 * O estado é da peça que o pediu: com outro `pieceId` (a mesma linha do provador com outra peça), o hook volta a "sem
 * resposta" até a nova chegar, descarta a resposta atrasada da peça anterior e não avisa "pronto" pela anterior.
 */
export function useModel3d(pieceId: string, { enabled, onCompleted }: { enabled: boolean; onCompleted?: (s: Model3dStatus) => void }) {
  const { t } = useI18n(); const toast = useToast();
  const [got, setGot] = useState<{ id: string; st: Model3dStatus } | null>(null); const [busy, setBusy] = useState(false);
  const st = got && got.id === pieceId ? got.st : null;
  const current = useRef(pieceId);
  useEffect(() => { current.current = pieceId; }, [pieceId]);
  const prev = useRef<{ id: string; status?: string | null }>({ id: pieceId });
  /** guarda a resposta só se ainda for da peça atual */
  const accept = useCallback((id: string, r: Model3dStatus) => { if (id !== current.current) return false; setGot({ id, st: r }); return true; }, []);
  const load = useCallback(async () => {
    try { accept(pieceId, await api.get<Model3dStatus>(`/api/pieces/${pieceId}/model3d`)); } catch { /* sem permissão ou fora do ar: o controle some */ }
  }, [pieceId, accept]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  useEffect(() => {
    if (!enabled || !running(st?.status)) return;
    const h = setInterval(load, 2500);
    return () => clearInterval(h);
  }, [enabled, st?.status, load]);
  useEffect(() => {
    const s = st?.status, before = prev.current.id === pieceId ? prev.current.status : undefined;
    if (s === "COMPLETED" && running(before)) { toast.success(t("model3dPanel.modelo_3d_pronto")); onCompleted?.(st!); }
    if (s !== undefined) prev.current = { id: pieceId, status: s };
  }, [st, pieceId, onCompleted, toast, t]);
  async function request() {
    const id = pieceId;
    setBusy(true);
    try { const r = await api.post<Model3dStatus>(`/api/pieces/${id}/model3d`); if (accept(id, r)) prev.current = { id, status: r.status }; if (r.freeRetry) toast.info(t("model3dPanel.reprocessamento_gratis_nao_conta_na")); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  /** Pede o 3D sem aviso (fila automática do provador): devolve o erro (sem foto, cota, recurso desligado) em vez de mostrar. */
  async function queue(): Promise<Error | null> {
    const id = pieceId;
    setBusy(true);
    try { const r = await api.post<Model3dStatus>(`/api/pieces/${id}/model3d`); if (accept(id, r)) prev.current = { id, status: r.status }; return null; }
    catch (e) { return e instanceof Error ? e : new Error(String(e)); } finally { setBusy(false); }
  }
  return { st, busy, request, queue };
}

/** "Relevo a partir da foto" nunca é apresentado como reconstrução fiel da peça. */
const isRelief = (st?: Model3dStatus | null) => st?.model?.kind === "relevo" || (!!st?.provider && /local|relevo/i.test(st.provider));

/**
 * Modelo 3D no fluxo de leitura: um estado compacto, sem motor, provedor nem diagnóstico (esses ficam nos detalhes
 * técnicos). A peça não oferece mais um botão para GERAR o modelo 3D (pedido de produto): aparecem só os estados de um
 * modelo que já existe ou de um job já iniciado — processando (barra indeterminada; porcentagem só com progresso real do
 * provedor), concluído ("Ver em 3D", para dono e visitante) e falhou (mensagem curta + "Tentar de novo", só para o dono).
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
  if (!mine || !st) return null;
  if (running(s)) {
    const real = !!st.progressReal && typeof st.progress === "number";
    const pct = real ? Math.max(1, Math.min(100, Math.round(st.progress!))) : null;
    return (
      <div className="m3d-compact is-running" aria-live="polite">
        <span className="type-body-sm">{s === "QUEUED" ? t("model3d.na_fila") : t("model3d.gerando")}{pct != null ? ` ${pct}%` : ""}</span>
        <span className={`m3d-bar ${pct == null ? "is-indeterminate" : ""}`} role="progressbar" aria-label={t("model3dPanel.progresso_do_modelo_3d")}
          {...(pct != null ? { "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct } : {})}><span style={pct != null ? { width: `${pct}%` } : undefined} /></span>
      </div>
    );
  }
  if (s === "FAILED") return (
    <div className="m3d-compact is-failed" role="status">
      <span className="type-body-sm">{t("model3d.falhou")}</span>
      <Button size="sm" onClick={model.request} loading={model.busy}>{st.canRetryFree ? t("model3d.tentar_gratis") : t("common.retry")}</Button>
    </div>
  );
  return null;
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
    </div>
  );
}

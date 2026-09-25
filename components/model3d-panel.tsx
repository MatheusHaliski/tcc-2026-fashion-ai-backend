"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { Badge, Button, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
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
const STEPS: { key: NonNullable<Model3dStatus["status"]>; label: string }[] = [
  { key: "QUEUED", label: "enfileirado" }, { key: "PROCESSING", label: "processando" }, { key: "COMPLETED", get label() { return tr("model3dPanel.concluido"); } },
];
const running = (s?: string | null) => s === "QUEUED" || s === "PROCESSING";

/**
 * RF16 — geração do modelo 3D da peça.
 * CA01: job assíncrono com estados visíveis (enfileirado → processando → concluído/falhou), acompanhados por consulta periódica;
 * CA03: falha ou tempo-limite com motivo legível e 1 reprocessamento grátis; CA04: o estado vem do servidor (sobrevive a recarregar a página).
 */
export function Model3dPanel({ pieceId, initialStatus, onCompleted, onView }: {
  pieceId: string; initialStatus?: string | null; onCompleted?: (s: Model3dStatus) => void; onView?: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [st, setSt] = useState<Model3dStatus | null>(null); const [busy, setBusy] = useState(false); const [now, setNow] = useState(Date.now());
  const prev = useRef<string | null | undefined>(initialStatus);
  const load = useCallback(async () => {
    try { setSt(await api.get<Model3dStatus>(`/api/pieces/${pieceId}/model3d`)); } catch { /* sem permissão ou fora do ar: o painel some */ }
  }, [pieceId]);
  useEffect(() => { load(); }, [load]);
  // consulta periódica enquanto o job anda (CA01)
  useEffect(() => {
    if (!running(st?.status)) return;
    const t = setInterval(() => { load(); setNow(Date.now()); }, 2500);
    return () => clearInterval(t);
  }, [st?.status, load]);
  useEffect(() => {
    const s = st?.status;
    if (s === "COMPLETED" && running(prev.current)) { toast.success(t("model3dPanel.modelo_3d_pronto")); onCompleted?.(st!); }
    if (s === "FAILED" && running(prev.current)) toast.error(st?.error ?? t("model3dPanel.a_geracao_3d_falhou"));
    if (s !== undefined) prev.current = s;
  }, [st, onCompleted, toast]);
  async function request() {
    setBusy(true);
    try { const r = await api.post<Model3dStatus>(`/api/pieces/${pieceId}/model3d`); setSt(r); prev.current = r.status; if (r.freeRetry) toast.info(t("model3dPanel.reprocessamento_gratis_nao_conta_na")); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  if (!st) return null;
  if (st.featureEnabled === false && !st.status) return <p className="type-caption text-muted">{t("model3dPanel.geracao_3d_desligada_neste_ambiente")}</p>;
  const s = st.status; const pct = Math.max(3, Math.min(100, st.progress ?? (s === "COMPLETED" ? 100 : 5)));
  const since = st.startedAt ?? st.queuedAt; const secs = since ? Math.max(0, Math.round((now - new Date(since).getTime()) / 1000)) : null;
  const engines = st.providers?.length ? t("model3dPanel.relevo_local", { join: st.providers.join(" → ") }) : t("model3dPanel.relevo_local_sem_provedor_externo");
  return (
    <section aria-labelledby={`m3d-${pieceId}`} className="rounded-md border border-line-soft p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`m3d-${pieceId}`} className="type-h3 mr-auto flex items-center gap-2"><FaiIcon id="ACT-20" size={24} decorative />{t("model3dPanel.modelo_3d")}</h2>
        {s && <Badge tone={s === "FAILED" ? "mark" : s === "COMPLETED" ? "thread" : "chalk"}>{st.label ?? s.toLowerCase()}</Badge>}
      </div>
      {/* linha do tempo dos estados (CA01) */}
      <ol className="mt-2 flex flex-wrap items-center gap-1 type-caption" aria-label={t("model3dPanel.estados_do_job")}>
        {STEPS.map((step, i) => {
          // o último passo é "concluído" ou, em caso de falha, "falhou" (CA01: enfileirado → processando → concluído/falhou)
          const failedHere = s === "FAILED" && i === STEPS.length - 1;
          const idx = s === "FAILED" ? STEPS.length - 1 : s ? STEPS.findIndex((x) => x.key === s) : -1;
          const done = idx >= i; const current = failedHere || s === step.key;
          const tone = failedHere ? "border border-[var(--mark)] font-medium text-[var(--mark)]" : current ? "bg-ink text-surface" : done ? "text-ink" : "text-faint";
          return (
            <li key={step.key} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden className={`h-px w-5 ${done ? "bg-ink" : "bg-line-soft"}`} />}
              <span aria-current={current ? "step" : undefined} className={`rounded-full px-2 py-0.5 ${tone}`}>{failedHere ? t("common.falhou") : step.label}</span>
            </li>
          );
        })}
      </ol>
      {running(s) && (
        <div className="mt-3" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("model3dPanel.progresso_do_modelo_3d")}>
            <div className="h-full bg-ink transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 type-caption text-muted">{t("model3dPanel.pode_sair_da_pagina_avisamos", { value: s === "QUEUED" ? t("model3dPanel.na_fila_o_gerador_pega") : t("model3dPanel.gerando_com", { value: st.provider ?? t("model3dPanel.o_motor_3d") }), value2: secs != null ? ` ${secs}s` : "" })}</p>
        </div>
      )}
      {s === "FAILED" && (
        <div role="alert" className="mt-3 rounded-md bg-surface-2 p-2 type-body-sm">
          <p><strong>{t("model3dPanel.por_que_falhou")}</strong> {st.error ?? t("model3dPanel.o_provedor_nao_devolveu_o")}</p>
          <p className="mt-1 type-caption text-muted">{st.canRetryFree ? t("model3dPanel.o_primeiro_reprocessamento_e_gratis") : t("model3dPanel.novas_tentativas_usam_a_cota")}</p>
        </div>
      )}
      {s === "COMPLETED" && st.model && (
        <p className="mt-2 type-caption text-muted">
          {st.model.kind === "relevo" ? t("model3dPanel.relevo_3d_a_partir_da") : t("model3dPanel.reconstrucao_3d")}{st.model.vertices ? t("model3dPanel.vertices", { toLocaleString: st.model.vertices.toLocaleString(currentIntl()) }) : ""}
          {st.model.heightM ? t("model3dPanel.cm", { Math: Math.round((st.model.widthM ?? 0) * 100), Math2: Math.round(st.model.heightM * 100), Math3: Math.round((st.model.depthM ?? 0) * 100) }) : ""}
          {st.provider ? ` · ${st.provider}` : ""}{st.fallbackUsed ? t("common.plano_b_local") : ""}
        </p>
      )}
      {(st.stages?.length ?? 0) > 0 && (
        <details className="mt-2 type-caption text-muted" open={running(s)}>
          <summary className="cursor-pointer">{t("model3dPanel.etapas", { itemCount: st.stages!.length })}</summary>
          <ol className="mt-1 space-y-0.5">{st.stages!.map((x, i) => <li key={i}>✓ {STAGE_LABEL[x.name] ?? x.name} <span className="text-faint">· {x.provider}{x.note ? ` · ${x.note}` : ""}</span></li>)}</ol>
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {s === "COMPLETED" && onView && <Button size="sm" variant="primary" onClick={onView}>{t("model3dPanel.ver_em_3d")}</Button>}
        {!running(s) && (
          <Button size="sm" variant={s === "COMPLETED" ? "default" : "primary"} onClick={request} loading={busy}>
            {s === "FAILED" ? (st.canRetryFree ? t("model3dPanel.reprocessar_gratis_1") : t("common.retry")) : s === "COMPLETED" ? t("common.gerar_de_novo") : t("model3dPanel.gerar_modelo_3d")}
          </Button>
        )}
      </div>
      {!s && <p className="mt-2 type-caption text-faint">{t("model3dPanel.motores_leva_de_segundos_relevo", { engines })}</p>}
    </section>
  );
}

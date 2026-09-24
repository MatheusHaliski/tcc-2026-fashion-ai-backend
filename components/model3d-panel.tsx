"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { Badge, Button, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

/** Resposta de GET/POST /api/pieces/{id}/model3d (Model3dService.status). */
export interface Model3dStatus {
  status?: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | null; label?: string; modelUrl?: string | null; featureEnabled?: boolean;
  providers?: string[]; jobId?: string; provider?: string | null; progress?: number; stages?: { name: string; provider: string; note?: string; at?: string }[];
  queuedAt?: string | null; startedAt?: string | null; finishedAt?: string | null; fallbackUsed?: boolean; error?: string | null; canRetryFree?: boolean;
  freeRetry?: boolean; model?: { kind?: string; vertices?: number; triangles?: number; widthM?: number; heightM?: number; depthM?: number };
}

const STAGE_LABEL: Record<string, string> = {
  FOTO: "Foto sem fundo", ENVIO: "Enviado ao provedor", SILHUETA: "Silhueta", MALHA: "Malha", TEXTURA: "Textura",
  RECONSTRUCAO: "Reconstrução 3D", ARMAZENAMENTO: "Arquivo .glb salvo", TEMPO_LIMITE: "Tempo-limite",
};
const STEPS: { key: NonNullable<Model3dStatus["status"]>; label: string }[] = [
  { key: "QUEUED", label: "enfileirado" }, { key: "PROCESSING", label: "processando" }, { key: "COMPLETED", label: "concluído" },
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
    if (s === "COMPLETED" && running(prev.current)) { toast.success("Modelo 3D pronto"); onCompleted?.(st!); }
    if (s === "FAILED" && running(prev.current)) toast.error(st?.error ?? "A geração 3D falhou.");
    if (s !== undefined) prev.current = s;
  }, [st, onCompleted, toast]);
  async function request() {
    setBusy(true);
    try { const r = await api.post<Model3dStatus>(`/api/pieces/${pieceId}/model3d`); setSt(r); prev.current = r.status; if (r.freeRetry) toast.info("Reprocessamento grátis: não conta na sua cota de 3D."); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  if (!st) return null;
  if (st.featureEnabled === false && !st.status) return <p className="type-caption text-muted">Geração 3D desligada neste ambiente.</p>;
  const s = st.status; const pct = Math.max(3, Math.min(100, st.progress ?? (s === "COMPLETED" ? 100 : 5)));
  const since = st.startedAt ?? st.queuedAt; const secs = since ? Math.max(0, Math.round((now - new Date(since).getTime()) / 1000)) : null;
  const engines = st.providers?.length ? st.providers.join(" → ") + " → relevo local" : "relevo local (sem provedor externo configurado)";
  return (
    <section aria-labelledby={`m3d-${pieceId}`} className="rounded-md border border-line-soft p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`m3d-${pieceId}`} className="type-h3 mr-auto flex items-center gap-2"><FaiIcon id="ACT-20" size={24} decorative />Modelo 3D</h2>
        {s && <Badge tone={s === "FAILED" ? "mark" : s === "COMPLETED" ? "thread" : "chalk"}>{st.label ?? s.toLowerCase()}</Badge>}
      </div>
      {/* linha do tempo dos estados (CA01) */}
      <ol className="mt-2 flex flex-wrap items-center gap-1 type-caption" aria-label="estados do job">
        {STEPS.map((step, i) => {
          // o último passo é "concluído" ou, em caso de falha, "falhou" (CA01: enfileirado → processando → concluído/falhou)
          const failedHere = s === "FAILED" && i === STEPS.length - 1;
          const idx = s === "FAILED" ? STEPS.length - 1 : s ? STEPS.findIndex((x) => x.key === s) : -1;
          const done = idx >= i; const current = failedHere || s === step.key;
          const tone = failedHere ? "border border-[var(--mark)] font-medium text-[var(--mark)]" : current ? "bg-ink text-surface" : done ? "text-ink" : "text-faint";
          return (
            <li key={step.key} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden className={`h-px w-5 ${done ? "bg-ink" : "bg-line-soft"}`} />}
              <span aria-current={current ? "step" : undefined} className={`rounded-full px-2 py-0.5 ${tone}`}>{failedHere ? "falhou" : step.label}</span>
            </li>
          );
        })}
      </ol>
      {running(s) && (
        <div className="mt-3" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="progresso do modelo 3D">
            <div className="h-full bg-ink transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 type-caption text-muted">{s === "QUEUED" ? "Na fila — o gerador pega o próximo job em alguns segundos." : `Gerando com ${st.provider ?? "o motor 3D"}…`}{secs != null ? ` ${secs}s` : ""} · pode sair da página, avisamos quando ficar pronto.</p>
        </div>
      )}
      {s === "FAILED" && (
        <div role="alert" className="mt-3 rounded-md bg-surface-2 p-2 type-body-sm">
          <p><strong>Por que falhou:</strong> {st.error ?? "o provedor não devolveu o modelo."}</p>
          <p className="mt-1 type-caption text-muted">{st.canRetryFree ? "O primeiro reprocessamento é grátis (não usa a cota diária)." : "Novas tentativas usam a cota diária de 3D."}</p>
        </div>
      )}
      {s === "COMPLETED" && st.model && (
        <p className="mt-2 type-caption text-muted">
          {st.model.kind === "relevo" ? "Relevo 3D a partir da silhueta" : "Reconstrução 3D"}{st.model.vertices ? ` · ${st.model.vertices.toLocaleString("pt-BR")} vértices` : ""}
          {st.model.heightM ? ` · ${Math.round((st.model.widthM ?? 0) * 100)}×${Math.round(st.model.heightM * 100)}×${Math.round((st.model.depthM ?? 0) * 100)} cm` : ""}
          {st.provider ? ` · ${st.provider}` : ""}{st.fallbackUsed ? " (plano B local)" : ""}
        </p>
      )}
      {(st.stages?.length ?? 0) > 0 && (
        <details className="mt-2 type-caption text-muted" open={running(s)}>
          <summary className="cursor-pointer">Etapas ({st.stages!.length})</summary>
          <ol className="mt-1 space-y-0.5">{st.stages!.map((x, i) => <li key={i}>✓ {STAGE_LABEL[x.name] ?? x.name} <span className="text-faint">· {x.provider}{x.note ? ` · ${x.note}` : ""}</span></li>)}</ol>
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {s === "COMPLETED" && onView && <Button size="sm" variant="primary" onClick={onView}>Ver em 3D</Button>}
        {!running(s) && (
          <Button size="sm" variant={s === "COMPLETED" ? "default" : "primary"} onClick={request} loading={busy}>
            {s === "FAILED" ? (st.canRetryFree ? "Reprocessar (grátis, 1×)" : "Tentar de novo") : s === "COMPLETED" ? "Gerar de novo" : "Gerar modelo 3D"}
          </Button>
        )}
      </div>
      {!s && <p className="mt-2 type-caption text-faint">Motores: {engines}. Leva de segundos (relevo local) a alguns minutos (reconstrução por IA).</p>}
    </section>
  );
}

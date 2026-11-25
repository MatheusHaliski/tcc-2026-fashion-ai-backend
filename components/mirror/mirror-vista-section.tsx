"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";
import { VistaMeCells } from "@/components/mirror/vista-me-cells";
import { MirrorThermalFitNote, MirrorThermalLevel, useNiveisTermicos, type MirrorThermalFit } from "@/components/mirror/mirror-thermal-level";
import type { MirrorData } from "@/components/mirror/mirror-controls";

type VistaBody = { prompt: string; anchorIds: string[]; nivelTermicoId?: string };
type Extras = Pick<MirrorData, "sequence" | "fallbackMessage" | "challengeNotice" | "message"> & { thermal?: MirrorThermalFit | null };

/** O nível térmico do último Vista-me, como o servidor guardou na interpretação (nulo = não informado). */
export const thermalOf = (data: MirrorData | null | undefined): string | null => data?.interpretation?.nivelTermicoId ?? null;

/**
 * O pedido do Vista-me / Outra sugestão. "Outra sugestão" só reaproveita o pedido guardado (POST /another) quando as
 * âncoras e o nível térmico são os mesmos do último pedido; senão refaz o Vista-me com o que está na tela agora.
 * Sem nível escolhido o corpo não leva nivelTermicoId ("Não informado" não é um nível).
 */
export function vistaRequest(kind: "vista-me" | "another", data: MirrorData | null | undefined, anchorIds: string[], prompt?: string,
  nivelTermicoId: string | null = null): { path: string; body?: VistaBody } {
  const body = (p: string): VistaBody => ({ prompt: p, anchorIds, ...(nivelTermicoId ? { nivelTermicoId } : {}) });
  if (kind === "another") {
    const before = (data?.interpretation?.anchors ?? []).map(String);
    const same = before.length === anchorIds.length && anchorIds.every((id) => before.includes(id)) && thermalOf(data) === nivelTermicoId;
    if (same) return { path: "/api/me/mirror/another" };
    return { path: "/api/me/mirror/vista-me", body: body(data?.prompt ?? "") };
  }
  return { path: "/api/me/mirror/vista-me", body: body(prompt ?? "") };
}

/**
 * Espelho › Vista-me (extraído de mirror-controls.tsx): nível térmico opcional, células de ocasião, "Outra sugestão" e o
 * resultado (mensagem, sequência, avisos e a evidência térmica da recomendação).
 */
export function MirrorVistaSection<T extends MirrorData>({ data, busy, anchorIds, run, onVista, inPanel = false }: {
  data: T; busy: string | null; anchorIds: () => string[];
  /** dentro do painel lateral "Vista-me": o título do painel já diz o nome, o da seção fica só para leitores de tela */
  inPanel?: boolean;
  run: (key: string, fn: () => Promise<T | Record<string, unknown>>) => Promise<T | Record<string, unknown> | null>;
  onVista?: (r: T) => void;
}) {
  const { t } = useI18n();
  const [extras, setExtras] = useState<Extras | null>(null);
  const [nivel, setNivel] = useState<string | null>(() => thermalOf(data));
  const niveis = useNiveisTermicos();
  async function vista(path: "vista-me" | "another", prompt?: string) {
    const req = vistaRequest(path, data, anchorIds(), prompt, nivel);
    const r = await run("vista", () => api.post(req.path, req.body));
    if (r && (r as T).slots) {
      const x = r as T & { thermal?: MirrorThermalFit | null };
      setExtras({ sequence: x.sequence, fallbackMessage: x.fallbackMessage, challengeNotice: x.challengeNotice, message: x.message, thermal: x.thermal ?? null });
      onVista?.(x);
    }
  }
  const shown = extras && (extras.message || extras.fallbackMessage || extras.challengeNotice || extras.sequence?.length || extras.thermal);
  return (
    <section className="mirror-section" aria-labelledby="mirror-vista-h">
      <div className={inPanel ? "flex justify-end" : "flex flex-wrap items-center justify-between gap-2"}>
        <h3 id="mirror-vista-h" className={inPanel ? "sr-only" : "mirror-section-h"}>{t("mirror.vista_me")}</h3>
        <Button size="sm" disabled={data.origin !== "vista_me" || busy === "vista"} onClick={() => void vista("another")}>{t("room.outra_sugestao")}</Button>
      </div>
      <MirrorThermalLevel niveis={niveis} value={nivel} busy={busy === "vista"} onChange={setNivel} />
      <VistaMeCells busy={busy === "vista"} lastPrompt={data.prompt} pinnedCount={anchorIds().length} onRun={(prompt) => void vista("vista-me", prompt)} />
      {shown ? (
        <div className="mirror-vista-result" role="status">
          {extras.message && <p className="type-body-sm">{extras.message}</p>}
          {extras.thermal && <MirrorThermalFitNote niveis={niveis} fit={extras.thermal} />}
          {extras.sequence?.length ? <ol className="mirror-sequence">{extras.sequence.map((s) => <li key={s.pieceId}>{s.legend}</li>)}</ol> : null}
          {extras.fallbackMessage && <p className="type-body-sm text-muted">{extras.fallbackMessage}</p>}
          {extras.challengeNotice && <p className="type-body-sm text-muted">{extras.challengeNotice}</p>}
        </div>
      ) : data.prompt ? <p className="type-body-sm text-muted">{t("mirror.ultimo_pedido_combinacoes_mostradas", { prompt: data.prompt, value: data.shownCount ?? 0 })}</p> : null}
    </section>
  );
}

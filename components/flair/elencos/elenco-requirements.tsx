"use client";
/** Progresso do quebra-cabeça (peças encaixadas de N) num medidor e a lista de requisitos do deck (do /conferir; antes dele, os da formação). */
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import type { ElencoConferencia, ElencoRequisito } from "@/lib/flair/elencos/types";

interface Props {
  requisitos: ElencoRequisito[];
  conf: ElencoConferencia | null;
  encaixadas: number;
  total: number;
  aberto: boolean;
  onToggle: () => void;
}

export function ElencoRequirements({ requisitos, conf, encaixadas, total, aberto, onToggle }: Props) {
  const tx = useElencoText();
  const pct = total ? Math.round((100 * encaixadas) / total) : 0;
  // o /conferir devolve {tipo, ok, valor (o que a pessoa tem), alvo}; o valor pedido (cor, estilo) vem da definição, na mesma ordem
  const lista = requisitos.map((r, i) => {
    const s = conf?.requisitos?.[i];
    return { ...r, ok: !!s?.ok, atual: s?.valor ?? 0 };
  });
  return (
    <section className="n3d-objective ep-req" aria-labelledby="ep-req-title" data-testid="elenco-requirements">
      <div className="n3d-objective-head">
        <h2 id="ep-req-title" className="type-label">{tx.t("flair3d.elencos.req.title")}</h2>
        <button type="button" className="btn btn-sm" aria-expanded={aberto} onClick={onToggle}>
          {tx.t(aberto ? "flair3d.ui.objective.hide" : "flair3d.elencos.req.show")}
        </button>
      </div>
      <div className="ep-meter" role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={encaixadas} aria-label={tx.t("flair3d.elencos.progress", { n: encaixadas, total })}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="tabular">{tx.t("flair3d.elencos.progress", { n: encaixadas, total })}</p>
      {aberto && (
        <ul className="n3d-checklist">
          {lista.map((r, i) => (
            <li key={`${r.tipo}-${i}`} className={r.ok ? "is-ok" : "is-miss"}>
              <span>{tx.requisito(r, total)}</span>
              <em>{tx.t(r.ok ? "flair3d.ui.result.ok" : "flair3d.ui.result.notOk")}</em>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

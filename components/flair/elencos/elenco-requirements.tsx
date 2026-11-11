"use client";
/** Química do elenco (0 a 100) num medidor e a lista de requisitos (do /conferir; antes dele, os da formação). */
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import type { ElencoConferencia, ElencoRequisito } from "@/lib/flair/elencos/types";

export function ElencoRequirements({ requisitos, conf, aberto, onToggle }: { requisitos: ElencoRequisito[]; conf: ElencoConferencia | null; aberto: boolean; onToggle: () => void }) {
  const tx = useElencoText();
  const quimica = Math.max(0, Math.min(100, conf?.quimica ?? 0));
  // o /conferir devolve {tipo, ok, valor, alvo}; atributo, vaga e nível vêm da definição, na mesma ordem
  const lista = requisitos.map((r, i) => ({ ...r, ok: false, valor: null as number | string | null, ...(conf?.requisitos?.[i] ?? {}) }));
  return (
    <section className="n3d-objective el-req" aria-labelledby="el-req-title" data-testid="elenco-requirements">
      <div className="n3d-objective-head">
        <h2 id="el-req-title" className="type-label">{tx.t("flair3d.elencos.req.title")}</h2>
        <button type="button" className="btn btn-sm" aria-expanded={aberto} onClick={onToggle}>
          {tx.t(aberto ? "flair3d.ui.objective.hide" : "flair3d.elencos.req.show")}
        </button>
      </div>
      <div className="el-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={quimica} aria-label={tx.t("flair3d.elencos.chemistry", { n: quimica })}>
        <span style={{ width: `${quimica}%` }} />
      </div>
      <p className="tabular">{tx.t("flair3d.elencos.chemistry", { n: quimica })}</p>
      {aberto && (
        <ul className="n3d-checklist">
          {lista.map((r, i) => (
            <li key={`${r.tipo}-${i}`} className={r.ok ? "is-ok" : "is-miss"}>
              <span>{tx.requisito(r)}</span>
              <em>{tx.t(r.ok ? "flair3d.ui.result.ok" : "flair3d.ui.result.notOk")}</em>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

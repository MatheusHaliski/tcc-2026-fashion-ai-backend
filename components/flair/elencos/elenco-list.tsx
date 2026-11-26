"use client";
/** Os elencos em quebra-cabeça (/flair/elencos): a imagem de cada um, o número de peças, concluído e a edição. Sem a API, as formações locais. */
import Link from "next/link";
import { Badge, PageHeader, UiIcon } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { listarElencos } from "@/lib/flair/elencos/api";
import { FORMACOES, rotaDoElenco } from "@/lib/flair/elencos/formacoes";
import { quebraCabecaDe } from "@/lib/flair/elencos/quebra-cabecas";
import type { ElencoResumo } from "@/lib/flair/elencos/types";

const LOCAL: ElencoResumo[] = FORMACOES.map((f) => ({ codigo: f.codigo, pecas: f.vagas.length, concluido: false, edicao: null }));

export function ElencoList() {
  const tx = useElencoText();
  const lista = useApi((signal) => listarElencos(signal), []);
  const elencos = lista.data?.elencos?.length ? lista.data.elencos : LOCAL;
  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{tx.t("flair.hub.back")}</Link>
        <PageHeader title={tx.t("flair3d.elencos.title")} lead={tx.t("flair3d.elencos.lead")} />
      </div>
      <ol className="ep-list" data-testid="elenco-list">
        {elencos.map((e) => {
          const qc = quebraCabecaDe(e.codigo);
          return (
            <li key={e.codigo}>
              <Link href={rotaDoElenco(e.codigo)} className={`ep-list-item${e.concluido ? " is-done" : ""}`}>
                <span className="ep-list-thumb">{qc ? <img src={qc.imagem} alt="" loading="lazy" decoding="async" /> : null}</span>
                <span className="ep-list-name">{tx.elenco(e.codigo)}</span>
                <span className="text-muted">{tx.t("flair3d.elencos.counts", { n: e.pecas })}</span>
                {e.concluido ? <Badge tone="thread">{tx.t("flair3d.elencos.done", { n: e.edicao ?? 0 })}</Badge> : <Badge>{tx.t("flair3d.elencos.todo")}</Badge>}
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}

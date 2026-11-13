"use client";
/** Os cinco elencos (/flair/elencos): vagas, linhas, concluído e a edição. Sem a API, as formações locais. */
import Link from "next/link";
import { Badge, PageHeader, UiIcon } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { listarElencos } from "@/lib/flair/elencos/api";
import { arteDoElenco, FORMACOES, rotaDoElenco } from "@/lib/flair/elencos/formacoes";
import type { ElencoResumo } from "@/lib/flair/elencos/types";

const LOCAL: ElencoResumo[] = FORMACOES.map((f) => ({ codigo: f.codigo, vagas: f.vagas.length, linhas: f.linhas.length, concluido: false, edicao: null }));

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
      <ol className="el-list" data-testid="elenco-list">
        {elencos.map((e) => (
          <li key={e.codigo}>
            <Link href={rotaDoElenco(e.codigo)} className="el-list-item">
              <img src={arteDoElenco(e.codigo)} alt="" loading="lazy" />
              <span className="el-list-name">{tx.elenco(e.codigo)}</span>
              <span className="text-muted">{tx.t("flair3d.elencos.counts", { vagas: e.vagas, linhas: e.linhas })}</span>
              {e.concluido ? <Badge tone="thread">{tx.t("flair3d.elencos.done", { n: e.edicao ?? 0 })}</Badge> : <Badge>{tx.t("flair3d.elencos.todo")}</Badge>}
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}

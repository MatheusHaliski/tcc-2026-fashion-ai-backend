"use client";
/** Lista dos 15 núcleos (/flair/3d): número, nome, recursos e o link do jogo. Sem a API, a lista sai do registro local. */
import Link from "next/link";
import { Badge, PageHeader, UiIcon } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { listarNucleos } from "@/lib/flair/nucleos/api";
import { NUCLEO_LISTA, rotaDoNucleo } from "@/lib/flair/nucleos/registry";
import type { NucleoResumo } from "@/lib/flair/nucleos/types";

const LOCAL: NucleoResumo[] = NUCLEO_LISTA.map((n) => ({ codigo: n.codigo, numero: n.numero, recursos: n.recursos, acoes: n.acoes }));

export function NucleoList() {
  const tx = useNucleoText();
  const lista = useApi((signal) => listarNucleos(signal), []);
  const nucleos = [...(lista.data?.nucleos?.length ? lista.data.nucleos : LOCAL)].sort((a, b) => a.numero - b.numero);
  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{tx.t("flair.hub.back")}</Link>
        <PageHeader title={tx.t("flair3d.ui.title")} lead={tx.t("flair3d.ui.lead")} />
      </div>
      <ol className="n3d-list" data-testid="nucleo-list">
        {nucleos.map((n) => (
          <li key={n.codigo}>
            <Link href={rotaDoNucleo(n.codigo)} className="n3d-list-item">
              <span className="n3d-list-num tabular">{n.numero}</span>
              <span className="n3d-list-name">{tx.nome(n.codigo)}</span>
              <span className="n3d-list-res">
                {n.recursos.map((r) => <Badge key={r} tone="thread">{tx.t(`flair3d.ui.recurso.${r}`)}</Badge>)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}

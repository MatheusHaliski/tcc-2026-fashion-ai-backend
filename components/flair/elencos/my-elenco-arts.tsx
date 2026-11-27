"use client";
/**
 * Minhas Artes → as imagens dos elencos concluídos: quem completa o quebra-cabeça ganha a sua cópia da imagem, com o
 * número da edição (a ordem de conclusão gravada pelo servidor na entrega). A lista vem de GET /api/flair/elencos
 * (concluido + edicao); a imagem é a do próprio quebra-cabeça (lib/flair/elencos/quebra-cabecas.ts).
 */
import Link from "next/link";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { listarElencos } from "@/lib/flair/elencos/api";
import { rotaDoElenco } from "@/lib/flair/elencos/formacoes";
import { quebraCabecaDe } from "@/lib/flair/elencos/quebra-cabecas";
import { useApi } from "@/lib/hooks/use-api";

export function MyElencoArts() {
  const tx = useElencoText();
  const query = useApi((signal) => listarElencos(signal), []);
  const artes = (query.data?.elencos ?? [])
    .filter((e) => e.concluido)
    .map((e) => ({ ...e, qc: quebraCabecaDe(e.codigo) }))
    .filter((e) => e.qc !== null);
  return (
    <section className="grid gap-3" aria-label={tx.t("flair3d.elencos.arts.title")} data-testid="minhas-artes-elencos">
      <h3 className="type-h3">{tx.t("flair3d.elencos.arts.title")}</h3>
      {query.loading ? (
        <p role="status">{tx.t("flair3d.elencos.arts.loading")}</p>
      ) : query.error ? (
        <div role="alert">
          <p>{tx.t("flair3d.elencos.arts.error")}</p>
          <Button onClick={query.reload}>{tx.t("flair3d.elencos.arts.retry")}</Button>
        </div>
      ) : !artes.length ? (
        <p className="type-body-sm">
          {tx.t("flair3d.elencos.arts.empty")} <Link href="/flair/elencos">{tx.t("flair3d.elencos.arts.play")}</Link>
        </p>
      ) : (
        <div className="opt-grid">
          {artes.map(({ codigo, edicao, qc }) => {
            const nome = tx.elenco(codigo);
            return (
              <article key={codigo} className="surface p-3 ep-art" data-testid="arte-elenco">
                <a href={qc!.imagem} target="_blank" rel="noreferrer" className="ep-art-frame"
                  style={{ "--ep-ar": qc!.largura / 100 } as CSSProperties}>
                  <img src={qc!.imagem} alt={tx.t("flair3d.elencos.arts.alt", { nome })} loading="lazy" decoding="async" />
                </a>
                <h4 className="type-heading">{nome}</h4>
                <p className="type-caption">{tx.t("flair3d.elencos.arts.edition", { n: edicao ?? 0 })}</p>
                <div className="ep-art-actions">
                  <a className="btn btn-sm" href={qc!.imagem} download>{tx.t("flair3d.elencos.arts.download")}</a>
                  <Link className="btn btn-sm" href={rotaDoElenco(codigo)}>{tx.t("flair3d.elencos.arts.open")}</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

"use client";
/**
 * Modal de conclusão do elenco: "Parabéns, você completou!", o vídeo do elenco tocando (sem som, em laço, na própria
 * página do celular, com os controles) e a edição ganha. Os logos sem vídeo próprio mostram o próprio quebra-cabeça
 * se montando, peça a peça, em CSS (docs/flair/cbc/CINCO_ELENCOS.md, "O modal de conclusão").
 */
import Link from "next/link";
import { Dialog } from "@/components/ui";
import { ElencoPuzzle } from "@/components/flair/elencos/elenco-puzzle";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import type { QuebraCabeca } from "@/lib/flair/elencos/quebra-cabecas";

interface Props {
  qc: QuebraCabeca;
  nome: string;
  edicao: number;
  aberto: boolean;
  onFechar: () => void;
}

export function ElencoCompleto({ qc, nome, edicao, aberto, onFechar }: Props) {
  const tx = useElencoText();
  return (
    <Dialog open={aberto} onClose={onFechar} title={tx.t("flair3d.elencos.complete.title")} size="lg"
      footer={(
        <>
          <Link href="/flair/elencos" className="btn btn-sm">{tx.t("flair3d.elencos.complete.back")}</Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={onFechar}>{tx.t("flair3d.elencos.complete.close")}</button>
        </>
      )}>
      <div className="ep-complete" data-testid="elenco-completo">
        {qc.video ? (
          <video className="ep-complete-video" src={qc.video} poster={qc.imagem} autoPlay muted loop playsInline controls preload="auto"
            aria-label={tx.t("flair3d.elencos.complete.video", { nome })} data-testid="elenco-video" />
        ) : (
          <ElencoPuzzle qc={qc} nome={nome} estados={[]} chaves={[]} completo montando />
        )}
        <p className="type-body">{tx.t("flair3d.elencos.complete.body", { nome, n: edicao })}</p>
      </div>
    </Dialog>
  );
}

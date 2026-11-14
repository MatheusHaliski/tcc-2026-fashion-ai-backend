"use client";
/**
 * Abertura de cada salão do Fashion Detective: um cartão sobre a faixa do deck apresenta o salão, o código de
 * vestimenta e a carta de pista antes de a pessoa escolher o look. Fecha sozinho depois de ABERTURA_MS ou no botão;
 * volta a aparecer quando o caso passa para o salão seguinte. Não cobre o palco: a roupa continua à vista.
 */
import { useEffect, useState } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { SalaoDaVez } from "@/lib/flair/nucleos/detective";

/** Quanto a abertura fica na tela, em ms, se a pessoa não fechar antes. */
export const ABERTURA_MS = 8000;

export function NucleoCutscene({ salao }: { salao: SalaoDaVez }) {
  const tx = useNucleoText();
  const [visto, setVisto] = useState<number | null>(null);
  const aberta = visto !== salao.numero;

  useEffect(() => {
    if (!aberta) return;
    const timer = window.setTimeout(() => setVisto(salao.numero), ABERTURA_MS);
    return () => window.clearTimeout(timer);
  }, [aberta, salao.numero]);

  if (!aberta) return null;
  const base = `flair3d.ui.detetive.${salao.codigo}`;
  return (
    <section className="n3d-cutscene" role="dialog" aria-label={tx.t("flair3d.ui.detetive.cutscene.title")} data-testid="nucleo-cutscene">
      <p className="type-label">{tx.t("flair3d.ui.detetive.cutscene.room", { n: salao.numero, total: salao.total })}</p>
      <h3>{tx.t(`${base}.name`)}</h3>
      <p>{tx.t(`${base}.intro`)}</p>
      <p className="n3d-cutscene-code">{tx.t("flair3d.ui.detetive.cutscene.code", { codigo: tx.t(`${base}.code`) })}</p>
      <blockquote className="n3d-cutscene-clue">{tx.t(`${base}.clue`)}</blockquote>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => setVisto(salao.numero)}>
        {tx.t("flair3d.ui.detetive.cutscene.go")}
      </button>
    </section>
  );
}

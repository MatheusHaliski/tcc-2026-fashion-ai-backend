"use client";
/**
 * Cutscene do caso (abertura e resolução de cada sala, álibi, final): faixas de cinema em cima e embaixo e as falas em
 * legenda (pt-BR, en, es), uma por vez. Avança sozinha a cada {@link FALA_MS} ou no toque; "Pular" fecha, "Rever"
 * recomeça. Com "reduzir movimento" nada desliza: as falas trocam no lugar e não avançam sozinhas.
 */
import { useEffect, useState } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { partesDaCena } from "@/lib/flair/detetive/types";

export const FALA_MS = 3600;
const MAX_FALAS = 4;

/** As falas da cena que existem nos textos (até quatro). */
export function useFalas(cena: string | null): string[] {
  const tx = useNucleoText();
  const partes = partesDaCena(cena);
  if (!partes) return [];
  const [tipo, assunto] = partes;
  const out: string[] = [];
  for (let n = 1; n <= MAX_FALAS; n++) {
    const fala = tx.ou(`flair3d.detetive.cena.${tipo}.${assunto}.${n}`, "");
    if (fala) out.push(fala);
  }
  return out;
}

interface Props {
  cena: string;
  reduzido: boolean;
  onFechar: () => void;
}

export function DetetiveCutscene({ cena, reduzido, onFechar }: Props) {
  const tx = useNucleoText();
  const falas = useFalas(cena);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [cena]);
  useEffect(() => {
    if (reduzido || i >= falas.length - 1) return;
    const t = setTimeout(() => setI((x) => x + 1), FALA_MS);
    return () => clearTimeout(t);
  }, [i, falas.length, reduzido]);
  if (falas.length === 0) return null;
  const ultima = i >= falas.length - 1;
  return (
    <div className="dtv-cena" role="dialog" aria-modal="false" aria-label={tx.t("flair3d.detetive.ui.cena")} data-testid="detetive-cutscene" data-cena={cena}>
      <div className="dtv-cena-faixa" aria-hidden />
      <div className="dtv-cena-faixa is-baixo" aria-hidden />
      <button type="button" className="dtv-cena-legenda" onClick={() => (ultima ? onFechar() : setI(i + 1))} aria-live="polite">
        {falas[i]}
        <span className="dtv-cena-conta">{i + 1}/{falas.length}</span>
      </button>
      <div className="dtv-cena-botoes">
        <button type="button" className="btn btn-sm" onClick={() => setI(0)}>{tx.t("flair3d.detetive.ui.rever")}</button>
        <button type="button" className="btn btn-sm" onClick={onFechar} data-testid="detetive-pular">{tx.t(ultima ? "flair3d.detetive.ui.seguir" : "flair3d.detetive.ui.pular")}</button>
      </div>
    </div>
  );
}

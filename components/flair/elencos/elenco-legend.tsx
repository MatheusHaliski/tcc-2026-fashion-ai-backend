"use client";
/** Legenda do tabuleiro: o que cada cor de linha quer dizer e o que são as letras sobre as linhas (M, S, C, E, Cor, O). */
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";

const ATRIBUTOS = ["MARCA", "SUBCATEGORIA", "CATEGORIA", "ESTILO", "COR", "OCASIAO"];
const CORES = [
  { classe: "is-green", chave: "verde" },
  { classe: "is-orange", chave: "laranja" },
  { classe: "is-red", chave: "vermelha" },
];

export function ElencoLegend() {
  const tx = useElencoText();
  return (
    <div className="el-legend" aria-label={tx.t("flair3d.elencos.legend.title")}>
      <ul className="el-legend-cores">
        {CORES.map((c) => (
          <li key={c.chave}>
            <svg width="28" height="8" aria-hidden><line x1="0" y1="4" x2="28" y2="4" className={`el-line ${c.classe}`} /></svg>
            {tx.t(`flair3d.elencos.legend.${c.chave}`)}
          </li>
        ))}
      </ul>
      <p className="type-caption text-muted">
        {tx.t("flair3d.elencos.legend.letras", { lista: ATRIBUTOS.map((a) => `${tx.atributoCurto(a)} = ${tx.atributo(a)}`).join(" · ") })}
      </p>
    </div>
  );
}

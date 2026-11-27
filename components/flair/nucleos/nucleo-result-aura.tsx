"use client";
/**
 * O que a Aura fez na partida, no resultado (rodada 8g): a faixa que a plateia leu e os pontos dela, o trunfo chamado,
 * e o que as famílias mudaram na execução (a janela do Electro, o erro perdoado do Comum, as marcas da Metamorfose).
 * Tudo como o servidor mandou; sem Aura na partida, nada aparece.
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { auraDaExecucao, auraDoResultado } from "@/lib/flair/nucleos/aura-na-partida";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

export function NucleoResultAura({ codigo, resultado }: { codigo: NucleoCodigo; resultado: NucleoResultado }) {
  const tx = useNucleoText();
  const aura = auraDoResultado(resultado);
  const execucao = auraDaExecucao(resultado);
  if (!aura && !execucao) return null;
  const quem = tx.ou(`flair3d.ui.aura.plateia.${codigo}`, tx.t("flair3d.ui.aura.plateia.padrao"));
  const linhas: string[] = [];
  if (aura) linhas.push(tx.t("flair3d.ui.aura.reagiu", { quem, faixa: tx.t(`hype.level.${aura.faixa}`), pontos: aura.plateia }));
  if (aura?.trunfo) linhas.push(tx.t("flair3d.ui.aura.rendeu", { faixa: tx.t(`hype.level.${aura.trunfo.faixa}`), pontos: aura.trunfo.bonus }));
  if (execucao && execucao.electroMs > 0) linhas.push(tx.t("flair3d.ui.aura.exec.ELECTRO", { ms: execucao.electroMs }));
  if (execucao && execucao.perdoados > 0) linhas.push(tx.t("flair3d.ui.aura.exec.COMMON"));
  if (execucao && execucao.metamorfoses.length > 0) linhas.push(tx.t("flair3d.ui.aura.exec.METAMORPHOSE", { marcas: execucao.metamorfoses.map((i) => i + 1).join(", ") }));
  return (
    <>
      <h3 className="type-label">{tx.t("flair3d.ui.aura.titulo")}</h3>
      <ul className="n3d-aura-resultado" data-testid="nucleo-result-aura">
        {linhas.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </>
  );
}

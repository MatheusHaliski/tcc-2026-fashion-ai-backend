"use client";
/**
 * A Aura na partida, na preparação (rodada 8g): a plateia (ou o júri, ou os fãs) que reage à faixa de Hype do look, o
 * que cada família de Aura vestida faz (Splash, Electro, Comum, Metamorfose) e o trunfo do Hype, chamado uma vez por
 * partida com uma carta do deck. A conta é a do servidor (o AURA_NA_PARTIDA da prévia); antes da primeira prévia, a
 * mesma regra lida dos selos (lib/flair/nucleos/aura-na-partida.ts). O jogo só lê o Hype: nada aqui o muda. Fechado,
 * mostra só o resumo curto ("Aura +6 · trunfo +4"); o resto abre como painel.
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { useTrunfoDoHype } from "@/components/flair/nucleos/use-trunfo-do-hype";
import { AURA_JOGOS, auraDoLook, auraDoResultado, type AuraDaCarta } from "@/lib/flair/nucleos/aura-na-partida";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

interface Props {
  codigo: NucleoCodigo;
  /** o look de agora: vaga → carta */
  vestidas: Record<string, string>;
  cartas: FlairCollectionCard[];
  aura: (cardId: string) => AuraDaCarta | undefined;
  previa?: NucleoResultado | null;
  /** a partida aberta (o trunfo só vale dentro dela) */
  partida?: string | null;
}

export function NucleoAura({ codigo, vestidas, cartas, aura, previa, partida }: Props) {
  const tx = useNucleoText();
  const servidor = auraDoResultado(previa);
  const trunfo = useTrunfoDoHype(partida, servidor?.trunfo ?? null);
  const emPartida = !!partida;
  if (!AURA_JOGOS.has(codigo)) return null;
  const doLook = auraDoLook(Object.values(vestidas).map(aura));
  const leitura = servidor ?? { ...doLook, trunfo: null };
  const chamado = trunfo.trunfo;
  const quem = tx.ou(`flair3d.ui.aura.plateia.${codigo}`, tx.t("flair3d.ui.aura.plateia.padrao"));
  const nomeDe = (id: string) => cartas.find((c) => c.id === id)?.name ?? "";
  const candidatas = cartas.filter((c) => (aura(c.id)?.trunfo ?? 0) > 0);
  const familias = [leitura.splash && "SPLASH", leitura.electroMs > 0 && "ELECTRO", leitura.comum && "COMMON", leitura.metamorfose && "METAMORPHOSE"].filter(Boolean) as string[];
  return (
    // HUD mínimo de console (auditoria de 27/11): fechado, só o resumo de até 6 palavras; o detalhe abre como painel
    <details className="n3d-aura" aria-label={tx.t("flair3d.ui.aura.titulo")} data-testid="nucleo-aura">
      <summary className="type-label" data-testid="nucleo-aura-resumo">
        {tx.t(chamado ? "flair3d.ui.aura.resumoTrunfo" : "flair3d.ui.aura.resumo", { pontos: leitura.plateia, trunfo: chamado?.bonus ?? 0 })}
      </summary>
      <p data-testid="nucleo-aura-plateia">
        {tx.t("flair3d.ui.aura.reage", { quem, faixa: tx.t(`hype.level.${leitura.faixa}`), pontos: leitura.plateia })}
      </p>
      {familias.length > 0 && (
        <ul className="n3d-aura-familias">
          {familias.map((f) => (
            <li key={f} data-familia={f}>{tx.ou(`flair3d.ui.aura.familia.${f}.${codigo}`, tx.t(`flair3d.ui.aura.familia.${f}`, { ms: leitura.electroMs }))}</li>
          ))}
        </ul>
      )}
      {chamado ? (
        <p className="n3d-aura-trunfo is-chamado" data-testid="nucleo-aura-trunfo">
          {tx.t(codigo === "BATALHA_LOOKS" ? "flair3d.ui.aura.chamadoBatalha" : "flair3d.ui.aura.chamado", { carta: nomeDe(chamado.carta), faixa: tx.t(`hype.level.${chamado.faixa}`), pontos: chamado.bonus })}
        </p>
      ) : emPartida && (
        <div className="n3d-aura-trunfo" data-testid="nucleo-aura-trunfo">
          <p>{tx.t(codigo === "BATALHA_LOOKS" ? "flair3d.ui.aura.trunfoBatalha" : "flair3d.ui.aura.trunfo")}</p>
          {candidatas.length === 0 ? <p className="n3d-hint">{tx.t("flair3d.ui.aura.semCandidata")}</p> : (
            <div className="n3d-aura-botoes">
              {candidatas.map((c) => (
                <button key={c.id} type="button" className="btn btn-ghost" disabled={trunfo.ocupado} onClick={() => trunfo.chamar(c.id)} data-card={c.id}>
                  {tx.t("flair3d.ui.aura.chamar", { carta: c.name, pontos: aura(c.id)?.trunfo ?? 0 })}
                </button>
              ))}
            </div>
          )}
          {trunfo.erro && <p className="n3d-hint is-erro" role="alert">{tx.ou(`flair3d.ui.aura.erro.${trunfo.erro}`, tx.t("flair3d.ui.aura.erro.padrao"))}</p>}
        </div>
      )}
      <p className="n3d-hint">{tx.t("flair3d.ui.aura.leitura")}</p>
    </details>
  );
}

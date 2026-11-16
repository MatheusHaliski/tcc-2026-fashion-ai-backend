"use client";
/**
 * As barras de vida do Dress Fighter (auditoria dos jogos de 15/11, pergunta 5): a da avatar no alto à esquerda e a da
 * oponente no alto à direita, com moldura, nome e o número, que descem no mesmo valor que o servidor devolve a cada
 * lance; o round, o lance e o último combo no meio de cima, fora da zona da roupa. Some fora da luta.
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { estadoDaLuta, fracaoDaVida } from "@/lib/flair/nucleos/luta";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

function Barra({ lado, nome, vida, total }: { lado: "voce" | "oponente"; nome: string; vida: number; total: number }) {
  const fracao = fracaoDaVida(vida, total);
  return (
    <div className={`n3d-vida is-${lado}`} role="meter" aria-label={nome} aria-valuemin={0} aria-valuemax={total} aria-valuenow={vida}
      data-testid={`vida-${lado}`} data-baixa={fracao <= 0.3 || undefined}>
      <span className="n3d-vida-nome">{nome}</span>
      <span className="n3d-vida-trilho" aria-hidden>
        <span className="n3d-vida-cheia" style={{ transform: `scaleX(${fracao})` }} />
      </span>
      <span className="n3d-vida-valor tabular">{vida}</span>
    </div>
  );
}

export function NucleoBarrasDeVida({ resultado }: { resultado: NucleoResultado | null }) {
  const tx = useNucleoText();
  const luta = estadoDaLuta(resultado);
  if (!luta) return null;
  return (
    <div className="n3d-luta" data-testid="nucleo-luta">
      <Barra lado="voce" nome={tx.t("flair3d.ui.luta.voce")} vida={luta.vidaVoce} total={luta.vida} />
      <p className="n3d-luta-placar" role="status">
        {tx.t("flair3d.ui.luta.placar", { round: luta.round, lance: Math.min(luta.lance + 1, luta.lances), lances: luta.lances })}
        {luta.combo && <strong className="n3d-luta-combo"> {tx.t("flair3d.ui.luta.combo", { combo: tx.ou(`flair3d.ui.combo.${luta.combo}`, luta.combo) })}</strong>}
      </p>
      <Barra lado="oponente" nome={tx.t("flair3d.ui.luta.oponente")} vida={luta.vidaOponente} total={luta.vida} />
    </div>
  );
}

"use client";
/**
 * Informações sobre o palco, nos quatro cantos e sempre fora da zona da roupa (a faixa central de 40% da largura):
 * em cima à esquerda, o nome do jogo e o objetivo em uma linha; em cima à direita, os pontos e as estrelas; embaixo à
 * esquerda, quem está na partida; embaixo à direita, os botões de câmera.
 */
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { HudIcon } from "@/components/flair/nucleos/nucleo-icons";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { FxPrefs } from "@/lib/flair/nucleos/fx-sound";
import type { Momento } from "@/lib/flair/nucleos/moments";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

interface HudProps {
  topoEsquerda: ReactNode;
  topoDireita: ReactNode;
  baseEsquerda: ReactNode;
  baseDireita: ReactNode;
}

export function NucleoHud({ topoEsquerda, topoDireita, baseEsquerda, baseDireita }: HudProps) {
  return (
    <>
      <div className="n3d-hud n3d-hud-tl" data-corner="tl">{topoEsquerda}</div>
      <div className="n3d-hud n3d-hud-tr" data-corner="tr">{topoDireita}</div>
      <div className="n3d-hud n3d-hud-bl" data-corner="bl">{baseEsquerda}</div>
      <div className="n3d-hud n3d-hud-br" data-corner="br">{baseDireita}</div>
    </>
  );
}

interface ScoreProps {
  momento: Momento;
  resultado: NucleoResultado | null;
  prefs: FxPrefs;
  onPref: (campo: keyof FxPrefs) => void;
}

/** Pontos e estrelas: os do servidor, e só no resultado (antes da entrega e durante a ação o placar fica em espera). */
export function NucleoScore({ momento, resultado, prefs, onPref }: ScoreProps) {
  const tx = useNucleoText();
  const pronto = momento === "RESULTADO" && !!resultado;
  const estrelas = pronto && resultado ? Math.max(0, Math.min(3, resultado.estrelas)) : 0;
  const rotulo = pronto && resultado
    ? `${tx.t("flair3d.ui.result.points", { n: resultado.pontos })}, ${tx.t("flair3d.ui.result.stars", { n: estrelas })}`
    : tx.t("flair3d.ui.hud.pending");
  return (
    <div className="n3d-score" data-testid="nucleo-score">
      <p className="n3d-score-line" role="img" aria-label={rotulo}>
        <strong className="n3d-score-points tabular" id="n3d-score-points">
          {pronto && resultado ? tx.t("flair3d.ui.points", { n: resultado.pontos }) : "—"}
        </strong>
        <span className="n3d-score-stars" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span key={i} className={cn("n3d-star", i <= estrelas && "is-on")}>★</span>
          ))}
        </span>
      </p>
      <div className="n3d-prefs" role="group" aria-label={tx.t("flair3d.ui.fx.prefs")}>
        <button type="button" className="n3d-icon-btn" aria-pressed={prefs.som} aria-label={tx.t("flair3d.ui.fx.sound")} title={tx.t("flair3d.ui.fx.sound")} onClick={() => onPref("som")}>
          <HudIcon name={prefs.som ? "som" : "somOff"} />
        </button>
        <button type="button" className="n3d-icon-btn" aria-pressed={prefs.efeitos} aria-label={tx.t("flair3d.ui.fx.effects")} title={tx.t("flair3d.ui.fx.effects")} onClick={() => onPref("efeitos")}>
          <HudIcon name="efeitos" />
        </button>
      </div>
    </div>
  );
}

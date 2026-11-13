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
  /** prévia do servidor para o look de agora (só na preparação) */
  previa?: NucleoResultado | null;
  prefs: FxPrefs;
  onPref: (campo: keyof FxPrefs) => void;
}

/**
 * Pontos e estrelas, sempre os do servidor. Na preparação, a prévia do look de agora (nas disputas automáticas, só os
 * atributos: o desfecho sai na luta ou na partida); durante a ação o placar fica em espera; no resultado, a nota final.
 */
export function NucleoScore({ momento, resultado, previa = null, prefs, onPref }: ScoreProps) {
  const tx = useNucleoText();
  const aoVivo = momento === "PREPARACAO" ? previa : null;
  const atributos = aoVivo?.resultado === "PREVIA" ? aoVivo.eventos : [];
  let nota: NucleoResultado | null = null;
  if (momento === "RESULTADO") nota = resultado;
  else if (aoVivo && aoVivo.resultado !== "PREVIA") nota = aoVivo;
  const estrelas = nota ? Math.max(0, Math.min(3, nota.estrelas)) : 0;
  let rotulo = tx.t(atributos.length > 0 ? "flair3d.ui.hud.attrs" : "flair3d.ui.hud.pending");
  if (nota) rotulo = `${tx.t("flair3d.ui.result.points", { n: nota.pontos })}, ${tx.t("flair3d.ui.result.stars", { n: estrelas })}`;
  if (nota && aoVivo) rotulo = tx.t("flair3d.ui.hud.preview", { nota: rotulo });
  let estado = "espera";
  if (nota) estado = aoVivo ? "previa" : "final";
  return (
    <div className="n3d-score" data-testid="nucleo-score" data-estado={estado}>
      <p className="n3d-score-line" role="img" aria-label={rotulo}>
        <strong className="n3d-score-points tabular" id="n3d-score-points">
          {nota ? tx.t("flair3d.ui.points", { n: nota.pontos }) : "—"}
        </strong>
        <span className="n3d-score-stars" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span key={i} className={cn("n3d-star", i <= estrelas && "is-on")}>★</span>
          ))}
        </span>
      </p>
      {atributos.length > 0 && (
        <dl className="n3d-score-attrs tabular" data-testid="nucleo-preview-attrs">
          {atributos.map((e) => (
            <div key={e.codigo}>
              <dt>{tx.atributo(e.codigo)}</dt>
              <dd>{String(e.valor ?? "")}</dd>
            </div>
          ))}
        </dl>
      )}
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

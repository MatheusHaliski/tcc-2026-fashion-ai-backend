"use client";
/**
 * Botões na tela (toque e mouse) para as ações permitidas no núcleo e a ajuda dos comandos (teclado e gamepad).
 * Na tela de jogo os botões se dividem em dois grupos: "camera" (girar, aproximar e posar, no canto de baixo à
 * direita do palco) e "deck" (tirar e desfilar, na faixa do deck). Sem grupo, a barra inteira com a ajuda (MAKE UP).
 */
import { HudIcon, type HudIconName } from "@/components/flair/nucleos/nucleo-icons";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { BOTOES_TELA, type Comando } from "@/lib/flair/nucleos/controls";
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

const ICONES: Record<string, HudIconName> = {
  "turn-left": "girarE",
  "turn-right": "girarD",
  "zoom-in": "mais",
  "zoom-out": "menos",
  pose: "pose",
  remove: "tirar",
  walk: "andar",
};

const GRUPOS: Record<"camera" | "deck", string[]> = {
  camera: ["turn-left", "turn-right", "zoom-in", "zoom-out", "pose"],
  deck: ["remove", "walk"],
};

interface Props {
  acoes: NucleoAcao[];
  gamepad: boolean;
  onComando: (c: Comando) => void;
  grupo?: "camera" | "deck";
  /** ações que o momento da partida não permite ficam desligadas */
  permitido?: (acao: NucleoAcao) => boolean;
}

export function NucleoHelp({ acoes, gamepad, ampliar = false }: { acoes: NucleoAcao[]; gamepad: boolean; ampliar?: boolean }) {
  const tx = useNucleoText();
  return (
    <details className="n3d-help">
      <summary>{tx.t("flair3d.ui.controls.help")}</summary>
      <p className="n3d-help-pad" role="status">{tx.t(gamepad ? "flair3d.ui.controls.gamepadOn" : "flair3d.ui.controls.gamepadOff")}</p>
      <dl>
        {acoes.map((a) => (
          <div key={a}>
            <dt>{tx.t(`flair3d.ui.action.${a}`)}</dt>
            <dd>{tx.t(`flair3d.ui.controls.${a}`)}</dd>
          </div>
        ))}
        {ampliar && (
          <div>
            <dt>{tx.t("flair3d.ui.action.AMPLIAR")}</dt>
            <dd>{tx.t("flair3d.ui.controls.AMPLIAR")}</dd>
          </div>
        )}
      </dl>
    </details>
  );
}

export function NucleoControls({ acoes, gamepad, onComando, grupo, permitido }: Props) {
  const tx = useNucleoText();
  const doNucleo = BOTOES_TELA.filter((b) => acoes.includes(b.cmd.acao));
  if (grupo) {
    const botoes = doNucleo.filter((b) => GRUPOS[grupo].includes(b.id));
    if (botoes.length === 0) return null;
    return (
      <div className={`n3d-pad is-${grupo}`} role="toolbar" aria-label={tx.t(grupo === "camera" ? "flair3d.ui.controls.camera" : "flair3d.ui.controls.toolbar")}>
        {botoes.map((b) => {
          const nome = tx.t(`flair3d.ui.button.${b.id}`);
          return (
            <button key={b.id} type="button" className="n3d-icon-btn" data-action={b.id} aria-label={nome} title={nome} disabled={permitido ? !permitido(b.cmd.acao) : false} onClick={() => onComando(b.cmd)}>
              <HudIcon name={ICONES[b.id]} />
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <section className="n3d-controls" aria-label={tx.t("flair3d.ui.controls.title")}>
      <div className="n3d-pad" role="toolbar" aria-label={tx.t("flair3d.ui.controls.toolbar")}>
        {doNucleo.map((b) => (
          <button key={b.id} type="button" className="n3d-pad-btn" data-action={b.id} onClick={() => onComando(b.cmd)}>
            {tx.t(`flair3d.ui.button.${b.id}`)}
          </button>
        ))}
      </div>
      <NucleoHelp acoes={acoes} gamepad={gamepad} />
    </section>
  );
}

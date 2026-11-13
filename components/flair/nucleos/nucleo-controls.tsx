"use client";
/**
 * Botões na tela (toque e mouse) para cada ação permitida no núcleo e a ajuda dos comandos (teclado e gamepad).
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { BOTOES_TELA, type Comando } from "@/lib/flair/nucleos/controls";
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

export function NucleoControls({ acoes, gamepad, onComando }: { acoes: NucleoAcao[]; gamepad: boolean; onComando: (c: Comando) => void }) {
  const tx = useNucleoText();
  const botoes = BOTOES_TELA.filter((b) => acoes.includes(b.cmd.acao));
  return (
    <section className="n3d-controls" aria-label={tx.t("flair3d.ui.controls.title")}>
      <div className="n3d-pad" role="toolbar" aria-label={tx.t("flair3d.ui.controls.toolbar")}>
        {botoes.map((b) => (
          <button key={b.id} type="button" className="n3d-pad-btn" data-action={b.id} onClick={() => onComando(b.cmd)}>
            {tx.t(`flair3d.ui.button.${b.id}`)}
          </button>
        ))}
      </div>
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
        </dl>
      </details>
    </section>
  );
}

"use client";
/**
 * Cena 2D de reserva (sem WebGL, ou se a cena 3D falhar): as cores da sala do jogo, a marca da zona do avatar, os
 * figurantes como silhuetas ao fundo e as peças escolhidas. Com resultado, mostra só o quadro parado: o placar e a
 * nota, sem animação. Nunca um painel em branco.
 */
import type { Look3dPiece } from "@/components/three/common";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";
import { figurantesDaCena } from "@/lib/flair/nucleos/scene/budget";
import { salaDe } from "@/lib/flair/nucleos/scene/registry";
import { placarDaCena } from "@/lib/flair/nucleos/scene/sequences-auto";
import type { NucleoConfig, NucleoResultado } from "@/lib/flair/nucleos/types";

interface Props {
  config: NucleoConfig;
  avatar: AvatarEstado;
  pecas: Look3dPiece[];
  resultado?: NucleoResultado | null;
  variante?: string | null;
}

const MAX_SILHUETAS = 9;

/** Quadro parado do resultado: a nota e, quando o jogo tem placar, o placar. */
export function QuadroParado({ config, resultado }: { config: NucleoConfig; resultado: NucleoResultado }) {
  const tx = useNucleoText();
  const placar = placarDaCena(config.codigo, resultado);
  return (
    <p className="n3d-scene2d-note n3d-scene-still" data-testid="nucleo-scene-still" role="status">
      {tx.t("flair3d.ui.scene.still", { pontos: Math.round(resultado.pontos), estrelas: resultado.estrelas })}
      {placar && ` · ${tx.t("flair3d.ui.evento.PLACAR", { valor: placar })}`}
    </p>
  );
}

export function Cena2D({ config, avatar, pecas, resultado, variante }: Props) {
  const tx = useNucleoText();
  const sala = salaDe(config.codigo, variante);
  const figurantes = figurantesDaCena(sala, config.personagens);
  const papeis = Array.from(new Set(config.personagens.map((p) => p.papel)));
  const piso = sala.materiais[sala.casca.piso].cor;
  const parede = sala.materiais[sala.casca.fundo ?? sala.casca.parede].cor;
  return (
    <div className="n3d-scene2d" data-testid="nucleo-scene-fallback" data-sala={config.codigo} data-marca={sala.zonas.avatar.marca} role="img"
      aria-label={tx.t("flair3d.ui.scene.aria", { nome: tx.nome(config.codigo) })} style={{ ["--n3d-fundo" as string]: parede, ["--n3d-piso" as string]: piso }}>
      <div className="n3d-scene2d-chars" aria-hidden>
        {figurantes.slice(0, MAX_SILHUETAS).map((p, i) => <span key={i} className="n3d-char" style={{ background: p.cor }} />)}
      </div>
      <div className="n3d-scene2d-avatar" style={{ transform: `rotateY(${avatar.giro}deg) scale(${1 + Math.max(0, avatar.zoom) * 0.08})` }} aria-hidden />
      <p className="n3d-scene2d-note">{tx.t("flair3d.ui.scene.fallback")}</p>
      {resultado && <QuadroParado config={config} resultado={resultado} />}
      {papeis.length > 0 && <p className="n3d-scene2d-cast">{tx.t("flair3d.ui.scene.characters", { lista: papeis.map(tx.papel).join(", ") })}</p>}
      {pecas.length > 0 && <p className="n3d-scene2d-cast">{pecas.map((p) => p.name).join(" · ")}</p>}
    </div>
  );
}

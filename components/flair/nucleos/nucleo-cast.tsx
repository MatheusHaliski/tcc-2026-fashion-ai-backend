"use client";
/** Quem está na partida: a protagonista (avatar do perfil ou modelo da casa, com a troca quando o núcleo aceita) e os figurantes. */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { AvatarTipo, NucleoAvatares } from "@/lib/flair/nucleos/types";

interface Props {
  avatares: NucleoAvatares;
  efetiva: AvatarTipo;
  aceitos: AvatarTipo[];
  temAvatar: boolean;
  onEscolha: (tipo: AvatarTipo) => void;
}

export function NucleoCast({ avatares, efetiva, aceitos, temAvatar, onEscolha }: Props) {
  const tx = useNucleoText();
  const figurantes = avatares.solo.filter((a) => a.tipo === "FIGURANTE");
  const troca = aceitos.includes("PROPRIO") && aceitos.includes("MODELO_CASA") ? aceitos : temAvatar ? ["PROPRIO", "MODELO_CASA"] as AvatarTipo[] : [];
  return (
    <section className="n3d-cast" aria-label={tx.t("flair3d.ui.cast.title")} data-testid="nucleo-cast">
      <p className="n3d-cast-me">{tx.t(`flair3d.ui.cast.${efetiva}`)}</p>
      {!temAvatar && aceitos.includes("PROPRIO") && <p className="n3d-cast-note">{tx.t("flair3d.ui.cast.noAvatar")}</p>}
      {troca.length > 0 && (
        <div className="n3d-cast-switch" role="group" aria-label={tx.t("flair3d.ui.cast.choose")}>
          {troca.map((tipo) => (
            <button key={tipo} type="button" className="btn btn-sm" aria-pressed={efetiva === tipo} disabled={tipo === "PROPRIO" && !temAvatar} onClick={() => onEscolha(tipo)}>
              {tx.t(`flair3d.ui.cast.${tipo}`)}
            </button>
          ))}
        </div>
      )}
      {figurantes.length > 0 && (
        <ul className="n3d-cast-list">
          {figurantes.map((f) => (
            <li key={f.papel}>{tx.t("flair3d.ui.cast.extra", { papel: tx.papel(f.papel), n: f.quantidade })}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

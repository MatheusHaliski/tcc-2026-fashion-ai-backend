"use client";
/**
 * Seletor de câmera do HUD (docs/flair/flair-3d/CAMERAS.md): um botão que diz a câmera em uso e troca para a próxima
 * do jogo. A primeira opção é a automática, que muda sozinha com o momento da partida. Serve a todos os jogos: quem
 * usa passa as opções do jogo (lib/flair/nucleos/camera/jogos.ts, ou as câmeras do campo no Fashion Sports).
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { proximaCamera } from "@/lib/flair/nucleos/camera/jogos";

interface Props {
  opcoes: string[];
  atual: string;
  onTrocar: (id: string) => void;
  className?: string;
}

export function NucleoCameraSelector({ opcoes, atual, onTrocar, className }: Props) {
  const tx = useNucleoText();
  if (opcoes.length < 2) return null;
  const nome = tx.ou(`flair3d.camera.${atual}`, atual);
  const rotulo = tx.t("flair3d.camera.trocar", { nome });
  return (
    <button type="button" className={`n3d-camera-btn${className ? ` ${className}` : ""}`} aria-label={rotulo} title={rotulo} data-testid="nucleo-camera" data-camera={atual}
      onClick={() => onTrocar(proximaCamera(opcoes, atual))}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
        <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h8A2.5 2.5 0 0 1 16 8.5v1.2l4.2-2.4a.6.6 0 0 1 .8.5v8.4a.6.6 0 0 1-.8.5L16 14.3v1.2a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 15.5z" fill="currentColor" />
      </svg>
      <span className="n3d-camera-nome">{nome}</span>
    </button>
  );
}

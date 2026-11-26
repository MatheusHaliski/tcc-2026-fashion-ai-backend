"use client";
/**
 * A cutscene na tela: as faixas de cinema em cima e embaixo, a legenda da tomada (lida pelo leitor de tela) e o botão
 * de pular, que funciona desde o primeiro quadro (também ✕, ○ ou Start no controle e Esc, Enter ou Espaço no
 * teclado, pela tela de jogo). Não é modal: a cena continua atrás. A câmera é da cena 3D (cinema-camera.tsx).
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { CinemaNaTela } from "@/components/flair/cinema/use-cinema-da-partida";

export function CinemaOverlay({ cinema }: { cinema: CinemaNaTela }) {
  const tx = useNucleoText();
  if (!cinema.cutscene) return null;
  const total = cinema.cutscene.tomadas.length;
  return (
    <div className="n3d-cinema" data-testid="cinema" data-gatilho={cinema.cutscene.gatilho}>
      <span className="n3d-cinema-faixa is-cima" aria-hidden />
      <span className="n3d-cinema-faixa is-baixo" aria-hidden />
      <p className="n3d-cinema-legenda" aria-live="polite" data-testid="cinema-legenda">{cinema.fala ? tx.t(cinema.fala) : ""}</p>
      <span className="n3d-cinema-contador" aria-hidden>{cinema.tomada + 1}/{total}</span>
      <button type="button" className="n3d-cinema-pular" onClick={cinema.pular} data-testid="cinema-pular">
        {tx.t("flair3d.cinema.ui.pular")}
      </button>
    </div>
  );
}

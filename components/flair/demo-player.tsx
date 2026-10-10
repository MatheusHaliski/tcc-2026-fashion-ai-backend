"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HubDemo } from "@/lib/flair/hub";
import { useI18n } from "@/lib/i18n/i18n";
import { cn, UiIcon } from "@/components/ui";

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.reduceMotion === "true") return true;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Demonstração do modo escolhido na Central FLAIR: um vídeo curto (MP4 + WebM), sem áudio, em loop, com a capa
 * enquanto carrega. Só a mídia do modo selecionado é montada (o componente é trocado por `key`), então os outros vídeos
 * nunca são baixados. Com preferência por movimento reduzido (do sistema ou do app) abre parado na capa, com o botão
 * "Reproduzir"; se a mídia falhar, fica a capa como alternativa estática. Assistir nunca chama a API nem gasta nada:
 * é um arquivo estático gravado no app em ambiente de teste.
 */
export function DemoPlayer({ demo, title, description, className }: { demo: HubDemo; title: string; description: string; className?: string }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [reduce] = useState(reducedMotion);
  const [playing, setPlaying] = useState(!reduce);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // mantém o estado em dia com o próprio vídeo (autoplay bloqueado, fim de carregamento, erro)
  useEffect(() => {
    const v = video.current; if (!v) return;
    const onPlay = () => setPlaying(true); const onPause = () => setPlaying(false);
    const onReady = () => setReady(true); const onError = () => { setFailed(true); setPlaying(false); };
    v.addEventListener("play", onPlay); v.addEventListener("pause", onPause); v.addEventListener("loadeddata", onReady); v.addEventListener("error", onError);
    if (!reduce) safePlay(v, () => setPlaying(false));
    return () => { v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); v.removeEventListener("loadeddata", onReady); v.removeEventListener("error", onError); };
  }, [reduce, demo.mp4]);

  const toggle = useCallback(() => {
    const v = video.current; if (!v || failed) return;
    if (v.paused) safePlay(v, () => setPlaying(false)); else v.pause();
  }, [failed]);

  const descId = `demo-desc-${demo.mp4.replace(/\W+/g, "-")}`;
  return (
    <figure className={cn("flair-demo", failed && "is-failed", className)} aria-describedby={descId}>
      <div className="flair-demo-frame">
        {!failed && (
          <video ref={video} className={cn("flair-demo-video", !ready && "is-loading")} poster={demo.poster} muted playsInline loop preload={reduce ? "none" : "metadata"}
            aria-label={title} tabIndex={-1} disablePictureInPicture>
            <source src={demo.webm} type="video/webm" />
            <source src={demo.mp4} type="video/mp4" />
          </video>
        )}
        {(failed || !ready) && <img className="flair-demo-poster" src={demo.poster} alt="" aria-hidden onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
        {!failed && (
          <button type="button" className="flair-demo-toggle" onClick={toggle} aria-pressed={playing} aria-label={playing ? t("flair.hub.demo.pause") : t("flair.hub.demo.play")}>
            {playing ? <PauseGlyph /> : <PlayGlyph />}
            <span>{playing ? t("flair.hub.demo.pause") : t("flair.hub.demo.play")}</span>
          </button>
        )}
        {failed && <p className="flair-demo-fallback" role="status"><UiIcon name="info" size={16} />{t("flair.hub.demo.unavailable")}</p>}
      </div>
      <figcaption className="flair-demo-caption">
        <span className="badge">{demo.recorded ? t("flair.hub.demo.recorded") : t("flair.hub.demo.staged")}</span>
        <span className="type-caption text-muted tabular">{t("flair.hub.demo.seconds", { n: demo.seconds })}</span>
        <span id={descId} className="sr-only">{description}</span>
      </figcaption>
    </figure>
  );
}

/** play() devolve uma promessa no navegador (autoplay pode ser negado) e nada em ambientes sem mídia (jsdom). */
function safePlay(v: HTMLVideoElement, onFail: () => void) {
  try { const p = v.play() as Promise<void> | undefined; if (p && typeof p.catch === "function") p.catch(onFail); } catch { onFail(); }
}

function PlayGlyph() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>; }
function PauseGlyph() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>; }

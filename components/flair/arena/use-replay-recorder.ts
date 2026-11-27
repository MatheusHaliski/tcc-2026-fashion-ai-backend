"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { mediaUrl } from "@/lib/api/client";
import type { MatchData } from "@/lib/flair/match-stage";
import { drawFrame, REPLAY_H, REPLAY_W, type ReplayImages, type ReplayTexts } from "@/lib/flair/replay/draw";
import { FPS, frameAt, replayDuration } from "@/lib/flair/replay/timeline";

/** O navegador grava vídeo de um canvas (captureStream + MediaRecorder)? Sem isso o botão nem aparece. */
export function canRecordReplay(): boolean {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return false;
  return typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
}

function pickMime(): string {
  const options = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return options.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
}

/** Imagem com CORS anônimo: a que falhar (ou não permitir CORS) fica de fora e nunca "suja" o canvas da gravação. */
function load(src: string | undefined): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadImages(data: MatchData, scene: string): Promise<ReplayImages> {
  const cards = new Map<string, CanvasImageSource>();
  const all = data.moments.flatMap((m) => [m.a, m.b]).filter((c): c is NonNullable<typeof c> => !!c && !!c.imageUrl);
  await Promise.all(all.map(async (c) => { const img = await load(mediaUrl(c.imageUrl)); if (img) cards.set(c.id, img); }));
  return { scene: await load(scene), cards };
}

export type ReplayState = "idle" | "recording" | "ready" | "error";

/**
 * Grava o vídeo da partida: desenha a linha do tempo (lib/flair/replay) num canvas fora da tela a {@link FPS} quadros
 * por segundo e devolve a URL do vídeo (blob) para assistir e baixar. A URL é liberada ao trocar de partida.
 */
export function useReplayRecorder(data: MatchData | null, scene: string, texts: ReplayTexts) {
  const [state, setState] = useState<ReplayState>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const textsRef = useRef(texts);
  textsRef.current = texts;
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => { setState("idle"); setUrl(null); setProgress(0); }, [data]);

  const record = useCallback(async () => {
    if (!data || !canRecordReplay()) return;
    setState("recording"); setProgress(0);
    try {
      const images = await loadImages(data, scene);
      const canvas = document.createElement("canvas");
      canvas.width = REPLAY_W; canvas.height = REPLAY_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      const mime = pickMime();
      const recorder = new MediaRecorder(canvas.captureStream(FPS), mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      const total = replayDuration(data);
      drawFrame(ctx, frameAt(data, 0), images, textsRef.current);
      recorder.start(250);
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const h = setInterval(() => {
          const t = performance.now() - start;
          drawFrame(ctx, frameAt(data, t), images, textsRef.current);
          setProgress(Math.min(1, t / total));
          if (t >= total) { clearInterval(h); resolve(); }
        }, 1000 / FPS);
      });
      recorder.stop();
      await done;
      setUrl(URL.createObjectURL(new Blob(chunks, { type: mime || "video/webm" })));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [data, scene]);

  return { state, url, progress, record, supported: canRecordReplay() };
}

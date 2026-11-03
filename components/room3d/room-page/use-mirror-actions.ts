import { useEffect, useRef } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import type { RoomInteraction, RoomPlayState } from "@/lib/room3d/interaction";
import type { HandPiece, HandSlot, MirrorSession } from "@/lib/room3d/mirror-session";
import { mirrorLook3d, type MirrorRackPiece } from "@/lib/mirror/mirror-list";
import { loadTexture } from "@/components/three/common";
import type { Api, MirrorState, Room, SetState, Toast, Translate } from "./room-page-model";

/**
 * Peças no espelho do quarto (QUARTO-ESPELHO): levar ao espelho (e chegar segurando uma peça), vestir, tirar e sair da
 * lista — o pedido mais recente vence e a falha mantém a roupa anterior (MirrorSession).
 */
export function useMirrorActions({ data, mirror, engine, session, play, gl, toast, t, goToMirror, arrived, setArrived, setChanged }: {
  data: Room | null; mirror: Api<MirrorState>; engine: RoomInteraction; session: MirrorSession; play: RoomPlayState; gl: boolean | null; toast: Toast; t: Translate;
  goToMirror: () => void; arrived: string | null; setArrived: SetState<string | null>; setChanged: SetState<{ slot: HandSlot; name: string } | null>;
}) {
  const bringing = useRef<string | null>(null);
  /** Leva a peça ao espelho: entra na lista (sem vestir, sem duplicar — o servidor ignora a repetida) e a prova abre. */
  async function bringToMirror(pieceId: string): Promise<MirrorState | null> {
    if (bringing.current === pieceId) return null;               // clique repetido / borda da área: um pedido só
    bringing.current = pieceId;
    try {
      const r = await api.post<MirrorState>("/api/me/mirror/rack", { pieceId });
      mirror.setData(r); setArrived(pieceId);
      if (engine.held === pieceId) engine.consume(pieceId);        // saiu da mão: está na lista do espelho
      goToMirror();
      return r;
    } catch (e) { toast.fromError(e); return null; } finally { bringing.current = null; }
  }
  // chegar ao espelho segurando uma peça: quando a prova abre (zona com histerese da sessão), ela entra na lista UMA vez
  // por aproximação — sair da zona e voltar é outra
  const wasTrying = useRef(false);
  useEffect(() => {
    const trying = session.phase === "tryon" && !!play.held;
    if (trying && !wasTrying.current && play.held) void bringToMirror(play.held);
    wasTrying.current = trying;
  }, [session.phase, play.held]); // eslint-disable-line react-hooks/exhaustive-deps
  /**
   * Falha de uma troca: a mensagem fica na sessão (a prova do quarto 3D a mostra). A vista embutida sem WebGL não tem esse
   * aviso: lá vira um toast — senão o toque (ou o "vestir" de um link) pareceria não fazer nada.
   */
  function failed(n: number, slot: HandSlot, e: unknown) {
    if (session.settle(n, false, slot, Date.now(), e instanceof Error ? e.message : t("common.erro")) && gl === false) toast.fromError(e);
  }
  /** Veste uma peça no espelho: o pedido mais recente prevalece (resposta de pedido antigo é ignorada); falha mantém a roupa anterior. */
  async function wearInMirror(pieceId: string, slot: HandSlot, name: string) {
    const n = session.request(slot);
    try {
      // a roupa anterior fica até a nova estar pronta: a foto (recortada → estúdio) carrega antes do pedido
      const src = mirror.data?.rack?.find((r) => r.id === pieceId) ?? (data?.pieces[pieceId] as MirrorRackPiece | undefined);
      if (src) { const l = mirrorLook3d(src); for (const u of [l.imageUrl, l.studioUrl]) { const m = mediaUrl(u ?? undefined); if (m && await loadTexture(m)) break; } }
      if (n !== session.seq) return;                                // outra escolha chegou durante o carregamento: ela vence
      const r = await api.post<MirrorState>("/api/me/mirror/pieces", { pieceId });
      if (!session.settle(n, true, slot, Date.now())) return;
      mirror.setData(r); engine.consume(pieceId); setChanged({ slot, name });
    } catch (e) { failed(n, slot, e); }
  }
  async function removeFromMirror(p: HandPiece) {
    const n = session.request(p.slot);
    try {
      const r = await api.delete<MirrorState | Record<string, unknown>>(`/api/me/mirror/pieces/${encodeURIComponent(p.id)}`);
      if (!session.settle(n, true, p.slot, Date.now())) return;
      if ((r as MirrorState)?.slots) mirror.setData(r as MirrorState); else await mirror.reload();
      setChanged(null);
    } catch (e) { failed(n, p.slot, e); }
  }
  /** Tirar da lista do espelho: sai da lista (e do corpo, se vestida); nunca sai do guarda-roupa. */
  async function unlist(p: HandPiece) {
    const n = session.request(p.slot);
    try {
      const r = await api.delete<MirrorState>(`/api/me/mirror/rack/${encodeURIComponent(p.id)}`);
      if (!session.settle(n, true, p.slot, Date.now())) return;
      mirror.setData(r); if (arrived === p.id) setArrived(null);
    } catch (e) { failed(n, p.slot, e); }
  }
  return { bringToMirror, wearInMirror, removeFromMirror, unlist };
}

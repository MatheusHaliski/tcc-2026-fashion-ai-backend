"use client";
import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { useWebGL } from "@/components/three/common";
import type { RoomData3D } from "@/components/room3d/room-scene";

const RoomScene = dynamic(() => import("@/components/room3d/room-scene"), { ssr: false, loading: () => null });
const EMPTY = new Set<string>();
const noop = () => undefined;

/** Falha do WebGL/Three durante a renderização vira a cena 2D, sem derrubar a tela do jogo. */
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * Série A (distrito SUITE): a Suíte de Vidro — o quarto da pessoa — como cenário do jogo, só leitura: nada abre, nada
 * é escolhido; os módulos mapeados pelas vagas preenchidas acendem (`lit`). Dados de GET /api/me/room, buscados só com
 * WebGL disponível. Sem WebGL, com erro de carga ou de renderização, cai para a cena 2D (`fallback`).
 */
export function RoomScenario({ lit, night, fallback }: { lit: Set<string>; night?: boolean; fallback: ReactNode }) {
  const { t } = useI18n();
  const webgl = useWebGL();
  const room = useApi<RoomData3D>((signal) => api.get("/api/me/room", { signal }), [], { enabled: webgl === true });
  if (webgl === false || room.error) return <>{fallback}</>;
  if (webgl === null || room.loading || !room.data) return <div className="ge-room room3d-loading" role="status">{t("games.scene.room_loading")}</div>;
  const data: RoomData3D = night ? { ...room.data, ambient: { ...(room.data.ambient ?? {}), period: "night" } } : room.data;
  return (
    <SceneBoundary fallback={fallback}>
      <div className="ge-room" data-testid="ge-room">
        <RoomScene data={data} open={EMPTY} onToggle={noop} highlight={null} focusModule={null} onPick={noop} lit={lit} lightOn={night} />
      </div>
      <p className="ge-room-note">{t("games.scene.room")}</p>
    </SceneBoundary>
  );
}

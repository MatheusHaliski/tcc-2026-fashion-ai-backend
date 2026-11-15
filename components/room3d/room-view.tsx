"use client";
import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { useReducedMotion, useWebGL } from "@/components/three/common";
import type { RoomData3D } from "@/components/room3d/room-scene";

const RoomScene = dynamic(() => import("@/components/room3d/room-scene"), { ssr: false, loading: () => null });
const EMPTY = new Set<string>();
const noop = () => undefined;

/** Falha do WebGL/Three durante a renderização vira o `fallback`, sem derrubar a tela. */
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** "Reduzir movimento" do app ou do sistema também vale para a cena (portas, gavetas e câmera sem animação). */
function withMotion(data: RoomData3D, night: boolean | undefined, reduced: boolean): RoomData3D {
  if (!night && !reduced) return data;
  const ambient = { ...(data.ambient ?? {}) };
  if (night) ambient.period = "night";
  if (reduced) ambient.reduceMotion = true;
  return { ...data, ambient };
}

/**
 * O quarto da pessoa em 3D, só leitura: nada abre, nada é escolhido. Os módulos em `lit` acendem e `focusModule` leva a
 * câmera ao módulo (o item recém-instalado). Dados de GET /api/me/room, buscados só com WebGL disponível. Sem WebGL,
 * com erro de carga ou de renderização, mostra o `fallback`.
 */
export function RoomView({ lit = EMPTY, night, focusModule = null, fallback, note }: {
  lit?: Set<string>; night?: boolean; focusModule?: string | null; fallback: ReactNode; note?: ReactNode;
}) {
  const { t } = useI18n();
  const webgl = useWebGL();
  const reduced = useReducedMotion();
  const room = useApi<RoomData3D>((signal) => api.get("/api/me/room", { signal }), [], { enabled: webgl === true });
  if (webgl === false || room.error) return <>{fallback}</>;
  if (webgl === null || room.loading || !room.data) return <div className="room-view room3d-loading" role="status">{t("room3d.view.loading")}</div>;
  return (
    <SceneBoundary fallback={fallback}>
      <div className="room-view" data-testid="room-view">
        <RoomScene data={withMotion(room.data, night, reduced)} open={EMPTY} onToggle={noop} highlight={null} focusModule={focusModule}
          onPick={noop} lit={lit} lightOn={night} />
      </div>
      {note && <p className="room-view-note">{note}</p>}
    </SceneBoundary>
  );
}

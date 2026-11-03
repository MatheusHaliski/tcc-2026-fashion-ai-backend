import type * as THREE from "three";
import type { RoomGameplay } from "./room-avatar-controller";
import type { SavedView, WallMode } from "@/lib/room3d/camera-views";
import type { CameraOptions, GraphicsQuality } from "@/lib/room3d/room-settings";
import type { RoomInteraction } from "@/lib/room3d/interaction";

/* Dados do Meu Quarto 3D (RF27/RF32) que a página passa à cena (room-scene.tsx) e o contexto das peças na cena. */

export interface RoomPiece3D { id: string; name: string; category: string; subcategory: string; colorHex?: string | null; imageUrl?: string | null; thumbnailUrl?: string | null; model3dUrl?: string | null; address?: string | null; addressLabel?: string | null; moduleId?: string | null; states?: string[]; wearCount?: number; salePrice?: number | null; origin?: string | null; }
export interface RoomModule3D { id: string; slotType: string; label: string; mold?: string | null; capacity?: number; category?: string | null; empty?: boolean; finish?: { model3dUrl?: string | null; color?: string; roughness?: number; metalness?: number; texture?: string; material?: string; kelvin?: number; guided?: boolean; intensity?: number; on?: boolean; artUrl?: string | null; logoUrl?: string | null; labelText?: string | null; creator?: string | null } | null; pieces?: RoomPiece3D[]; lookBoxes?: { id: string; title: string; coverImageUrl?: string | null; lookDoDia?: boolean }[]; accessibleLabel?: string; }
export interface RoomDecoration { type: string; name?: string; days?: number; polaroids?: { schemeId: string; coverImageUrl?: string | null }[]; tapedPieceIds?: string[]; taggedPieceIds?: string[]; theme?: string; }
export interface RoomData3D {
  modules: RoomModule3D[]; pieces: Record<string, RoomPiece3D>; basket?: RoomPiece3D[]; chair?: RoomPiece3D[]; saleRack?: { name: string; pieces: RoomPiece3D[] } | null;
  showcase?: RoomPiece3D[] | unknown; mirrorDailyLook?: { schemeId: string; title: string; coverImageUrl?: string | null } | null; monogram?: string | null;
  ambient?: { period?: string; reduceMotion?: boolean; seasonal?: string | null }; camera?: { zoom?: [number, number]; azimuth?: [number, number]; polar?: [number, number] }; level?: string;
  decorations?: RoomDecoration[]; closetLights?: { score?: number | null; band?: string | null; milestones: { at: number; label: string; lit: boolean }[]; lit: number } | null;
  unboxing?: { inventoryId: string; sku: string; name: string; slotType: string }[]; keys?: { id: string; username: string }[]; light?: { kelvin?: number; guided?: boolean; intensity?: number; on?: boolean } | null;
}
/** Estado do espelho e do Vista-me vindo da página (RF28). */
export interface MirrorOverlay { pieces: { id: string; imageUrl?: string | null }[]; postIt?: string | null; closingKey?: number; celebrate?: boolean;
  /** PROV-2D — a Prévia 2D do Avatar 3D vestindo as peças do espelho (só em memória): o reflexo quando não há personagem
   * andando no quarto (modo foto/órbita); andando, o vidro reflete o próprio personagem */
  reflectionUrl?: string | null;
  /** prova aberta (o personagem está no espelho): o vidro fica só com o reflexo, sem o painel do Look do Dia */
  active?: boolean;
  /** RF28 — botões 3D dentro do vidro: usar o look pendurado, pedir outra sugestão, tirar uma peça */
  onUse?: () => void; onAnother?: () => void; onTakeOneOff?: () => void; }
export interface RoomSceneProps {
  gameplay?: RoomGameplay;
  data: RoomData3D; open: Set<string>; onToggle: (moduleId: string) => void; highlight: string | null; focusModule: string | null;
  onPick: (pieceId: string) => void; onReady?: (canvas: HTMLCanvasElement) => void;
  lit?: Set<string>; mirror?: MirrorOverlay; dark?: boolean; onToggleTheme?: () => void; lightOn?: boolean; lightIntensity?: number; onToggleLight?: () => void; onVistaMe?: () => void; onCopilot?: () => void;
  copilotPoint?: string | null; copilotTalking?: boolean; onKeys?: () => void; onUnbox?: () => void; unboxing?: boolean; onAddToDrawer?: (moduleId: string) => void;
  /** aba Configurações do quarto: câmera e ponto de vista, paredes, ambiente e gráficos (lib/room3d/room-settings.ts) */
  view?: SceneView;
  /** num canto do teto, girar (Q/E, botões) passa ao canto vizinho: a página guarda a escolha */
  onViewStep?: (step: number) => void;
  /** a câmera de agora (para salvar como vista favorita, Shift+1–5) */
  poseRef?: React.MutableRefObject<SavedView | null>;
}

/** O que a aba Configurações muda na cena. */
export interface SceneView {
  camera: CameraOptions; walls: WallMode;
  /** hora do dia (null/auto = a do perfil) e temperatura da lâmpada do teto (null = a do quarto) */
  period?: string | null; kelvin?: number | null;
  quality: GraphicsQuality; dynamicRes: boolean;
  /** textura do reflexo do espelho; null = sem reflexo ao vivo (a prévia 2D do avatar faz o papel) */
  mirror: { width: number; height: number } | null;
  /** movimento reduzido já resolvido (Configurações > sistema/perfil) */
  reduced: boolean;
}

export interface Ctx { highlight: string | null; onPick: (id: string) => void; reduced: boolean; tagged: Set<string>; hanger?: THREE.MeshStandardMaterialParameters; hangerModel?: string | null; engine?: RoomInteraction; }

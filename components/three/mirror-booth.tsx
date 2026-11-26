"use client";
import { FittingStudioLights, FittingStudioRoom } from "@/components/three/fitting-studio-room";
import { resolveFittingStudio } from "@/lib/scene3d/fitting-studio";
import { NEUTRAL_ENVIRONMENT } from "@/lib/tryon/fitting-room";

/** A cabine neutra do FashionAI: a mesma do Provador sem marca (paleta, placa, banco e cabideiro, tapete, spots). */
export const MIRROR_BOOTH = resolveFittingStudio(NEUTRAL_ENVIRONMENT);

/**
 * O reflexo do Espelho dentro da cabine do Provador (RF28): a pessoa está de frente para o espelho na mesma sala da
 * prova — parede pintada com a placa, banco e cabideiro atrás, tapete com a sombra dos pés e a luz neutra de loja (a cor
 * da roupa não muda). Entra no lugar do fundo liso e da luz de retrato do AvatarViewer. A parede do lado da câmera é a
 * do espelho: sai de cena, como no Provador. Nenhum objeto da sala projeta sombra; só o avatar, no tapete.
 */
export function MirrorBooth({ target }: { target: [number, number, number] }) {
  return <>
    <color attach="background" args={[MIRROR_BOOTH.palette.wall]} />
    <fog attach="fog" args={[MIRROR_BOOTH.palette.wall, 9, 18]} />
    <FittingStudioLights light="store" />
    <FittingStudioRoom profile={MIRROR_BOOTH} target={target} references={false} />
  </>;
}

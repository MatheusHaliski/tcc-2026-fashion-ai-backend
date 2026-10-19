"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

import { BrandLogo } from "@/components/brand-logo";
import { Badge, Card, Skeleton } from "@/components/ui";
import type { AvatarView } from "@/components/three/avatar-viewer";
import type { Avatar3dRef } from "@/components/three/common";
import { validateBody } from "@/lib/avatar3d/body-spec";
import { retryImport } from "@/lib/chunk-recovery";
import { useI18n } from "@/lib/i18n/i18n";
import type { FittingCameraApi } from "@/lib/scene3d/orbit-steps";
import type { FittingPlace, FittingWalkApi } from "@/lib/scene3d/fitting-walk";
import type { StoreScene } from "@/lib/scene3d/scene";
import type {
  FittingItem,
  LightMode,
  ResolvedEnvironment,
} from "@/lib/tryon/fitting-room";
import { toLook3d, type Sex, type State } from "@/lib/tryon/fitting-room-model";
import { FittingRemoteControls } from "./fitting-remote-controls";

const FittingRoomScene = dynamic(
  () => retryImport(() => import("@/components/three/fitting-room-scene")),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  }
);

export interface FittingStageProps {
  avatar: Avatar3dRef | null;
  mannequin: State["mannequin"];
  pieces: FittingItem[];
  environment: ResolvedEnvironment;
  scene: StoreScene | null;
  light: LightMode;
  view: AvatarView;
  sex: Sex;
  onCanvas: (canvas: HTMLCanvasElement) => void;
  children: ReactNode;
  /** painel lateral do espelho: aparece quando o avatar chega na frente do vidro (como no espelho do Meu Quarto) */
  mirrorPanel?: (actions: { back: () => void }) => ReactNode;
}

/** Presents the 3D preview; the enclosing fitting room owns its state and actions. */
export function FittingStage({
  avatar,
  mannequin,
  pieces,
  environment,
  scene,
  light,
  view,
  sex,
  onCanvas,
  children,
  mirrorPanel,
}: FittingStageProps) {
  const { t } = useI18n();
  // passos de câmera da cena (botões de girar/aproximar); só existem com a cena 3D montada
  const [camera, setCamera] = useState<FittingCameraApi | null>(null);
  // andar até o espelho / voltar ao centro (só com a cena 3D montada)
  const [walk, setWalk] = useState<FittingWalkApi | null>(null);
  const [place, setPlace] = useState<FittingPlace>("center");
  useEffect(() => walk?.subscribe(setPlace), [walk]);
  const look = useMemo(() => pieces.map(toLook3d), [pieces]);
  const body = avatar ? validateBody(avatar.model?.body)?.params ?? null : null;
  const sceneSex = sex === "UNISEX"
    ? mannequin.sex === "FEMININO" ? "FEMININO" : "MASCULINO"
    : sex;
  const caption = environment.kind === "neutral"
    ? t("tryOn.ambiente_neutro_legenda")
    : environment.others.length
      ? t("tryOn.ambiente_multimarca_legenda", {
          marca: environment.featured.name,
          outras: environment.others.map((brand) => brand.name).join(", "),
        })
      : t("tryOn.ambiente_marca_legenda", { marca: environment.featured.name });

  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3">
        <Badge tone={avatar ? "thread" : "chalk"}>
          {avatar ? t("tryOn.seu_avatar_badge") : t("tryOn.referencia_badge")}
        </Badge>
        <Badge tone="chalk">{t("tryOn.previa_projetada_badge")}</Badge>
        <span
          className="ml-auto flex items-center gap-1.5 type-caption text-muted"
          aria-live="polite"
        >
          {environment.kind !== "neutral" && (
            <BrandLogo
              name={environment.featured.name}
              src={environment.featured.logoUrl}
              size={20}
            />
          )}
          {caption}
        </span>
      </div>

      <div
        className="fitting-stage"
        role="region"
        aria-label={t("tryOn.palco_lojas_aria", {
          n: pieces.length,
          marca: environment.featured.name,
        })}
        style={{ ["--fitting-accent" as string]: environment.featured.accent }}
      >
        {avatar ? (
          <FittingRoomScene
            avatar={avatar}
            sex={sceneSex}
            build={mannequin.build}
            skinTone={null}
            body={body}
            pieces={look}
            environment={environment}
            scene={scene}
            light={light}
            view={view}
            onCanvas={onCanvas}
            onCamera={setCamera}
            onWalk={setWalk}
          />
        ) : (
          <div
            className="grid h-full content-center justify-items-center gap-3 p-6 text-center"
            role="status"
          >
            <p>{t("tryOn.avatar_required")}</p>
            <Link href="/avatar" className="btn btn-sm">
              {t("mirror.criar_avatar")}
            </Link>
          </div>
        )}
        {avatar && camera && <FittingRemoteControls api={camera} walk={walk} />}
        {avatar && walk && place === "mirror" && mirrorPanel && (
          <aside className="fitting-mirror-panel surface" aria-label={t("tryOn.no_espelho")}>
            {mirrorPanel({ back: () => walk.to("center") })}
          </aside>
        )}
      </div>
      {avatar && <p className="px-3 pt-2 type-caption text-muted">{t("tryOn.andar_dica")}</p>}

      <div className="grid gap-2 p-3">{children}</div>
    </Card>
  );
}

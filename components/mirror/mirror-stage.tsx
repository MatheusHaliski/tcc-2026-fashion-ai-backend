"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
import { retryImport } from "@/lib/chunk-recovery";
import { validateBody } from "@/lib/avatar3d/body-spec";
import type { AvatarAdjust, AvatarModel } from "@/lib/avatar3d/model";
import type { Look3dPiece } from "@/components/three/common";
import { mirrorLook3d } from "@/lib/mirror/mirror-list";
import { Skeleton } from "@/components/ui";

const AvatarViewer = dynamic(() => retryImport(() => import("@/components/three/avatar-viewer")), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });
const AvatarStill = dynamic(() => retryImport(() => import("@/components/three/avatar-still")), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });

/**
 * RF28 — Vista-me: o espelho mostra o REFLEXO do Avatar 3D da pessoa (o mesmo do perfil e do provador), vestindo as peças
 * do espelho, em pose natural (respiração e apoio do movimento parado). O que falta no corpo vem das peças padrão do
 * FashionAI (o avatar nunca aparece sem roupa nem descalço). Sem avatar criado, aparece o manequim de referência com o
 * convite para criar o seu. A imagem não é espelhada horizontalmente: o logo das peças continua legível.
 */
export interface MirrorPiece { id: string; name: string; imageUrl?: string | null; thumbnailUrl?: string | null; studioImageUrl?: string | null; category?: string | null; subcategory?: string | null; colorHex?: string | null; variation?: string | null; attributes?: Record<string, string[]> | null }
interface SavedAvatar { exists: boolean; model?: AvatarModel; adjust?: Partial<AvatarAdjust>; textureUrl?: string }

/** Peças vestidas no espelho no formato do 3D — o mesmo do provador (foto, processada, modelagem e dimensões). */
export function mirrorPieces(slots: Record<string, MirrorPiece | MirrorPiece[] | null>): Look3dPiece[] {
  return Object.entries(slots).flatMap(([slot, v]) => (Array.isArray(v) ? v : v ? [v] : []).map((p) => mirrorLook3d(p, slot)));
}

/**
 * O Avatar 3D salvo da pessoa, no formato das cenas: o mesmo do perfil, do espelho, do quarto e da Prévia 2D.
 * Sem avatar, `avatar` é null e as cenas mostram o manequim de referência (com o sexo do cadastro).
 */
export function useMirrorAvatar() {
  const { me } = useAuth();
  const saved = useApi<SavedAvatar>((signal) => api.get("/api/me/avatar3d", { signal }), []);
  const sex: "FEMININO" | "MASCULINO" = me?.sex === "MASCULINO" ? "MASCULINO" : "FEMININO";
  const model = saved.data?.exists ? saved.data.model ?? null : null;
  const adjust = saved.data?.adjust ?? null; const textureUrl = saved.data?.textureUrl ?? null;
  const avatar = useMemo(() => (model ? { model, adjust, textureUrl } : null), [model, adjust, textureUrl]);
  const body = useMemo(() => (avatar ? validateBody(avatar.model?.body)?.params ?? null : null), [avatar]);
  return { loading: saved.loading, error: saved.error, reload: saved.reload, avatar, sex, body };
}

export type MirrorMode = "3d" | "2d";

/** Tom da luz do espelho (temperatura de cor do quarto). */
export function glassTint(kelvin?: number): string {
  if (!kelvin) return "#EEEAE2";
  if (kelvin < 3500) return "#F4E7D2";
  if (kelvin > 5000) return "#E4ECF3";
  return "#EEEAE2";
}

interface MirrorStageProps { slots: Record<string, MirrorPiece | MirrorPiece[] | null>; kelvin?: number; mode?: MirrorMode; children?: React.ReactNode }

/**
 * O espelho em dois modos com o MESMO avatar e as mesmas peças:
 *  - "3d" (Reflexo 3D): a cena viva, com a pose natural do movimento parado;
 *  - "2d" (Prévia 2D): a foto de frente e parada dessa mesma cena (components/three/avatar-still.tsx).
 * As duas precisam de WebGL (a foto da Prévia 2D sai de um Canvas). Com `webgl={false}` (RF32.CA08, aparelho sem
 * WebGL) nenhum Canvas é montado: o vidro mostra as peças vestidas em 2D (MirrorFlatStill) — nunca um palco em branco.
 */
export function MirrorStage({ webgl = true, ...props }: MirrorStageProps & { webgl?: boolean }) {
  return webgl ? <MirrorStage3D {...props} /> : <MirrorFlatStage {...props} />;
}

const FLAT_ORDER = ["outer_layer", "upper", "dress", "lower", "shoes"];
const listOf = (v: MirrorPiece | MirrorPiece[] | null | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/** Sem WebGL: as fotos das peças vestidas, de cima para baixo como no corpo (acessórios numa fileira), sobre o vidro. */
export function MirrorFlatStill({ slots, alt }: { slots: Record<string, MirrorPiece | MirrorPiece[] | null>; alt: string }) {
  const body = [...FLAT_ORDER, ...Object.keys(slots).filter((s) => s !== "accessory" && !FLAT_ORDER.includes(s))].flatMap((s) => listOf(slots[s]));
  const acc = listOf(slots.accessory);
  const src = (p: MirrorPiece) => mediaUrl(p.studioImageUrl ?? p.imageUrl ?? p.thumbnailUrl ?? undefined);
  return (
    <div className="mirror-flat" role="img" aria-label={alt} data-testid="mirror-flat-still">
      {body.length + acc.length === 0 ? (
        // vidro sem peças: a silhueta parada no lugar do avatar
        <svg className="mirror-flat-silhouette" viewBox="0 0 60 160" aria-hidden><circle cx="30" cy="14" r="10" /><path d="M14 30h32l6 52h-8l-3-30v104h-9V96h-4v60h-9V52l-3 30H8z" /></svg>
      ) : (<>
        {body.map((p) => <img key={p.id} src={src(p)} alt="" draggable={false} />)}
        {acc.length > 0 && <span className="mirror-flat-acc">{acc.map((p) => <img key={p.id} src={src(p)} alt="" draggable={false} />)}</span>}
      </>)}
    </div>
  );
}

function MirrorFlatStage({ slots, kelvin, children }: MirrorStageProps) {
  const { t } = useI18n();
  const tint = glassTint(kelvin);
  const n = useMemo(() => Object.values(slots).reduce((k, v) => k + listOf(v).length, 0), [slots]);
  return (
    <div className="mirror-frame" data-mirror-mode="flat">
      <div className="mirror-glass" style={{ background: `radial-gradient(120% 90% at 50% 15%, #ffffff 0%, ${tint} 55%, #d9d4ca 100%)` }}>
        <MirrorFlatStill slots={slots} alt={t("mirror.flat_alt", { n })} />
        <span className="mirror-sheen" aria-hidden />
        {children}
      </div>
    </div>
  );
}

function MirrorStage3D({ slots, kelvin, mode = "3d", children }: MirrorStageProps) {
  const { t } = useI18n();
  const { loading, error, reload, avatar, sex, body } = useMirrorAvatar();
  const tint = glassTint(kelvin);
  const pieces = useMemo(() => mirrorPieces(slots), [slots]);
  return (
    <div className="mirror-frame" aria-label={t("mirror.reflexo_aria")} data-mirror-mode={mode}>
      <div className="mirror-glass" style={{ background: `radial-gradient(120% 90% at 50% 15%, #ffffff 0%, ${tint} 55%, #d9d4ca 100%)` }}>
        {loading ? <Skeleton className="h-full w-full" /> : error ? (
          <button type="button" onClick={reload} className="btn">{t("common.retry")}</button>
        ) : !avatar ? (
          <div className="grid h-full content-center justify-items-center gap-3 p-6 text-center" role="status">
            <p>{t("tryOn.avatar_required")}</p><Link href="/avatar" className="btn btn-sm">{t("mirror.criar_avatar")}</Link>
          </div>
        ) : mode === "2d" ? (
          <AvatarStill avatar={avatar} sex={sex} body={body} pieces={pieces} background={tint} className="mirror-still" alt={t("mirror.previa_2d_alt", { n: pieces.length })} />
        ) : (
          <AvatarViewer avatar={avatar} sex={sex} body={body} pieces={pieces} framing="full" controls={false} view="front" background={tint} />
        )}
        <span className="mirror-sheen" aria-hidden />
        {children}
      </div>
      {!loading && avatar && pieces.length > 0 && <p className="mirror-note">{t("tryOn.previa_3d_nota")}</p>}
    </div>
  );
}

"use client";
import type { FittingCameraApi } from "@/lib/scene3d/orbit-steps";
import { FittingOrbitButtons } from "./fitting-orbit-buttons";

/** Stationary fitting preview: camera rotation and zoom only. */
export function FittingRemoteControls({ api }: { api: FittingCameraApi }) {
  return <div className="fitting-remote surface"><FittingOrbitButtons api={api} /></div>;
}

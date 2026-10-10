"use client";
import { use } from "react";
import { RequireAuth } from "@/components/app-shell";
import { PiecePhotoEditor } from "@/components/photo-edit/piece-photo-editor";

/** RF15 · Editor de fotografia da peça: página própria (não modal), só para o dono da peça. */
export default function PiecePhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = encodeURIComponent(use(params).id);
  return <RequireAuth><PiecePhotoEditor pieceId={id} /></RequireAuth>;
}

"use client";
import { use } from "react";
import { RequireAuth } from "@/components/app-shell";
import { LookCompositionEditor } from "@/components/photo-edit/look-composition-editor";

/** RF15 · Composição do look por camadas (editor de imagem do look): página própria, só para o dono. */
export default function LookPhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = encodeURIComponent(use(params).id);
  return <RequireAuth><LookCompositionEditor schemeId={id} /></RequireAuth>;
}

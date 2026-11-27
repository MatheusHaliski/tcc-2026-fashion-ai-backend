"use client";
import { useMemo, useState } from "react";
import type { SchemeView } from "@/lib/api/types";
import type { BgConfig } from "@/components/background-studio";
import { hasOwnArt } from "@/components/scheme-anatomies";
import { studioOf } from "@/lib/card-art";
import { useUndo } from "@/lib/hooks/use-undo";

export const DEFAULT_ANATOMY = "LISTA_VERTICAL";
export const DEFAULT_PIECE_ANATOMY = "PECA_AMPLIADO";
/** Layout das peças com arte própria (a placa-base LEGO): sai junto quando a arte é limpa. */
const PIECE_OWN_ART = new Set(["LEGO"]);

/**
 * A aparência do look no criador (RF5/RF11), extraída de scheme-builder.tsx: arte do Background Studio, skin, layout do
 * card e layout das peças. "Desfazer" e "Limpar arte" valem para o conjunto arte + layouts: os layouts com arte própria
 * (LEGO, Raio-X, Bento, Cartela sazonal…) desenham a arte deles por cima de tudo, então limpar a arte volta esses
 * layouts ao padrão — antes só a arte do Studio era limpa e o LEGO continuava sobreposto.
 */
export function useSchemeArt(initial?: SchemeView) {
  const [bg, setBg] = useState<BgConfig>(() => { const st = studioOf(initial?.background) as BgConfig; const { photo: _p, ...rest } = st; void _p; return rest; });
  const [skin, setSkin] = useState(initial?.cardSkin ?? "atelier");
  const [anatomy, setAnatomy] = useState(initial?.layoutAnatomy ?? DEFAULT_ANATOMY);
  const [pieceAnatomy, setPieceAnatomy] = useState<string>(((initial?.background as { pieces?: { anatomy?: string } })?.pieces?.anatomy) ?? DEFAULT_PIECE_ANATOMY);
  const art = useMemo(() => ({ bg, anatomy, pieceAnatomy }), [bg, anatomy, pieceAnatomy]);
  const undo = useUndo(art, (a) => { setBg(a.bg); setAnatomy(a.anatomy); setPieceAnatomy(a.pieceAnatomy); });
  const ownArtLayout = hasOwnArt(anatomy) || PIECE_OWN_ART.has(pieceAnatomy);
  const empty = Object.values(bg).every((v) => v == null) && !ownArtLayout;
  const clear = () => {
    setBg({});
    if (hasOwnArt(anatomy)) setAnatomy(DEFAULT_ANATOMY);
    if (PIECE_OWN_ART.has(pieceAnatomy)) setPieceAnatomy(DEFAULT_PIECE_ANATOMY);
  };
  return { bg, setBg, skin, setSkin, anatomy, setAnatomy, pieceAnatomy, setPieceAnatomy, undo, clear, empty };
}

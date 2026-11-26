import { ArtStage, artSurfaceProps } from "@/components/piece-art";
import type { PieceArt } from "@/lib/piece-art";

/** Miniatura das camadas (template e composição): a mesma área artística do card, com um container vazio no lugar do conteúdo. */
export function PieceArtSwatch({ art, bg, pieceHex }: { art: PieceArt; bg?: Record<string, unknown>; pieceHex?: string | null }) {
  const surface = artSurfaceProps(bg ?? null, art, "compact");
  return (
    <span {...surface} className={`fai-card ${surface.className} pae-swatch`} style={{ ...surface.style }}>
      <ArtStage bg={bg ?? null} art={art} density="compact" pieceHex={pieceHex} />
      <span className="pc-frame"><span className="pc-content"><span className="pae-swatch-box" /></span></span>
    </span>
  );
}

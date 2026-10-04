"use client";
import type { Illustration } from "@/lib/capture/capture-guides";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * RF47 · Ilustrações do guia de fotografia: uma peça genérica em traço (nunca uma foto) com as regiões que a IA analisa
 * numeradas e destacadas, o ângulo da câmera (≈90°) e, quando faz sentido, a seta de "vire a peça". Tudo em
 * currentColor/tokens do tema, animação só de realce (respeita reduce motion em globals.css).
 */
type Region = { x: number; y: number; w: number; h: number; r?: number; ellipse?: boolean };
interface Glyph { shape: React.ReactNode; regions: Record<string, Region>; camera?: "front" | "side" | "top"; turn?: boolean; viewBox?: string }

const S = { fill: "var(--surface-2)", stroke: "currentColor", strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const D = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeDasharray: "3 3", opacity: 0.55 };

const GLYPHS: Record<Illustration, Glyph> = {
  tshirt: {
    camera: "front",
    shape: (<>
      <path {...S} d="M66 34 L86 24 Q100 36 114 24 L134 34 L158 58 L140 74 L134 66 L134 170 L66 170 L66 66 L60 74 L42 58 Z" />
      <path {...D} d="M86 24 Q100 44 114 24" strokeDasharray="0" opacity={0.8} />
    </>),
    regions: {
      collar: { x: 82, y: 22, w: 36, h: 20, ellipse: true },
      chest_left: { x: 104, y: 58, w: 24, h: 20, r: 6 },
      chest_right: { x: 72, y: 58, w: 24, h: 20, r: 6 },
      chest_center: { x: 80, y: 86, w: 40, h: 34, r: 8 },
      hem: { x: 66, y: 160, w: 68, h: 12, r: 4 },
      sleeves: { x: 40, y: 50, w: 22, h: 24, r: 6 },
    },
  },
  pants_back: {
    camera: "front", turn: true,
    shape: (<>
      <path {...S} d="M62 30 L138 30 L146 180 L108 180 L100 96 L92 180 L54 180 Z" />
      <path {...D} d="M62 44 L138 44" strokeDasharray="0" opacity={0.8} />
      <path {...D} d="M70 58 L90 58 L88 80 L72 80 Z" strokeDasharray="0" opacity={0.6} />
      <path {...D} d="M110 58 L130 58 L128 80 L112 80 Z" strokeDasharray="0" opacity={0.6} />
    </>),
    regions: {
      waistband: { x: 60, y: 28, w: 80, h: 18, r: 4 },
      patch: { x: 116, y: 30, w: 20, h: 14, r: 3 },
      back_pocket_left: { x: 108, y: 54, w: 26, h: 30, r: 5 },
      back_pocket_right: { x: 66, y: 54, w: 26, h: 30, r: 5 },
      hem: { x: 54, y: 170, w: 92, h: 12, r: 4 },
    },
  },
  sneaker_side: {
    camera: "side",
    shape: (<>
      <path {...S} d="M22 140 Q20 118 44 110 L92 98 Q116 62 150 62 Q166 62 170 84 L172 140 Q172 150 160 150 L34 150 Q22 150 22 140 Z" />
      <path {...D} d="M22 136 L172 136" strokeDasharray="0" opacity={0.8} />
      <path {...D} d="M96 98 L150 68" strokeDasharray="0" opacity={0.6} />
      <path {...D} d="M60 108 Q96 124 128 118" strokeDasharray="0" opacity={0.6} />
    </>),
    regions: {
      side_panel: { x: 58, y: 104, w: 70, h: 28, r: 8 },
      tongue: { x: 104, y: 70, w: 36, h: 24, r: 8 },
      heel: { x: 146, y: 84, w: 24, h: 46, r: 8 },
      midsole: { x: 24, y: 134, w: 146, h: 14, r: 5 },
      toe: { x: 22, y: 112, w: 30, h: 26, r: 8 },
    },
  },
  dress: {
    camera: "front",
    shape: (<>
      <path {...S} d="M74 30 L90 24 Q100 34 110 24 L126 30 L134 70 L124 84 L140 176 L60 176 L76 84 L66 70 Z" />
    </>),
    regions: {
      neckline: { x: 84, y: 22, w: 32, h: 18, ellipse: true },
      chest_center: { x: 82, y: 50, w: 36, h: 28, r: 8 },
      waist: { x: 76, y: 84, w: 48, h: 12, r: 4 },
      hem: { x: 60, y: 166, w: 80, h: 12, r: 4 },
    },
  },
  bag: {
    camera: "front",
    shape: (<>
      <path {...S} d="M48 74 L152 74 L160 170 Q160 178 152 178 L48 178 Q40 178 40 170 Z" />
      <path {...D} d="M74 74 Q74 36 100 36 Q126 36 126 74" strokeDasharray="0" opacity={0.9} strokeWidth={2.2} />
      <path {...D} d="M48 96 L152 96" strokeDasharray="0" opacity={0.6} />
    </>),
    regions: {
      clasp: { x: 86, y: 72, w: 28, h: 14, r: 5 },
      plate: { x: 84, y: 100, w: 32, h: 12, r: 3 },
      logo: { x: 80, y: 118, w: 40, h: 24, r: 8 },
      pattern: { x: 48, y: 146, w: 104, h: 24, r: 6 },
      handles: { x: 70, y: 32, w: 60, h: 40, r: 20 },
    },
  },
  cap: {
    camera: "front",
    shape: (<>
      <path {...S} d="M48 118 Q48 56 100 56 Q152 56 152 118 Z" />
      <path {...S} d="M36 120 L164 120 Q176 134 160 140 L40 140 Q24 134 36 120 Z" />
      <path {...D} d="M100 56 L100 118 M72 64 Q80 90 76 118 M128 64 Q120 90 124 118" strokeDasharray="0" opacity={0.5} />
    </>),
    regions: {
      front_panel: { x: 80, y: 74, w: 40, h: 36, r: 8 },
      side_left: { x: 118, y: 80, w: 28, h: 34, r: 8 },
      side_right: { x: 54, y: 80, w: 28, h: 34, r: 8 },
      brim: { x: 40, y: 122, w: 120, h: 16, r: 6 },
    },
  },
  glasses_side: {
    camera: "side",
    shape: (<>
      <path {...S} d="M30 86 Q30 64 50 64 L60 64 Q70 64 70 80 L70 104 Q70 116 56 116 L42 116 Q30 116 30 104 Z" />
      <path {...S} d="M70 72 L74 72 L170 82 Q178 84 176 92 L172 94 L74 88 Z" />
      <circle cx="74" cy="80" r="3.2" fill="currentColor" />
    </>),
    regions: {
      hinge: { x: 64, y: 68, w: 20, h: 24, r: 6 },
      temple: { x: 90, y: 68, w: 70, h: 26, r: 6 },
      logo: { x: 96, y: 72, w: 22, h: 14, r: 4 },
      model_code: { x: 124, y: 76, w: 40, h: 14, r: 4 },
      lens: { x: 30, y: 64, w: 40, h: 52, r: 10 },
    },
  },
  watch: {
    camera: "front",
    shape: (<>
      <path {...S} d="M82 20 L118 20 L122 56 L78 56 Z M82 180 L118 180 L122 144 L78 144 Z" />
      <circle cx="100" cy="100" r="46" {...S} />
      <circle cx="100" cy="100" r="36" fill="var(--surface)" stroke="currentColor" strokeWidth={1.4} />
      <path d="M100 100 L100 74 M100 100 L118 108" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <rect x="146" y="94" width="8" height="12" rx="2" {...S} />
    </>),
    regions: {
      dial: { x: 66, y: 66, w: 68, h: 68, ellipse: true },
      bezel: { x: 54, y: 54, w: 92, h: 92, ellipse: true },
      crown: { x: 142, y: 90, w: 16, h: 20, r: 4 },
      strap: { x: 80, y: 148, w: 40, h: 30, r: 6 },
    },
  },
  belt: {
    camera: "front",
    shape: (<>
      <path {...S} d="M70 88 L190 88 L190 112 L70 112 Z" />
      <path {...S} d="M28 80 L70 80 L70 120 L28 120 Q18 120 18 110 L18 90 Q18 80 28 80 Z" />
      <path d="M44 80 L44 120" stroke="currentColor" strokeWidth={2.2} />
      <path {...D} d="M96 100 L110 100 M118 100 L132 100" strokeDasharray="0" opacity={0.5} />
    </>),
    regions: {
      buckle: { x: 16, y: 76, w: 58, h: 48, r: 8 },
      logo: { x: 30, y: 90, w: 22, h: 20, r: 5 },
      engraving: { x: 76, y: 90, w: 54, h: 20, r: 5 },
      strap: { x: 134, y: 86, w: 56, h: 28, r: 6 },
    },
  },
  jewelry: {
    camera: "top",
    shape: (<>
      <circle cx="100" cy="112" r="40" fill="none" stroke="currentColor" strokeWidth={9} />
      <circle cx="100" cy="112" r="40" fill="none" stroke="var(--surface-2)" strokeWidth={5} />
      <path {...S} d="M86 58 L100 44 L114 58 L100 76 Z" />
      <path {...D} d="M80 128 Q100 140 120 128" strokeDasharray="0" opacity={0.5} />
    </>),
    regions: {
      stones: { x: 82, y: 42, w: 36, h: 36, r: 8 },
      engraving: { x: 74, y: 118, w: 52, h: 24, r: 8 },
      symbols: { x: 128, y: 96, w: 24, h: 30, r: 6 },
      clasp: { x: 48, y: 96, w: 24, h: 30, r: 6 },
    },
  },
  generic: {
    camera: "front",
    shape: (<>
      <rect x="46" y="40" width="108" height="128" rx="14" {...S} />
      <path {...S} d="M118 40 L148 40 L148 70 Q148 76 142 76 L122 76 Q118 76 118 72 Z" fill="var(--surface)" />
    </>),
    regions: {
      label: { x: 116, y: 38, w: 36, h: 40, r: 6 },
      logo: { x: 76, y: 96, w: 48, h: 30, r: 8 },
    },
  },
};

export function GarmentGlyph({ id, regions = [], size = 200, className, animated = true, numbered = true, title }: {
  id: Illustration; regions?: string[]; size?: number; className?: string; animated?: boolean; numbered?: boolean; title?: string;
}) {
  const { t } = useI18n();
  const g = GLYPHS[id] ?? GLYPHS.generic;
  return (
    <svg viewBox={g.viewBox ?? "0 0 200 200"} width={size} height={size} className={className} role="img" aria-label={title ?? t("pieces.guide.illustration_alt")}>
      <g className="text-ink">{g.shape}</g>
      {regions.map((r, i) => {
        const rg = g.regions[r];
        if (!rg) return null;
        const cls = `guide-region${animated ? " is-animated" : ""}`;
        return (
          <g key={r} className={cls} style={{ animationDelay: `${i * 0.35}s` }}>
            {rg.ellipse ? <ellipse cx={rg.x + rg.w / 2} cy={rg.y + rg.h / 2} rx={rg.w / 2} ry={rg.h / 2} />
              : <rect x={rg.x} y={rg.y} width={rg.w} height={rg.h} rx={rg.r ?? 6} />}
            {numbered && (<>
              <circle cx={rg.x + rg.w - 2} cy={rg.y + 2} r="8" className="guide-region-badge" />
              <text x={rg.x + rg.w - 2} y={rg.y + 5.2} textAnchor="middle" className="guide-region-num">{i + 1}</text>
            </>)}
          </g>
        );
      })}
      {g.camera && <CameraMark kind={g.camera} />}
      {g.turn && <TurnMark />}
    </svg>
  );
}

/** Marca da câmera: perpendicular (90°) à frente, à lateral ou por cima. */
function CameraMark({ kind }: { kind: "front" | "side" | "top" }) {
  const x = kind === "side" ? 150 : 150, y = kind === "top" ? 18 : 18;
  return (
    <g className="guide-camera" transform={`translate(${x} ${y})`}>
      <rect x="0" y="4" width="30" height="20" rx="4" fill="var(--surface)" stroke="currentColor" strokeWidth={1.6} />
      <circle cx="15" cy="14" r="5.5" fill="none" stroke="currentColor" strokeWidth={1.6} />
      <rect x="9" y="0" width="12" height="5" rx="1.5" fill="currentColor" />
      <text x="15" y="36" textAnchor="middle" className="guide-region-num" style={{ fill: "currentColor", fontSize: 9 }}>90°</text>
    </g>
  );
}

/** "Vire a peça": seta curva — a primeira foto da calça é a parte de trás. */
function TurnMark() {
  return (
    <g className="guide-turn" transform="translate(14 150)">
      <path d="M4 20 Q4 4 20 4 L30 4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M26 0 L31 4 L26 8" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

export const GLYPH_REGIONS: Record<Illustration, string[]> = Object.fromEntries(Object.entries(GLYPHS).map(([k, g]) => [k, Object.keys(g.regions)])) as Record<Illustration, string[]>;

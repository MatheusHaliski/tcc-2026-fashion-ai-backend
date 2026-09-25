"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import landTopo from "world-atlas/land-110m.json";
import { tr, useI18n } from "@/lib/i18n/i18n";

/** Centroide aproximado (lon, lat) e nome em português dos países mais comuns no acervo. */
export const COUNTRIES: Record<string, { name: string; at: [number, number] }> = {
  BR: { get name() { return tr("globe.brasil"); }, at: [-51.9, -14.2] }, US: { get name() { return tr("globe.estados_unidos"); }, at: [-98.6, 39.8] }, FR: { get name() { return tr("globe.franca"); }, at: [2.2, 46.2] }, IT: { get name() { return tr("globe.italia"); }, at: [12.6, 42.8] },
  JP: { get name() { return tr("globe.japao"); }, at: [138.3, 36.2] }, PT: { get name() { return tr("globe.portugal"); }, at: [-8.2, 39.4] }, AR: { get name() { return tr("globe.argentina"); }, at: [-63.6, -38.4] }, GB: { get name() { return tr("globe.reino_unido"); }, at: [-3.4, 55.4] },
  MX: { get name() { return tr("globe.mexico"); }, at: [-102.6, 23.6] }, ES: { get name() { return tr("globe.espanha"); }, at: [-3.7, 40.4] }, DE: { get name() { return tr("globe.alemanha"); }, at: [10.5, 51.2] }, CL: { get name() { return tr("globe.chile"); }, at: [-71.5, -35.7] },
  CO: { get name() { return tr("globe.colombia"); }, at: [-74.3, 4.6] }, PE: { get name() { return tr("globe.peru"); }, at: [-75.0, -9.2] }, UY: { get name() { return tr("globe.uruguai"); }, at: [-55.8, -32.5] }, CA: { get name() { return tr("globe.canada"); }, at: [-106.3, 56.1] },
  AU: { get name() { return tr("globe.australia"); }, at: [133.8, -25.3] }, KR: { get name() { return tr("globe.coreia_do_sul"); }, at: [127.8, 35.9] }, CN: { get name() { return tr("globe.china"); }, at: [104.2, 35.9] }, IN: { get name() { return tr("globe.india"); }, at: [78.9, 20.6] },
  ZA: { get name() { return tr("globe.africa_do_sul"); }, at: [22.9, -30.6] }, NG: { get name() { return tr("globe.nigeria"); }, at: [8.7, 9.1] }, NL: { get name() { return tr("globe.holanda"); }, at: [5.3, 52.1] }, SE: { get name() { return tr("globe.suecia"); }, at: [18.6, 60.1] },
  AO: { get name() { return tr("globe.angola"); }, at: [17.9, -11.2] }, MZ: { get name() { return tr("globe.mocambique"); }, at: [35.5, -18.7] }, CH: { get name() { return tr("globe.suica"); }, at: [8.2, 46.8] }, BE: { get name() { return tr("globe.belgica"); }, at: [4.5, 50.5] },
};
export const countryName = (iso: string) => COUNTRIES[iso]?.name ?? iso;

export interface GlobePoint { country: string; total: number; schemes: number; pieces: number; avg_hype?: number | null; dominantColorHex?: string | null; sufficient: boolean; }
const LAND = feature(landTopo as never, (landTopo as unknown as { objects: { land: never } }).objects.land) as unknown as FeatureCollection<Geometry>;

/**
 * RF26.CA01 — globo interativo (projeção ortográfica): arraste para girar, clique num ponto para abrir o país. Cada país
 * com dados suficientes vira um ponto luminoso (tamanho = volume de peças + looks, cor = cor dominante, brilho = hype
 * médio); países abaixo do mínimo aparecem apagados.
 */
export function Globe({ points, selected, onSelect, size = 420 }: { points: GlobePoint[]; selected?: string; onSelect: (iso: string) => void; size?: number }) {
  const { t } = useI18n();
  const [rot, setRot] = useState<[number, number]>([45, -12]);
  const drag = useRef<{ x: number; y: number; r: [number, number] } | null>(null);
  const [interacted, setInteracted] = useState(false);
  const target = useRef<[number, number] | null>(null);
  const projection = useMemo(() => geoOrthographic().scale(size / 2 - 8).translate([size / 2, size / 2]).clipAngle(90).rotate([rot[0], rot[1], 0]), [rot, size]);
  const path = useMemo(() => geoPath(projection), [projection]);
  // gira devagar até o usuário interagir (respeita "reduzir movimento"); ao selecionar, centraliza o país
  useEffect(() => {
    const reduce = typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true");
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - last); last = now;
      setRot((r) => {
        if (target.current) {
          const [tl, tp] = target.current; const dl = ((tl - r[0] + 540) % 360) - 180; const dp = tp - r[1];
          if (Math.abs(dl) < 0.5 && Math.abs(dp) < 0.5) { target.current = null; return [tl, tp]; }
          return [r[0] + dl * 0.12, r[1] + dp * 0.12];
        }
        return interacted || reduce ? r : [r[0] + dt * 0.006, r[1]];
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [interacted]);
  useEffect(() => { const c = selected ? COUNTRIES[selected] : undefined; if (c) { setInteracted(true); target.current = [-c.at[0], -c.at[1] * 0.6]; } }, [selected]);
  const center: [number, number] = [-rot[0], -rot[1]];
  const maxTotal = Math.max(1, ...points.map((p) => p.total));
  const visible = points.filter((p) => COUNTRIES[p.country]).map((p) => ({ p, at: COUNTRIES[p.country].at, xy: projection(COUNTRIES[p.country].at) }))
    .filter((v) => v.xy && geoDistance(v.at, center) < Math.PI / 2 - 0.02);
  return (
    <div className="globe" style={{ width: size, maxWidth: "100%" }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t("globe.globo_interativo_um_ponto_luminoso")}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, r: rot }; setInteracted(true); target.current = null; }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; setRot([d.r[0] + (e.clientX - d.x) * 0.35, Math.max(-60, Math.min(60, d.r[1] - (e.clientY - d.y) * 0.35))]); }}
        onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }} style={{ touchAction: "none", cursor: drag.current ? "grabbing" : "grab" }}>
        <defs>
          <radialGradient id="globe-ocean" cx="40%" cy="35%"><stop offset="0" stopColor="#1f4f7a" /><stop offset="1" stopColor="#0a1c2e" /></radialGradient>
          <radialGradient id="globe-shine" cx="35%" cy="30%"><stop offset="0" stopColor="#fff" stopOpacity=".18" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></radialGradient>
          <filter id="globe-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 8} fill="url(#globe-ocean)" />
        <path d={path(geoGraticule10()) ?? undefined} fill="none" stroke="rgba(160,200,235,.18)" strokeWidth=".6" />
        <path d={path(LAND) ?? undefined} fill="#2c6b5a" stroke="#79b8a0" strokeWidth=".5" />
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 8} fill="url(#globe-shine)" stroke="rgba(160,200,235,.35)" />
        {visible.map(({ p, xy }) => {
          const r = 4 + 12 * Math.sqrt(p.total / maxTotal); const [x, y] = xy as [number, number]; const on = selected === p.country;
          const glow = Math.max(0.35, Math.min(1, (p.avg_hype ?? 30) / 100 + 0.25));
          return (
            <g key={p.country} className={`globe-point ${p.sufficient ? "lit" : "dim"} ${on ? "on" : ""}`} transform={`translate(${x},${y})`} onClick={(e) => { e.stopPropagation(); onSelect(p.country); }} style={{ cursor: "pointer" }}>
              <title>{t("globe.looks_pecas_hype", { countryName: countryName(p.country), schemes: p.schemes, pieces: p.pieces, value: p.avg_hype ?? "—", value2: p.sufficient ? "" : " · poucos dados" })}</title>
              {p.sufficient && <circle r={r * 1.9} fill={p.dominantColorHex ?? "#FFD54A"} opacity={0.22 * glow} className="pulse" />}
              <circle r={p.sufficient ? r : 3.5} fill={p.sufficient ? p.dominantColorHex ?? "#FFD54A" : "#8a96a3"} stroke={on ? "#fff" : "rgba(255,255,255,.75)"} strokeWidth={on ? 2.5 : 1} filter={p.sufficient ? "url(#globe-glow)" : undefined} opacity={p.sufficient ? glow : 0.6} />
              {p.sufficient && <text y={-r - 5} textAnchor="middle" className="globe-label">{p.country}</text>}
            </g>
          );
        })}
      </svg>
      <p className="globe-hint">{t("globe.arraste_para_girar_clique_num")}</p>
    </div>
  );
}

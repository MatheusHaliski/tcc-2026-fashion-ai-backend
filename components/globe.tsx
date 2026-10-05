"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import landTopo from "world-atlas/land-110m.json";
import { tr, useI18n } from "@/lib/i18n/i18n";
import { mediaUrl } from "@/lib/api/client";
import { displayScore, LEVELS } from "@/lib/hype/model";
import { COLUMN_CAP, COLUMN_MAX, COLUMN_W, FIGURE_H, FIGURE_SCALE, FIGURE_STEP, FIGURE_W, columnHeight, countryMarks, figuresFor, hypeShown, metricValue, pickCards, pillWidth, shortName, stackCards, type CardSlot, type CountryMarks, type GlobeLayer, type GlobeMetric } from "@/lib/hype/globe";
import type { HypeGlobe, HypeGlobeCountry, HypeGlobeTop, HypeLevel } from "@/lib/hype/types";

/** Centroide aproximado (lon, lat) e nome em português dos países mais comuns no acervo. */
export const COUNTRIES: Record<string, { name: string; at: [number, number] }> = {
  BR: { get name() { return tr("globe.brasil"); }, at: [-51.9, -14.2] }, US: { get name() { return tr("globe.estados_unidos"); }, at: [-98.6, 39.8] }, FR: { get name() { return tr("globe.franca"); }, at: [2.2, 46.2] }, IT: { get name() { return tr("globe.italia"); }, at: [12.6, 42.8] },
  JP: { get name() { return tr("globe.japao"); }, at: [138.3, 36.2] }, PT: { get name() { return tr("globe.portugal"); }, at: [-8.2, 39.4] }, AR: { get name() { return tr("globe.argentina"); }, at: [-63.6, -38.4] }, GB: { get name() { return tr("globe.reino_unido"); }, at: [-3.4, 55.4] },
  MX: { get name() { return tr("globe.mexico"); }, at: [-102.6, 23.6] }, ES: { get name() { return tr("globe.espanha"); }, at: [-3.7, 40.4] }, DE: { get name() { return tr("globe.alemanha"); }, at: [10.5, 51.2] }, CL: { get name() { return tr("globe.chile"); }, at: [-71.5, -35.7] },
  CO: { get name() { return tr("globe.colombia"); }, at: [-74.3, 4.6] }, PE: { get name() { return tr("globe.peru"); }, at: [-75.0, -9.2] }, UY: { get name() { return tr("globe.uruguai"); }, at: [-55.8, -32.5] }, CA: { get name() { return tr("globe.canada"); }, at: [-106.3, 56.1] },
  AU: { get name() { return tr("globe.australia"); }, at: [133.8, -25.3] }, KR: { get name() { return tr("globe.coreia_do_sul"); }, at: [127.8, 35.9] }, CN: { get name() { return tr("globe.china"); }, at: [104.2, 35.9] }, IN: { get name() { return tr("globe.india"); }, at: [78.9, 20.6] },
  ZA: { get name() { return tr("globe.africa_do_sul"); }, at: [22.9, -30.6] }, NG: { get name() { return tr("globe.nigeria"); }, at: [8.7, 9.1] }, NL: { get name() { return tr("globe.holanda"); }, at: [5.3, 52.1] }, SE: { get name() { return tr("globe.suecia"); }, at: [18.6, 60.1] },
  AO: { get name() { return tr("globe.angola"); }, at: [17.9, -11.2] }, MZ: { get name() { return tr("globe.mocambique"); }, at: [35.5, -18.7] }, CH: { get name() { return tr("globe.suica"); }, at: [8.2, 46.8] }, BE: { get name() { return tr("globe.belgica"); }, at: [4.5, 50.5] },
  // países das regiões do mundo (WorldRegions) que aparecem no acervo e nas sementes (marcas do catálogo, perfis de teste)
  DK: { get name() { return tr("globe.dinamarca"); }, at: [9.5, 56.0] }, NO: { get name() { return tr("globe.noruega"); }, at: [8.5, 60.5] }, FI: { get name() { return tr("globe.finlandia"); }, at: [25.7, 61.9] }, AT: { get name() { return tr("globe.austria"); }, at: [14.6, 47.5] },
  IE: { get name() { return tr("globe.irlanda"); }, at: [-8.2, 53.4] }, PL: { get name() { return tr("globe.polonia"); }, at: [19.1, 51.9] }, GR: { get name() { return tr("globe.grecia"); }, at: [21.8, 39.1] }, NZ: { get name() { return tr("globe.nova_zelandia"); }, at: [174.9, -40.9] },
  TR: { get name() { return tr("globe.turquia"); }, at: [35.2, 39.0] }, AE: { get name() { return tr("globe.emirados_arabes"); }, at: [53.8, 23.4] }, EG: { get name() { return tr("globe.egito"); }, at: [30.8, 26.8] }, MA: { get name() { return tr("globe.marrocos"); }, at: [-7.1, 31.8] },
  KE: { get name() { return tr("globe.quenia"); }, at: [37.9, -0.02] }, CM: { get name() { return tr("globe.camaroes"); }, at: [12.4, 7.4] }, GH: { get name() { return tr("globe.gana"); }, at: [-1.0, 7.9] }, SG: { get name() { return tr("globe.singapura"); }, at: [103.8, 1.35] },
  ID: { get name() { return tr("globe.indonesia"); }, at: [113.9, -0.8] }, TH: { get name() { return tr("globe.tailandia"); }, at: [101.0, 15.9] }, PH: { get name() { return tr("globe.filipinas"); }, at: [121.8, 12.9] }, VN: { get name() { return tr("globe.vietna"); }, at: [108.3, 14.1] },
  EC: { get name() { return tr("globe.equador"); }, at: [-78.2, -1.8] }, VE: { get name() { return tr("globe.venezuela"); }, at: [-66.6, 6.4] }, PY: { get name() { return tr("globe.paraguai"); }, at: [-58.4, -23.4] }, BO: { get name() { return tr("globe.bolivia"); }, at: [-63.6, -16.3] },
  CR: { get name() { return tr("globe.costa_rica"); }, at: [-83.8, 9.7] },
};
export const countryName = (iso: string) => COUNTRIES[iso]?.name ?? iso;

export interface GlobePoint { country: string; total: number; schemes: number; pieces: number; avg_hype?: number | null; dominantColorHex?: string | null; sufficient: boolean; }
const LAND = feature(landTopo as never, (landTopo as unknown as { objects: { land: never } }).objects.land) as unknown as FeatureCollection<Geometry>;

/**
 * Paleta das faixas no globo (sempre sobre o oceano escuro): a mesma família de cores da arte do verso do card (RF53),
 * clareada para o fundo escuro e validada (CVD e visão normal entre faixas vizinhas). Usada SÓ para a faixa — e a faixa
 * vem sempre com o nome em texto (título, rótulo acessível, legenda e tabela). Temas podem trocar por --globe-lvl-*.
 */
export const LEVEL_HEX: Record<HypeLevel, string> = { LOW_SIGNAL: "#7E8794", NICHE: "#3FB98F", RELEVANT: "#8A93FF", HOT: "#FF8A55", TRENDING: "#D27BFF", VIRAL: "#F5C842" };
const slug = (l: HypeLevel) => l.toLowerCase().replace("_", "-");
export const levelColor = (l: HypeLevel | null | undefined) => (l ? `var(--globe-lvl-${slug(l)}, ${LEVEL_HEX[l]})` : "var(--globe-dim, #8a96a3)");
const DIM = "var(--globe-dim, #8a96a3)";

/** Camadas de Hype desenhadas na projeção do globo (giram com ele e somem atrás do horizonte). */
export interface GlobeHypeLayers {
  data: HypeGlobe | null | undefined;
  layers: GlobeLayer[];
  metric: GlobeMetric;
  /** abrir a análise completa do item de destaque (clique no card) */
  onOpen?: (top: HypeGlobeTop, country: string) => void;
}

/** "Reduzir movimento" do sistema ou do app. */
export const reducedMotion = () => typeof window !== "undefined" && (!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true");

/** Cards: largura, altura e a calha lateral onde eles ficam (fora do disco do globo). */
export const CARD_W = 148;
export const CARD_H = 48;
/** A calha deixa folga para o topo das colunas da borda, que tombam um pouco para fora (os cards nunca cobrem a coluna). */
const GUTTER = CARD_W + 24;
/** Abaixo desta largura os cards saem das calhas e viram uma lista numerada sob o globo (legibilidade no celular). */
const NARROW = 560;

/**
 * RF26.CA01 — globo interativo (projeção ortográfica): arraste para girar, clique num ponto para abrir o país. Cada país
 * com dados suficientes vira um ponto luminoso (tamanho = volume de peças + looks, cor = cor dominante, brilho = hype
 * médio); países abaixo do mínimo aparecem apagados.
 *
 * RF53 — com `hype`, o globo ganha camadas de HypeScore desenhadas na mesma projeção: números (Hype médio ou máximo, cor
 * = faixa), colunas em pé (altura = métrica escolhida), bonecos (um por criador, roupa na cor dominante), cards do
 * destaque presos ao país por uma linha e calor (halo pela faixa). Os pontos do painel antigo viram âncoras discretas.
 * Lote A3: colunas em pé com altura na tela proporcional à métrica (mínimo visível para país com dados suficientes),
 * bonecos com o dobro do tamanho e a pílula do número sempre acima da coluna e da cabeça dos bonecos (countryMarks).
 */
export function Globe({ points, selected, onSelect, size = 420, hype }: { points: GlobePoint[]; selected?: string; onSelect: (iso: string) => void; size?: number; hype?: GlobeHypeLayers }) {
  const { t } = useI18n();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [rot, setRot] = useState<[number, number]>([45, -12]);
  const drag = useRef<{ x: number; y: number; r: [number, number] } | null>(null);
  const [interacted, setInteracted] = useState(false);
  const paused = useRef(false);
  const target = useRef<[number, number] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const projection = useMemo(() => geoOrthographic().scale(size / 2 - 8).translate([size / 2, size / 2]).clipAngle(90).rotate([rot[0], rot[1], 0]), [rot, size]);
  const path = useMemo(() => geoPath(projection), [projection]);
  // gira devagar até o usuário interagir (respeita "reduzir movimento"; pausa sob o ponteiro/foco); ao selecionar, centraliza o país
  useEffect(() => {
    const reduce = reducedMotion();
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - last); last = now;
      setRot((r) => {
        if (target.current) {
          const [tl, tp] = target.current; const dl = ((tl - r[0] + 540) % 360) - 180; const dp = tp - r[1];
          if (Math.abs(dl) < 0.5 && Math.abs(dp) < 0.5) { target.current = null; return [tl, tp]; }
          return [r[0] + dl * 0.12, r[1] + dp * 0.12];
        }
        return interacted || reduce || paused.current ? r : [r[0] + dt * 0.006, r[1]];
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [interacted]);
  useEffect(() => { const c = selected ? COUNTRIES[selected] : undefined; if (c) { setInteracted(true); target.current = [-c.at[0], -c.at[1] * 0.6]; } }, [selected]);
  // largura disponível (o pai do globo): decide entre cards nas calhas e a lista sob o globo
  useEffect(() => {
    const el = box.current?.parentElement;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => { const w = entries[0]?.contentRect.width; if (w) setNarrow(w < NARROW); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layers = hype?.layers ?? [];
  const on = (l: GlobeLayer) => !!hype?.data && layers.includes(l);
  const hypeMode = !!hype?.data && layers.length > 0;
  const metric = hype?.metric ?? "avg";
  // as colunas crescem do chão quando o recorte ou a métrica mudam (sem animação com movimento reduzido)
  const growKey = hype?.data && on("columns") ? `${metric}|${hype.data.type}|${hype.data.window}|${JSON.stringify(hype.data.filters ?? {})}` : "";
  const [grow, setGrow] = useState(1);
  useEffect(() => {
    if (!growKey || reducedMotion()) { setGrow(1); return; }
    let raf = 0; const start = performance.now();
    const step = (now: number) => { const p = Math.min(1, (now - start) / 650); setGrow(1 - Math.pow(1 - p, 3)); if (p < 1) raf = requestAnimationFrame(step); };
    setGrow(0); raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [growKey]);

  const center: [number, number] = [-rot[0], -rot[1]];
  const C: [number, number] = [size / 2, size / 2];
  const R = size / 2 - 8;
  const k = size / 420;
  const isFront = (at: [number, number]) => geoDistance(at, center) < Math.PI / 2 - 0.02;
  const maxTotal = Math.max(1, ...points.map((p) => p.total));
  const visible = points.filter((p) => COUNTRIES[p.country]).map((p) => ({ p, at: COUNTRIES[p.country].at, xy: projection(COUNTRIES[p.country].at) }))
    .filter((v) => v.xy && isFront(v.at));

  // ---- camadas de Hype: só os países da frente do globo, desenhados de trás para a frente
  const all = (hype?.data?.countries ?? []).filter((c) => COUNTRIES[c.country]);
  const maxVolume = Math.max(1, ...(hype?.data?.countries ?? []).map((c) => c.count));
  const vis = hypeMode ? all.map((c) => {
    const at = COUNTRIES[c.country].at; const xy = projection(at) as [number, number] | null;
    const shown = hypeShown(c, metric);
    const h = on("columns") ? columnHeight(metricValue(c, metric), metric, maxVolume, c.sufficient) * grow : 0;
    const txt = shown.value != null ? String(displayScore(shown.value)) : "";
    const figs = on("figures") ? figuresFor(c.creators) : { shown: 0, extra: 0 };
    const marks = xy ? countryMarks({ center: C, p: xy, radius: R, h, k, pillW: on("numbers") && txt ? pillWidth(txt, k) : null, figures: figs.shown, extra: figs.extra > 0 }) : null;
    return { c, at, xy, dist: geoDistance(at, center), shown, h, txt, figs, marks, top: marks?.top ?? null };
  }).filter((v) => v.xy && v.dist < Math.PI / 2 - 0.02).sort((a, b) => b.dist - a.dist) as HypeVis[] : [];
  const select = (iso: string) => (e: { stopPropagation: () => void }) => { e.stopPropagation(); onSelect(iso); };
  const cardList = on("cards") ? pickCards(vis.map((v) => ({ country: v.c.country, sufficient: v.c.sufficient, hasTop: !!v.c.top, value: metricValue(v.c, metric) })), selected) : [];
  const anchorOf = (iso: string) => { const v = vis.find((x) => x.c.country === iso)!; return { country: iso, at: v.top as [number, number] }; };
  const gutter = cardList.length > 0 && !narrow;   // booleano: `0 && …` desenhava um "0" solto dentro do <defs>
  // folga acima do disco: colunas, bonecos e pílulas sobem a partir do país (nas laterais, as calhas dos cards já cobrem)
  const rise = Math.max(on("columns") ? COLUMN_MAX * R + COLUMN_CAP * k : 0, on("figures") ? FIGURE_H * FIGURE_SCALE * k : 0);
  const padTop = Math.round(rise + (on("numbers") ? 22 * k : 0));
  const padBottom = hypeMode ? Math.round(8 * k) : 0;
  const padX = gutter ? GUTTER : Math.round(padTop / 2);
  const vb = { x: -padX, y: -padTop, w: size + 2 * padX, h: size + padTop + padBottom };
  // com as calhas, as pílulas ficam entre elas (nunca por baixo de um card)
  const pillMinX = gutter ? -GUTTER + CARD_W + 10 : vb.x + 2; const pillMaxX = gutter ? size + GUTTER - CARD_W - 10 : vb.x + vb.w - 2;
  const width = vb.w;
  const slots: CardSlot[] = gutter
    ? stackCards(cardList.map(anchorOf), { centerX: C[0], leftX: -GUTTER + 6, rightX: size + GUTTER - 6 - CARD_W, cardH: CARD_H, gap: 8, top: vb.y + 6, bottom: vb.y + vb.h - 6 }) : [];
  const openCard = (c: HypeGlobeCountry) => { if (c.top && hype?.onOpen) hype.onOpen(c.top, c.country); else onSelect(c.country); };
  const cardKey = (c: HypeGlobeCountry) => (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(c); } };
  const cardAria = (c: HypeGlobeCountry) => {
    const s = c.top ? hypeShownOf(c.top) : null;
    return t("globeHype.card_aria", { name: c.top?.name ?? "", score: s ? displayScore(s.score) : "—", level: s ? t(`hype.level.${s.level}`) : t("hype.state.insufficient"), country: countryName(c.country) });
  };

  return (
    <div ref={box} className={`globe${hypeMode ? " has-hype" : ""}`} style={{ width, maxWidth: "100%" }}
      onPointerEnter={() => { paused.current = true; }} onPointerLeave={() => { paused.current = false; }}
      onFocus={() => { paused.current = true; }} onBlur={() => { paused.current = false; }}>
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role={hypeMode ? "group" : "img"}
        aria-label={hypeMode ? t("globeHype.aria", { count: all.length }) : t("globe.globo_interativo_um_ponto_luminoso")}
        data-layers={hypeMode ? layers.join(" ") : undefined}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, r: rot }; setInteracted(true); target.current = null; }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; setRot([d.r[0] + (e.clientX - d.x) * 0.35, Math.max(-60, Math.min(60, d.r[1] - (e.clientY - d.y) * 0.35))]); }}
        onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }} style={{ touchAction: "none", cursor: drag.current ? "grabbing" : "grab" }}>
        <defs>
          <radialGradient id="globe-ocean" cx="40%" cy="35%"><stop offset="0" stopColor="#1f4f7a" /><stop offset="1" stopColor="#0a1c2e" /></radialGradient>
          <radialGradient id="globe-shine" cx="35%" cy="30%"><stop offset="0" stopColor="#fff" stopOpacity=".18" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></radialGradient>
          <filter id="globe-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          {on("heat") && LEVELS.map((l) => (
            <radialGradient key={l} id={`${uid}-heat-${slug(l)}`}><stop offset="0" style={{ stopColor: levelColor(l), stopOpacity: l === "VIRAL" ? 0.95 : 0.75 }} /><stop offset="0.45" style={{ stopColor: levelColor(l), stopOpacity: 0.3 }} /><stop offset="1" style={{ stopColor: levelColor(l), stopOpacity: 0 }} /></radialGradient>
          ))}
          {on("columns") && vis.filter((v) => v.h > 0.001).map((v) => (
            <linearGradient key={v.c.country} id={`${uid}-col-${v.c.country}`} gradientUnits="userSpaceOnUse" x1={v.xy[0]} y1={v.xy[1]} x2={v.top[0]} y2={v.top[1]}>
              <stop offset="0" style={{ stopColor: v.c.sufficient ? levelColor(v.shown.level) : DIM, stopOpacity: 0.35 }} /><stop offset="1" style={{ stopColor: v.c.sufficient ? levelColor(v.shown.level) : DIM, stopOpacity: 1 }} />
            </linearGradient>
          ))}
          {gutter && <clipPath id={`${uid}-thumb`}><rect x="5" y="5" width="38" height="38" rx="6" /></clipPath>}
        </defs>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 8} fill="url(#globe-ocean)" />
        <path d={path(geoGraticule10()) ?? undefined} fill="none" stroke="rgba(160,200,235,.18)" strokeWidth=".6" />
        <path d={path(LAND) ?? undefined} fill="#2c6b5a" stroke="#79b8a0" strokeWidth=".5" />
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 8} fill="url(#globe-shine)" stroke="rgba(160,200,235,.35)" />

        {/* calor: halo pela faixa (o viral pulsa em dourado, sem pulso com movimento reduzido) */}
        {on("heat") && (
          <g className="globe-layer globe-layer-heat" aria-hidden="true">
            {vis.map((v) => (
              <circle key={v.c.country} className={`globe-heat${v.c.sufficient ? "" : " is-dim"}${v.c.sufficient && v.shown.level === "VIRAL" ? " is-viral" : ""}`} data-country={v.c.country}
                data-level={v.shown.level ?? undefined} cx={v.xy[0]} cy={v.xy[1]} r={(v.c.sufficient ? 24 : 13) * k}
                fill={v.c.sufficient && v.shown.level ? `url(#${uid}-heat-${slug(v.shown.level)})` : DIM} opacity={v.c.sufficient ? 1 : 0.25} onClick={select(v.c.country)} />
            ))}
          </g>
        )}

        {visible.map(({ p, xy }) => {
          const r = 4 + 12 * Math.sqrt(p.total / maxTotal); const [x, y] = xy as [number, number]; const sel = selected === p.country;
          const glow = Math.max(0.35, Math.min(1, (p.avg_hype ?? 30) / 100 + 0.25));
          return (
            <g key={p.country} className={`globe-point ${p.sufficient ? "lit" : "dim"} ${sel ? "on" : ""}${hypeMode ? " is-anchor" : ""}`} transform={`translate(${x},${y})`} onClick={select(p.country)} style={{ cursor: "pointer" }}>
              <title>{t("globe.looks_pecas_hype", { countryName: countryName(p.country), schemes: p.schemes, pieces: p.pieces, value: p.avg_hype != null ? Math.round(p.avg_hype) : "—", value2: p.sufficient ? "" : t("globe.poucos_dados") })}</title>
              {hypeMode ? <circle r={3 * k} fill={p.dominantColorHex ?? "#FFD54A"} stroke={sel ? "#fff" : "rgba(255,255,255,.6)"} strokeWidth={sel ? 2 : 0.8} opacity={0.75} /> : <>
                {p.sufficient && <circle r={r * 1.9} fill={p.dominantColorHex ?? "#FFD54A"} opacity={0.22 * glow} className="pulse" />}
                <circle r={p.sufficient ? r : 3.5} fill={p.sufficient ? p.dominantColorHex ?? "#FFD54A" : "#8a96a3"} stroke={sel ? "#fff" : "rgba(255,255,255,.75)"} strokeWidth={sel ? 2.5 : 1} filter={p.sufficient ? "url(#globe-glow)" : undefined} opacity={p.sufficient ? glow : 0.6} />
                {p.sufficient && <text y={-r - 5} textAnchor="middle" className="globe-label">{p.country}</text>}
              </>}
            </g>
          );
        })}

        {/* colunas 3D: espigões radiais (altura = métrica, cor = faixa); o topo segue a projeção linear c + (1+h)(p − c) */}
        {on("columns") && (
          <g className="globe-layer globe-layer-columns" aria-hidden="true">
            {vis.filter((v) => v.h > 0.001).map((v) => (
              <g key={v.c.country} className={`globe-col${v.c.sufficient ? "" : " is-dim"}${selected === v.c.country ? " is-selected" : ""}`} data-country={v.c.country} data-level={v.shown.level ?? undefined} onClick={select(v.c.country)}>
                <title>{columnTitle(t, v.c, metric)}</title>
                <line className="globe-col-shaft" x1={v.xy[0]} y1={v.xy[1]} x2={v.top[0]} y2={v.top[1]} stroke={`url(#${uid}-col-${v.c.country})`} strokeWidth={COLUMN_W * k} strokeLinecap="round" />
                <circle className="globe-col-cap" cx={v.top[0]} cy={v.top[1]} r={COLUMN_CAP * k} fill={v.c.sufficient ? levelColor(v.shown.level) : DIM} />
              </g>
            ))}
          </g>
        )}

        {/* seleção de um país que só existe nos dados de Hype */}
        {hypeMode && vis.filter((v) => v.c.country === selected).map((v) => <circle key="sel" className="globe-sel-ring" cx={v.xy[0]} cy={v.xy[1]} r={8 * k} fill="none" stroke="#fff" strokeWidth={2} aria-hidden="true" />)}

        {/* bonecos: um por criador (até 3, depois "+N"), roupa na cor dominante, em pé no país, do lado de dentro da coluna */}
        {on("figures") && (
          <g className="globe-layer globe-layer-figures" aria-hidden="true">
            {vis.map((v, i) => {
              const f = v.marks.figures; const { shown, extra } = v.figs;
              if (!f || !shown) return null;
              const step = FIGURE_STEP * f.scale; const half = (FIGURE_W * f.scale) / 2;
              return (
                <g key={v.c.country} className={`globe-figs${v.c.sufficient ? "" : " is-dim"}`} data-country={v.c.country} data-figures={shown} data-scale={f.scale}
                  transform={`translate(${f.x},${f.y})`} onClick={select(v.c.country)}>
                  <title>{t("globeHype.figures_title", { country: countryName(v.c.country), count: v.c.creators })}</title>
                  <rect className="globe-figs-hit" x={f.box.x - f.x} y={f.box.y - f.y} width={f.box.w} height={f.box.h} fill="transparent" />
                  {Array.from({ length: shown }, (_, j) => (
                    <g key={j} transform={`translate(${f.dir * j * step},0) scale(${f.scale})`}>
                      <g className="globe-fig" style={{ animationDelay: `${((i * 0.37 + j * 0.53) % 2.4).toFixed(2)}s` }}><Figure color={v.c.dominantColorHex} /></g>
                    </g>
                  ))}
                  {extra > 0 && <text className="globe-fig-more" x={f.dir * ((shown - 1) * step + half + 2 * k)} y={-FIGURE_H * f.scale * 0.42} textAnchor={f.dir > 0 ? "start" : "end"} style={{ fontSize: 12 * k }}>{t("globeHype.more", { n: extra })}</text>}
                </g>
              );
            })}
          </g>
        )}

        {/* números: o Hype (médio ou máximo) em texto, numa pílula na cor da faixa; o nome da faixa vai no rótulo */}
        {on("numbers") && (
          <g className="globe-layer globe-layer-numbers">
            {vis.filter((v) => v.marks.pill).map((v) => {
              const box = v.marks.pill!; const txt = v.txt; const w = box.w; const hgt = box.h;
              const px = Math.max(pillMinX + w / 2, Math.min(pillMaxX - w / 2, box.x + w / 2));
              const py = Math.max(vb.y + hgt / 2 + 2, Math.min(vb.y + vb.h - hgt / 2 - 2, box.y + hgt / 2));
              const label = pillLabel(t, v.c, v.shown);
              return (
                <g key={v.c.country} className={`globe-pill${v.c.sufficient ? "" : " is-dim"}${selected === v.c.country ? " is-selected" : ""}`} data-country={v.c.country} data-level={v.shown.level ?? undefined}
                  transform={`translate(${px},${py})`} role="img" aria-label={label} onClick={select(v.c.country)}>
                  <title>{label}</title>
                  <rect className="globe-pill-bg" x={-w / 2} y={-hgt / 2} width={w} height={hgt} rx={hgt / 2} fill={v.c.sufficient ? levelColor(v.shown.level) : DIM} />
                  <text className="globe-pill-text" y={0.5 * k} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11 * k }}>{txt}</text>
                </g>
              );
            })}
          </g>
        )}

        {/* lista estreita: um número no país liga o globo à lista de cards logo abaixo */}
        {narrow && cardList.map((iso, i) => { const m = vis.find((x) => x.c.country === iso)!.marks.marker; return (
          <g key={iso} className="globe-card-marker" transform={`translate(${m[0]},${m[1]})`} aria-hidden="true"><circle r={7 * k} /><text textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 9 * k }}>{i + 1}</text></g>
        ); })}

        {/* cards: o destaque do país numa calha lateral, preso ao país por uma linha; empilhados sem sobreposição */}
        {slots.length > 0 && (
          <g className="globe-layer globe-layer-cards">
            {slots.map((s) => {
              const v = vis.find((x) => x.c.country === s.country)!; const top = v.c.top!; const hs = hypeShownOf(top);
              const ex = s.side === "left" ? s.x + CARD_W : s.x; const ey = s.y + CARD_H / 2;
              return (
                <g key={s.country} className={`globe-card${selected === s.country ? " is-selected" : ""}`} data-country={s.country}>
                  <line className="globe-card-leader" x1={s.anchor[0]} y1={s.anchor[1]} x2={ex} y2={ey} aria-hidden="true" />
                  <circle className="globe-card-dot" cx={s.anchor[0]} cy={s.anchor[1]} r={2.4} aria-hidden="true" />
                  <g className="globe-card-body" role="button" tabIndex={0} aria-label={cardAria(v.c)} transform={`translate(${s.x},${s.y})`} onClick={(e) => { e.stopPropagation(); openCard(v.c); }} onKeyDown={cardKey(v.c)} onPointerDown={(e) => e.stopPropagation()}>
                    <title>{top.name ?? ""}</title>
                    <rect className="globe-card-bg" width={CARD_W} height={CARD_H} rx={8} fill="#fff" stroke={hs ? levelColor(hs.level) : DIM} />
                    <rect className="globe-card-ph" x={5} y={5} width={38} height={38} rx={6} fill="#e9e7df" />
                    {top.imageUrl && <image href={mediaUrl(top.imageUrl)} x={5} y={5} width={38} height={38} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${uid}-thumb)`} />}
                    <text className="globe-card-name" x={49} y={15}>{shortName(top.name, 15)}</text>
                    {hs ? (() => {
                      const chipW = 24 + 6.5 * String(displayScore(hs.score)).length;
                      const room = Math.floor((CARD_W - 49 - chipW - 10) / 5.4);   // caracteres que cabem depois da pílula
                      return <g transform="translate(49,20)">
                        <rect className="globe-card-chip" width={chipW} height={13} rx={6.5} fill={levelColor(hs.level)} />
                        <text className="globe-card-score" x={5} y={10}>{t("globeHype.card_score", { score: displayScore(hs.score) })}</text>
                        <text className="globe-card-level" x={chipW + 5} y={10}>{shortName(t(`hype.level.${hs.level}`), room)}</text>
                      </g>;
                    })() : <text className="globe-card-level" x={49} y={30}>{shortName(t("hype.state.insufficient"), 17)}</text>}
                    <text className="globe-card-meta" x={49} y={43}>{shortName(countryName(s.country), 17)}</text>
                  </g>
                </g>
              );
            })}
          </g>
        )}
      </svg>
      {narrow && cardList.length > 0 && (
        <ol className="globe-cards-list" aria-label={t("globeHype.cards_list")}>
          {cardList.map((iso, i) => {
            const c = vis.find((x) => x.c.country === iso)!.c; const top = c.top!; const hs = hypeShownOf(top);
            return (
              <li key={iso}>
                <button type="button" className={`globe-card-row${selected === iso ? " is-selected" : ""}`} aria-label={cardAria(c)} onClick={() => openCard(c)}>
                  <span className="globe-card-num" aria-hidden="true">{i + 1}</span>
                  <span className="globe-card-thumb" aria-hidden="true">{top.imageUrl && <img src={mediaUrl(top.imageUrl)} alt="" loading="lazy" />}</span>
                  <span className="min-w-0"><span className="globe-card-row-name">{top.name}</span><span className="globe-card-row-meta">{countryName(iso)}</span></span>
                  {hs && <span className="globe-card-row-score"><i style={{ background: levelColor(hs.level) }} aria-hidden="true" /><b className="tabular">{displayScore(hs.score)}</b> {t(`hype.level.${hs.level}`)}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="globe-hint">{t("globe.arraste_para_girar_clique_num")}</p>
    </div>
  );
}

type HypeVis = { c: HypeGlobeCountry; at: [number, number]; xy: [number, number]; dist: number; shown: ReturnType<typeof hypeShown>; h: number; txt: string;
  figs: ReturnType<typeof figuresFor>; marks: CountryMarks; top: [number, number] };
type T = ReturnType<typeof useI18n>["t"];

/** Score e faixa do destaque (só quando disponível). */
function hypeShownOf(top: HypeGlobeTop): { score: number; level: HypeLevel } | null {
  const h = top.hype;
  return h && h.status === "AVAILABLE" && h.score != null && h.level ? { score: h.score, level: h.level } : null;
}

function pillLabel(t: T, c: HypeGlobeCountry, s: ReturnType<typeof hypeShown>) {
  return t("globeHype.pill", {
    country: countryName(c.country), kind: t(`globeHype.metric.${s.kind}`), value: s.value != null ? displayScore(s.value) : "—",
    level: s.level ? t(`hype.level.${s.level}`) : "—", few: c.sufficient ? "no" : "yes",
  });
}

function columnTitle(t: T, c: HypeGlobeCountry, metric: GlobeMetric) {
  const v = metricValue(c, metric);
  return t("globeHype.column_title", { country: countryName(c.country), metric: t(`globeHype.metric.${metric}`), value: v != null ? Math.round(v) : "—" });
}

/** Boneco de ~14 unidades de altura com os pés na origem (desenhado ampliado); a roupa leva a cor dominante do país. */
function Figure({ color }: { color?: string | null }) {
  return (
    <>
      <path className="globe-fig-legs" d="M-1.3 0 L-0.9 -4.4 M1.3 0 L0.9 -4.4" fill="none" stroke="#e9e4da" strokeWidth="1.3" strokeLinecap="round" />
      <path className="globe-fig-arms" d="M-2.5 -8.9 L-3.7 -5.4 M2.5 -8.9 L3.7 -5.4" fill="none" stroke="#e9e4da" strokeWidth="1" strokeLinecap="round" />
      <path className="globe-fig-outfit" d="M-2.3 -9.4 Q0 -10.5 2.3 -9.4 L3.5 -3.9 Q0 -3.1 -3.5 -3.9 Z" fill={color ?? "#FFD54A"} stroke="#ffffff" strokeOpacity=".8" strokeWidth=".7" />
      <circle className="globe-fig-head" cx="0" cy="-12" r="2.1" fill="#e9e4da" />
    </>
  );
}

"use client";
/*
 * MET Gala Heist v2 — mapa (M / Create): a planta do prédio e da rua com o museu em cima (norte). Cada sala na cor de quem
 * pode estar ali (rua, convidados, funcionários, restrita), as salas ainda não visitadas mais apagadas, o labirinto só
 * depois de entrar nele, as portas pela situação (aberta, trancada e com o quê, escalada), a jogadora com a direção, os
 * alvos do subobjetivo e — com a carta de Visão ativa — os seguranças em ciano. Esc, M ou ○ fecham.
 */
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { SimState } from "@/lib/heist/types";
import { DOORS, INNER_WALLS, ROOMS } from "@/lib/heist/level";
import { STEPS, targetsFor } from "@/lib/heist/mission";
import { playerMayPass } from "@/lib/heist/state";
import { PAD, usePad } from "@/lib/input/gamepad";

const VB = { x: -31, z: -25, w: 62, h: 77 };

export function MapPanel({ s, onClose }: { s: SimState; onClose: () => void }) {
  const { t } = useI18n();
  const p = s.player;
  useEffect(() => {
    // captura: o M/Esc que fecha o mapa não chega ao jogo (senão abriria a pausa ou o mapa de novo)
    const onKey = (e: KeyboardEvent) => { if (e.code === "KeyM" || e.code === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  usePad(true, (f) => { if (f.tapped(PAD.circle) || f.tapped(PAD.share)) onClose(); });
  const targets = s.mission.step < STEPS.length ? targetsFor(s, STEPS[s.mission.step].id) : [];
  const vision = s.time < p.visionUntil;
  const mazeKnown = s.visited.includes("servico");
  return <div className="hz-modal hz-map" role="dialog" aria-modal="true" aria-labelledby="hz-map-title">
    <div className="hz-panel hz-map-panel">
      <header className="hz-panel-head">
        <div><p className="hz-eyebrow">{t(`heist.goal.${STEPS[Math.min(s.mission.step, STEPS.length - 1)].goal}`)}</p><h2 id="hz-map-title">{t("heist.map.title")}</h2></div>
        <button type="button" className="hz-btn" onClick={onClose} autoFocus>{t("heist.close")}</button>
      </header>
      <div className="hz-map-body">
        <svg className="hz-map-svg" viewBox={`${VB.x} ${VB.z} ${VB.w} ${VB.h}`} role="img" aria-label={t("heist.map.alt", { room: t(`heist.room.${p.lastRoom}`) })}>
          <defs>
            <pattern id="hz-hatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.35" height="1.2" fill="rgba(255,255,255,.08)" /></pattern>
          </defs>
          {/* avenida e calçadas */}
          <rect x={-30} y={33} width={60} height={10} className="hz-map-road" />
          {ROOMS.map((r) => {
            const seen = s.visited.includes(r.id), here = p.lastRoom === r.id;
            return <g key={r.id} className={cn("hz-map-room", `is-${r.access}`, !seen && "is-unseen", here && "is-here")}>
              <rect x={r.rect.x0} y={r.rect.z0} width={r.rect.x1 - r.rect.x0} height={r.rect.z1 - r.rect.z0} />
              {!seen && <rect x={r.rect.x0} y={r.rect.z0} width={r.rect.x1 - r.rect.x0} height={r.rect.z1 - r.rect.z0} fill="url(#hz-hatch)" />}
              {r.rect.z1 - r.rect.z0 > 2 && <text x={(r.rect.x0 + r.rect.x1) / 2} y={r.id === "servico" ? r.rect.z0 + 1.4 : (r.rect.z0 + r.rect.z1) / 2} textAnchor="middle" dominantBaseline="middle">{t(`heist.room.${r.id}`)}</text>}
            </g>;
          })}
          {mazeKnown && <g className="hz-map-maze">{INNER_WALLS.map((w, i) => <rect key={i} x={w.x0} y={w.z0} width={w.x1 - w.x0} height={w.z1 - w.z0} />)}</g>}
          {DOORS.map((d) => {
            const open = s.doors[d.id] || playerMayPass(s, d);
            const kind = d.lock === "climb" ? "climb" : d.lock === "vent" ? "vent" : open ? "open" : "locked";
            return <rect key={d.id} className={cn("hz-map-door", `is-${kind}`)} x={d.rect.x0 - 0.15} y={d.rect.z0 - 0.15} width={d.rect.x1 - d.rect.x0 + 0.3} height={d.rect.z1 - d.rect.z0 + 0.3}>
              <title>{t(`heist.doorName.${d.id}`)} — {t(`heist.map.door.${kind}`)}{kind === "locked" ? ` (${t(`heist.lock.${d.lock}`)})` : ""}</title>
            </rect>;
          })}
          {targets.map((tg, i) => <g key={i} className={cn("hz-map-target", tg.main && "is-main")} transform={`translate(${tg.pos.x} ${tg.pos.z})`}>
            <path d="M0 -1.3 L1.3 0 L0 1.3 L-1.3 0 Z" /><title>{t(tg.key)}</title>
          </g>)}
          {vision && s.guards.filter((g) => g.active && g.state !== "DOWN").map((g) => <circle key={g.id} className={cn("hz-map-guard", g.state === "ALERT" && "is-alert")} cx={g.pos.x} cy={g.pos.z} r={0.55} />)}
          {/* a jogadora: seta na direção em que ela olha (yaw 0 = +z, para baixo no mapa) */}
          <g className="hz-map-me" transform={`translate(${p.pos.x} ${p.pos.z}) rotate(${(-p.yaw * 180) / Math.PI})`}>
            <path d="M0 1.6 L1 -1 L0 -0.4 L-1 -1 Z" />
          </g>
        </svg>
        <aside className="hz-map-legend">
          <h3>{t("heist.map.legend")}</h3>
          <ul>
            {(["street", "public", "staff", "private"] as const).map((a) => <li key={a}><i className={`hz-sw is-${a}`} aria-hidden />{t(`heist.map.access.${a}`)}</li>)}
            {(["open", "locked", "climb", "vent"] as const).map((k) => <li key={k}><i className={`hz-sw door is-${k}`} aria-hidden />{t(`heist.map.door.${k}`)}</li>)}
            <li><i className="hz-sw target" aria-hidden />{t("heist.map.target")}</li>
            {vision && <li><i className="hz-sw guard" aria-hidden />{t("heist.map.guards")}</li>}
          </ul>
          <h3>{t("heist.map.now")}</h3>
          <p>{t(`heist.step.${STEPS[Math.min(s.mission.step, STEPS.length - 1)].id}`)}</p>
          <ul className="hz-map-targets">{targets.map((tg, i) => <li key={i} className={cn(tg.main && "is-main")}>{t(tg.key)}</li>)}</ul>
          {!mazeKnown && <p className="hz-fine">{t("heist.map.mazeUnknown")}</p>}
          {!vision && <p className="hz-fine">{t("heist.map.visionHint")}</p>}
        </aside>
      </div>
    </div>
  </div>;
}

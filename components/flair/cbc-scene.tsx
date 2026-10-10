"use client";
import type { CSSProperties, ReactNode } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { sceneOf, slotPosition, type CbcSlot, type CbcSlotResult, type Scene, type SceneProp } from "@/lib/flair/cbc";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { cn } from "@/components/ui";

/**
 * Cenário 2D dos Desafios de Montagem (FLAIR-UT §7.3): fundo, objetos e vagas em camadas SVG. A arte é decorativa
 * (aria-hidden); quem descreve a cena são as vagas, que são botões de verdade, e a história escrita ao lado. No celular
 * as vagas saem do desenho e viram uma grade embaixo (a cena fica com marcadores numerados).
 */
export function CbcSceneArt({ scenario, className, pins }: { scenario: string; className?: string; pins?: { n: number; x: number; y: number; lit: boolean }[] }) {
  const scene = sceneOf(scenario);
  const gid = `cbc-sky-${scenario}`;
  return (
    <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" className={cn("cbc-art", className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={scene.sky[0]} /><stop offset="1" stopColor={scene.sky[1]} /></linearGradient>
      </defs>
      <rect x="0" y="0" width="160" height="100" fill={`url(#${gid})`} />
      <rect x="0" y={scene.horizon} width="160" height={100 - scene.horizon} fill={scene.ground} />
      {scene.props.map((p, i) => <Prop key={i} p={p} scene={scene} />)}
      {pins?.map((p) => (
        <g key={p.n} className={cn("cbc-pin", p.lit && "is-lit")} transform={`translate(${(p.x / 100) * 160} ${p.y})`}>
          <circle r="4.2" fill={p.lit ? scene.accent : "#FFFFFF"} stroke="#111" strokeWidth="0.6" />
          <text y="1.6" textAnchor="middle" fontSize="4.6" fontWeight="700" fill={p.lit ? "#FFFFFF" : "#111"}>{p.n}</text>
        </g>
      ))}
    </svg>
  );
}

function Prop({ p, scene }: { p: SceneProp; scene: Scene }): ReactNode {
  const s = p.s ?? 1;
  const at = (x: number, y: number) => `translate(${x} ${y}) scale(${s})`;
  switch (p.k) {
    case "sun": return <g transform={at(p.x, p.y)}><circle r="8" fill="#FFD166" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="0" y1="-11" x2="0" y2="-14" stroke="#FFD166" strokeWidth="1.2" transform={`rotate(${a})`} />)}</g>;
    case "moon": return <g transform={at(p.x, p.y)}><circle r="8" fill="#F4EFD8" /><circle cx="3.5" cy="-2" r="7" fill={scene.sky[0]} /></g>;
    case "waves": return <path d={`M0 ${p.y} q10 -3 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V${p.y + 6} H0Z`} fill="#4FA3D1" opacity="0.85" />;
    case "umbrella": return <g transform={at(p.x, p.y)}><line x1="0" y1="0" x2="0" y2="-20" stroke="#5B4636" strokeWidth="1" /><path d="M-14 -20 A14 9 0 0 1 14 -20 Z" fill={scene.accent} /><path d="M-5 -20 A5 9 0 0 1 5 -20 Z" fill="#FFFFFF" opacity="0.8" /></g>;
    case "building": return <g transform={at(p.x, p.y)}><rect x="0" y="-36" width="26" height="36" fill="#E3D5C3" stroke="#B9A88F" strokeWidth="0.5" />{[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={3 + c * 8} y={-32 + r * 8} width="4" height="5" fill="#8FA9C4" />))}</g>;
    case "tree": return <g transform={at(p.x, p.y)}><rect x="-1.5" y="-12" width="3" height="12" fill="#6B4A2F" /><circle cy="-17" r="9" fill="#5E9E5A" /><circle cx="-5" cy="-13" r="6" fill="#4F8A4C" /></g>;
    case "flower": return <g transform={at(p.x, p.y)}><line x1="0" y1="0" x2="0" y2="-7" stroke="#4F8A4C" strokeWidth="0.8" />{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx="0" cy="-10.5" r="2" fill={scene.accent} transform={`rotate(${a} 0 -8)`} />)}<circle cy="-8" r="1.4" fill="#FFD166" /></g>;
    case "stage": return <g transform={at(p.x, p.y)}><rect x="-34" y="-30" width="68" height="26" fill="#1E1A2E" /><path d="M-40 -4 H40 L34 6 H-34 Z" fill="#5A4A7A" /><path d="M-20 -30 L-30 -4 H-10 Z" fill="#FFD166" opacity="0.25" /><path d="M20 -30 L10 -4 H30 Z" fill="#FFD166" opacity="0.25" /></g>;
    case "lights": return <g>{Array.from({ length: 17 }, (_, i) => <circle key={i} cx={i * 10} cy={p.y + (i % 2) * 2} r="1.4" fill={i % 3 === 0 ? "#FFD166" : i % 3 === 1 ? "#FF6F91" : "#8FE3CF"} />)}<path d={`M0 ${p.y} ${Array.from({ length: 16 }, (_, i) => `Q${i * 10 + 5} ${p.y + 4} ${(i + 1) * 10} ${p.y}`).join(" ")}`} stroke="#333" strokeWidth="0.3" fill="none" /></g>;
    case "arch": return <g transform={at(p.x, p.y)}><path d="M-14 0 V-18 A14 14 0 0 1 14 -18 V0" stroke="#FFFFFF" strokeWidth="2.4" fill="none" />{[-14, -10, -4, 4, 10, 14].map((x, i) => <circle key={i} cx={x} cy={-18 - Math.sqrt(Math.max(0, 196 - x * x)) * 0.95} r="1.8" fill={scene.accent} />)}</g>;
    case "table": return <g transform={at(p.x, p.y)}><rect x="-12" y="-10" width="24" height="2.4" fill="#7A5C3E" /><rect x="-10" y="-8" width="1.6" height="8" fill="#7A5C3E" /><rect x="8.4" y="-8" width="1.6" height="8" fill="#7A5C3E" /><circle cx="0" cy="-12" r="1.8" fill={scene.accent} /></g>;
    case "tower": return <g transform={at(p.x, p.y)} stroke="#4A4A4A" strokeWidth="0.9" fill="none"><path d="M-12 0 Q-4 -18 -1 -44 M12 0 Q4 -18 1 -44" /><path d="M-8 -12 H8 M-5 -24 H5 M-2.6 -34 H2.6" /><path d="M-7 0 A7 6 0 0 1 7 0" /></g>;
    case "river": return <path d={`M${p.x} ${p.y} q12 -3 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 V${p.y + 8} H${p.x}Z`} fill="#6FA8D6" opacity="0.8" />;
    case "mountain": return <g transform={at(p.x, p.y)}><path d="M-34 0 L0 -40 L34 0 Z" fill="#8A97B3" /><path d="M-9 -29 L0 -40 L9 -29 L4 -31 L0 -27 L-4 -31 Z" fill="#FFFFFF" /></g>;
    case "snow": return <g fill="#FFFFFF" opacity="0.9">{[[12, 10], [30, 22], [52, 8], [70, 30], [88, 14], [104, 26], [122, 6], [140, 20], [150, 36], [20, 40], [62, 44], [96, 48]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1" />)}</g>;
    case "fire": return <g transform={at(p.x, p.y)}><path d="M0 0 C-6 -4 -4 -10 0 -16 C4 -10 6 -4 0 0 Z" fill="#F28C28" /><path d="M0 0 C-3 -3 -2 -7 0 -10 C2 -7 3 -3 0 0 Z" fill="#FFD166" /></g>;
    case "pumpkin": return <g transform={at(p.x, p.y)}><ellipse rx="7" ry="5.5" fill="#F28C28" /><ellipse rx="2.6" ry="5.5" fill="#E0761A" /><rect x="-0.8" y="-8" width="1.6" height="3" fill="#4F8A4C" /></g>;
    case "house": return <g transform={at(p.x, p.y)}><rect x="0" y="-22" width="26" height="22" fill="#2E2340" /><path d="M-3 -22 L13 -36 L29 -22 Z" fill="#3B2C52" /><rect x="5" y="-16" width="5" height="5" fill="#FFD166" /><rect x="16" y="-16" width="5" height="5" fill="#FFD166" opacity="0.6" /></g>;
    case "confetti": return <g>{Array.from({ length: 28 }, (_, i) => <rect key={i} x={(i * 37) % 160} y={(i * 23) % 62} width="2" height="1" fill={["#FFFFFF", "#1BB5A5", "#5A3FA8", "#FF6F91"][i % 4]} transform={`rotate(${(i * 47) % 180} ${(i * 37) % 160} ${(i * 23) % 62})`} />)}</g>;
    case "runway": return <g><path d={`M${p.x - 6} ${p.y} H${p.x + 6} L${p.x + 34} 100 H${p.x - 34} Z`} fill="#EDEDED" opacity="0.9" /><path d={`M${p.x} ${p.y} V100`} stroke="#BDBDBD" strokeWidth="0.4" strokeDasharray="2 2" /></g>;
    case "rack": return <g transform={at(p.x, p.y)}><path d="M-14 0 V-26 H14 V0" stroke="#5B4636" strokeWidth="1" fill="none" />{[-9, -1, 7].map((x, i) => <path key={i} d={`M${x} -26 l-4 4 v12 h8 v-12 z`} fill={i === 1 ? scene.accent : i === 0 ? "#C9B79C" : "#8FA9C4"} />)}</g>;
    case "mirror": return <g transform={at(p.x, p.y)}><ellipse cy="-16" rx="7" ry="13" fill="#DCE8F0" stroke="#B9975B" strokeWidth="1.4" /><rect x="-1" y="-3" width="2" height="3" fill="#B9975B" /></g>;
    case "carpet": return <path d={`M0 100 L60 ${p.y} H76 L44 100 Z`} fill="#A3122A" />;
    case "stairs": return <g transform={at(p.x, p.y)} fill="#5A4A7A">{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 6} y={-(i + 1) * 5} width={30 - i * 6} height="5" />)}</g>;
    case "door": return <g transform={at(p.x, p.y)}><rect x="0" y="-26" width="14" height="26" fill="#7A5C3E" /><circle cx="11" cy="-12" r="0.9" fill="#FFD166" /></g>;
    case "window": return <g transform={at(p.x, p.y)}><rect x="0" y="0" width="20" height="14" fill="#BFD4E8" stroke="#FFFFFF" strokeWidth="1" /><path d="M10 0 V14 M0 7 H20" stroke="#FFFFFF" strokeWidth="0.8" /></g>;
    case "calendar": return <g transform={at(p.x, p.y)}><rect x="0" y="0" width="144" height="12" rx="2" fill={scene.accent} opacity="0.85" />{Array.from({ length: 7 }, (_, i) => <rect key={i} x={2 + i * 20.3} y="16" width="18" height="60" rx="2" fill="#FFFFFF" stroke="#D3D7DF" strokeWidth="0.5" />)}</g>;
    case "bag": return <g transform={at(p.x, p.y)}><rect x="-6" y="-10" width="12" height="10" fill={scene.accent} /><path d="M-3 -10 A3 3 0 0 1 3 -10" stroke="#333" strokeWidth="0.6" fill="none" /></g>;
    default: return null;
  }
}

export interface PlacedCard { card: FlairCollectionCard }

/** O palco do desafio: arte + vagas. Cada vaga é um botão (abre a escolha de carta) com rótulo, posição pedida e estado. */
export function CbcScene({ scenario, slots, placed, results, labelOf, onPick, readOnly }: {
  scenario: string; slots: { key: string; position: string; label?: string | null }[]; placed: Record<string, FlairCollectionCard | undefined>;
  results?: CbcSlotResult[]; labelOf: (slot: CbcSlot | { key: string; position: string; label?: string | null }) => string; onPick?: (slot: string) => void; readOnly?: boolean;
}) {
  const { t } = useI18n();
  const scene = sceneOf(scenario);
  const bySlot = new Map((results ?? []).map((r) => [r.slot, r]));
  const pins = slots.map((s, i) => { const [x, y] = slotPosition(scene, s.key, i, slots.length); return { n: i + 1, x, y, lit: !!placed[s.key] }; });
  return (
    <div className="cbc-stage" style={{ "--cbc-accent": scene.accent } as CSSProperties}>
      <div className="cbc-stage-art"><CbcSceneArt scenario={scenario} pins={pins} /></div>
      <ol className="cbc-slots" aria-label={t("cbc.slots_label")}>
        {slots.map((s, i) => {
          const [x, y] = slotPosition(scene, s.key, i, slots.length);
          const c = placed[s.key]; const r = bySlot.get(s.key); const label = labelOf(s);
          const pos = s.position === "ANY" ? t("cbc.position.ANY") : t(`cbc.position.${s.position}`);
          const state = c ? t("cbc.slot.filled", { name: c.name, sintonia: r?.sintonia ?? 0 }) : t("cbc.slot.empty");
          const body = (
            <>
              <span className="cbc-slot-n" aria-hidden>{i + 1}</span>
              {c ? (
                <span className={cn("cbc-slot-card", `tier-${c.tier.toLowerCase()}`)}>
                  {c.imageUrl ? <img src={mediaUrl(c.imageUrl)} alt="" loading="lazy" decoding="async" /> : null}
                  <b className="tabular">{c.ovr}</b>
                </span>
              ) : <span className="cbc-slot-empty" aria-hidden>{s.position === "ANY" ? "★" : s.position}</span>}
              <span className="cbc-slot-label">{label}</span>
              {c && r && <span className="cbc-slot-sync" aria-hidden>{"●".repeat(r.sintonia)}{"○".repeat(3 - r.sintonia)}</span>}
            </>
          );
          return (
            <li key={s.key} className={cn("cbc-slot", c && "is-filled", r && r.sintonia >= 2 && "is-lit")} style={{ "--x": `${x}%`, "--y": `${y}%` } as CSSProperties}>
              {readOnly || !onPick ? <div className="cbc-slot-btn" aria-label={`${label} · ${pos} · ${state}`}>{body}</div>
                : <button type="button" className="cbc-slot-btn" onClick={() => onPick(s.key)} aria-label={`${label} · ${pos} · ${state}`}>{body}</button>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

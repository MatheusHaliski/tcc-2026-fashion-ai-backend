"use client";
/*
 * MET Gala Heist v2 — roda de itens (Tab / L1 segurado): o tempo quase para enquanto ela está aberta. Oito fatias:
 * mãos, faca, pistola, cura, garrafa, recarregar, cartas (abre o deck da partida) e roupa (uniforme, vestido de chegada e
 * as cartas de vestir). A direção do mouse ou do analógico escolhe; soltar usa. Itens que ela não tem ficam apagados.
 */
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";

export type WheelSlot = "hands" | "knife" | "pistol" | "heal" | "bottle" | "reload" | "cards" | "outfit";
export const WHEEL: WheelSlot[] = ["pistol", "knife", "hands", "outfit", "cards", "bottle", "heal", "reload"];
export interface WheelInfo { has: Record<WheelSlot, boolean>; count: Partial<Record<WheelSlot, string>>; current: WheelSlot | null }

/** Fatia na direção `angle` (0 = para cima, sentido horário). */
export function slotAt(angle: number): WheelSlot {
  const n = WHEEL.length, a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return WHEEL[Math.round(a / ((Math.PI * 2) / n)) % n];
}

export function ItemWheel({ info, hover, onPick }: { info: WheelInfo; hover: WheelSlot | null; onPick: (s: WheelSlot) => void }) {
  const { t } = useI18n();
  const n = WHEEL.length;
  return <div className="hz-wheel" role="menu" aria-label={t("heist.wheel.title")}>
    <div className="hz-wheel-ring">
      {WHEEL.map((slot, i) => {
        const a = (i / n) * Math.PI * 2, x = Math.sin(a) * 128, y = -Math.cos(a) * 128;
        return <button key={slot} type="button" role="menuitem" disabled={!info.has[slot]} onClick={() => onPick(slot)}
          className={cn("hz-wheel-slot", hover === slot && "is-hover", info.current === slot && "is-current")}
          style={{ transform: `translate(${x}px, ${y}px)` }}>
          <span className="hz-wheel-icon" aria-hidden>{ICON[slot]}</span>
          <span className="hz-wheel-label">{t(`heist.wheel.${slot}`)}</span>
          {info.count[slot] && <span className="hz-wheel-count">{info.count[slot]}</span>}
        </button>;
      })}
      <p className="hz-wheel-center">{hover ? t(`heist.wheel.${hover}.hint`) : t("heist.wheel.hint")}</p>
    </div>
  </div>;
}
const ICON: Record<WheelSlot, string> = { hands: "✊", knife: "🗡", pistol: "⌐", heal: "✚", bottle: "🍾", reload: "⟳", cards: "🂠", outfit: "👗" };

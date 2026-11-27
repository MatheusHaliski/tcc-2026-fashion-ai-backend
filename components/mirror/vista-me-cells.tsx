"use client";
import { useState } from "react";
import { Chip, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { FaiIcon } from "@/components/fai-icon";

/*
 * Vista-me sem campo de texto (RF28): um toque numa ocasião monta o look. As células têm o mesmo formato da grade de
 * marcas do Provador (.fitting-stores · .fitting-store: ícone em cima, nome em negrito, legenda). O pedido enviado é o
 * rótulo no idioma da pessoa — o servidor entende as ocasiões, o humor e o clima em pt, en e es (MirrorService.KEYWORDS
 * e a interpretação local) e a IA lê o mesmo texto. Humor e clima são opcionais e se somam ao pedido.
 * Texto livre continua no Copilot (Busto); aqui só botões.
 */
export const OCCASIONS = ["work", "college", "dinner", "date", "party", "gym", "beach", "trip", "home", "walk"] as const;
export type Occasion = (typeof OCCASIONS)[number];
/** Ícones FAI da família OCC (mesma medalha, moldura e traçado dos demais; scripts/icons/fai_occasion_icons.py). */
const OCCASION_ICON: Record<Occasion | "surprise" | "repeat", string> = { work: "OCC-01", college: "OCC-02", dinner: "OCC-03", date: "OCC-04", party: "OCC-05", gym: "OCC-06", beach: "OCC-07", trip: "OCC-08", home: "OCC-09", walk: "OCC-10", surprise: "OCC-11", repeat: "OCC-12" };
const MOODS = ["comfortable", "elegant"] as const;
const WEATHER = ["cold", "hot"] as const;

/** O pedido no idioma da pessoa: ocasião + humor + clima (vazio = "Surpreenda-me"). */
export function vistaPrompt(t: (k: string) => string, occasion: Occasion | null, mood: string | null, weather: string | null): string {
  return [occasion && t(`mirror.vista.ocasiao.${occasion}`), mood && t(`mirror.vista.humor.${mood}`), weather && t(`mirror.vista.clima.${weather}`)].filter(Boolean).join(", ");
}

export function VistaMeCells({ busy, lastPrompt, pinnedCount = 0, onRun }: {
  busy: boolean;
  /** último pedido feito (repetir) */
  lastPrompt?: string | null;
  /** peças fixadas ("Manter") que o look vai respeitar */
  pinnedCount?: number;
  onRun: (prompt: string) => void;
}) {
  const { t } = useI18n();
  const [mood, setMood] = useState<string | null>(null);
  const [weather, setWeather] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const run = (key: string, prompt: string) => { setRunning(key); onRun(prompt); };
  const cell = (key: string, icon: string, name: string, caption: string | null, prompt: string) => (
    <button key={key} type="button" className={cn("fitting-store vista-cell", busy && running === key && "is-active")} disabled={busy} aria-busy={busy && running === key}
      onClick={() => run(key, prompt)}>
      <span className="vista-cell-ico" aria-hidden><FaiIcon id={icon} size={32} decorative /></span>
      <span className="fitting-store-name">{name}</span>
      {caption && <span className="vista-cell-caption">{caption}</span>}
    </button>
  );
  return (
    <div className="vista-cells">
      <div className="vista-mods" role="group" aria-label={t("mirror.vista.como_quer_se_sentir")}>
        <span className="vista-mods-label">{t("mirror.vista.como_quer_se_sentir")}</span>
        {MOODS.map((m) => <Chip key={m} active={mood === m} onClick={() => setMood(mood === m ? null : m)}>{t(`mirror.vista.humor.${m}`)}</Chip>)}
        {WEATHER.map((w) => <Chip key={w} active={weather === w} onClick={() => setWeather(weather === w ? null : w)}>{t(`mirror.vista.clima.${w}`)}</Chip>)}
      </div>
      <div className="fitting-stores vista-occasions" role="group" aria-label={t("mirror.vista.para_onde")}>
        {OCCASIONS.map((o) => cell(o, OCCASION_ICON[o], t(`mirror.vista.ocasiao.${o}`), null, vistaPrompt(t, o, mood, weather)))}
        {cell("surprise", OCCASION_ICON.surprise, t("mirror.vista.surpreenda"), t("mirror.vista.surpreenda_legenda"), vistaPrompt(t, null, mood, weather))}
        {lastPrompt ? cell("repeat", OCCASION_ICON.repeat, t("mirror.vista.repetir"), `«${lastPrompt}»`, lastPrompt) : null}
      </div>
      {pinnedCount > 0 && <p className="type-body-sm text-muted">{t("mirror.vista.fixadas", { n: pinnedCount })}</p>}
    </div>
  );
}

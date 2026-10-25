"use client";
/*
 * MET Gala Heist v2 — o deck da partida (aberto pela roda): cada carta com o que ela faz agora (vestir, Visão, grampo,
 * munição, faca, cronômetro, curativo, capuz) e o estado (no deck, vestida, usada, entregue ao revendedor). Também a
 * miniatura da carta (foto da peça ou a cor) usada no revendedor e na escolha do deck.
 */
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { HeistCard, SimState } from "@/lib/heist/types";
import { effectSize } from "@/lib/heist/cards";
import { useCard, wear } from "@/lib/heist/sim";

export function CardThumb({ c }: { c: HeistCard }) {
  return <span className={cn("hz-thumb", `tier-${c.tier.toLowerCase()}`)} style={{ background: c.colorHex ?? "#2a2a30" }} aria-hidden>
    {c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" /> : null}
  </span>;
}

export function DeckPanel({ s, onChange, onClose }: { s: SimState; onChange: (closeAfter: boolean) => void; onClose: () => void }) {
  const { t } = useI18n();
  const p = s.player;
  return <div className="hz-modal" role="dialog" aria-modal="true" aria-labelledby="hz-deck-title">
    <div className="hz-panel hz-deck">
      <header className="hz-panel-head"><div><p className="hz-eyebrow">{t("heist.deck.eyebrow")}</p><h2 id="hz-deck-title">{t("heist.deck.title")}</h2><p className="hz-muted">{t("heist.deck.lead")}</p></div></header>
      <ul className="hz-cardlist is-wide">
        {p.inv.uniform && <li><div className="hz-card"><span className="hz-thumb" style={{ background: "#f3f1ec" }} aria-hidden /><span className="hz-card-body"><b>{t("heist.item.uniform")}</b><span className="hz-muted">{t("heist.deck.uniformText")}</span></span>
          <button type="button" className="hz-btn" disabled={p.outfit.base === "uniform" && !p.outfit.worn.length} onClick={() => { if (wear(s, "uniform")) onChange(true); }}>{t("heist.deck.wear")}</button></div></li>}
        {(p.outfit.base !== "arrival" || p.outfit.worn.length > 0) && <li><div className="hz-card"><span className="hz-thumb" style={{ background: "#16161c" }} aria-hidden /><span className="hz-card-body"><b>{t("heist.deck.arrival")}</b><span className="hz-muted">{t("heist.deck.arrivalText")}</span></span>
          <button type="button" className="hz-btn" onClick={() => { if (wear(s, "arrival")) onChange(true); }}>{t("heist.deck.wear")}</button></div></li>}
        {s.cards.map((c) => {
          const st = s.cardState[c.id], usable = st === "DECK" || (c.use === "HOOD" && st === "WORN");
          const action = c.use === "WEAR" ? "wear" : c.use === "PICK" ? "pick" : c.use === "TRADE" ? null : c.use === "HOOD" && st === "WORN" ? "unhood" : "use";
          return <li key={c.id}><div className={cn("hz-card", st !== "DECK" && "is-spent")}>
            <CardThumb c={c} />
            <span className="hz-card-body">
              <b>{c.starter ? t(`heist.${c.name}`) : c.name}</b>
              <span>{t(`heist.tier.${c.tier}`)} · {t("heist.vendor.value", { n: c.value })} · {t(`heist.cardState.${st}`)}</span>
              <span className="hz-muted">{t(`heist.use.${c.use}`, { n: effectSize(c), uses: s.cardUses[c.id] ?? 0 })}{c.use === "WEAR" && c.dress ? ` · ${t(`heist.disguise.${c.dress}`)}` : ""}{c.shoes ? ` · ${t(`heist.shoes.${c.shoes}`)}` : ""}</span>
            </span>
            {action && <button type="button" className="hz-btn" disabled={!usable || action === "pick"} title={action === "pick" ? t("heist.deck.pickHint") : undefined}
              onClick={() => { if (useCard(s, c.id)) onChange(action === "wear"); }}>{t(`heist.deck.${action}`)}</button>}
          </div></li>;
        })}
      </ul>
      <footer className="hz-panel-foot"><button type="button" className="hz-btn" onClick={onClose} autoFocus>{t("heist.close")}</button></footer>
    </div>
  </div>;
}

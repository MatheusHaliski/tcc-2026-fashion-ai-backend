"use client";
/*
 * MET Gala Heist v2 — painel do revendedor (estande da avenida e balcão do bar): à esquerda as peças do deck que ainda podem
 * ser entregues (valor, raridade e o que a peça faria se fosse usada — a decisão é trocar ou usar), à direita as ofertas.
 * Arma com exigência de peça cara aparece BLOQUEADA com o motivo em números quando as roupas não chegam lá. Entregar uma
 * peça vale só nesta partida; ela continua na coleção.
 */
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { HeistCard, SimState, VendorId } from "@/lib/heist/types";
import { offerLock, reachable } from "@/lib/heist/cards";
import { bestGiven, buy, trade, tradable } from "@/lib/heist/sim";
import { CardThumb } from "./cards-ui";

export function VendorPanel({ s, vendor, onChange, onClose }: { s: SimState; vendor: VendorId; onChange: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<string[]>([]);
  const owned = tradable(s);
  const credits = s.player.credits[vendor], given = bestGiven(s, vendor);
  const bestOwned = Math.max(0, ...owned.map((c) => c.value));
  const sum = useMemo(() => picked.reduce((acc, id) => acc + (s.cards.find((c) => c.id === id)?.value ?? 0), 0), [picked, s.cards]);
  const toggle = (c: HeistCard) => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]));
  return <div className="hz-modal" role="dialog" aria-modal="true" aria-labelledby="hz-vendor-title">
    <div className="hz-panel hz-vendor">
      <header className="hz-panel-head">
        <div><p className="hz-eyebrow">{t(`heist.vendor.${vendor}.where`)}</p><h2 id="hz-vendor-title">{t(`heist.vendor.${vendor}.name`)}</h2><p className="hz-muted">{t(`heist.vendor.${vendor}.pitch`)}</p></div>
        <p className="hz-credits" aria-live="polite">{t("heist.vendor.credits", { n: credits })}</p>
      </header>
      <div className="hz-vendor-cols">
        <section aria-labelledby="hz-v-pieces">
          <h3 id="hz-v-pieces">{t("heist.vendor.yourPieces")}</h3>
          {owned.length === 0 && <p className="hz-muted">{t("heist.vendor.noPieces")}</p>}
          <ul className="hz-cardlist">
            {owned.map((c) => <li key={c.id}>
              <button type="button" className={cn("hz-card", picked.includes(c.id) && "is-picked")} aria-pressed={picked.includes(c.id)} onClick={() => toggle(c)}>
                <CardThumb c={c} />
                <span className="hz-card-body"><b>{c.starter ? t(`heist.${c.name}`) : c.name}</b><span>{t(`heist.tier.${c.tier}`)} · {t("heist.vendor.value", { n: c.value })}</span><span className="hz-muted">{t(`heist.use.${c.use}`)}</span></span>
              </button>
            </li>)}
          </ul>
          <button type="button" className="hz-btn is-primary" disabled={!picked.length} onClick={() => { trade(s, vendor, picked); setPicked([]); onChange(); }}>
            {t("heist.vendor.give", { n: picked.length, credits: sum })}
          </button>
          <p className="hz-fine">{t("heist.vendor.keep")}</p>
        </section>
        <section aria-labelledby="hz-v-offers">
          <h3 id="hz-v-offers">{t("heist.vendor.offers")}</h3>
          <ul className="hz-offers">
            {s.offers[vendor].map((o) => {
              const lock = offerLock(o, credits, given, bestOwned);
              const blocked = lock.kind === "piece" && lock.best < (o.minPiece ?? 0) || lock.kind === "stock" || !reachable(o, credits, given, owned);
              return <li key={o.item} className={cn("hz-offer", blocked && "is-locked", lock.kind === "ok" && "is-ready")}>
                <div><b>{t(`heist.item.${o.item}`)}</b><span className="hz-muted">{t(`heist.item.${o.item}.text`)}</span></div>
                <div className="hz-offer-side">
                  <span className="hz-price">{t("heist.vendor.price", { n: o.price })}</span>
                  {o.minPiece ? <span className="hz-muted">{t("heist.vendor.minPiece", { n: o.minPiece })}</span> : null}
                  {lock.kind === "ok" && <button type="button" className="hz-btn" onClick={() => { buy(s, vendor, o.item); onChange(); }}>{t("heist.vendor.buy")}</button>}
                  {lock.kind === "stock" && <span className="hz-lock">{t("heist.vendor.soldOut")}</span>}
                  {lock.kind === "credits" && <span className={cn("hz-lock", blocked && "is-hard")}>{blocked ? `🔒 ${t("heist.vendor.lockTotal")}` : t("heist.vendor.missing", { n: lock.missing })}</span>}
                  {lock.kind === "piece" && <span className={cn("hz-lock", blocked && "is-hard")}>{blocked ? `🔒 ${t("heist.vendor.lockPiece", { need: lock.need, best: lock.best })}` : t("heist.vendor.givePiece", { need: lock.need })}</span>}
                </div>
              </li>;
            })}
          </ul>
        </section>
      </div>
      <footer className="hz-panel-foot"><button type="button" className="hz-btn" onClick={onClose} autoFocus>{t("heist.close")}</button></footer>
    </div>
  </div>;
}

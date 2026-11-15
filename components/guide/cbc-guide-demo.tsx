"use client";
/**
 * Exemplo do tutorial dos Desafios de Montagem: a cena dinâmica do cenário (a mesma da tela do desafio), com peças que
 * se revelam e uma carta que voa da bandeja para a vaga.
 */
import { useI18n } from "@/lib/i18n/i18n";
import { cenaDoCenario } from "@/lib/flair/cenas/catalogo";
import { CenaViva } from "@/components/flair/cenas/cena-viva";
import { FlairGameCard } from "@/components/flair/flair-game-card";
import { demoCard } from "./demo-data";

export function CbcDemo() {
  const { t } = useI18n();
  return (
    <div className="gd-cbc">
      <div className="gd-mosaic">
        <CenaViva cena={cenaDoCenario("primavera")} decorativa />
        <div className="gd-tiles" aria-hidden>
          <i className="gd-tile-cover is-filled" /><i className="gd-tile-cover gd-anim-reveal" /><i className="gd-tile-cover" /><i className="gd-tile-cover" />
        </div>
        <span className="gd-req">{t("guide.demo.cbc.requirement")}</span>
      </div>
      <div className="gd-cbc-bank">
        <div className="gd-anim-fly"><FlairGameCard card={demoCard({ tier: "PRATA", ovr: 70 })} size="sm" flip={false} /></div>
        <span className="type-caption">{t("guide.demo.cbc.bank")}</span>
      </div>
    </div>
  );
}

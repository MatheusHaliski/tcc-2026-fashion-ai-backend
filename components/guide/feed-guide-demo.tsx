"use client";
import { useEffect } from "react";
import { PieceCard } from "@/components/piece-card";
import { useI18n } from "@/lib/i18n/i18n";
import { primeHype } from "@/lib/hype/use-hype";
import { demoPiece, DEMO_HYPE } from "./demo-data";

// Eager only for the feed: lazy insertion of the real card changed the centered modal height (CLS).
export function FeedGuideDemo() {
  const { t } = useI18n();
  useEffect(() => { primeHype("PIECE", DEMO_HYPE); }, []);
  return (
    <div className="gd-feed">
      <div className="gd-card-frame"><PieceCard piece={demoPiece()} flip={false} /></div>
      <ul className="gd-callouts">
        <li><span className="gd-dot">1</span>{t("guide.demo.feed.open")}</li>
        <li><span className="gd-dot">2</span>{t("guide.demo.feed.piece")}</li>
        <li><span className="gd-dot">3</span>{t("guide.demo.feed.actions")}</li>
      </ul>
    </div>
  );
}


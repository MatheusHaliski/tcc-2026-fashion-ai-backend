"use client";
/*
 * Laboratório do MET Gala Heist v2: a partida completa com um deck de exemplo (peças fictícias de várias raridades, para
 * testar o revendedor, as cartas de vestir, a Visão e a munição). ?debug=planta mostra a planta em blocos no lugar da
 * cena, ?at=salao|servico|cofre|vestibulo|terraco começa num ponto, ?q=low liga a qualidade baixa e
 * ?shot=x,y,z,tx,ty,tz[,fov] deixa a câmera parada num enquadramento (fotografar gente e cenário com o jogo rodando).
 */
import dynamic from "next/dynamic";
import { useMemo, useState, useEffect } from "react";
import { matchCards, type DeckCard } from "@/lib/heist/cards";
import type { LabShot } from "@/components/heist/camera";

const HeistGame = dynamic(() => import("@/components/heist/game").then((m) => m.HeistGame), { ssr: false });

const SAMPLE: DeckCard[] = [
  { id: "lab-gown", name: "Vestido longo de cetim (exemplo)", category: "full_body_piece", subcategory: "dress", rarity: "LIMITED", occasions: ["formal"], stats: { CLOUT: 92 }, brandName: "Atelier Exemplo", colorHex: "#5b1a2e" },
  { id: "lab-heels", name: "Scarpin de verniz (exemplo)", category: "shoes_piece", subcategory: "pumps", rarity: "PREMIUM", stats: { CLOUT: 60 }, colorHex: "#111111" },
  { id: "lab-glasses", name: "Óculos escuros (exemplo)", category: "accessory_piece", subcategory: "sunglasses", rarity: "RARE", stats: { CLOUT: 70 }, colorHex: "#222222" },
  { id: "lab-bag", name: "Bolsa transversal (exemplo)", category: "accessory_piece", subcategory: "crossbody_bag", rarity: "STANDARD", stats: { CLOUT: 35 }, colorHex: "#6b4a2b" },
  { id: "lab-belt", name: "Cinto de couro (exemplo)", category: "accessory_piece", subcategory: "belt", rarity: "STANDARD", stats: { CLOUT: 30 }, colorHex: "#3b2a1a" },
  { id: "lab-scarf", name: "Lenço de seda (exemplo)", category: "accessory_piece", subcategory: "scarf", rarity: "PREMIUM", stats: { CLOUT: 50 }, colorHex: "#c9a227" },
  { id: "lab-watch", name: "Relógio (exemplo)", category: "accessory_piece", subcategory: "watch", rarity: "STANDARD", stats: { CLOUT: 40 }, colorHex: "#b0b0b0" },
  { id: "lab-hoodie", name: "Moletom com capuz (exemplo)", category: "top_piece", subcategory: "hoodie", rarity: "STANDARD", occasions: ["casual"], stats: { CLOUT: 25 }, colorHex: "#2d2d33" },
];

export default function HeistLab() {
  // os parâmetros da URL são lidos antes de montar o jogo (debug e qualidade valem só na montagem)
  const [q, setQ] = useState<{ debug: boolean; at?: string; quality?: "high" | "low"; shot: LabShot | null } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const n = (p.get("shot") ?? "").split(",").map(Number), ok = (n.length === 6 || n.length === 7) && n.every(Number.isFinite);
    const shot: LabShot | null = ok ? { pos: [n[0], n[1], n[2]], target: [n[3], n[4], n[5]], fov: n[6] } : null;
    setQ({ debug: p.get("debug") === "planta", at: p.get("at") ?? undefined, quality: p.get("q") === "low" ? "low" : undefined, shot });
  }, []);
  const cards = useMemo(() => matchCards(SAMPLE), []);
  return <div style={{ position: "fixed", inset: 0, background: "#000" }}>
    {q && <HeistGame cards={cards} debug={q.debug} startAt={q.at} quality={q.quality} labHandle labShot={q.shot} />}
  </div>;
}

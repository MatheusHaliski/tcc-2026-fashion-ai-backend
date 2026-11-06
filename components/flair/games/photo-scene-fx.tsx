"use client";
import type { CSSProperties } from "react";
import type { EffectKind, SceneFx } from "@/lib/flair/games";

/**
 * Camadas de efeito por tipo de luz do ambiente. A carta cai sobre um objeto real da foto (a âncora da vaga) e a luz
 * usada é a do lugar, para o efeito fazer sentido no conjunto da imagem:
 *   spot      palco, passarela, auditório: canhões seguidores descem sobre a carta; a Aura Hype soma canhões (1 a 3) e,
 *             a partir de Tendência, a fumaça do palco; Metamorfose troca a gelatina do canhão pela cor do nível e projeta gobo.
 *   flash     parede de imprensa, tapete, rua: rajadas de flash ao redor; a Aura Hype multiplica os flashes (2 a 8);
 *             Metamorfose deixa os flashes dourados com rastro de lente.
 *   neon      boate, show, avenida: brilho de neon e feixes de laser em leque; a Aura Hype abre mais feixes;
 *             Metamorfose vira a cor do neon para a do nível (o próprio pedaço da foto muda de cor).
 *   candle    restaurante, jantar, camarote: luz quente baixa e bokeh de velas; a Aura Hype acende mais velas;
 *             Metamorfose espalha brilho de champanhe.
 *   vitrine   loja, vitrine, showroom, leilão, cofre: o vidro reflete e a vitrine acende por dentro (fileira de spots);
 *             a Aura Hype acende mais spots; Metamorfose deixa o vidro iridescente.
 *   mirror    espelho, camarim, provador: o vidro do espelho cintila e o anel de lâmpadas de camarim acende (mais lâmpadas
 *             com mais Hype); Metamorfose vira prisma; Impersonation mostra a peça no reflexo.
 *   rack      closet, arara, atelier, backstage: luz de prateleira sobre as roupas e brilho nos cabides; a Aura Hype
 *             estende a fita de LED; Metamorfose tinge as peças da arara; Impersonation pendura a peça na arara.
 *   daylight  praia, serra, rooftop, feira, rua histórica: feixes de sol na diagonal e poeira no ar; a Aura Hype abre o
 *             sol; Metamorfose traz a hora dourada.
 *   screen    telão, redação, estúdio, cinema: a tela acende; Impersonation projeta a peça na tela.
 *   lamp      quarto, hotel, galeria, salão de gala: halo de abajur ou lustre com cristais; a Aura Hype acende cristais.
 */
const COUNT: Record<SceneFx, (aura: number) => number> = {
  spot: (a) => 1 + Math.min(2, Math.floor(a / 2)), flash: (a) => 2 + a, neon: (a) => 2 + a, candle: (a) => 3 + a * 2,
  vitrine: (a) => 2 + a, mirror: (a) => 6 + a * 2, rack: (a) => 3 + a, daylight: (a) => 2 + Math.floor(a / 2), screen: () => 0, lamp: (a) => 4 + a * 2,
};
const ITEM: Partial<Record<SceneFx, string>> = { spot: "gfx-beam", flash: "gfx-burst", neon: "gfx-laser", candle: "gfx-bokeh", vitrine: "gfx-downlight",
  mirror: "gfx-bulb", rack: "gfx-led", daylight: "gfx-sunbeam", lamp: "gfx-crystal" };

export function SceneFxLayers({ fx, kind, aura, photo, piece }: { fx: SceneFx; kind: EffectKind; aura: number; photo: string; piece: string | null }) {
  const n = COUNT[fx](aura);
  const item = ITEM[fx];
  const meta = kind !== "COMUM";
  return (
    <span className={`gfx gfx-${fx}`} data-meta={meta ? "1" : undefined} data-band={aura}>
      {item && <span className="gfx-items">{Array.from({ length: n }, (_, i) => <i key={i} className={item} style={{ "--i": i, "--n": n } as CSSProperties} />)}</span>}
      {fx === "spot" && aura >= 4 && <span className="gfx-haze" />}
      {fx === "spot" && meta && <span className="gfx-gobo" />}
      {fx === "neon" && <img className="gfx-neon-shift" src={photo} alt="" decoding="async" />}
      {fx === "vitrine" && <span className="gfx-pane" />}
      {fx === "mirror" && <span className="gfx-mirror" />}
      {fx === "rack" && meta && <img className="gfx-rack-tint" src={photo} alt="" decoding="async" />}
      {fx === "daylight" && <span className="gfx-dust" />}
      {fx === "screen" && <span className="gfx-screen">{kind === "IMPERSONATION" && piece ? <img src={piece} alt="" decoding="async" /> : null}</span>}
      {kind === "IMPERSONATION" && piece && fx !== "screen" && (
        <span className={`gfx-piece gfx-piece-${fx === "mirror" ? "reflected" : fx === "rack" ? "hanging" : fx === "vitrine" ? "displayed" : "standing"}`}>
          {fx === "rack" && <span className="gfx-hanger" />}
          <span className="gfx-shadow" />
          <img className="gfx-cutout" src={piece} alt="" decoding="async" />
          {fx !== "rack" && fx !== "mirror" && <img className="gfx-reflection" src={piece} alt="" decoding="async" />}
        </span>
      )}
    </span>
  );
}

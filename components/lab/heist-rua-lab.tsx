"use client";
/*
 * Laboratório da cena externa do MET Gala Heist v2: céu, fachada, avenida, carros, beco e luzes, sem simulação e sem
 * gente (o HeistPeople é de outro módulo). Câmera livre (arrastar/rolar) com enquadramentos prontos em ?cam= e qualidade
 * em ?q=low|high. Serve para fotografar a cena e comparar versões.
 */
import dynamic from "next/dynamic";

const Scene = dynamic(() => import("./heist-rua-scene"), { ssr: false });
export default function HeistRuaLab() {
  return <div style={{ position: "fixed", inset: 0, background: "#000" }}><Scene /></div>;
}

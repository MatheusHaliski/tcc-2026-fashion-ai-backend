/*
 * MET Gala Heist v2 — Sala de segurança (Z09): as telas desenhadas da sala — o painel do palco e da pista (quatro
 * cenas que se revezam e a tela do alarme, nos três idiomas) e a planta do museu na parede. Saiu de seguranca.ts sem
 * mudança.
 */
import type * as THREE from "three";
import type { SceneLocale } from "../interior-copy";
import { SANS, drawnTexture, fit } from "../interior-tex";

const SHOW: Record<SceneLocale, { head: string; scene: string; scenes: string[]; dj: string; hall: string; alarm: string; where: string }> = {
  "pt-BR": { head: "PALCO · PISTA", scene: "CENA", scenes: ["ÂMBAR LENTO", "ROSA PULSO", "BRANCO DESFILE", "VIOLETA PISTA"], dj: "DJ 124 BPM", hall: "SALÃO 412 CONVIDADOS", alarm: "ALARME", where: "SALA DAS JOIAS" },
  en: { head: "STAGE · FLOOR", scene: "SCENE", scenes: ["SLOW AMBER", "PINK PULSE", "RUNWAY WHITE", "FLOOR VIOLET"], dj: "DJ 124 BPM", hall: "HALL 412 GUESTS", alarm: "ALARM", where: "JEWEL ROOM" },
  es: { head: "ESCENARIO · PISTA", scene: "ESCENA", scenes: ["ÁMBAR LENTO", "ROSA PULSO", "BLANCO DESFILE", "VIOLETA PISTA"], dj: "DJ 124 BPM", hall: "SALÓN 412 INVITADOS", alarm: "ALARMA", where: "SALA DE LAS JOYAS" },
};
/** Uma tela do painel do palco e da pista (quatro cenas que se revezam e a tela do alarme). */
export function showTexture(loc: SceneLocale, k: number, alarm: boolean): THREE.Texture {
  const t = SHOW[loc];
  return drawnTexture(`seg-show-${loc}-${k}-${alarm ? 1 : 0}`, 512, 288, (g, w, h) => {
    if (alarm) {
      g.fillStyle = "#3a0306"; g.fillRect(0, 0, w, h); g.fillStyle = "#ff2a2a"; g.fillRect(0, 0, w, 56);
      g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 40px ${SANS}`; g.fillText(t.alarm, w / 2, 30);
      g.fillStyle = "#ffb3b3"; const px = fit(g, t.where, (p) => `800 ${p}px ${SANS}`, 46, w - 40); g.font = `800 ${px}px ${SANS}`; g.fillText(t.where, w / 2, h * 0.52);
      g.font = `600 22px ${SANS}`; g.fillText("23:1" + k + ":0" + (k * 3 % 10), w / 2, h * 0.8);
      return;
    }
    const cols = ["#ffb35a", "#ff5fa8", "#f4f4f4", "#a36bff"], c = cols[k];
    g.fillStyle = "#06090f"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#14243a"; g.fillRect(0, 0, w, 40); g.fillStyle = "#cfe8ff"; g.font = `700 22px ${SANS}`; g.textBaseline = "middle"; g.textAlign = "left"; g.fillText(t.head, 14, 21);
    g.textAlign = "right"; g.fillText(`23:0${k * 2}`, w - 14, 21);
    t.scenes.forEach((s, i) => { const y = 64 + i * 42; g.fillStyle = i === k ? c : "#1a2433"; g.fillRect(12, y, 220, 34); g.fillStyle = i === k ? "#0b0b0b" : "#8fa6c0"; g.textAlign = "left"; g.font = `700 16px ${SANS}`; g.fillText(`${t.scene} ${i + 1}  ${s}`, 20, y + 17); });
    // mini planta da pista com os refletores na cor da cena
    g.strokeStyle = "#3e5a7a"; g.lineWidth = 2; g.strokeRect(250, 58, 248, 150);
    for (let i = 0; i < 12; i++) { const x = 266 + (i % 6) * 43, y = 76 + Math.floor(i / 6) * 112; g.fillStyle = (i + k) % 3 === 0 ? "#ffffff" : c; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = c; g.globalAlpha = 0.25; g.beginPath(); g.ellipse(374, 133, 90, 40, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    for (let i = 0; i < 9; i++) { g.fillStyle = "#cfe8ff"; g.beginPath(); g.arc(320 + (i * 37) % 120, 118 + (i * 23) % 36, 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#cfe8ff"; g.textAlign = "left"; g.font = `600 18px ${SANS}`; g.fillText(t.dj, 14, h - 46); g.fillText(t.hall, 14, h - 20);
    for (let i = 0; i < 24; i++) { const v = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.9 + k * 1.7)); g.fillStyle = c; g.fillRect(260 + i * 10, h - 18 - v * 50, 7, v * 50); }
  });
}
/** Planta do museu na parede (traços ciano, o ponto vermelho é o diamante). */
export function planTexture(label: string): THREE.Texture {
  return drawnTexture(`seg-plan-${label}`, 512, 512, (g, w, h) => {
    g.fillStyle = "#0e1a26"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(127,215,255,0.18)"; g.lineWidth = 1;
    for (let k = 0; k < 16; k++) { g.beginPath(); g.moveTo((k / 16) * w, 0); g.lineTo((k / 16) * w, h); g.stroke(); g.beginPath(); g.moveTo(0, (k / 16) * h); g.lineTo(w, (k / 16) * h); g.stroke(); }
    g.strokeStyle = "#7fd7ff"; g.lineWidth = 3;
    const rect = (x0: number, z0: number, x1: number, z1: number) => g.strokeRect(((x0 + 24) / 48) * w, ((z0 + 24) / 48) * h, ((x1 - x0) / 48) * w, ((z1 - z0) / 48) * h);
    rect(-22, -22, -12.5, -6.5); rect(-12, -22, 12, -6.5); rect(12.5, -22, 22, -6.5); rect(-22, -6, -12.5, 16); rect(-12, -6, 12, 14); rect(12.5, -6, 22, 4); rect(12.5, 4.5, 22, 14); rect(-8, 14.5, 8, 24); rect(-22, 16.5, -8.5, 24);
    g.fillStyle = "#ff4b4b"; g.beginPath(); g.arc(((-17.25 + 24) / 48) * w, ((-14.25 + 24) / 48) * h, 8, 0, Math.PI * 2); g.fill();
    for (const [x, z] of [[-20.2, 4.8], [-13.25, 15], [-17.25, -5], [0, 5], [17, -1]]) { g.fillStyle = "#ffe36a"; g.beginPath(); g.arc(((x + 24) / 48) * w, ((z + 24) / 48) * h, 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#7fd7ff"; g.font = `600 22px ${SANS}`; g.fillText(label, 16, h - 18);
  });
}

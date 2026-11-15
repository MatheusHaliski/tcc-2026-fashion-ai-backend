"use client";
/**
 * A sala vista de cima, em 2D (sem WebGL ou com "reduzir movimento"): os pontos (tocar anda até o vizinho), os
 * esconderijos, os armários, as portas, os vigias com o cone de visão e a pessoa. Mesmos dados da cena 3D.
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { noCone } from "@/lib/flair/detetive/acoes";
import type { Retrato } from "@/lib/flair/detetive/types";

const ESCALA = 34;
const px = (x: number) => 170 + x * ESCALA;
const pz = (z: number) => 125 + z * ESCALA;

function leque(r: Retrato, x: number, z: number, olhar: number): string {
  const pontos = [`${px(x)},${pz(z)}`];
  for (let a = olhar - r.meiaAbertura; a <= olhar + r.meiaAbertura; a += r.meiaAbertura / 4) {
    const rad = (a * Math.PI) / 180;
    pontos.push(`${px(x + Math.sin(rad) * r.alcance)},${pz(z + Math.cos(rad) * r.alcance)}`);
  }
  return pontos.join(" ");
}

export function DetetivePlanta({ r, vizinhos, onIr }: { r: Retrato; vizinhos: string[]; onIr: (ponto: string) => void }) {
  const tx = useNucleoText();
  const aqui = r.layout.pontos.find((p) => p.id === r.ponto);
  return (
    <svg className="dtv-planta" viewBox="0 0 340 250" role="img" aria-label={tx.t("flair3d.detetive.ui.planta", { sala: tx.t(`flair3d.detetive.sala.${r.sala}`) })} data-testid="detetive-planta">
      <rect x={px(-4.6)} y={pz(-3.6)} width={9.2 * ESCALA} height={7.2 * ESCALA} fill="#1B1E25" stroke="#fff5" />
      {r.layout.vigias.filter((v) => v.vigia && !v.convencido).map((v) => (
        <polygon key={`c-${v.id}`} points={leque(r, v.x, v.z, v.olhar)} fill={aqui && !r.escondido && noCone(r, v, aqui.x, aqui.z) ? "#E5484D55" : "#F2C23044"} />
      ))}
      {r.layout.pontos.map((p) => {
        const perto = vizinhos.includes(p.id);
        return (
          <g key={p.id} data-ponto={p.id}>
            <circle cx={px(p.x)} cy={pz(p.z)} r={p.esconderijo ? 13 : 10} fill={p.esconderijo ? "#2F5E4A" : "#2C3440"} stroke={perto ? "#fff" : "#fff4"} strokeWidth={perto ? 2 : 1}
              onClick={perto ? () => onIr(p.id) : undefined} style={perto ? { cursor: "pointer" } : undefined} />
            {r.layout.saidas.some((s) => s.ponto === p.id) && <rect x={px(p.x) - 5} y={pz(p.z) - 18} width={10} height={6} fill="#C9A24A" />}
            {r.layout.armarios.some((a) => a.ponto === p.id) && <rect x={px(p.x) + 8} y={pz(p.z) - 4} width={8} height={8} fill="#8FD19E" />}
          </g>
        );
      })}
      {r.layout.vigias.map((v) => <circle key={v.id} cx={px(v.x)} cy={pz(v.z)} r={7} fill={v.vigia ? "#E0A030" : "#9AA6B4"} />)}
      {aqui && <circle cx={px(aqui.x)} cy={pz(aqui.z)} r={8} fill="#F2C230" stroke="#111" strokeWidth={2} data-testid="detetive-eu" />}
    </svg>
  );
}

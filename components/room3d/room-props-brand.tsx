"use client";
import { useTex } from "@/components/three/common";
import { useCanvasTex } from "./room-props-kit";

// ───────────────────────────── identidade FashionAI no quarto

/** Marca (nome próprio, não se traduz) e as cores do logo: laranja, creme, marrom-escuro e os pontos da rede. */
const BRAND = { name: "FashionAI", short: "FAI", orange: "#f58220", neon: "#ff6a1a", cream: "#f3ead8", dark: "#2b2622", dots: ["#f5c518", "#1f7fc8", "#4c9a2a", "#f58220", "#7a4a2a"] } as const;

/**
 * Medalhão do logo FashionAI preso na parede (acima da cabeceira): o disco do logo, aro escuro e halo de neon laranja
 * com um brilho suave na parede. Origem no centro do disco; +z para dentro do quarto. Sem luz própria (o halo é cor).
 */
export function FaiMedallion({ position, radius = 0.42 }: { position: [number, number, number]; radius?: number }) {
  const logo = useTex("/brand/fai-logo.png");
  const glow = useCanvasTex("fai-glow", 128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(255,106,26,.5)"); gr.addColorStop(1, "rgba(255,106,26,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  return (
    <group position={position} name="fai-medalhao">
      <mesh position={[0, 0, 0.002]}><planeGeometry args={[radius * 3, radius * 3]} /><meshBasicMaterial map={glow} transparent depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.018]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[radius + 0.035, radius + 0.035, 0.032, 64]} /><meshStandardMaterial color={BRAND.dark} roughness={0.5} /></mesh>
      <mesh position={[0, 0, 0.035]}><circleGeometry args={[radius, 64]} /><meshBasicMaterial map={logo ?? undefined} color={logo ? "#ffffff" : BRAND.orange} transparent toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.036]}><torusGeometry args={[radius + 0.028, 0.009, 10, 96]} /><meshBasicMaterial color="#ff8a3d" toneMapped={false} /></mesh>
    </group>
  );
}

/** Letreiro de neon "FashionAI" (tubo creme com brilho laranja; "AI" em laranja), na parede acima da porta. */
export function FaiNeonSign({ position, w = 0.95 }: { position: [number, number, number]; w?: number }) {
  const tex = useCanvasTex("fai-neon", 1024, 256, (g, cw, ch) => {
    g.font = "italic 700 150px Georgia, serif"; g.textBaseline = "middle"; g.textAlign = "left";
    const head = BRAND.name.slice(0, -2), tail = BRAND.name.slice(-2);
    const a = g.measureText(head).width, b = g.measureText(tail).width, gap = 10, x0 = (cw - a - b - gap) / 2;
    for (const blur of [42, 14]) {                 // halo largo e depois o tubo
      g.shadowColor = BRAND.neon; g.shadowBlur = blur;
      g.fillStyle = "#fff1e0"; g.fillText(head, x0, ch * 0.55);
      g.fillStyle = "#ff8a3d"; g.fillText(tail, x0 + a + gap, ch * 0.55);
    }
  });
  return <mesh position={position} name="fai-neon"><planeGeometry args={[w, w / 4]} /><meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} /></mesh>;
}

/**
 * A bolsa do logo FashionAI desenhada no canvas: sacola preta com alça, corpo em trapézio de cantos arredondados, brilho
 * suave de volume e "FAI" em branco — o miolo do logo. (cx, cy) é o centro do corpo e `w` a largura da boca da sacola.
 */
function faiBag(g: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  const top = cy - w * 0.3, bottom = cy + w * 0.36, half = w / 2, base = w * 0.4, r = w * 0.07;
  g.save();
  g.strokeStyle = "#1c1916"; g.lineWidth = w * 0.085; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx - w * 0.2, top + w * 0.02); g.bezierCurveTo(cx - w * 0.2, top - w * 0.36, cx + w * 0.2, top - w * 0.36, cx + w * 0.2, top + w * 0.02); g.stroke();
  g.beginPath();
  g.moveTo(cx - half + r, top); g.lineTo(cx + half - r, top); g.quadraticCurveTo(cx + half, top, cx + half - r * 0.3, top + r);
  g.lineTo(cx + base, bottom - r); g.quadraticCurveTo(cx + base - r * 0.2, bottom, cx + base - r, bottom);
  g.lineTo(cx - base + r, bottom); g.quadraticCurveTo(cx - base + r * 0.2, bottom, cx - base, bottom - r);
  g.lineTo(cx - half + r * 0.3, top + r); g.quadraticCurveTo(cx - half, top, cx - half + r, top); g.closePath();
  const shade = g.createLinearGradient(cx - half, top, cx + half, bottom); shade.addColorStop(0, "#3a3430"); shade.addColorStop(0.45, "#1f1b18"); shade.addColorStop(1, "#141210");
  g.fillStyle = shade; g.fill();
  g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(cx - half + r, top + r * 0.4, w - 2 * r, w * 0.05);   // aba da boca da sacola
  g.fillStyle = "#f7f1e6"; g.font = `900 ${Math.round(w * 0.3)}px Inter, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(BRAND.short, cx, cy + w * 0.06);
  g.restore();
}

/** Tapete redondo FashionAI: o desenho do logo no chão (anel escuro com a rede de pontos, anel laranja, miolo creme e a bolsa FAI). */
export function FaiRug({ position, radius = 1.1, night }: { position: [number, number, number]; radius?: number; night?: boolean }) {
  const tex = useCanvasTex(`fai-rug-${night ? "n" : "d"}`, 512, 512, (g, w) => {
    const c = w / 2, ring = (r: number, color: string) => { g.fillStyle = color; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill(); };
    ring(c, BRAND.dark); ring(c * 0.74, BRAND.orange); ring(c * 0.4, BRAND.cream);
    const nodes: [number, number][] = [];
    for (const [r, n] of [[0.88, 28], [0.58, 20]] as const) for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r; nodes.push([c + Math.cos(a) * c * r, c + Math.sin(a) * c * r]); }
    g.strokeStyle = "rgba(233,220,192,.75)"; g.lineWidth = 2; g.beginPath();
    nodes.forEach(([x, y], i) => { const [nx, ny] = nodes[(i + 1) % nodes.length]; g.moveTo(x, y); g.lineTo(nx, ny); const [ox, oy] = nodes[(i + 7) % nodes.length]; g.moveTo(x, y); g.lineTo(ox, oy); });
    g.stroke();
    nodes.forEach(([x, y], i) => { g.fillStyle = BRAND.dots[i % BRAND.dots.length]; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); });
    faiBag(g, c, c + 6, c * 0.46);
    if (night) { g.fillStyle = "rgba(20,18,30,.35)"; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill(); }
  });
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow name="fai-tapete"><circleGeometry args={[radius, 64]} /><meshStandardMaterial map={tex} roughness={1} /></mesh>;
}

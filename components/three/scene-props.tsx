"use client";
import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useI18n, tr } from "@/lib/i18n/i18n";

/*
 * Objetos de cena procedurais, sem modelos externos: rótulo 3D, janela com a luz do horário, porta, abajur, brilho,
 * letreiro de neon e tapete FashionAI. Vieram do antigo Meu Quarto (components/room3d/room-props.tsx, retirado em
 * 15/11/2026) e hoje servem ao Afterparty (components/flair/afterparty-scene.tsx).
 */

const hover = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer"; },
  onPointerOut: () => { document.body.style.cursor = ""; },
};

/** Textura desenhada num canvas (rótulos, croqui, teia, post-it) — sem fonte remota. */
export function useCanvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  return useMemo(() => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!;
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }, [key, w, h]); // eslint-disable-line react-hooks/exhaustive-deps
}
export function textTex(text: string, o: { w?: number; h?: number; bg?: string; fg?: string; font?: string; align?: CanvasTextAlign } = {}) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, w, h); }
    g.fillStyle = o.fg ?? "#3a3a3a"; g.font = o.font ?? tr("sceneProps.label_font", { Math: Math.round(h * 0.42) }); g.textAlign = o.align ?? "center"; g.textBaseline = "middle";
    const lines = text.split("\n"); const lh = h / (lines.length + 0.4);
    lines.forEach((l, i) => g.fillText(l.length > 30 ? l.slice(0, 29) + "…" : l, o.align === "left" ? 8 : w / 2, lh * (i + 0.7)));
  };
}
export function Label3D({ text, w, h, px = 256, bg, fg, font, position, rotation }: { text: string; w: number; h: number; px?: number; bg?: string; fg?: string; font?: string; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const ph = Math.round(px * (h / w));
  const tex = useCanvasTex(`${text}|${bg}|${fg}|${font}|${px}`, px, Math.max(16, ph), textTex(text, { bg, fg, font }));
  return <mesh position={position} rotation={rotation}><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} transparent toneMapped={false} /></mesh>;
}

const SKY: Record<string, [string, string]> = { morning: ["#bcd8f2", "#e8f1fa"], afternoon: ["#f6d7a0", "#fbe9c6"], golden: ["#f29b58", "#f7c98b"], night: ["#141a36", "#2a2f58"], fixed: ["#dfe6ea", "#f1f3f4"] };
/**
 * Janela com a luz do horário real (DET-D02) e a decoração discreta das datas sazonais (DET-G07). `light={false}`: a 2ª
 * janela do quarto não acende outro holofote (uma luz por pixel a mais em toda a cena).
 */
export function RoomWindow({ position, period, seasonal, light = true }: { position: [number, number, number]; period: string; seasonal?: string | null; light?: boolean }) {
  const { t } = useI18n();
  const [a, b] = SKY[period] ?? SKY.fixed;
  const sky = useCanvasTex(`sky-${period}`, 128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (period === "night") { g.fillStyle = "#fffbe6"; g.beginPath(); g.arc(w * 0.72, h * 0.28, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = a; g.beginPath(); g.arc(w * 0.76, h * 0.25, 11, 0, Math.PI * 2); g.fill(); for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect((i * 37) % w, (i * 53) % (h * 0.6), 2, 2); } }
    else { g.fillStyle = "rgba(255,255,255,.75)"; [[0.25, 0.3], [0.62, 0.22]].forEach(([x, y]) => { g.beginPath(); g.ellipse(w * x, h * y, 18, 7, 0, 0, Math.PI * 2); g.fill(); }); }
  });
  return (
    <group position={position}>
      <mesh><planeGeometry args={[1.0, 1.1]} /><meshBasicMaterial map={sky} toneMapped={false} /></mesh>
      {/* caixilho */}
      {[[0, 0.56, 1.06, 0.04], [0, -0.56, 1.06, 0.04], [-0.51, 0, 0.04, 1.16], [0.51, 0, 0.04, 1.16], [0, 0, 0.025, 1.1], [0, 0.05, 1.0, 0.025]].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.012]}><boxGeometry args={[w, h, 0.03]} /><meshStandardMaterial color="#f4f1ea" roughness={0.6} /></mesh>))}
      <mesh position={[0, -0.6, 0.06]}><boxGeometry args={[1.12, 0.03, 0.14]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
      {/* cortinas */}
      {[-0.66, 0.66].map((x) => <mesh key={x} position={[x, 0.02, 0.05]}><boxGeometry args={[0.2, 1.3, 0.03]} /><meshStandardMaterial color={period === "night" ? "#4a4660" : "#d9cbb8"} roughness={1} /></mesh>)}
      {light && <WindowLight position={[0, 0, 0]} period={period} />}
      {seasonal === "festa_junina" && <group position={[0, 0.62, 0.08]}>{Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[-0.56 + i * 0.14, -0.04 - Math.sin((i / 8) * Math.PI) * 0.06, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.04, 0.07, 3]} /><meshStandardMaterial color={["#e63946", "#f4a261", "#2a9d8f", "#e9c46a", "#457b9d"][i % 5]} /></mesh>)}</group>}
      {seasonal === "fim_de_ano" && <group position={[0, 0.6, 0.08]}>{Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-0.55 + i * 0.1, -0.03 - Math.sin((i / 11) * Math.PI) * 0.05, 0]}><sphereGeometry args={[0.014, 8, 8]} /><meshStandardMaterial color={["#ffd166", "#ef476f", "#06d6a0"][i % 3]} emissive={["#ffd166", "#ef476f", "#06d6a0"][i % 3]} emissiveIntensity={0.9} /></mesh>)}</group>}
      {seasonal === "fashion_revolution_week" && <Label3D text={t("sceneProps.wear_what_you_have")} w={0.8} h={0.08} px={512} bg="#111" fg="#fff" position={[0, -0.72, 0.06]} />}
    </group>
  );
}

/**
 * Holofote da janela (o sol entrando; some à noite), com origem no meio da janela. No quarto de quatro paredes ele fica
 * fora da parede: escondida a parede atrás da câmera, a luz do quarto não apaga nem troca os shaders de todos os materiais.
 */
export function WindowLight({ position, period }: { position: [number, number, number]; period: string }) {
  const warm = period === "golden" || period === "afternoon";
  // o alvo do holofote fica dentro do grupo (na cena): fora dela a matriz dele nunca atualiza e a luz mira a origem
  const target = useMemo(() => new THREE.Object3D(), []);
  if (period === "night") return null;
  return (
    <group position={position} name="window-light">
      <primitive object={target} position={[0.4, -2, 2.5]} />
      <spotLight position={[0, 0.2, 0.3]} target={target} angle={0.6} penumbra={0.8} intensity={warm ? 2.2 : 1.2} color={warm ? "#ffcf8a" : "#dfeaff"} distance={6} />
    </group>
  );
}

/**
 * Porta do quarto, fechada: batente (montantes + travessa numa malha só), folha de madeira e maçaneta de latão — 3
 * chamadas de desenho, sem luz e sem sombra projetada. Origem no chão, no meio do vão; +z para dentro do quarto. A
 * dobradiça fica do lado esquerdo (do canto); o clique é opcional (a chave do quarto, como o gancho ao lado).
 */
export function RoomDoor({ position, rotation, onClick, night }: { position: [number, number, number]; rotation?: [number, number, number]; onClick?: () => void; night?: boolean }) {
  const frame = useMemo(() => {
    const part = (w: number, h: number, x: number, y: number) => new THREE.BoxGeometry(w, h, 0.1).translate(x, y, 0);
    return mergeGeometries([part(0.06, 2.11, -0.43, 1.055), part(0.06, 2.11, 0.43, 1.055), part(0.92, 0.06, 0, 2.08)])!;
  }, []);
  return (
    <group position={position} rotation={rotation} onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined} {...(onClick ? hover : {})}>
      <mesh geometry={frame} receiveShadow><meshStandardMaterial color={night ? "#c9c4b8" : "#f4f1ea"} roughness={0.6} /></mesh>
      <mesh position={[0, 1.025, 0.02]} receiveShadow><boxGeometry args={[0.8, 2.05, 0.04]} /><meshStandardMaterial color={night ? "#6e5a45" : "#b98f63"} roughness={0.7} /></mesh>
      <mesh position={[0.32, 1.0, 0.06]}><sphereGeometry args={[0.03, 16, 12]} /><meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.25} /></mesh>
    </group>
  );
}

/** Abajur da noite. */
export function Lamp({ position, on, intensity = 1 }: { position: [number, number, number]; on: boolean; intensity?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.012, 0.012, 0.6, 8]} /><meshStandardMaterial color="#C9A227" metalness={0.72} roughness={0.28} /></mesh>
      <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.1, 0.12, 0.02, 20]} /><meshStandardMaterial color="#1245a8" roughness={0.55} /></mesh>
      <mesh position={[0, 0.66, 0]}><cylinderGeometry args={[0.1, 0.16, 0.18, 24, 1, true]} /><meshStandardMaterial color="#f3e2c1" emissive={on ? "#ffcf8a" : "#000"} emissiveIntensity={on ? 0.9 : 0} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.57, 0]}><torusGeometry args={[0.13, 0.012, 8, 24]} /><meshStandardMaterial color="#f58220" roughness={0.4} /></mesh>
      {on && <pointLight position={[0, 0.6, 0]} intensity={2.2 * intensity} distance={3.5} color="#ffcf8a" />}
    </group>
  );
}

/** Brilho de conquista no espelho (Luzes do closet + marco novo). */
export function Sparkles({ count = 24, radius = 0.35, reduced }: { count?: number; radius?: number; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => { const p = new Float32Array(count * 3); for (let i = 0; i < count; i++) p.set([(Math.random() - 0.5) * radius * 2, Math.random() * radius * 3, 0.03], i * 3); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); return g; }, [count, radius]);
  useFrame(({ clock }) => { if (ref.current && !reduced) { (ref.current.material as THREE.PointsMaterial).opacity = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 5); ref.current.rotation.z = Math.sin(clock.elapsedTime) * 0.05; } });
  return <points ref={ref} geometry={geo}><pointsMaterial color="#ffe08a" size={0.03} transparent opacity={0.9} depthWrite={false} /></points>;
}

/** Marca (nome próprio, não se traduz) e as cores do logo: laranja, creme, marrom-escuro e os pontos da rede. */
const BRAND = { name: "FashionAI", short: "FAI", orange: "#f58220", neon: "#ff6a1a", cream: "#f3ead8", dark: "#2b2622", dots: ["#f5c518", "#1f7fc8", "#4c9a2a", "#f58220", "#7a4a2a"] } as const;

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

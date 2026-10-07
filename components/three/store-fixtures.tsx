"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rng, useCanvasTexture, useTex } from "@/components/three/common";
import type { BrandEnvironment } from "@/lib/tryon/fitting-room";
import type { SceneProduct, ZoneProfile } from "@/lib/scene3d/scene";

/*
 * Expositores da Loja 3D (plano mestre, seção 9.3): cada zona do resolvedor de cena vira um móvel de loja com as FOTOS
 * dos produtos da busca — parede de calçados, arara, mesa de jeans, vitrine de acessórios — mais o pedestal do produto
 * em destaque e a placa da zona. As cores vêm do perfil da marca; nada aqui decide marca ou zona.
 */

/** Foto do produto (fundo transparente das fotos normalizadas) com altura fixa; sem foto, um volume neutro. */
export function ProductImage({ url, height, position = [0, 0, 0], rotationY = 0, fallback = "#D9D4CC" }: { url?: string | null; height: number; position?: [number, number, number]; rotationY?: number; fallback?: string }) {
  const tex = useTex(url);
  const img = tex?.image as HTMLImageElement | undefined;
  const aspect = img?.width ? img.width / Math.max(1, img.height) : 1;
  const w = Math.min(height * aspect, height * 1.8);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {tex ? (
        <mesh position={[0, height / 2, 0]}><planeGeometry args={[w, w / aspect]} /><meshBasicMaterial map={tex} transparent alphaTest={0.04} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      ) : (
        <mesh position={[0, height * 0.3, 0]}><boxGeometry args={[height * 0.9, height * 0.6, height * 0.4]} /><meshStandardMaterial color={fallback} roughness={0.8} /></mesh>
      )}
    </group>
  );
}

/** Placa pendurada com o nome da zona (e a marca, pequena) na cor de destaque. */
export function ZoneSign({ label, brand, env, position, width = 1.5 }: { label: string; brand: string | null; env: BrandEnvironment; position: [number, number, number]; width?: number }) {
  const tex = useCanvasTexture((g, w, h) => {
    g.fillStyle = env.accent; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, h - 10, w, 10);
    const ink = pickInk(env.accent);
    g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
    let size = 96; g.font = `800 ${size}px Inter, Arial, sans-serif`;
    const text = label.toUpperCase();
    while (g.measureText(text).width > w * 0.9 && size > 30) { size -= 4; g.font = `800 ${size}px Inter, Arial, sans-serif`; }
    g.fillText(text, w / 2, brand ? h * 0.42 : h / 2);
    if (brand) { g.globalAlpha = 0.8; g.font = `600 40px Inter, Arial, sans-serif`; g.fillText(brand.toUpperCase(), w / 2, h * 0.8); g.globalAlpha = 1; }
  }, 1024, 256, [label, brand, env.accent]);
  return (
    <group position={position}>
      {[-width * 0.4, width * 0.4].map((x) => <mesh key={x} position={[x, 0.36, 0]}><cylinderGeometry args={[0.004, 0.004, 0.5, 6]} /><meshStandardMaterial color="#8A857C" metalness={0.8} roughness={0.3} /></mesh>)}
      <mesh><boxGeometry args={[width, width / 4, 0.03]} /><meshStandardMaterial color={env.accent} roughness={0.5} /></mesh>
      <mesh position={[0, 0, 0.017]}><planeGeometry args={[width * 0.98, width / 4 * 0.94]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  );
}

/** Texto escuro ou claro conforme a luminância do fundo (placas legíveis em qualquer cor de marca). */
export function pickInk(bg: string): string {
  const c = new THREE.Color(bg); const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return l > 0.45 ? "#141414" : "#FFFFFF";
}

/** Parede de calçados: prateleiras de acrílico retroiluminadas, um par por nicho. */
export function ShoeWall({ env, products, position }: { env: BrandEnvironment; products: SceneProduct[]; position: [number, number, number] }) {
  const cols = 3, rows = 3, cw = 0.52, rh = 0.4;
  const slots = Array.from({ length: cols * rows }, (_, i) => ({ c: i % cols, r: Math.floor(i / cols), p: products.length ? products[i % products.length] : null }));
  return (
    <group position={position}>
      {/* painel do fundo e moldura */}
      <mesh position={[0, 0.55 + (rows - 1) * rh / 2 + 0.1, -0.06]}><boxGeometry args={[cols * cw + 0.18, rows * rh + 0.3, 0.04]} /><meshStandardMaterial color={new THREE.Color(env.wall).lerp(new THREE.Color("#000"), 0.2)} roughness={0.7} /></mesh>
      <mesh position={[0, 0.55 + (rows - 1) * rh / 2 + 0.1, -0.035]}><planeGeometry args={[cols * cw + 0.06, rows * rh + 0.18]} /><meshBasicMaterial color={new THREE.Color(env.accent).lerp(new THREE.Color("#fff"), 0.82)} toneMapped={false} /></mesh>
      {slots.map(({ c, r, p }, i) => {
        const x = (c - (cols - 1) / 2) * cw, y = 0.55 + r * rh;
        return (
          <group key={i} position={[x, y, 0]}>
            <mesh position={[0, 0, 0.06]}><boxGeometry args={[cw * 0.86, 0.016, 0.2]} /><meshStandardMaterial color="#F5F7F8" transparent opacity={0.75} roughness={0.05} metalness={0.1} /></mesh>
            <mesh position={[0, -0.006, 0.161]}><boxGeometry args={[cw * 0.86, 0.006, 0.004]} /><meshBasicMaterial color={env.accent} toneMapped={false} /></mesh>
            {p && <ProductImage url={p.imageUrl} height={0.2} position={[0, 0.01, 0.07]} />}
          </group>
        );
      })}
      <pointLight position={[0, 1.4, 0.6]} intensity={1.1} distance={2.4} color="#FFF4E2" />
    </group>
  );
}

/** Arara de loja: barra cromada com cabides e as peças da busca penduradas, uma ao lado da outra. */
export function GarmentRack({ env, products, position, rotationY = 0 }: { env: BrandEnvironment; products: SceneProduct[]; position: [number, number, number]; rotationY?: number }) {
  const n = Math.min(6, products.length);
  const span = 1.7;
  if (!n) return null;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[-span / 2 - 0.06, span / 2 + 0.06].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.84, 0]}><cylinderGeometry args={[0.016, 0.016, 1.68, 10]} /><meshStandardMaterial color="#B9B5AE" metalness={0.9} roughness={0.18} /></mesh>
          <mesh position={[x, 0.02, 0]}><boxGeometry args={[0.05, 0.03, 0.46]} /><meshStandardMaterial color="#2A2B2F" /></mesh>
        </group>
      ))}
      <mesh position={[0, 1.66, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.014, 0.014, span + 0.14, 10]} /><meshStandardMaterial color="#B9B5AE" metalness={0.9} roughness={0.18} /></mesh>
      {Array.from({ length: n }, (_, i) => {
        const p = products[i]; const x = -span / 2 + (i + 0.5) * (span / n);
        return (
          <group key={i} position={[x, 1.62, 0]}>
            <mesh position={[0, 0.0, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.035, 0.004, 6, 14, Math.PI * 1.4]} /><meshStandardMaterial color="#8C877E" metalness={0.7} roughness={0.3} /></mesh>
            <mesh position={[0, -0.06, 0]}><boxGeometry args={[0.32, 0.012, 0.02]} /><meshStandardMaterial color="#6B4E37" roughness={0.6} /></mesh>
            {p && <ProductImage url={p.imageUrl} height={0.6} position={[0, -0.7, 0.012]} />}
          </group>
        );
      })}
    </group>
  );
}

/** Mesa de jeans: madeira, pilhas dobradas nas cores das peças e a foto de cada uma em pé, como na loja. */
export function DenimTable({ env, products, position, rotationY = 0 }: { env: BrandEnvironment; products: SceneProduct[]; position: [number, number, number]; rotationY?: number }) {
  const r = useMemo(() => rng(env.key.length * 31 + 5), [env.key]);
  const stacks = useMemo(() => Array.from({ length: 4 }, (_, i) => ({ x: -0.48 + i * 0.32, h: 3 + Math.floor(r() * 3), tone: ["#2F4B78", "#3C5A86", "#1F3354", "#6F8DB8"][i % 4] })), [r]);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow><boxGeometry args={[1.4, 0.05, 0.7]} /><meshStandardMaterial color="#8A6243" roughness={0.55} /></mesh>
      {[[-0.64, -0.3], [0.64, -0.3], [-0.64, 0.3], [0.64, 0.3]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 0.36, z]}><boxGeometry args={[0.05, 0.72, 0.05]} /><meshStandardMaterial color="#5E412B" /></mesh>)}
      {stacks.map((s, i) => (
        <group key={i} position={[s.x, 0.765, 0.12]}>
          {Array.from({ length: s.h }, (_, k) => <mesh key={k} position={[0, 0.022 + k * 0.042, 0]} castShadow><boxGeometry args={[0.28, 0.038, 0.22]} /><meshStandardMaterial color={new THREE.Color(s.tone).offsetHSL(0, 0, (k % 2) * 0.03)} roughness={0.9} /></mesh>)}
        </group>
      ))}
      {products.slice(0, 3).map((p, i) => <ProductImage key={p.id} url={p.imageUrl} height={0.42} position={[-0.42 + i * 0.42, 0.77, -0.18]} />)}
      <mesh position={[0, 0.766, 0.36]}><boxGeometry args={[1.4, 0.012, 0.012]} /><meshBasicMaterial color={env.accent} toneMapped={false} /></mesh>
    </group>
  );
}

/** Vitrine de vidro para acessórios: base iluminada e os produtos em suportes, com tampo de vidro. */
export function Vitrine({ env, products, position, rotationY = 0 }: { env: BrandEnvironment; products: SceneProduct[]; position: [number, number, number]; rotationY?: number }) {
  const items = products.slice(0, 4);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow><boxGeometry args={[1.3, 0.84, 0.56]} /><meshStandardMaterial color="#ECE7DF" roughness={0.35} /></mesh>
      <mesh position={[0, 0.06, 0.282]}><boxGeometry args={[1.3, 0.12, 0.01]} /><meshStandardMaterial color={env.accent} roughness={0.5} /></mesh>
      <mesh position={[0, 0.845, 0]}><boxGeometry args={[1.26, 0.01, 0.52]} /><meshBasicMaterial color={new THREE.Color(env.accent).lerp(new THREE.Color("#fff"), 0.7)} toneMapped={false} /></mesh>
      {items.map((p, i) => (
        <group key={p.id} position={[-0.45 + i * 0.3, 0.85, 0]}>
          <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.07, 0.08, 0.06, 24]} /><meshStandardMaterial color="#F2EFEA" roughness={0.3} /></mesh>
          <ProductImage url={p.imageUrl} height={0.22} position={[0, 0.06, 0]} />
        </group>
      ))}
      {/* caixa de vidro */}
      <mesh position={[0, 1.08, 0]}><boxGeometry args={[1.3, 0.46, 0.56]} /><meshPhysicalMaterial color="#ffffff" transmission={0.92} thickness={0.02} roughness={0.04} transparent opacity={0.22} depthWrite={false} /></mesh>
      <pointLight position={[0, 1.2, 0.2]} intensity={0.9} distance={1.6} color="#FFF8EE" />
    </group>
  );
}

/** Pedestal do produto em destaque: girando devagar, com anel na cor da marca, foco de luz e etiqueta com nome e preço. */
export function HeroPedestal({ env, product, position, reduced, label }: { env: BrandEnvironment; product: SceneProduct; position: [number, number, number]; reduced: boolean; label: string }) {
  const spin = useRef<THREE.Group>(null);
  // balanço suave em vez de giro completo: a foto do produto nunca fica de perfil (plano visto de lado)
  useFrame(({ clock }) => { if (spin.current && !reduced) spin.current.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.45; });
  const tag = useCanvasTexture((g, w, h) => {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h); g.fillStyle = env.accent; g.fillRect(0, 0, 14, h);
    g.fillStyle = "#6B6B6B"; g.font = "600 34px Inter, Arial, sans-serif"; g.textBaseline = "middle"; g.fillText(label.toUpperCase(), 36, h * 0.26);
    g.fillStyle = "#141414"; let size = 50; g.font = `800 ${size}px Inter, Arial, sans-serif`;
    const raw = product.name ?? ""; const name = raw.length > 28 ? raw.slice(0, 27) + "…" : raw;
    while (g.measureText(name).width > w - 60 && size > 26) { size -= 2; g.font = `800 ${size}px Inter, Arial, sans-serif`; }
    g.fillText(name, 36, h * 0.56);
    if (product.price) { g.fillStyle = env.accent === "#FFFFFF" ? "#141414" : env.accent; g.font = "800 40px Inter, Arial, sans-serif"; g.fillText(product.price, 36, h * 0.83); }
  }, 768, 220, [product.name, product.price, env.accent, label]);
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow><cylinderGeometry args={[0.26, 0.3, 0.9, 48]} /><meshStandardMaterial color="#F4F1EC" roughness={0.3} /></mesh>
      <mesh position={[0, 0.905, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.2, 0.25, 48]} /><meshBasicMaterial color={env.accent} toneMapped={false} /></mesh>
      <group ref={spin} position={[0, 0.92, 0]}><ProductImage url={product.imageUrl} height={0.36} /></group>
      <mesh position={[0, 0.5, 0.305]}><planeGeometry args={[0.5, 0.143]} /><meshBasicMaterial map={tag} toneMapped={false} /></mesh>
      <spotLight position={[0, 2.6, 0.6]} angle={0.28} penumbra={0.5} intensity={6} distance={4} color="#FFFFFF" target-position={[position[0], 0.9, position[2]]} />
    </group>
  );
}

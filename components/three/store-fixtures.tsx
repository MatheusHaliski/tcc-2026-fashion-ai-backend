"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { useCanvasTexture, useTex } from "@/components/three/common";
import type { BrandEnvironment } from "@/lib/tryon/fitting-room";
import type { SceneProduct } from "@/lib/scene3d/scene";

/*
 * Expositores da loja do provador (lib/scene3d/store-plan.ts). Regra: foto de catálogo é FOTOGRAFIA num suporte
 * deliberado — quadro com passe-partout, bloco acrílico na prateleira, cartão em cavalete — com verso de papel/madeira
 * (nunca a estampa espelhada vista de trás), parada (nada gira nem flutua). Produto exposto em 3D exige asset 3D
 * aprovado; enquanto não houver, a loja expõe as fotos assim. As cores vêm do perfil da loja; nada aqui decide marca.
 */

type V3 = [number, number, number];

/** Texto escuro ou claro conforme a luminância do fundo (placas legíveis em qualquer cor de marca). */
export function pickInk(bg: string): string {
  const c = new THREE.Color(bg); const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return l > 0.45 ? "#141414" : "#FFFFFF";
}

/** Cartão com o nome do produto quando a foto não carrega (ex.: imagem externa sem CORS): nunca um volume falso. */
function useNameCard(name: string) {
  return useCanvasTexture((g, w, h) => {
    g.fillStyle = "#F4F1EC"; g.fillRect(0, 0, w, h); g.fillStyle = "#6B6B6B"; g.textAlign = "center"; g.textBaseline = "middle";
    let size = 44; g.font = `700 ${size}px Inter, Arial, sans-serif`; const text = name.length > 30 ? `${name.slice(0, 29)}…` : name;
    while (g.measureText(text).width > w * 0.86 && size > 20) { size -= 2; g.font = `700 ${size}px Inter, Arial, sans-serif`; }
    g.fillText(text, w / 2, h / 2);
  }, 512, 512, [name]);
}

/**
 * Fotografia do produto num quadro: moldura (caixa), passe-partout claro, a foto só na face da frente (contida, sem
 * esticar) e o verso na cor da moldura. `w`×`h` é o tamanho externo; a foto ocupa o miolo.
 */
export function PhotoPrint({ product, w, h, position = [0, 0, 0], rotationY = 0, frame = "#2B2B2E", mat = "#FAF8F4", depth = 0.02 }: { product: SceneProduct; w: number; h: number; position?: V3; rotationY?: number; frame?: string; mat?: string; depth?: number }) {
  const tex = useTex(product.imageUrl);
  const fallback = useNameCard(product.name ?? "");
  const img = tex?.image as { width: number; height: number } | undefined;
  const aspect = img?.width ? img.width / Math.max(1, img.height) : 1;
  const iw = w * 0.82, ih = h * 0.82;
  const [pw, ph] = aspect > iw / ih ? [iw, iw / aspect] : [ih * aspect, ih];
  return (
    <group position={position} rotation={[0, rotationY, 0]} userData={{ fixture: "foto-em-suporte", productId: product.id }}>
      <mesh castShadow><boxGeometry args={[w, h, depth]} /><meshStandardMaterial color={frame} roughness={0.5} /></mesh>
      <mesh position={[0, 0, depth / 2 + 0.001]}><planeGeometry args={[w * 0.92, h * 0.92]} /><meshStandardMaterial color={mat} roughness={0.9} /></mesh>
      <mesh position={[0, 0, depth / 2 + 0.002]}>
        <planeGeometry args={tex ? [pw, ph] : [iw, ih]} />
        <meshBasicMaterial map={tex ?? fallback} transparent alphaTest={0.04} toneMapped={false} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

/** Bloco acrílico de pé (prateleira de calçados, mesa, nicho): a foto dentro de um bloco transparente com base. */
export function PhotoBlock({ product, size, position = [0, 0, 0], rotationY = 0 }: { product: SceneProduct; size: number; position?: V3; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.006, 0]}><boxGeometry args={[size * 1.02, 0.012, size * 0.42]} /><meshStandardMaterial color="#2B2B2E" roughness={0.4} /></mesh>
      <PhotoPrint product={product} w={size} h={size * 0.8} position={[0, 0.012 + size * 0.4, 0]} frame="#EDEFF2" mat="#FFFFFF" depth={size * 0.12} />
    </group>
  );
}

/** Placa pendurada com o nome da zona (e a marca, pequena) na cor de destaque. */
export function ZoneSign({ label, brand, env, position, width = 1.5 }: { label: string; brand: string | null; env: BrandEnvironment; position: V3; width?: number }) {
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

/** Prateleiras de calçados (acrílico retroiluminado): um bloco com a foto do par por nicho, até 6. */
export function ShoeShelves({ env, products, position }: { env: BrandEnvironment; products: SceneProduct[]; position: V3 }) {
  const cols = 3, rows = 2, cw = 0.54, rh = 0.42, y0 = 0.72;
  const items = products.slice(0, cols * rows);
  return (
    <group position={position}>
      <mesh position={[0, y0 + (rows - 1) * rh / 2 + 0.12, -0.06]}><boxGeometry args={[cols * cw + 0.18, rows * rh + 0.5, 0.04]} /><meshStandardMaterial color={new THREE.Color(env.wall).lerp(new THREE.Color("#000"), 0.2)} roughness={0.7} /></mesh>
      <mesh position={[0, y0 + (rows - 1) * rh / 2 + 0.12, -0.035]}><planeGeometry args={[cols * cw + 0.06, rows * rh + 0.38]} /><meshBasicMaterial color={new THREE.Color(env.accent).lerp(new THREE.Color("#fff"), 0.85)} toneMapped={false} /></mesh>
      {Array.from({ length: cols * rows }, (_, i) => {
        const c = i % cols, r = Math.floor(i / cols); const x = (c - (cols - 1) / 2) * cw, y = y0 + r * rh; const p = items[i];
        return (
          <group key={i} position={[x, y, 0]}>
            <mesh position={[0, 0, 0.06]}><boxGeometry args={[cw * 0.88, 0.016, 0.22]} /><meshStandardMaterial color="#F5F7F8" transparent opacity={0.8} roughness={0.05} metalness={0.1} /></mesh>
            {p && <PhotoBlock product={p} size={0.3} position={[0, 0.008, 0.07]} />}
          </group>
        );
      })}
      <pointLight position={[0, 1.5, 0.5]} intensity={0.9} distance={1.5} color="#FFF4E2" />
    </group>
  );
}

/** Quadros da zona (roupas sem asset 3D): painel ripado na parede com as fotos em quadros, 3 × 2, lado a lado. */
export function ZonePhotoWall({ env, products, position }: { env: BrandEnvironment; products: SceneProduct[]; position: V3 }) {
  const items = products.slice(0, 6); const cols = 3, fw = 0.46, fh = 0.58, gap = 0.08;
  const slat = useMemo(() => new THREE.Color(env.wall).lerp(new THREE.Color(env.style === "heritage" ? "#6B4A32" : "#000"), 0.18).getStyle(), [env.wall, env.style]);
  return (
    <group position={position}>
      <mesh position={[0, 1.36, -0.02]} receiveShadow><boxGeometry args={[cols * (fw + gap) + 0.14, 2 * (fh + gap) + 0.16, 0.03]} /><meshStandardMaterial color={slat} roughness={0.8} /></mesh>
      {items.map((p, i) => {
        const c = i % cols, r = Math.floor(i / cols); const x = (c - (cols - 1) / 2) * (fw + gap), y = 1.68 - r * (fh + gap);
        return <PhotoPrint key={p.id} product={p} w={fw} h={fh} position={[x, y, 0.01]} frame="#1F1F22" />;
      })}
      <pointLight position={[0, 2.3, 0.6]} intensity={0.8} distance={1.6} color="#FFF6EA" />
    </group>
  );
}

/** Mesa de exposição: madeira, com as fotos em blocos acrílicos de pé (sem pilhas de "produto" falsas). */
export function PhotoTable({ env, products, position, rotationY = 0 }: { env: BrandEnvironment; products: SceneProduct[]; position: V3; rotationY?: number }) {
  const items = products.slice(0, 4);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow><boxGeometry args={[1.4, 0.04, 0.7]} /><meshStandardMaterial color="#8A6243" roughness={0.55} /></mesh>
      {[[-0.64, -0.3], [0.64, -0.3], [-0.64, 0.3], [0.64, 0.3]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 0.36, z]}><boxGeometry args={[0.05, 0.72, 0.05]} /><meshStandardMaterial color="#5E412B" /></mesh>)}
      {items.map((p, i) => <PhotoBlock key={p.id} product={p} size={0.28} position={[-0.48 + i * 0.32, 0.76, (i % 2) * 0.12 - 0.06]} />)}
      <mesh position={[0, 0.762, 0.352]}><boxGeometry args={[1.4, 0.012, 0.004]} /><meshBasicMaterial color={env.accent} toneMapped={false} /></mesh>
    </group>
  );
}

/** Nicho de acessórios: balcão com tampo de vidro e as fotos em blocos dentro da caixa iluminada. */
export function AccessoryNiche({ env, products, position, rotationY = 0 }: { env: BrandEnvironment; products: SceneProduct[]; position: V3; rotationY?: number }) {
  const items = products.slice(0, 4);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow><boxGeometry args={[1.3, 0.9, 0.56]} /><meshStandardMaterial color="#ECE7DF" roughness={0.35} /></mesh>
      <mesh position={[0, 0.06, 0.282]}><boxGeometry args={[1.3, 0.12, 0.01]} /><meshStandardMaterial color={env.accent} roughness={0.5} /></mesh>
      <mesh position={[0, 0.905, 0]}><boxGeometry args={[1.26, 0.01, 0.52]} /><meshBasicMaterial color={new THREE.Color(env.accent).lerp(new THREE.Color("#fff"), 0.75)} toneMapped={false} /></mesh>
      {items.map((p, i) => <PhotoBlock key={p.id} product={p} size={0.22} position={[-0.45 + i * 0.3, 0.91, 0]} />)}
      <mesh position={[0, 1.13, 0]}><boxGeometry args={[1.3, 0.44, 0.56]} /><meshPhysicalMaterial color="#ffffff" transmission={0.92} thickness={0.02} roughness={0.04} transparent opacity={0.18} depthWrite={false} /></mesh>
      <pointLight position={[0, 1.25, 0.2]} intensity={0.8} distance={1.2} color="#FFF8EE" />
    </group>
  );
}

/** Produto escolhido: a foto em quadro num cavalete de piso, com a etiqueta (nome e preço). Parado, iluminado. */
export function FeaturedPrint({ env, product, position, rotationY = 0, label }: { env: BrandEnvironment; product: SceneProduct; position: V3; rotationY?: number; label: string }) {
  const tag = useCanvasTexture((g, w, h) => {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h); g.fillStyle = env.accent; g.fillRect(0, 0, 14, h);
    g.fillStyle = "#6B6B6B"; g.font = "600 34px Inter, Arial, sans-serif"; g.textBaseline = "middle"; g.fillText(label.toUpperCase(), 36, h * 0.26);
    g.fillStyle = "#141414"; let size = 50; g.font = `800 ${size}px Inter, Arial, sans-serif`;
    const raw = product.name ?? ""; const name = raw.length > 28 ? raw.slice(0, 27) + "…" : raw;
    while (g.measureText(name).width > w - 60 && size > 26) { size -= 2; g.font = `800 ${size}px Inter, Arial, sans-serif`; }
    g.fillText(name, 36, h * 0.56);
    // preço na cor de destaque; destaque claro demais para o fundo branco sai em texto escuro
    if (product.price) { g.fillStyle = pickInk(env.accent) === "#141414" ? "#141414" : env.accent; g.font = "800 40px Inter, Arial, sans-serif"; g.fillText(product.price, 36, h * 0.83); }
  }, 768, 220, [product.name, product.price, env.accent, label]);
  const wood = "#6E5440";
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* cavalete: duas pernas da frente, uma de trás e a travessa onde o quadro apoia */}
      {[-0.2, 0.2].map((x) => <mesh key={x} position={[x, 0.66, 0.04]} rotation={[-0.12, 0, 0]} castShadow><boxGeometry args={[0.03, 1.32, 0.03]} /><meshStandardMaterial color={wood} roughness={0.6} /></mesh>)}
      <mesh position={[0, 0.62, -0.16]} rotation={[0.28, 0, 0]}><boxGeometry args={[0.03, 1.26, 0.03]} /><meshStandardMaterial color={wood} roughness={0.6} /></mesh>
      <mesh position={[0, 0.62, 0.11]}><boxGeometry args={[0.5, 0.035, 0.06]} /><meshStandardMaterial color={wood} roughness={0.6} /></mesh>
      <group position={[0, 0.95, 0.08]} rotation={[-0.12, 0, 0]}><PhotoPrint product={product} w={0.44} h={0.56} frame="#1F1F22" /></group>
      <mesh position={[0, 0.48, 0.14]} rotation={[-0.12, 0, 0]}><planeGeometry args={[0.44, 0.126]} /><meshBasicMaterial map={tag} toneMapped={false} /></mesh>
      <spotLight position={[0, 2.6, 0.9]} angle={0.25} penumbra={0.5} intensity={5} distance={3.2} color="#FFFFFF" target-position={[position[0], 0.9, position[2]]} />
    </group>
  );
}

/** Porta dos provadores: batente e folha a 2,10 m — a referência de escala da sala. */
export function FittingDoor({ env, position, label }: { env: BrandEnvironment; position: V3; label: string }) {
  const sign = useCanvasTexture((g, w, h) => {
    g.fillStyle = "#141414"; g.fillRect(0, 0, w, h); g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "700 64px Inter, Arial, sans-serif"; g.fillText(label.toUpperCase(), w / 2, h / 2);
  }, 512, 128, [label]);
  const leaf = new THREE.Color(env.wall).lerp(new THREE.Color(env.style === "heritage" ? "#5B3E29" : "#9A948A"), 0.5).getStyle();
  return (
    <group position={position}>
      {[-0.47, 0.47].map((x) => <mesh key={x} position={[x, 1.05, 0.03]}><boxGeometry args={[0.06, 2.16, 0.08]} /><meshStandardMaterial color="#2A2B2F" roughness={0.5} /></mesh>)}
      <mesh position={[0, 2.13, 0.03]}><boxGeometry args={[1.0, 0.06, 0.08]} /><meshStandardMaterial color="#2A2B2F" roughness={0.5} /></mesh>
      <mesh position={[0, 1.05, 0.01]}><boxGeometry args={[0.88, 2.1, 0.03]} /><meshStandardMaterial color={leaf} roughness={0.7} /></mesh>
      <mesh position={[0.34, 1.0, 0.035]}><boxGeometry args={[0.02, 0.18, 0.02]} /><meshStandardMaterial color="#C9C4BA" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, 2.3, 0.03]}><planeGeometry args={[0.6, 0.15]} /><meshBasicMaterial map={sign} toneMapped={false} /></mesh>
    </group>
  );
}

/** Banco de prova (assento a 0,45 m) para calçar e sentar. */
export function FittingBench({ env, position }: { env: BrandEnvironment; position: V3 }) {
  const top = env.style === "heritage" ? "#7A5236" : "#3B3D42";
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} castShadow><boxGeometry args={[1.1, 0.06, 0.42]} /><meshStandardMaterial color={top} roughness={0.6} /></mesh>
      <mesh position={[0, 0.455, 0]}><boxGeometry args={[1.06, 0.012, 0.38]} /><meshStandardMaterial color="#D9D3CA" roughness={0.9} /></mesh>
      {[-0.48, 0.48].map((x) => <mesh key={x} position={[x, 0.2, 0]}><boxGeometry args={[0.06, 0.4, 0.38]} /><meshStandardMaterial color="#2A2B2F" /></mesh>)}
    </group>
  );
}

/**
 * Foto do produto em pé num bloco (vitrines das mini lojas e expositores): mantido para quem já usa; desenha a foto num
 * suporte (bloco com base), nunca solta no ar.
 */
export function ProductImage({ url, height, position = [0, 0, 0], rotationY = 0 }: { url?: string | null; height: number; position?: V3; rotationY?: number; fallback?: string }) {
  const product = useMemo<SceneProduct>(() => ({ id: url ?? "sem-foto", name: "", imageUrl: url ?? null }), [url]);
  return <PhotoBlock product={product} size={height} position={position} rotationY={rotationY} />;
}

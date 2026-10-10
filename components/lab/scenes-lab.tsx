"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Look3dPiece } from "@/components/three/common";
import { resolveEnvironment, type FittingItem, type LightMode } from "@/lib/tryon/fitting-room";
import { resolveScene, type SceneContext, type SceneProduct } from "@/lib/scene3d/scene";
import type { AvatarView } from "@/components/three/avatar-viewer";
import type { FittingStudioProfile } from "@/lib/scene3d/fitting-studio";
import { ACERVO, acervoLook } from "@/lib/tryon/acervo";
import { setFitMode } from "@/lib/avatar3d/human/garment-fit";
import { DEFAULT_BODY, type BodyParams } from "@/lib/avatar3d/body-spec";
import type { SceneDebugOptions } from "@/components/three/scene-debug";

/*
 * Laboratório das cenas de loja com dados de EXEMPLO (marcas e artista fictícios, manequim padrão sem rosto de pessoa):
 * serve para comparar versões e fotografar as cenas sem backend. `?s=` escolhe o cenário.
 */
const FittingRoomScene = dynamic(() => import("@/components/three/fitting-room-scene"), { ssr: false });
const StoreStreetScene = dynamic(() => import("@/components/three/store-street-scene"), { ssr: false });
const StageScene = dynamic(() => import("@/components/three/stage-scene"), { ssr: false });

const IMG = (n: string) => `/_derived/pecas_thumb/${n}-640.webp`;
const piece = (id: string, name: string, slot: string, category: string, subcategory: string, img: string, colorHex: string): Look3dPiece =>
  ({ id, name, slot, category, subcategory, imageUrl: IMG(img), colorHex });
export const LAB_LOOK: Look3dPiece[] = [
  piece("p1", "Camiseta básica", "upper_piece", "upper_piece", "t_shirt", "01_parte_superior_01_camiseta_referencia", "#F2F0EA"),
  piece("p2", "Jeans reto", "lower_piece", "lower_piece", "jeans", "02_parte_inferior_01_jeans", "#3C5A86"),
  piece("p3", "Tênis casual", "shoes_piece", "shoes_piece", "sneakers", "03_calcados_01_tenis_casual", "#EDEDED"),
];
/**
 * Peças do laboratório por id: do acervo (id parcial) ou `cor-<vermelha|branca|preta|estampada>` — a camiseta de
 * referência recolorida (public/lab/cores, scripts/tryon/make-color-fixtures.py) para o teste de cor (PROVADOR-3D §6).
 */
function labLook(ids: string): Look3dPiece[] | null {
  const list = ids.split(",").filter(Boolean).map((id): Look3dPiece | null => {
    if (id.startsWith("cor-")) return { id: `lab-${id}`, name: id, slot: "upper_piece", category: "upper_piece", subcategory: "t_shirt", imageUrl: `/lab/cores/camiseta-${id.slice(4)}.webp` };
    if (id.startsWith("camisa-")) return { id: `lab-${id}`, name: `Camisa ${id.slice(7)}`, slot: "upper_piece", category: "upper_piece", subcategory: "shirt", imageUrl: `/lab/cores/${id}.webp` };
    const p = ACERVO.find((x) => x.id.includes(id)); return p ? acervoLook(p) : null;
  }).filter((p): p is Look3dPiece => !!p);
  return list.length ? list : null;
}
const item = (key: string, brand: string, slot: FittingItem["slot"], category: string, addedAt: number): FittingItem =>
  ({ key, source: "catalog", slot, wear: slot === "lower_piece" ? "BOTTOM" : slot === "shoes_piece" ? "SHOES" : "TOP", name: key, brand: { name: brand }, category, addedAt });

const prod = (id: string, name: string, category: string, subcategory: string, img: string, price: string): SceneProduct => ({ id, name, category, subcategory, imageUrl: IMG(img), price });
const SHOES = [
  prod("s1", "Tênis Casual Aero", "shoes_piece", "casual_sneakers", "03_calcados_01_tenis_casual", "R$ 399,90"),
  prod("s2", "Tênis Corrida Pulse", "shoes_piece", "running_shoes", "03_calcados_02_tenis_corrida", "R$ 549,90"),
  prod("s3", "Tênis Treino Core", "shoes_piece", "training_shoes", "03_calcados_03_tenis_treino", "R$ 459,90"),
  prod("s4", "Tênis Skate Grip", "shoes_piece", "skate_shoes", "03_calcados_04_tenis_skate", "R$ 379,90"),
  prod("s5", "Tênis Cano Alto", "shoes_piece", "high_top_sneakers", "03_calcados_06_tenis_cano_alto", "R$ 499,90"),
  prod("s6", "Tênis Quadra", "shoes_piece", "casual_sneakers", "03_calcados_07_tenis_basquete", "R$ 629,90"),
];
const BOTTOMS = [
  prod("b1", "Jeans Reto Índigo", "lower_piece", "jeans", "02_parte_inferior_01_jeans", "R$ 289,90"),
  prod("b2", "Shorts Jeans", "lower_piece", "denim_shorts", "02_parte_inferior_11_shorts_jeans", "R$ 189,90"),
  prod("b3", "Jeans Reto Escuro", "lower_piece", "jeans", "02_parte_inferior_01_jeans", "R$ 299,90"),
  prod("b4", "Calça Cargo", "lower_piece", "cargo_pants", "02_parte_inferior_04_calca_cargo", "R$ 259,90"),
  prod("b5", "Calça Chino", "lower_piece", "chino_pants", "02_parte_inferior_05_calca_chino", "R$ 239,90"),
];
const TOPS = [
  prod("t1", "Camiseta Essencial", "upper_piece", "t_shirt", "01_parte_superior_01_camiseta_referencia", "R$ 99,90"),
  prod("t2", "Camisa Linho", "upper_piece", "shirt", "01_parte_superior_02_shirt_camisa", "R$ 219,90"),
  prod("t3", "Polo Piquet", "upper_piece", "polo_shirt", "01_parte_superior_06_polo_shirt_camisa_polo", "R$ 169,90"),
  prod("t4", "Moletom Capuz", "upper_piece", "hoodie", "01_parte_superior_10_hoodie_moletom_com_capuz", "R$ 279,90"),
  prod("t5", "Suéter Tricô", "upper_piece", "sweater", "01_parte_superior_08_sweater_sueter", "R$ 239,90"),
  prod("t6", "Regata Básica", "upper_piece", "t_shirt", "01_parte_superior_04_tank_top_regata", "R$ 79,90"),
];
const BAGS = [
  prod("a1", "Bolsa de Mão Lumi", "accessory_piece", "crossbody_bag", "04_acessorios_02_bolsa_mao", "R$ 689,00"),
  prod("a2", "Transversal Mini", "accessory_piece", "crossbody_bag", "04_acessorios_01_bolsa_transversal", "R$ 459,00"),
  prod("a3", "Clutch Noite", "accessory_piece", "clutch", "04_acessorios_03_clutch", "R$ 389,00"),
  prod("a4", "Tote Diária", "accessory_piece", "tote_bag", "04_acessorios_04_tote", "R$ 529,00"),
  prod("a5", "Mochila Urbana", "accessory_piece", "backpack", "04_acessorios_05_mochila", "R$ 599,00"),
];
/** Cenários do provador: o que a Busca Catalogada teria no estado (marca, categoria, subcategoria, produto, resultados). */
const FITTING: Record<string, SceneContext> = {
  "fitting-sneakers": { brand: { name: "Norte Sport" }, category: "shoes_piece", subcategory: "casual_sneakers", product: SHOES[0], results: SHOES },
  "fitting-denim": { category: "lower_piece", subcategory: "jeans", product: BOTTOMS[0], results: BOTTOMS },
  "fitting-bags": { brand: { name: "Atelier Lumi" }, category: "accessory_piece", subcategory: "crossbody_bag", product: BAGS[0], results: BAGS },
  "fitting-tops": { brand: { name: "Costa Linho" }, category: "upper_piece", results: TOPS },
};

/** Inventário dos objetos da cena (função de cada um) para o script de capturas: o mesmo plano que a cena desenha. */
function publishProfile(p: FittingStudioProfile) {
  // inventário do estúdio para a auditoria: objetos com função, paleta e as fotos de referência (só ids)
  (window as unknown as { __sceneInventory: unknown }).__sceneInventory = { interpretation: p.interpretation, brand: p.brand.key, palette: p.palette, objects: p.objects, photographs: p.photographs.map((x) => x.id) };
}

export default function ScenesLab() {
  const [s, setS] = useState("fitting-brand");
  const [view, setView] = useState<AvatarView>("front");
  // auditoria do vestir: ?pieces=<ids do acervo | cor-*>&body=F-ref|M-ref|F-plus|M-slim&debug=wire|sem-corpo|pesos&pose=bracos|caminhada|caminhada-animada|agachamento&yaw=<graus>&close=1&fit=antes&light=daylight|store|night&variation=SLIM&neckline=V_NECK
  const [lab, setLab] = useState<{ pieces: Look3dPiece[] | null; sex: "FEMININO" | "MASCULINO"; body: BodyParams | null; debug: SceneDebugOptions | null; yaw?: number; close: boolean; light: LightMode; ready: boolean }>({ pieces: null, sex: "FEMININO", body: null, debug: null, close: false, light: "store", ready: false });
  useEffect(() => {
    const q = new URLSearchParams(location.search); if (q.get("s")) setS(q.get("s")!);
    const v = q.get("view"); if (v && ["front", "left34", "right34", "profile", "back"].includes(v)) setView(v as AvatarView);
    setFitMode(q.get("fit") === "antes" ? "antes" : "depois");
    // variation=SLIM|REGULAR|OVERSIZED… força a classe de caimento em todas as peças (auditoria: regata "justa" do catálogo)
    // neckline=V_NECK|SCOOP|… força a dimensão NECKLINE (auditoria do decote: "Decote V" do catálogo)
    const variation = q.get("variation"), neckline = q.get("neckline");
    const pieces = labLook(q.get("pieces") ?? "")?.map((p) => ({ ...p, ...(variation ? { variation } : {}), ...(neckline ? { attributes: { ...(p.attributes ?? {}), NECKLINE: [neckline] } } : {}) })) ?? null;
    const lq = q.get("light"); const light: LightMode = lq === "daylight" || lq === "night" ? lq : "store";
    const b = q.get("body") ?? "F-ref"; const sex = b.startsWith("M") ? "MASCULINO" : "FEMININO";
    const body = b === "F-plus" ? { ...DEFAULT_BODY.FEMININO, stature: 1.66, build: 1.4 } : b === "M-slim" ? { ...DEFAULT_BODY.MASCULINO, stature: 1.82, build: -0.8 } : null;
    const dv = q.get("debug"), pose = q.get("pose");
    const debug = dv || pose ? { view: (dv ?? "normal") as SceneDebugOptions["view"], pose: (pose ?? null) as SceneDebugOptions["pose"] } : null;
    const yaw = q.get("yaw"); setLab({ pieces, sex, body, debug, yaw: yaw !== null ? Number(yaw) : undefined, close: q.get("close") === "1", light, ready: true });
  }, []);
  // controle do script de capturas: muda ângulo, depuração, pose, luz e peças (look) sem recarregar a cena
  useEffect(() => {
    (window as unknown as { __lab: unknown }).__lab = {
      set: ({ look, ...patch }: { yaw?: number; debug?: SceneDebugOptions | null; close?: boolean; light?: LightMode; look?: string }) =>
        setLab((l) => ({ ...l, ...patch, ...(look !== undefined ? { pieces: labLook(look) } : {}) })),
      canvas: () => (document.querySelector("#scene-viewer canvas") as HTMLCanvasElement | null)?.toDataURL("image/png"),
      // diagnóstico: a textura montada para a peça (foto na esquerda, painel do tecido na direita) e as cores medidas
      texture: async (url: string, part: "upper" | "lower" | "full" | "feet" = "upper") => {
        const [{ loadTexture }, g, gp] = await Promise.all([import("@/components/three/common"), import("@/lib/avatar3d/human/garments"), import("@/lib/avatar3d/human/garment-photo")]);
        const t = await loadTexture(url); const raw = t?.image as HTMLImageElement | undefined; if (!raw) return null;
        // o MESMO caminho do HumanOutfit: foto preparada (recorte, pessoa, buracos) e só então textura/cores
        const img = (await gp.prepareOutfitPhoto(raw, part)) ?? raw;
        const info = g.photoInfo(img); const fabric = g.fabricColor(img, null, info);
        const tex = g.garmentTexture(img, fabric, null, info);
        const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; cv.getContext("2d")!.drawImage(img, 0, 0);
        const tile = gp.fabricTile(cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height));
        return { prepared: img !== raw, size: [img.width, img.height], tile, fabric, rib: g.ribColor(img, fabric, info), trims: g.trimColors(img, fabric, info), collarRow: info?.collarRow ?? null, neckDrop: info?.neckDrop ?? null, png: (tex.image as HTMLCanvasElement).toDataURL("image/png") };
      },
      // diagnóstico: por que a foto de uma peça não vira textura (recorte, segmentação, pessoa, parte mantida)
      probe: async (url: string, part: "upper" | "lower" | "full" | "feet") => {
        const [{ loadTexture }, gp, { stripPerson }] = await Promise.all([import("@/components/three/common"), import("@/lib/avatar3d/human/garment-photo"), import("@/lib/pieces/person-filter")]);
        const t = await loadTexture(url); const img = t?.image as HTMLImageElement | undefined; if (!img) return { loaded: false };
        // sem recorte pelos cantos (fundo de estúdio com molduras) a foto inteira vai ao filtro de pessoa, como no HumanOutfit
        const cut = gp.prepareGarmentPhoto(img) ?? (() => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d")!.drawImage(img, 0, 0); return c; })();
        const blob = await new Promise<Blob | null>((r) => cut.toBlob(r, "image/png"));
        const res = await stripPerson(new File([blob!], "p.png", { type: "image/png" }), { keep: part });
        const { detectBody } = await import("@/lib/avatar3d/body-detect"); const { loadOriented } = await import("@/lib/avatar3d/pipeline");
        const det = await detectBody(await loadOriented(new File([blob!], "p.png", { type: "image/png" }), 1600));
        const hist: Record<number, number> = {}; for (const k of det.mask?.data ?? []) hist[k] = (hist[k] ?? 0) + 1;
        // o que vira textura de fato (o mesmo caminho do HumanOutfit) e o recorte da pessoa, para ver no laboratório
        const final = await gp.prepareOutfitPhoto(img, part);
        const stripped = res.personFound ? await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(res.file); }) : null;
        return { loaded: true, cutout: !!gp.prepareGarmentPhoto(img), usable: gp.canUseOutfitPhoto(res, part), segmentation: res.segmentationAvailable, people: res.people, personFound: res.personFound, garments: res.garments ?? null, classes: hist, final: final?.toDataURL("image/png") ?? null, stripped };
      },
    };
  }, []);
  const items = useMemo(() => [item("a", "Norte Sport", "shoes_piece", "shoes_piece", 2), item("b", "Atelier Lumi", "upper_piece", "upper_piece", 1)], []);
  const env = useMemo(() => resolveEnvironment(s === "fitting-neutral" ? [] : items), [s, items]);
  // logo FICTÍCIO do artista de exemplo, desenhado aqui mesmo (nenhuma marca real)
  const logo = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas"); c.width = 900; c.height = 300; const g = c.getContext("2d"); if (!g) return null;
    g.fillStyle = "#ffffff"; g.font = "italic 900 150px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Luma", 450, 120);
    g.font = "700 64px Arial, sans-serif"; g.fillText("✦  V A L E  ✦", 450, 240); return c.toDataURL("image/png");
  }, []);
  return (
    <main style={{ padding: 12 }}>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {["fitting-neutral", "fitting-brand", ...Object.keys(FITTING), "ministores", "ministage", "ministage-sem-logo"].map((k) => <button key={k} onClick={() => setS(k)} aria-pressed={s === k}>{k}</button>)}
      </nav>
      <div id="scene-viewer" style={{ width: 1100, height: 680, background: "#111" }}>
        {s.startsWith("fitting") && lab.ready && <FittingRoomScene avatar={null} sex={lab.sex} body={lab.body} pieces={lab.pieces ?? LAB_LOOK} environment={env} view={view} onProfile={publishProfile}
          debug={lab.debug} cameraYaw={lab.yaw} closeUp={lab.close} light={lab.light} scene={FITTING[s] ? resolveScene({ ...FITTING[s], worn: items }) : null} />}
        {s === "ministores" && <StoreStreetScene onPick={() => {}} selectedId="c1" brand={{ name: "Atelier Lumi" }} stores={[
          { id: "c1", label: "Verão Solar", rank: 1, audience: 70, fraction: 1, fireworks: 3, accentColor: "#F26A1B", artUrl: "/aura/geometry/geometry_01/imagem.png", score: 980, products: [TOPS[0], BAGS[1], SHOES[0]] },
          { id: "c2", label: "Noite Urbana", rank: 2, audience: 48, fraction: 0.7, fireworks: 2, accentColor: "#2D55C9", artUrl: "/aura/geometry/geometry_02/imagem.png", score: 760, products: [TOPS[3], BOTTOMS[3], SHOES[4]] },
          { id: "c3", label: "Linho & Sal", rank: 3, audience: 30, fraction: 0.45, fireworks: 1, accentColor: "#1BAF7A", artUrl: "/aura/geometry/geometry_03/imagem.png", score: 540, products: [TOPS[1], BOTTOMS[4], BAGS[3]] },
          { id: "c4", label: "Inverno Lã", rank: 4, audience: 18, fraction: 0.3, fireworks: 0, accentColor: "#8E44AD", artUrl: "/aura/geometry/geometry_04/imagem.png", score: 310, products: [TOPS[4], BAGS[4], SHOES[1]] },
        ]} />}
        {s === "ministage" && <StageScene name="Luma Vale" era="Era Neon" colors={["#C6275E", "#2D55C9", "#F2C94C"]} mannequin={{ sex: "FEMININO", head: "PADRAO" }} pieces={LAB_LOOK} logoUrl={logo} seals={["/selos/circular/01.webp", "/selos/circular/02.webp"]} />}
        {s === "ministage-sem-logo" && <StageScene name="Rio Aurora" era="Era Tropical" colors={["#1BAF7A", "#EB6834", "#F2C94C"]} mannequin={{ sex: "MASCULINO", head: "PADRAO" }} pieces={LAB_LOOK} />}
      </div>
    </main>
  );
}

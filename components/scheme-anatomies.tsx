"use client";
import type { SchemeView } from "@/lib/api/types";
import { mediaUrl } from "@/lib/api/client";
import { hypeColor } from "@/components/scheme-card";

/** Anatomias oficiais do card (docs/anatomias/anatomias_card_v17_1): seção A (base) e seção B (variações com arte própria). */
export const SCHEME_ANATOMIES: { id: string; label: string; section: "A" | "B"; ownArt?: boolean; hint: string }[] = [
  { id: "LISTA_VERTICAL", label: "Lista vertical", section: "A", hint: "foto + peças em linhas" },
  { id: "GRADE_PECAS", label: "Grade de peças", section: "A", hint: "mosaico 3×N das peças" },
  { id: "HERO_LISTA", label: "Foto hero + lista lateral", section: "A", hint: "foto grande à esquerda, peças à direita" },
  { id: "PASSARELA", label: "Passarela", section: "B", ownArt: true, hint: "trilho por curtidas em cenário de desfile" },
  { id: "ETIQUETA", label: "Etiqueta", section: "B", ownArt: true, hint: "mini-etiquetas por peça (preço, tamanho, marca)" },
  { id: "RAIO_X", label: "Raio-X", section: "B", ownArt: true, hint: "scanner com callouts numerados" },
  { id: "BENTO", label: "Bento assimétrico", section: "B", ownArt: true, hint: "grade assimétrica interativa" },
  { id: "ESPECTRO", label: "Espectro", section: "B", ownArt: true, hint: "barras de cor proporcionais" },
  { id: "CUSTO_POR_USO", label: "Custo por uso", section: "B", ownArt: true, hint: "preço ÷ usos por peça" },
  { id: "SILHUETA_PROPORCAO", label: "Silhueta & Proporção", section: "B", ownArt: true, hint: "barras de proporção do corpo do look" },
  { id: "HYPE_FOCUS", label: "Hype Focus", section: "B", ownArt: true, hint: "medidor de Hype + peças ranqueadas" },
  { id: "CARTELA_SAZONAL", label: "Cartela sazonal", section: "B", ownArt: true, hint: "arte da estação do look (opt-in)" },
  { id: "BLOCOS", label: "Blocos (Lego)", section: "B", ownArt: true, hint: "card em blocos de encaixe; material desativado" },
];
/**
 * Posição do selo por anatomia (anatomias_card_v17_1.html) — espelha BackgroundStudioService.SEAL_PLACEMENT.
 * TITLE_ROW = linha "Título · selos · preço"; META_BLOCK = bloco "Selos · descrição · estilo"; COVER_CORNER = canto da
 * capa/arte própria; HEADER = cabeçalho do card-objeto (ao lado do PREMIUM); STUDS = placas redondas 1×1 dos Blocos.
 */
export type SealZone = "TITLE_ROW" | "META_BLOCK" | "COVER_CORNER" | "HEADER" | "STUDS";
export interface SealPlacement { zone: SealZone; pieceRows?: boolean; source: "anatomia" | "derivada"; description: string; }
export const SEAL_PLACEMENT: Record<string, SealPlacement> = {
  LISTA_VERTICAL: { zone: "TITLE_ROW", pieceRows: true, source: "anatomia", description: "Linha “Título · selos · preço” abaixo da foto; cada peça repete “marca · nome · selos · preço”." },
  GRADE_PECAS: { zone: "TITLE_ROW", pieceRows: true, source: "anatomia", description: "Linha do título; cada célula mostra “selos · preço”." },
  HERO_LISTA: { zone: "TITLE_ROW", pieceRows: true, source: "anatomia", description: "Linha do título abaixo do hero; a lista lateral traz “peça · selos · preço”." },
  PASSARELA: { zone: "COVER_CORNER", source: "derivada", description: "Canto superior direito da capa, oposto ao rótulo lateral vertical." },
  ETIQUETA: { zone: "TITLE_ROW", source: "anatomia", description: "Linha “Título · selos · preço · descrição” abaixo das mini-etiquetas." },
  RAIO_X: { zone: "COVER_CORNER", source: "derivada", description: "Sobre a foto do scanner, canto superior direito (legenda numerada à esquerda)." },
  BENTO: { zone: "META_BLOCK", source: "anatomia", description: "Bloco “Selos · descrição · estilo” abaixo da grade." },
  ESPECTRO: { zone: "TITLE_ROW", source: "anatomia", description: "Linha “Título · selos · preço” acima das faixas de cor." },
  CUSTO_POR_USO: { zone: "HEADER", source: "derivada", description: "Cabeçalho “FASHIONAI · VALOR DE USO”, ao lado do PREMIUM." },
  SILHUETA_PROPORCAO: { zone: "TITLE_ROW", source: "derivada", description: "Linha do nome da silhueta, antes de “Descrição · ocasião · estilo”." },
  HYPE_FOCUS: { zone: "HEADER", source: "derivada", description: "Ao lado do medidor “Peça em destaque”." },
  CARTELA_SAZONAL: { zone: "COVER_CORNER", source: "derivada", description: "Canto superior direito do hero da estação." },
  BLOCOS: { zone: "STUDS", source: "anatomia", description: "Placas redondas 1×1 (verde = marca, vermelho = celebridade, amarelo = look) + placa “N selos”." },
};
export const PIECE_SEAL_PLACEMENT: Record<string, SealPlacement> = {
  PECA_AMPLIADO: { zone: "META_BLOCK", source: "anatomia", description: "Linha “Categoria · marca · sexo · selos” abaixo da foto." },
  PASSARELA: { zone: "COVER_CORNER", source: "derivada", description: "Canto da capa, oposto ao rank e aos holofotes." },
  ETIQUETA: { zone: "HEADER", source: "derivada", description: "Ao lado do label “FASHION AI” da etiqueta." },
  RAIO_X: { zone: "COVER_CORNER", source: "derivada", description: "Sobre a foto, canto oposto ao ritmo (bpm)." },
  BENTO: { zone: "META_BLOCK", source: "derivada", description: "Bloco “Atributos”." },
  ESPECTRO: { zone: "TITLE_ROW", source: "anatomia", description: "Linha “Título · selos · preço” acima da faixa única." },
  CUSTO_POR_USO: { zone: "HEADER", source: "derivada", description: "Cabeçalho, ao lado do PREMIUM." },
  BLOCOS: { zone: "STUDS", source: "anatomia", description: "Placa redonda 1×1 ao lado do bloco de marca." },
};
export const sealPlacement = (anatomy?: string | null) => SEAL_PLACEMENT[anatomy ?? ""] ?? SEAL_PLACEMENT.LISTA_VERTICAL;
export const pieceSealPlacement = (anatomy?: string | null) => PIECE_SEAL_PLACEMENT[anatomy ?? ""] ?? PIECE_SEAL_PLACEMENT.PECA_AMPLIADO;

/** Esquema da zona do selo num card 90 mm (mini-maquete usada na etapa 4 do Background Studio). */
export function SealZoneDiagram({ zone, pieceRows }: { zone: SealZone; pieceRows?: boolean }) {
  const dot = (x: number, y: number, r = 5, key?: string) => <circle key={key} cx={x} cy={y} r={r} fill="var(--mark)" stroke="var(--ink)" strokeWidth="1" />;
  return (
    <svg viewBox="0 0 60 90" width="42" height="63" aria-hidden className="shrink-0 rounded border border-line-soft bg-surface">
      <rect x="4" y="4" width="52" height="6" rx="1.5" fill="var(--line-soft)" />
      <rect x="4" y="13" width="52" height="30" rx="2" fill="var(--surface-3, #e9e4dc)" stroke="var(--line-soft)" strokeDasharray="2 1.5" />
      <rect x="4" y="47" width="36" height="5" rx="1.5" fill="var(--line-soft)" />
      <rect x="4" y="56" width="52" height="4" rx="1.5" fill="var(--line-soft)" opacity=".7" />
      {[64, 71, 78].map((y) => <rect key={y} x="4" y={y} width="40" height="4.5" rx="1.5" fill="var(--line-soft)" opacity=".55" />)}
      {zone === "TITLE_ROW" && dot(50, 49.5)}
      {zone === "COVER_CORNER" && dot(49, 20)}
      {zone === "HEADER" && dot(50, 7, 4.5)}
      {zone === "META_BLOCK" && dot(50, 58)}
      {zone === "STUDS" && [0, 1, 2].map((i) => dot(12 + i * 9, 58, 3.6, `s${i}`))}
      {pieceRows && [64, 71, 78].map((y) => dot(52, y + 2.2, 2.4, `p${y}`))}
    </svg>
  );
}

export const PIECE_ANATOMIES: { id: string; label: string }[] = [
  { id: "PECA_AMPLIADO", label: "Peça ampliada" }, { id: "PASSARELA", label: "Passarela" }, { id: "ETIQUETA", label: "Etiqueta" }, { id: "RAIO_X", label: "Raio-X" },
  { id: "BENTO", label: "Bento" }, { id: "ESPECTRO", label: "Espectro" }, { id: "CUSTO_POR_USO", label: "Custo por uso" }, { id: "BLOCOS", label: "Blocos" },
];
export const hasOwnArt = (anatomy?: string | null) => !!SCHEME_ANATOMIES.find((a) => a.id === anatomy)?.ownArt;

export interface AnatomyPiece { id: string; name: string; img?: string; brand?: string | null; price?: number | null; colorHex?: string | null; color?: string | null; wearCount?: number; likes?: number; hype?: number | null; slot: string; category?: string; size?: string; }
export const toAnatomyPieces = (s: SchemeView): AnatomyPiece[] => (s.items ?? []).map((it) => ({
  id: it.wardrobeItemId, name: it.piece?.name ?? (it.name as string) ?? it.slot, img: mediaUrl(it.piece?.thumbnailUrl ?? it.piece?.imageUrl ?? (it.imageUrl as string)), brand: it.piece?.brandName, price: it.piece?.price,
  colorHex: it.piece?.colorHex, color: it.piece?.color, wearCount: it.piece?.wearCount ?? 0, likes: it.piece?.counters?.likes ?? 0, hype: it.piece?.hypeScore, slot: it.slot, category: it.piece?.category, size: it.piece?.size,
}));
const SEASON_ART: Record<string, string> = { WINTER: "linear-gradient(135deg,#E8F1F8,#B9D4E8,#5C7A99)", SPRING: "linear-gradient(135deg,#FCE7F3,#F9A8D4,#86EFAC)", SUMMER: "linear-gradient(135deg,#FEF3C7,#FDBA74,#F97316)", AUTUMN: "linear-gradient(135deg,#FDE68A,#D97706,#7C2D12)" };
const money = (v?: number | null) => (v == null ? "—" : `US$ ${v.toFixed(0)}`);

/** Renderiza o miolo do container conforme a anatomia (seção B). Devolve null para as anatomias base (A). */
export function AnatomyBody({ scheme, pieces }: { scheme: SchemeView; pieces: AnatomyPiece[] }) {
  const a = scheme.layoutAnatomy ?? "LISTA_VERTICAL"; const hype = scheme.hypeScore ?? 0;
  switch (a) {
    case "PASSARELA": {
      const sorted = [...pieces].sort((x, y) => (y.likes ?? 0) - (x.likes ?? 0));
      return (<div className="relative overflow-hidden" style={{ background: "#0d0f13", height: 150 }} aria-label="passarela">
        <div className="absolute inset-x-0 bottom-0 h-2/5" style={{ background: "linear-gradient(180deg,rgba(255,255,255,.08),transparent)" }} />
        <div className="relative flex h-full items-end justify-center gap-1 px-2 pb-2">{sorted.slice(0, 5).map((p, i) => <div key={p.id} className="relative flex flex-col items-center" style={{ width: `${Math.max(14, 30 - i * 4)}%` }}><span className="absolute left-0 top-0 rounded bg-white/85 px-1 text-[7px] font-bold text-black">#{i + 1}</span><img src={p.img} alt={p.name} className="w-full object-contain drop-shadow-lg" style={{ maxHeight: 90 }} /><span className="rounded bg-black/50 px-1 text-[7px] text-white">♥ {p.likes ?? 0}</span></div>)}</div>
      </div>);
    }
    case "ETIQUETA": return (<div className="flex flex-wrap gap-2 p-3">{pieces.map((p) => <span key={p.id} className="relative rounded-r-md border-[1.4px] border-ink bg-surface px-2 py-1 pl-4 type-data text-[9px] font-bold" style={{ clipPath: "polygon(9px 0,100% 0,100% 100%,9px 100%,0 50%)" }} title={p.name}>{p.name.slice(0, 18)} · {p.size?.toUpperCase() ?? "—"} · {money(p.price)}</span>)}</div>);
    case "RAIO_X": return (<div className="relative overflow-hidden" style={{ height: 172 }}><div className="c-photo absolute inset-0 border-0" style={{ aspectRatio: "auto" }}>{pieces[0]?.img && <img src={pieces[0].img} alt="" />}</div><div className="pointer-events-none absolute inset-x-0 h-6 animate-[xray_3.6s_linear_infinite]" style={{ background: "linear-gradient(180deg,transparent,rgba(255,255,255,.2),transparent)" }} />{pieces.slice(0, 4).map((p, i) => <span key={p.id} className="absolute left-1 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[8px] font-bold text-black" style={{ top: 8 + i * 34 }}><span className="flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: ["#C6275E", "#1F7A76", "#B8862B", "#5B6B7A"][i] }}>{i + 1}</span>{p.name.slice(0, 22)}</span>)}<style>{`@keyframes xray{0%{top:-24px}100%{top:172px}}`}</style></div>);
    case "BENTO": return (<div className="grid grid-cols-3 grid-rows-2 gap-1 p-1" style={{ height: 180 }}>{pieces.slice(0, 5).map((p, i) => <div key={p.id} className={`overflow-hidden rounded bg-surface-2 ${i === 0 ? "col-span-2 row-span-2" : ""}`}>{p.img && <img src={p.img} alt={p.name} className="h-full w-full object-contain p-1" />}</div>)}</div>);
    case "ESPECTRO": { const total = pieces.length || 1; return (<div className="flex flex-col">{pieces.map((p) => <div key={p.id} className="flex items-center gap-2 border-b border-line-soft px-2 py-1.5 last:border-0"><span className="h-3.5 rounded" style={{ width: `${Math.max(20, 100 / total)}%`, background: p.colorHex ?? "#999" }} title={p.color ?? ""} /><span className="type-caption text-muted">{p.color ?? p.name}</span></div>)}</div>); }
    case "CUSTO_POR_USO": return (<div className="flex flex-col">{pieces.map((p) => { const cpu = p.price != null && (p.wearCount ?? 0) > 0 ? p.price / (p.wearCount ?? 1) : null; return <div key={p.id} className="flex items-center gap-2 border-b border-line-soft px-2 py-1.5 text-[10.5px] last:border-0"><img src={p.img} alt="" className="h-7 w-7 rounded bg-surface-2 object-contain" /><span className="flex-1 truncate">{p.name}</span><span className="type-data text-muted">{money(p.price)} ÷ {p.wearCount ?? 0}</span><b className="type-data" style={{ color: cpu != null && cpu < 10 ? "var(--status-good)" : "var(--ink)" }}>{cpu != null ? `US$ ${cpu.toFixed(1)}/uso` : "—"}</b></div>; })}</div>);
    case "SILHUETA_PROPORCAO": { const cats = ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "full_body_piece"]; const total = pieces.length || 1; return (<div className="flex flex-col gap-1.5 p-3">{cats.map((c) => { const n = pieces.filter((p) => p.category === c).length; if (!n) return null; return <div key={c} className="flex items-center gap-2"><span className="w-14 type-data text-[8px] uppercase text-muted">{c.replace("_piece", "")}</span><span className="h-3.5 flex-1 rounded bg-surface-2"><span className="block h-full rounded" style={{ width: `${(100 * n) / total}%`, background: "linear-gradient(90deg,var(--thread),#2a9d94)" }} /></span><span className="w-6 text-right type-data text-[8px]">{Math.round((100 * n) / total)}%</span></div>; })}<p className="mt-1 rounded border border-thread bg-thread-soft p-1.5 text-[10px]">{pieces.length} peças · silhueta {pieces.some((p) => p.category === "full_body_piece") ? "fluida" : pieces.filter((p) => p.category === "upper_piece").length > 1 ? "em camadas" : "equilibrada"}</p></div>); }
    case "HYPE_FOCUS": return (<div className="flex flex-col gap-1.5 p-3"><div className="flex items-center gap-2 border-b border-dashed border-line-soft pb-2"><svg width="66" height="40" viewBox="0 0 66 40" aria-hidden><path d="M6 36 A27 27 0 0 1 60 36" fill="none" stroke="var(--line-soft)" strokeWidth="7" strokeLinecap="round" /><path d="M6 36 A27 27 0 0 1 60 36" fill="none" stroke={hypeColor(hype)} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(hype / 100) * 85} 100`} /></svg><div className="min-w-0"><span className="type-data text-[8px] uppercase text-faint">Hype Score</span><p className="truncate text-[11px] font-semibold">{Math.round(hype)} · {scheme.title}</p></div></div>{[...pieces].sort((x, y) => (y.hype ?? 0) - (x.hype ?? 0)).slice(0, 4).map((p) => <div key={p.id} className="flex items-center gap-2"><img src={p.img} alt="" className="h-7 w-7 rounded bg-surface-2 object-contain" /><span className="flex-1 truncate text-[9.5px] font-semibold">{p.name}</span><span className="flex w-14 flex-col items-end gap-0.5"><b className="type-data text-[9.5px]">{Math.round(p.hype ?? 0)}%</b><span className="hype-bar w-full" style={{ height: 4 }}><i style={{ width: `${p.hype ?? 0}%`, background: hypeColor(p.hype) }} /></span></span></div>)}</div>);
    case "CARTELA_SAZONAL": return (<div className="relative p-2" style={{ backgroundImage: SEASON_ART[scheme.season ?? "SPRING"] ?? SEASON_ART.SPRING }}><div className="grid grid-cols-4 gap-1">{pieces.slice(0, 4).map((p) => <div key={p.id} className="aspect-square overflow-hidden rounded bg-white/70">{p.img && <img src={p.img} alt={p.name} className="h-full w-full object-contain" />}</div>)}</div><span className="absolute right-2 top-2 rounded bg-black/40 px-1.5 text-[8px] uppercase text-white">{scheme.season ?? "estação"}</span></div>);
    case "BLOCOS": return (<div className="grid grid-cols-2 gap-1 p-1" style={{ background: "repeating-linear-gradient(90deg,var(--surface-2) 0 10px,var(--surface-3) 10px 12px)" }}>{pieces.slice(0, 6).map((p) => <div key={p.id} className="relative overflow-hidden rounded-sm border-2 border-line bg-surface"><span className="absolute left-1 top-1 h-2 w-2 rounded-full bg-line-soft" aria-hidden /><span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-line-soft" aria-hidden />{p.img && <img src={p.img} alt={p.name} className="h-20 w-full object-contain p-2" />}<span className="block truncate px-1 pb-1 text-[9px]">{p.name}</span></div>)}</div>);
    default: return null;
  }
}

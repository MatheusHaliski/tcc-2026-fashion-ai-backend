"use client";
import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, Button, Card, Chip, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, Switch, Textarea, useToast } from "@/components/ui";
import type { BlockFinish, Finishes } from "@/components/room3d/wardrobe-preview";

const WardrobePreview = dynamic(() => import("@/components/room3d/wardrobe-preview"), { ssr: false, loading: () => <Skeleton className="h-full" /> });

export interface CreatorBlock { slotType: string; moldId: string; widthCm: number; label: string; basePrice: number; minLevel: string; materials: string[]; }
export interface CreatorMaterial { code: string; label: string; roughness: number; metalness: number; priceFactor: number; minLevel: string; colors: string[]; }
interface Options { blocks: CreatorBlock[]; materials: CreatorMaterial[]; colors: Record<string, string>; levels: string[]; identity: { name: string; logoUrl?: string | null; slug?: string | null; kind: string }; seals: { id: string; name: string; availableFrom: string; availableUntil: string }[]; currency: string; }
export interface StoreItem {
  sku: string; name: string; kind: "COMPONENT" | "WARDROBE"; description?: string | null; moldId: string; slotType: string; blockLabel: string; widthCm?: number; material?: string | null; materialLabel?: string | null;
  colorName?: string | null; finish?: BlockFinish & { colorName?: string; texture?: string; creator?: string; sealId?: string }; bundle?: { slotType: string; moldId: string; material: string; colorName: string; finish: BlockFinish }[];
  rarity?: string; pricePoints: number; requiredLevel: string; stock?: number | null; stockLeft?: number | null; sold: number; perUserLimit?: number | null; availableFrom?: string | null; availableUntil?: string | null;
  availability: "DISPONIVEL" | "EM_BREVE" | "EXPIRADO" | "ESGOTADO" | "INATIVO"; requiresSeal: boolean; active: boolean; labelText?: string | null; logoUrl?: string | null; artUrl?: string | null;
  seal?: { id: string; name: string } | null; creator?: { name: string; logoUrl?: string | null; slug?: string | null; kind: string } | null;
  ownedCount?: number; blocker?: string | null; levelOk?: boolean; affordable?: boolean; owned?: boolean; compatibleModules?: string[];
}
interface Mine { identity: Options["identity"]; items: StoreItem[]; stats: { items: number; sold: number; points: number }; }
interface Part { moldId: string; material: string; colorName: string; color: string; }
interface Form { kind: "COMPONENT" | "WARDROBE"; name: string; description: string; labelText: string; logoUrl: string; artUrl: string; sealId: string; pricePoints: string; requiredLevel: string; stock: string; perUserLimit: string; availableFrom: string; availableUntil: string; requiresSeal: boolean; active: boolean; }

export const AVAILABILITY: Record<string, { label: string; tone?: "mark" | "thread" | "chalk" }> = {
  DISPONIVEL: { label: "à venda", tone: "thread" }, EM_BREVE: { label: "em breve", tone: "chalk" }, EXPIRADO: { label: "expirado", tone: "mark" }, ESGOTADO: { label: "esgotado", tone: "mark" }, INATIVO: { label: "fora da loja" },
};
/** Blocos da pré-visualização: o FAI Origem e os móveis à parte (sapateira, vitrine, porta-joias, ilha). */
export const SLOT_LABELS: Record<string, string> = { DOOR: "Portas", DRAWER: "Gavetas", HANDLE: "Puxadores", TOP: "Maleiro", BASE: "Base", HANGER: "Cabides", LOGO: "Placa de logo", LIGHT: "LED", RUG: "Tapete", SHOE_RACK: "Sapateira", BAG_DISPLAY: "Vitrine de bolsas", JEWELRY: "Porta-joias", ISLAND: "Ilha central" };
const PREVIEW_SLOTS = ["DOOR", "DRAWER", "HANDLE", "TOP", "BASE", "HANGER", "LOGO", "LIGHT", "RUG", "SHOE_RACK", "BAG_DISPLAY", "JEWELRY", "ISLAND"];
const LV = ["ESTREIA", "STUDIO", "LOFT", "CLOSET", "ATELIER", "PENTHOUSE", "MAISON"];
const higher = (a: string, b: string) => (LV.indexOf(a) >= LV.indexOf(b) ? a : b);
const empty: Form = { kind: "WARDROBE", name: "", description: "", labelText: "", logoUrl: "", artUrl: "", sealId: "", pricePoints: "", requiredLevel: "ESTREIA", stock: "", perUserLimit: "", availableFrom: "", availableUntil: "", requiresSeal: false, active: true };
const local = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

/** Acabamento de uma parte (material + cor), no formato que a cena 3D e a loja usam. */
export function finishOf(m: CreatorMaterial | undefined, p: Part): BlockFinish {
  return { color: p.color, roughness: m?.roughness, metalness: m?.metalness, material: m?.code };
}

/**
 * RF39 — "Criar guarda-roupa 3D": criador de blocos do FAI Origem para marcas e celebridades. Cada bloco (porta,
 * gaveta, puxador, maleiro, base, cabides, placa de logo, LED, tapete, sapateira, vitrine, porta-joias, ilha) recebe
 * material e cor; o item leva o logo, o nome gravado e a arte da marca, e as condições de venda na loja do quarto
 * (preço em FAI Points, nível, estoque, limite por pessoa, janela de disponibilidade/expiração e selo exigido).
 */
export function WardrobeCreatorTab() {
  const { fmtDate, fmtNumber } = useI18n(); const toast = useToast();
  const opts = useApi<Options>((signal) => api.get("/api/room-creator/options", { signal }), []);
  const mine = useApi<Mine>((signal) => api.get("/api/room-creator/items", { signal }), []);
  const [form, setForm] = useState<Form>(empty); const [editing, setEditing] = useState<string | null>(null);
  const [parts, setParts] = useState<Record<string, Part>>({}); const [slot, setSlot] = useState<string>("DOOR");
  const [busy, setBusy] = useState(false); const [confirmDel, setConfirmDel] = useState<StoreItem | null>(null);
  const logoIn = useRef<HTMLInputElement>(null); const artIn = useRef<HTMLInputElement>(null);
  const o = opts.data;
  const mat = (code?: string) => o?.materials.find((m) => m.code === code);
  const blocksOf = (s: string) => (o?.blocks ?? []).filter((b) => b.slotType === s);
  const slots = useMemo(() => Array.from(new Set((o?.blocks ?? []).map((b) => b.slotType))), [o]);

  function defaultPart(s: string): Part | null {
    const b = blocksOf(s)[0]; const m = mat(b?.materials[0]); if (!b || !m) return null;
    const cn = m.colors[0]; return { moldId: b.moldId, material: m.code, colorName: cn, color: o!.colors[cn] ?? "#cccccc" };
  }
  function toggleSlot(s: string, on: boolean) {
    setParts((p) => { const n = { ...p }; if (on) { const d = n[s] ?? defaultPart(s); if (d) n[s] = d; } else delete n[s]; return n; });
    if (on) setSlot(s);
  }
  function pick(s: string) {
    if (form.kind === "COMPONENT") { setParts(() => { const d = parts[s] ?? defaultPart(s); return d ? { [s]: d } : {}; }); setSlot(s); return; }
    if (!parts[s]) toggleSlot(s, true); else setSlot(s);
  }
  function setPart(s: string, patch: Partial<Part>) {
    setParts((p) => {
      const cur = p[s] ?? defaultPart(s); if (!cur) return p; const next = { ...cur, ...patch };
      if (patch.material) { const m = mat(patch.material); if (m && !m.colors.includes(next.colorName)) { next.colorName = m.colors[0]; next.color = o!.colors[m.colors[0]] ?? next.color; } }
      if (patch.moldId) { const b = blocksOf(s).find((x) => x.moldId === patch.moldId); if (b && !b.materials.includes(next.material)) { const m = mat(b.materials[0]); next.material = b.materials[0]; if (m) { next.colorName = m.colors[0]; next.color = o!.colors[m.colors[0]] ?? next.color; } } }
      return { ...p, [s]: next };
    });
  }
  function startNew(kind: Form["kind"]) {
    setEditing(null); setForm({ ...empty, kind, labelText: o?.identity.name ?? "", logoUrl: "" });
    if (kind === "WARDROBE") { const n: Record<string, Part> = {}; ["DOOR", "DRAWER", "HANDLE", "LOGO", "HANGER"].forEach((s) => { const d = defaultPart(s); if (d) n[s] = d; }); setParts(n); setSlot("DOOR"); }
    else { const d = defaultPart("DOOR"); setParts(d ? { DOOR: d } : {}); setSlot("DOOR"); }
  }
  function edit(i: StoreItem) {
    setEditing(i.sku);
    setForm({ kind: i.kind, name: i.name, description: i.description ?? "", labelText: i.labelText ?? "", logoUrl: i.logoUrl ?? "", artUrl: i.artUrl ?? "", sealId: i.seal?.id ?? "", pricePoints: String(i.pricePoints), requiredLevel: i.requiredLevel, stock: i.stock?.toString() ?? "", perUserLimit: i.perUserLimit?.toString() ?? "", availableFrom: local(i.availableFrom), availableUntil: local(i.availableUntil), requiresSeal: i.requiresSeal, active: i.active });
    if (i.kind === "WARDROBE") { const n: Record<string, Part> = {}; (i.bundle ?? []).forEach((b) => { n[b.slotType] = { moldId: b.moldId, material: b.material, colorName: b.colorName, color: b.finish?.color ?? o?.colors[b.colorName] ?? "#ccc" }; }); setParts(n); setSlot(Object.keys(n)[0] ?? "DOOR"); }
    else { setParts({ [i.slotType]: { moldId: i.moldId, material: i.material ?? "", colorName: i.colorName ?? "", color: i.finish?.color ?? "#ccc" } }); setSlot(i.slotType); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function upload(kind: "logo" | "art", file?: File) {
    if (!file) return; const fd = new FormData(); fd.append("file", file);
    try { const r = await api.upload<{ url: string }>(`/api/room-creator/uploads?kind=${kind}`, fd); setForm((f) => ({ ...f, [kind === "logo" ? "logoUrl" : "artUrl"]: r.url })); toast.success(kind === "logo" ? "Logo enviado." : "Arte enviada."); } catch (e) { toast.fromError(e); }
  }
  // preço sugerido = Σ preço base do bloco × fator do material; nível mínimo = maior entre bloco, material e o escolhido
  const suggestion = useMemo(() => Object.values(parts).length === 0 || !o ? { price: 0, level: "ESTREIA" } : Object.entries(parts).reduce((acc, [, p]) => {
    const b = o.blocks.find((x) => x.moldId === p.moldId); const m = mat(p.material);
    return { price: acc.price + Math.round((b?.basePrice ?? 0) * (m?.priceFactor ?? 1)), level: higher(acc.level, higher(b?.minLevel ?? "ESTREIA", m?.minLevel ?? "ESTREIA")) };
  }, { price: 0, level: "ESTREIA" }), [parts, o]); // eslint-disable-line react-hooks/exhaustive-deps
  const finishes: Finishes = useMemo(() => {
    const f: Finishes = {};
    Object.entries(parts).forEach(([s, p]) => { f[s] = { ...finishOf(mat(p.material), p), kelvin: s === "LIGHT" ? (p.colorName.startsWith("Quente") ? 2700 : p.colorName.startsWith("Fria") ? 6000 : 4000) : undefined }; });
    const logo = form.logoUrl || o?.identity.logoUrl || null;
    if (f.DOOR) f.DOOR = { ...f.DOOR, artUrl: form.artUrl || null };
    if (f.LOGO) f.LOGO = { ...f.LOGO, logoUrl: logo, labelText: form.labelText || null };
    else f.LOGO = { labelText: form.labelText || o?.identity.name || null, logoUrl: form.kind === "WARDROBE" ? logo : null };
    return f;
  }, [parts, form.artUrl, form.logoUrl, form.labelText, form.kind, o]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const iso = (v: string) => (v ? new Date(v).toISOString() : null);
    const main = parts[slot] ?? Object.values(parts)[0]; const mainSlot = parts[slot] ? slot : Object.keys(parts)[0];
    if (!main) { toast.error("Escolha ao menos um bloco do móvel."); return; }
    const body = {
      kind: form.kind, name: form.name, description: form.description || null, labelText: form.labelText || null, logoUrl: form.logoUrl || null, artUrl: form.artUrl || null, sealId: form.sealId || null,
      pricePoints: form.pricePoints === "" ? suggestion.price : Number(form.pricePoints), requiredLevel: form.requiredLevel, stock: form.stock ? Number(form.stock) : null, perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
      availableFrom: iso(form.availableFrom), availableUntil: iso(form.availableUntil), requiresSeal: form.requiresSeal, active: form.active,
      slotType: mainSlot, moldId: main.moldId, material: main.material, colorName: main.colorName, color: main.color,
      bundle: form.kind === "WARDROBE" ? Object.entries(parts).map(([s, p]) => ({ slotType: s, moldId: p.moldId, material: p.material, colorName: p.colorName, color: p.color })) : null,
    };
    setBusy(true);
    try {
      const r = editing ? await api.put<StoreItem>(`/api/room-creator/items/${editing}`, body) : await api.post<StoreItem>("/api/room-creator/items", body);
      toast.success(`${r.name} ${editing ? "atualizado" : "publicado na loja do quarto"} — ${r.pricePoints} FAI pts · nível ${r.requiredLevel}.`); setEditing(r.sku); mine.reload();
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function remove(i: StoreItem) {
    try { await api.delete(`/api/room-creator/items/${i.sku}`); toast.success(i.sold > 0 ? "Retirado da loja — quem comprou continua com o item." : "Item excluído."); if (editing === i.sku) startNew(form.kind); mine.reload(); } catch (e) { toast.fromError(e); } finally { setConfirmDel(null); }
  }

  if (opts.error) return <ErrorState error={opts.error} onRetry={opts.reload} />;
  if (opts.loading || !o) return <Skeleton className="h-96" />;
  const cur = parts[slot]; const curBlock = o.blocks.find((b) => b.moldId === cur?.moldId) ?? blocksOf(slot)[0]; const curMat = mat(cur?.material);
  const slotLabel = (s: string) => SLOT_LABELS[s] ?? blocksOf(s)[0]?.label ?? s;
  const inPreview = PREVIEW_SLOTS.includes(slot);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-body text-muted flex-1 min-w-[16rem]">Crie componentes ou um guarda-roupa inteiro com a identidade de <b>{o.identity.name}</b>. O item entra na <b>loja do quarto</b> e é comprado com FAI Points — que não são vendidos por dinheiro real.</p>
        <Button variant={form.kind === "WARDROBE" && !editing ? "primary" : "default"} onClick={() => startNew("WARDROBE")}>Novo guarda-roupa inteiro</Button>
        <Button variant={form.kind === "COMPONENT" && !editing ? "primary" : "default"} onClick={() => startNew("COMPONENT")}>Novo componente</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card pad={false} className="overflow-hidden">
          <div className="relative h-[420px] sm:h-[480px]">
            <WardrobePreview finishes={finishes} selected={inPreview ? slot : null} onPick={pick} name={form.labelText || o.identity.name} />
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1">
              <Badge tone="chalk">{form.kind === "WARDROBE" ? "Guarda-roupa inteiro" : "Componente"}</Badge>{editing && <Badge>editando {editing}</Badge>}
            </div>
            {cur && <div className="pointer-events-none absolute bottom-3 left-3 surface px-2 py-1 type-caption"><span className="inline-block h-3 w-6 align-middle rounded" style={{ background: cur.color }} /> {curBlock?.label} · {curMat?.label} · {cur.colorName} · a partir de {higher(curBlock?.minLevel ?? "ESTREIA", curMat?.minLevel ?? "ESTREIA")}</div>}
          </div>
          <div className="border-t border-line-soft p-3">
            <p className="label mb-1">Blocos do móvel {form.kind === "WARDROBE" ? "— toque para incluir e editar" : "— escolha o componente"}</p>
            <div className="flex flex-wrap gap-1">
              {slots.map((s) => {
                const on = !!parts[s];
                return <Chip key={s} active={slot === s} onClick={() => (form.kind === "WARDROBE" && on && slot === s ? toggleSlot(s, false) : pick(s))} title={form.kind === "WARDROBE" && on && slot === s ? "tocar de novo remove o bloco" : undefined}>{form.kind === "WARDROBE" ? (on ? "✓ " : "+ ") : ""}{slotLabel(s)}</Chip>;
              })}
            </div>
          </div>
        </Card>

        <div className="grid content-start gap-3">
          <Card>
            <h3 className="type-h3 mb-2">{slotLabel(slot)} {cur ? "" : <span className="type-caption text-muted">(não incluído)</span>}</h3>
            {!cur ? <Button size="sm" onClick={() => pick(slot)}>Incluir este bloco</Button> : <>
              {blocksOf(slot).length > 1 && <Field label="Modelo" id="mold"><Select id="mold" value={cur.moldId} onChange={(e) => setPart(slot, { moldId: e.target.value })}>{blocksOf(slot).map((b) => <option key={b.moldId} value={b.moldId}>{b.label} · a partir de {b.minLevel}</option>)}</Select></Field>}
              <p className="label mt-2">Material</p>
              <div className="mt-1 flex flex-wrap gap-1">{(curBlock?.materials ?? []).map((code) => { const m = mat(code); return m ? <Chip key={code} active={cur.material === code} onClick={() => setPart(slot, { material: code })} title={`fator de preço ×${m.priceFactor} · nível ${m.minLevel}`}>{m.label}{m.metalness > 0.8 ? " ✦" : ""}</Chip> : null; })}</div>
              <p className="label mt-3">Cor / acabamento {curMat ? `de ${curMat.label.toLowerCase()}` : ""}</p>
              <div className="mt-1 flex flex-wrap gap-2">{(curMat?.colors ?? []).map((cn) => (
                <button key={cn} type="button" onClick={() => setPart(slot, { colorName: cn, color: o.colors[cn] ?? cur.color })} aria-pressed={cur.colorName === cn} className={`flex items-center gap-1 rounded-full border px-2 py-1 type-caption ${cur.colorName === cn ? "border-ink" : "border-line-soft"}`}>
                  <span className="h-4 w-4 rounded-full border border-line-soft" style={{ background: o.colors[cn] }} />{cn}
                </button>))}</div>
              {curMat?.code !== "LED" && <div className="mt-2 flex items-center gap-2"><label htmlFor="hex" className="type-caption text-muted">cor da marca (hex)</label><input id="hex" type="color" value={cur.color} onChange={(e) => setPart(slot, { color: e.target.value.toUpperCase(), colorName: `${cur.colorName.split(" · ")[0]} · ${e.target.value.toUpperCase()}` })} className="h-7 w-10 rounded" /></div>}
            </>}
          </Card>

          <Card>
            <h3 className="type-h3 mb-2">Identidade</h3>
            <Field label="Nome do item" id="nm" required><Input id="nm" value={form.name} maxLength={120} placeholder={form.kind === "WARDROBE" ? `Guarda-roupa ${o.identity.name}` : `Porta ${o.identity.name}`} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Nome gravado na placa" id="lb" hint="aparece na placa de logo e no topo do móvel"><Input id="lb" value={form.labelText} maxLength={60} onChange={(e) => setForm({ ...form, labelText: e.target.value })} /></Field>
            <Field label="Descrição" id="ds"><Textarea id="ds" rows={2} maxLength={400} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="surface p-2 text-center">
                <p className="label">Logo</p>
                {form.logoUrl || o.identity.logoUrl ? <img src={mediaUrl(form.logoUrl || o.identity.logoUrl)} alt="logo" className="mx-auto h-12 object-contain" /> : <p className="type-caption text-muted">sem logo</p>}
                <input ref={logoIn} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload("logo", e.target.files?.[0])} />
                <Button size="sm" className="mt-1" onClick={() => logoIn.current?.click()}>{form.logoUrl ? "Trocar" : "Enviar PNG"}</Button>
              </div>
              <div className="surface p-2 text-center">
                <p className="label">Arte da marca (portas)</p>
                {form.artUrl ? <img src={mediaUrl(form.artUrl)} alt="arte" className="mx-auto h-12 object-cover" /> : <p className="type-caption text-muted">sem arte</p>}
                <input ref={artIn} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload("art", e.target.files?.[0])} />
                <div className="mt-1 flex justify-center gap-1"><Button size="sm" onClick={() => artIn.current?.click()}>{form.artUrl ? "Trocar" : "Enviar"}</Button>{form.artUrl && <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, artUrl: "" })}>remover</Button>}</div>
              </div>
            </div>
            <Field label="Selo de identidade (RF25)" id="sl" className="mt-2" hint="o selo aparece no item e pode ser exigido na compra"><Select id="sl" value={form.sealId} onChange={(e) => setForm({ ...form, sealId: e.target.value, requiresSeal: e.target.value ? form.requiresSeal : false })}><option value="">— nenhum —</option>{o.seals.map((s) => <option key={s.id} value={s.id}>{s.name}{s.availableUntil && s.availableUntil !== "null" ? ` · até ${fmtDate(s.availableUntil)}` : ""}</option>)}</Select></Field>
          </Card>

          <Card>
            <h3 className="type-h3 mb-2">Condições de compra</h3>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Preço (FAI Points)" id="pp" hint={`sugerido: ${suggestion.price}`}><Input id="pp" type="number" min={0} max={20000} value={form.pricePoints} placeholder={String(suggestion.price)} onChange={(e) => setForm({ ...form, pricePoints: e.target.value })} /></Field>
              <Field label="Nível mínimo" id="lv" hint={`blocos/materiais exigem ${suggestion.level}`}><Select id="lv" value={form.requiredLevel} onChange={(e) => setForm({ ...form, requiredLevel: e.target.value })}>{o.levels.map((l) => <option key={l} value={l}>{l}</option>)}</Select></Field>
              <Field label="Estoque (edição limitada)" id="st" hint="vazio = ilimitado"><Input id="st" type="number" min={1} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
              <Field label="Limite por pessoa" id="pu" hint="vazio = sem limite"><Input id="pu" type="number" min={1} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} /></Field>
              <Field label="Disponível a partir de" id="af" hint="vazio = imediato"><Input id="af" type="datetime-local" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} /></Field>
              <Field label="Expira em" id="au" hint="vazio = sem expiração"><Input id="au" type="datetime-local" value={form.availableUntil} onChange={(e) => setForm({ ...form, availableUntil: e.target.value })} /></Field>
            </div>
            <div className="mt-2 grid gap-2">
              <Switch id="rs" checked={form.requiresSeal} onChange={(v) => setForm({ ...form, requiresSeal: v })} label={form.sealId ? "Só vende para quem tem este selo aprovado num look" : `Só vende para quem tem um selo de ${o.identity.name}`} />
              <Switch id="ac" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Visível na loja" />
            </div>
            <p className="mt-2 type-caption text-muted">O nível final é o maior entre o escolhido e o exigido pelos blocos/materiais ({suggestion.level}). FAI Points não são vendidos por dinheiro real.</p>
            <div className="mt-3 flex flex-wrap gap-2"><Button variant="primary" loading={busy} disabled={!form.name.trim() || Object.keys(parts).length === 0} onClick={save}>{editing ? "Salvar alterações" : "Publicar na loja do quarto"}</Button>{editing && <Button onClick={() => startNew(form.kind)}>Novo</Button>}</div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h3 className="type-h3">Minhas criações na loja</h3>{mine.data && <p className="type-data text-muted tabular">{mine.data.stats.items} itens · {mine.data.stats.sold} vendas · {fmtNumber(mine.data.stats.points)} FAI pts</p>}</div>
        {mine.error ? <ErrorState error={mine.error} onRetry={mine.reload} /> : mine.loading ? <Skeleton className="h-32" /> : (mine.data?.items ?? []).length === 0 ? <EmptyState title="Nenhuma criação ainda." hint="Monte um guarda-roupa inteiro ou um componente e publique na loja do quarto." /> : (
          <div className="grid-cards">{mine.data!.items.map((i) => (
            <div key={i.sku} className={`surface p-3 ${editing === i.sku ? "ring-2 ring-[var(--mark)]" : ""}`}>
              <StoreSwatch item={i} />
              <p className="mt-2 type-body"><b>{i.name}</b></p>
              <p className="type-caption text-muted">{i.kind === "WARDROBE" ? `Guarda-roupa inteiro · ${i.bundle?.length ?? 0} blocos` : `${i.blockLabel} · ${i.materialLabel} · ${i.colorName}`}</p>
              <div className="mt-1 flex flex-wrap gap-1"><Badge tone={AVAILABILITY[i.availability]?.tone}>{AVAILABILITY[i.availability]?.label ?? i.availability}</Badge><Badge>{i.pricePoints} pts</Badge><Badge>nível {i.requiredLevel}</Badge>{i.seal && <Badge tone="chalk">selo {i.seal.name}</Badge>}</div>
              <p className="mt-1 type-data text-faint tabular">{i.sold} vendidos{i.stock ? ` / ${i.stock}` : ""}{i.perUserLimit ? ` · máx. ${i.perUserLimit}/pessoa` : ""}{i.availableFrom ? ` · de ${fmtDate(i.availableFrom)}` : ""}{i.availableUntil ? ` · até ${fmtDate(i.availableUntil)}` : ""}</p>
              <div className="mt-2 flex gap-1"><Button size="sm" onClick={() => edit(i)}>Editar</Button><Button size="sm" variant="danger" onClick={() => setConfirmDel(i)}>{i.sold > 0 ? "Retirar" : "Excluir"}</Button></div>
            </div>))}</div>)}
      </Card>
      <Dialog open={!!confirmDel} onClose={() => setConfirmDel(null)} title={confirmDel?.sold ? "Retirar da loja?" : "Excluir item?"} footer={<><Button onClick={() => setConfirmDel(null)}>Cancelar</Button><Button variant="danger" onClick={() => confirmDel && remove(confirmDel)}>Confirmar</Button></>}>
        <p className="type-body">{confirmDel?.sold ? `${confirmDel.name} já foi vendido ${confirmDel.sold}×: ele sai da loja, mas quem comprou continua com ele no quarto.` : `${confirmDel?.name} será excluído.`}</p>
      </Dialog>
    </div>
  );
}

/** Amostra do item na loja: faixas com as cores/materiais dos blocos + logo/arte da marca. */
export function StoreSwatch({ item, className = "h-20" }: { item: StoreItem; className?: string }) {
  const parts = item.kind === "WARDROBE" && item.bundle?.length ? item.bundle.map((b) => ({ k: b.slotType, color: b.finish?.color ?? "#ccc", metal: (b.finish?.metalness ?? 0) > 0.8 })) : [{ k: item.slotType, color: item.finish?.color ?? "#ccc", metal: (item.finish?.metalness ?? 0) > 0.8 }];
  const logo = item.logoUrl ?? item.creator?.logoUrl ?? null;
  return (
    <div className={`relative flex overflow-hidden rounded ${className}`} style={item.artUrl ? { backgroundImage: `url(${mediaUrl(item.artUrl)})`, backgroundSize: "cover" } : undefined}>
      {!item.artUrl && parts.map((p) => <span key={p.k} className="flex-1" style={{ background: p.metal ? `linear-gradient(135deg, ${p.color}, #ffffff 45%, ${p.color})` : item.finish?.material === "VIDRO" ? `${p.color}99` : p.color }} title={p.k} />)}
      {logo && <img src={mediaUrl(logo)} alt="" className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-white object-contain p-0.5 shadow" />}
      {item.labelText && <span className="absolute left-1 top-1 rounded bg-black/50 px-1 type-caption text-white">{item.labelText}</span>}
    </div>
  );
}

"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, Button, Chip, Dialog, EmptyState, ErrorState, Input, Select, SkeletonGrid, useToast } from "@/components/ui";
import { AVAILABILITY, SLOT_LABELS, StoreSwatch, type StoreItem } from "@/components/room3d/wardrobe-creator";

type ShopItem = StoreItem & { inventory?: { inventoryId: string; appliedModule?: string | null; serial?: number | null }[] };

const MODULE_LABELS: Record<string, string> = { ALL: "Guarda-roupa inteiro", handles: "Puxadores", top: "Maleiro", base: "Base", hangers: "Cabides", logo: "Placa de logo", rug: "Tapete", shoe: "Sapateira", bags: "Vitrine de bolsas", jewelry: "Porta-joias", island: "Ilha central", light: "Iluminação", season: "Maleiro da estação", signature: "Closet de assinatura" };
export const moduleLabel = (id?: string | null) => !id ? "—" : MODULE_LABELS[id] ?? id.replace(/^door:(\d+)$/, "Porta $1").replace(/^drawer:(\d+)$/, "Gaveta $1");
const KINDS = [{ id: "", label: "Tudo" }, { id: "COMPONENT", label: "Componentes" }, { id: "WARDROBE", label: "Guarda-roupas inteiros" }];
const ORIGINS = [{ id: "", label: "Todas as origens" }, { id: "FAI", label: "Fábrica FAI" }, { id: "MARCA", label: "Marcas" }, { id: "CELEBRIDADE", label: "Celebridades" }];
const SORTS = [{ id: "price", label: "Menor preço" }, { id: "-price", label: "Maior preço" }, { id: "new", label: "Marcas primeiro" }];

/**
 * Loja do quarto (RF35 + RF39): todos os blocos do guarda-roupa por material, cor e selo de identidade — fábrica FAI e
 * itens criados por marcas/celebridades —, com as condições de cada item (nível, estoque, limite por pessoa,
 * janela de disponibilidade, selo exigido). Comprar abre a escolha do módulo onde o item será montado.
 */
export function RoomStore({ creatorSlug, onChanged, compact }: { creatorSlug?: string; onChanged?: () => void; compact?: boolean }) {
  const { fmtDate } = useI18n(); const toast = useToast();
  const shop = useApi<ShopItem[]>((signal) => api.get("/api/points/shop", { signal }), []);
  const [kind, setKind] = useState(""); const [slot, setSlot] = useState(""); const [material, setMaterial] = useState(""); const [origin, setOrigin] = useState("");
  const [creator, setCreator] = useState(creatorSlug ?? ""); const [q, setQ] = useState(""); const [onlyBuyable, setOnlyBuyable] = useState(false); const [sort, setSort] = useState("price");
  const [apply, setApply] = useState<{ item: ShopItem; inventoryId: string } | null>(null); const [target, setTarget] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  const all = useMemo(() => (shop.data ?? []).filter((i) => !creatorSlug || i.creator?.slug === creatorSlug), [shop.data, creatorSlug]);
  const slots = useMemo(() => Array.from(new Map(all.filter((i) => i.kind === "COMPONENT").map((i) => [i.slotType, i.blockLabel.replace(/ \(.*\)$/, "").replace(/ 60 cm$| 90 cm.*$/, "")])).entries()), [all]);
  const materials = useMemo(() => Array.from(new Map(all.filter((i) => i.material).map((i) => [i.material!, i.materialLabel ?? i.material!])).entries()), [all]);
  const creators = useMemo(() => Array.from(new Map(all.filter((i) => i.creator?.slug).map((i) => [i.creator!.slug!, i.creator!.name])).entries()), [all]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = all.filter((i) => (!kind || i.kind === kind) && (!slot || i.slotType === slot) && (!material || i.material === material || (i.bundle ?? []).some((b) => b.material === material))
      && (!origin || (origin === "FAI" ? !i.creator : i.creator?.kind === origin)) && (!creator || i.creator?.slug === creator)
      && (!onlyBuyable || (!i.blocker && i.levelOk !== false && i.affordable !== false))
      && (!t || [i.name, i.colorName, i.materialLabel, i.blockLabel, i.creator?.name, i.seal?.name, ...(i.bundle ?? []).map((b) => b.colorName)].some((x) => x?.toLowerCase().includes(t))));
    return [...r].sort((a, b) => sort === "-price" ? b.pricePoints - a.pricePoints : sort === "new" ? Number(!!b.creator) - Number(!!a.creator) || a.pricePoints - b.pricePoints : a.pricePoints - b.pricePoints);
  }, [all, kind, slot, material, origin, creator, onlyBuyable, q, sort]);

  async function buy(i: ShopItem) {
    setBusy(i.sku);
    try {
      const r = await api.post<{ inventoryId: string; balance: number; serial?: string }>(`/api/points/shop/${i.sku}/purchase`);
      toast.success(`${i.name} comprado${r.serial && r.serial !== "null" ? ` (nº ${r.serial})` : ""} — saldo ${r.balance} pts.`);
      openApply(i, r.inventoryId); shop.reload(); onChanged?.();
    } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  async function tryOn(i: ShopItem) {
    try { const r = await api.post<{ module?: string; note?: string }>(`/api/points/shop/${i.sku}/try-on`, {}); toast.info(`Prévia em ${moduleLabel(r.module)}: ${r.note ?? "nada foi comprado."}`); } catch (e) { toast.fromError(e); }
  }
  function openApply(i: ShopItem, inventoryId: string) { setApply({ item: i, inventoryId }); setTarget(i.compatibleModules?.[0] ?? ""); }
  async function doApply() {
    if (!apply || !target) return;
    try { await api.post(`/api/me/room-inventory/${apply.inventoryId}/apply`, { moduleId: target }); toast.success(`${apply.item.name} montado em ${moduleLabel(target)}.`); setApply(null); shop.reload(); onChanged?.(); } catch (e) { toast.fromError(e); }
  }

  if (shop.error) return <ErrorState error={shop.error} onRetry={shop.reload} />;
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-1">{KINDS.map((k) => <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</Chip>)}</div>
        {kind !== "WARDROBE" && slots.length > 1 && <div className="flex flex-wrap gap-1" aria-label="bloco"><Chip active={!slot} onClick={() => setSlot("")}>Todos os blocos</Chip>{slots.map(([s, l]) => <Chip key={s} active={slot === s} onClick={() => setSlot(s)}>{l}</Chip>)}</div>}
        {materials.length > 1 && <div className="flex flex-wrap gap-1" aria-label="material"><Chip active={!material} onClick={() => setMaterial("")}>Todos os materiais</Chip>{materials.map(([m, l]) => <Chip key={m} active={material === m} onClick={() => setMaterial(m)}>{l}</Chip>)}</div>}
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Input aria-label="buscar cor ou nome" placeholder="cor, nome, marca…" value={q} onChange={(e) => setQ(e.target.value)} />
          {!creatorSlug && <Select aria-label="origem" value={origin} onChange={(e) => setOrigin(e.target.value)}>{ORIGINS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>}
          {!creatorSlug && <Select aria-label="marca ou celebridade" value={creator} onChange={(e) => setCreator(e.target.value)}><option value="">Todas as marcas/celebridades</option>{creators.map(([s, n]) => <option key={s} value={s}>{n}</option>)}</Select>}
          <Select aria-label="ordenar" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
        </div>
        <div className="flex flex-wrap items-center gap-2"><Chip active={onlyBuyable} onClick={() => setOnlyBuyable(!onlyBuyable)}>Só o que posso comprar</Chip><span className="type-caption text-muted tabular">{list.length} de {all.length} itens</span></div>
      </div>
      {shop.loading ? <SkeletonGrid n={6} h="h-48" /> : list.length === 0 ? <EmptyState title="Nenhum item com esses filtros." hint={creatorSlug ? "Esta marca/celebridade ainda não publicou itens na loja do quarto." : "Limpe os filtros para ver toda a loja."} /> : (
        <div className="grid-cards">{list.slice(0, compact ? 12 : 400).map((i) => {
          const units = i.inventory ?? []; const loose = units.find((u) => !u.appliedModule);
          return (
            <div key={i.sku} className="surface flex flex-col p-3">
              <StoreSwatch item={i} />
              <div className="mt-2 flex items-start justify-between gap-2"><p className="type-body"><b>{i.name}</b></p><span className="type-data whitespace-nowrap">{i.pricePoints} pts</span></div>
              <p className="type-caption text-muted">{i.kind === "WARDROBE" ? `Guarda-roupa inteiro · ${i.bundle?.length ?? 0} blocos` : `${i.blockLabel} · ${i.materialLabel ?? ""} · ${i.colorName ?? ""}`}</p>
              {i.kind === "WARDROBE" && <p className="type-caption text-faint">{(i.bundle ?? []).map((b) => `${SLOT_LABELS[b.slotType] ?? b.slotType}: ${b.colorName}`).join(" · ")}</p>}
              {i.creator ? <Link href={i.creator.slug ? `/brands/${i.creator.slug}` : "#"} className="mt-1 flex items-center gap-1 type-caption underline-offset-2 hover:underline">{i.creator.logoUrl && <img src={mediaUrl(i.creator.logoUrl)} alt="" className="h-4 w-4 rounded-full object-contain" />}{i.creator.kind === "CELEBRIDADE" ? "Celebridade" : "Marca"} · {i.creator.name}</Link> : <p className="mt-1 type-caption text-faint">Fábrica FAI</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge tone={AVAILABILITY[i.availability]?.tone}>{AVAILABILITY[i.availability]?.label ?? i.availability}</Badge>
                <Badge tone={i.levelOk === false ? "mark" : undefined}>nível {i.requiredLevel}</Badge>
                {i.rarity && i.rarity !== "COMUM" && <Badge>{i.rarity.toLowerCase()}</Badge>}
                {i.seal && <Badge tone="chalk">selo {i.seal.name}</Badge>}
                {i.requiresSeal && <Badge tone="mark">exige selo</Badge>}
              </div>
              <p className="mt-1 type-data text-faint tabular">{i.stockLeft != null ? `restam ${i.stockLeft}/${i.stock} · ` : ""}{i.perUserLimit ? `máx. ${i.perUserLimit}/pessoa · ` : ""}{i.availableFrom ? `de ${fmtDate(i.availableFrom)} ` : ""}{i.availableUntil ? `até ${fmtDate(i.availableUntil)}` : ""}</p>
              {units.length > 0 && <p className="type-caption text-muted">Você tem {units.length}: {units.map((u) => moduleLabel(u.appliedModule) === "—" ? "na caixa" : moduleLabel(u.appliedModule)).join(", ")}</p>}
              {i.blocker && <p className="type-caption" style={{ color: "var(--mark)" }}>{i.blocker}</p>}
              <div className="mt-auto flex flex-wrap gap-1 pt-2">
                {loose && <Button size="sm" variant="accent" onClick={() => openApply(i, loose.inventoryId)}>Montar no quarto</Button>}
                <Button size="sm" onClick={() => tryOn(i)}>Provar</Button>
                <Button size="sm" variant="primary" loading={busy === i.sku} disabled={!!i.blocker || i.levelOk === false || i.affordable === false} onClick={() => buy(i)} title={i.levelOk === false ? `Disponível a partir do nível ${i.requiredLevel}` : i.affordable === false ? "Saldo insuficiente" : i.blocker ?? undefined}>{units.length ? "Comprar outro" : "Comprar"}</Button>
              </div>
            </div>);
        })}</div>)}
      <Dialog open={!!apply} onClose={() => setApply(null)} title={`Montar ${apply?.item.name ?? ""}`} footer={<><Button onClick={() => setApply(null)}>Deixar na caixa</Button><Button variant="primary" disabled={!target} onClick={doApply}>Montar</Button></>}>
        {apply && ((apply.item.compatibleModules ?? []).length === 0 ? <p className="type-body">Nenhum módulo compatível no seu nível atual — o item fica na caixa e monta sozinho quando você subir de nível (Meu Quarto → caixa de entrega).</p> : <>
          <p className="type-body-sm text-muted mb-2">{apply.item.kind === "WARDROBE" ? "O guarda-roupa inteiro troca o acabamento de todos os blocos de uma vez." : "Escolha o módulo onde este componente será montado."}</p>
          <div className="flex flex-wrap gap-1">{(apply.item.compatibleModules ?? []).map((m) => <Chip key={m} active={target === m} onClick={() => setTarget(m)}>{moduleLabel(m)}</Chip>)}</div>
        </>)}
      </Dialog>
    </div>
  );
}

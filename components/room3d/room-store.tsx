"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { Badge, Button, Chip, Dialog, EmptyState, ErrorState, SkeletonGrid, useToast } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { AVAILABILITY, SLOT_LABELS, StoreSwatch, type StoreItem } from "@/components/room3d/wardrobe-creator";

type ShopItem = StoreItem & { inventory?: { inventoryId: string; appliedModule?: string | null; serial?: number | null }[] };

const MODULE_LABELS: Record<string, string> = { get ALL() { return tr("room3d.wardrobeCreator.guarda_roupa_inteiro"); }, get handles() { return tr("common.puxadores"); }, get top() { return tr("common.maleiro"); }, get base() { return tr("common.base"); }, get hangers() { return tr("common.cabides"); }, get logo() { return tr("common.placa_de_logo"); }, get rug() { return tr("common.tapete"); }, get shoe() { return tr("room3d.roomScene.sapateira"); }, get bags() { return tr("room3d.roomScene.vitrine_de_bolsas"); }, get jewelry() { return tr("common.porta_joias"); }, get island() { return tr("common.ilha_central"); }, get light() { return tr("room3d.roomStore.iluminacao"); }, get season() { return tr("room3d.roomStore.maleiro_da_estacao"); }, get signature() { return tr("room3d.roomStore.closet_de_assinatura"); } };
export const moduleLabel = (id?: string | null) => !id ? "—" : MODULE_LABELS[id] ?? id.replace(/^door:(\d+)$/, tr("room3d.roomStore.porta_1")).replace(/^drawer:(\d+)$/, tr("room3d.roomStore.gaveta_1"));
const KINDS = [{ id: "", get label() { return tr("room3d.roomStore.tudo"); } }, { id: "COMPONENT", get label() { return tr("room3d.roomStore.componentes"); } }, { id: "WARDROBE", get label() { return tr("room3d.roomStore.guarda_roupas_inteiros"); } }];
const ORIGINS = [{ id: "", get label() { return tr("room3d.roomStore.todas_as_origens"); } }, { id: "FAI", get label() { return tr("room3d.roomStore.fabrica_fai"); } }, { id: "MARCA", get label() { return tr("nav.brands"); } }, { id: "CELEBRIDADE", get label() { return tr("common.celebridades"); } }];
const PAGE = 24;
const SORTS = [{ id: "price", get label() { return tr("room3d.roomStore.menor_preco"); } }, { id: "-price", get label() { return tr("room3d.roomStore.maior_preco"); } }, { id: "new", get label() { return tr("room3d.roomStore.marcas_primeiro"); } }];

/**
 * Loja do quarto (RF35 + RF39): todos os blocos do guarda-roupa por material, cor e selo de identidade — fábrica FAI e
 * itens criados por marcas/celebridades —, com as condições de cada item (nível, estoque, limite por pessoa,
 * janela de disponibilidade, selo exigido). Comprar abre a escolha do módulo onde o item será montado.
 */
export function RoomStore({ creatorSlug, onChanged, compact }: { creatorSlug?: string; onChanged?: () => void; compact?: boolean }) {
  const { fmtDate, t } = useI18n(); const toast = useToast();
  const shop = useApi<ShopItem[]>((signal) => api.get("/api/points/shop", { signal }), []);
  const [shown, setShown] = useState(PAGE);
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
      toast.success(t("room3d.roomStore.comprado_saldo_pts", { name: i.name, value: r.serial && r.serial !== "null" ? ` (nº ${r.serial})` : "", balance: r.balance }));
      openApply(i, r.inventoryId); shop.reload(); onChanged?.();
    } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  async function tryOn(i: ShopItem) {
    try { const r = await api.post<{ module?: string; note?: string }>(`/api/points/shop/${i.sku}/try-on`, {}); toast.info(t("room3d.roomStore.previa_em", { moduleLabel: moduleLabel(r.module), value: r.note ?? t("room3d.roomStore.nada_foi_comprado") })); } catch (e) { toast.fromError(e); }
  }
  function openApply(i: ShopItem, inventoryId: string) { setApply({ item: i, inventoryId }); setTarget(i.compatibleModules?.[0] ?? ""); }
  async function doApply() {
    if (!apply || !target) return;
    try { await api.post(`/api/me/room-inventory/${apply.inventoryId}/apply`, { moduleId: target }); toast.success(t("room3d.roomStore.montado_em", { name: apply.item.name, moduleLabel: moduleLabel(target) })); setApply(null); shop.reload(); onChanged?.(); } catch (e) { toast.fromError(e); }
  }

  if (shop.error) return <ErrorState error={shop.error} onRetry={shop.reload} />;
  return (
    <div className="grid gap-3">
      <FilterBar search={q} onSearch={setQ} searchLabel={t("room3d.roomStore.buscar_cor_ou_nome")}
        quick={{ key: "kind", label: t("room3d.roomStore.kindLabel"), options: KINDS.map((k) => ({ value: k.id, label: k.label })) }}
        filters={[
          ...(kind !== "WARDROBE" && slots.length > 1 ? [{ key: "slot", label: t("room3d.roomStore.bloco"), options: slots.map(([v, l]) => ({ value: v, label: l })) }] : []),
          ...(materials.length > 1 ? [{ key: "material", label: t("room3d.roomStore.material"), options: materials.map(([v, l]) => ({ value: v, label: l })) }] : []),
          ...(!creatorSlug ? [{ key: "origin", label: t("room3d.roomStore.origem"), options: ORIGINS.filter((o) => o.id).map((o) => ({ value: o.id, label: o.label })) }] : []),
          ...(!creatorSlug && creators.length ? [{ key: "creator", label: t("room3d.roomStore.marca_ou_celebridade"), options: creators.map(([v, l]) => ({ value: v, label: l })) }] : []),
          { key: "buyable", label: t("room3d.roomStore.availability"), options: [{ value: "1", label: t("room3d.roomStore.so_o_que_posso_comprar") }] },
        ]}
        values={{ kind, slot, material, origin, creator, buyable: onlyBuyable ? "1" : "" }}
        onChange={(k, v) => { setShown(PAGE); ({ kind: setKind, slot: setSlot, material: setMaterial, origin: setOrigin, creator: setCreator } as Record<string, (x: string) => void>)[k]?.(v); if (k === "buyable") setOnlyBuyable(v === "1"); }}
        sort={{ value: sort, onChange: setSort, options: SORTS.map((x) => ({ value: x.id, label: x.label })) }}
        resultCount={list.length} />
      {shop.loading ? <SkeletonGrid n={6} h="h-48" /> : list.length === 0 ? <EmptyState title={t("room3d.roomStore.nenhum_item_com_esses_filtros")} hint={creatorSlug ? t("room3d.roomStore.esta_marca_celebridade_ainda_nao") : t("room3d.roomStore.limpe_os_filtros_para_ver")} /> : (
        <><div className="grid-cards">{list.slice(0, compact ? 12 : shown).map((i) => {
          const units = i.inventory ?? []; const loose = units.find((u) => !u.appliedModule);
          return (
            <div key={i.sku} className="surface flex flex-col p-3">
              <StoreSwatch item={i} />
              <div className="mt-2 flex items-start justify-between gap-2"><p className="type-body"><b>{i.name}</b></p><span className="type-data whitespace-nowrap">{t("common.pts_2", { pricePoints: i.pricePoints })}</span></div>
              <p className="type-caption text-muted">{i.kind === "WARDROBE" ? t("common.guarda_roupa_inteiro_blocos", { value: i.bundle?.length ?? 0 }) : `${i.blockLabel} · ${i.materialLabel ?? ""} · ${i.colorName ?? ""}`}</p>
              {i.kind === "WARDROBE" && <p className="type-caption text-faint">{(i.bundle ?? []).map((b) => `${SLOT_LABELS[b.slotType] ?? b.slotType}: ${b.colorName}`).join(" · ")}</p>}
              {i.creator ? <Link href={i.creator.slug ? `/brands/${i.creator.slug}` : "#"} className="mt-1 flex items-center gap-1 type-caption underline-offset-2 hover:underline">{i.creator.logoUrl && <img src={mediaUrl(i.creator.logoUrl)} alt="" className="h-4 w-4 rounded-full object-contain" />}{i.creator.kind === "CELEBRIDADE" ? t("auth.profileCelebrity") : t("common.brand")} · {i.creator.name}</Link> : <p className="mt-1 type-caption text-faint">{t("room3d.roomStore.fabrica_fai")}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge tone={AVAILABILITY[i.availability]?.tone}>{AVAILABILITY[i.availability]?.label ?? i.availability}</Badge>
                <Badge tone={i.levelOk === false ? "mark" : undefined}>{t("common.nivel", { requiredLevel: i.requiredLevel })}</Badge>
                {i.rarity && i.rarity !== "COMUM" && <Badge>{i.rarity.toLowerCase()}</Badge>}
                {i.seal && <Badge tone="chalk">{t("common.selo", { name: i.seal.name })}</Badge>}
                {i.requiresSeal && <Badge tone="mark">{t("room3d.roomStore.exige_selo")}</Badge>}
              </div>
              <p className="mt-1 type-data text-faint tabular">{i.stockLeft != null ? t("room3d.roomStore.restam", { stockLeft: i.stockLeft, stock: i.stock }) : ""}{i.perUserLimit ? t("room3d.roomStore.max_pessoa", { perUserLimit: i.perUserLimit }) : ""}{i.availableFrom ? t("room3d.roomStore.de", { date: fmtDate(i.availableFrom) }) : ""}{i.availableUntil ? t("common.ate", { date: fmtDate(i.availableUntil) }) : ""}</p>
              {units.length > 0 && <p className="type-caption text-muted">{t("room3d.roomStore.voce_tem", { unitsCount: units.length })}{" "}{units.map((u) => moduleLabel(u.appliedModule) === "—" ? t("room3d.roomStore.na_caixa") : moduleLabel(u.appliedModule)).join(", ")}</p>}
              {i.blocker && <p className="type-caption" style={{ color: "var(--mark)" }}>{i.blocker}</p>}
              <div className="mt-auto flex flex-wrap gap-1 pt-2">
                {loose && <Button size="sm" variant="accent" onClick={() => openApply(i, loose.inventoryId)}>{t("room3d.roomStore.montar_no_quarto")}</Button>}
                <Button size="sm" onClick={() => tryOn(i)}>{t("scheme.tryOn")}</Button>
                <Button size="sm" variant="primary" loading={busy === i.sku} disabled={!!i.blocker || i.levelOk === false || i.affordable === false} onClick={() => buy(i)} title={i.levelOk === false ? t("room3d.roomStore.disponivel_a_partir_do_nivel", { requiredLevel: i.requiredLevel }) : i.affordable === false ? t("room3d.roomStore.saldo_insuficiente") : i.blocker ?? undefined}>{units.length ? t("room3d.roomStore.comprar_outro") : t("room3d.roomStore.comprar")}</Button>
              </div>
            </div>);
        })}</div>
        {!compact && list.length > shown && <div className="mt-4 flex justify-center"><Button onClick={() => setShown((n) => n + PAGE)}>{t("room3d.roomStore.showMore", { count: Math.min(PAGE, list.length - shown), shown, total: list.length })}</Button></div>}</>)}
      <Dialog open={!!apply} onClose={() => setApply(null)} title={t("room3d.roomStore.montar", { value: apply?.item.name ?? "" })} footer={<><Button onClick={() => setApply(null)}>{t("room3d.roomStore.deixar_na_caixa")}</Button><Button variant="primary" disabled={!target} onClick={doApply}>{t("room3d.roomStore.montar_2")}</Button></>}>
        {apply && ((apply.item.compatibleModules ?? []).length === 0 ? <p className="type-body">{t("room3d.roomStore.nenhum_modulo_compativel_no_seu")}</p> : <>
          <p className="type-body-sm text-muted mb-2">{apply.item.kind === "WARDROBE" ? t("room3d.roomStore.o_guarda_roupa_inteiro_troca") : t("room3d.roomStore.escolha_o_modulo_onde_este")}</p>
          <div className="flex flex-wrap gap-1">{(apply.item.compatibleModules ?? []).map((m) => <Chip key={m} active={target === m} onClick={() => setTarget(m)}>{moduleLabel(m)}</Chip>)}</div>
        </>)}
      </Dialog>
    </div>
  );
}

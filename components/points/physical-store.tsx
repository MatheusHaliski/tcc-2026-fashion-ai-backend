"use client";

import { useMemo, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, SegmentPicker, Select, SkeletonGrid, Textarea, useToast } from "@/components/ui";
import { CatalogPhoto } from "@/components/catalog/catalog-photo";
import { FaiIcon } from "@/components/fai-icon";

type Segment = "CLOTHING" | "SHOES" | "ACCESSORIES";
type CatalogCategory = "upper_piece" | "lower_piece" | "full_body_piece" | "shoes_piece" | "accessory_piece";
type CatalogProduct = { id: string; productName: string; category: CatalogCategory; imageUrl?: string | null; catalogImage?: { url: string; mode: "SEMANTIC_CROP" | "PROCESSED"; crop?: { x: number; y: number; w: number; h: number }; background?: string } | null };
type Seller = { name?: string; slug?: string; logoUrl?: string | null; kind?: string };
type Listing = { id: string; product: CatalogProduct; description?: string | null; pricePoints: number; requiredLevel: string; levelOk: boolean; affordable: boolean; stock?: number; active: boolean; seller?: Seller };
type Order = { id: string; listingId: string; product: CatalogProduct; seller?: Seller; pricePoints: number; status: string; trackingCode?: string | null; trackingUrl?: string | null; buyer?: string; shippingAddress?: Record<string, string | null> };
const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "CLOTHING", label: "physicalStore.clothing" },
  { id: "SHOES", label: "physicalStore.shoes" },
  { id: "ACCESSORIES", label: "physicalStore.accessories" },
];
const LEVELS = ["ESTREIA", "STUDIO", "LOFT", "CLOSET", "ATELIER", "PENTHOUSE", "MAISON"];
const EMPTY_ADDRESS = { fullName: "", phone: "", postalCode: "", state: "", city: "", neighborhood: "", street: "", number: "", complement: "" };
const addressFields = ["fullName", "phone", "postalCode", "state", "city", "neighborhood", "street", "number", "complement"] as const;

function BrandWatermark({ seller }: { seller?: Seller }) {
  const logo = mediaUrl(seller?.logoUrl);
  if (!seller?.name) return null;
  return <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-full border border-white/40 bg-black/60 px-2 py-1 text-white shadow-lg backdrop-blur-sm" aria-label={seller.name}>
    {logo ? <img src={logo} alt="" className="h-6 w-6 rounded-full bg-white object-contain p-0.5" /> : <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-xs font-bold">{seller.name.slice(0, 1).toUpperCase()}</span>}
    <span className="truncate text-xs font-semibold">{seller.name}</span>
  </div>;
}

export function PhysicalStore({ creatorSlug }: { creatorSlug?: string }) {
  const { t, fmtNumber } = useI18n();
  const toast = useToast();
  const [segment, setSegment] = useState<Segment>("CLOTHING");
  const [checkout, setCheckout] = useState<Listing | null>(null);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const listings = useApi<Listing[]>((signal) => api.get(`/api/physical-store?segment=${segment}`, { signal }), [segment]);
  const visible = useMemo(() => (listings.data ?? []).filter((entry) => !creatorSlug || entry.seller?.slug === creatorSlug)
    .filter((entry) => !query.trim() || `${entry.product.productName} ${entry.seller?.name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [listings.data, creatorSlug, query]);

  async function redeem() {
    if (!checkout || busy) return;
    setBusy(true);
    try {
      await api.post(`/api/physical-store/listings/${checkout.id}/redeem`, { shippingAddress: address });
      toast.success(t("physicalStore.orderPlaced"));
      setCheckout(null); setAddress(EMPTY_ADDRESS); listings.reload();
    } catch (error) { toast.fromError(error); listings.reload(); }
    finally { setBusy(false); }
  }

  return <section className="grid gap-4">
    <SegmentPicker<Segment> label={t("physicalStore.category")} value={segment} onChange={setSegment} options={SEGMENTS.map((item) => ({ id: item.id, label: t(item.label) }))} />
    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("physicalStore.search")} aria-label={t("physicalStore.search")} />
    {listings.error ? <ErrorState error={listings.error} onRetry={listings.reload} /> : listings.loading && !listings.data ? <SkeletonGrid /> : visible.length === 0
      ? <EmptyState title={t("physicalStore.empty")} hint={t("physicalStore.emptyHint")} />
      : <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((listing) => <li key={listing.id} className="surface overflow-hidden">
        <div className="relative aspect-[4/5] bg-surface-2">
          <CatalogPhoto image={listing.product.catalogImage} fallbackUrl={listing.product.imageUrl} alt={listing.product.productName} className="h-full w-full" />
          <BrandWatermark seller={listing.seller} />
        </div>
        <div className="grid gap-2 p-4">
          <h2 className="type-h3">{listing.product.productName}</h2>
          {listing.description && <p className="type-body-sm text-muted">{listing.description}</p>}
          <p className="type-caption text-muted">{t("physicalStore.issuedBy")} {listing.seller?.name}</p>
          <p className="flex items-center gap-1 font-semibold"><FaiIcon id="ACT-40" size={20} decorative />{fmtNumber(listing.pricePoints)}</p>
          {!listing.levelOk && <Badge tone="mark"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_3px_rgba(251,113,133,0.8)]" aria-hidden />{t("physicalStore.locked", { level: t(`levelProgress.name.${listing.requiredLevel}`) })}</Badge>}
          {listing.levelOk && !listing.affordable && <p className="type-caption text-muted">{t("physicalStore.notEnoughPoints")}</p>}
          <Button variant="primary" disabled={!listing.levelOk || !listing.affordable || busy} onClick={() => setCheckout(listing)}>{t("physicalStore.redeem")}</Button>
        </div>
      </li>)}</ul>}
    <Dialog open={!!checkout} onClose={() => !busy && setCheckout(null)} title={t("physicalStore.checkoutTitle")} footer={<><Button disabled={busy} onClick={() => setCheckout(null)}>{t("common.cancel")}</Button><Button variant="primary" loading={busy} disabled={addressFields.some((field) => field !== "complement" && !address[field].trim())} onClick={redeem}>{t("physicalStore.confirmRedeem")}</Button></>}>
      <p className="mb-3 type-body-sm text-muted">{t("physicalStore.shippingHint")}</p>
      <div className="grid gap-x-3 sm:grid-cols-2">{addressFields.map((field) => <Field key={field} label={t(`physicalStore.address.${field}`)}>
        <Input required={field !== "complement"} maxLength={field === "fullName" ? 120 : field === "street" ? 180 : 120} value={address[field]} onChange={(event) => setAddress((value) => ({ ...value, [field]: event.target.value }))} />
      </Field>)}</div>
    </Dialog>
  </section>;
}

export function PhysicalStoreSellerManager() {
  const { t, fmtNumber } = useI18n();
  const toast = useToast();
  const [segment, setSegment] = useState<Segment>("CLOTHING");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [editing, setEditing] = useState<Listing | null>(null);
  const [price, setPrice] = useState("100");
  const [level, setLevel] = useState("ESTREIA");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = useApi<Listing[]>((signal) => api.get("/api/physical-store/mine", { signal }), []);
  const products = useApi<CatalogProduct[]>((signal) => api.get(`/api/physical-store/products?category=${segment}`, { signal }), [segment]);

  function beginEdit(item: Listing) {
    setEditing(item); setSegment(item.product.category === "shoes_piece" ? "SHOES" : item.product.category === "accessory_piece" ? "ACCESSORIES" : "CLOTHING");
    setSelectedProduct(item.product.id); setPrice(String(item.pricePoints)); setLevel(item.requiredLevel); setDescription(item.description ?? "");
  }
  async function save() {
    if (busy || (!editing && !selectedProduct)) return;
    setBusy(true);
    try {
      const body = { productId: editing?.product.id ?? selectedProduct, description, pricePoints: Number(price), requiredLevel: level, active: editing?.active ?? true };
      if (editing) await api.put(`/api/physical-store/listings/${editing.id}`, body);
      else await api.post("/api/physical-store/listings", body);
      toast.success(t("common.saved")); setEditing(null); setSelectedProduct(""); setDescription(""); mine.reload();
    } catch (error) { toast.fromError(error); }
    finally { setBusy(false); }
  }
  async function remove(item: Listing) {
    if (busy) return;
    setBusy(true);
    try { await api.delete(`/api/physical-store/listings/${item.id}`); mine.reload(); }
    catch (error) { toast.fromError(error); }
    finally { setBusy(false); }
  }

  return <div className="grid gap-4">
    <p className="type-body-sm text-muted">{t("physicalStore.sellerHint")}</p>
    <div className="surface grid gap-3 p-4">
      <h2 className="type-h3">{editing ? t("physicalStore.editListing") : t("physicalStore.newListing")}</h2>
      <SegmentPicker<Segment> label={t("physicalStore.category")} value={segment} onChange={(next) => { setSegment(next); setSelectedProduct(""); }} options={SEGMENTS.map((item) => ({ id: item.id, label: t(item.label) }))} />
      <Field label={t("physicalStore.catalogProduct")}>
        <Select value={selectedProduct} disabled={!!editing} onChange={(event) => setSelectedProduct(event.target.value)}>
          <option value="">{t("physicalStore.chooseProduct")}</option>
          {(products.data ?? []).map((product) => <option key={product.id} value={product.id}>{product.productName}</option>)}
        </Select>
      </Field>
      <Field label={t("physicalStore.description")}><Textarea value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("physicalStore.price")}><Input type="number" min={1} max={1000000} value={price} onChange={(event) => setPrice(event.target.value)} /></Field>
        <Field label={t("physicalStore.unlockLevel")}><Select value={level} onChange={(event) => setLevel(event.target.value)}>{LEVELS.map((item) => <option key={item} value={item}>{t(`levelProgress.name.${item}`)}</option>)}</Select></Field>
      </div>
      <p className="type-caption text-muted">{t("physicalStore.adminStock")}</p>
      <div className="flex gap-2"><Button variant="primary" loading={busy} disabled={!editing && (!selectedProduct || products.loading)} onClick={save}>{editing ? t("common.save") : t("physicalStore.createListing")}</Button>{editing && <Button disabled={busy} onClick={() => setEditing(null)}>{t("common.cancel")}</Button>}</div>
    </div>
    {mine.error ? <ErrorState error={mine.error} onRetry={mine.reload} /> : mine.loading && !mine.data ? <SkeletonGrid /> : (mine.data ?? []).length === 0 ? <EmptyState title={t("physicalStore.noListings")} /> : <ul className="grid gap-3">{mine.data!.map((item) => <li key={item.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0"><b>{item.product.productName}</b><p className="type-caption text-muted">{fmtNumber(item.pricePoints)} {t("nav.points")} · {t("physicalStore.stockManagedByAdmin", { count: item.stock ?? 0 })} · {t(`levelProgress.name.${item.requiredLevel}`)}</p></div>
      <div className="flex gap-2"><Button size="sm" onClick={() => beginEdit(item)}>{t("common.edit")}</Button><Button size="sm" variant="danger" disabled={busy} onClick={() => remove(item)}>{t("common.remove")}</Button></div>
    </li>)}</ul>}
  </div>;
}

export function AdminPhysicalStore() {
  const { t } = useI18n();
  const toast = useToast();
  const listings = useApi<Listing[]>((signal) => api.get("/api/admin/physical-store/listings", { signal }), []);
  const orders = useApi<Order[]>((signal) => api.get("/api/admin/physical-store/orders", { signal }), []);
  const [stock, setStock] = useState<Record<string, string>>({});
  const [shipment, setShipment] = useState<Record<string, { status: string; trackingCode: string; trackingUrl: string }>>({});
  const [busy, setBusy] = useState(false);
  async function saveStock(item: Listing) {
    setBusy(true);
    try { await api.put(`/api/admin/physical-store/listings/${item.id}/stock`, { quantity: Number(stock[item.id] ?? item.stock ?? 0) }); listings.reload(); }
    catch (error) { toast.fromError(error); }
    finally { setBusy(false); }
  }
  async function saveShipment(order: Order) {
    setBusy(true);
    const value = shipment[order.id] ?? { status: order.status, trackingCode: order.trackingCode ?? "", trackingUrl: order.trackingUrl ?? "" };
    try { await api.put(`/api/admin/physical-store/orders/${order.id}/shipment`, value); orders.reload(); toast.success(t("common.saved")); }
    catch (error) { toast.fromError(error); }
    finally { setBusy(false); }
  }
  return <div className="grid gap-6">
    <section className="grid gap-3"><h2 className="type-h2">{t("physicalStore.inventory")}</h2>{listings.error ? <ErrorState error={listings.error} onRetry={listings.reload} /> : (listings.data ?? []).map((item) => <div key={item.id} className="surface flex flex-wrap items-center gap-3 p-3"><span className="min-w-0 flex-1">{item.product.productName} · {item.seller?.name}</span><Input aria-label={t("physicalStore.stock")} type="number" min={0} max={1000000} className="w-28" value={stock[item.id] ?? String(item.stock ?? 0)} onChange={(event) => setStock((current) => ({ ...current, [item.id]: event.target.value }))} /><Button size="sm" loading={busy} onClick={() => saveStock(item)}>{t("common.save")}</Button></div>)}</section>
    <section className="grid gap-3"><h2 className="type-h2">{t("physicalStore.fulfillment")}</h2>{orders.error ? <ErrorState error={orders.error} onRetry={orders.reload} /> : (orders.data ?? []).length === 0 ? <EmptyState title={t("physicalStore.noOrders")} /> : (orders.data ?? []).map((order) => {
      const value = shipment[order.id] ?? { status: order.status, trackingCode: order.trackingCode ?? "", trackingUrl: order.trackingUrl ?? "" };
      const field = (name: keyof typeof value, next: string) => setShipment((current) => ({ ...current, [order.id]: { ...value, [name]: next } }));
      return <article key={order.id} className="surface grid gap-3 p-4"><div><b>{order.product.productName}</b><p className="type-caption text-muted">{order.buyer} · {order.pricePoints} {t("nav.points")}</p><pre className="mt-2 whitespace-pre-wrap text-xs">{Object.entries(order.shippingAddress ?? {}).map(([key, text]) => `${key}: ${text ?? ""}`).join("\n")}</pre></div>
        <div className="grid gap-3 sm:grid-cols-3"><Field label={t("physicalStore.status")}><Select value={value.status} onChange={(event) => field("status", event.target.value)}><option value="PROCESSING">{t("physicalStore.processing")}</option><option value="SHIPPED">{t("physicalStore.shipped")}</option><option value="DELIVERED">{t("physicalStore.delivered")}</option></Select></Field><Field label={t("physicalStore.trackingCode")}><Input value={value.trackingCode} onChange={(event) => field("trackingCode", event.target.value)} /></Field><Field label={t("physicalStore.trackingUrl")}><Input type="url" value={value.trackingUrl} onChange={(event) => field("trackingUrl", event.target.value)} /></Field></div>
        <div><Button size="sm" variant="primary" loading={busy} onClick={() => saveShipment(order)}>{t("physicalStore.saveShipment")}</Button></div>
      </article>;
    })}</section>
  </div>;
}

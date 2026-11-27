"use client";
import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { FAI_STORE_TYPES, faiStoreApi, type FaiStoreItem, type FaiStoreType } from "@/lib/fai-store/api";
import { Chip, EmptyState, ErrorState, SkeletonGrid, useToast } from "@/components/ui";
import { StoreItemCard } from "./store-item-card";
import { StoreItemDialog } from "./store-item-dialog";

type Filter = FaiStoreType | "ALL";

/**
 * Loja FAI Points (/points/loja): itens do próprio app — presets de Aura, guarda-roupas e itens do Acervo, molduras de
 * card de peça e de look, presets de Aura e peças digitais de marcas e celebridades —, comprados só com FAI Points.
 * Grade de cards com filtro por tipo; o card abre o card de loja expandido com o botão de comprar.
 */
export function FaiStore({ onChanged }: { onChanged?: () => void }) {
  const { t, fmtNumber } = useI18n();
  const toast = useToast();
  const store = useApi((signal) => faiStoreApi.store(signal), []);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = useMemo(() => store.data?.items ?? [], [store.data]);
  const present = useMemo(() => FAI_STORE_TYPES.filter((type) => items.some((i) => i.type === type)), [items]);
  const visible = filter === "ALL" ? items : items.filter((i) => i.type === filter);
  const open = items.find((i) => i.id === openId) ?? null;

  function show(item: FaiStoreItem) { setError(null); setOpenId(item.id); }
  async function buy() {
    if (!open || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await faiStoreApi.purchase(open.id);
      toast.success(t("faiStore.purchased", { name: open.name, balance: fmtNumber(result.balance) }));
      store.reload(); onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("store.purchaseFailed"));
      store.reload();
    } finally { setBusy(false); }
  }

  if (store.error) return <ErrorState error={store.error} onRetry={store.reload} />;
  if (store.loading && !store.data) return <SkeletonGrid />;
  return (
    <section className="fai-store grid gap-4" aria-labelledby="fai-store-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="fai-store-title" className="type-h2">{t("faiStore.title")}</h2>
        <p className="type-body-sm text-muted">{t("faiStore.lead")}</p>
      </div>
      <div className="fai-store-filters" role="group" aria-label={t("faiStore.filters")}>
        <Chip active={filter === "ALL"} onClick={() => setFilter("ALL")}>{t("faiStore.type.ALL")}</Chip>
        {present.map((type) => <Chip key={type} active={filter === type} onClick={() => setFilter(type)}>{t(`faiStore.type.${type}`)}</Chip>)}
      </div>
      {visible.length === 0
        ? <EmptyState title={t(items.length ? "faiStore.emptyFilter" : "faiStore.empty")} />
        : <ul className="fai-store-grid">{visible.map((item) => <StoreItemCard key={item.id} item={item} onOpen={show} />)}</ul>}
      <StoreItemDialog item={open} balance={store.data?.balance ?? 0} busy={busy} error={error} onBuy={buy} onClose={() => setOpenId(null)} />
    </section>
  );
}

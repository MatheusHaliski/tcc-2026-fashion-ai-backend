"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Dialog, ErrorState, PageHeader, SegmentPicker, Skeleton, useToast } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import type { CatalogSearchContext } from "@/components/catalog/catalog-search";
import { useTaxonomy } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { useFittingSession } from "@/lib/hooks/use-fitting-session";
import { useFittingScene, type FittingSearchResults } from "@/lib/hooks/use-fitting-scene";
import { useFittingShare } from "@/lib/hooks/use-fitting-share";
import { useSavedTries } from "@/lib/hooks/use-saved-tries";
import { FITTING_SLOTS, visibleItems, type EnvironmentMode, type LightMode } from "@/lib/tryon/fitting-room";
import { fromWardrobe, nextTick, type SavedTry, type Sex, type State, type Store, type Tab } from "@/lib/tryon/fitting-room-model";
import { FittingStage } from "./fitting-stage";
import { FittingControls } from "./fitting-controls";
import { FittingItems } from "./fitting-items";
import { StoreBrowser } from "./store-browser";
import { WardrobeBrowser } from "./wardrobe-browser";
import { SavedTries } from "./saved-tries";
import { AiTryOnDialog } from "./ai-try-on-dialog";

export function FittingRoom() {
  const { t } = useI18n();
  const toast = useToast();
  const searchParams = useSearchParams();
  const taxonomy = useTaxonomy();
  const { data, error, reload } = useApi<State>((signal) => api.get("/api/try-on", { signal }), []);
  const stores = useApi<{ stores: Store[] }>((signal) => api.get("/api/catalog/stores", { signal }), [], { refreshInterval: 30_000 });

  const [mode, setMode] = useState<EnvironmentMode>("auto");
  const [light, setLight] = useState<LightMode>("daylight");
  const [tab, setTab] = useState<Tab>("stores");
  const [category, setCategory] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [store, setStore] = useState(searchParams.get("marca") ?? "");
  const [confirmClear, setConfirmClear] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState<FittingSearchResults | null>(null);
  const [catalogTarget, setCatalogTarget] = useState<HTMLDivElement | null>(null);
  const [heroId, setHeroId] = useState<string | null>(null);
  
  // o manequim segue o sexo do avatar; o gênero das peças é um filtro rápido do catálogo (chips do CatalogSearch)
  const mannequinSex = data?.sex ?? "MASCULINO";

  const session = useFittingSession({
    data, colors: taxonomy?.colors, searchParams, onStatus: setStatus, onOwned: reload,
  });
  const savedTries = useSavedTries(!!data);
  const { environment, scene } = useFittingScene({
    items: session.items, mode, search, stores: stores.data?.stores, heroId, products: session.products,
  });
  const share = useFittingShare(session.items, environment.featured.key);
  const shown = useMemo(() => visibleItems(session.items), [session.items]);
  const onSearchResults = useCallback((ctx: CatalogSearchContext, results: CatalogProduct[]) => {
    setSearch({ ctx, results });
  }, []);

  function pickProduct(product: CatalogProduct, variant: CatalogVariant | null) {
    setHeroId(product.id);
    session.pickProduct(product, variant);
  }

  function saveTry() {
    if (!session.items.length) return;
    const title = environment.brands.length
      ? environment.brands.map((brand) => brand.name).join(" + ")
      : t("tryOn.prova_sem_marca");
    savedTries.save(title, session.items);
    toast.success(t("tryOn.prova_salva"));
    setTab("saved");
  }

  function restoreSaved(saved: SavedTry) {
    session.commit(saved.items.map((item) => ({ ...item, addedAt: nextTick() })));
    setStatus(t("tryOn.prova_vestida", { title: saved.title }));
  }

  function clear() {
    session.commit([]);
    setConfirmClear(false);
    toast.info(t("tryOn.provador_limpo"));
  }

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-96" />;
  const wardrobeCount = FITTING_SLOTS.reduce((count, slot) => count + (data.pieces?.[slot]?.length ?? 0), 0);

  return (
    <>
      <PageHeader
        title={t("tryOn.titulo_lojas")}
        kicker="RF18"
        lead={t("tryOn.lead_lojas")}
        actions={(
          <Button size="sm" onClick={() => setAiOpen(true)}>{t("tryOn.ia_botao")}</Button>
        )}
      />
      <div className="fitting-workspace">
        <div className="fitting-preview">
          <FittingStage
            avatar={data.avatar ?? null} mannequin={data.mannequin} pieces={shown}
            environment={environment} scene={scene} light={light} view="front"
            sex={mannequinSex} onCanvas={share.onCanvas}
          >
            <FittingControls
              light={light} onLightChange={setLight} mode={mode} onModeChange={setMode}
              environment={environment} itemCount={session.items.length} onSnapshot={share.snapshot}
              onCopyLink={share.copyLink} onSave={saveTry} onClear={() => setConfirmClear(true)}
            />
          </FittingStage>
        </div>
        <aside className="fitting-browser">
          <SegmentPicker
            label={t("tryOn.de_onde_provar")} value={tab} onChange={setTab}
            options={[
              { id: "stores", label: t("tryOn.aba_lojas") },
              { id: "wardrobe", label: t("tryOn.aba_guarda_roupa", { n: wardrobeCount }) },
              { id: "saved", label: t("tryOn.aba_salvas", { n: savedTries.saved.length }) },
            ]}
          />
          {tab === "stores" && (
            <StoreBrowser
              stores={stores.data?.stores ?? []} loading={stores.loading} store={store} category={category}
              onStoreChange={setStore} onCategoryChange={setCategory} onPick={pickProduct} onResults={onSearchResults}
              resultsTarget={catalogTarget}
            />
          )}
          {tab === "wardrobe" && (
            <WardrobeBrowser
              pieces={data.pieces} needsReview={data.needsReview} items={session.items} slotNames={session.slotNames}
              onRemove={session.remove} onTryOnEntry={(entry) => session.tryOn(fromWardrobe(entry))}
            />
          )}
          {tab === "saved" && <SavedTries saved={savedTries.saved} onRestore={restoreSaved} onDelete={savedTries.remove} />}
        </aside>
        <div
          ref={setCatalogTarget} className="fitting-catalog surface p-4"
          hidden={tab !== "stores"}
        />
        <div className="fitting-items-panel">
          <FittingItems
            items={session.items} products={session.products} colors={taxonomy?.colors}
            owned={session.owned} busyOwn={session.busyOwn} status={status} slotNames={session.slotNames}
            onVariantChange={session.changeVariant} onOwn={session.ownIt} onRemove={session.remove}
            onPickFromStores={(slot) => { setTab("stores"); setCategory(slot); }}
            onPickFromWardrobe={() => setTab("wardrobe")}
          />
        </div>
      </div>
      <AiTryOnDialog open={aiOpen} onClose={() => setAiOpen(false)} items={session.items} onPickFromWardrobe={() => setTab("wardrobe")} />
      <Dialog
        open={confirmClear} onClose={() => setConfirmClear(false)} title={t("tryOn.limpar_o_provador")}
        footer={(
          <>
            <Button onClick={() => setConfirmClear(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" onClick={clear}>{t("common.limpar")}</Button>
          </>
        )}
      >
        <p className="type-body">{t("tryOn.todas_saem_do_provador", { n: session.items.length })}</p>
      </Dialog>
    </>
  );
}

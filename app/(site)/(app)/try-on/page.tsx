
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import { api, mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { CATEGORY_LABEL, label, useTaxonomy } from "@/lib/api/taxonomy";
import { retryImport } from "@/lib/chunk-recovery";
import {
  catalogApi,
  type CatalogProduct,
  type CatalogVariant,
} from "@/lib/api/catalog";
import { RequireAuth } from "@/components/app-shell";
import {
  Badge,
  Button,
  Card,
  Chip,
  Dialog,
  ErrorState,
  PageHeader,
  SegmentPicker,
  Skeleton,
  cn,
  useToast,
} from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { BrandLogo } from "@/components/brand-logo";
import {
  CatalogSearch,
  type CatalogSearchContext,
} from "@/components/catalog/catalog-search";
import { CATEGORY_CARDS } from "@/lib/capture/capture-guides";
import type {
  Avatar3dRef,
  Look3dPiece,
} from "@/components/three/common";
import type { AvatarView } from "@/components/three/avatar-viewer";
import { validateBody } from "@/lib/avatar3d/body-spec";
import {
  FITTING_SLOTS,
  decodeTryOn,
  encodeTryOn,
  removeSlot,
  resolveEnvironment,
  restoreFittingItems,
  slotOf,
  visibleItems,
  wearItem,
  wearOf,
  type EnvironmentMode,
  type FittingItem,
  type FittingSlot,
  type LightMode,
} from "@/lib/tryon/fitting-room";
import {
  resolveScene,
  type SceneProduct,
} from "@/lib/scene3d/scene";

const FittingRoomScene = dynamic(
  () =>
    retryImport(() =>
      import("@/components/three/fitting-room-scene")
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  }
);

/**
 * RF18 - Provador Virtual FashionAI
 *
 * Integração com:
 * - Catálogo RF47
 * - Guarda-roupa
 * - Avatar 3D
 * - Ambientes de marca
 * - Busca catalogada
 * - TipoLook (Masculino / Feminino)
 *
 * O TipoLook é utilizado como preferência de apresentação.
 * Não representa uma restrição de gênero do usuário.
 */

type Sex = "MASCULINO" | "FEMININO" | "UNISEX";

interface Entry {
  piece: PieceView;
  slot: FittingSlot;
  wear: string;
}

interface State {
  mannequin: {
    sex: Sex;
    build: string;
    skinTone?: string | null;
  };
  sex: Sex;
  pieces: Record<FittingSlot, Entry[]>;
  avatar?: Avatar3dRef | null;
  needsReview?: { piece: PieceView }[];
}

interface Store {
  brandId: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  catalogProducts: number;
  categories: string[];
}

interface SavedTry {
  id: string;
  title: string;
  items: FittingItem[];
  createdAt: number;
}

type Tab = "stores" | "wardrobe" | "saved";

const WEAR3D: Record<string, string> = {
  TOP: "upper",
  OUTERWEAR: "outer_layer",
  BOTTOM: "lower",
  FULL_BODY: "dress",
  SHOES: "shoes",
  ACCESSORY: "accessory",
};

const SESSION_KEY = "fai.tryon.fitting";
const SAVED_KEY = "fai.tryon.saved";

const read = <T,>(
  store: "session" | "local",
  key: string,
  fallback: T
): T => {
  try {
    const raw = (
      store === "session" ? sessionStorage : localStorage
    ).getItem(key);

    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (
  store: "session" | "local",
  key: string,
  value: unknown
) => {
  try {
    (
      store === "session" ? sessionStorage : localStorage
    ).setItem(key, JSON.stringify(value));
  } catch {
    // Navegação privada: apenas não persiste.
  }
};

let clock = 0;

const nextTick = () => Math.max(Date.now(), ++clock);

/**
 * Normalização para o banco MySQL:
 * ENUM('masculino', 'feminino')
 */
function toDatabaseTipoLook(
  value: Sex
): "masculino" | "feminino"| "unisex" {
  if value === "FEMININO" return "feminino";
  if value === "MASCULINO" return "masculino";
  if value === "UNISEX" return "unisex";
}

function fromCatalog(
  p: CatalogProduct,
  variant: CatalogVariant | null,
  colors: Record<string, string> | undefined
): FittingItem | null {
  const color = variant?.color ?? p.color ?? null;
  const slot = slotOf(p.category);

  if (!slot) return null;

  return {
    key: `c:${p.id}`,
    source: "catalog",
    slot,
    wear: wearOf(p.category, p.subcategory),
    name: p.productName,
    brand: p.brand
      ? {
          name: p.brand.name,
          slug: p.brand.slug,
          logoUrl: p.brand.logoUrl ?? null,
        }
      : null,
    category: p.category,
    subcategory: p.subcategory,
    imageUrl: p.imageUrl ?? null,
    colorHex:
      (color && colors?.[color]) || p.colorHex || null,
    colorName:
      variant?.colorName ??
      p.colorName ??
      (color ? label(color) : null),
    productId: p.id,
    variantId: variant?.id ?? null,
    officialUrl:
      p.source?.productUrl &&
      p.source.productUrl !== "null"
        ? p.source.productUrl
        : null,
    sourceDomain:
      p.source?.domain && p.source.domain !== "null"
        ? p.source.domain
        : null,
    addedAt: nextTick(),
  };
}

function fromWardrobe(e: Entry): FittingItem {
  const p = e.piece;

  return {
    key: `w:${p.id}`,
    source: "wardrobe",
    slot: e.slot,
    wear:
      (e.wear as FittingItem["wear"]) ??
      wearOf(p.category, p.subcategory),
    name: p.name,
    brand: p.brandName
      ? {
          name: p.brandName,
          logoUrl: p.brandLogoUrl ?? null,
        }
      : null,
    category: p.category,
    subcategory: p.subcategory,
    imageUrl: p.imageUrl ?? p.thumbnailUrl ?? null,
    colorHex: p.colorHex ?? null,
    colorName: p.color ? label(p.color) : null,
    pieceId: p.id,
    addedAt: nextTick(),
    model3dUrl: p.model3dUrl ?? null,
    model3dStatus: p.model3dStatus ?? null,
  };
}

const toSceneProduct = (
  p: CatalogProduct
): SceneProduct => ({
  id: p.id,
  name: p.productName,
  imageUrl: p.imageUrl ?? null,
  category: p.category,
  subcategory: p.subcategory,
  brand: p.brand
    ? {
        name: p.brand.name,
        slug: p.brand.slug,
        logoUrl: p.brand.logoUrl ?? null,
      }
    : null,
});

const toLook3d = (i: FittingItem): Look3dPiece => ({
  id: i.key,
  name: i.name,
  slot: WEAR3D[i.wear] ?? "accessory",
  category: i.category,
  subcategory: i.subcategory ?? undefined,
  imageUrl: i.imageUrl,
  colorHex: i.colorHex,
  model3dUrl: i.model3dUrl,
  model3dStatus: i.model3dStatus,
  defaultImage: !i.imageUrl,
});

function FittingRoom() {
  const { t } = useI18n();
  const toast = useToast();
  const sp = useSearchParams();
  const tax = useTaxonomy();

  const { data, error, reload } = useApi<State>(
    (signal) => api.get("/api/try-on", { signal }),
    []
  );

  const stores = useApi<{ stores: Store[] }>(
    (signal) =>
      api.get("/api/catalog/stores", { signal }),
    []
  );

  const [items, setItems] = useState<FittingItem[]>([]);
  const [products, setProducts] = useState<
    Record<string, CatalogProduct>
  >({});

  const [mode, setMode] =
    useState<EnvironmentMode>("auto");

  const [light, setLight] =
    useState<LightMode>("daylight");

  const [view, setView] =
    useState<AvatarView>("front");

  const [tab, setTab] = useState<Tab>("stores");
  const [category, setCategory] = useState("");

  const [store, setStore] = useState<string>(
    sp.get("marca") ?? ""
  );

  const [saved, setSaved] = useState<SavedTry[]>([]);
  const [owned, setOwned] = useState<
    Record<string, string>
  >({});

  const [busyOwn, setBusyOwn] = useState<
    string | null
  >(null);

  const [confirmClear, setConfirmClear] =
    useState(false);

  const [status, setStatus] = useState("");

  const [search, setSearch] = useState<{
    ctx: CatalogSearchContext;
    results: CatalogProduct[];
  } | null>(null);

  const [heroId, setHeroId] =
    useState<string | null>(null);

  /**
   * NOVO: TipoLook
   *
   * null = utilizar o valor definido pela API.
   * A seleção manual tem prioridade.
   */
  const [tipoLook, setTipoLook] =
    useState<Sex | null>(null);

  const selectedTipoLook: Sex =
    TipoLook ?? data?.sex ?? "MASCULINO";

  const tipoLookDatabase = useMemo(
    () => toDatabaseTipoLook(selectedTipoLook),
    [selectedTipoLook]
  );

  const canvas =
    useRef<HTMLCanvasElement | null>(null);

  const slotName: Record<FittingSlot, string> = {
    upper_piece: t("tryOn.slot_upper"),
    lower_piece: t("tryOn.slot_lower"),
    shoes_piece: t("tryOn.slot_shoes"),
    accessory_piece: t("tryOn.slot_accessory"),
  };

  const commit = useCallback(
    (next: FittingItem[]) => {
      setItems(next);
      write("session", SESSION_KEY, next);
    },
    []
  );

  /**
   * Inicialização:
   * - link compartilhado
   * - sessão anterior
   * - catálogo
   * - guarda-roupa
   */
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current || !data) return;

    booted.current = true;

    setSaved(
      read<SavedTry[]>("local", SAVED_KEY, [])
    );

    const refs = decodeTryOn(sp.get("provar"));

    if (!refs.length) {
      setItems(
        restoreFittingItems(
          read<FittingItem[]>(
            "session",
            SESSION_KEY,
            []
          )
        )
      );
      return;
    }

    const wardrobe = new Map(
      FITTING_SLOTS.flatMap((s) =>
        (data.pieces?.[s] ?? []).map(
          (e) => [e.piece.id, e] as const
        )
      )
    );

    Promise.all(
      refs.map(async (r) => {
        if (r.source === "wardrobe") {
          const e = wardrobe.get(r.id);
          return e ? fromWardrobe(e) : null;
        }

        try {
          const p = await catalogApi.product(r.id);

          setProducts((m) => ({
            ...m,
            [p.id]: p,
          }));

          return fromCatalog(
            p,
            p.variants?.find(
              (v) => v.id === r.variantId
            ) ?? null,
            tax?.colors
          );
        } catch {
          return null;
        }
      })
    ).then((list) => {
      let next: FittingItem[] = [];

      list.forEach((i) => {
        if (i) next = wearItem(next, i);
      });

      commit(next);
    });
  }, [data, sp, tax, commit]);

  /**
   * Carregamento de esquema salvo.
   */
  useEffect(() => {
    const s = sp.get("scheme");

    if (!s || !data) return;

    const wardrobe = new Map(
      FITTING_SLOTS.flatMap((sl) =>
        (data.pieces?.[sl] ?? []).map(
          (e) => [e.piece.id, e] as const
        )
      )
    );

    api
      .get<{
        scheme: {
          items: {
            wardrobeItemId: string;
          }[];
        };
      }>(`/api/schemes/${s}`)
      .then((r) => {
        let next: FittingItem[] = [];

        r.scheme.items.forEach((i) => {
          const e = wardrobe.get(
            i.wardrobeItemId
          );

          if (e) {
            next = wearItem(
              next,
              fromWardrobe(e)
            );
          }
        });

        commit(next);
      })
      .catch(() => undefined);
  }, [sp, data, commit]);

  /**
   * Ambiente e cenário 3D.
   */
  const env = useMemo(
    () => resolveEnvironment(items, mode),
    [items, mode]
  );

  const scene = useMemo(() => {
    if (mode !== "auto" || !search) {
      return null;
    }

    const { ctx, results } = search;

    if (
      !ctx.brand &&
      !ctx.category &&
      !ctx.subcategory
    ) {
      return null;
    }

    const known = ctx.brand
      ? stores.data?.stores.find(
          (s) =>
            s.name.toLowerCase() ===
            ctx.brand.toLowerCase()
        )
      : undefined;

    const hero = heroId
      ? products[heroId]
      : undefined;

    const heroFits =
      !!hero &&
      (!ctx.category ||
        hero.category === ctx.category) &&
      (!ctx.brand ||
        hero.brand?.name.toLowerCase() ===
          ctx.brand.toLowerCase());

    return resolveScene({
      brand: ctx.brand
        ? {
            name: known?.name ?? ctx.brand,
            slug: known?.slug,
            logoUrl:
              known?.logoUrl ?? null,
          }
        : null,
      category: ctx.category || null,
      subcategory: ctx.subcategory || null,
      product: heroFits
        ? toSceneProduct(hero!)
        : null,
      results: results.map(toSceneProduct),
      worn: items,
    });
  }, [
    mode,
    search,
    stores.data,
    heroId,
    products,
    items,
  ]);

  const onSearchResults = useCallback(
    (
      ctx: CatalogSearchContext,
      results: CatalogProduct[]
    ) => {
      setSearch({ ctx, results });
    },
    []
  );

  const shown = useMemo(
    () => visibleItems(items),
    [items]
  );

  const brandsWorn = env.brands;

  /**
   * NOVO: Alteração do TipoLook.
   */
  function changeTipoLook(next: Sex) {
    if (next === selectedTipoLook) return;

    setTipoLook(next);

    setStatus(
      `Tipo de Look selecionado: ${
        next === "MASCULINO"
          ? "Masculino"
          : "Feminino"
      }`
    );
  }

  function tryOn(item: FittingItem) {
    commit(wearItem(items, item));

    setStatus(
      t("tryOn.provando_status", {
        name: item.name,
        slot: slotName[item.slot],
        marca: item.brand?.name ?? "",
      })
    );
  }

  function pickProduct(
    p: CatalogProduct,
    v: CatalogVariant | null
  ) {
    setProducts((m) => ({
      ...m,
      [p.id]: p,
    }));

    setHeroId(p.id);

    const item = fromCatalog(
      p,
      v ?? p.selectedVariant ?? null,
      tax?.colors
    );

    if (item) {
      tryOn(item);
    } else {
      toast.info(
        t("tryOn.category_review")
      );
    }
  }

  function remove(slot: FittingSlot) {
    commit(removeSlot(items, slot));

    setStatus(
      t("tryOn.lugar_vazio_status", {
        slot: slotName[slot],
      })
    );
  }

  function changeVariant(
    item: FittingItem,
    v: CatalogVariant
  ) {
    const p = products[item.productId!];

    if (!p) return;

    const next = fromCatalog(
      p,
      v,
      tax?.colors
    );

    if (!next) return;

    commit(
      items.map((i) =>
        i.key === item.key
          ? {
              ...next,
              addedAt: i.addedAt,
            }
          : i
      )
    );
  }

  async function ownIt(item: FittingItem) {
    if (!item.productId || busyOwn) return;

    setBusyOwn(item.key);

    try {
      const piece = await api.post<PieceView>(
        "/api/pieces/from-catalog",
        {
          productId: item.productId,
          variantId:
            item.variantId ?? null,
          visibility: "PRIVATE",
        }
      );

      setOwned((o) => ({
        ...o,
        [item.key]: piece.id,
      }));

      toast.success(
        t(
          "tryOn.adicionada_ao_guarda_roupa",
          { name: item.name }
        )
      );

      reload();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusyOwn(null);
    }
  }

  function snapshot() {
    const c = canvas.current;

    if (!c) return;

    try {
      const a = document.createElement("a");

      a.href = c.toDataURL("image/png");

      a.download =
        `provador-${env.featured.key}.png`;

      a.click();

      toast.success(
        t("tryOn.foto_salva")
      );
    } catch {
      toast.info(
        t("tryOn.foto_indisponivel")
      );
    }
  }

  async function copyLink() {
    const url =
      `${window.location.origin}/try-on?provar=` +
      encodeURIComponent(
        encodeTryOn(items)
      );

    try {
      await navigator.clipboard.writeText(
        url
      );

      toast.success(
        t("tryOn.link_copiado")
      );
    } catch {
      toast.info(url);
    }
  }

  function saveTry() {
    if (!items.length) return;

    const title = brandsWorn.length
      ? brandsWorn
          .map((b) => b.name)
          .join(" + ")
      : t("tryOn.prova_sem_marca");

    const next = [
      {
        id: `${Date.now()}`,
        title,
        items,
        createdAt: Date.now(),
      },
      ...saved,
    ].slice(0, 8);

    setSaved(next);

    write(
      "local",
      SAVED_KEY,
      next
    );

    toast.success(
      t("tryOn.prova_salva")
    );

    setTab("saved");
  }

  function deleteSaved(id: string) {
    const next = saved.filter(
      (s) => s.id !== id
    );

    setSaved(next);

    write(
      "local",
      SAVED_KEY,
      next
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={reload}
      />
    );
  }

  if (!data) {
    return (
      <Skeleton className="h-96" />
    );
  }

  const avatar = data.avatar ?? null;

  const bodyParams = avatar
    ? validateBody(
        avatar.model?.body
      )?.params ?? null
    : null;

  const pinnedKey =
    typeof mode === "object"
      ? mode.pinned
      : null;

  const storeList =
    stores.data?.stores ?? [];

  const wardrobeCount =
    FITTING_SLOTS.reduce(
      (n, s) =>
        n +
        (data.pieces?.[s]?.length ?? 0),
      0
    );

  const envCaption =
    env.kind === "neutral"
      ? t(
          "tryOn.ambiente_neutro_legenda"
        )
      : env.others.length
        ? t(
            "tryOn.ambiente_multimarca_legenda",
            {
              marca: env.featured.name,
              outras: env.others
                .map((o) => o.name)
                .join(", "),
            }
          )
        : t(
            "tryOn.ambiente_marca_legenda",
            {
              marca: env.featured.name,
            }
          );

  return (
    <>
      <PageHeader
        title={t("tryOn.titulo_lojas")}
        kicker="RF18"
        lead={t("tryOn.lead_lojas")}
        actions={
          <Link
            href="/mirror"
            className="btn btn-sm btn-ghost"
          >
            {t(
              "tryOn.ir_ao_espelho"
            )}
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="grid content-start gap-3">
          <Card pad={false}>
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3">
              <Badge
                tone={
                  avatar
                    ? "thread"
                    : "chalk"
                }
              >
                {avatar
                  ? t(
                      "tryOn.seu_avatar_badge"
                    )
                  : t(
                      "tryOn.referencia_badge"
                    )}
              </Badge>

              <Badge tone="chalk">
                {t(
                  "tryOn.previa_projetada_badge"
                )}
              </Badge>

              <span
                className="ml-auto flex items-center gap-1.5 type-caption text-muted"
                aria-live="polite"
              >
                {env.kind !==
                  "neutral" && (
                  <BrandLogo
                    name={
                      env.featured.name
                    }
                    src={
                      env.featured.logoUrl
                    }
                    size={20}
                  />
                )}

                {envCaption}
              </span>
            </div>

            <div
              className="fitting-stage"
              role="region"
              aria-label={t(
                "tryOn.palco_lojas_aria",
                {
                  n: shown.length,
                  marca:
                    env.featured.name,
                }
              )}
              style={{
                [
                  "--fitting-accent" as string
                ]: env.featured.accent,
              }}
            >
              {avatar ? (
                <FittingRoomScene
                  avatar={avatar}
                  sex={
                    selectedTipoLook
                  }
                  build={
                    data.mannequin.build
                  }
                  skinTone={null}
                  body={bodyParams}
                  pieces={shown.map(
                    toLook3d
                  )}
                  environment={env}
                  scene={scene}
                  light={light}
                  view={view}
                  onCanvas={(c) => {
                    canvas.current = c;
                  }}
                />
              ) : (
                <div
                  className="grid h-full content-center justify-items-center gap-3 p-6 text-center"
                  role="status"
                >
                  <p>
                    {t(
                      "tryOn.avatar_required"
                    )}
                  </p>

                  <Link
                    href="/avatar"
                    className="btn btn-sm"
                  >
                    {t(
                      "mirror.criar_avatar"
                    )}
                  </Link>
                </div>
              )}
            </div>

            <div className="grid gap-2 p-3">
   
              <div className="flex flex-wrap items-center gap-2">
                <SegmentPicker
                  label="Tipo de Look"
                  value={
                    selectedTipoLook
                  }
                  onChange={(value) =>
                    changeTipoLook(
                      value as Sex
                    )
                  }
                  options={[
                    {
                      id: "MASCULINO",
                      label:
                        "Masculino",
                    },
                    {
                      id: "FEMININO",
                      label:
                        "Feminino",
                    },
                    {
                      id: "UNISEX",
                      label:
                        "Unisex",
                    }
                  ]}
                />

                <span
                  className="type-caption text-muted"
                  role="status"
                  aria-live="polite"
                  data-tipo-look={
                    tipoLookDatabase
                  }
                >
                  {selectedTipoLook ===
                  "MASCULINO"
                    ? "Look masculino"
                    : "Look feminino"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SegmentPicker
                  label={t(
                    "tryOn.vista"
                  )}
                  value={view}
                  onChange={setView}
                  options={[
                    {
                      id: "front",
                      label: t(
                        "tryOn.vista_frente"
                      ),
                    },
                    {
                      id: "right34",
                      label: t(
                        "tryOn.vista_tres_quartos"
                      ),
                    },
                    {
                      id: "profile",
                      label: t(
                        "tryOn.vista_perfil"
                      ),
                    },
                    {
                      id: "back",
                      label: t(
                        "tryOn.vista_costas"
                      ),
                    },
                  ]}
                />

                <SegmentPicker
                  label={t(
                    "tryOn.luz"
                  )}
                  value={light}
                  onChange={setLight}
                  options={[
                    {
                      id: "store",
                      label: t(
                        "tryOn.luz_loja"
                      ),
                    },
                    {
                      id: "daylight",
                      label: t(
                        "tryOn.luz_dia"
                      ),
                    },
                    {
                      id: "night",
                      label: t(
                        "tryOn.luz_noite"
                      ),
                    },
                  ]}
                />
              </div>

              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label={t(
                  "tryOn.ambiente"
                )}
              >
                <span className="type-caption text-muted">
                  {t(
                    "tryOn.ambiente"
                  )}
                  :
                </span>

                <Chip
                  active={
                    mode === "auto"
                  }
                  onClick={() =>
                    setMode("auto")
                  }
                >
                  {t(
                    "tryOn.ambiente_auto"
                  )}
                </Chip>

                {brandsWorn.map(
                  (b) => (
                    <Chip
                      key={b.key}
                      active={
                        pinnedKey ===
                        b.key
                      }
                      onClick={() =>
                        setMode(
                          pinnedKey ===
                            b.key
                            ? "auto"
                            : {
                                pinned:
                                  b.key,
                              }
                        )
                      }
                      title={t(
                        "tryOn.fixar_marca",
                        {
                          marca:
                            b.name,
                        }
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background:
                            b.accent,
                        }}
                        aria-hidden
                      />
                      {b.name}
                    </Chip>
                  )
                )}

                <Chip
                  active={
                    mode ===
                    "neutral"
                  }
                  onClick={() =>
                    setMode(
                      "neutral"
                    )
                  }
                >
                  {t(
                    "tryOn.ambiente_neutro"
                  )}
                </Chip>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={snapshot}
                >
                  <FaiIcon
                    id="ACT-07"
                    size={20}
                    decorative
                  />
                  {t(
                    "tryOn.tirar_foto"
                  )}
                </Button>

                <Button
                  size="sm"
                  onClick={
                    copyLink
                  }
                  disabled={
                    !items.length
                  }
                >
                  {t(
                    "tryOn.copiar_link"
                  )}
                </Button>

                <Button
                  size="sm"
                  onClick={
                    saveTry
                  }
                  disabled={
                    !items.length
                  }
                >
                  {t(
                    "tryOn.salvar_prova"
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={
                    !items.length
                  }
                  onClick={() =>
                    setConfirmClear(
                      true
                    )
                  }
                >
                  <FaiIcon
                    id="ACT-24"
                    size={20}
                    decorative
                  />
                  {t(
                    "common.limpar"
                  )}
                </Button>
              </div>

              <p className="type-caption text-muted">
                {t(
                  "tryOn.girar_dica"
                )}
              </p>

              <p
                className="type-caption text-muted"
                role="note"
              >
                {t(
                  "tryOn.previa_lojas_nota"
                )}
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="type-h3 mb-2">
              {t(
                "tryOn.provando_agora"
              )}
            </h2>

            <ul className="fitting-slots">
              {FITTING_SLOTS.map(
                (s) => {
                  const i =
                    items.find(
                      (x) =>
                        x.slot === s
                    );

                  const covered =
                    s ===
                      "lower_piece" &&
                    !!i &&
                    items.some(
                      (x) =>
                        x.wear ===
                        "FULL_BODY"
                    );

                  const p =
                    i?.productId
                      ? products[
                          i.productId
                        ]
                      : undefined;

                  return (
                    <li
                      key={s}
                      className={cn(
                        "fitting-slot",
                        i &&
                          "is-filled"
                      )}
                    >
                      <span className="tryon-slot-name">
                        {
                          slotName[
                            s
                          ]
                        }
                      </span>

                      {i ? (
                        <div className="fitting-slot-body">
                          <span
                            className="fitting-slot-thumb"
                            style={{
                              background:
                                i.colorHex ??
                                "var(--surface-2)",
                            }}
                          >
                            {i.imageUrl ? (
                              <img
                                src={
                                  mediaUrl(
                                    i.imageUrl
                                  ) ??
                                  undefined
                                }
                                alt=""
                              />
                            ) : null}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 type-caption text-muted">
                              {i.brand && (
                                <BrandLogo
                                  name={
                                    i.brand
                                      .name
                                  }
                                  src={
                                    i.brand
                                      .logoUrl
                                  }
                                  size={
                                    16
                                  }
                                />
                              )}

                              {i.brand
                                ?.name ??
                                t(
                                  "tryOn.sem_marca"
                                )}

                              <Badge
                                tone={
                                  i.source ===
                                  "catalog"
                                    ? "thread"
                                    : "chalk"
                                }
                              >
                                {i.source ===
                                "catalog"
                                  ? t(
                                      "tryOn.origem_loja"
                                    )
                                  : t(
                                      "tryOn.origem_guarda_roupa"
                                    )}
                              </Badge>
                            </p>

                            <p className="truncate type-body-sm font-medium">
                              {
                                i.name
                              }
                              {i.colorName
                                ? ` · ${i.colorName}`
                                : ""}
                            </p>

                            <p className="type-caption text-muted">
                              {t(
                                i.model3dUrl
                                  ? "tryOn.model_requires_fitting"
                                  : "tryOn.model_missing"
                              )}
                            </p>

                            {i.pieceId && (
                              <Link
                                href={`/pieces/${i.pieceId}`}
                                className="type-caption underline"
                              >
                                {t(
                                  "tryOn.review_piece"
                                )}
                              </Link>
                            )}

                            {covered && (
                              <p className="type-caption text-muted">
                                {t(
                                  "tryOn.coberta_pela_peca_inteira",
                                  {
                                    name:
                                      items.find(
                                        (
                                          x
                                        ) =>
                                          x.wear ===
                                          "FULL_BODY"
                                      )!
                                        .name,
                                  }
                                )}
                              </p>
                            )}

                            {p &&
                              (p
                                .variants
                                ?.length ??
                                0) >
                                1 && (
                                <div
                                  className="mt-1 flex flex-wrap gap-1"
                                  role="group"
                                  aria-label={t(
                                    "tryOn.trocar_cor"
                                  )}
                                >
                                  {p.variants!.map(
                                    (
                                      v
                                    ) => (
                                      <button
                                        key={
                                          v.id
                                        }
                                        type="button"
                                        className={cn(
                                          "catalog-swatch",
                                          i.variantId ===
                                            v.id &&
                                            "is-active"
                                        )}
                                        title={
                                          v.colorName ??
                                          v.key
                                        }
                                        aria-label={
                                          v.colorName ??
                                          v.key
                                        }
                                        aria-pressed={
                                          i.variantId ===
                                          v.id
                                        }
                                        onClick={() =>
                                          changeVariant(
                                            i,
                                            v
                                          )
                                        }
                                        style={{
                                          background:
                                            tax
                                              ?.colors?.[
                                              v.color ??
                                                ""
                                            ] ??
                                            "var(--surface-3)",
                                        }}
                                      />
                                    )
                                  )}
                                </div>
                              )}

                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 type-caption">
                              {i.officialUrl && (
                                <a
                                  href={
                                    i.officialUrl
                                  }
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="underline"
                                >
                                  {t(
                                    "tryOn.ver_na_loja",
                                    {
                                      loja:
                                        i.sourceDomain ??
                                        i.brand
                                          ?.name ??
                                        "",
                                    }
                                  )}
                                </a>
                              )}

                              {i.source ===
                                "catalog" &&
                                (owned[
                                  i.key
                                ] ? (
                                  <Link
                                    href={`/pieces/${owned[i.key]}`}
                                    className="underline"
                                  >
                                    {t(
                                      "tryOn.ja_no_guarda_roupa"
                                    )}
                                  </Link>
                                ) : (
                                  <button
                                    type="button"
                                    className="underline"
                                    disabled={
                                      busyOwn ===
                                      i.key
                                    }
                                    onClick={() =>
                                      ownIt(
                                        i
                                      )
                                    }
                                  >
                                    {busyOwn ===
                                    i.key
                                      ? t(
                                          "tryOn.salvando"
                                        )
                                      : t(
                                          "tryOn.ja_tenho"
                                        )}
                                  </button>
                                ))}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={t(
                              "tryOn.remover_de",
                              {
                                name:
                                  i.name,
                                slot:
                                  slotName[
                                    s
                                  ],
                              }
                            )}
                            onClick={() =>
                              remove(
                                s
                              )
                            }
                          >
                            {t(
                              "tryOn.remover"
                            )}
                          </Button>
                        </div>
                      ) : (
                        <p className="type-caption text-faint">
                          {t(
                            "tryOn.slot_vazio_lojas"
                          )}
                        </p>
                      )}
                    </li>
                  );
                }
              )}
            </ul>

            <p
              className="sr-only"
              role="status"
              aria-live="polite"
            >
              {status}
            </p>
          </Card>
        </div>

        <div className="grid content-start gap-3">
          <SegmentPicker
            label={t(
              "tryOn.de_onde_provar"
            )}
            value={tab}
            onChange={setTab}
            options={[
              {
                id: "stores",
                label: t(
                  "tryOn.aba_lojas"
                ),
              },
              {
                id: "wardrobe",
                label: t(
                  "tryOn.aba_guarda_roupa",
                  {
                    n: wardrobeCount,
                  }
                ),
              },
              {
                id: "saved",
                label: t(
                  "tryOn.aba_salvas",
                  {
                    n: saved.length,
                  }
                ),
              },
            ]}
          />

          {tab ===
            "stores" && (
            <Card>
              <p className="label">
                {t(
                  "tryOn.lojas_em_destaque"
                )}
              </p>

              {stores.loading ? (
                <Skeleton className="h-16" />
              ) : storeList.length ? (
                <div
                  className="fitting-stores"
                  role="group"
                  aria-label={t(
                    "tryOn.lojas_em_destaque"
                  )}
                >
                  {storeList.map(
                    (s) => (
                      <button
                        key={
                          s.brandId
                        }
                        type="button"
                        className={cn(
                          "fitting-store",
                          store ===
                            s.name &&
                            "is-active"
                        )}
                        aria-pressed={
                          store ===
                          s.name
                        }
                        onClick={() =>
                          setStore(
                            store ===
                              s.name
                              ? ""
                              : s.name
                          )
                        }
                      >
                        <BrandLogo
                          name={
                            s.name
                          }
                          src={
                            s.logoUrl
                          }
                          size={32}
                          shape="square"
                        />

                        <span className="fitting-store-name">
                          {
                            s.name
                          }
                        </span>

                        <span className="type-caption text-muted">
                          {t(
                            "tryOn.n_produtos",
                            {
                              n:
                                s.catalogProducts,
                            }
                          )}
                        </span>
                      </button>
                    )
                  )}
                </div>
              ) : (
                <p className="type-caption text-muted">
                  {t(
                    "tryOn.sem_lojas"
                  )}
                </p>
              )}

              <p className="label mt-3">
                {t(
                  "tryOn.o_que_provar"
                )}
              </p>

              <div
                className="mb-3 flex flex-wrap gap-1.5"
                role="group"
                aria-label={t(
                  "tryOn.o_que_provar"
                )}
              >
                <Chip
                  active={
                    !category
                  }
                  onClick={() =>
                    setCategory(
                      ""
                    )
                  }
                >
                  {t(
                    "tryOn.tudo"
                  )}
                </Chip>

                {CATEGORY_CARDS.map(
                  (c) => (
                    <Chip
                      key={
                        c.id
                      }
                      active={
                        category ===
                        c.id
                      }
                      onClick={() =>
                        setCategory(
                          category ===
                            c.id
                            ? ""
                            : c.id
                        )
                      }
                    >
                      {CATEGORY_LABEL[
                        c.id
                      ] ??
                        label(
                          c.id
                        )}
                    </Chip>
                  )
                )}
              </div>

              <CatalogSearch
                key={store}
                initial={{
                  brand: store,
                }}
                category={
                  category
                }
                browse
                onPick={
                  pickProduct
                }
                onResults={
                  onSearchResults
                }
                pickLabel={t(
                  "tryOn.provar_peca"
                )}
                noResultHint={t(
                  "tryOn.sem_resultado_dica"
                )}
              />
            </Card>
          )}

          {tab ===
            "wardrobe" && (
            <Card>
              <p className="mb-3 type-caption text-muted">
                {t(
                  "tryOn.combinar_guarda_roupa_dica"
                )}
              </p>

              {!!data
                .needsReview
                ?.length && (
                <div
                  role="status"
                  className="mb-3"
                >
                  <p>
                    {t(
                      "tryOn.category_review"
                    )}
                  </p>

                  {data.needsReview.map(
                    ({
                      piece,
                    }) => (
                      <Link
                        key={
                          piece.id
                        }
                        href={`/pieces/${piece.id}`}
                        className="block underline"
                      >
                        {
                          piece.name
                        }
                      </Link>
                    )
                  )}
                </div>
              )}

              {wardrobeCount ===
              0 ? (
                <p className="type-body-sm">
                  {t(
                    "tryOn.guarda_roupa_vazio"
                  )}{" "}
                  <Link
                    href="/pieces/new"
                    className="underline"
                  >
                    {t(
                      "common.cadastrar_peca"
                    )}
                  </Link>
                </p>
              ) : (
                FITTING_SLOTS.map(
                  (s) => {
                    const list =
                      data
                        .pieces?.[
                        s
                      ] ?? [];

                    if (
                      !list.length
                    ) {
                      return null;
                    }

                    return (
                      <section
                        key={
                          s
                        }
                        className="mb-3"
                        aria-label={t(
                          "tryOn.guarda_roupa_lugar",
                          {
                            slot:
                              slotName[
                                s
                              ],
                          }
                        )}
                      >
                        <h3 className="type-body-sm font-medium mb-1.5">
                          {
                            slotName[
                              s
                            ]
                          }{" "}
                          <span className="type-caption text-muted">
                            ·{" "}
                            {
                              list.length
                            }
                          </span>
                        </h3>

                        <div className="flex flex-wrap gap-2">
                          {list.map(
                            (
                              e
                            ) => {
                              const on =
                                items.some(
                                  (
                                    i
                                  ) =>
                                    i.key ===
                                    `w:${e.piece.id}`
                                );

                              return (
                                <button
                                  key={
                                    e.piece
                                      .id
                                  }
                                  type="button"
                                  aria-pressed={
                                    on
                                  }
                                  onClick={() =>
                                    on
                                      ? remove(
                                          s
                                        )
                                      : tryOn(
                                          fromWardrobe(
                                            e
                                          )
                                        )
                                  }
                                  className={cn(
                                    "tryon-rack-item",
                                    on &&
                                      "is-worn"
                                  )}
                                >
                                  <img
                                    src={
                                      mediaUrl(
                                        e
                                          .piece
                                          .thumbnailUrl ??
                                          e
                                            .piece
                                            .imageUrl
                                      ) ??
                                      undefined
                                    }
                                    alt=""
                                    className="aspect-square w-full object-contain"
                                    draggable={
                                      false
                                    }
                                  />

                                  <span className="block truncate type-caption">
                                    {
                                      e.piece
                                        .name
                                    }
                                  </span>

                                  {on && (
                                    <span className="tryon-worn-flag">
                                      {t(
                                        "tryOn.vestida"
                                      )}
                                    </span>
                                  )}
                                </button>
                              );
                            }
                          )}
                        </div>
                      </section>
                    );
                  }
                )
              )}
            </Card>
          )}

          {tab ===
            "saved" && (
            <Card>
              {!saved.length ? (
                <p className="type-body-sm text-muted">
                  {t(
                    "tryOn.nenhuma_prova_salva"
                  )}
                </p>
              ) : (
                <ul className="grid gap-2">
                  {saved.map(
                    (s) => (
                      <li
                        key={
                          s.id
                        }
                        className="fitting-saved"
                      >
                        <div className="flex -space-x-2">
                          {s.items
                            .slice(
                              0,
                              4
                            )
                            .map(
                              (
                                i
                              ) => (
                                <span
                                  key={
                                    i.key
                                  }
                                  className="fitting-slot-thumb is-small"
                                  style={{
                                    background:
                                      i.colorHex ??
                                      "var(--surface-2)",
                                  }}
                                >
                                  {i.imageUrl ? (
                                    <img
                                      src={
                                        mediaUrl(
                                          i.imageUrl
                                        ) ??
                                        undefined
                                      }
                                      alt=""
                                    />
                                  ) : null}
                                </span>
                              )
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate type-body-sm font-medium">
                            {
                              s.title
                            }
                          </p>

                          <p className="type-caption text-muted">
                            {t(
                              "tryOn.n_pecas",
                              {
                                n:
                                  s.items
                                    .length,
                              }
                            )}{" "}
                            ·{" "}
                            {new Date(
                              s.createdAt
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => {
                            commit(
                              s.items.map(
                                (
                                  i
                                ) => ({
                                  ...i,
                                  addedAt:
                                    nextTick(),
                                })
                              )
                            );

                            setStatus(
                              t(
                                "tryOn.prova_vestida",
                                {
                                  title:
                                    s.title,
                                }
                              )
                            );
                          }}
                        >
                          {t(
                            "tryOn.vestir_de_novo"
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t(
                            "tryOn.apagar_prova",
                            {
                              title:
                                s.title,
                            }
                          )}
                          onClick={() =>
                            deleteSaved(
                              s.id
                            )
                          }
                        >
                          {t(
                            "tryOn.remover"
                          )}
                        </Button>
                      </li>
                    )
                  )}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>

      <Dialog
        open={
          confirmClear
        }
        onClose={() =>
          setConfirmClear(
            false
          )
        }
        title={t(
          "tryOn.limpar_o_provador"
        )}
        footer={
          <>
            <Button
              onClick={() =>
                setConfirmClear(
                  false
                )
              }
            >
              {t(
                "common.cancel"
              )}
            </Button>

            <Button
              variant="primary"
              onClick={() => {
                commit([]);

                setConfirmClear(
                  false
                );

                toast.info(
                  t(
                    "tryOn.provador_limpo"
                  )
                );
              }}
            >
              {t(
                "common.limpar"
              )}
            </Button>
          </>
        }
      >
        <p className="type-body">
          {t(
            "tryOn.todas_saem_do_provador",
            {
              n: items.length,
            }
          )}
        </p>
      </Dialog>
    </>
  );
}

export default function TryOnPage() {
  return (
    <RequireAuth>
      <Suspense>
        <FittingRoom />
      </Suspense>
    </RequireAuth>
  );
}

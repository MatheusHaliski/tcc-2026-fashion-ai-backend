"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
import { CATEGORY_LABEL, label, useTaxonomy, subcategoryLabel } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, Card, Chip, PageHeader, SegmentPicker, Switch, useToast } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";
import { FlairGameCard, type FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { FlairPreview } from "@/components/flair/flair-collection";
import { EMPTY_PIECE, PIECE_FIELD_STEP, PieceFields, PieceMoreDetails, isNoBrand, toPayload, validatePieceForm, type PieceFormValue } from "@/components/piece-form";
import { PieceCard } from "@/components/piece-card";
import { CreationSuccess } from "@/components/expanded-card";
import { PieceArtEditor } from "@/components/piece-art-editor";
import { FaiIcon } from "@/components/fai-icon";
import { keepAllowed } from "@/lib/pieces/tags";
import { CatalogSearch, type CatalogSearchContext } from "@/components/catalog/catalog-search";
import { MultiPieceUpload } from "@/components/multi-piece-review";
import { CATEGORY_CARDS } from "@/lib/capture/capture-guides";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import { readPiecePrefill, validPieceCategory, validPiecePrefill, type PiecePrefillParams } from "@/lib/pieces/prefill";

/** Etapas do criador de peça (RF4/RF47): peça (busca catalogada + dados) → mais detalhes → arte de fundo → revisar e salvar. */
type Step = "piece" | "more" | "art" | "review";
const STEPS: Step[] = ["piece", "more", "art", "review"];
const GENERIC_ASSET = "/_derived/pecas_default/generic.svg";
/** Produto do catálogo escolhido na busca (RF47): a peça é criada por referência a ele. */
interface CatalogPick { product: CatalogProduct; variant: CatalogVariant | null }

/** Tipos oferecidos pelos chips do criador: o ?category= da URL só vale se for um deles. */
const CATEGORY_IDS = CATEGORY_CARDS.map((c) => c.id as string);

/**
 * ?category=, ?brand= e ?q= pré-preenchem a etapa Peça (atalhos do Explorador e das marcas). O FashionAI Lens manda também
 * ?subcategory=, ?color=, ?material=, ?styles= e ?from=lens (lib/pieces/prefill.ts): tudo validado na taxonomia — valor
 * desconhecido é ignorado.
 */
function NewPiece() {
  const params = useSearchParams();
  const prefill = readPiecePrefill(params);
  return <PieceCreator initial={{ category: validPieceCategory(prefill.category, CATEGORY_IDS) || undefined, brand: prefill.brand, query: prefill.query }} prefill={prefill} />;
}

/**
 * RF4 + RF47 · Criador de peça numa etapa só para "o que é a peça": a busca catalogada (categoria → tipo → marca → nome,
 * com a foto oficial do produto) e o formulário de dados, na mesma tela, com a prévia do card ao lado. O produto escolhido
 * preenche o formulário e a peça é criada por referência (POST /api/pieces/from-catalog); sem produto, a peça é salva com os
 * dados do formulário e a ilustração da categoria (POST /api/pieces).
 */
function PieceCreator({ initial, prefill = {} }: { initial: Partial<CatalogSearchContext>; prefill?: PiecePrefillParams }) {
  const { t } = useI18n(); const toast = useToast(); const tax = useTaxonomy(); const { user } = useAuth();
  const [step, setStep] = useState<Step>("piece");
  const [pick, setPick] = useState<CatalogPick | null>(null);
  // pré-preenchimento (Lens): validado na taxonomia já na primeira renderização quando ela está em cache; senão, o efeito
  // abaixo completa assim que ela chega
  const [pre] = useState(() => validPiecePrefill(prefill, tax, CATEGORY_IDS));
  const [value, setValue] = useState<PieceFormValue>(() => ({ ...EMPTY_PIECE, useDefaultImage: true, category: initial.category ?? "", subcategory: pre.subcategory || (initial.subcategory ?? ""), brandName: initial.brand ?? "",
    name: pre.name, color: pre.color, material: pre.material, style: pre.style }));
  // subtipo inicial da busca catalogada (ela lê o `initial` só ao montar: com o subtipo chegando depois, remonta uma vez);
  // só vale enquanto o formulário continua nele (ao voltar de um produto do catálogo de outro tipo, a busca abre sem subtipo)
  const [catalogSub, setCatalogSub] = useState(pre.subcategory);
  const lateApplied = useRef(!!tax);
  useEffect(() => {
    if (lateApplied.current || !tax) return;
    lateApplied.current = true;
    const late = validPiecePrefill(prefill, tax, CATEGORY_IDS);
    // só completa o que ainda está vazio (e o subtipo só se o tipo continua o mesmo): nada do que a pessoa já mexeu muda
    setValue((v) => ({ ...v, subcategory: v.subcategory || (v.category === late.category ? late.subcategory : ""), color: v.color || late.color,
      material: v.material || late.material, style: v.style.length ? v.style : late.style }));
    if (late.subcategory) setCatalogSub(late.subcategory);
  }, [tax]); // eslint-disable-line react-hooks/exhaustive-deps
  // arte do card (RF11 v2 + campos do Background Studio): um só config, o mesmo que o detalhe grava depois
  const [background, setBackground] = useState<Record<string, unknown>>({ skin: "atelier" });
  const [done, setDone] = useState<string | null>(null);
  // Salvar: UMA tentativa por ação. A trava é síncrona (ref), então um segundo clique antes de a tela re-renderizar não
  // envia outro pedido.
  const saving = useRef(false); const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveProblem, setSaveProblem] = useState<string | null>(null);
  // Depois de salvar (pedidos de 07/10): "Compartilhar no feed" vem LIGADO — o post é o próprio card, sem descrição;
  // desligado, nada vai ao feed e a peça fica só no perfil. "Converter para FLAIR" (desligado) cria a cópia em Minhas
  // cartas FLAIR e não publica nada.
  const [shareToFeed, setShareToFeed] = useState(true);
  const [toFlair, setToFlair] = useState(false);
  const flairDraft = JSON.stringify({ category: value.category, subcategory: value.subcategory || null, price: value.price === "" ? null : Number(value.price),
    brandName: value.brandName && !isNoBrand(value.brandName) ? value.brandName : null, brandId: value.brandId || null, catalogProductId: pick?.product.id ?? null,
    styles: value.style, occasions: value.occasion, color: value.color || null, material: value.material || null });
  const flairPreview = useApi<FlairPreview>((signal) => api.post<FlairPreview>("/api/flair/cards/preview", JSON.parse(flairDraft), { signal }), [flairDraft],
    { enabled: toFlair && step === "review" && !!value.category });

  /** Tipo da peça (primeira escolha da etapa Peça): ocasiões fora do permitido para o tipo saem. */
  function chooseCategory(category: string) {
    if (category === value.category) return;
    setValue((v) => ({ ...v, category, subcategory: "", occasion: keepAllowed(v.occasion, tax?.allowedOccasionsByCategory?.[category] ?? tax?.occasions) }));
  }
  /** "É esta" na busca: o produto preenche o formulário e a peça passa a referenciar o catálogo (a foto oficial vira a imagem). */
  function applyCatalog(product: CatalogProduct, variant: CatalogVariant | null) {
    setPick({ product, variant });
    const color = variant?.color ?? product.color ?? "";
    const allowedOccasions = tax?.allowedOccasionsByCategory?.[product.category] ?? tax?.occasions;
    // o produto traz o que é global (nome, tipo, cor, material, marca); o que é da pessoa fica como estava ou com um padrão válido
    setValue((v) => {
      const occasion = keepAllowed(v.occasion, allowedOccasions);
      return { ...v, name: product.productName, category: product.category, subcategory: product.subcategory ?? "", color: color || v.color || "black",
        material: product.material ?? (v.material || "BLEND"), sex: product.gender && tax?.sexes?.includes(product.gender) ? product.gender : v.sex, sku: variant?.sku ?? variant?.code ?? product.sku ?? v.sku,
        brandId: product.brand?.id ?? null, brandName: product.brand?.name ?? v.brandName, brandLogoUrl: product.brand?.logoUrl ?? null, brandSource: "CATALOGO", brandRef: product.id,
        occasion: occasion.length ? occasion : [allowedOccasions?.[0] ?? "casual"], style: v.style.length ? v.style : ["basic"], price: v.price || "0", size: v.size || "m" };
    });
    setFieldErrors({}); setSaveProblem(null);
    if (typeof window !== "undefined") document.getElementById("piece-form-fields")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  /** Tira a referência ao produto: os campos preenchidos ficam, a imagem volta à ilustração da categoria. */
  function clearCatalog() { setPick(null); setValue((v) => ({ ...v, brandSource: v.brandSource === "CATALOGO" ? null : v.brandSource, brandRef: null })); }
  /** Leva a pessoa à etapa do primeiro campo com problema e mostra o erro junto do campo. */
  function showFieldErrors(errors: Record<string, string>) {
    setFieldErrors(errors);
    const first = Object.keys(errors)[0];
    if (first) go(PIECE_FIELD_STEP[first] === "more" ? "more" : "piece");
  }
  async function submit() {
    if (saving.current || done) return;                                         // já salvando ou já salvo: nada de novo pedido
    setSaveProblem(null);
    const local = validatePieceForm(value, tax);
    if (Object.keys(local).length) { showFieldErrors(local); return; }          // validação: nem chega a enviar
    saving.current = true; setBusy(true);
    try {
      const payload = toPayload({ ...value, useDefaultImage: true, background });
      // produto do catálogo: criação por referência (RF47); sem produto, a peça leva os dados do formulário (RF4)
      const p = pick
        ? await api.post<PieceView>("/api/pieces/from-catalog", { productId: pick.product.id, variantId: pick.variant?.id ?? null, size: value.size || null, condition: value.condition || null,
            price: payload.price, purchaseDate: payload.purchaseDate, purchaseLocation: value.purchaseLocation || null, favorite: false, forSale: value.forSale, notes: value.notes || null,
            visibility: value.visibility, occasion: value.occasion, style: value.style, color: value.color || null, material: value.material || null, sex: value.sex || null, name: value.name || null, background })
        : await api.post<PieceView>("/api/pieces", payload);
      setFieldErrors({}); toast.success(t("piece.created"));
      // as opções rodam depois da peça salva: se uma falhar, a peça fica e o aviso diz o que não deu certo
      if (shareToFeed) {
        try {
          await api.post(`/api/interactions/PIECE/${p.id}/shares`, { channel: "FEED", ...(value.visibility === "PRIVATE" ? { publish: true } : {}) });
          toast.success(t("interactions.sharedToFeed"));
        } catch (e) { toast.fromError(e, t("pieces.new.share_falhou")); }
      }
      if (toFlair) {
        try {
          const card = await api.post<FlairCollectionCard>("/api/flair/cards", { pieceId: p.id });
          toast.success(t("pieces.new.flair_feito", { tier: t(`flairCard.tier.${card.tier}`), ovr: card.ovr }));
        } catch (e) { toast.fromError(e, t("pieces.new.flair_falhou")); }
      }
      setDone(p.id);
    } catch (e) {
      // campos continuam no estado da página: nada se perde numa falha
      const err = e instanceof ApiError ? e : new ApiError(0, "ERRO", String(e));
      if (Object.keys(err.fields).length && (err.status === 400 || err.status === 422)) showFieldErrors(err.fields);
      else if (err.status === 0) setSaveProblem(t("piece.err_rede"));
      else if (err.status >= 500) setSaveProblem(t("piece.err_servidor", { ref: err.correlationId ? err.correlationId.slice(0, 8) : "—" }));
      else setSaveProblem(err.message);                                          // 401/403/409: a mensagem do servidor já é para a pessoa
    } finally { saving.current = false; setBusy(false); }
  }
  // sem foto oficial: o asset da categoria (ou o genérico) é a imagem que a peça terá
  // (a subcategoria escolhida troca o asset: camiseta, camisa, regata… cada uma com a sua imagem)
  const asset = (value.subcategory && tax?.defaultImagesBySubcategory?.[value.subcategory]) || tax?.defaultImages?.[value.category] || tax?.defaultImages?.generic || GENERIC_ASSET;
  const officialImg = pick?.product.imageUrl ?? null;
  const origin = pick && officialImg
    ? t("catalog.origem_catalogo", { fonte: pick.product.source?.domain && pick.product.source.domain !== "null" ? pick.product.source.domain : t("catalog.fonte_fashionai") })
    : t("catalog.origem_sem_foto");
  const stepLabel: Record<Step, string> = { piece: t("pieces.new.etapa_peca"), more: t("pieceForm.moreDetails"), art: t("pieces.new.etapa_arte"), review: t("builder.step.review") };
  const idx = STEPS.indexOf(step);
  const go = (s: Step) => { setStep(s); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const nav = (
    <div className="mt-4 flex justify-between gap-2">
      <Button onClick={() => go(STEPS[Math.max(0, idx - 1)])} disabled={idx === 0}>{t("common.back")}</Button>
      {step === "review" ? <Button variant="primary" size="lg" onClick={submit} loading={busy} disabled={!!done}><FaiIcon id="ACT-10" size={24} decorative />{t("common.save")}</Button> : <Button variant="primary" onClick={() => go(STEPS[idx + 1])}>{t("common.next")}</Button>}
    </div>
  );
  // prévia do card da peça com o que já foi preenchido (RF7 · anatomia "peça de roupa")
  const previewPiece: PieceView = { id: "preview", owner: { id: user?.id ?? "", username: user?.username ?? "", displayName: user?.displayName ?? "", profileType: "PESSOAL", verified: false, privateAccount: false }, name: value.name || t("common.peca"), category: value.category || "upper_piece", subcategory: value.subcategory, sex: value.sex, brandName: value.brandName && !isNoBrand(value.brandName) ? value.brandName : null, brandLogoUrl: value.brandLogoUrl ?? null, color: value.color, colorHex: tax?.colors?.[value.color] ?? null, material: value.material, size: value.size, style: value.style, occasion: value.occasion, seals: value.seals, price: value.price === "" ? null : Number(value.price), imageUrl: officialImg ?? asset, thumbnailUrl: officialImg ?? asset, studioImageUrl: null, studioThumbUrl: null, studioFeedUrl: null, defaultImage: !officialImg, visibility: value.visibility, disponivel: true, availabilityStatus: "AVAILABLE", favorite: false, forSale: value.forSale, wearCount: 0, tags: [], background, counters: { likes: 0, comments: 0, shares: 0, remixes: 0, views: 0, saves: 0, reactions: {} }, viewer: { liked: false, reactions: [], saved: false, canEdit: true, following: false }, notAvailableAnymore: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return (
    <>
      <PageHeader title={t("closet.addPiece")} kicker="RF47" lead={t("pieces.new.lead_unica")} />
      {/* RF54 — veio do "É minha" do FashionAI Lens: o que a leitura viu já está no formulário, para conferir */}
      {pre.fromLens && (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-thread-soft p-3 type-body-sm" role="note" data-prefill="lens">
          <b>{t("pieceForm.lens.veio")}</b><span>{t("pieceForm.lens.dica")}</span>
          {pre.scan && <Link className="underline" href={`/lens/${pre.scan}`}>{t("pieceForm.lens.voltar")}</Link>}
        </p>
      )}
      <SegmentPicker className="mb-4" label={t("builder.stepsLabel")} value={step} onChange={go} options={STEPS.map((s, i) => ({ id: s, label: `${i + 1} · ${stepLabel[s]}` }))} />
      {/* na etapa da arte o editor tem a própria prévia (o mesmo card): a lateral some para não duplicar */}
      <div className={step === "art" ? "grid gap-5" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"}>
        <div className="min-w-0">
          {step === "piece" && (
            <Card>
              <div className="mb-3">
                <p className="label" id="piece-type-label">{t("pieces.new.tipo_da_peca")}<span aria-hidden className="text-critical"> *</span></p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="piece-type-label">{CATEGORY_CARDS.map((c) => <Chip key={c.id} active={value.category === c.id} onClick={() => chooseCategory(c.id)}>{CATEGORY_LABEL[c.id] ?? label(c.id)}</Chip>)}</div>
              </div>
              {/* RF47 · busca catalogada: o produto oficial preenche o formulário e traz a foto */}
              <section className="creator-section" aria-labelledby="piece-catalog-label">
                <div className="mb-2 flex flex-wrap items-center gap-2"><h2 id="piece-catalog-label" className="type-h3">{t("catalog.buscar_no_catalogo")}</h2><Badge tone="thread">{t("catalog.recomendado")}</Badge><span className="type-caption text-muted">{t("catalog.lead_busca")}</span></div>
                {pick ? (
                  <div className="catalog-pick" role="status">
                    <span className="catalog-pick-art" aria-hidden><img src={officialImg ?? asset} alt="" /></span>
                    <div className="min-w-0">
                      <p className="type-caption text-muted">{t("catalog.peca_do_catalogo")}</p>
                      <p className="type-body font-medium truncate">{pick.product.brand?.name} · {pick.product.productName}{pick.variant?.colorName ? ` — ${pick.variant.colorName}` : ""}</p>
                      <p className="type-caption text-faint">{officialImg ? t("catalog.foto_oficial_nota") : t("catalog.sem_foto_oficial_nota")}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={clearCatalog}>{t("catalog.remover_referencia")}</Button>
                  </div>
                ) : (
                  <CatalogSearch key={catalogSub} initial={catalogSub && value.subcategory === catalogSub ? { ...initial, subcategory: catalogSub } : initial} category={value.category} onPick={applyCatalog}
                    onContext={(ctx) => { if (ctx.subcategory !== undefined) setValue((v) => ({ ...v, subcategory: ctx.subcategory ?? "" })); }} />
                )}
              </section>
              <section className="creator-section" aria-labelledby="piece-form-label" id="piece-form-fields">
                <h2 id="piece-form-label" className="type-h3 mb-2">{t("pieces.new.etapa_dados")}</h2>
                {pick && <p className="mb-3 rounded-md bg-thread-soft p-3 type-body-sm" role="note">{t("catalog.preenchido_do_catalogo")}</p>}
                <PieceFields value={value} onChange={(v) => { setValue(v); if (Object.keys(fieldErrors).length) setFieldErrors({}); }} fieldErrors={fieldErrors} />
              </section>
              {/* RF4 · fotografia opcional, para um item mais personalizado: uma ou várias fotos, cada peça detectada vira uma
                  peça no guarda-roupa (revisão foto por foto). Independe do tipo escolhido acima. */}
              <section className="creator-section" aria-labelledby="piece-photo-label">
                <div className="mb-2 flex flex-wrap items-center gap-2"><h2 id="piece-photo-label" className="type-h3">{t("pieces.new.foto_opcional")}</h2><Badge tone="chalk">{t("common.optional")}</Badge></div>
                <MultiPieceUpload onSaved={(count) => { toast.success(t("multiPiece.salvas", { count })); window.location.href = user ? `/u/${user.username}` : "/closet"; }} />
              </section>
              {nav}
            </Card>
          )}
          {step === "more" && <Card><PieceMoreDetails value={value} onChange={setValue} error={null} />{Object.entries(fieldErrors).filter(([k]) => PIECE_FIELD_STEP[k] === "more").map(([k, m]) => <p key={k} role="alert" className="error-text">{m}</p>)}{nav}</Card>}
          {step === "art" && <Card><PieceArtEditor value={background} onChange={setBackground} piece={previewPiece} styles={value.style} occasions={value.occasion} />{nav}</Card>}
          {step === "review" && (
            <Card>
              <h2 className="type-h3 mb-2">{t("builder.step.review")}</h2>
              <dl className="c-facts mb-3">
                {([[t("common.nome"), value.name], [t("common.category"), value.category ? label(value.category) : "—"], [t("common.subcategory"), value.subcategory ? subcategoryLabel(value.subcategory) : "—"], [t("common.color"), value.color ? label(value.color) : "—"], [t("common.brand"), value.brandName || "—"], [t("common.occasion"), value.occasion.map((o) => label(o)).join(", ") || "—"], [t("common.style"), value.style.map((x) => label(x)).join(", ") || "—"], [t("common.price"), value.price || "—"], [t("common.visibility"), label(value.visibility.toLowerCase())], [t("common.forSale"), value.forSale ? t("common.yes") : t("common.no")], [t("pieceForm.selos_da_peca"), value.seals.map((s) => s.split(":")[1] ?? s).join(", ") || "—"], [t("catalog.origem"), origin]] as [string, string][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <section className="after-save" aria-labelledby="after-save-title">
                <h3 id="after-save-title" className="type-h3">{t("pieces.new.depois_de_salvar")}</h3>
                <Switch checked={shareToFeed} onChange={setShareToFeed} label={t("pieces.new.opt_share")} hint={t(shareToFeed ? "pieces.new.opt_share_on" : "pieces.new.opt_share_off")} />
                {shareToFeed && value.visibility === "PRIVATE" && <p role="note" className="after-save-detail type-caption">{t("pieces.new.opt_share_private")}</p>}
                <Switch checked={toFlair} onChange={setToFlair} label={t("pieces.new.opt_flair")} hint={t("pieces.new.opt_flair_hint")} />
                {toFlair && (
                  <div className="after-save-detail after-save-flair">
                    {flairPreview.data ? <>
                      <FlairGameCard size="sm" flip={false} card={{ id: "preview", originType: "PIECE", originId: "", season: flairPreview.data.season, tier: flairPreview.data.tier, ovr: flairPreview.data.ovr, rare: false,
                        position: flairPreview.data.position, name: value.name || t("common.peca"), brandName: value.brandName && !isNoBrand(value.brandName) ? value.brandName : null, imageUrl: officialImg ?? asset,
                        hype: null, priceVerified: flairPreview.data.priceVerified, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" }} />
                      <p className="type-body-sm">{t("pieces.new.opt_flair_preview", { tier: t(`flairCard.tier.${flairPreview.data.tier}`), ovr: flairPreview.data.ovr })}
                        {flairPreview.data.cappedByUnverifiedPrice && <><br /><span className="type-caption">{t("flairCard.unverified")}</span></>}</p>
                    </> : <p className="type-caption text-muted">{flairPreview.error ? t("pieces.new.opt_flair_sem_previa") : t("common.loading")}</p>}
                  </div>
                )}
              </section>
              {saveProblem && <p role="alert" className="error-text mb-2">{saveProblem}</p>}
              {nav}
            </Card>
          )}
        </div>
        {step !== "art" && <aside aria-label={t("common.pre_visualizacao")} className="card-preview lg:sticky lg:top-16 lg:self-start"><p className="label">{step === "review" && shareToFeed ? t("interactions.post_preview") : t("scheme.card")}</p><PieceCard piece={previewPiece} href="#"
          extra={step === "review" && shareToFeed && user ? <span className="caption">{t("feed.shared_by", { username: user.username })}</span> : undefined} /></aside>}
      </div>
      <p className="mt-4 type-caption text-faint"><Link className="underline" href="/closet">← {t("closet.title")}</Link></p>
      {done && <CreationSuccess kind="piece" id={done} onDone={() => { window.location.href = user ? `/u/${user.username}` : "/closet"; }} />}
    </>
  );
}

export default function NewPiecePage() { return <RequireAuth><Suspense fallback={null}><NewPiece /></Suspense></RequireAuth>; }

package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.BrandAlias;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogProductAlias;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandAliasRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductAliasRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * RF47 · Acervo & Busca Catalogada (catalog-first). Fluxo: categoria + subcategoria + marca + nome/modelo →
 * normalização em intenção estruturada → busca no catálogo interno (FULLTEXT ngram + re-rank por similaridade,
 * apelidos, sinônimos e cor) → resultados com matchScore → a pessoa escolhe ("Parece ser esta?") → a peça pessoal
 * referencia o produto global. Sem resultado: busca nas fontes oficiais (DISCOVERED) → escolha → o produto entra no
 * catálogo → o próximo usuário o encontra localmente. A foto do usuário é fallback (RF4/RF45), nunca o caminho principal.
 */
@Service
public class CatalogService {
    static final Set<CatalogIngestionStatus> VISIBLE = Set.of(CatalogIngestionStatus.VALIDATED, CatalogIngestionStatus.PERSISTABLE,
            CatalogIngestionStatus.REFERENCE_ONLY);
    public static final double MIN_SCORE = 0.35;

    private final CatalogProductRepository products;
    private final CatalogVariantRepository variants;
    private final CatalogImageRepository images;
    private final CatalogProductAliasRepository productAliases;
    private final CatalogSourceRepository sources;
    private final BrandRepository brands;
    private final BrandAliasRepository brandAliases;
    private final CatalogIngestService ingest;
    private final OfficialCatalogDiscovery discovery;
    private final WardrobeService wardrobe;
    private final UserPreferencesRepository preferences;
    private final UserRepository users;
    private CatalogTextInterpreter textInterpreter;
    private final CatalogNormalizer norm = CatalogNormalizer.get();
    private final CatalogMatchScorer scorer = new CatalogMatchScorer(norm);

    public CatalogService(CatalogProductRepository products, CatalogVariantRepository variants, CatalogImageRepository images,
                          CatalogProductAliasRepository productAliases, CatalogSourceRepository sources, BrandRepository brands,
                          BrandAliasRepository brandAliases, CatalogIngestService ingest, OfficialCatalogDiscovery discovery,
                          WardrobeService wardrobe, UserPreferencesRepository preferences, UserRepository users) {
        this.products = products;
        this.variants = variants;
        this.images = images;
        this.productAliases = productAliases;
        this.sources = sources;
        this.brands = brands;
        this.brandAliases = brandAliases;
        this.ingest = ingest;
        this.discovery = discovery;
        this.wardrobe = wardrobe;
        this.preferences = preferences;
        this.users = users;
    }

    /** Leitor das características únicas da peça no texto (com IA, RF24); sem ele, só a leitura local. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setTextInterpreter(CatalogTextInterpreter textInterpreter) {
        this.textInterpreter = textInterpreter;
    }

    /** Campos do formulário de busca (qualquer combinação de 2–3 já basta). */
    public record SearchRequest(String category, String subcategory, String brand, String query, String color, Integer limit) {
    }

    /** Intenção normalizada + marca resolvida (null = marca desconhecida no catálogo). */
    record Resolved(CatalogMatchScorer.Intent intent, Brand brand, String rawBrand, boolean subcategoryFromText) {
        Resolved(CatalogMatchScorer.Intent intent, Brand brand, String rawBrand) {
            this(intent, brand, rawBrand, false);
        }
    }

    Resolved resolve(SearchRequest r) {
        return resolve(null, r);
    }

    Resolved resolve(UUID userId, SearchRequest r) {
        Brand brand = null;
        if (r.brand() != null && !r.brand().isBlank()) {
            brand = ingest.resolveBrand(r.brand(), false).orElse(null);
        }
        String sub = r.subcategory() == null ? null : norm.subcategory(r.subcategory()).orElse(null);
        String cat = r.category() == null ? (sub == null ? null : norm.categoryOf(sub)) : norm.category(r.category()).orElse(null);
        String color = r.color() == null ? null : norm.color(r.color()).orElse(null);
        List<String> keywords = new ArrayList<>();
        Set<String> brandWords = brand == null ? Set.of() : new LinkedHashSet<>(norm.tokens(brand.getName()));
        // características únicas da peça no texto ("logo CK em toda a superfície, cinza e preto" × "toda azul, um logo branco")
        DesignTraits design = r.query() == null || r.query().isBlank() ? DesignTraits.EMPTY
                : textInterpreter != null ? textInterpreter.interpret(userId, r.query()) : CatalogDesignInterpreter.get().interpret(r.query());
        if (color == null && !design.isEmpty()) {
            color = !design.baseColors().isEmpty() ? design.baseColors().get(0) : !design.anyColors().isEmpty() ? design.anyColors().get(0) : null;
        }
        for (String t : norm.tokens(r.query())) {
            if (brandWords.contains(t) || design.consumed().contains(t)) {
                continue;
            }
            if (color == null && norm.color(t).isPresent()) {
                color = norm.color(t).get();         // "polo lacoste verde" → cor = green
                continue;
            }
            if (sub == null && norm.subcategory(t).isPresent()) {
                sub = norm.subcategory(t).get();     // "air force tênis" → subcategoria pelo texto
                if (cat == null) {
                    cat = norm.categoryOf(sub);
                }
                continue;
            }
            if (brand == null) {
                Optional<Brand> b = ingest.resolveBrand(t, false);
                if (b.isPresent()) {
                    brand = b.get();
                    continue;
                }
            }
            keywords.add(t);
        }
        boolean subFromText = sub != null && (r.subcategory() == null || r.subcategory().isBlank());
        return new Resolved(new CatalogMatchScorer.Intent(brand == null ? null : brand.getSlug(), cat, sub, keywords, color, design), brand, r.brand(), subFromText);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> search(SearchRequest r) {
        return search(null, r);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> search(UUID userId, SearchRequest r) {
        Resolved res = resolve(userId, r);
        CatalogMatchScorer.Intent q = res.intent();
        int limit = r.limit() == null ? 24 : Math.max(1, Math.min(48, r.limit()));
        if (q.brandSlug() == null && q.subcategory() == null && q.category() == null && q.keywords().isEmpty() && q.design().isEmpty()) {
            return Map.of("intent", intentMap(res), "results", List.of(), "total", 0, "enoughInput", false);
        }
        String brandId = res.brand() == null ? null : res.brand().getId().toString();
        String terms = q.keywords().isEmpty() ? null : String.join(" ", q.keywords());
        Map<UUID, CatalogProduct> pool = new LinkedHashMap<>();
        // subtipo deduzido do texto ("camisa") só pontua, não filtra: no Brasil "camisa" também é camiseta
        String subFilter = res.subcategoryFromText() ? null : q.subcategory();
        try {
            products.candidates(brandId, q.category(), subFilter, terms).forEach(p -> pool.put(p.getId(), p));
        } catch (RuntimeException ex) {
            // índice FULLTEXT indisponível (banco de teste): segue só com os filtros estruturados
        }
        if (pool.size() < 8) {
            products.candidates(brandId, q.category(), subFilter, null).forEach(p -> pool.putIfAbsent(p.getId(), p));
        }
        List<Map<String, Object>> ranked = rank(res, new ArrayList<>(pool.values()), limit);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("intent", intentMap(res));
        out.put("results", ranked);
        out.put("total", ranked.size());
        out.put("enoughInput", true);
        out.put("canSearchOfficial", res.brand() != null && !sources.findByBrandIdAndActiveTrue(res.brand().getId()).isEmpty());
        out.put("message", ranked.isEmpty() ? Msg.t("catalog.nao_encontramos") : null);
        return out;
    }

    List<Map<String, Object>> rank(Resolved res, List<CatalogProduct> pool, int limit) {
        if (pool.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = pool.stream().map(CatalogProduct::getId).toList();
        Map<UUID, List<String>> aliases = productAliases.findByProductIdIn(ids).stream()
                .collect(Collectors.groupingBy(CatalogProductAlias::getProductId, Collectors.mapping(CatalogProductAlias::getAlias, Collectors.toList())));
        Map<UUID, CatalogImage> primary = images.findByProductIdInAndPrimaryTrue(ids).stream()
                .collect(Collectors.toMap(CatalogImage::getProductId, Function.identity(), (a, b) -> a));
        Map<UUID, List<CatalogVariant>> variantsBy = variants.findByProductIdIn(ids).stream()
                .collect(Collectors.groupingBy(CatalogVariant::getProductId));
        Map<UUID, Brand> brandById = new HashMap<>();
        List<Map<String, Object>> out = new ArrayList<>();
        for (CatalogProduct p : pool) {
            Brand b = brandById.computeIfAbsent(p.getBrandId(), id -> brands.findById(id).orElse(null));
            List<CatalogVariant> vs = variantsBy.getOrDefault(p.getId(), List.of());
            CatalogMatchScorer.Score s = scorer.score(res.intent(), candidate(p, b, aliases.getOrDefault(p.getId(), List.of()), vs), null);
            if (s.total() < MIN_SCORE) {
                continue;
            }
            Map<String, Object> m = card(p, b, primary.get(p.getId()));
            m.put("variants", vs.stream().map(this::variantMap).toList());
            // a variante da cor pedida ("501 preto" → variante Black) vem pré-selecionada
            String wanted = res.intent().color();
            vs.stream().filter(v -> wanted != null && wanted.equals(v.getColor())).findFirst().ifPresent(v -> {
                m.put("selectedVariant", variantMap(v));
                m.put("colorName", v.getColorName());
                m.put("color", v.getColor());
                m.put("colorHex", Taxonomy.hex(v.getColor()));
            });
            m.put("matchScore", s.toMap());
            m.put("matchPercent", (int) Math.round(s.total() * 100));
            out.add(m);
        }
        out.sort(Comparator.comparingDouble((Map<String, Object> m) -> ((Number) ((Map<?, ?>) m.get("matchScore")).get("total")).doubleValue())
                .reversed().thenComparing(m -> -((Number) m.get("ownersCount")).intValue()));
        return out.size() > limit ? out.subList(0, limit) : out;
    }

    static CatalogMatchScorer.Candidate candidate(CatalogProduct p, Brand b, List<String> aliases, List<CatalogVariant> vs) {
        List<String> codes = new ArrayList<>();
        codes.add(p.getProductCode());
        codes.add(p.getSku());
        codes.add(p.getGtin());
        List<String> all = new ArrayList<>(aliases);
        for (CatalogVariant v : vs) {
            codes.add(v.getVariantCode());
            codes.add(v.getSku());
            if (v.getColorName() != null) {
                all.add(v.getColorName());
            }
        }
        return new CatalogMatchScorer.Candidate(b == null ? null : b.getSlug(), p.getCategory(), p.getSubcategory(), p.getProductName(),
                p.getModelName(), p.getColor(), p.getColorName(), p.getCollection(), all, codes,
                vs.stream().map(CatalogVariant::getColor).filter(java.util.Objects::nonNull).toList(), designOf(p), p.getDescription());
    }

    /** Design gravado no produto; sem ele, lido do nome + descrição + cor pelo mesmo intérprete da busca. */
    static DesignTraits designOf(CatalogProduct p) {
        if (p.getDesignJson() != null && !p.getDesignJson().isBlank()) {
            DesignTraits d = DesignTraits.fromMap(br.com.fashionai.application.common.Json.map(p.getDesignJson()), "CATALOG");
            if (!d.isEmpty()) {
                return d;
            }
        }
        return CatalogDesignInterpreter.get().ofProduct(p.getProductName(), p.getDescription(), p.getColorName(), p.getColor());
    }

    Map<String, Object> card(CatalogProduct p, Brand b, CatalogImage img) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("brand", b == null ? null : Map.of("id", b.getId(), "name", b.getName(), "slug", b.getSlug(),
                "logoUrl", String.valueOf(b.getLogoUrl())));
        m.put("productName", p.getProductName());
        m.put("modelName", p.getModelName());
        m.put("category", p.getCategory());
        m.put("subcategory", p.getSubcategory());
        m.put("color", p.getColor());
        m.put("colorName", p.getColorName());
        m.put("colorHex", p.getColor() == null ? null : Taxonomy.hex(p.getColor()));
        m.put("material", p.getMaterial());
        m.put("collection", p.getCollection());
        m.put("description", p.getDescription());
        DesignTraits design = designOf(p);
        m.put("design", design.isEmpty() ? null : design.toMap());
        m.put("gender", p.getGender());
        m.put("productCode", p.getProductCode());
        m.put("sku", p.getSku());
        m.put("imageUrl", img == null ? null : img.getImageUrl());
        m.put("imageSource", img == null ? null : CatalogIngestService.provenance(img));
        m.put("source", Map.of("type", p.getSourceType().name(), "domain", String.valueOf(p.getSourceDomain()),
                "productUrl", String.valueOf(p.getOfficialProductUrl()), "status", p.getSourceStatus().name(),
                "lastVerifiedAt", String.valueOf(p.getLastVerifiedAt())));
        m.put("ingestionStatus", p.getIngestionStatus().name());
        m.put("ownersCount", p.getOwnersCount());
        return m;
    }

    private Map<String, Object> intentMap(Resolved r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("brand", r.brand() == null ? r.rawBrand() : r.brand().getName());
        m.put("brandKnown", r.brand() != null);
        m.put("category", r.intent().category());
        m.put("subcategory", r.intent().subcategory());
        m.put("keywords", r.intent().keywords());
        m.put("color", r.intent().color());
        m.put("design", r.intent().design().isEmpty() ? null : r.intent().design().toMap());
        return m;
    }

    /** Sugestões enquanto digita: nomes de modelo/produto distintos dos melhores resultados. */
    @Transactional(readOnly = true)
    public Map<String, Object> suggestions(SearchRequest r) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results = (List<Map<String, Object>>) search(new SearchRequest(r.category(), r.subcategory(), r.brand(),
                r.query(), r.color(), 12)).get("results");
        Set<String> names = new LinkedHashSet<>();
        for (Map<String, Object> m : results) {
            Object model = m.get("modelName");
            names.add(String.valueOf(model != null ? model : m.get("productName")));
            if (names.size() >= 8) {
                break;
            }
        }
        return Map.of("suggestions", List.copyOf(names));
    }

    /** Autocomplete de marca: nome e apelidos, sem duplicar a mesma marca. */
    @Transactional(readOnly = true)
    public Map<String, Object> brandSuggestions(String term) {
        String t = term == null ? "" : term.trim();
        Map<UUID, Map<String, Object>> out = new LinkedHashMap<>();
        if (t.length() < 1) {
            return Map.of("brands", List.of());
        }
        for (Brand b : brands.findTop20ByNameContainingIgnoreCaseOrderByName(t)) {
            out.put(b.getId(), brandMap(b, null));
        }
        for (BrandAlias a : brandAliases.findTop20ByAliasNormStartingWith(CatalogNormalizer.key(t))) {
            brands.findById(a.getBrandId()).ifPresent(b -> out.putIfAbsent(b.getId(), brandMap(b, a.getAlias())));
        }
        return Map.of("brands", out.values().stream().limit(12).toList());
    }

    private Map<String, Object> brandMap(Brand b, String matchedAlias) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId());
        m.put("name", b.getName());
        m.put("slug", b.getSlug());
        m.put("logoUrl", b.getLogoUrl());
        m.put("country", b.getCountry());
        m.put("alias", matchedAlias);
        m.put("products", products.countByBrandIdAndIngestionStatusIn(b.getId(), VISIBLE));
        return m;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> product(UUID id) {
        CatalogProduct p = products.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("catalog.produto")));
        Brand b = brands.findById(p.getBrandId()).orElse(null);
        List<CatalogImage> imgs = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(p.getId());
        Map<String, Object> m = card(p, b, imgs.isEmpty() ? null : imgs.get(0));
        m.put("images", imgs.stream().map(i -> Map.of("id", i.getId(), "url", i.getImageUrl(), "type", i.getImageType().name(),
                "primary", i.isPrimary(), "provenance", CatalogIngestService.provenance(i))).toList());
        m.put("variants", variants.findByProductIdOrderByVariantKey(p.getId()).stream().map(this::variantMap).toList());
        m.put("aliases", productAliases.findByProductId(p.getId()).stream().map(CatalogProductAlias::getAlias).toList());
        return m;
    }

    private Map<String, Object> variantMap(CatalogVariant v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", v.getId());
        m.put("key", v.getVariantKey());
        m.put("color", v.getColor());
        m.put("colorName", v.getColorName());
        m.put("code", v.getVariantCode());
        m.put("sku", v.getSku());
        return m;
    }

    /**
     * Busca externa nas fontes oficiais da marca. Os candidatos aceitos entram como DISCOVERED (ocultos da busca
     * normal) e só viram catálogo de verdade quando alguém escolhe um deles.
     */
    @Transactional
    public Map<String, Object> discover(CurrentUser user, SearchRequest r) {
        Resolved res = resolve(user.id(), r);
        if (res.brand() == null) {
            return Map.of("results", List.of(), "status", "BRAND_UNKNOWN", "message", Msg.t("catalog.marca_sem_fonte_oficial"));
        }
        List<String> domains = sources.findByBrandIdAndActiveTrue(res.brand().getId()).stream().map(CatalogSource::getDomain).toList();
        if (domains.isEmpty()) {
            return Map.of("results", List.of(), "status", "NO_OFFICIAL_SOURCE", "message", Msg.t("catalog.marca_sem_fonte_oficial"));
        }
        String sub = res.intent().subcategory();
        List<OfficialCatalogDiscovery.Found> found = discovery.discover(user.id(), res.brand().getName(),
                sub == null ? "" : Msg.t("taxonomy." + sub), r.query(), domains);
        List<CatalogProduct> discovered = new ArrayList<>();
        int rejected = 0;
        for (OfficialCatalogDiscovery.Found f : found) {
            String subcategory = sub != null ? sub : norm.subcategory(f.productName()).orElse(null);
            if (subcategory == null) {
                rejected++;
                continue;
            }
            List<CatalogIngestService.ImageInput> imgs = OfficialCatalogDiscovery.imageAllowed(f.imageUrl(), domains)
                    ? List.of(new CatalogIngestService.ImageInput(f.imageUrl(), "PACKSHOT")) : List.of();
            try {
                CatalogIngestService.Result result = ingest.upsert(new CatalogIngestService.ProductInput(res.brand().getName(), null, subcategory,
                        f.productName(), f.modelName(), f.productCode(), f.sku(), f.gtin(), null, null, f.color(), f.color(), f.material(),
                        f.collection(), null, f.productUrl(), "OFFICIAL_BRAND", imgs, List.of(), List.of()), CatalogIngestionStatus.DISCOVERED, false);
                discovered.add(result.product());
            } catch (ApiException e) {
                rejected++;
            }
        }
        List<Map<String, Object>> ranked = rank(res, discovered, 12);
        return Map.of("results", ranked, "status", ranked.isEmpty() ? "NOT_FOUND" : "FOUND", "rejected", rejected,
                "message", ranked.isEmpty() ? Msg.t("catalog.nada_nas_lojas_oficiais") : Msg.t("catalog.achamos_nas_lojas_oficiais"));
    }

    /** Dados pessoais da peça (pertencem à pessoa, não ao produto global). */
    public record AddRequest(UUID productId, UUID variantId, String size, ItemCondition condition, BigDecimal price,
                             LocalDate purchaseDate, String purchaseLocation, Boolean favorite, Boolean forSale,
                             String notes, Visibility visibility, List<String> occasion, List<String> style,
                             String color, String material, String sex, String name, Map<String, Object> background) {
    }

    @Transactional
    public Views.PieceView addToWardrobe(CurrentUser user, AddRequest a) {
        CatalogProduct p = products.findById(a.productId()).orElseThrow(() -> ApiException.notFound(Msg.t("catalog.produto")));
        if (p.getIngestionStatus() == CatalogIngestionStatus.REJECTED) {
            throw ApiException.badRequest("PRODUTO_RECUSADO", Msg.t("catalog.produto_recusado"));
        }
        Brand b = brands.findById(p.getBrandId()).orElseThrow(() -> ApiException.notFound(Msg.t("common.brand")));
        CatalogVariant variant = a.variantId() == null ? null : variants.findById(a.variantId())
                .filter(v -> v.getProductId().equals(p.getId())).orElse(null);
        // escolhido por alguém: o candidato descoberto passa a ser catálogo (o próximo usuário acha localmente)
        if (p.getIngestionStatus() == CatalogIngestionStatus.DISCOVERED) {
            p.setIngestionStatus(CatalogIngestionStatus.REFERENCE_ONLY);
        }
        p.setOwnersCount(p.getOwnersCount() + 1);
        p.setLastVerifiedAt(p.getLastVerifiedAt() == null ? Instant.now() : p.getLastVerifiedAt());
        products.save(p);
        String color = firstValid(a.color(), variant == null ? null : variant.getColor(), p.getColor(), Taxonomy.COLORS::containsKey, "black");
        String material = firstValid(a.material(), p.getMaterial(), null, Taxonomy.MATERIALS::contains, "BLEND");
        String sex = firstValid(a.sex(), p.getGender(), null, Taxonomy.SEXES::contains, "UNISSEX");
        List<String> occasion = a.occasion() == null || a.occasion().isEmpty()
                ? List.of(Taxonomy.allowedOccasions(p.getCategory()).get(0)) : a.occasion();
        List<String> style = a.style() == null || a.style().isEmpty() ? List.of("basic") : a.style();
        String name = a.name() != null && !a.name().isBlank() ? a.name().trim() : p.getProductName();
        String image = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(p.getId()).stream()
                .filter(i -> i.getUsageStatus() != br.com.fashionai.domain.model.enums.CatalogImageUsage.REJECTED)
                .map(i -> i.getStoredUrl() != null ? i.getStoredUrl() : i.getImageUrl()).findFirst().orElse(null);
        WardrobeService.PieceForm form = new WardrobeService.PieceForm(null, true, name, p.getCategory(), p.getSubcategory(), sex,
                b.getId(), b.getName(), color, material, a.size(), null, occasion, style, List.of(),
                a.price() == null ? BigDecimal.ZERO : a.price(), a.visibility(), List.of(), a.notes(), a.condition(), a.purchaseDate(),
                a.purchaseLocation(), p.getSku(), null, a.forSale(), false, b.getLogoUrl(), "CATALOGO", p.getId().toString(),
                a.background());
        Views.PieceView view = wardrobe.createFromCatalog(user, form, new WardrobeService.CatalogPick(p.getId(),
                variant == null ? null : variant.getId(), image));
        if (Boolean.TRUE.equals(a.favorite())) {
            view = wardrobe.toggles(user, view.id(), true, null, null);
        }
        return view;
    }

    private static String firstValid(String a, String b, String c, java.util.function.Predicate<String> valid, String fallback) {
        for (String v : new String[]{a, b, c}) {
            if (v != null && valid.test(v)) {
                return v;
            }
        }
        return fallback;
    }

    // ───────────────────────────── tutorial "Como fotografar" (por guia, sincronizado na conta)

    @Transactional(readOnly = true)
    public Map<String, Object> tutorialPreferences(CurrentUser user) {
        return preferences.findByUserId(user.id()).map(UserPreferences::getCaptureTutorialJson).map(Json::map)
                .map(m -> Map.<String, Object>of("captureTutorialPreferences", m)).orElse(Map.of("captureTutorialPreferences", Map.of()));
    }

    @Transactional
    public Map<String, Object> setTutorialHidden(CurrentUser user, String guide, boolean hidden) {
        if (guide == null || !guide.matches("[a-z_]{3,40}")) {
            throw ApiException.badRequest("GUIA_INVALIDO", Msg.t("catalog.guia_invalido"));
        }
        UserPreferences prefs = preferences.findByUserId(user.id()).orElseGet(() -> {
            UserPreferences np = new UserPreferences();
            np.setUser(users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario"))));
            return np;
        });
        Map<String, Object> m = new LinkedHashMap<>(prefs.getCaptureTutorialJson() == null ? Map.of() : Json.map(prefs.getCaptureTutorialJson()));
        m.put(guide, Map.of("hidden", hidden));
        prefs.setCaptureTutorialJson(Json.write(m));
        preferences.save(prefs);
        return Map.of("captureTutorialPreferences", m);
    }

    // ───────────────────────────── Explorador (RF26): marcas do catálogo sem perfil cadastrado

    /** Marcas do catálogo com produtos visíveis — alimentam "Buscar marcas & lojas" ao lado dos perfis BRAND. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> catalogBrands() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Brand b : brands.findAllByOrderByName()) {
            long count = products.countByBrandIdAndIngestionStatusIn(b.getId(), VISIBLE);
            if (count == 0) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("brandId", b.getId());
            m.put("slug", b.getSlug());
            m.put("name", b.getName());
            m.put("logoUrl", b.getLogoUrl());
            m.put("country", b.getCountry());
            m.put("storeUrl", b.getWebsite());
            m.put("catalogProducts", count);
            m.put("categories", products.findByBrandIdAndIngestionStatusIn(b.getId(), VISIBLE).stream()
                    .map(CatalogProduct::getCategory).distinct().sorted().toList());
            out.add(m);
        }
        return out;
    }
}

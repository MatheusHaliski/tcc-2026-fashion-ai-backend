package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogProductAlias;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import br.com.fashionai.domain.repository.BrandAliasRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductAliasRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * RF47 · Upsert idempotente de produtos no catálogo global — a mesma regra do pipeline Python (scripts/catalog):
 * normaliza, resolve a marca sem duplicar (slug + apelidos), procura o produto existente por identificador forte
 * (gtin › ean › upc › sku › código › URL canônica › chave de dedup) e só então cria; variantes, imagens e apelidos
 * também por find-or-create. Usado pela descoberta externa (status DISCOVERED) e pela seleção do usuário.
 */
@Service
public class CatalogIngestService {
    private final BrandRepository brands;
    private final BrandAliasRepository brandAliases;
    private final CatalogProductRepository products;
    private final CatalogVariantRepository variants;
    private final CatalogImageRepository images;
    private final CatalogProductAliasRepository productAliases;
    private final CatalogSourceRepository sources;
    private final CatalogNormalizer norm = CatalogNormalizer.get();

    public CatalogIngestService(BrandRepository brands, BrandAliasRepository brandAliases, CatalogProductRepository products,
                                CatalogVariantRepository variants, CatalogImageRepository images,
                                CatalogProductAliasRepository productAliases, CatalogSourceRepository sources) {
        this.brands = brands;
        this.brandAliases = brandAliases;
        this.products = products;
        this.variants = variants;
        this.images = images;
        this.productAliases = productAliases;
        this.sources = sources;
    }

    /** Produto de entrada (JSON de importação, resultado da busca oficial). */
    public record ProductInput(String brand, String category, String subcategory, String productName, String modelName,
                               String productCode, String sku, String gtin, String ean, String upc, String color,
                               String colorName, String material, String collection, String gender,
                               String officialProductUrl, String sourceType, List<ImageInput> images, List<String> aliases,
                               List<VariantInput> variants) {
    }

    public record ImageInput(String url, String type) {
    }

    public record VariantInput(String color, String colorName, String code, String sku, String gtin) {
    }

    public enum Outcome { CREATED, UPDATED, DUPLICATE }

    public record Result(CatalogProduct product, Outcome outcome, List<String> warnings) {
    }

    /** Marca pelo nome/apelido; nunca cria duplicada. Cria só quando {@code createIfMissing} (ingestão curada). */
    @Transactional
    public Optional<Brand> resolveBrand(String raw, boolean createIfMissing) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String slug = norm.brandSlug(raw);
        Optional<Brand> found = brands.findBySlug(slug)
                .or(() -> brandAliases.findByAliasNorm(CatalogNormalizer.key(raw)).flatMap(a -> brands.findById(a.getBrandId())));
        if (found.isPresent() || !createIfMissing) {
            return found;
        }
        Brand b = new Brand(raw.trim(), slug, BrandSource.USER_SUBMITTED);
        return Optional.of(brands.save(b));
    }

    /**
     * @param status DISCOVERED para candidatos da busca externa (ficam ocultos até alguém escolher); VALIDATED para
     *               importação curada. Produto já existente nunca é rebaixado para DISCOVERED.
     */
    @Transactional
    public Result upsert(ProductInput in, CatalogIngestionStatus status, boolean createBrand) {
        List<String> warnings = new ArrayList<>();
        Brand brand = resolveBrand(in.brand(), createBrand)
                .orElseThrow(() -> ApiException.badRequest("MARCA_DESCONHECIDA", "Marca desconhecida: " + in.brand()));
        String subcategory = norm.subcategory(in.subcategory()).orElseThrow(() ->
                ApiException.badRequest("SUBCATEGORIA_INVALIDA", "Subcategoria fora da taxonomia: " + in.subcategory()));
        String category = norm.categoryOf(subcategory);
        if (in.category() != null && norm.category(in.category()).map(c -> !c.equals(category)).orElse(false)) {
            warnings.add("categoria corrigida para " + category + " pela subcategoria");
        }
        if (in.productName() == null || in.productName().isBlank()) {
            throw ApiException.badRequest("NOME_OBRIGATORIO", "Produto sem nome");
        }
        String color = in.color() == null ? null : norm.color(in.color()).orElse(null);
        if (color == null && in.colorName() != null) {
            color = norm.color(in.colorName()).orElse(null);
        }
        String material = in.material() == null ? null : norm.material(in.material()).orElse(null);
        String canonical = CatalogNormalizer.canonicalUrl(in.officialProductUrl());
        String domain = CatalogNormalizer.domain(in.officialProductUrl());
        CatalogSourceType sourceType = sourceType(in.sourceType(), brand.getId(), domain);
        String dedup = norm.dedupKey(brand.getSlug(), in.gtin(), in.ean(), in.upc(), in.sku(), in.productCode(), canonical,
                in.modelName(), in.colorName() != null ? in.colorName() : color, in.productName(), color);

        Optional<CatalogProduct> existing = findExisting(in, canonical, dedup);
        Outcome outcome;
        CatalogProduct p;
        if (existing.isPresent()) {
            p = existing.get();
            outcome = Outcome.UPDATED;
            if (status == CatalogIngestionStatus.DISCOVERED && p.getIngestionStatus() != CatalogIngestionStatus.DISCOVERED) {
                outcome = Outcome.DUPLICATE; // já está no catálogo: a busca externa não sobrescreve dados curados
                return new Result(p, outcome, warnings);
            }
        } else {
            p = new CatalogProduct();
            p.setDedupKey(dedup);
            p.setFirstSeenAt(Instant.now());
            p.setIngestionStatus(status);
            outcome = Outcome.CREATED;
        }
        p.setBrandId(brand.getId());
        p.setCategory(category);
        p.setSubcategory(subcategory);
        p.setProductName(in.productName().trim());
        p.setModelName(blankToNull(in.modelName()));
        p.setProductCode(blankToNull(in.productCode()));
        p.setSku(blankToNull(in.sku()));
        p.setGtin(blankToNull(in.gtin()));
        p.setEan(blankToNull(in.ean()));
        p.setUpc(blankToNull(in.upc()));
        p.setColor(color);
        p.setColorName(blankToNull(in.colorName()));
        p.setMaterial(material);
        p.setCollection(blankToNull(in.collection()));
        p.setGender(in.gender() == null ? null : norm.gender(in.gender()).orElse(null));
        p.setOfficialProductUrl(blankToNull(in.officialProductUrl()));
        p.setCanonicalUrl(canonical);
        p.setSourceType(sourceType);
        p.setSourceDomain(domain);
        p.setSourceStatus(CatalogSourceStatus.ACTIVE);
        p.setLastVerifiedAt(Instant.now());
        if (status != CatalogIngestionStatus.DISCOVERED && p.getIngestionStatus() == CatalogIngestionStatus.DISCOVERED) {
            p.setIngestionStatus(status);
        }
        List<String> aliases = in.aliases() == null ? List.of() : in.aliases();
        p.setSearchText(searchText(brand, p, aliases));
        p = products.save(p);
        for (String alias : aliases) {
            String k = CatalogNormalizer.key(alias);
            if (k.isBlank() || productAliases.findByProductId(p.getId()).stream().anyMatch(a -> a.getAliasNorm().equals(k))) {
                continue;
            }
            CatalogProductAlias a = new CatalogProductAlias();
            a.setProductId(p.getId());
            a.setAlias(alias.trim());
            a.setAliasNorm(k);
            productAliases.save(a);
        }
        if (in.variants() != null) {
            for (VariantInput v : in.variants()) {
                upsertVariant(p, v);
            }
        }
        if (in.images() != null) {
            boolean first = images.findByProductIdOrderByPrimaryDescCreatedAtAsc(p.getId()).stream().noneMatch(CatalogImage::isPrimary);
            for (ImageInput img : in.images()) {
                if (upsertImage(p, img, first, sourceType, brand.getId())) {
                    first = false;
                }
            }
        }
        return new Result(p, outcome, warnings);
    }

    Optional<CatalogProduct> findExisting(ProductInput in, String canonical, String dedup) {
        if (notBlank(in.gtin())) {
            Optional<CatalogProduct> f = products.findFirstByGtin(in.gtin().trim());
            if (f.isPresent()) return f;
        }
        if (notBlank(in.ean())) {
            Optional<CatalogProduct> f = products.findFirstByEan(in.ean().trim());
            if (f.isPresent()) return f;
        }
        if (notBlank(in.upc())) {
            Optional<CatalogProduct> f = products.findFirstByUpc(in.upc().trim());
            if (f.isPresent()) return f;
        }
        if (notBlank(in.sku())) {
            Optional<CatalogProduct> f = products.findFirstBySku(in.sku().trim());
            if (f.isPresent()) return f;
        }
        if (notBlank(in.productCode())) {
            Optional<CatalogProduct> f = products.findFirstByProductCode(in.productCode().trim());
            if (f.isPresent()) return f;
        }
        if (canonical != null) {
            Optional<CatalogProduct> f = products.findFirstByCanonicalUrl(canonical);
            if (f.isPresent()) return f;
        }
        return products.findByDedupKey(dedup);
    }

    private void upsertVariant(CatalogProduct p, VariantInput v) {
        String key = CatalogNormalizer.key(firstNonBlank(v.code(), v.sku(), v.gtin(), v.colorName(), v.color())).replace(' ', '-');
        if (key.isBlank()) {
            return;
        }
        CatalogVariant cv = variants.findByProductIdAndVariantKey(p.getId(), key).orElseGet(CatalogVariant::new);
        cv.setProductId(p.getId());
        cv.setVariantKey(key);
        cv.setColor(v.color() == null ? norm.color(v.colorName()).orElse(null) : norm.color(v.color()).orElse(null));
        cv.setColorName(blankToNull(v.colorName()));
        cv.setVariantCode(blankToNull(v.code()));
        cv.setSku(blankToNull(v.sku()));
        cv.setGtin(blankToNull(v.gtin()));
        variants.save(cv);
    }

    /** Só URLs https; REFERENCE_ONLY a menos que a fonte oficial permita guardar cópia. */
    private boolean upsertImage(CatalogProduct p, ImageInput img, boolean primary, CatalogSourceType sourceType, UUID brandId) {
        if (img == null || img.url() == null || !img.url().startsWith("https://")) {
            return false;
        }
        String hash = Hashing.sha256(img.url().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        CatalogImage ci = images.findByProductIdAndImageUrlHash(p.getId(), hash).orElseGet(CatalogImage::new);
        boolean isNew = ci.getId() == null;
        ci.setProductId(p.getId());
        ci.setImageUrl(img.url());
        ci.setImageUrlHash(hash);
        ci.setImageType(imageType(img.type()));
        String dom = CatalogNormalizer.domain(img.url());
        ci.setSourceDomain(dom);
        ci.setSourceUrl(p.getOfficialProductUrl());
        ci.setSourceType(sourceType);
        boolean persist = sources.findByBrandIdAndActiveTrue(brandId).stream()
                .anyMatch(s -> s.isAllowsImagePersistence() && CatalogNormalizer.sameSite(dom, s.getDomain()));
        ci.setUsageStatus(persist ? CatalogImageUsage.PERSISTED : CatalogImageUsage.REFERENCE_ONLY);
        if (isNew) {
            ci.setPrimary(primary);
            ci.setRetrievedAt(Instant.now());
        }
        ci.setLastVerifiedAt(Instant.now());
        images.save(ci);
        return isNew && primary;
    }

    /** Tipo da fonte: domínio oficial cadastrado → OFFICIAL_BRAND; senão o informado (MANUAL_ADMIN por padrão). */
    CatalogSourceType sourceType(String raw, UUID brandId, String domain) {
        if (domain != null) {
            for (CatalogSource s : sources.findByBrandIdAndActiveTrue(brandId)) {
                if (CatalogNormalizer.sameSite(domain, s.getDomain())) {
                    return s.getSourceType();
                }
            }
        }
        try {
            return raw == null ? CatalogSourceType.MANUAL_ADMIN : CatalogSourceType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return CatalogSourceType.MANUAL_ADMIN;
        }
    }

    /** Texto indexado (FULLTEXT): marca e apelidos, nome, modelo, cor, coleção, códigos e sinônimos da subcategoria. */
    String searchText(Brand brand, CatalogProduct p, List<String> aliases) {
        Set<String> parts = new LinkedHashSet<>();
        parts.add(brand.getName());
        brandAliases.findByBrandId(brand.getId()).forEach(a -> parts.add(a.getAlias()));
        parts.add(p.getProductName());
        add(parts, p.getModelName());
        add(parts, p.getColorName());
        add(parts, p.getColor());
        add(parts, p.getCollection());
        add(parts, p.getProductCode());
        add(parts, p.getSku());
        add(parts, p.getGtin());
        parts.add(p.getSubcategory().replace('_', ' '));
        parts.addAll(aliases);
        return CatalogNormalizer.key(String.join(" ", parts));
    }

    private static void add(Set<String> parts, String s) {
        if (s != null && !s.isBlank()) {
            parts.add(s);
        }
    }

    static CatalogImageType imageType(String raw) {
        try {
            return raw == null ? CatalogImageType.PACKSHOT : CatalogImageType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return CatalogImageType.OTHER;
        }
    }

    public static ProductInput fromMap(Map<String, Object> m) {
        List<ImageInput> imgs = new ArrayList<>();
        if (m.get("images") instanceof List<?> l) {
            for (Object o : l) {
                if (o instanceof Map<?, ?> im) {
                    imgs.add(new ImageInput(str(im.get("url")), str(im.get("type"))));
                }
            }
        }
        if (m.get("primary_image_url") instanceof String s && !s.isBlank()) {
            imgs.add(0, new ImageInput(s, "PACKSHOT"));
        }
        return new ProductInput(str(m.get("brand")), str(m.get("category")), str(m.get("subcategory")), str(m.get("product_name")),
                str(m.get("model_name")), str(m.get("product_code")), str(m.get("sku")), str(m.get("gtin")), str(m.get("ean")),
                str(m.get("upc")), str(m.get("color")), str(m.get("color_name")), str(m.get("material")), str(m.get("collection")),
                str(m.get("gender")), str(m.get("official_product_url")), str(m.get("source_type")), imgs,
                m.get("aliases") instanceof List<?> a ? a.stream().map(String::valueOf).toList() : List.of(), List.of());
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (notBlank(v)) {
                return v;
            }
        }
        return "";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String blankToNull(String s) {
        return notBlank(s) ? s.trim() : null;
    }

    /** Mantido para o mapa de proveniência nas respostas. */
    static Map<String, Object> provenance(CatalogImage i) {
        return Map.of("sourceType", i.getSourceType().name(), "sourceDomain", String.valueOf(i.getSourceDomain()),
                "productUrl", String.valueOf(i.getSourceUrl()), "imageUrl", i.getImageUrl(),
                "retrievedAt", String.valueOf(i.getRetrievedAt()), "lastVerifiedAt", String.valueOf(i.getLastVerifiedAt()),
                "usage", i.getUsageStatus().name());
    }
}

package br.com.fashionai.application.demand;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.PhysicalStoreReturnEvents;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.PhysicalStoreVariant;
import br.com.fashionai.domain.model.RetailDemandEvent;
import br.com.fashionai.domain.model.UserConsent;
import br.com.fashionai.domain.model.enums.ConsentPurpose;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.PhysicalStoreVariantRepository;
import br.com.fashionai.domain.repository.RetailDemandEventRepository;
import br.com.fashionai.domain.repository.UserConsentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * RF-PESQ-10 — painel de demanda agregado e consentido. Só grava eventos de quem consentiu a finalidade
 * RETAIL_DEMAND_ANALYTICS; guarda um HMAC do contribuinte (sem id, foto, medida ou histórico); a marca vê apenas o
 * próprio catálogo, com limiar de publicação, supressão complementar e metadados de período, amostra e atraso.
 */
@Service
@Transactional
public class RetailDemandService {
    public static final Set<String> KINDS = Set.of("INTEREST", "UNAVAILABLE", "SIZE_MISMATCH");
    public record EventCmd(UUID productId, UUID variantId, String sizeLabel, String kind) { }

    private final RetailDemandEventRepository events;
    private final UserConsentRepository consents;
    private final CatalogProductRepository products;
    private final PhysicalStoreVariantRepository variants;
    private final BrandRepository brands;
    private final Guard guard;
    private final int threshold;
    private final byte[] secret;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public RetailDemandService(RetailDemandEventRepository events, UserConsentRepository consents, CatalogProductRepository products,
                               PhysicalStoreVariantRepository variants, BrandRepository brands, Guard guard,
                               @Value("${fashionai.demand.min-cell:5}") int threshold, @Value("${fashionai.demand.hash-secret:fai-demand-v1}") String secret) {
        this(events, consents, products, variants, brands, guard, threshold, secret, Clock.systemUTC());
    }

    RetailDemandService(RetailDemandEventRepository events, UserConsentRepository consents, CatalogProductRepository products,
                        PhysicalStoreVariantRepository variants, BrandRepository brands, Guard guard, int threshold, String secret, Clock clock) {
        this.events = events; this.consents = consents; this.products = products; this.variants = variants; this.brands = brands;
        this.guard = guard; this.threshold = Math.max(2, threshold); this.secret = secret.getBytes(StandardCharsets.UTF_8); this.clock = clock;
    }

    /** CA1 — sem consentimento nada é gravado e a resposta diz isso; nenhuma função depende deste registro. */
    public Map<String, Object> record(CurrentUser user, EventCmd cmd) {
        guard.requireCanCreate(user);
        if (cmd == null || cmd.productId() == null || cmd.kind() == null || !KINDS.contains(cmd.kind())) throw ApiException.badRequest("DEMAND_INVALID", "Informe produto e tipo de evento.");
        if (!consented(user.id())) return Map.of("recorded", false, "reason", "NO_CONSENT", "purpose", ConsentPurpose.RETAIL_DEMAND_ANALYTICS.name());
        CatalogProduct product = products.findById(cmd.productId()).orElseThrow(() -> ApiException.notFound("Produto"));
        if (product.getBrandId() == null) return Map.of("recorded", false, "reason", "NO_BRAND");
        PhysicalStoreVariant variant = cmd.variantId() == null ? null : variants.findById(cmd.variantId()).filter(v -> true).orElse(null);
        boolean stored = store(user.id(), product, cmd.variantId(), variant == null ? null : variant.getColorName(), variant == null ? cmd.sizeLabel() : variant.getSizeLabel(), cmd.kind());
        return Map.of("recorded", stored, "kind", cmd.kind(), "identityStored", false);
    }

    /** Motivo de caimento da devolução (RF-PESQ-02) entra só se a pessoa consentiu a finalidade analítica. */
    @EventListener
    public void onFitFeedback(PhysicalStoreReturnEvents.FitFeedbackRecorded feedback) {
        if (!consented(feedback.contributorId())) return;
        products.findById(feedback.productId()).ifPresent(p -> { if (p.getBrandId() != null) store(feedback.contributorId(), p, feedback.variantId(), null, feedback.sizeLabel(), "SIZE_MISMATCH"); });
    }

    private boolean store(UUID userId, CatalogProduct product, UUID variantId, String color, String size, String kind) {
        String hash = hash(userId);
        LocalDate day = LocalDate.now(clock);
        if (events.findByContributorHashAndProductIdAndKindAndBucketDay(hash, product.getId(), kind, day).isPresent()) return false;
        RetailDemandEvent e = new RetailDemandEvent();
        e.setBrandId(product.getBrandId()); e.setProductId(product.getId()); e.setVariantId(variantId); e.setColorName(color); e.setSizeLabel(size);
        e.setKind(kind); e.setBucketDay(day); e.setContributorHash(hash); e.setConsentVersion("DEMAND_V1");
        events.save(e);
        return true;
    }

    /** CA1 — revogação: apaga as contribuições; o painel também ignora quem revogou mesmo antes da limpeza. */
    public Map<String, Object> purgeContributions(UUID userId) {
        List<RetailDemandEvent> mine = events.findByContributorHash(hash(userId));
        events.deleteAll(mine);
        return Map.of("deleted", mine.size());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> myStatus(CurrentUser user) {
        guard.requireCanCreate(user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("purpose", ConsentPurpose.RETAIL_DEMAND_ANALYTICS.name());
        out.put("granted", consented(user.id()));
        out.put("contributions", events.countByContributorHash(hash(user.id())));
        out.put("identityStored", false);
        return out;
    }

    /** CA2–CA5 — a marca vê só o próprio catálogo, agregado, com limiar e metadados; nunca indivíduos. */
    @Transactional(readOnly = true)
    public Map<String, Object> panel(CurrentUser seller, LocalDate from, LocalDate to) {
        guard.requireApprovedInstitutional(seller, "retail-demand", "Only approved brands read the demand panel.");
        UUID brandId = brands.findByBrandProfile_Owner_Id(seller.id()).map(b -> b.getId()).orElseThrow(() -> ApiException.forbidden("Conta sem marca associada."));
        LocalDate today = LocalDate.now(clock);
        LocalDate end = to == null || to.isAfter(today.minusDays(1)) ? today.minusDays(1) : to;
        LocalDate start = from == null ? end.minusDays(29) : from;
        if (start.isAfter(end)) throw ApiException.badRequest("DEMAND_PERIOD", "Período inválido.");
        Set<String> revoked = new java.util.HashSet<>();
        for (UserConsent c : consents.findByPurposeAndGrantedFalse(ConsentPurpose.RETAIL_DEMAND_ANALYTICS)) revoked.add(hash(c.getUser().getId()));
        List<RetailDemandEvent> rows = events.findByBrandIdAndBucketDayBetween(brandId, start, end).stream().filter(e -> !revoked.contains(e.getContributorHash())).toList();
        DemandAggregation.Result result = DemandAggregation.aggregate(rows, threshold);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("brandId", brandId);
        out.put("period", Map.of("from", start, "to", end));
        out.put("delayDays", 1);
        out.put("threshold", threshold);
        out.put("sampleSize", result.sampleSize());
        out.put("contributors", result.contributors());
        out.put("suppressedCells", result.suppressedCells());
        out.put("cells", result.cells().stream().map(c -> cell(c)).toList());
        out.put("semantics", Map.of("INTEREST", "interest_not_intent", "UNAVAILABLE", "wanted_size_or_color_missing", "SIZE_MISMATCH", "returned_for_fit"));
        out.put("notice", "AGGREGATED_CONSENTED_NOT_A_FORECAST");
        out.put("scope", "OWN_CATALOG_ONLY");
        return out;
    }

    private Map<String, Object> cell(DemandAggregation.Cell c) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("productId", c.productId());
        out.put("productName", products.findById(c.productId()).map(CatalogProduct::getProductName).orElse(null));
        out.put("colorName", c.colorName());
        out.put("sizeLabel", c.sizeLabel());
        out.put("kind", c.kind());
        out.put("events", c.events());
        out.put("contributors", c.contributors());
        return out;
    }

    private boolean consented(UUID userId) {
        return consents.findByUserIdAndPurpose(userId, ConsentPurpose.RETAIL_DEMAND_ANALYTICS).map(UserConsent::isGranted).orElse(false);
    }

    String hash(UUID userId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(userId.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException(ex);
        }
    }
}

package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeCache;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.seal.SealDesigns;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.domain.model.TaxonomyAttribute;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.PromotionRedemption;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.RedemptionStatus;
import br.com.fashionai.domain.model.enums.SealBondBasis;
import br.com.fashionai.domain.model.enums.SealBondOrigin;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * RF20 / RF21 (docs/rf20-rf21-vinculo-marca-celebridade.md, CA01–CA23), RF25 (selos de marca/celebridade com
 * arte de background) e RNF12 (promoções só para selos ativos e disponíveis). Mecanismo: a IA sugere até 3
 * vínculos na criação do look → o usuário aceita, edita ou recusa → pendente → auto-aprovado se o perfil não
 * exigir revisão (celebridade SEMPRE exige — CA19) → selo emitido (tier PEÇA ou LOOK) → promoções.
 */
@Service
public class SealService {
    private br.com.fashionai.domain.repository.AiInferenceLogRepository sealInferenceLogs;
    private br.com.fashionai.domain.repository.BrandRepository sealBrands;
    private BackgroundStudioService sealBackgrounds;

    @org.springframework.beans.factory.annotation.Autowired
    public void setSealPolicyContext(br.com.fashionai.domain.repository.AiInferenceLogRepository logs,
                                     br.com.fashionai.domain.repository.BrandRepository brands, BackgroundStudioService backgrounds) {
        this.sealInferenceLogs = logs; this.sealBrands = brands; this.sealBackgrounds = backgrounds;
    }
    public static final int MAX_SUGGESTIONS = 3;
    public static final Duration DEFAULT_SEAL_VALIDITY = Duration.ofDays(365);
    private static final Set<SealBondStatus> OPEN = Set.of(SealBondStatus.SUGGESTED, SealBondStatus.ACCEPTED,
            SealBondStatus.EDITED, SealBondStatus.PENDING_REVIEW, SealBondStatus.APPROVED);

    private final SealRepository seals;
    private final SealBondRepository bonds;
    private final PromotionRepository promotions;
    private final PromotionRedemptionRepository redemptions;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final BrandProfileRepository brandProfiles;
    private final CelebrityProfileRepository celebrityProfiles;
    private final UserRepository users;
    private final WardrobeItemRepository wardrobeItems;
    private final NotificationService notifications;
    private final AiEngine ai;
    private final Guard guard;
    private final Audit audit;
    private final ApplicationEventPublisher events;
    private final OwnMedia ownMedia;

    public SealService(SealRepository seals, SealBondRepository bonds, PromotionRepository promotions,
                       PromotionRedemptionRepository redemptions, SchemeRepository schemes, SchemeItemRepository schemeItems,
                       BrandProfileRepository brandProfiles, CelebrityProfileRepository celebrityProfiles,
                       UserRepository users, WardrobeItemRepository wardrobeItems, NotificationService notifications, AiEngine ai,
                       Guard guard, Audit audit, ApplicationEventPublisher events, OwnMedia ownMedia) {
        this.events = events;
        this.ownMedia = ownMedia;
        this.wardrobeItems = wardrobeItems;
        this.seals = seals;
        this.bonds = bonds;
        this.promotions = promotions;
        this.redemptions = redemptions;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.brandProfiles = brandProfiles;
        this.celebrityProfiles = celebrityProfiles;
        this.users = users;
        this.notifications = notifications;
        this.ai = ai;
        this.guard = guard;
        this.audit = audit;
    }

    // ================================================================== RF53 — Hype (opcional)
    /**
     * HypeScore v2 atual para os critérios de Hype das políticas, a ordem das sugestões e o "Hype do selo". Injetado por
     * setter (o construtor de 16 argumentos continua valendo): sem ele, critério de Hype é "não atendido" e o selo não
     * tem média. {@link ObjectProvider} porque o HypeQueryService depende do SchemeService, que depende deste serviço.
     */
    private ObjectProvider<HypeQueryService> hypeQuery;
    private HypeCache hypeCache;

    @Autowired(required = false)
    public void setHypeQuery(ObjectProvider<HypeQueryService> hypeQuery) {
        this.hypeQuery = hypeQuery;
    }

    @Autowired(required = false)
    public void setHypeCache(HypeCache hypeCache) {
        this.hypeCache = hypeCache;
    }

    private HypeQueryService hype() {
        return hypeQuery == null ? null : hypeQuery.getIfAvailable();
    }

    /**
     * Hype atual (em lote, pelo {@link HypeQueryService#currentOf}) das peças avaliadas e do look já salvo; look ainda não
     * salvo ({@code schemeId} nulo) não tem Hype. Sem o serviço de Hype: {@link SealPolicies.HypeLookup#NONE}.
     */
    SealPolicies.HypeLookup hypeLookup(Collection<UUID> pieceIds, UUID schemeId) {
        HypeQueryService q = hype();
        List<UUID> ids = pieceIds == null ? List.of() : pieceIds.stream().filter(Objects::nonNull).distinct().toList();
        Map<UUID, HypeScoreCurrent> pieces = q == null || ids.isEmpty() ? Map.of() : q.currentOf(HypeEntityType.PIECE, ids);
        HypeScoreCurrent look = q == null || schemeId == null ? null : q.currentOf(HypeEntityType.SCHEME, List.of(schemeId)).get(schemeId);
        SealPolicies.HypeLookup scores = SealPolicies.HypeLookup.of(pieces, look);
        return new SealPolicies.HypeLookup() {
            private List<SealBond> earned;
            public SealPolicies.HypeFact piece(UUID id) { return scores.piece(id); }
            public SealPolicies.HypeFact look() { return scores.look(); }
            public long earnedSealCount(UUID sealId, String scope, List<UUID> selectedPieces) {
                if (earned == null) {
                    Map<UUID, SealBond> rows = new LinkedHashMap<>();
                    if (schemeId != null) bonds.findBySchemeId(schemeId).forEach(b -> rows.put(b.getId(), b));
                    wardrobeItems.findByIdIn(ids).stream().filter(w -> w.getUser() != null).map(w -> w.getUser().getId()).distinct()
                            .forEach(owner -> bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(owner, SealBondStatus.APPROVED)
                                    .forEach(b -> rows.put(b.getId(), b)));
                    Instant now = Instant.now();
                    earned = rows.values().stream().filter(b -> b.getStatus() == SealBondStatus.APPROVED && b.getSeal() != null
                            && (b.getExpiresAt() == null || b.getExpiresAt().isAfter(now)) && b.getScheme() != null
                            && !b.getScheme().isRevalidationPending()).toList();
                }
                Set<String> matched = new HashSet<>();
                for (SealBond b : earned) {
                    if (!sealId.equals(b.getSeal().getId())) continue;
                    if (!"PIECES".equals(scope) && b.getTier() == SealTier.LOOK && schemeId != null && schemeId.equals(b.getScheme().getId()))
                        matched.add("LOOK:" + schemeId);
                    if (!"LOOK".equals(scope) && b.getTier() == SealTier.PECA) {
                        Set<String> linked = new HashSet<>(Json.strings(b.getLinkedPieceIdsJson()));
                        selectedPieces.stream().filter(id -> linked.contains(id.toString())).forEach(id -> matched.add("PECA:" + id));
                    }
                }
                return matched.size();
            }
        };
    }

    private SealPolicies.HypeLookup hypeLookup(Scheme scheme, List<SchemeItem> items) {
        return hypeLookup(items.stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).map(WardrobeItem::getId).toList(),
                scheme == null ? null : scheme.getId());
    }

    /**
     * Hype da entidade avaliada pela sugestão: tier LOOK → o Hype do look; tier PEÇA → o maior Hype entre as peças
     * vinculadas. Nulo quando não há Hype disponível.
     */
    static SealPolicies.HypeFact candidateHype(Candidate c, SealPolicies.HypeLookup hype) {
        if (hype == null) {
            return null;
        }
        if (c.tier() == SealTier.LOOK) {
            SealPolicies.HypeFact f = hype.look();
            return f != null && f.available() ? f : null;
        }
        return (c.linkedPieceIds() == null ? List.<UUID>of() : c.linkedPieceIds()).stream().map(hype::piece)
                .filter(f -> f != null && f.available() && f.score() != null)
                .max(Comparator.comparingDouble(SealPolicies.HypeFact::score)).orElse(null);
    }

    /** RF53 — sugestões por Hype desc (sem Hype por último); a ordenação é estável: empate mantém a ordem atual. */
    static List<Candidate> byHype(List<Candidate> list, SealPolicies.HypeLookup hype) {
        List<Candidate> out = new ArrayList<>(list);
        Map<Candidate, Double> score = new HashMap<>();
        out.forEach(c -> {
            SealPolicies.HypeFact f = candidateHype(c, hype);
            score.put(c, f == null ? null : f.score());
        });
        out.sort(Comparator.comparing(score::get, Comparator.nullsLast(Comparator.<Double>reverseOrder())));
        return out;
    }

    private static Map<String, Object> hypeView(Candidate c, SealPolicies.HypeLookup hype) {
        SealPolicies.HypeFact f = candidateHype(c, hype);
        return f == null ? null : f.view();
    }

    /** PERFIL publica conteúdo elegível na vitrine; não cria vínculos nem selos conquistados. */
    boolean hasProfilePolicies(UUID ownerId) { return !profilePolicies(ownerId).isEmpty(); }

    private List<SealPolicies.Policy> profilePolicies(UUID ownerId) {
        Instant now = Instant.now();
        return seals.findByOwnerIdAndStatusOrderByCreatedAtDesc(ownerId, SealStatus.ACTIVE).stream()
                .filter(s -> s.getTier() == SealTier.PERFIL && available(s, now) && issuer(s.getOwner()) != null)
                .map(s -> SealPolicies.parse(Json.map(s.getBackgroundConfigJson()).get("policy")))
                .filter(p -> p != null && p.referenceModel() != null).toList();
    }

    private boolean profileMatch(List<SealPolicies.Policy> policies, SealTier subject, List<WardrobeItem> items, Scheme scheme) {
        if (items.isEmpty()) return false;
        List<String> occ = Json.csv(scheme == null ? items.get(0).getOccasionTags() : scheme.getOccasion());
        List<String> sty = Json.csv(scheme == null ? items.get(0).getStyleTags() : scheme.getStyle());
        SealPolicies.HypeLookup facts = hypeLookup(items.stream().map(WardrobeItem::getId).toList(), scheme == null ? null : scheme.getId());
        return policies.stream().anyMatch(p -> SealPolicies.evaluate(p, subject, items, occ, sty, facts,
                scheme == null ? Map.of() : referenceBackground(scheme)).matched());
    }

    List<Scheme> profileSchemes(UUID ownerId, Predicate<Scheme> visible, int limit) {
        List<SealPolicies.Policy> policies = profilePolicies(ownerId).stream().filter(p -> Set.of("LOOK", "BOTH").contains(p.referenceModel().get("target"))).toList();
        if (policies.isEmpty()) return List.of();
        List<Scheme> out = new ArrayList<>();
        for (int page = 0; ; page++) {
            List<Scheme> rows = schemes.findAllPublic(org.springframework.data.domain.PageRequest.of(page, 100,
                    org.springframework.data.domain.Sort.by("createdAt").descending()));
            for (Scheme scheme : rows) {
                if (!visible.test(scheme) || scheme.isRevalidationPending()) continue;
                List<WardrobeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(scheme.getId()).stream()
                        .map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).toList();
                if (profileMatch(policies, SealTier.LOOK, items, scheme)) out.add(scheme);
                if (out.size() >= limit) return out;
            }
            if (rows.size() < 100) return out;
        }
    }

    List<WardrobeItem> profilePieces(UUID ownerId, Predicate<WardrobeItem> visible, int limit) {
        List<SealPolicies.Policy> policies = profilePolicies(ownerId).stream().filter(p -> Set.of("PECA", "BOTH").contains(p.referenceModel().get("target"))).toList();
        if (policies.isEmpty()) return List.of();
        List<WardrobeItem> out = new ArrayList<>();
        for (int page = 0; ; page++) {
            List<WardrobeItem> rows = wardrobeItems.findAllPublic(org.springframework.data.domain.PageRequest.of(page, 100,
                    org.springframework.data.domain.Sort.by("createdAt").descending()));
            for (WardrobeItem piece : rows) {
                if (visible.test(piece) && profileMatch(policies, SealTier.PECA, List.of(piece), null)) out.add(piece);
                if (out.size() >= limit) return out;
            }
            if (rows.size() < 100) return out;
        }
    }

    // ================================================================== RF25 — selos do perfil emissor
    public record SealForm(String name, SealTier tier, String policyText, String iconUrl, Map<String, Object> background,
                           Instant availableFrom, Instant availableUntil, Integer usageLimit, SealStatus status,
                           Map<String, Object> design, Map<String, Object> policy) {
    }

    @Transactional
    public Map<String, Object> createSeal(CurrentUser user, SealForm form) {
        requireIssuer(user);
        User owner = users.findById(user.id()).orElseThrow();
        Seal s = new Seal();
        s.setOwner(owner);
        applySeal(s, form, owner);
        seals.save(s);
        audit.log(user, AuditActions.SELO_EDITADO, "seal:" + s.getId(), Map.of("op", "create"));
        return sealViews(List.of(s)).get(0);
    }

    /**
     * RF25 — Copilot especializado: interpreta o pedido e cria o modelo de referência da política.
     * A inferência é auditada; o selo só é publicado na etapa final.
     */
    @Transactional
    public Map<String, Object> draft(CurrentUser user, SealTier tier) {
        return draft(user, tier, null, null);
    }

    @Transactional
    public Map<String, Object> draft(CurrentUser user, SealTier tier, String message, Map<String, Object> previousPolicy) {
        requireIssuer(user);
        String prompt = InputSanitizer.required("message", message, 1, 6000);
        if (!SealPolicyCopilot.tagged(prompt) || prompt.trim().equalsIgnoreCase(SealPolicyCopilot.TAG)) {
            throw ApiException.badRequest("PEDIDO_SELO_INVALIDO", Msg.t("sealCopilot.use_tag"));
        }
        User owner = users.findById(user.id()).orElseThrow();
        boolean celebrity = owner.getProfileType() == ProfileType.CELEBRIDADE;
        String name = celebrity
                ? celebrityProfiles.findByOwnerId(owner.getId()).map(cp -> cp.getStageName()).orElse(owner.getDisplayName())
                : brandProfiles.findByOwnerId(owner.getId()).map(bp -> bp.getBrandName()).orElse(owner.getDisplayName());
        List<WardrobeItem> pieces = wardrobeItems.findByUserIdOrderByCreatedAtDesc(owner.getId());
        List<Map<String, Object>> examples = pieces.stream().limit(40).map(w -> {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("name", w.getName()); e.put("category", w.getCategory()); e.put("subcategory", w.getSubcategory());
            e.put("brand", w.getBrandName()); e.put("color", w.getColor()); e.put("material", w.getMaterial());
            e.put("variation", w.getVariationCode()); e.put("attributes", TaxonomyAttribute.toMap(w.getAttributes(), Set.of()));
            e.put("background", Json.map(w.getBackgroundConfigJson()));
            return e;
        }).toList();
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("issuer", name); context.put("celebrity", celebrity); context.put("tier", tier);
        context.put("pieces", examples); context.put("previousPolicy", previousPolicy);
        context.put("categories", Taxonomy.SUBCATEGORIES); context.put("colors", Taxonomy.COLOR_FAMILY);
        context.put("subcategories", TaxonomyRegistry.get().activeSubcategories().values().stream().flatMap(Collection::stream)
                .map(code -> TaxonomyRegistry.get().subcategory(code).orElseThrow()).toList());
        List<String> brandNames = new ArrayList<>(List.of(name));
        if (sealBrands != null) sealBrands.findAllByOrderByName().forEach(b -> brandNames.add(b.getName()));
        context.put("brands", brandNames);
        if (sealBackgrounds != null) context.put("backgroundCatalog", sealBackgrounds.catalog());
        context.put("dimensions", TaxonomyRegistry.get().dimensions()); context.put("sizes", Taxonomy.SIZES);
        context.put("sexes", Taxonomy.SEXES); context.put("occasions", Taxonomy.OCCASIONS); context.put("styles", Taxonomy.STYLES);
        context.put("sealDesignCatalog", SealDesigns.catalog());
        List<Seal> knownSeals = seals.findByStatus(SealStatus.ACTIVE).stream().filter(s -> s.getTier() != SealTier.PERFIL && issuer(s.getOwner()) != null).toList();
        context.put("earnedSealCatalog", knownSeals.stream().map(s -> Map.of("id", s.getId(), "name", s.getName(), "tier", s.getTier(), "issuer", s.getOwner().getUsername())).toList());

        List<String> inputs = new ArrayList<>(List.of("#createsealpolicy", "issuer catalog", "taxonomy", "reference model"));
        AiOutcome<Map<String, Object>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.COPILOT,
                SealPolicyCopilot.SYSTEM, Json.write(Map.of("request", prompt, "context", context)), List.of(), 6000,
                inputs, response -> {
                    Map<String, Object> parsed = SealPolicyCopilot.parse(response);
                    if (parsed != null && "VALID".equals(parsed.get("status"))) {
                        if (tier != null && !tier.name().equals(parsed.get("tier"))) return null;
                        Map<String, Object> policy = castMap((Map<?, ?>) parsed.get("policy"));
                        Map<?, ?> model = (Map<?, ?>) policy.get("referenceModel");
                        for (Object part : (List<?>) model.get("pieces")) {
                            Object brand = ((Map<?, ?>) part).get("brand");
                            if (brand != null && brandNames.stream().noneMatch(b -> LocalAdvisors.normalize(b).equals(LocalAdvisors.normalize(String.valueOf(brand))))) {
                                return new LinkedHashMap<>(Map.of("status", "INCOMPLETE", "questions", List.of(Msg.t("sealCopilot.marca_nao_encontrada", brand)), "reasons", List.of(), "sources", List.of()));
                            }
                        }
                        if (model.get("earnedSeals") instanceof Map<?, ?> earned) {
                            for (Object item : (List<?>) earned.get("rules")) {
                                String id = String.valueOf(((Map<?, ?>) item).get("sealId"));
                                if (knownSeals.stream().noneMatch(s -> s.getId().toString().equals(id))) return new LinkedHashMap<>(Map.of(
                                        "status", "INCOMPLETE", "questions", List.of(Msg.t("sealCopilot.selo_nao_encontrado")), "reasons", List.of(), "sources", List.of()));
                                @SuppressWarnings("unchecked") Map<String, Object> rule = (Map<String, Object>) item;
                                rule.put("name", knownSeals.stream().filter(s -> s.getId().toString().equals(id)).findFirst().orElseThrow().getName());
                            }
                        }
                        // O motor registra este digest junto da inferência bem-sucedida; publicar exige o mesmo objeto.
                        inputs.add(SealPolicyCopilot.fingerprint(policy));
                    }
                    return parsed;
                },
                () -> null, null));
        if (outcome.value() == null || outcome.fallbackUsed()) {
            throw new ApiException(503, "IA_INDISPONIVEL", outcome.userMessage() == null ? Msg.t("sealCopilot.ia_indisponivel") : outcome.userMessage());
        }
        Map<String, Object> out = new LinkedHashMap<>(outcome.value());
        if ("VALID".equals(out.get("status"))) {
            Map<String, Object> policy = castMap((Map<?, ?>) out.get("policy"));
            policy.put("aiInferenceId", String.valueOf(outcome.inferenceId()));
            out.put("policy", policy);
        }
        out.put("inferenceId", outcome.inferenceId()); out.put("intent", "SEAL_POLICY");
        out.put("text", "VALID".equals(out.get("status")) ? Msg.t("sealCopilot.modelo_pronto") : String.join(" ", (List<String>) out.get("questions")));
        audit.log(user, AuditActions.SELO_EDITADO, "seal:draft", Map.of("op", "#createsealpolicy", "pieces", examples.size()));
        return out;
    }

    @Transactional
    public Map<String, Object> updateSeal(CurrentUser user, UUID sealId, SealForm form) {
        requireIssuer(user);
        Seal s = seals.findById(sealId).orElseThrow(() -> ApiException.notFound("Selo"));
        guard.requireOwner(user, s.getOwner().getId(), "seal:" + sealId);
        applySeal(s, form, s.getOwner());
        audit.log(user, AuditActions.SELO_EDITADO, "seal:" + s.getId(), Map.of("op", "update"));
        return sealViews(List.of(s)).get(0);
    }

    private void applySeal(Seal s, SealForm f, User owner) {
        s.setName(InputSanitizer.required("name", f.name(), 2, 160));
        s.setTier(f.tier() == null ? SealTier.LOOK : f.tier());
        // RF25 — política padronizada (regras avaliadas pelo sistema); o texto do card é gerado a partir delas. Sem regras,
        // vale o texto antigo (selos criados antes das regras continuam com a descrição que tinham).
        Map<String, Object> policy = SealPolicies.normalize(f.policy());
        Object oldPolicy = Json.map(s.getBackgroundConfigJson()).get("policy");
        boolean hasReference = policy != null && policy.get("referenceModel") instanceof Map<?, ?>;
        if ((s.getId() == null || oldPolicy instanceof Map<?, ?> op && op.containsKey("referenceModel")) && !hasReference) {
            throw ApiException.badRequest("POLITICA_IA_OBRIGATORIA", Msg.t("sealCopilot.politica_obrigatoria"));
        }
        if (hasReference && !s.getTier().name().equals(((Map<?, ?>) policy.get("referenceModel")).get("tier"))) {
            throw ApiException.badRequest("MODELO_SELO_INVALIDO", Msg.t("sealCopilot.modelo_invalido"));
        }
        if (hasReference && (!(oldPolicy instanceof Map<?, ?> old)
                || !SealPolicyCopilot.fingerprint(policy).equals(SealPolicyCopilot.fingerprint(castMap(old))))) {
            requireGeneratedPolicy(owner.getId(), f.policy(), policy);
        }
        SealPolicies.Policy parsed = SealPolicies.parse(policy);
        s.setPolicyText(parsed != null ? InputSanitizer.clean(SealPolicies.describe(parsed, s.getTier()), 2048)
                : f.policy() != null ? null : InputSanitizer.clean(f.policyText(), 2048));
        // RF25 — desenho do medalhão (validado contra o catálogo) guardado junto da arte de fundo do selo.
        Map<String, Object> design = SealDesigns.normalize(f.design());
        if (design == null) {
            Object existing = Json.map(s.getBackgroundConfigJson()).get("design");
            design = existing instanceof Map<?, ?> em ? SealDesigns.normalize(castMap(em))
                    : SealDesigns.defaultDesign(owner.getProfileType() == ProfileType.CELEBRIDADE, s.getTier());
        }
        // imagem do núcleo/emblema: só arquivo enviado pelo próprio emissor (nunca de outra pessoa ou de terceiros)
        if (design.get("core") instanceof Map<?, ?> core && core.get("imageUrl") != null) {
            ownMedia.require(owner.getId(), String.valueOf(core.get("imageUrl")), "design.core.imageUrl", false);
        }
        if ("FOLHA".equals(design.get("kind")) && design.get("label") == null) {
            design.put("label", SealDesigns.labelFrom(s.getName()));            // o título da folha é o nome do selo
        }
        Map<String, Object> cfg = new LinkedHashMap<>(f.background() == null ? Map.of() : f.background());
        cfg.put("design", design);
        if (policy != null) {
            cfg.put("policy", policy);
        } else if (f.policy() == null) {
            Object old = Json.map(s.getBackgroundConfigJson()).get("policy");      // edição antiga sem o campo: mantém
            if (old != null) {
                cfg.put("policy", old);
            }
        }
        s.setBackgroundConfigJson(Json.write(cfg));
        // ícone: arquivo enviado pelo próprio emissor (ou do catálogo do sistema) — nunca de outra pessoa, restricted/ ou terceiros
        s.setIconUrl("UPLOAD".equals(design.get("mode"))
                ? ownMedia.requireOrUnchanged(owner.getId(), String.valueOf(design.get("uploadUrl")), "design.uploadUrl", false, s.getIconUrl())
                : ownMedia.requireOrUnchanged(owner.getId(), f.iconUrl(), "iconUrl", true, s.getIconUrl()));
        if (f.availableFrom() != null && f.availableUntil() != null && f.availableUntil().isBefore(f.availableFrom())) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("common.a_disponibilidade_termina_antes_de"));
        }
        s.setAvailableFrom(f.availableFrom());
        s.setAvailableUntil(f.availableUntil());
        if (f.usageLimit() != null && f.usageLimit() < 1) {
            throw ApiException.badRequest("LIMITE_INVALIDO", Msg.t("seal.o_limite_de_emissao_precisa"));
        }
        s.setUsageLimit(f.usageLimit());
        s.setStatus(f.status() == null ? SealStatus.ACTIVE : f.status());
        // RF21.CA20 — selo de celebridade é Premium (vítreo/holográfico); de marca é têxtil/dourado.
        s.setPremium(owner.getProfileType() == ProfileType.CELEBRIDADE);
    }

    /** Todos os selos do emissor (aba do próprio dono). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> sealsOf(UUID ownerId) {
        return sealViews(seals.findByOwnerIdOrderByCreatedAtDesc(ownerId));
    }

    /**
     * Selos de um perfil para quem visita: o dono (e o admin) vê todos; os demais só os ativos, e só de perfil emissor
     * aprovado e com conta ativa.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> sealsOf(CurrentUser viewer, UUID ownerId) {
        boolean privileged = viewer != null && (viewer.id().equals(ownerId) || viewer.admin());
        if (privileged) {
            return sealsOf(ownerId);
        }
        if (!users.findById(ownerId).map(FlairService::sellerActive).orElse(false)) {
            return List.of();
        }
        return sealViews(seals.findByOwnerIdOrderByCreatedAtDesc(ownerId).stream().filter(s -> s.getStatus() == SealStatus.ACTIVE).toList());
    }

    /** Views dos selos com o "Hype do selo" (RF53), calculado em lote. */
    List<Map<String, Object>> sealViews(List<Seal> list) {
        Map<UUID, Map<String, Object>> hype = sealHype(list);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Seal s : list) {
            Map<String, Object> v = sealView(s);
            v.put("hype", hype.getOrDefault(s.getId(), emptySealHype()));
            out.add(v);
        }
        return out;
    }

    /**
     * RF53 — "Hype do selo": {@code {avgScore, level, bonded}} = média do HypeScore v2 atual dos itens com vínculo
     * APROVADO e vigente (selo de LOOK: os looks; selo de PEÇA: as peças vinculadas). {@code bonded} conta os itens
     * vinculados; a média usa só os públicos elegíveis com Hype disponível (o Hype de item privado é só do dono).
     * Cache pelo {@link HypeCache} (a geração muda a cada recálculo do Hype; o contador de emissões entra na chave).
     */
    Map<UUID, Map<String, Object>> sealHype(Collection<Seal> list) {
        List<Seal> distinct = list.stream().filter(Objects::nonNull).filter(s -> s.getId() != null).distinct().toList();
        if (distinct.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Map<String, Object>> out = new HashMap<>();
        Map<UUID, Map<String, Object>> batch = new HashMap<>();
        boolean[] loaded = {false};
        Supplier<Map<UUID, Map<String, Object>>> all = () -> {   // uma consulta para todos os selos, só se algum faltar no cache
            if (!loaded[0]) {
                batch.putAll(computeSealHype(distinct));
                loaded[0] = true;
            }
            return batch;
        };
        for (Seal s : distinct) {
            Supplier<Map<String, Object>> loader = () -> all.get().getOrDefault(s.getId(), emptySealHype());
            out.put(s.getId(), hypeCache == null ? loader.get()
                    : hypeCache.get("seal-hype:" + s.getId() + ":" + s.getTier() + ":" + s.getUsageCount(), loader));
        }
        return out;
    }

    private Map<UUID, Map<String, Object>> computeSealHype(List<Seal> list) {
        Map<UUID, Seal> byId = new HashMap<>();
        list.forEach(s -> byId.put(s.getId(), s));
        Instant now = Instant.now();
        Map<UUID, Set<UUID>> items = new HashMap<>();
        Set<UUID> looks = new HashSet<>();
        Set<UUID> pieces = new HashSet<>();
        for (SealBond b : bonds.findBySealIdInAndStatus(byId.keySet(), SealBondStatus.APPROVED)) {
            if (b.getSeal() == null || !byId.containsKey(b.getSeal().getId()) || (b.getExpiresAt() != null && b.getExpiresAt().isBefore(now))) {
                continue;
            }
            Set<UUID> set = items.computeIfAbsent(b.getSeal().getId(), k -> new LinkedHashSet<>());
            if (byId.get(b.getSeal().getId()).getTier() == SealTier.PECA) {
                for (String id : Json.strings(b.getLinkedPieceIdsJson())) {
                    UUID u = uuid(id);
                    if (u != null) {
                        set.add(u);
                        pieces.add(u);
                    }
                }
            } else if (b.getScheme() != null) {
                set.add(b.getScheme().getId());
                looks.add(b.getScheme().getId());
            }
        }
        HypeQueryService q = hype();
        Map<UUID, HypeScoreCurrent> lookHype = q == null || looks.isEmpty() ? Map.of() : q.currentOf(HypeEntityType.SCHEME, looks);
        Map<UUID, HypeScoreCurrent> pieceHype = q == null || pieces.isEmpty() ? Map.of() : q.currentOf(HypeEntityType.PIECE, pieces);
        Map<UUID, Map<String, Object>> out = new HashMap<>();
        for (Seal s : list) {
            Set<UUID> ids = items.getOrDefault(s.getId(), Set.of());
            Map<UUID, HypeScoreCurrent> rows = s.getTier() == SealTier.PECA ? pieceHype : lookHype;
            double[] scores = ids.stream().map(rows::get).filter(SealService::publicHype)
                    .mapToDouble(c -> c.getScore().doubleValue()).toArray();
            Map<String, Object> m = emptySealHype();
            if (scores.length > 0) {
                double avg = Math.round(java.util.Arrays.stream(scores).average().orElse(0) * 10) / 10.0;
                m.put("avgScore", avg);
                m.put("level", q.config().level(avg).name());
            }
            m.put("bonded", ids.size());
            out.put(s.getId(), m);
        }
        return out;
    }

    /** O Hype que entra num agregado de terceiros: disponível, com score e público elegível (o de item privado é só do dono). */
    static boolean publicHype(HypeScoreCurrent c) {
        return c != null && c.getStatus() == HypeStatus.AVAILABLE && c.isPublicEligible() && c.getScore() != null;
    }

    /** Quantos looks vinculados aparecem no "top" do Hype das métricas do emissor. */
    static final int ISSUER_HYPE_TOP = 3;

    /**
     * P2-09 — Hype dos looks vinculados nas métricas do emissor, com a régua do "Hype do selo" ({@link #computeSealHype}):
     * média do HypeScore v2 atual dos looks com vínculo APROVADO e vigente deste emissor, só os públicos elegíveis com Hype
     * disponível ({@link #publicHype}); {@code bonded} conta todos os looks vinculados. Também o Δ médio na janela do
     * delta (só quem tem base de comparação; sem base, nulo e sem seta) e os {@value #ISSUER_HYPE_TOP} de maior Hype.
     * Sem nenhum público com Hype: {@code avgScore}/{@code level} nulos — a interface diz "Dados insuficientes", nunca 0.
     * Só lê o estado gravado pelo job (GET nunca recalcula) e nada aqui vira sinal do Hype.
     */
    Map<String, Object> bondedHype(UUID issuerId) {
        Instant now = Instant.now();
        Map<UUID, Scheme> looks = new LinkedHashMap<>();
        for (SealBond b : bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(issuerId, SealBondStatus.APPROVED)) {
            if (b.getScheme() != null && b.getStatus() == SealBondStatus.APPROVED && (b.getExpiresAt() == null || b.getExpiresAt().isAfter(now))) {
                looks.putIfAbsent(b.getScheme().getId(), b.getScheme());
            }
        }
        HypeQueryService q = hype();
        Map<UUID, HypeScoreCurrent> rows = q == null || looks.isEmpty() ? Map.of() : q.currentOf(HypeEntityType.SCHEME, looks.keySet());
        List<HypeScoreCurrent> shown = looks.keySet().stream().map(rows::get).filter(SealService::publicHype).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("bonded", looks.size());
        m.put("withHype", shown.size());
        Double avg = shown.isEmpty() ? null : Math.round(shown.stream().mapToDouble(c -> c.getScore().doubleValue()).average().orElse(0) * 10) / 10.0;
        m.put("avgScore", avg);
        m.put("level", avg == null ? null : q.config().level(avg).name());
        List<HypeScoreCurrent> withDelta = shown.stream().filter(c -> c.getDeltaPoints() != null).toList();
        Double delta = withDelta.isEmpty() ? null : Math.round(withDelta.stream().mapToDouble(c -> c.getDeltaPoints().doubleValue()).average().orElse(0) * 10) / 10.0;
        m.put("deltaPoints", delta);
        m.put("direction", delta == null ? null : Math.abs(delta) < q.config().stablePoints() ? "STABLE" : delta > 0 ? "UP" : "DOWN");
        m.put("deltaWindowDays", q == null ? null : q.config().deltaWindowDays());
        m.put("top", shown.stream().sorted(Comparator.comparing(HypeScoreCurrent::getScore).reversed()
                        .thenComparing(c -> c.getEntityId().toString())).limit(ISSUER_HYPE_TOP)
                .map(c -> {
                    Map<String, Object> t = new LinkedHashMap<>();
                    Scheme s = looks.get(c.getEntityId());
                    t.put("schemeId", c.getEntityId().toString());
                    t.put("title", s == null ? null : s.getTitle());
                    double score = Math.round(c.getScore().doubleValue() * 10) / 10.0;
                    t.put("score", score);
                    t.put("level", q.config().level(score).name());
                    return t;
                }).toList());
        return m;
    }

    private static Map<String, Object> emptySealHype() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("avgScore", null);
        m.put("level", null);
        m.put("bonded", 0);
        return m;
    }

    private static UUID uuid(String raw) {
        try {
            return raw == null ? null : UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** RNF12 — um selo está disponível quando ativo, dentro da janela e abaixo do teto de emissão. */
    public static boolean available(Seal s, Instant now) {
        return s.getStatus() == SealStatus.ACTIVE
                && (s.getAvailableFrom() == null || !s.getAvailableFrom().isAfter(now))
                && (s.getAvailableUntil() == null || s.getAvailableUntil().isAfter(now))
                && (s.getUsageLimit() == null || s.getUsageCount() < s.getUsageLimit());
    }

    public static String unavailableReason(Seal s, Instant now) {
        if (s.getStatus() != SealStatus.ACTIVE) {
            return Msg.t("seal.o_selo_esta_inativo");
        }
        if (s.getAvailableFrom() != null && s.getAvailableFrom().isAfter(now)) {
            return Msg.t("seal.o_selo_so_fica_disponivel", s.getAvailableFrom());
        }
        if (s.getAvailableUntil() != null && !s.getAvailableUntil().isAfter(now)) {
            return Msg.t("seal.o_periodo_de_emissao_do");
        }
        if (s.getUsageLimit() != null && s.getUsageCount() >= s.getUsageLimit()) {
            return Msg.t("seal.a_campanha_atingiu_o_limite");
        }
        return null;
    }

    Map<String, Object> sealView(Seal s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("ownerId", s.getOwner().getId());
        m.put("owner", Views.user(s.getOwner()));
        m.put("name", s.getName());
        m.put("tier", s.getTier());
        m.put("kind", s.isPremium() ? "PREMIUM_SEAL" : "BRAND_SEAL");
        m.put("visualFamily", s.isPremium() ? "vitreo-holografico" : "textil-dourado");
        m.put("policyText", s.getPolicyText());
        m.put("iconUrl", s.getIconUrl());
        Map<String, Object> cfg = Json.map(s.getBackgroundConfigJson());
        Object design = cfg.remove("design");
        m.put("design", design instanceof Map<?, ?> dm ? dm : SealDesigns.defaultDesign(s.isPremium(), s.getTier()));
        m.put("policy", cfg.remove("policy"));
        m.put("background", cfg);
        m.put("status", s.getStatus());
        m.put("availableFrom", s.getAvailableFrom());
        m.put("availableUntil", s.getAvailableUntil());
        m.put("usageLimit", s.getUsageLimit());
        m.put("usageCount", s.getUsageCount());
        m.put("available", available(s, Instant.now()));
        m.put("unavailableReason", unavailableReason(s, Instant.now()));
        return m;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Map<?, ?> m) {
        return (Map<String, Object>) m;
    }

    private void requireGeneratedPolicy(UUID ownerId, Map<String, Object> raw, Map<String, Object> policy) {
        try {
            UUID inferenceId = UUID.fromString(String.valueOf(raw.get("aiInferenceId")));
            var log = sealInferenceLogs == null ? null : sealInferenceLogs.findById(inferenceId).orElse(null);
            if (log != null && ownerId.equals(log.getUserId()) && "COPILOT".equals(log.getCapability())
                    && log.getResult() == br.com.fashionai.domain.model.enums.AiCallResult.SUCCESS
                    && !"local".equals(log.getProvider())
                    && Json.strings(log.getInputSummaryJson()).contains(SealPolicyCopilot.fingerprint(policy))) return;
        } catch (IllegalArgumentException ignored) { }
        throw ApiException.badRequest("POLITICA_IA_OBRIGATORIA", Msg.t("sealCopilot.politica_obrigatoria"));
    }

    /** Medalhões dos vínculos APROVADOS de um esquema — o que o card mostra no espaço reservado ao selo. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> approvedBadges(UUID schemeId) {
        return bonds.findBySchemeId(schemeId).stream().filter(b -> b.getStatus() == SealBondStatus.APPROVED)
                .map(SealService::badge).toList();
    }

    /** RF53 — peças por requisição em {@link #pieceSeals} (o guarda-roupa pede por página). */
    public static final int MAX_PIECE_SEALS = 60;

    /**
     * RF53 — selos de marca/celebridade "na frente" das peças: para cada peça visível a quem pede, os medalhões
     * ({@link #badge}) dos vínculos APROVADOS e vigentes de tier PEÇA cuja {@code linkedPieceIds} contém a peça, vindos de
     * looks que quem pede também consegue ver. Até {@value #MAX_PIECE_SEALS} ids; os demais (e os invisíveis) somem.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> pieceSeals(CurrentUser viewer, List<UUID> ids) {
        List<UUID> wanted = ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().limit(MAX_PIECE_SEALS).toList();
        Map<String, Object> items = new LinkedHashMap<>();
        if (!wanted.isEmpty()) {
            List<UUID> visible = wardrobeItems.findByIdIn(wanted).stream().filter(w -> canViewPiece(guard, viewer, w)).map(WardrobeItem::getId).toList();
            Map<UUID, List<SealBond>> byPiece = approvedPieceBonds(visible, schemeItems, bonds, sc -> canViewScheme(guard, viewer, sc));
            for (UUID id : wanted) {
                if (visible.contains(id)) {
                    items.put(id.toString(), byPiece.getOrDefault(id, List.of()).stream().map(SealService::badge).toList());
                }
            }
        }
        return Map.of("items", items);
    }

    /**
     * RF53 — vínculos APROVADOS e vigentes de tier PEÇA por peça (em lote: peças → looks em que aparecem → vínculos), só de
     * looks aceitos por {@code schemeVisible}. Usado pelo endpoint de selos das peças e pelo filtro "com selo" do closet.
     */
    public static Map<UUID, List<SealBond>> approvedPieceBonds(Collection<UUID> pieceIds, SchemeItemRepository schemeItems,
                                                               SealBondRepository bonds, Predicate<Scheme> schemeVisible) {
        if (pieceIds == null || pieceIds.isEmpty() || schemeItems == null || bonds == null) {
            return Map.of();
        }
        Set<UUID> wanted = new HashSet<>(pieceIds);
        Set<UUID> schemeIds = new LinkedHashSet<>();
        for (SchemeItem si : schemeItems.findByWardrobeItemIdIn(wanted)) {
            if (si.getScheme() != null) {
                schemeIds.add(si.getScheme().getId());
            }
        }
        if (schemeIds.isEmpty()) {
            return Map.of();
        }
        Instant now = Instant.now();
        Map<UUID, List<SealBond>> out = new LinkedHashMap<>();
        for (SealBond b : bonds.findBySchemeIdInAndStatus(schemeIds, SealBondStatus.APPROVED)) {
            if (b.getTier() != SealTier.PECA || (b.getExpiresAt() != null && b.getExpiresAt().isBefore(now))
                    || (schemeVisible != null && !schemeVisible.test(b.getScheme()))) {
                continue;
            }
            for (String raw : Json.strings(b.getLinkedPieceIdsJson())) {
                UUID id = uuid(raw);
                if (id != null && wanted.contains(id)) {
                    List<SealBond> list = out.computeIfAbsent(id, k -> new ArrayList<>());
                    if (!list.contains(b)) {
                        list.add(b);
                    }
                }
            }
        }
        return out;
    }

    /** Peça visível (as regras de sempre: dono, ou não arquivada, aprovada e visível pela peça/perfil/bloqueio). */
    static boolean canViewPiece(Guard guard, CurrentUser viewer, WardrobeItem w) {
        if (viewer != null && viewer.id().equals(w.getUser().getId())) {
            return true;
        }
        return w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED && w.getModerationStatus() == ModerationStatus.APPROVED
                && guard.canView(viewer, w.getUser().getId(), WardrobeService.effectiveVisibility(w));
    }

    /** Look visível (mesma regra do SchemeService.canView, sem depender dele: o SchemeService depende deste serviço). */
    static boolean canViewScheme(Guard guard, CurrentUser viewer, Scheme s) {
        if (s == null) {
            return false;
        }
        if (s.getStatus() == SchemeStatus.ARCHIVED && (viewer == null || !viewer.id().equals(s.getUser().getId()))) {
            return false;
        }
        return guard.canView(viewer, s.getUser().getId(), SchemeService.moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility()));
    }

    /** Medalhão de um vínculo aprovado (cards, aba de destaques): tier, emissor, Premium e o desenho do selo. */
    public static Map<String, Object> badge(SealBond b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tier", b.getTier().name());
        m.put("owner", b.getTargetOwner().getUsername());
        boolean premium = b.getTargetOwner().getProfileType() == ProfileType.CELEBRIDADE;
        m.put("premium", premium);
        Seal seal = b.getSeal();
        m.put("name", seal == null ? null : seal.getName());
        m.put("iconUrl", seal == null ? null : seal.getIconUrl());
        Object design = seal == null ? null : Json.map(seal.getBackgroundConfigJson()).get("design");
        m.put("design", design instanceof Map<?, ?> dm ? dm : SealDesigns.defaultDesign(premium, b.getTier()));
        m.put("linkedPieceIds", Json.strings(b.getLinkedPieceIdsJson()));
        return m;
    }

    /** Selos padrão criados na aprovação do perfil (um por tier), para que o vínculo sempre tenha selo a emitir. */
    @Transactional
    public void ensureDefaultSeals(User owner) {
        if (!seals.findByOwnerIdOrderByCreatedAtDesc(owner.getId()).isEmpty()) {
            return;
        }
        boolean premium = owner.getProfileType() == ProfileType.CELEBRIDADE;
        for (SealTier tier : List.of(SealTier.PECA, SealTier.LOOK)) {
            Seal s = new Seal();
            s.setOwner(owner);
            s.setName((premium ? Msg.t("seal.selo_premium") : "Selo ") + owner.getDisplayName() + (tier == SealTier.PECA ? Msg.t("seal.peca") : " · Look"));
            s.setTier(tier);
            s.setPremium(premium);
            s.setAutoIssued(true);
            s.setPolicyText(tier == SealTier.PECA ? Msg.t("seal.concedido_a_looks_com_1") : Msg.t("seal.concedido_a_looks_com_varias"));
            s.setBackgroundConfigJson(Json.write(Map.of("design", SealDesigns.defaultDesign(premium, tier))));
            seals.save(s);
        }
    }

    // ================================================================== RF20.CA01 / RF21.CA17 — sugestões
    public record Candidate(UUID targetOwnerId, String kind, String name, String logoUrl, BigDecimal confidence,
                            String justification, SealTier tier, List<UUID> linkedPieceIds, SealBondBasis basis,
                            String eraLabel, UUID sealId) {
        public Candidate(UUID targetOwnerId, String kind, String name, String logoUrl, BigDecimal confidence, String justification,
                         SealTier tier, List<UUID> linkedPieceIds, SealBondBasis basis, String eraLabel) {
            this(targetOwnerId, kind, name, logoUrl, confidence, justification, tier, linkedPieceIds, basis, eraLabel, null);
        }
    }

    /** Executa a análise das peças e grava até 3 sugestões (status SUGGESTED). Não bloqueia o salvamento. */
    @Transactional
    public Map<String, Object> suggest(CurrentUser user, UUID schemeId) {
        Scheme scheme = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, scheme.getUser().getId(), "scheme:" + schemeId);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(schemeId);
        List<String> unregistered = new ArrayList<>();
        SealPolicies.HypeLookup hype = hypeLookup(scheme, items);    // RF53: Hype atual das peças e do look salvo
        AiOutcome<List<Candidate>> outcome = ai.local(user.id(), AiCapability.SEALBOND_MATCHER,
                List.of(Msg.t("seal.marcas_das_pecas"), Msg.t("seal.estilo_ocasiao_do_esquema"), Msg.t("seal.assinatura_de_estilo_das_celebridades")),
                () -> candidates(scheme, items, unregistered, false, hype));
        // descarta sugestões anteriores ainda não respondidas
        bonds.findBySchemeId(schemeId).stream().filter(b -> b.getStatus() == SealBondStatus.SUGGESTED).forEach(bonds::delete);
        List<Map<String, Object>> suggestions = new ArrayList<>();
        for (Candidate c : outcome.value()) {
            boolean exists = !bonds.findBySchemeIdAndTargetOwnerIdAndStatusIn(schemeId, c.targetOwnerId(),
                    List.of(SealBondStatus.PENDING_REVIEW, SealBondStatus.APPROVED)).isEmpty();
            if (exists) {
                continue;
            }
            SealBond b = new SealBond();
            b.setScheme(scheme);
            b.setTargetOwner(users.findById(c.targetOwnerId()).orElseThrow());
            b.setRequestedBy(scheme.getUser());
            b.setTier(c.tier());
            b.setLinkedPieceIdsJson(Json.write(c.linkedPieceIds()));
            b.setConfidence(c.confidence());
            b.setJustification(c.justification());
            b.setBasis(c.basis());
            b.setStatus(SealBondStatus.SUGGESTED);
            b.setOrigin(SealBondOrigin.AI_SUGGESTION);
            b.setAiInferenceId(outcome.inferenceId());
            b.setEraLabel(c.eraLabel());
            if (c.sealId() != null) {
                seals.findById(c.sealId()).ifPresent(b::setSeal);
            }
            bonds.save(b);
            Map<String, Object> v = bondView(b);
            v.put("hype", hypeView(c, hype));                   // RF53: Hype da entidade avaliada (ordem: Hype desc)
            suggestions.add(v);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("suggestions", suggestions);
        out.put("unregisteredBrands", unregistered);
        out.put("message", suggestions.isEmpty()
                ? Msg.t("seal.nenhuma_marca_ou_celebridade_atingiu")
                : null);
        if (!unregistered.isEmpty()) {
            out.put("unregisteredMessage", Msg.t("seal.somente_marcas_com_perfil_cadastrado", String.join(", ", unregistered)));
        }
        out.put("explanation", outcome.explanation());
        out.put("inferenceId", outcome.inferenceId());
        return out;
    }

    /** RF13: check each referenced look without changing its existing seal bonds. */
    @Transactional(readOnly = true)
    public Map<String, Object> previewScheme(CurrentUser user, UUID schemeId) {
        Scheme scheme = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, scheme.getUser().getId(), "scheme:" + schemeId);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(schemeId);
        List<SealBond> active = bonds.findBySchemeId(schemeId).stream()
                .filter(b -> b.getStatus() == SealBondStatus.APPROVED || b.getStatus() == SealBondStatus.PENDING_REVIEW).toList();
        List<String> unregistered = new ArrayList<>();
        SealPolicies.HypeLookup hype = hypeLookup(scheme, items);
        AiOutcome<List<Candidate>> outcome = ai.local(user.id(), AiCapability.SEALBOND_MATCHER,
                List.of(Msg.t("seal.marcas_das_pecas"), Msg.t("seal.estilo_ocasiao_do_esquema")),
                () -> candidates(scheme, items, unregistered, false, hype).stream()
                        .filter(c -> active.stream().noneMatch(b -> b.getTargetOwner().getId().equals(c.targetOwnerId()))).toList());
        Map<String, Object> result = previewResult(outcome, unregistered, hype);
        result.put("bonds", active.stream().map(b -> Map.of("id", b.getId(), "name", java.util.Optional.ofNullable(b.getTargetOwner().getDisplayName()).orElse(b.getTargetOwner().getUsername()), "status", b.getStatus())).toList());
        return result;
    }

    /**
     * Criar Look (RF5 + RF21.CA01): antes de salvar, a IA procura marcas e celebridades com que o look pode ter selo, a
     * partir das peças escolhidas, do estilo e da ocasião. Nada é gravado: a pessoa marca as que quer pedir e o vínculo
     * nasce ao salvar (as mesmas regras de {@link #suggest}: só marca validada e celebridade verificada com consentimento).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(CurrentUser user, List<UUID> pieceIds, List<String> occasion, List<String> style) {
        return preview(user, pieceIds, occasion, style, Map.of());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> preview(CurrentUser user, List<UUID> pieceIds, List<String> occasion, List<String> style, Map<String, Object> background) {
        List<WardrobeItem> pieces = wardrobeItems.findByIdIn(pieceIds == null ? List.of() : pieceIds).stream()
                .filter(w -> w.getUser().getId().equals(user.id())).toList();
        if (pieces.isEmpty()) {
            return Map.of("suggestions", List.of(), "unregisteredBrands", List.of(), "message", Msg.t("seal.nenhuma_marca_ou_celebridade_atingiu"));
        }
        Scheme draft = new Scheme();
        draft.setStudioConfigJson(Json.write(background));
        draft.setOccasion(Json.csv(occasion == null ? List.of() : occasion));
        draft.setStyle(Json.csv(style == null ? List.of() : style));
        List<SchemeItem> items = new ArrayList<>();
        for (WardrobeItem w : pieces) {
            SchemeItem si = new SchemeItem();
            si.setWardrobeItem(w);
            items.add(si);
        }
        List<String> unregistered = new ArrayList<>();
        // RF53: Hype atual das peças (já salvas); o look ainda não existe, então critério de Hype do LOOK não é atendido
        SealPolicies.HypeLookup hype = hypeLookup(draft, items);
        AiOutcome<List<Candidate>> outcome = ai.local(user.id(), AiCapability.SEALBOND_MATCHER,
                List.of(Msg.t("seal.marcas_das_pecas"), Msg.t("seal.estilo_ocasiao_do_esquema"), Msg.t("seal.assinatura_de_estilo_das_celebridades")),
                () -> candidates(draft, items, unregistered, false, hype));
        return previewResult(outcome, unregistered, hype);
    }

    /** Campos da peça (RF4) que a IA compara para achar marcas e celebridades com peça semelhante. */
    public record PieceFields(String name, String category, String subcategory, String color, String brandName,
                              List<String> occasion, List<String> style, String material, String variation,
                              Map<String, List<String>> attributes, String sex, String size, String market, Map<String, Object> background) {
        public PieceFields(String name, String category, String subcategory, String color, String brandName, List<String> occasion, List<String> style) {
            this(name, category, subcategory, color, brandName, occasion, style, null, null, null, null, null, null, null);
        }
    }

    /**
     * Adicionar peça (RF4 · "Mais detalhes" › selos): antes de salvar a peça, a IA procura marcas e celebridades com peça
     * semelhante à cadastrada, comparando marca, tipo, cor, ocasião e estilo. Nada é gravado: o vínculo só nasce depois,
     * com a peça salva, pelas mesmas regras de {@link #preview}.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> previewPiece(CurrentUser user, PieceFields f) {
        if (f == null || (blank(f.brandName()) && blank(f.subcategory()) && blank(f.color()) && (f.style() == null || f.style().isEmpty()))) {
            return Map.of("suggestions", List.of(), "unregisteredBrands", List.of(), "message", Msg.t("seal.preencha_marca_tipo_ou_estilo"));
        }
        WardrobeItem w = new WardrobeItem();
        w.setName(f.name() == null ? "" : f.name());
        w.setCategory(f.category());
        w.setSubcategory(f.subcategory());
        w.setColor(f.color());
        w.setMaterial(f.material()); w.setVariationCode(f.variation()); w.setSex(f.sex()); w.setSizeLabel(f.size()); w.setMarket(f.market());
        if (f.attributes() != null) f.attributes().forEach((dim, values) -> TaxonomyAttribute.replace(w.getAttributes(), dim, values, "USER", null));
        w.setBackgroundConfigJson(Json.write(f.background()));
        w.setBrandName(blank(f.brandName()) ? null : f.brandName().trim());
        w.setOccasionTags(Json.csv(f.occasion() == null ? List.of() : f.occasion()));
        w.setStyleTags(Json.csv(f.style() == null ? List.of() : f.style()));
        Scheme draft = new Scheme();
        draft.setOccasion(w.getOccasionTags());
        draft.setStyle(w.getStyleTags());
        SchemeItem si = new SchemeItem();
        si.setWardrobeItem(w);
        List<String> unregistered = new ArrayList<>();
        // RF53: a peça ainda não foi salva, então não tem Hype — selo com critério de Hype não é sugerido aqui
        AiOutcome<List<Candidate>> outcome = ai.local(user.id(), AiCapability.SEALBOND_MATCHER,
                List.of(Msg.t("seal.campos_da_peca"), Msg.t("seal.assinatura_de_estilo_das_celebridades")),
                () -> candidates(draft, List.of(si), unregistered, true, SealPolicies.HypeLookup.NONE));
        return previewResult(outcome, unregistered, SealPolicies.HypeLookup.NONE);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static Map<String, Object> referenceBackground(Scheme scheme) {
        Map<String, Object> background = SealReferenceModels.backgroundOf(Json.map(scheme.getStudioConfigJson()));
        background.putIfAbsent("color", scheme.getBackgroundColor());
        background.putIfAbsent("artUrl", scheme.getBackgroundArtUrl());
        background.putIfAbsent("cardSkin", scheme.getCardSkin());
        background.putIfAbsent("layoutAnatomy", scheme.getLayoutAnatomy());
        return background;
    }

    private static Map<String, Object> previewResult(AiOutcome<List<Candidate>> outcome, List<String> unregistered,
                                                     SealPolicies.HypeLookup hype) {
        List<Map<String, Object>> suggestions = new ArrayList<>();
        for (Candidate c : outcome.value()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("targetOwnerId", c.targetOwnerId());
            m.put("kind", c.kind());
            m.put("name", c.name());
            m.put("logoUrl", c.logoUrl());
            m.put("confidence", c.confidence());
            m.put("justification", c.justification());
            m.put("tier", c.tier());
            m.put("eraLabel", c.eraLabel());
            m.put("sealId", c.sealId());
            m.put("hype", hypeView(c, hype));                   // RF53: {score, level} da entidade avaliada, ou null
            suggestions.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("suggestions", suggestions);
        out.put("unregisteredBrands", unregistered);
        out.put("message", suggestions.isEmpty() ? Msg.t("seal.nenhuma_marca_ou_celebridade_atingiu") : null);
        if (!unregistered.isEmpty()) {
            out.put("unregisteredMessage", Msg.t("seal.somente_marcas_com_perfil_cadastrado", String.join(", ", unregistered)));
        }
        out.put("inferenceId", outcome.inferenceId());
        return out;
    }

    List<Candidate> candidates(Scheme scheme, List<SchemeItem> items, List<String> unregistered) {
        return candidates(scheme, items, unregistered, false);
    }

    /**
     * Sugestões de selo. Primeiro os selos com política padronizada (RF25): a regra do emissor decide — emissor que tem
     * regras e nenhuma atendida não entra pela heurística de marca/assinatura. {@code pieceOnly}: criador de peça (RF4),
     * onde só selos de PEÇA podem ser avaliados.
     */
    List<Candidate> candidates(Scheme scheme, List<SchemeItem> items, List<String> unregistered, boolean pieceOnly) {
        return candidates(scheme, items, unregistered, pieceOnly, hypeLookup(scheme, items));
    }

    /**
     * RF53 — com o Hype atual: políticas com critério de Hype avaliadas contra ele e sugestões ordenadas por Hype desc
     * (a seleção das {@value #MAX_SUGGESTIONS} continua pela confiança; o Hype só reordena, com desempate pela ordem atual).
     */
    List<Candidate> candidates(Scheme scheme, List<SchemeItem> items, List<String> unregistered, boolean pieceOnly,
                               SealPolicies.HypeLookup hype) {
        List<Candidate> out = new ArrayList<>();
        int n = Math.max(1, items.size());
        Set<UUID> governed = policyCandidates(scheme, items, pieceOnly, out, hype);
        // Marcas: peças com marca cadastrada e perfil aprovado (RF20.CA06).
        Map<UUID, List<WardrobeItem>> byBrandProfile = new LinkedHashMap<>();
        List<BrandProfile> approved = brandProfiles.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO);
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            BrandProfile bp = w.getBrandProfile() != null ? w.getBrandProfile()
                    : w.getBrand() != null ? w.getBrand().getBrandProfile() : null;
            if (bp == null && w.getBrandName() != null) {
                String norm = LocalAdvisors.normalize(w.getBrandName());
                bp = approved.stream().filter(p -> LocalAdvisors.jaroWinkler(norm, LocalAdvisors.normalize(p.getBrandName())) >= 0.92)
                        .findFirst().orElse(null);
            }
            if (bp != null && bp.getApprovalStatus() == ApprovalStatus.APROVADO) {
                byBrandProfile.computeIfAbsent(bp.getId(), k -> new ArrayList<>()).add(w);
            } else if (w.getBrandName() != null && !unregistered.contains(w.getBrandName())) {
                unregistered.add(w.getBrandName());
            }
        }
        for (Map.Entry<UUID, List<WardrobeItem>> e : byBrandProfile.entrySet()) {
            BrandProfile bp = brandProfiles.findById(e.getKey()).orElseThrow();
            if (governed.contains(bp.getOwner().getId())) {
                continue;
            }
            int k = e.getValue().size();
            double conf = Math.min(0.99, 0.45 + 0.5 * k / n + (e.getValue().stream().anyMatch(w -> w.getBrand() != null) ? 0.05 : 0));
            if (conf < bp.getSealConfidenceThreshold().doubleValue()) {
                continue;
            }
            out.add(new Candidate(bp.getOwner().getId(), "BRAND", bp.getBrandName(), bp.getLogoUrl(),
                    BigDecimal.valueOf(conf).setScale(3, RoundingMode.HALF_UP),
                    Msg.t("seal.de_pecas_identificadas_como", (k), n, bp.getBrandName()), k == 1 ? SealTier.PECA : SealTier.LOOK,
                    e.getValue().stream().map(WardrobeItem::getId).toList(), SealBondBasis.BRAND_MATCH, null));
        }
        // Celebridades verificadas: assinatura de estilo (RF21.CA17/CA18).
        Similarity.Signature sig = Similarity.of(scheme, items);
        for (CelebrityProfile cp : celebrityProfiles.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)) {
            if (!cp.isSealConsentGranted() || governed.contains(cp.getOwner().getId())) {
                continue;
            }
            Map<String, Object> signature = Json.map(cp.getStyleSignatureJson());
            Set<String> styles = strings(signature.get("styles"));
            Set<String> colors = strings(signature.get("colors"));
            Set<String> types = strings(signature.get("pieceTypes"));
            Set<String> occasions = strings(signature.get("occasions"));
            Similarity.Signature celeb = new Similarity.Signature(styles, Set.of(), colors, occasions, types);
            double sim = Similarity.weighted(sig, celeb);
            double conf = Math.min(0.97, 0.3 + sim);
            if (conf < cp.getSealConfidenceThreshold().doubleValue()) {
                continue;
            }
            String era = signature.get("era") == null ? null : String.valueOf(signature.get("era"));
            Set<String> matchedStyles = new HashSet<>(sig.styles());
            matchedStyles.retainAll(styles);
            Set<String> matchedColors = new HashSet<>(sig.colors());
            matchedColors.retainAll(colors);
            String why = Msg.t("seal.compativeis", ((matchedStyles.isEmpty() ? "" : "estilo " + String.join("/", matchedStyles)) + (matchedColors.isEmpty() ? "" : (matchedStyles.isEmpty() ? "" : " e ") + "paleta " + String.join("/", matchedColors))), (era == null ? "" : Msg.t("seal.com_a_era", era)));
            out.add(new Candidate(cp.getOwner().getId(), "CELEBRITY", cp.getStageName(), cp.getAvatarUrl(),
                    BigDecimal.valueOf(conf).setScale(3, RoundingMode.HALF_UP), why.trim(), items.size() == 1 ? SealTier.PECA : SealTier.LOOK,
                    items.stream().map(si -> si.getWardrobeItem().getId()).toList(), SealBondBasis.STYLE_SIGNATURE, era));
        }
        out.sort((a, b) -> b.confidence().compareTo(a.confidence()));
        return byHype(out.size() > MAX_SUGGESTIONS ? out.subList(0, MAX_SUGGESTIONS) : out, hype);
    }

    /** Avalia os selos ativos com política; devolve os emissores "governados" por regras (com ou sem acerto). */
    private Set<UUID> policyCandidates(Scheme scheme, List<SchemeItem> items, boolean pieceOnly, List<Candidate> out,
                                       SealPolicies.HypeLookup hype) {
        Set<UUID> governed = new HashSet<>();
        List<WardrobeItem> pieces = items.stream().map(SchemeItem::getWardrobeItem).filter(java.util.Objects::nonNull).toList();
        if (pieces.isEmpty()) {
            return governed;
        }
        List<String> occ = Json.csv(scheme.getOccasion());
        List<String> sty = Json.csv(scheme.getStyle());
        Instant now = Instant.now();
        Map<UUID, Candidate> best = new LinkedHashMap<>();
        for (Seal seal : seals.findByStatus(SealStatus.ACTIVE)) {
            SealPolicies.Policy pol = SealPolicies.parse(Json.map(seal.getBackgroundConfigJson()).get("policy"));
            if (seal.getTier() == SealTier.PERFIL || pol == null || !available(seal, now)) {
                continue;
            }
            User owner = seal.getOwner();
            Issuer issuer = issuer(owner);
            if (issuer == null) {
                continue;
            }
            governed.add(owner.getId());
            SealPolicies.Verdict v;
            if (seal.getTier() == SealTier.PECA) {
                List<SealPolicies.Verdict> hits = new ArrayList<>();
                List<WardrobeItem> ok = new ArrayList<>();
                for (WardrobeItem w : pieces) {
                    SealPolicies.Verdict pv = SealPolicies.evaluate(pol, SealTier.PECA, List.of(w),
                            pol.referenceModel() == null ? occ : Json.csv(w.getOccasionTags()),
                            pol.referenceModel() == null ? sty : Json.csv(w.getStyleTags()), hype, referenceBackground(scheme));
                    if (pv.matched()) {
                        ok.add(w);
                        hits.add(pv);
                    }
                }
                // o "porquê" da peça com mais Hype (a primeira vinculada), que traz o trecho de Hype quando houver critério
                int top = 0;
                for (int i = 1; i < ok.size(); i++) {
                    if (hypeScore(hype, ok.get(i)) > hypeScore(hype, ok.get(top))) {
                        top = i;
                    }
                }
                if (!ok.isEmpty() && top > 0) {
                    ok.add(0, ok.remove(top));
                    hits.add(0, hits.remove(top));
                }
                v = ok.isEmpty() ? new SealPolicies.Verdict(false, List.of(), null)
                        : new SealPolicies.Verdict(true, ok.stream().map(WardrobeItem::getId).toList(),
                        pol.usesHype() ? hits.get(0).why() : SealPolicies.describe(pol, SealTier.PECA));
            } else if (pieceOnly) {
                continue;
            } else {
                v = SealPolicies.evaluate(pol, SealTier.LOOK, pieces, occ, sty, hype, referenceBackground(scheme));
            }
            if (!v.matched() || best.containsKey(owner.getId())) {
                continue;                                      // um selo por emissor: o mais recente que atende
            }
            best.put(owner.getId(), new Candidate(owner.getId(), issuer.kind(), issuer.name(), issuer.logoUrl(),
                    BigDecimal.valueOf(0.97).setScale(3, RoundingMode.HALF_UP), Msg.t("sealPolicy.atende", seal.getName(), v.why()),
                    seal.getTier(), v.pieceIds(), issuer.celebrity() ? SealBondBasis.STYLE_SIGNATURE : SealBondBasis.BRAND_MATCH, null, seal.getId()));
        }
        out.addAll(best.values());
        return governed;
    }

    private static double hypeScore(SealPolicies.HypeLookup hype, WardrobeItem w) {
        SealPolicies.HypeFact f = hype == null ? null : hype.piece(w.getId());
        return f == null || !f.available() || f.score() == null ? -1 : f.score();
    }

    private record Issuer(String kind, String name, String logoUrl, boolean celebrity) {
    }

    /** Emissor apto a conceder selo: marca validada ou celebridade verificada com consentimento (RF20.CA06/RF21.CA19). */
    private Issuer issuer(User owner) {
        if (owner.getProfileType() == ProfileType.CELEBRIDADE) {
            return celebrityProfiles.findByOwnerId(owner.getId())
                    .filter(cp -> cp.getVerificationStatus() == ApprovalStatus.APROVADO && cp.isSealConsentGranted())
                    .map(cp -> new Issuer("CELEBRITY", cp.getStageName(), cp.getAvatarUrl(), true)).orElse(null);
        }
        return brandProfiles.findByOwnerId(owner.getId()).filter(bp -> bp.getApprovalStatus() == ApprovalStatus.APROVADO)
                .map(bp -> new Issuer("BRAND", bp.getBrandName(), bp.getLogoUrl(), false)).orElse(null);
    }

    private static Set<String> strings(Object o) {
        Set<String> s = new HashSet<>();
        if (o instanceof Collection<?> c) {
            c.forEach(x -> s.add(String.valueOf(x)));
        }
        return s;
    }

    // ================================================================== CA02 aceite · CA03 edição · CA04 recusa
    /**
     * RF21.CA23 — selo indisponível (teto de emissões, fora da janela, inativo) no momento do aceite: o vínculo fica
     * REJECTED com o motivo e a trilha de auditoria. A transação NÃO desfaz isso ({@code noRollbackFor}); qualquer
     * outro erro (ex.: falta de consentimento de imagem) desfaz o aceite e o vínculo continua SUGERIDO.
     */
    public static final class SealUnavailable extends ApiException {
        public SealUnavailable(String reason) {
            super(409, "SELO_INDISPONIVEL", reason);
        }
    }

    @Transactional(noRollbackFor = SealUnavailable.class)
    public Map<String, Object> accept(CurrentUser user, UUID bondId, Boolean imageRightsConsent) {
        guard.requireCanCreate(user);
        SealBond b = mine(user, bondId);
        if (b.getStatus() != SealBondStatus.SUGGESTED && b.getStatus() != SealBondStatus.REFUSED) {
            throw ApiException.conflict("ESTADO_INVALIDO", Msg.t("seal.este_vinculo_ja_foi_respondido"));
        }
        b.setStatus(SealBondStatus.ACCEPTED);
        b.setImageRightsConsent(imageRightsConsent);
        b.setRespondedAt(Instant.now());
        return route(user, b);
    }

    /** CA03 — escolher outra marca/celebridade da lista (origem MANUAL). */
    @Transactional(noRollbackFor = SealUnavailable.class)
    public Map<String, Object> linkManually(CurrentUser user, UUID schemeId, UUID targetOwnerId, Boolean imageRightsConsent) {
        guard.requireCanCreate(user);
        Scheme scheme = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, scheme.getUser().getId(), "scheme:" + schemeId);
        User target = users.findById(targetOwnerId).orElseThrow(() -> ApiException.notFound("Perfil"));
        if (target.getProfileType() == ProfileType.PESSOAL) {
            throw ApiException.badRequest("PERFIL_INVALIDO", Msg.t("seal.so_marcas_e_celebridades_cadastradas"));
        }
        if (target.getProfileType() == ProfileType.MARCA && brandProfiles.findByOwnerId(targetOwnerId)
                .map(p -> p.getApprovalStatus() != ApprovalStatus.APROVADO).orElse(true)) {
            throw ApiException.badRequest("MARCA_NAO_VALIDADA", Msg.t("seal.somente_marcas_com_perfil_validado"));
        }
        if (target.getProfileType() == ProfileType.CELEBRIDADE && celebrityProfiles.findByOwnerId(targetOwnerId)
                .map(p -> p.getVerificationStatus() != ApprovalStatus.APROVADO).orElse(true)) {
            throw ApiException.badRequest("CELEBRIDADE_NAO_VERIFICADA", Msg.t("seal.somente_celebridades_verificadas_concedem"));
        }
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(schemeId);
        bonds.findBySchemeId(schemeId).stream()
                .filter(x -> x.getTargetOwner().getId().equals(targetOwnerId) && x.getStatus() == SealBondStatus.SUGGESTED)
                .forEach(bonds::delete);
        SealBond b = new SealBond();
        b.setScheme(scheme);
        b.setTargetOwner(target);
        b.setRequestedBy(scheme.getUser());
        b.setTier(items.size() <= 1 ? SealTier.PECA : SealTier.LOOK);
        b.setLinkedPieceIdsJson(Json.write(items.stream().map(si -> si.getWardrobeItem().getId()).toList()));
        b.setBasis(target.getProfileType() == ProfileType.CELEBRIDADE ? SealBondBasis.STYLE_SIGNATURE : SealBondBasis.BRAND_MATCH);
        b.setOrigin(SealBondOrigin.MANUAL);
        b.setStatus(SealBondStatus.EDITED);
        b.setJustification(Msg.t("seal.vinculo_escolhido_manualmente_pelo"));
        b.setImageRightsConsent(imageRightsConsent);
        b.setRespondedAt(Instant.now());
        requireUnique(b);
        bonds.save(b);
        return route(user, b);
    }

    @Transactional
    public Map<String, Object> refuse(CurrentUser user, UUID bondId) {
        SealBond b = mine(user, bondId);
        if (b.getStatus() != SealBondStatus.SUGGESTED) {
            throw ApiException.conflict("ESTADO_INVALIDO", Msg.t("seal.so_sugestoes_podem_ser_recusadas"));
        }
        b.setStatus(SealBondStatus.REFUSED);
        b.setRespondedAt(Instant.now());
        logBond(user, b, "RECUSADO");
        return bondView(b);
    }

    /** Recusa de todas as sugestões do esquema (CA04) — guardadas em "Meus Selos" para aplicação manual depois. */
    @Transactional
    public int refuseAll(CurrentUser user, UUID schemeId) {
        int n = 0;
        for (SealBond b : bonds.findBySchemeId(schemeId)) {
            if (b.getStatus() == SealBondStatus.SUGGESTED && b.getRequestedBy().getId().equals(user.id())) {
                b.setStatus(SealBondStatus.REFUSED);
                b.setRespondedAt(Instant.now());
                logBond(user, b, "RECUSADO");
                n++;
            }
        }
        return n;
    }

    private void requireUnique(SealBond b) {
        boolean dup = !bonds.findBySchemeIdAndTargetOwnerIdAndStatusIn(b.getScheme().getId(), b.getTargetOwner().getId(),
                List.of(SealBondStatus.PENDING_REVIEW, SealBondStatus.APPROVED)).isEmpty();
        if (dup) {
            // RF20.CA09 — selo único por par esquema/emissor.
            throw ApiException.conflict("VINCULO_EXISTENTE", Msg.t("seal.este_esquema_ja_tem_vinculo"));
        }
    }

    /** Pendente → auto-aprovação (marca sem revisão) ou fila de revisão; celebridade sempre revisa (CA19). */
    private Map<String, Object> route(CurrentUser user, SealBond b) {
        requireUnique(b);
        User target = b.getTargetOwner();
        boolean celebrity = target.getProfileType() == ProfileType.CELEBRIDADE;
        if (celebrity && !Boolean.TRUE.equals(b.getImageRightsConsent())) {
            throw ApiException.badRequest("CONSENTIMENTO_IMAGEM",
                    Msg.t("seal.confirme_que_entende_que_o"));
        }
        Seal seal = b.getSeal() != null && b.getSeal().getOwner().getId().equals(target.getId())
                && b.getSeal().getStatus() == SealStatus.ACTIVE ? b.getSeal() : sealFor(target, b.getTier(), b.getScheme());
        requireReferenceMatch(seal, target, b.getTier(), b.getScheme());
        String reason = seal == null ? Msg.t("seal.o_perfil_nao_tem_selo") : unavailableReason(seal, Instant.now());
        if (reason != null) {
            // RF21.CA23 — teto atingido: recusa com mensagem explicativa, sem emissão.
            b.setStatus(SealBondStatus.REJECTED);
            b.setReviewNote(reason);
            logBond(user, b, "RECUSADO_LIMITE");
            throw new SealUnavailable(reason);
        }
        boolean requiresReview = celebrity || brandProfiles.findByOwnerId(target.getId()).map(BrandProfile::isRequiresSealReview).orElse(false);
        b.setRequiresReview(requiresReview);
        b.setSeal(seal);
        if (requiresReview) {
            b.setStatus(SealBondStatus.PENDING_REVIEW);
            notifications.notify(target.getId(), b.getRequestedBy().getId(), NotificationType.SEAL_BOND_REVIEW, "SEAL_BOND",
                    b.getId(), Msg.k("seal.novo_vinculo_para_revisar"), Msg.k("seal.vinculou_o_look_ao_seu", b.getRequestedBy().getUsername(), b.getScheme().getTitle()), null);
            logBond(user, b, "PENDENTE");
        } else {
            issue(b, null);
        }
        return bondView(b);
    }

    /**
     * Selo que o vínculo emite: entre os ativos do nível, o primeiro cuja política o look atende; senão um sem política;
     * políticas não atendidas nunca liberam resgate.
     */
    private void requireReferenceMatch(Seal seal, User target, SealTier tier, Scheme scheme) {
        if (seal == null) return;
        SealPolicies.Policy policy = SealPolicies.parse(Json.map(seal.getBackgroundConfigJson()).get("policy"));
        if (policy != null && policy.referenceModel() != null && sealFor(target, tier, scheme, seal.getId()) == null) {
            throw ApiException.badRequest("POLITICA_NAO_ATENDIDA", Msg.t("sealCopilot.modelo_nao_atendido"));
        }
    }

    private Seal sealFor(User target, SealTier tier, Scheme scheme) {
        return sealFor(target, tier, scheme, null);
    }

    private Seal sealFor(User target, SealTier tier, Scheme scheme, UUID selectedId) {
        if (tier == SealTier.PERFIL) return null;
        List<Seal> active = seals.findByOwnerIdAndStatusOrderByCreatedAtDesc(target.getId(), SealStatus.ACTIVE);
        List<Seal> ofTier = active.stream().filter(s -> s.getTier() == tier && (selectedId == null || selectedId.equals(s.getId()))).toList();
        if (scheme != null && scheme.getId() != null) {
            List<WardrobeItem> pieces = schemeItems.findBySchemeIdOrderBySortOrder(scheme.getId()).stream().map(SchemeItem::getWardrobeItem).toList();
            SealPolicies.HypeLookup[] hype = {null};          // RF53: só consulta o Hype se alguma política usar
            for (Seal s : ofTier) {
                SealPolicies.Policy pol = SealPolicies.parse(Json.map(s.getBackgroundConfigJson()).get("policy"));
                if (pol != null && (pol.usesHype() || pol.referenceModel() != null && pol.referenceModel().containsKey("earnedSeals")) && hype[0] == null) {
                    hype[0] = hypeLookup(pieces.stream().filter(Objects::nonNull).map(WardrobeItem::getId).toList(), scheme.getId());
                }
                SealPolicies.HypeLookup h = hype[0] == null ? SealPolicies.HypeLookup.NONE : hype[0];
                if (pol != null && !pieces.isEmpty() && (tier == SealTier.PECA
                        ? pieces.stream().anyMatch(w -> SealPolicies.evaluate(pol, tier, List.of(w),
                            Json.csv(pol.referenceModel() == null ? scheme.getOccasion() : w.getOccasionTags()),
                            Json.csv(pol.referenceModel() == null ? scheme.getStyle() : w.getStyleTags()), h, referenceBackground(scheme)).matched())
                        : SealPolicies.evaluate(pol, tier, pieces, Json.csv(scheme.getOccasion()), Json.csv(scheme.getStyle()), h, referenceBackground(scheme)).matched())) {
                    return s;
                }
            }
            for (Seal s : ofTier) {
                if (SealPolicies.parse(Json.map(s.getBackgroundConfigJson()).get("policy")) == null) {
                    return s;
                }
            }
        }
        // Não devolve um selo com política quando nenhum modelo foi atendido (também vale no vínculo manual).
        return ofTier.stream().filter(s -> SealPolicies.parse(Json.map(s.getBackgroundConfigJson()).get("policy")) == null)
                .findFirst().orElse(null);
    }

    /** CA08 — emissão do selo único e rastreável. */
    private void issue(SealBond b, UUID decidedBy) {
        Seal seal = b.getSeal();
        b.setStatus(SealBondStatus.APPROVED);
        b.setReviewedAt(Instant.now());
        b.setReviewedBy(decidedBy);
        b.setIssuedAt(Instant.now());
        b.setExpiresAt(seal.getAvailableUntil() != null ? seal.getAvailableUntil() : Instant.now().plus(DEFAULT_SEAL_VALIDITY));
        String prefix = b.getTargetOwner().getProfileType() == ProfileType.CELEBRIDADE ? "PRM" : "BRD";
        String code;
        do {
            code = Hashing.promoCode(prefix);
        } while (bonds.findBySealCode(code).isPresent());
        b.setSealCode(code);
        seal.setUsageCount(seal.getUsageCount() + 1);
        Scheme scheme = b.getScheme();
        List<String> ids = new ArrayList<>(Json.strings(scheme.getSealIdsJson()));
        if (!ids.contains(b.getId().toString())) {
            ids.add(b.getId().toString());
        }
        scheme.setSealIdsJson(Json.write(ids));
        notifications.notify(b.getRequestedBy().getId(), b.getTargetOwner().getId(), NotificationType.SEAL_GRANTED, "SEAL_BOND",
                b.getId(), (seal.isPremium() ? Msg.k("seal.selo_premium_2") : Msg.k("seal.selo_de_marca")) + " emitido!",
                Msg.k("seal.seu_look_recebeu_o_selo", scheme.getTitle(), seal.getName()), null);
        logBond(null, b, "EMITIDO");
        // o selo pode liberar promoções da marca/celebridade: direitos a cupom + notificação (card RF38)
        events.publishEvent(new DomainEvents.CouponRightsCheck(b.getRequestedBy().getId()));
    }

    // ================================================================== CA07 revisão · CA14 revogação
    @Transactional(readOnly = true)
    public List<Map<String, Object>> reviewQueue(CurrentUser user) {
        requireIssuer(user);
        List<Map<String, Object>> out = new ArrayList<>();
        for (SealBond b : bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtAsc(user.id(), SealBondStatus.PENDING_REVIEW)) {
            Map<String, Object> v = bondView(b);
            v.put("scheme", schemeSummary(b.getScheme()));
            out.add(v);
        }
        // revalidação pendente (RF9.CA05): vínculos aprovados cujo esquema mudou a lista de peças.
        for (SealBond b : bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(user.id(), SealBondStatus.APPROVED)) {
            if (b.getScheme().isRevalidationPending()) {
                Map<String, Object> v = bondView(b);
                v.put("revalidation", true);
                v.put("scheme", schemeSummary(b.getScheme()));
                out.add(v);
            }
        }
        return out;
    }

    @Transactional
    public Map<String, Object> review(CurrentUser user, UUID bondId, boolean approve, String reason) {
        requireIssuer(user);
        SealBond b = bonds.findById(bondId).orElseThrow(() -> ApiException.notFound(Msg.t("seal.vinculo")));
        guard.requireOwner(user, b.getTargetOwner().getId(), "seal-bond:" + bondId);
        boolean revalidation = b.getStatus() == SealBondStatus.APPROVED && b.getScheme().isRevalidationPending();
        if (b.getStatus() != SealBondStatus.PENDING_REVIEW && !revalidation) {
            throw ApiException.conflict("ESTADO_INVALIDO", Msg.t("seal.este_vinculo_nao_esta_aguardando"));
        }
        if (approve) {
            requireReferenceMatch(b.getSeal(), b.getTargetOwner(), b.getTier(), b.getScheme());
            if (revalidation) {
                b.getScheme().setRevalidationPending(false);
                b.setReviewNote("revalidado");
                logBond(user, b, "REVALIDADO");
            } else {
                issue(b, user.id());
            }
        } else {
            if (reason == null || reason.isBlank()) {
                throw ApiException.badRequest("MOTIVO_OBRIGATORIO", Msg.t("seal.informe_o_motivo_da_rejeicao"));
            }
            b.setStatus(revalidation ? SealBondStatus.REVOKED : SealBondStatus.REJECTED);
            b.setReviewNote(InputSanitizer.clean(reason, 1000));
            b.setReviewedAt(Instant.now());
            b.setReviewedBy(user.id());
            if (revalidation) {
                b.getScheme().setRevalidationPending(false);
            }
            notifications.notify(b.getRequestedBy().getId(), user.id(), NotificationType.SEAL_BOND_REVIEW, "SEAL_BOND", b.getId(),
                    Msg.k("seal.vinculo_2", (revalidation ? "revogado" : Msg.k("seal.nao_aprovado"))), "Motivo: " + b.getReviewNote(), null);
            logBond(user, b, revalidation ? "REVOGADO" : "REJEITADO");
        }
        return bondView(b);
    }

    @Transactional
    public Map<String, Object> revoke(CurrentUser user, UUID bondId, String reason) {
        SealBond b = bonds.findById(bondId).orElseThrow(() -> ApiException.notFound(Msg.t("seal.vinculo")));
        guard.requireOwner(user, b.getTargetOwner().getId(), "seal-bond:" + bondId);
        revokeInternal(b, reason == null ? "uso indevido" : reason, user.id());
        return bondView(b);
    }

    /** CA14 — esquema excluído ou tornado privado revoga os selos (cupons resgatados continuam válidos). */
    @Transactional
    public void revokeForScheme(UUID schemeId, String reason) {
        for (SealBond b : bonds.findBySchemeId(schemeId)) {
            if (b.getStatus() == SealBondStatus.APPROVED) {
                revokeInternal(b, reason, null);
            } else if (b.getStatus() == SealBondStatus.SUGGESTED || b.getStatus() == SealBondStatus.PENDING_REVIEW) {
                b.setStatus(SealBondStatus.REVOKED);
                b.setReviewNote(reason);
            }
        }
    }

    private void revokeInternal(SealBond b, String reason, UUID by) {
        b.setStatus(SealBondStatus.REVOKED);
        b.setReviewNote(reason);
        b.setReviewedAt(Instant.now());
        b.setReviewedBy(by);
        notifications.notify(b.getRequestedBy().getId(), by, NotificationType.SEAL_BOND_REVIEW, "SEAL_BOND", b.getId(),
                Msg.k("seal.selo_revogado"), Msg.k("seal.o_selo_do_look_foi", b.getScheme().getTitle(), reason), null);
        logBond(null, b, "REVOGADO");
    }

    /** RF9.CA05 — edição da lista de peças de esquema com vínculo aprovado: revalidação pendente + aviso ao emissor. */
    @Transactional
    public void flagRevalidation(Scheme scheme) {
        boolean any = false;
        for (SealBond b : bonds.findBySchemeId(scheme.getId())) {
            if (b.getStatus() == SealBondStatus.APPROVED) {
                any = true;
                notifications.notify(b.getTargetOwner().getId(), scheme.getUser().getId(), NotificationType.SEAL_BOND_REVIEW,
                        "SEAL_BOND", b.getId(), Msg.k("seal.revalidacao_pendente"),
                        Msg.k("seal.o_look_vinculado_ao_seu", scheme.getTitle()), null);
            }
        }
        scheme.setRevalidationPending(any);
    }

    // ================================================================== Meus Selos
    @Transactional(readOnly = true)
    public Map<String, Object> mySeals(CurrentUser user) {
        Map<String, List<Map<String, Object>>> groups = new LinkedHashMap<>();
        groups.put("ativos", new ArrayList<>());
        groups.put("pendentes", new ArrayList<>());
        groups.put("recusados", new ArrayList<>());
        groups.put("sugeridos", new ArrayList<>());
        groups.put("inativos", new ArrayList<>());
        Instant now = Instant.now();
        List<SealBond> mine = bonds.findByRequestedByIdOrderByCreatedAtDesc(user.id());
        Map<UUID, Map<String, Object>> sealHype = sealHype(mine.stream().map(SealBond::getSeal).filter(Objects::nonNull).toList());
        for (SealBond b : mine) {
            Map<String, Object> v = bondView(b);
            if (b.getSeal() != null && v.get("seal") instanceof Map<?, ?> sv) {
                castMap(sv).put("hype", sealHype.getOrDefault(b.getSeal().getId(), emptySealHype()));   // RF53 — Hype do selo
            }
            v.put("scheme", schemeSummary(b.getScheme()));
            switch (b.getStatus()) {
                case APPROVED -> {
                    if (b.getExpiresAt() != null && b.getExpiresAt().isBefore(now)) {
                        v.put("state", "EXPIRADO");
                        groups.get("inativos").add(v);
                    } else {
                        v.put("promotions", promotionsFor(user, b));
                        groups.get("ativos").add(v);
                    }
                }
                case PENDING_REVIEW, ACCEPTED, EDITED -> groups.get("pendentes").add(v);
                case REFUSED -> groups.get("recusados").add(v);
                case SUGGESTED -> groups.get("sugeridos").add(v);
                default -> groups.get("inativos").add(v);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>(groups);
        out.put("redemptions", redemptions.findByUserIdOrderByRedeemedAtDesc(user.id()).stream().map(this::redemptionView).toList());
        return out;
    }

    // ================================================================== promoções (CA11–CA13, CA21–CA23, RNF12)
    public record PromotionForm(PromotionType type, String title, String description, String rules, Integer discountPercent,
                                UUID sealId, String requiredSealKind, Instant startsAt, Instant expiresAt,
                                Integer totalQuota, Integer perUserLimit, UUID partnerBrandUserId, Visibility visibility, String storeUrl) {
    }

    /** Link http(s) de loja terceira (ou nulo). */
    public static String storeUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String v = raw.trim();
        if (httpsOnly(v) == null) {
            throw ApiException.badRequest("LINK_INVALIDO", Msg.t("seal.informe_o_link_da_loja"));
        }
        return v;
    }

    /** Link externo exibido ao usuário (loja, cupom): só https com host; o resto (http, javascript:, data:…) vira null. */
    public static String httpsOnly(String raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.trim();
        if (!v.matches("(?i)https://[^\\s/?#]+[^\\s]{0,500}")) {
            return null;
        }
        try {
            java.net.URI uri = java.net.URI.create(v);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getHost().contains(".") ? v : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Card RF38 — promoções que o usuário pode resgatar agora (selo válido, período, estoque e limite por pessoa). */
    @Transactional(readOnly = true)
    public List<Promotion> eligiblePromotions(UUID userId) {
        Instant now = Instant.now();
        List<SealBond> mine = bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(userId, SealBondStatus.APPROVED);
        Set<UUID> owners = new java.util.LinkedHashSet<>();
        mine.forEach(b -> owners.add(b.getTargetOwner().getId()));
        List<Promotion> out = new ArrayList<>();
        for (UUID owner : owners) {
            if (!users.findById(owner).map(FlairService::sellerActive).orElse(false)) {
                continue;                                  // emissor pendente, suspenso ou excluído não emite cupom
            }
            List<SealBond> ownerBonds = mine.stream().filter(b -> b.getTargetOwner().getId().equals(owner)).toList();
            for (Promotion p : promotions.findByOwnerUserIdAndStatusOrderByCreatedAtDesc(owner, PromotionStatus.AVAILABLE)) {
                if (unavailable(p, now) == null && eligibleBond(p, ownerBonds) != null
                        && redemptions.countByPromotionIdAndUserId(p.getId(), userId) < p.getPerUserLimit()) {
                    out.add(p);
                }
            }
        }
        return out;
    }

    @Transactional
    public Map<String, Object> createPromotion(CurrentUser user, PromotionForm f) {
        requireIssuer(user);
        Promotion p = new Promotion();
        p.setOwnerUserId(user.id());
        applyPromotion(user, p, f);
        promotions.save(p);
        return promotionView(p, null);
    }

    @Transactional
    public Map<String, Object> updatePromotion(CurrentUser user, UUID id, PromotionForm f) {
        requireIssuer(user);
        Promotion p = promotions.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("seal.promocao")));
        guard.requireOwner(user, p.getOwnerUserId(), "promotion:" + id);
        applyPromotion(user, p, f);
        return promotionView(p, null);
    }

    @Transactional
    public Map<String, Object> setPromotionStatus(CurrentUser user, UUID id, PromotionStatus status) {
        Promotion p = promotions.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("seal.promocao")));
        guard.requireOwner(user, p.getOwnerUserId(), "promotion:" + id);
        p.setStatus(status);
        return promotionView(p, null);
    }

    private void applyPromotion(CurrentUser user, Promotion p, PromotionForm f) {
        if (f.type() == null) {
            throw ApiException.badRequest("TIPO_OBRIGATORIO", Msg.t("seal.escolha_o_tipo_da_promocao"));
        }
        User owner = users.findById(user.id()).orElseThrow();
        boolean celebrity = owner.getProfileType() == ProfileType.CELEBRIDADE;
        Set<PromotionType> brandTypes = Set.of(PromotionType.DESCONTO_ECOMMERCE, PromotionType.CUPOM_LOJA,
                PromotionType.FRETE_GRATIS, PromotionType.BRINDE, PromotionType.ACESSO_ANTECIPADO, PromotionType.EVENTO);
        if (!celebrity && !brandTypes.contains(f.type())) {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("seal.tipo_exclusivo_de_promocoes_de"));
        }
        p.setType(f.type());
        p.setTitle(InputSanitizer.required("title", f.title(), 3, 160));
        p.setDescription(InputSanitizer.clean(f.description(), 512));
        p.setRules(InputSanitizer.clean(f.rules(), 2048));
        if (f.discountPercent() != null && (f.discountPercent() < 1 || f.discountPercent() > 90)) {
            throw ApiException.badRequest("DESCONTO_INVALIDO", Msg.t("seal.desconto_entre_1_e_90"));
        }
        p.setDiscountPercent(f.discountPercent());
        if (f.sealId() != null) {
            Seal seal = seals.findById(f.sealId()).orElseThrow(() -> ApiException.notFound("Selo"));
            guard.requireOwner(user, seal.getOwner().getId(), "seal:" + f.sealId());
            if (seal.getStatus() != SealStatus.ACTIVE) {
                // RNF12 — promoções só se aplicam a selos ativos.
                throw ApiException.badRequest("SELO_INATIVO", Msg.t("seal.promocoes_so_podem_ser_aplicadas"));
            }
            p.setSeal(seal);
        }
        p.setRequiredSealKind(celebrity ? "PREMIUM_SEAL" : "BRAND_SEAL");
        p.setStartsAt(f.startsAt());
        p.setExpiresAt(f.expiresAt());
        if (f.startsAt() != null && f.expiresAt() != null && f.expiresAt().isBefore(f.startsAt())) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("seal.a_promocao_termina_antes_de"));
        }
        p.setTotalQuota(f.totalQuota());
        p.setPerUserLimit(f.perUserLimit() == null ? 1 : Math.max(1, f.perUserLimit()));
        if (f.partnerBrandUserId() != null) {
            if (!celebrity) {
                throw ApiException.badRequest("PARCEIRA_INVALIDA", Msg.t("seal.marca_parceira_so_se_aplica"));
            }
            User partner = users.findById(f.partnerBrandUserId()).orElseThrow(() -> ApiException.notFound(Msg.t("seal.marca_parceira")));
            if (partner.getProfileType() != ProfileType.MARCA) {
                throw ApiException.badRequest("PARCEIRA_INVALIDA", Msg.t("seal.a_parceira_precisa_ser_uma"));
            }
            // a marca não vira parceira sem consentir: precisa ter aprovado um vínculo de selo desta celebridade
            if (!partner.getId().equals(p.getPartnerBrandUserId()) && !partnerConsented(owner.getId(), partner)) {
                throw new ApiException(409, "PARCERIA_NAO_AUTORIZADA", Msg.t("seal.a_marca_parceira_ainda_nao_aprovou"));
            }
            p.setPartnerBrandUserId(partner.getId());
        }
        p.setVisibility(f.visibility() == null ? Visibility.PUBLIC : f.visibility());
        p.setStoreUrl(storeUrl(f.storeUrl()));
    }

    /**
     * Consentimento da marca parceira: ela aprovou (revisão RF21) um vínculo de selo pedido por esta celebridade e o
     * vínculo segue válido; a marca precisa estar aprovada e ativa.
     */
    boolean partnerConsented(UUID celebrityId, User partner) {
        if (!FlairService.sellerActive(partner)) {
            return false;
        }
        Instant now = Instant.now();
        return bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(celebrityId, SealBondStatus.APPROVED).stream()
                .anyMatch(b -> b.getTargetOwner().getId().equals(partner.getId()) && (b.getExpiresAt() == null || b.getExpiresAt().isAfter(now)));
    }

    /** Promoções do perfil, filtradas pelos selos do solicitante (CA11/CA21). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> promotionsOf(CurrentUser viewer, UUID ownerId) {
        if ((viewer == null || !viewer.id().equals(ownerId)) && !users.findById(ownerId).map(FlairService::sellerActive).orElse(false)) {
            return List.of();                              // emissor pendente/suspenso: nada na vitrine
        }
        List<SealBond> myBonds = viewer == null ? List.of() : bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(viewer.id(),
                SealBondStatus.APPROVED).stream().filter(b -> b.getTargetOwner().getId().equals(ownerId)).toList();
        boolean owner = viewer != null && viewer.id().equals(ownerId);
        return promotions.findByOwnerUserIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(p -> owner || p.getStatus() == PromotionStatus.AVAILABLE)
                .map(p -> promotionView(p, eligibleBond(p, myBonds))).toList();
    }

    private List<Map<String, Object>> promotionsFor(CurrentUser user, SealBond b) {
        return promotions.findByOwnerUserIdOrderByCreatedAtDesc(b.getTargetOwner().getId()).stream()
                .filter(p -> p.getStatus() == PromotionStatus.AVAILABLE)
                .map(p -> promotionView(p, eligibleBond(p, List.of(b)))).toList();
    }

    private SealBond eligibleBond(Promotion p, List<SealBond> candidates) {
        Instant now = Instant.now();
        return candidates.stream().filter(b -> b.getStatus() == SealBondStatus.APPROVED)
                .filter(b -> b.getExpiresAt() == null || b.getExpiresAt().isAfter(now))
                .filter(b -> p.getSeal() == null || (b.getSeal() != null && b.getSeal().getId().equals(p.getSeal().getId())))
                .findFirst().orElse(null);
    }

    Map<String, Object> promotionView(Promotion p, SealBond eligible) {
        Map<String, Object> m = new LinkedHashMap<>();
        Instant now = Instant.now();
        m.put("id", p.getId());
        m.put("ownerUserId", p.getOwnerUserId());
        m.put("type", p.getType());
        m.put("title", p.getTitle());
        m.put("description", p.getDescription());
        m.put("rules", p.getRules());
        m.put("discountPercent", p.getDiscountPercent());
        m.put("sealId", p.getSeal() == null ? null : p.getSeal().getId());
        m.put("requiredSealKind", p.getRequiredSealKind());
        m.put("startsAt", p.getStartsAt());
        m.put("expiresAt", p.getExpiresAt());
        m.put("totalQuota", p.getTotalQuota());
        m.put("remaining", p.getTotalQuota() == null ? null : Math.max(0, p.getTotalQuota() - p.getRedeemedCount()));
        m.put("perUserLimit", p.getPerUserLimit());
        m.put("partnerBrandUserId", p.getPartnerBrandUserId());
        m.put("status", p.getStatus());
        m.put("storeUrl", p.getStoreUrl());
        m.put("eligible", eligible != null && unavailable(p, now) == null);
        m.put("unavailableReason", eligible == null ? Msg.t("seal.e_preciso_ter_um_selo") : unavailable(p, now));
        m.put("eligibleBondId", eligible == null ? null : eligible.getId());
        return m;
    }

    static String unavailable(Promotion p, Instant now) {
        if (p.getStatus() != PromotionStatus.AVAILABLE) {
            return Msg.t("seal.promocao_2", (p.getStatus() == PromotionStatus.EXPIRED ? "expirada" : Msg.t("seal.indisponivel")));
        }
        if (p.getStartsAt() != null && p.getStartsAt().isAfter(now)) {
            return Msg.t("seal.a_promocao_comeca_em", p.getStartsAt());
        }
        if (p.getExpiresAt() != null && !p.getExpiresAt().isAfter(now)) {
            return Msg.t("seal.promocao_expirada");
        }
        if (p.getTotalQuota() != null && p.getRedeemedCount() >= p.getTotalQuota()) {
            return Msg.t("seal.promocao_esgotada");
        }
        if (p.getSeal() != null && p.getSeal().getStatus() != SealStatus.ACTIVE) {
            return Msg.t("seal.o_selo_desta_promocao_esta");
        }
        return null;
    }

    /** CA12/CA13/CA22 — resgate com código único, estoque e limite por usuário. */
    @Transactional
    public Map<String, Object> redeem(CurrentUser user, UUID promotionId) {
        guard.requireCanCreate(user);
        Promotion p = promotions.findById(promotionId).orElseThrow(() -> ApiException.notFound(Msg.t("seal.promocao")));
        Instant now = Instant.now();
        String reason = unavailable(p, now);
        if (reason == null && !users.findById(p.getOwnerUserId()).map(FlairService::sellerActive).orElse(false)) {
            reason = Msg.t("seal.promocao_2", Msg.t("seal.indisponivel"));
        }
        if (reason != null) {
            throw ApiException.conflict("PROMOCAO_INDISPONIVEL", reason);
        }
        List<SealBond> myBonds = bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(user.id(), SealBondStatus.APPROVED)
                .stream().filter(b -> b.getTargetOwner().getId().equals(p.getOwnerUserId())).toList();
        SealBond bond = eligibleBond(p, myBonds);
        if (bond == null) {
            boolean revoked = bonds.findByRequestedByIdOrderByCreatedAtDesc(user.id()).stream()
                    .anyMatch(b -> b.getTargetOwner().getId().equals(p.getOwnerUserId()) && b.getStatus() == SealBondStatus.REVOKED);
            throw ApiException.conflict("SELO_INVALIDO", revoked ? Msg.t("seal.seu_selo_deste_perfil_foi")
                    : Msg.t("seal.e_preciso_ter_um_selo"));
        }
        long mine = redemptions.countByPromotionIdAndUserId(p.getId(), user.id());
        if (mine >= p.getPerUserLimit()) {
            throw ApiException.conflict("LIMITE_POR_USUARIO", Msg.t("seal.voce_ja_resgatou_esta_promocao"));
        }
        User owner = users.findById(p.getOwnerUserId()).orElseThrow();
        String prefix = owner.getUsername().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        prefix = prefix.substring(0, Math.min(5, prefix.length()));
        if (p.getPartnerBrandUserId() != null) {
            String partner = users.findById(p.getPartnerBrandUserId()).map(User::getUsername).orElse("PARC")
                    .replaceAll("[^A-Za-z0-9]", "").toUpperCase();
            prefix = prefix + "X" + partner.substring(0, Math.min(4, partner.length()));
        }
        String code;
        do {
            code = Hashing.promoCode(prefix);
        } while (promotions.findByCode(code).isPresent());
        PromotionRedemption r = new PromotionRedemption();
        r.setPromotion(p);
        r.setSealBond(bond);
        r.setUser(users.findById(user.id()).orElseThrow());
        r.setCode(code);
        r.setIssuerUserId(p.getOwnerUserId());
        r.setPartnerBrandUserId(p.getPartnerBrandUserId());
        r.setRedeemedAt(now);
        r.setExpiresAt(p.getExpiresAt());
        redemptions.save(r);
        p.setRedeemedCount(p.getRedeemedCount() + 1);
        if (p.getTotalQuota() != null && p.getRedeemedCount() >= p.getTotalQuota()) {
            p.setStatus(PromotionStatus.REDEEMED);
        }
        audit.log(user, AuditActions.PROMOCAO_RESGATADA, "promotion:" + p.getId(), Map.of("code", code,
                "issuer", p.getOwnerUserId().toString(), "partner", String.valueOf(p.getPartnerBrandUserId())));
        return redemptionView(r);
    }

    Map<String, Object> redemptionView(PromotionRedemption r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("code", r.getCode());
        m.put("promotionId", r.getPromotion().getId());
        m.put("promotionTitle", r.getPromotion().getTitle());
        m.put("issuerUserId", r.getIssuerUserId());
        m.put("partnerBrandUserId", r.getPartnerBrandUserId());
        m.put("status", r.getExpiresAt() != null && r.getExpiresAt().isBefore(Instant.now()) ? RedemptionStatus.EXPIRED : r.getStatus());
        m.put("redeemedAt", r.getRedeemedAt());
        m.put("expiresAt", r.getExpiresAt());
        return m;
    }

    /** Regra 7 — métricas por perfil emissor. */
    @Transactional(readOnly = true)
    public Map<String, Object> issuerMetrics(CurrentUser user) {
        requireIssuer(user);
        long suggested = bonds.countByTargetOwnerId(user.id());
        long approved = bonds.countByTargetOwnerIdAndStatus(user.id(), SealBondStatus.APPROVED);
        long pending = bonds.countByTargetOwnerIdAndStatus(user.id(), SealBondStatus.PENDING_REVIEW);
        long refused = bonds.countByTargetOwnerIdAndStatus(user.id(), SealBondStatus.REFUSED);
        long redeemed = redemptions.countByIssuerUserId(user.id()) + redemptions.countByPartnerBrandUserId(user.id());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("suggested", suggested);
        m.put("accepted", suggested - refused);
        m.put("approved", approved);
        m.put("pendingReview", pending);
        m.put("activeSeals", approved);
        m.put("redemptions", redeemed);
        m.put("conversionSealToRedemption", approved == 0 ? 0 : Math.round(redeemed * 1000.0 / approved) / 10.0);
        m.put("hype", bondedHype(user.id()));   // RF53 · P2-09 (aditivo): Hype v2 dos looks vinculados, só públicos
        return m;
    }

    // ------------------------------------------------------------------ util
    private void requireIssuer(CurrentUser user) {
        guard.requireApprovedInstitutional(user, "seals", Msg.t("seal.selos_e_promocoes_sao_geridos"));
    }

    private SealBond mine(CurrentUser user, UUID bondId) {
        SealBond b = bonds.findById(bondId).orElseThrow(() -> ApiException.notFound(Msg.t("seal.vinculo")));
        guard.requireOwner(user, b.getRequestedBy().getId(), "seal-bond:" + bondId);
        return b;
    }

    private void logBond(CurrentUser user, SealBond b, String result) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("origin", b.getOrigin().name());
        meta.put("confidence", b.getConfidence());
        meta.put("scheme", b.getScheme().getId().toString());
        meta.put("target", b.getTargetOwner().getId().toString());
        meta.put("status", b.getStatus().name());
        meta.put("decidedBy", b.getReviewedBy() == null ? (user == null ? Msg.t("seal.sistema_auto_aprovacao") : user.id().toString())
                : b.getReviewedBy().toString());
        audit.log(user == null ? "system" : user.id().toString(), AuditActions.MUDANCA_ESTADO_VINCULO_SELO,
                "seal-bond:" + b.getId(), result, null, null, meta);
    }

    Map<String, Object> bondView(SealBond b) {
        Map<String, Object> m = new LinkedHashMap<>();
        User t = b.getTargetOwner();
        m.put("id", b.getId());
        m.put("schemeId", b.getScheme().getId());
        m.put("target", Views.user(t));
        m.put("kind", t.getProfileType() == ProfileType.CELEBRIDADE ? "CELEBRITY" : "BRAND");
        m.put("sealKind", t.getProfileType() == ProfileType.CELEBRIDADE ? "PREMIUM_SEAL" : "BRAND_SEAL");
        m.put("visualFamily", t.getProfileType() == ProfileType.CELEBRIDADE ? "vitreo-holografico" : "textil-dourado");
        m.put("tier", b.getTier());
        m.put("status", b.getStatus());
        m.put("origin", b.getOrigin());
        m.put("confidence", b.getConfidence());
        m.put("justification", b.getJustification());
        m.put("basis", b.getBasis());
        m.put("linkedPieceIds", Json.strings(b.getLinkedPieceIdsJson()));
        m.put("requiresReview", b.isRequiresReview());
        m.put("sealCode", b.getSealCode());
        m.put("seal", b.getSeal() == null ? null : sealView(b.getSeal()));
        m.put("badge", badge(b));
        m.put("eraLabel", b.getEraLabel());
        m.put("issuedAt", b.getIssuedAt());
        m.put("expiresAt", b.getExpiresAt());
        m.put("reviewNote", b.getReviewNote());
        m.put("aiInferenceId", b.getAiInferenceId());
        brandProfiles.findByOwnerId(t.getId()).ifPresent(bp -> m.put("logoUrl", bp.getLogoUrl()));
        return m;
    }

    private Map<String, Object> schemeSummary(Scheme s) {
        return Map.of("id", s.getId(), "title", s.getTitle(), "coverImageUrl", String.valueOf(s.getCoverImageUrl()),
                "visibility", s.getVisibility(), "owner", Views.user(s.getUser()));
    }

    static List<UUID> uuids(List<String> ids) {
        return ids.stream().map(UUID::fromString).collect(Collectors.toList());
    }
}

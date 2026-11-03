package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.seal.SealDesigns;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.TaxonomyAttribute;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

/**
 * RF25 — Copilot especializado (#createsealpolicy): monta o contexto do emissor (peças, taxonomia, marcas, fundos,
 * desenhos e selos conquistáveis), valida a resposta da IA e registra o digest que a publicação exige. Colaborador
 * do {@link SealService} (R80).
 */
final class SealPolicyDraftFlow {
    private final SealRepository seals;
    private final UserRepository users;
    private final BrandProfileRepository brandProfiles;
    private final CelebrityProfileRepository celebrityProfiles;
    private final WardrobeItemRepository wardrobeItems;
    private final AiEngine ai;
    private final Audit audit;
    private final SealIssuers issuers;
    private final Supplier<BrandRepository> brands;
    private final Supplier<BackgroundStudioService> backgrounds;

    SealPolicyDraftFlow(SealRepository seals, UserRepository users, BrandProfileRepository brandProfiles, CelebrityProfileRepository celebrityProfiles, WardrobeItemRepository wardrobeItems, AiEngine ai, Audit audit, SealIssuers issuers, Supplier<BrandRepository> brands, Supplier<BackgroundStudioService> backgrounds) {
        this.seals = seals;
        this.users = users;
        this.brandProfiles = brandProfiles;
        this.celebrityProfiles = celebrityProfiles;
        this.wardrobeItems = wardrobeItems;
        this.ai = ai;
        this.audit = audit;
        this.issuers = issuers;
        this.brands = brands;
        this.backgrounds = backgrounds;
    }

    Map<String, Object> draft(CurrentUser user, SealTier tier, String message, Map<String, Object> previousPolicy,
                                     List<SealPolicyCopilot.Message> conversation) {
        issuers.requireIssuer(user);
        String prompt = InputSanitizer.required("message", message, 1, 6000);
        List<SealPolicyCopilot.Message> history = SealPolicyCopilot.conversation(conversation);
        if (!SealPolicyCopilot.active(prompt, history) || prompt.trim().equalsIgnoreCase(SealPolicyCopilot.TAG)) {
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
        context.put("requesterName", owner.getDisplayName() == null || owner.getDisplayName().isBlank() ? owner.getUsername() : owner.getDisplayName());
        context.put("conversation", history);
        context.put("categories", Taxonomy.SUBCATEGORIES); context.put("colors", Taxonomy.COLOR_FAMILY);
        context.put("subcategories", TaxonomyRegistry.get().activeSubcategories().values().stream().flatMap(Collection::stream)
                .map(code -> TaxonomyRegistry.get().subcategory(code).orElseThrow()).toList());
        List<String> brandNames = new ArrayList<>(List.of(name));
        if (brands.get() != null) brands.get().findAllByOrderByName().forEach(b -> brandNames.add(b.getName()));
        context.put("brands", brandNames);
        if (backgrounds.get() != null) context.put("backgroundCatalog", backgrounds.get().catalog());
        context.put("dimensions", TaxonomyRegistry.get().dimensions()); context.put("sizes", Taxonomy.SIZES);
        context.put("sexes", Taxonomy.SEXES); context.put("occasions", Taxonomy.OCCASIONS); context.put("styles", Taxonomy.STYLES);
        context.put("sealDesignCatalog", SealDesigns.catalog());
        List<Seal> knownSeals = seals.findByStatus(SealStatus.ACTIVE).stream().filter(s -> s.getTier() != SealTier.PERFIL && issuers.issuer(s.getOwner()) != null).toList();
        context.put("earnedSealCatalog", knownSeals.stream().map(s -> Map.of("id", s.getId(), "name", s.getName(), "tier", s.getTier(), "issuer", s.getOwner().getUsername())).toList());

        List<String> inputs = new ArrayList<>(List.of("#createsealpolicy", "issuer catalog", "taxonomy", "reference model"));
        AiOutcome<Map<String, Object>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.COPILOT,
                SealPolicyCopilot.SYSTEM, Json.write(Map.of("request", prompt, "context", context)), List.of(), 6000,
                inputs, response -> {
                    Map<String, Object> parsed = SealPolicyCopilot.parse(response);
                    if (parsed != null && "VALID".equals(parsed.get("status"))) {
                        if (tier != null && !tier.name().equals(parsed.get("tier"))) return null;
                        Map<String, Object> policy = SealViews.castMap((Map<?, ?>) parsed.get("policy"));
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
            Map<String, Object> policy = SealViews.castMap((Map<?, ?>) out.get("policy"));
            policy.put("aiInferenceId", String.valueOf(outcome.inferenceId()));
            out.put("policy", policy);
        }
        out.put("inferenceId", outcome.inferenceId()); out.put("intent", "SEAL_POLICY");
        if (!(out.get("text") instanceof String text) || text.isBlank()) {
            out.put("text", "VALID".equals(out.get("status")) ? Msg.t("sealCopilot.modelo_pronto") : String.join(" ", (List<String>) out.get("questions")));
        }
        audit.log(user, AuditActions.SELO_EDITADO, "seal:draft", Map.of("op", "#createsealpolicy", "pieces", examples.size()));
        return out;
    }
}

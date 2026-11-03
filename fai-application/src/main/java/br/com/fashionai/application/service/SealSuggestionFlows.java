package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SealService.Candidate;
import br.com.fashionai.application.service.SealService.PieceFields;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.TaxonomyAttribute;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealBondOrigin;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF20.CA01 / RF21.CA01 / RF4 / RF13 — sugestões gravadas do look salvo e prévias sem gravação (look salvo, look em
 * criação e peça em cadastro), com o Hype da entidade avaliada (RF53). Colaborador do {@link SealService} (R80).
 */
final class SealSuggestionFlows {
    private final SealRepository seals;
    private final SealBondRepository bonds;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final UserRepository users;
    private final WardrobeItemRepository wardrobeItems;
    private final AiEngine ai;
    private final Guard guard;
    private final SealCandidates candidates;
    private final SealHypeLookups lookups;
    private final SealViews views;

    SealSuggestionFlows(SealRepository seals, SealBondRepository bonds, SchemeRepository schemes, SchemeItemRepository schemeItems, UserRepository users, WardrobeItemRepository wardrobeItems, AiEngine ai, Guard guard, SealCandidates candidates, SealHypeLookups lookups, SealViews views) {
        this.seals = seals;
        this.bonds = bonds;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.users = users;
        this.wardrobeItems = wardrobeItems;
        this.ai = ai;
        this.guard = guard;
        this.candidates = candidates;
        this.lookups = lookups;
        this.views = views;
    }

    /** Executa a análise das peças e grava até 3 sugestões (status SUGGESTED). Não bloqueia o salvamento. */
    Map<String, Object> suggest(CurrentUser user, UUID schemeId) {
        Scheme scheme = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, scheme.getUser().getId(), "scheme:" + schemeId);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(schemeId);
        List<String> unregistered = new ArrayList<>();
        SealPolicies.HypeLookup hype = lookups.hypeLookup(scheme, items);    // RF53: Hype atual das peças e do look salvo
        AiOutcome<List<Candidate>> outcome = ai.local(user.id(), AiCapability.SEALBOND_MATCHER,
                List.of(Msg.t("seal.marcas_das_pecas"), Msg.t("seal.estilo_ocasiao_do_esquema"), Msg.t("seal.assinatura_de_estilo_das_celebridades")),
                () -> candidates.candidates(scheme, items, unregistered, false, hype));
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
            Map<String, Object> v = views.bondView(b);
            v.put("hype", SealHypeLookups.hypeView(c, hype));                   // RF53: Hype da entidade avaliada (ordem: Hype desc)
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
    Map<String, Object> previewScheme(CurrentUser user, UUID schemeId) {
        Scheme scheme = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, scheme.getUser().getId(), "scheme:" + schemeId);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(schemeId);
        List<SealBond> active = bonds.findBySchemeId(schemeId).stream()
                .filter(b -> b.getStatus() == SealBondStatus.APPROVED || b.getStatus() == SealBondStatus.PENDING_REVIEW).toList();
        List<String> unregistered = new ArrayList<>();
        SealPolicies.HypeLookup hype = lookups.hypeLookup(scheme, items);
        AiOutcome<List<Candidate>> outcome = ai.local(user.id(), AiCapability.SEALBOND_MATCHER,
                List.of(Msg.t("seal.marcas_das_pecas"), Msg.t("seal.estilo_ocasiao_do_esquema")),
                () -> candidates.candidates(scheme, items, unregistered, false, hype).stream()
                        .filter(c -> active.stream().noneMatch(b -> b.getTargetOwner().getId().equals(c.targetOwnerId()))).toList());
        Map<String, Object> result = previewResult(outcome, unregistered, hype);
        result.put("bonds", active.stream().map(b -> Map.of("id", b.getId(), "name", java.util.Optional.ofNullable(b.getTargetOwner().getDisplayName()).orElse(b.getTargetOwner().getUsername()), "status", b.getStatus())).toList());
        return result;
    }

    Map<String, Object> preview(CurrentUser user, List<UUID> pieceIds, List<String> occasion, List<String> style, Map<String, Object> background) {
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
        SealPolicies.HypeLookup hype = lookups.hypeLookup(draft, items);
        AiOutcome<List<Candidate>> outcome = ai.local(user.id(), AiCapability.SEALBOND_MATCHER,
                List.of(Msg.t("seal.marcas_das_pecas"), Msg.t("seal.estilo_ocasiao_do_esquema"), Msg.t("seal.assinatura_de_estilo_das_celebridades")),
                () -> candidates.candidates(draft, items, unregistered, false, hype));
        return previewResult(outcome, unregistered, hype);
    }

    /**
     * Adicionar peça (RF4 · "Mais detalhes" › selos): antes de salvar a peça, a IA procura marcas e celebridades com peça
     * semelhante à cadastrada, comparando marca, tipo, cor, ocasião e estilo. Nada é gravado: o vínculo só nasce depois,
     * com a peça salva, pelas mesmas regras de {@link #preview}.
     */
    Map<String, Object> previewPiece(CurrentUser user, PieceFields f) {
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
                () -> candidates.candidates(draft, List.of(si), unregistered, true, SealPolicies.HypeLookup.NONE));
        return previewResult(outcome, unregistered, SealPolicies.HypeLookup.NONE);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
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
            m.put("hype", SealHypeLookups.hypeView(c, hype));                   // RF53: {score, level} da entidade avaliada, ou null
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
}

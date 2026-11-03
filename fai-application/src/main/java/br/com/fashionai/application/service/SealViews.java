package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.seal.SealDesigns;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Views dos selos, vínculos e medalhões (com o "Hype do selo", RF53) e a disponibilidade do selo (RNF12): o JSON que
 * controllers e outros serviços recebem. Colaborador do {@link SealService} (R80).
 */
final class SealViews {
    private final SealRepository seals;
    private final UserRepository users;
    private final BrandProfileRepository brandProfiles;
    private final SealHypeAverages averages;

    SealViews(SealRepository seals, UserRepository users, BrandProfileRepository brandProfiles, SealHypeAverages averages) {
        this.seals = seals;
        this.users = users;
        this.brandProfiles = brandProfiles;
        this.averages = averages;
    }

    /** Todos os selos do emissor (aba do próprio dono). */
    List<Map<String, Object>> sealsOf(UUID ownerId) {
        return sealViews(seals.findByOwnerIdOrderByCreatedAtDesc(ownerId));
    }

    /**
     * Selos de um perfil para quem visita: o dono (e o admin) vê todos; os demais só os ativos, e só de perfil emissor
     * aprovado e com conta ativa.
     */
    List<Map<String, Object>> sealsOf(CurrentUser viewer, UUID ownerId) {
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
        Map<UUID, Map<String, Object>> hype = averages.sealHype(list);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Seal s : list) {
            Map<String, Object> v = sealView(s);
            v.put("hype", hype.getOrDefault(s.getId(), SealHypeAverages.emptySealHype()));
            out.add(v);
        }
        return out;
    }

    /** RNF12 — um selo está disponível quando ativo, dentro da janela e abaixo do teto de emissão. */
    static boolean available(Seal s, Instant now) {
        return s.getStatus() == SealStatus.ACTIVE
                && (s.getAvailableFrom() == null || !s.getAvailableFrom().isAfter(now))
                && (s.getAvailableUntil() == null || s.getAvailableUntil().isAfter(now))
                && (s.getUsageLimit() == null || s.getUsageCount() < s.getUsageLimit());
    }

    static String unavailableReason(Seal s, Instant now) {
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
        m.put("premium", s.isPremium());
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
        m.put("grantValidityDays", s.getGrantValidityDays() != null ? s.getGrantValidityDays() : (int) SealService.DEFAULT_SEAL_VALIDITY.toDays());
        m.put("available", available(s, Instant.now()));
        m.put("unavailableReason", unavailableReason(s, Instant.now()));
        return m;
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> castMap(Map<?, ?> m) {
        return (Map<String, Object>) m;
    }

    /** Medalhão de um vínculo aprovado (cards, aba de destaques): tier, emissor, Premium e o desenho do selo. */
    static Map<String, Object> badge(SealBond b) {
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
        m.put("expiresAt", b.getExpiresAt());
        return m;
    }

    Map<String, Object> bondView(SealBond b) {
        Map<String, Object> m = new LinkedHashMap<>();
        User t = b.getTargetOwner();
        m.put("id", b.getId());
        m.put("schemeId", b.getScheme() == null ? null : b.getScheme().getId());
        m.put("pieceId", b.getPiece() == null ? null : b.getPiece().getId());
        m.put("piece", b.getPiece() == null ? null : Map.of("id",b.getPiece().getId(),"name",b.getPiece().getName(),
                "imageUrl",String.valueOf(b.getPiece().getImageUrl()),"visibility",b.getPiece().getVisibility(),"owner",Views.user(b.getPiece().getUser())));
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

    Map<String, Object> schemeSummary(Scheme s) {
        if (s == null) return null;
        return Map.of("id", s.getId(), "title", s.getTitle(), "coverImageUrl", String.valueOf(s.getCoverImageUrl()),
                "visibility", s.getVisibility(), "owner", Views.user(s.getUser()));
    }

    static String targetTitle(SealBond b) {
        return b.getScheme() == null ? b.getPiece().getName() : b.getScheme().getTitle();
    }
}

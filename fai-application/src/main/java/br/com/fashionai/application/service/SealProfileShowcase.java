package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;

/**
 * RF25 — política PERFIL: publica na vitrine do emissor o conteúdo público elegível (looks e peças), sem criar
 * vínculos nem selos conquistados. Colaborador do {@link SealService} (R80).
 */
final class SealProfileShowcase {
    private final SealRepository seals;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository wardrobeItems;
    private final SealIssuers issuers;
    private final SealHypeLookups lookups;

    SealProfileShowcase(SealRepository seals, SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository wardrobeItems, SealIssuers issuers, SealHypeLookups lookups) {
        this.seals = seals;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.wardrobeItems = wardrobeItems;
        this.issuers = issuers;
        this.lookups = lookups;
    }

    /**
     * PERFIL publica conteúdo elegível na vitrine; não cria vínculos nem selos conquistados. Vale por tipo: uma política
     * só de peças não decide a vitrine de looks (antes, qualquer política PERFIL esvaziava a lista do outro tipo).
     */
    boolean hasProfilePolicies(UUID ownerId, SealTier subject) { return !profilePolicies(ownerId, subject).isEmpty(); }

    private List<SealPolicies.Policy> profilePolicies(UUID ownerId, SealTier subject) {
        Instant now = Instant.now();
        Set<Object> targets = subject == SealTier.LOOK ? Set.of("LOOK", "BOTH") : Set.of("PECA", "BOTH");
        return seals.findByOwnerIdAndStatusOrderByCreatedAtDesc(ownerId, SealStatus.ACTIVE).stream()
                .filter(s -> s.getTier() == SealTier.PERFIL && SealViews.available(s, now) && issuers.issuer(s.getOwner()) != null)
                .map(s -> SealPolicies.parse(Json.map(s.getBackgroundConfigJson()).get("policy")))
                .filter(p -> p != null && p.referenceModel() != null && targets.contains(p.referenceModel().get("target"))).toList();
    }

    private boolean profileMatch(List<SealPolicies.Policy> policies, SealTier subject, List<WardrobeItem> items, Scheme scheme) {
        if (items.isEmpty()) return false;
        List<String> occ = Json.csv(scheme == null ? items.get(0).getOccasionTags() : scheme.getOccasion());
        List<String> sty = Json.csv(scheme == null ? items.get(0).getStyleTags() : scheme.getStyle());
        SealPolicies.HypeLookup facts = lookups.hypeLookup(items.stream().map(WardrobeItem::getId).toList(), scheme == null ? null : scheme.getId());
        return policies.stream().anyMatch(p -> SealPolicies.evaluate(p, subject, items, occ, sty, facts,
                scheme == null ? Map.of() : SealCandidates.referenceBackground(scheme)).matched());
    }

    List<Scheme> profileSchemes(UUID ownerId, Predicate<Scheme> visible, int limit) {
        List<SealPolicies.Policy> policies = profilePolicies(ownerId, SealTier.LOOK);
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
        List<SealPolicies.Policy> policies = profilePolicies(ownerId, SealTier.PECA);
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
}

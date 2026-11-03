package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.service.SealService.Candidate;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * RF53 — Hype atual para os critérios de Hype das políticas e a ordem das sugestões (em lote, pelo
 * {@link HypeQueryService#currentOf}), com a contagem de selos já conquistados, e a exigência do selo no modo Hype.
 * Colaborador do {@link SealService} (R80).
 */
final class SealHypeLookups {
    private final SealBondRepository bonds;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository wardrobeItems;
    private final SealIssuers issuers;
    private final Supplier<HypeQueryService> hypeQuery;

    SealHypeLookups(SealBondRepository bonds, SchemeItemRepository schemeItems, WardrobeItemRepository wardrobeItems, SealIssuers issuers, Supplier<HypeQueryService> hypeQuery) {
        this.bonds = bonds;
        this.schemeItems = schemeItems;
        this.wardrobeItems = wardrobeItems;
        this.issuers = issuers;
        this.hypeQuery = hypeQuery;
    }

    static boolean freshHype(HypeScoreCurrent row, HypeQueryService query) {
        return query != null && row != null && row.getStatus() == HypeStatus.AVAILABLE && row.getScore() != null
                && query.config().algorithmVersion().equals(row.getAlgorithmVersion()) && row.getCalculatedAt() != null
                && row.getCalculatedAt().isAfter(Instant.now().minus(Duration.ofHours(query.config().staleAfterHours())));
    }

    void requireHypeMatch(SealBond bond, Seal seal) {
        if (seal == null || !"HYPE".equals(Json.map(seal.getBackgroundConfigJson()).get("policy") instanceof Map<?, ?> p ? p.get("mode") : null)) return;
        if (!issuers.hypeIssuerAvailable(seal.getOwner())) throw ApiException.forbidden(Msg.t("sealHype.issuer_unavailable"));
        HypeQueryService query = hypeQuery.get();
        List<WardrobeItem> pieces = bond.getPiece() == null
                ? schemeItems.findBySchemeIdOrderBySortOrder(bond.getScheme().getId()).stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).toList()
                : List.of(bond.getPiece());
        HypeEntityType type = bond.getPiece() == null ? HypeEntityType.SCHEME : HypeEntityType.PIECE;
        UUID id = bond.getPiece() == null ? bond.getScheme().getId() : bond.getPiece().getId();
        HypeScoreCurrent row = query == null ? null : query.currentOf(type, List.of(id)).get(id);
        if (!freshHype(row, query)) throw ApiException.conflict("HYPE_INDISPONIVEL", Msg.t("sealHype.metrics_unavailable"));
        if (bond.getPiece() != null && (bond.getPiece().getAvailabilityStatus() == AvailabilityStatus.ARCHIVED
                || bond.getPiece().getModerationStatus() != ModerationStatus.APPROVED)
                || bond.getScheme() != null && (bond.getScheme().getStatus() != SchemeStatus.PUBLISHED || bond.getScheme().isRevalidationPending()))
            throw ApiException.conflict("POLITICA_NAO_ATENDIDA", Msg.t("sealHype.not_eligible"));
        SealPolicies.HypeLookup lookup = new SealPolicies.HypeLookup() {
            public SealPolicies.HypeFact piece(UUID pieceId) {
                HypeScoreCurrent value = query.currentOf(HypeEntityType.PIECE, List.of(pieceId)).get(pieceId);
                return freshHype(value, query) ? SealPolicies.HypeFact.of(value) : null;
            }
            public SealPolicies.HypeFact look() { return type == HypeEntityType.SCHEME ? SealPolicies.HypeFact.of(row) : null; }
        };
        SealPolicies.Policy policy = SealPolicies.parse(Json.map(seal.getBackgroundConfigJson()).get("policy"));
        List<String> occasions = Json.csv(bond.getPiece() == null ? bond.getScheme().getOccasion() : bond.getPiece().getOccasionTags());
        List<String> styles = Json.csv(bond.getPiece() == null ? bond.getScheme().getStyle() : bond.getPiece().getStyleTags());
        if (policy == null || !SealPolicies.evaluate(policy, bond.getTier(), pieces, occasions, styles, lookup).matched())
            throw ApiException.conflict("POLITICA_NAO_ATENDIDA", Msg.t("sealHype.not_eligible"));
    }

    /**
     * Hype atual (em lote, pelo {@link HypeQueryService#currentOf}) das peças avaliadas e do look já salvo; look ainda não
     * salvo ({@code schemeId} nulo) não tem Hype. Sem o serviço de Hype: {@link SealPolicies.HypeLookup#NONE}.
     */
    SealPolicies.HypeLookup hypeLookup(Collection<UUID> pieceIds, UUID schemeId) {
        HypeQueryService q = hypeQuery.get();
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
                            && (b.getExpiresAt() == null || b.getExpiresAt().isAfter(now))
                            && (b.getScheme() == null || !b.getScheme().isRevalidationPending())).toList();
                }
                Set<String> matched = new HashSet<>();
                for (SealBond b : earned) {
                    if (!sealId.equals(b.getSeal().getId())) continue;
                    if (!"PIECES".equals(scope) && b.getTier() == SealTier.LOOK && schemeId != null && b.getScheme() != null && schemeId.equals(b.getScheme().getId()))
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

    SealPolicies.HypeLookup hypeLookup(Scheme scheme, List<SchemeItem> items) {
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

    static Map<String, Object> hypeView(Candidate c, SealPolicies.HypeLookup hype) {
        SealPolicies.HypeFact f = candidateHype(c, hype);
        return f == null ? null : f.view();
    }
}

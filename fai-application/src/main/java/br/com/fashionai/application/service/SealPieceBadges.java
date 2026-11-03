package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;

/**
 * RF53 — medalhões dos vínculos aprovados e vigentes nos cards dos looks e "na frente" das peças, com as regras de
 * visibilidade de peça e look. Colaborador do {@link SealService} (R80).
 */
final class SealPieceBadges {
    private final SealBondRepository bonds;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository wardrobeItems;
    private final Guard guard;

    SealPieceBadges(SealBondRepository bonds, SchemeItemRepository schemeItems, WardrobeItemRepository wardrobeItems, Guard guard) {
        this.bonds = bonds;
        this.schemeItems = schemeItems;
        this.wardrobeItems = wardrobeItems;
        this.guard = guard;
    }

    /** Medalhões dos vínculos APROVADOS de um esquema — o que o card mostra no espaço reservado ao selo. */
    List<Map<String, Object>> approvedBadges(UUID schemeId) {
        Instant now = Instant.now();
        return bonds.findBySchemeId(schemeId).stream().filter(b -> b.getStatus() == SealBondStatus.APPROVED)
                .filter(b -> b.getExpiresAt() == null || b.getExpiresAt().isAfter(now))   // selo vencido sai do card
                .map(SealViews::badge).toList();
    }

    /**
     * RF53 — selos de marca/celebridade "na frente" das peças: para cada peça visível a quem pede, os medalhões
     * ({@link SealViews#badge}) dos vínculos APROVADOS e vigentes de tier PEÇA cuja {@code linkedPieceIds} contém a peça, vindos de
     * looks que quem pede também consegue ver. Até {@value SealService#MAX_PIECE_SEALS} ids; os demais (e os invisíveis) somem.
     */
    Map<String, Object> pieceSeals(CurrentUser viewer, List<UUID> ids) {
        List<UUID> wanted = ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().limit(SealService.MAX_PIECE_SEALS).toList();
        Map<String, Object> items = new LinkedHashMap<>();
        if (!wanted.isEmpty()) {
            List<UUID> visible = wardrobeItems.findByIdIn(wanted).stream().filter(w -> canViewPiece(guard, viewer, w)).map(WardrobeItem::getId).toList();
            Map<UUID, List<SealBond>> byPiece = approvedPieceBonds(visible, schemeItems, bonds, sc -> canViewScheme(guard, viewer, sc));
            for (UUID id : wanted) {
                if (visible.contains(id)) {
                    items.put(id.toString(), byPiece.getOrDefault(id, List.of()).stream().map(SealViews::badge).toList());
                }
            }
        }
        return Map.of("items", items);
    }

    /**
     * RF53 — vínculos APROVADOS e vigentes de tier PEÇA por peça (em lote: peças → looks em que aparecem → vínculos), só de
     * looks aceitos por {@code schemeVisible}. Usado pelo endpoint de selos das peças e pelo filtro "com selo" do closet.
     */
    static Map<UUID, List<SealBond>> approvedPieceBonds(Collection<UUID> pieceIds, SchemeItemRepository schemeItems,
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
        Instant now = Instant.now();
        Map<UUID, List<SealBond>> out = new LinkedHashMap<>();
        for (SealBond b : bonds.findByPieceIdInAndStatus(wanted, SealBondStatus.APPROVED)) {
            if (b.getTier() == SealTier.PECA && b.getPiece() != null && wanted.contains(b.getPiece().getId())
                    && (b.getExpiresAt() == null || b.getExpiresAt().isAfter(now)))
                out.computeIfAbsent(b.getPiece().getId(), ignored -> new ArrayList<>()).add(b);
        }
        for (SealBond b : schemeIds.isEmpty() ? List.<SealBond>of() : bonds.findBySchemeIdInAndStatus(schemeIds, SealBondStatus.APPROVED)) {
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

    static UUID uuid(String raw) {
        try {
            return raw == null ? null : UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}

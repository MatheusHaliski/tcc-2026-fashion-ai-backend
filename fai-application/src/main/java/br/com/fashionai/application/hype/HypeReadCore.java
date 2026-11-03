package br.com.fashionai.application.hype;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
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
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.hype.HypeCards.dimensions;
import static br.com.fashionai.application.hype.HypeCards.num;

/**
 * HypeScore v2 — base das leituras: as dependências do {@link HypeQueryService}, a visibilidade de quem pede, o estado
 * atual em lote, a média do mês, a população pública e o resumo do card (reusado por cards, detalhe, rankings e globo).
 */
final class HypeReadCore {
    final HypeScoreConfig config;
    final HypeScoreCurrentRepository current;
    final HypeScoreSnapshotRepository snapshots;
    final WardrobeItemRepository pieces;
    final SchemeRepository schemes;
    final SchemeItemRepository schemeItems;
    final StyleDnaRepository dnas;
    final Guard guard;
    final WardrobeService wardrobe;
    final SchemeService schemeService;
    final HypeCache cache;
    /** Perfis oficiais de marca (link {@code /brands/{slug}} dos agregados de marca, P3-01); nulo nos testes antigos. */
    final BrandProfileRepository brandProfiles;
    /** RF53 · P3-12 — preferências de "Criadores em alta" (setter opcional do serviço); sem ele, ninguém saiu do ranking. */
    UserPreferencesRepository preferences;
    /** Classificação Fashion Card (setter opcional do serviço). */
    AuraHypeDropService fashionDrops;

    HypeReadCore(HypeScoreConfig config, HypeScoreCurrentRepository current, HypeScoreSnapshotRepository snapshots, WardrobeItemRepository pieces,
                 SchemeRepository schemes, SchemeItemRepository schemeItems, StyleDnaRepository dnas, Guard guard, WardrobeService wardrobe,
                 SchemeService schemeService, HypeCache cache, BrandProfileRepository brandProfiles) {
        this.config = config;
        this.current = current;
        this.snapshots = snapshots;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dnas = dnas;
        this.guard = guard;
        this.wardrobe = wardrobe;
        this.schemeService = schemeService;
        this.cache = cache;
        this.brandProfiles = brandProfiles;
    }

    // ================================================================== visibilidade
    boolean canView(CurrentUser viewer, WardrobeItem w) {
        boolean owner = viewer != null && viewer.id().equals(w.getUser().getId());
        if (owner) {
            return true;
        }
        return w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED && w.getModerationStatus() == ModerationStatus.APPROVED
                && guard.canView(viewer, w.getUser().getId(), WardrobeService.effectiveVisibility(w));
    }

    boolean canView(CurrentUser viewer, Scheme s) {
        return schemeService.canView(viewer, s);
    }

    /** Ids visíveis para quem pede (os demais somem da resposta, como se não existissem). */
    Set<UUID> visible(CurrentUser viewer, HypeEntityType type, Collection<UUID> ids) {
        if (type == HypeEntityType.PIECE) {
            return pieces.findByIdIn(ids).stream().filter(w -> canView(viewer, w)).map(WardrobeItem::getId).collect(Collectors.toSet());
        }
        return schemes.findByIdIn(ids).stream().filter(s -> canView(viewer, s)).map(Scheme::getId).collect(Collectors.toSet());
    }

    /** Resumo do card (frente: score + seta; verso: dimensões). Sem linha = NOT_CALCULATED; linha antiga = stale. */
    Map<String, Object> summary(HypeScoreCurrent c, Instant now) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("fashionCard", FashionCardLevels.of(c));
        if (c == null) {
            m.put("status", "NOT_CALCULATED");
            m.put("seals", List.of());   // RF53: selos de Hype (derivados) — sem Hype, nenhum
            return m;
        }
        m.put("status", c.getStatus().name());
        // RF53 — selos de Hype FashionAI derivados do estado atual (cards, detalhe, ranking e trending reusam este resumo)
        m.put("seals", HypeSeals.of(c));
        m.put("stale", c.getCalculatedAt().isBefore(now.minus(config.staleAfterHours(), ChronoUnit.HOURS)));
        m.put("score", num(c.getScore()));
        m.put("level", c.getLevel() == null ? null : c.getLevel().name());
        m.put("direction", c.getDirection());
        m.put("deltaPoints", num(c.getDeltaPoints()));
        m.put("deltaPercent", num(c.getDeltaPercent()));
        m.put("momentum", c.getMomentum() == null ? null : c.getMomentum().name());
        m.put("dimensions", dimensions(c.getDimensions()));
        m.put("calculatedAt", c.getCalculatedAt().toString());
        m.put("algorithmVersion", c.getAlgorithmVersion());
        return m;
    }

    /** Peças de um look com o Hype de cada uma (só as que quem vê pode ver), na ordem do look. */
    List<Map<String, Object>> lookPieces(CurrentUser viewer, List<SchemeItem> items) {
        if (items.isEmpty()) {
            return List.of();
        }
        List<WardrobeItem> visible = items.stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).filter(w -> canView(viewer, w)).toList();
        Map<UUID, HypeScoreCurrent> hype = currentOf(HypeEntityType.PIECE, visible.stream().map(WardrobeItem::getId).toList());
        Instant now = Instant.now();
        List<Map<String, Object>> out = new ArrayList<>();
        for (WardrobeItem w : visible) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", w.getId().toString());
            m.put("name", w.getName());
            m.put("category", w.getCategory());
            m.put("subcategory", w.getSubcategory());
            m.put("imageUrl", w.getStudioImageUrl() != null ? Views.studioThumb(w.getStudioImageUrl()) : w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl());
            m.put("hype", summary(hype.get(w.getId()), now));
            out.add(m);
        }
        return out;
    }

    Map<UUID, Double> monthAverage(HypeEntityType type, Set<UUID> ids) {
        LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
        Map<UUID, double[]> acc = new HashMap<>();
        for (HypeScoreSnapshot s : snapshots.findByEntityTypeAndAlgorithmVersionAndSnapshotDateBetween(type, config.algorithmVersion(), today.minusDays(29), today)) {
            if (s.getScore() != null && ids.contains(s.getEntityId())) {
                double[] a = acc.computeIfAbsent(s.getEntityId(), k -> new double[2]);
                a[0] += s.getScore().doubleValue();
                a[1]++;
            }
        }
        Map<UUID, Double> out = new HashMap<>();
        acc.forEach((id, a) -> out.put(id, a[0] / a[1]));
        return out;
    }

    /** Views completas (com o estado de quem vê) só das entidades visíveis. */
    Map<UUID, Object> views(CurrentUser viewer, HypeEntityType type, List<UUID> ids) {
        Map<UUID, Object> out = new HashMap<>();
        if (ids.isEmpty()) {
            return out;
        }
        if (type == HypeEntityType.PIECE) {
            pieces.findByIdIn(ids).stream().filter(w -> canView(viewer, w)).forEach(w -> out.put(w.getId(), Views.piece(w, wardrobe.viewerState(viewer, w), null)));
        } else {
            List<Scheme> list = schemes.findByIdIn(ids).stream().filter(s -> canView(viewer, s)).toList();
            Map<UUID, List<SchemeItem>> items = list.isEmpty() ? Map.of() : schemeItems.findBySchemeIdIn(list.stream().map(Scheme::getId).toList()).stream()
                    .sorted(Comparator.comparingInt(SchemeItem::getSortOrder)).collect(Collectors.groupingBy(si -> si.getScheme().getId()));
            list.forEach(s -> out.put(s.getId(), schemeService.view(viewer, s, items.getOrDefault(s.getId(), List.of()))));
        }
        return out;
    }

    /** População do ranking público: só elegível e com score (privacidade e "sem dados" ficam de fora). */
    List<HypeScoreCurrent> publicPool(HypeEntityType type) {
        return current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(type, config.algorithmVersion(), HypeStatus.AVAILABLE)
                .stream().filter(c -> c.isPublicEligible() && c.getScore() != null).toList();
    }

    // ================================================================== uso por outros serviços
    /** Estado atual de várias entidades do dono (ordenações do guarda-roupa, Copilot). */
    Map<UUID, HypeScoreCurrent> currentOf(HypeEntityType type, Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        return current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, new HashSet<>(ids), config.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
    }
}

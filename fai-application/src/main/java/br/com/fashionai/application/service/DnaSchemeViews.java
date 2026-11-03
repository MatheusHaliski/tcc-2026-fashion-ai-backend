package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.DnaService.CellRef;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.DnaSchemeItemRepository;
import br.com.fashionai.domain.repository.DnaSchemeRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;

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
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Leitura e montagem da view dos Esquemas de DNA: células com Hype v2 filtrado pela privacidade de quem
 * vê, logos, recorte de logos e dados da narrativa.
 */
final class DnaSchemeViews {
    private final DnaSchemeRepository dnaSchemes;
    private final DnaSchemeItemRepository dnaItems;
    private final SchemeItemRepository schemeItems;
    private final Guard guard;
    private final HypeScoreCurrentRepository hypeV2;
    private final HypeScoreConfig hypeV2Config;

    DnaSchemeViews(DnaSchemeRepository dnaSchemes, DnaSchemeItemRepository dnaItems, SchemeItemRepository schemeItems,
                   Guard guard, HypeScoreCurrentRepository hypeV2, HypeScoreConfig hypeV2Config) {
        this.dnaSchemes = dnaSchemes;
        this.dnaItems = dnaItems;
        this.schemeItems = schemeItems;
        this.guard = guard;
        this.hypeV2 = hypeV2;
        this.hypeV2Config = hypeV2Config;
    }

    Map<String, Object> getDnaScheme(CurrentUser viewer, UUID id) {
        DnaScheme d = dnaSchemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("dna.esquema_de_dna")));
        User owner = d.getUser();
        if (viewer == null || !viewer.id().equals(owner.getId())) {
            guard.requireView(viewer, owner.getId(), SchemeService.moreRestrictive(d.getVisibility(), owner.getProfileVisibility()), "dna:" + id);
            if (d.getStatus() != SchemeStatus.PUBLISHED) {
                throw guard.deny(viewer, "dna:" + id, Msg.t("dna.este_dna_ainda_nao_foi"));
            }
        }
        return dnaSchemeView(viewer, d);
    }

    List<Map<String, Object>> myDnaSchemes(CurrentUser user) {
        return dnaSchemes.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(d -> d.getStatus() != SchemeStatus.ARCHIVED)
                .map(d -> dnaSchemeView(user, d)).toList();
    }

    Map<String, Object> dnaSchemeView(CurrentUser viewer, DnaScheme d) {
        List<CellRef> refs = dnaItems.findByDnaSchemeIdOrderByCell(d.getId()).stream()
                .map(i -> new CellRef(i.getCell(), i.getScheme(), i.getEraLabel(), i.isMilestone())).toList();
        return dnaSchemeView(viewer, d, refs);
    }

    Map<String, Object> dnaSchemeView(CurrentUser viewer, DnaScheme d, List<CellRef> items) {
        Map<UUID, List<SchemeItem>> itemsBy = groupItems(items.stream().map(CellRef::scheme).toList());
        // Hype v2 de cada célula: o dono vê o Hype pessoal; quem visita, só o público elegível (privacidade, §9)
        boolean personal = viewer != null && d.getUser() != null && viewer.id().equals(d.getUser().getId());
        Map<UUID, Map<String, Object>> hypeByScheme = cellHype(hypeV2Of(items.stream().map(i -> i.scheme().getId()).toList()), personal);
        List<Map<String, Object>> cells = new ArrayList<>();
        for (CellRef it : items) {
            Scheme s = it.scheme();
            List<SchemeItem> sItems = itemsBy.getOrDefault(s.getId(), List.of());
            List<Map<String, Object>> ranking = DnaLogos.logoRanking(sItems);
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("cell", it.cell().name());
            c.put("schemeId", s.getId());
            c.put("title", s.getTitle());
            c.put("description", s.getDescription());
            c.put("coverImageUrl", s.getCoverImageUrl() != null ? s.getCoverImageUrl()
                    : sItems.stream().map(si -> si.getWardrobeItem().getImageUrl()).filter(Objects::nonNull).findFirst().orElse(null));
            c.put("occasion", Json.csv(s.getOccasion()));
            c.put("style", Json.csv(s.getStyle()));
            c.put("season", s.getSeason() == null ? null : s.getSeason().name());
            c.put("eraLabel", it.eraLabel());
            c.put("milestone", it.milestone());
            c.put("createdAt", s.getCreatedAt());
            c.put("dominantBrand", ranking.isEmpty() ? null : ranking.get(0).get("brand"));
            c.put("dominantBrandLogoUrl", ranking.isEmpty() ? null : ranking.get(0).get("logoUrl"));
            c.put("dominantColor", DnaLogos.dominantColor(sItems));
            c.put("hype", hypeByScheme.getOrDefault(s.getId(), HypeScoreService.v2Summary(null, hypeV2Config, null)));
            c.put("pieces", sItems.stream().map(si -> DnaViews.pieceBrief(si.getWardrobeItem())).toList());
            cells.add(c);
        }
        List<SchemeItem> allItems = itemsBy.values().stream().flatMap(List::stream).toList();
        Map<String, Object> bg = Json.map(d.getStudioConfigJson());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.getId());
        out.put("owner", Views.user(d.getUser()));
        out.put("title", d.getTitle());
        out.put("archetype", d.getArchetype() == null ? null : d.getArchetype().name());
        out.put("archetypeLabel", d.getArchetype() == null ? null : DnaViews.ARCHETYPE_LABEL.get(d.getArchetype()));
        out.put("boldnessIndex", d.getBoldnessIndex());
        out.put("identityPhrase", d.getIdentityPhrase());
        out.put("palette", Json.strings(d.getColorPaletteJson()));
        out.put("cardLayout", d.getCardLayout());
        out.put("targetElement", d.getTargetElement());
        out.put("narrativeType", d.getNarrativeType() == null ? null : d.getNarrativeType().name());
        out.put("seasonalTheme", d.getSeasonalTheme() == null ? null : d.getSeasonalTheme().name());
        out.put("occasion", d.getOccasion());
        out.put("style", d.getStyle());
        out.put("creationMode", d.getCreationMode() == null ? null : d.getCreationMode().name());
        out.put("visibility", d.getVisibility().name());
        out.put("status", d.getStatus().name());
        out.put("background", bg);
        out.put("cardSkin", bg.get("skin"));
        out.put("backgroundVideoUrl", d.getBackgroundVideoUrl());
        out.put("cells", cells);
        List<Map<String, Object>> logos = DnaLogos.logoRanking(allItems);
        out.put("logos", logos);
        out.put("logoCut", DnaLogos.logoCut(d));
        out.put("narrative", DnaNarratives.narrativeData(d, items, itemsBy, hypeByScheme));
        out.put("counters", Map.of("likes", d.getLikeCount(), "comments", d.getCommentCount(), "shares", d.getShareCount(), "remixes", d.getRemixCount()));
        out.put("canEdit", viewer != null && viewer.id().equals(d.getUser().getId()));
        out.put("createdAt", d.getCreatedAt());
        out.put("publishedAt", d.getPublishedAt());
        return out;
    }

    /** Itens de cada esquema na ordem dos slots (a mesma ordem do card do RF5). */
    Map<UUID, List<SchemeItem>> groupItems(List<Scheme> list) {
        if (list.isEmpty()) {
            return Map.of();
        }
        return schemeItems.findBySchemeIdIn(list.stream().map(Scheme::getId).distinct().toList()).stream()
                .sorted(Comparator.comparingInt(SchemeItem::getSortOrder))
                .collect(Collectors.groupingBy(si -> si.getScheme().getId(), LinkedHashMap::new, Collectors.toList()));
    }

    /** Estado v2 atual dos looks (uma consulta). Sem linha = ainda não calculado. Só lê o que o job gravou. */
    Map<UUID, HypeScoreCurrent> hypeV2Of(Collection<UUID> schemeIds) {
        if (hypeV2 == null || hypeV2Config == null || schemeIds == null || schemeIds.isEmpty()) {
            return Map.of();
        }
        return hypeV2.findByEntityTypeAndEntityIdInAndAlgorithmVersion(HypeEntityType.SCHEME, new HashSet<>(schemeIds), hypeV2Config.algorithmVersion())
                .stream().collect(Collectors.toMap(HypeScoreCurrent::getEntityId, h -> h, (a, b) -> a));
    }

    /**
     * Resumo v2 por look para o card DNA. {@code personal} = quem vê é o dono (Hype pessoal, inclusive de look privado);
     * para terceiros, linha não elegível ao público fica como "ainda não calculado" (igual a /api/hype/summaries).
     */
    Map<UUID, Map<String, Object>> cellHype(Map<UUID, HypeScoreCurrent> rows, boolean personal) {
        Map<UUID, Map<String, Object>> out = new HashMap<>();
        java.time.Instant now = java.time.Instant.now();
        rows.forEach((id, c) -> out.put(id, HypeScoreService.v2Summary(personal || c.isPublicEligible() ? c : null, hypeV2Config, now)));
        return out;
    }
}

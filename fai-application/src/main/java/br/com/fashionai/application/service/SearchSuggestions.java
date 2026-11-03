package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** RF8.CA04 — sugestões da busca vazia: termos parecidos (Jaro-Winkler) e "Em alta na comunidade" pelo HypeScore v2. */
final class SearchSuggestions {
    /** Quantos looks do topo público a busca vazia examina para mostrar 6 visíveis (bloqueios e visibilidade cortam alguns). */
    static final int TRENDING_POOL = 30;

    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final BrandProfileRepository brands;
    private final SchemeService schemeService;
    private final SearchVisibility visibility;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    SearchSuggestions(SchemeRepository schemes, SchemeItemRepository schemeItems, BrandProfileRepository brands, SchemeService schemeService,
                      SearchVisibility visibility, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.brands = brands;
        this.schemeService = schemeService;
        this.visibility = visibility;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
    }

    /** CA04 — termos alternativos pelo vocabulário da taxonomia e das marcas (Jaro-Winkler). */
    List<String> alternatives(String term) {
        if (term.isBlank()) {
            return List.of();
        }
        Set<String> vocab = new LinkedHashSet<>();
        vocab.addAll(Taxonomy.STYLES);
        vocab.addAll(Taxonomy.OCCASIONS);
        vocab.addAll(Taxonomy.COLORS.keySet());
        Taxonomy.SUBCATEGORIES.values().forEach(vocab::addAll);
        brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO).forEach(b -> vocab.add(b.getBrandName().toLowerCase(Locale.ROOT)));
        String n = LocalAdvisors.normalize(term);
        return vocab.stream().map(v -> Map.entry(v, LocalAdvisors.jaroWinkler(n, LocalAdvisors.normalize(v.replace('_', ' ')))))
                .filter(e -> e.getValue() >= 0.75).sorted(Map.Entry.<String, Double>comparingByValue().reversed()).limit(5).map(Map.Entry::getKey).toList();
    }

    /**
     * P1-02 — "Em alta na comunidade" da busca vazia: o mesmo critério de {@code /api/hype/trending?type=LOOK&window=7}
     * (HypeScore v2 atual, só população pública com score disponível), e não mais o v1. Sem Hype público, a seção some
     * (nenhum look é apresentado como "em alta" sem base).
     */
    List<Views.SchemeView> trending(CurrentUser viewer, Set<UUID> blocked) {
        if (hypeScores == null || hypeConfig == null) {
            return List.of();
        }
        List<UUID> top = hypeScores.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.SCHEME, hypeConfig.algorithmVersion(),
                        HypeStatus.AVAILABLE).stream()
                .filter(c -> c.getScore() != null)
                .sorted(Comparator.comparing(HypeScoreCurrent::getScore).reversed().thenComparing(HypeScoreCurrent::getEntityId))
                .limit(TRENDING_POOL).map(HypeScoreCurrent::getEntityId).toList();
        if (top.isEmpty()) {
            return List.of();
        }
        Map<UUID, Scheme> byId = schemes.findByIdIn(top).stream().collect(Collectors.toMap(Scheme::getId, Function.identity(), (a, b) -> a));
        return top.stream().map(byId::get).filter(Objects::nonNull).filter(s -> visibility.visible(viewer, s, blocked)).limit(6)
                .map(s -> schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList();
    }
}

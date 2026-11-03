package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.ExplorerService.BRAND_TOP_ITEMS;
import static br.com.fashionai.application.service.ExplorerService.MIN_BRAND_ITEMS;

/**
 * HypeScore v2 agregado do Explorador (RF53 · P1-04): a população pública de peças ({@code publicEligible} + AVAILABLE),
 * a chave normalizada da marca de uma peça e o Hype da marca (looks vinculados ou peças da marca, nunca 0 sem base).
 */
final class ExplorerHype {
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;
    private final WardrobeItemRepository pieces;

    ExplorerHype(HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig, WardrobeItemRepository pieces) {
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
        this.pieces = pieces;
    }

    /** Peça pública com Hype v2 disponível (a única população que entra em agregado público). */
    record PublicPiece(HypeScoreCurrent hype, WardrobeItem piece) {
        double score() {
            return hype.getScore().doubleValue();
        }
    }

    /**
     * População pública de peças: {@code publicEligible} + AVAILABLE no {@code hype_scores} (peça privada, de perfil privado,
     * em moderação ou de conta de teste nunca entra). Uma consulta no estado v2 + um {@code findByIdIn} das peças.
     */
    List<PublicPiece> publicPieces() {
        if (hypeScores == null || hypeConfig == null || pieces == null) {
            return List.of();
        }
        List<HypeScoreCurrent> pool = hypeScores.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE,
                hypeConfig.algorithmVersion(), HypeStatus.AVAILABLE).stream().filter(c -> SearchHype.publicRow(c) != null).toList();
        if (pool.isEmpty()) {
            return List.of();
        }
        Map<UUID, WardrobeItem> byId = pieces.findByIdIn(pool.stream().map(HypeScoreCurrent::getEntityId).toList()).stream()
                .collect(Collectors.toMap(WardrobeItem::getId, Function.identity(), (a, b) -> a));
        return pool.stream().filter(c -> byId.containsKey(c.getEntityId())).map(c -> new PublicPiece(c, byId.get(c.getEntityId()))).toList();
    }

    /** Chave da marca de uma peça: catálogo (RF47) ou texto livre, normalizado (minúsculas, sem espaços nas pontas). */
    static String brandKey(WardrobeItem w) {
        String name = w == null ? null : w.getBrand() != null ? w.getBrand().getName() : w.getBrandName();
        return name == null || name.isBlank() ? null : name.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Hype v2 da marca: {@code {value, level, items, basis, sufficient, minItems}}. Com ≥ {@link ExplorerService#MIN_BRAND_ITEMS} looks
     * vinculados (selo aprovado e vigente) com Hype público, é a média deles ({@code BONDED_LOOKS}, como o "Hype do selo");
     * senão, com ≥ {@link ExplorerService#MIN_BRAND_ITEMS} peças públicas da marca, a média das 5 mais relevantes ({@code BRAND_GROUP});
     * senão não há valor (a tela mostra "—", nunca 0). Patrocínio, cupom e ponto nunca entram.
     */
    static Map<String, Object> brandHype(List<Double> bondedLooks, List<Double> brandPieces, HypeScoreConfig cfg) {
        List<Double> looks = bondedLooks == null ? List.of() : bondedLooks;
        List<Double> ps = brandPieces == null ? List.of() : brandPieces;
        Double value = null;
        String basis = null;
        int items;
        if (looks.size() >= MIN_BRAND_ITEMS) {
            value = looks.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            basis = "BONDED_LOOKS";
            items = looks.size();
        } else if (ps.size() >= MIN_BRAND_ITEMS) {
            value = ps.stream().sorted(Comparator.reverseOrder()).limit(BRAND_TOP_ITEMS).mapToDouble(Double::doubleValue).average().orElse(0);
            basis = "BRAND_GROUP";
            items = ps.size();
        } else {
            items = Math.max(looks.size(), ps.size());
        }
        Map<String, Object> h = new LinkedHashMap<>();
        Double v = value == null ? null : SearchHype.round1(value);
        h.put("value", v);
        h.put("level", v == null ? null : (cfg == null ? HypeScoreConfig.defaults() : cfg).level(v).name());
        h.put("items", items);
        h.put("basis", basis);
        h.put("sufficient", v != null);
        h.put("minItems", MIN_BRAND_ITEMS);
        return h;
    }
}

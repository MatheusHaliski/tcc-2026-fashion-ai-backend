package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeStatus;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Regras puras de Meus looks: ordenação e faixa mínima pelo HypeScore v2, filtro por estado e origem do look. */
final class SchemeLookFilters {
    private SchemeLookFilters() {
    }

    /** Ordenações de Meus looks que dependem do HypeScore v2 (as demais caem em "recent", a ordem do repositório). */
    static final Set<String> LOOK_HYPE_SORTS = Set.of("hype", "hype_desc", "hype_asc", "growth");

    /** Ordenação pedida pela tela; nomes em português e valores desconhecidos caem em "recent". */
    static String lookSort(String raw) {
        String s = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return switch (s) {
            case "hype", "hype_desc", "maior_hype" -> "hype_desc";
            case "hype_asc", "menor_hype" -> "hype_asc";
            case "growth", "crescimento", "em_crescimento" -> "growth";
            default -> "recent";
        };
    }

    /**
     * Faixa mínima de Hype → score mínimo (limiares do HypeScoreConfig: NICHE, RELEVANT, HOT, TRENDING, VIRAL).
     * LOW_SIGNAL = "tem Hype calculado" (0); faixa vazia ou desconhecida = sem filtro (nulo).
     */
    static Integer hypeMinimum(String level, int[] thresholds) {
        if (level == null || level.isBlank() || thresholds == null || thresholds.length < 5) {
            return null;
        }
        return switch (level.trim().toUpperCase(Locale.ROOT)) {
            case "LOW_SIGNAL" -> 0;
            case "NICHE" -> thresholds[0];
            case "RELEVANT" -> thresholds[1];
            case "HOT" -> thresholds[2];
            case "TRENDING" -> thresholds[3];
            case "VIRAL" -> thresholds[4];
            default -> null;
        };
    }

    /**
     * Filtro e ordenação de Meus looks pelo HypeScore v2 (pura, testável). {@code minimum} usa o mesmo arredondamento
     * da faixa exibida ({@code min - 0,5}: 59,6 aparece como 60 e já é "Em alta"), igual ao guarda-roupa. Sem score =
     * fora do filtro e por último na ordenação (nunca 0); empate mantém a ordem recebida (mais recentes primeiro).
     */
    static List<Scheme> byHype(List<Scheme> list, String order, Integer minimum, Map<UUID, HypeScoreCurrent> hype) {
        java.util.function.Function<Scheme, BigDecimal> score = s -> hype.containsKey(s.getId()) ? hype.get(s.getId()).getScore() : null;
        List<Scheme> out = new ArrayList<>(list);
        if (minimum != null) {
            out.removeIf(s -> score.apply(s) == null || score.apply(s).doubleValue() < minimum - 0.5);
        }
        Comparator<Scheme> cmp = switch (order == null ? "" : order) {
            case "hype", "hype_desc" -> nullsLast(score, true);
            case "hype_asc" -> nullsLast(score, false);
            case "growth" -> nullsLast(s -> hype.containsKey(s.getId()) && hype.get(s.getId()).getScore() != null ? hype.get(s.getId()).getDeltaPoints() : null, true)
                    .thenComparing(nullsLast(s -> hype.containsKey(s.getId()) && hype.get(s.getId()).getDimensions() != null
                            ? hype.get(s.getId()).getDimensions().getTrend() : null, true));
            default -> null;
        };
        if (cmp != null) {
            out.sort(cmp);   // List.sort é estável: empates continuam do mais recente para o mais antigo
        }
        return out;
    }

    private static Comparator<Scheme> nullsLast(java.util.function.Function<Scheme, BigDecimal> key, boolean desc) {
        Comparator<BigDecimal> cmp = desc ? Comparator.<BigDecimal>reverseOrder() : Comparator.<BigDecimal>naturalOrder();
        return Comparator.comparing(key, Comparator.nullsLast(cmp));
    }

    static boolean stateMatches(Scheme s, String state) {
        return switch (state == null ? "" : state) {
            case "", "todos", "all" -> true;
            case "favoritos", "favorites" -> s.isFavorite();
            case "disponivel", "available" -> s.isDisponivel();
            case "indisponivel", "unavailable" -> !s.isDisponivel();
            case "publicados", "published" -> s.getStatus() == SchemeStatus.PUBLISHED;
            case "rascunhos", "drafts" -> s.getStatus() == SchemeStatus.DRAFT;
            case "arquivados", "archived" -> s.getStatus() == SchemeStatus.ARCHIVED;
            default -> true;
        };
    }

    /** Origem do look para o domínio Looks: remix (derivado de outro), ia (Copilot, Autopiloto, espelho, IA no criador) ou manual. */
    static String kindOf(Scheme s) {
        if (s.getOrigin() == SchemeOrigin.REMIX || s.getOriginalScheme() != null) {
            return "remix";
        }
        if (s.getCreationMode() == CreationMode.AI_ASSISTED || s.getOrigin() == SchemeOrigin.COPILOT
                || s.getOrigin() == SchemeOrigin.AUTOPILOTO || s.getOrigin() == SchemeOrigin.VISTA_ME
                || s.getOrigin() == SchemeOrigin.SMART_MIRROR) {
            return "ia";
        }
        return "manual";
    }
}

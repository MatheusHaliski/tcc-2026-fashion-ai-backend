package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.service.SearchService.Filters;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Regras puras da busca (RF8): os filtros combináveis em chips (CA03) sobre um look e suas peças ou sobre uma peça, e a
 * relevância do feed comunitário (recência + HypeScore v2 público + afinidade com o DNA de quem vê).
 */
final class SearchMatching {
    /** Hype de um look sem base pública na relevância do feed: meio da escala (neutro). */
    static final double NEUTRAL_HYPE = 0.5;

    private SearchMatching() {
    }

    static boolean matches(Filters f, Scheme s, List<SchemeItem> items) {
        if (f == null || f.empty()) {
            return true;
        }
        if (!Filters.blank(f.style()) && !Json.csv(s.getStyle()).contains(f.style())) {
            return false;
        }
        if (!Filters.blank(f.occasion()) && !Json.csv(s.getOccasion()).contains(f.occasion())) {
            return false;
        }
        if (!Filters.blank(f.color()) && items.stream().noneMatch(si -> f.color().equals(si.getWardrobeItem().getColor()))) {
            return false;
        }
        if (!Filters.blank(f.brand()) && items.stream().noneMatch(si -> f.brand().equalsIgnoreCase(String.valueOf(si.getWardrobeItem().getBrandName())))) {
            return false;
        }
        return Filters.blank(f.category()) || items.stream().anyMatch(si -> f.category().equals(si.getWardrobeItem().getCategory()));
    }

    static boolean matches(Filters f, WardrobeItem w) {
        if (f == null || f.empty()) {
            return true;
        }
        return (Filters.blank(f.style()) || Json.csv(w.getStyleTags()).contains(f.style()))
                && (Filters.blank(f.occasion()) || Json.csv(w.getOccasionTags()).contains(f.occasion()))
                && (Filters.blank(f.color()) || f.color().equals(w.getColor()))
                && (Filters.blank(f.brand()) || f.brand().equalsIgnoreCase(String.valueOf(w.getBrandName())))
                && (Filters.blank(f.category()) || f.category().equals(w.getCategory()));
    }

    /**
     * Relevância: recência (meia-vida de 3 dias) + HypeScore v2 PÚBLICO do look + afinidade com o DNA de quem vê.
     * {@code publicHype} nulo (sem Hype público: dados insuficientes, ainda não calculado ou Hype só pessoal) = 0,5 neutro,
     * para não punir conteúdo novo; o v1 ({@code Scheme.hypeScore}) não entra mais.
     */
    static double relevance(Scheme s, List<SchemeItem> items, Set<String> dnaStyles, Double publicHype) {
        return relevance(publishedAt(s), Json.csv(s.getStyle()), dnaStyles, publicHype);
    }

    /** A mesma conta para qualquer post do feed: recência pela hora do post (publicação ou compartilhamento). */
    static double relevance(Instant at, Collection<String> styles, Set<String> dnaStyles, Double publicHype) {
        double hours = Math.max(0, Duration.between(at, Instant.now()).toHours());
        double recency = Math.pow(0.5, hours / 72.0);
        double hype = publicHype == null ? NEUTRAL_HYPE : Math.max(0, Math.min(100, publicHype)) / 100.0;
        double affinity = dnaStyles.isEmpty() ? 0 : Similarity.jaccard(dnaStyles, new HashSet<>(styles));
        return 0.5 * recency + 0.3 * hype + 0.2 * affinity;
    }

    /** Hora de publicação do look (o rascunho antigo sem data usa a criação). */
    static Instant publishedAt(Scheme s) {
        return s.getPublishedAt() == null ? s.getCreatedAt() : s.getPublishedAt();
    }
}

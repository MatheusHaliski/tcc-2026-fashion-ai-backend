package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * RF26 — Explorador Global: Painel global (globo por País, intensidade = hype médio), Buscar marcas & lojas (grade com
 * filtros de país, categoria, cor e ordenação por hype) e Insights globais (rankings calculados sobre hypeScore/
 * hypeScoreGlobal + leitura textual pelo mesmo motor de IA). Só cruza dados já coletados; nenhum campo novo além de
 * User.country. Agregações feitas no MySQL (views e GROUP BY da V6).
 */
@Service
public class ExplorerService {
    private final AnalyticsQueryPort analytics;
    private final BrandProfileRepository brands;
    private final SealBondRepository bonds;
    private final AiEngine ai;

    public ExplorerService(AnalyticsQueryPort analytics, BrandProfileRepository brands, SealBondRepository bonds, AiEngine ai) {
        this.analytics = analytics;
        this.brands = brands;
        this.bonds = bonds;
        this.ai = ai;
    }

    /** Painel global: um ponto por país com dados suficientes; cor dominante e hype médio. */
    @Transactional(readOnly = true)
    public Map<String, Object> globalPanel(CurrentUser viewer, String selectedCountry) {
        Map<String, String> dominantColor = new HashMap<>();
        Map<String, Long> best = new HashMap<>();
        for (Map<String, Object> r : analytics.countryColors()) {
            String c = String.valueOf(r.get("country"));
            long n = ((Number) r.get("total")).longValue();
            if (n > best.getOrDefault(c, -1L)) {
                best.put(c, n);
                dominantColor.put(c, String.valueOf(r.get("color")));
            }
        }
        List<Map<String, Object>> points = new ArrayList<>();
        for (Map<String, Object> r : analytics.countries()) {
            String c = String.valueOf(r.get("country"));
            Map<String, Object> m = new LinkedHashMap<>(r);
            String color = dominantColor.get(c);
            m.put("dominantColor", color);
            m.put("dominantColorHex", color == null ? null : Taxonomy.hex(color));
            m.put("intensity", r.get("avg_hype") == null ? 0 : r.get("avg_hype"));
            points.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("countries", points);
        if (selectedCountry != null && !selectedCountry.isBlank()) {
            out.put("selected", Map.of("country", selectedCountry, "hypeBySeason", analytics.hypeBySeason(selectedCountry),
                    "topColors", analytics.colorRanking(selectedCountry, 5)));
        }
        out.put("legend", "intensidade = hypeScore médio do país");
        return out;
    }

    /** Buscar marcas & lojas — grade de cards (userType = BRAND) com filtros e ordenação por hype. */
    @Transactional(readOnly = true)
    public Map<String, Object> brandsAndStores(CurrentUser viewer, String term, String country, String category, String sort) {
        Map<String, Map<String, Object>> usage = new HashMap<>();
        analytics.brandUsage(500).forEach(r -> usage.put(String.valueOf(r.get("brand")).toLowerCase(Locale.ROOT), r));
        List<Map<String, Object>> cards = new ArrayList<>();
        for (BrandProfile b : brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)) {
            if (term != null && !term.isBlank() && !b.getBrandName().toLowerCase(Locale.ROOT).contains(term.trim().toLowerCase(Locale.ROOT))) {
                continue;
            }
            if (country != null && !country.isBlank() && !country.equalsIgnoreCase(String.valueOf(b.getCountry()))) {
                continue;
            }
            if (category != null && !category.isBlank() && !category.equalsIgnoreCase(String.valueOf(b.getFashionCategory()))) {
                continue;
            }
            Map<String, Object> u = usage.getOrDefault(b.getBrandName().toLowerCase(Locale.ROOT), Map.of());
            long schemes = bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(b.getOwner().getId(), SealBondStatus.APPROVED).stream()
                    .map(x -> x.getScheme().getId()).distinct().count();
            double hype = bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(b.getOwner().getId(), SealBondStatus.APPROVED).stream().map(x -> x.getScheme())
                    .map(Scheme::getHypeScore).filter(Objects::nonNull).mapToDouble(BigDecimal::doubleValue).average()
                    .orElse(u.get("avg_hype") instanceof Number n ? n.doubleValue() : 0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", b.getOwner().getId());
            m.put("slug", b.getSlug());
            m.put("name", b.getBrandName());
            m.put("logoUrl", b.getLogoUrl());
            m.put("country", b.getCountry());
            m.put("category", b.getFashionCategory());
            m.put("schemes", schemes);
            m.put("pieces", u.getOrDefault("pieces", 0));
            m.put("hypeScore", Math.round(hype));
            m.put("stars", Math.max(1, Math.min(5, (int) Math.round(hype / 20.0))));
            m.put("storeUrl", b.getStoreUrl());
            cards.add(m);
        }
        Comparator<Map<String, Object>> cmp = "SCHEMES".equalsIgnoreCase(sort)
                ? Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("schemes")).longValue())
                : Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("hypeScore")).longValue());
        cards.sort(cmp.reversed());
        return Map.of("brands", cards, "filters", Map.of("term", String.valueOf(term), "country", String.valueOf(country), "category", String.valueOf(category)),
                "sorts", List.of("HYPE", "SCHEMES"));
    }

    /** Insights globais — rankings + leitura textual (Insight Generator, RF24; fallback local). */
    @Transactional(readOnly = true)
    public Map<String, Object> insights(CurrentUser viewer) {
        Map<String, Object> rankings = new LinkedHashMap<>();
        rankings.put("topBrands", analytics.brandUsage(5).stream().map(r -> Map.of("label", r.get("brand"), "value", r.get("pieces"))).toList());
        rankings.put("hypeBySeason", analytics.hypeBySeason(null).stream().map(r -> Map.of("label", String.valueOf(r.get("season")),
                "value", r.get("avg_hype") == null ? 0 : r.get("avg_hype"))).toList());
        rankings.put("topColors", analytics.colorRanking(null, 5).stream().map(r -> Map.of("label", r.get("color"), "value", r.get("total"),
                "hex", String.valueOf(Taxonomy.hex(String.valueOf(r.get("color")))))).toList());
        rankings.put("topCountries", analytics.countries().stream().sorted(Comparator.comparingLong((Map<String, Object> r) ->
                ((Number) r.get("public_schemes")).longValue()).reversed()).limit(5).map(r -> Map.of("label", r.get("country"), "value", r.get("public_schemes"))).toList());
        String local = LocalAdvisors.insightText(rankings);
        AiOutcome<String> outcome = ai.text(new AiEngine.TextCall<>(viewer.id(), AiCapability.INSIGHT_GENERATOR,
                "Você é o Insight Generator do Fashion AI. Escreva UMA leitura de tendência (até 2 frases, português) a partir dos rankings agregados. "
                        + "Não invente números; use só os dados.", "Rankings: " + Json.write(rankings), List.of(), 250,
                List.of("rankings agregados (sem dados pessoais)"), text -> text == null || text.isBlank() ? null : InputSanitizer.clean(text, 400), () -> local, null));
        return Map.of("rankings", rankings, "aiInsight", outcome.value() == null ? local : outcome.value(), "explanation", outcome.explanation(),
                "fallbackUsed", outcome.fallbackUsed(), "note", "Cores de status do dataviz nunca são reaproveitadas como identidade de série.");
    }
}

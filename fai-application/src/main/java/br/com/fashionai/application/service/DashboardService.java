package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Dashboard gerencial (perfil ADMIN) e painel do emissor (MARCA/CELEBRIDADE): KPIs do período, séries diárias e
 * distribuições vindas de consultas agrupadas no MySQL (stored procedures sp_admin_kpis / sp_timeseries e views),
 * com filtros (período, país, tipo de perfil) e alertas que apoiam decisões (custo/fallback de IA, fila de
 * moderação, aprovações pendentes, conversão selo → resgate). O layout de widgets é salvo por usuário.
 */
@Service
public class DashboardService {
    public static final List<String> WIDGETS = List.of("alerts", "kpis", "growth", "content", "countries", "ai_by_country", "ai_cost", "ai_usage", "brands",
            "hype_bands", "inventory_bands", "seal_funnel", "challenges", "points", "profiles");
    static final Set<String> METRICS = Set.of("users", "pieces", "schemes", "daily_looks", "ai_calls", "ai_cost");

    private final AnalyticsQueryPort analytics;
    private final UserPreferencesRepository preferences;
    private final SealService seals;
    private final AiEngine ai;
    private final Guard guard;

    public DashboardService(AnalyticsQueryPort analytics, UserPreferencesRepository preferences, SealService seals, AiEngine ai, Guard guard) {
        this.analytics = analytics;
        this.preferences = preferences;
        this.seals = seals;
        this.ai = ai;
        this.guard = guard;
    }

    public record Query(LocalDate from, LocalDate to, String country, ProfileType profileType) {
    }

    static AnalyticsQueryPort.Filter filter(Query q) {
        LocalDate to = q == null || q.to() == null ? LocalDate.now(FaiPointsService.ZONE) : q.to();
        LocalDate from = q == null || q.from() == null ? to.minusDays(29) : q.from();
        if (from.isAfter(to)) {
            throw ApiException.badRequest("PERIODO_INVALIDO", "A data inicial precisa ser anterior à final.");
        }
        if (ChronoUnit.DAYS.between(from, to) > 366) {
            throw ApiException.badRequest("PERIODO_LONGO", "Escolha um período de até 1 ano.");
        }
        Instant f = from.atStartOfDay(FaiPointsService.ZONE).toInstant();
        Instant t = to.plusDays(1).atStartOfDay(FaiPointsService.ZONE).toInstant().minusNanos(1000);
        String country = q == null || q.country() == null || q.country().isBlank() ? null : q.country().trim();
        return new AnalyticsQueryPort.Filter(f, t, country, q == null || q.profileType() == null ? null : q.profileType().name());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> admin(CurrentUser user, Query q) {
        guard.requireAdmin(user);
        AnalyticsQueryPort.Filter f = filter(q);
        Map<String, Object> kpis = analytics.kpis(f);
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> filter = new LinkedHashMap<>();
        filter.put("from", f.from());
        filter.put("to", f.to());
        filter.put("country", f.country());
        filter.put("profileType", f.profileType());
        out.put("filter", filter);
        out.put("kpis", kpis);
        Map<String, Object> series = new LinkedHashMap<>();
        for (String m : List.of("users", "pieces", "schemes", "daily_looks", "ai_calls", "ai_cost")) {
            series.put(m, analytics.series(m, f));
        }
        out.put("series", series);
        List<Map<String, Object>> aiUsage = analytics.aiUsage(f);
        out.put("aiUsage", aiUsage);
        out.put("aiByCountry", analytics.aiCostByCountry(f));
        out.put("aiProviders", ai.providerAvailability());
        out.put("brands", analytics.brandUsage(10));
        out.put("countries", analytics.countries());
        out.put("hypeBands", analytics.hypeBands(f));
        out.put("inventoryBands", analytics.inventoryBands());
        out.put("sealFunnel", analytics.sealFunnel(f));
        out.put("challenges", analytics.challengeStats());
        out.put("points", analytics.pointsByAction(f));
        out.put("profiles", analytics.usersByProfile(f));
        out.put("alerts", alerts(kpis, aiUsage));
        out.put("layout", layout(user));
        return out;
    }

    /** Regras que transformam números em decisão. */
    static List<Map<String, Object>> alerts(Map<String, Object> kpis, List<Map<String, Object>> aiUsage) {
        List<Map<String, Object>> out = new ArrayList<>();
        double fallback = num(kpis.get("ai_fallback_pct"));
        if (fallback >= 20) {
            out.add(alert("warning", "IA em fallback em " + fallback + "% das chamadas", "Verifique chaves/cota do provedor primário ou troque o provedor da capacidade."));
        }
        long moderation = (long) num(kpis.get("moderation_pending"));
        if (moderation > 20) {
            out.add(alert("warning", moderation + " itens na fila de moderação", "Reforce a revisão manual ou ajuste o limiar de confiança do moderador."));
        }
        long approvals = (long) num(kpis.get("approvals_pending"));
        if (approvals > 0) {
            out.add(alert("info", approvals + " marca(s)/celebridade(s) aguardando validação", "Abra a fila de aprovações."));
        }
        aiUsage.stream().filter(r -> num(r.get("cost_usd")) > 0).max((a, b) -> Double.compare(num(a.get("cost_usd")), num(b.get("cost_usd"))))
                .ifPresent(r -> out.add(alert("info", "Maior custo de IA: " + r.get("capability") + " (" + r.get("provider") + ") — US$ " + r.get("cost_usd"),
                        "Avalie usar o modelo leve ou o motor local nessa capacidade.")));
        long bonds = (long) num(kpis.get("bonds_approved"));
        long redemptions = (long) num(kpis.get("redemptions"));
        if (bonds > 0) {
            out.add(alert("info", "Conversão selo → resgate: " + Math.round(100.0 * redemptions / bonds) + "%", "Campanhas com conversão baixa pedem promoção mais atraente."));
        }
        return out;
    }

    static Map<String, Object> alert(String level, String title, String action) {
        return Map.of("level", level, "title", title, "action", action);
    }

    static double num(Object o) {
        if (o instanceof Number n) {
            return n.doubleValue();
        }
        if (o instanceof BigDecimal b) {
            return b.doubleValue();
        }
        try {
            return o == null ? 0 : Double.parseDouble(String.valueOf(o));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    /** Painel do emissor (marca/celebridade): funil de vínculos, série diária e métricas de campanha. */
    @Transactional(readOnly = true)
    public Map<String, Object> issuer(CurrentUser user, Query q) {
        if (user.profileType() == ProfileType.PESSOAL && !user.admin()) {
            throw guard.deny(user, "dashboard:issuer", "Painel exclusivo de marcas e celebridades.");
        }
        AnalyticsQueryPort.Filter f = filter(q);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("metrics", seals.issuerMetrics(user));
        out.put("bondSeries", analytics.bondSeries(user.id(), f));
        out.put("layout", layout(user));
        return out;
    }

    // ------------------------------------------------------------------ layout personalizável (widgets salvos por usuário)
    Map<String, Object> layout(CurrentUser user) {
        Map<String, Object> saved = preferences.findByUserId(user.id()).map(p -> Json.map(p.getDashboardLayoutJson())).orElse(Map.of());
        if (saved.isEmpty()) {
            return Map.of("widgets", WIDGETS, "hidden", List.of(), "defaultFilter", Map.of("days", 30));
        }
        // widgets novos entram no fim de um layout salvo antes deles existirem
        List<String> order = new ArrayList<>(Json.strings(Json.write(saved.getOrDefault("widgets", List.of()))));
        WIDGETS.stream().filter(w -> !order.contains(w)).forEach(order::add);
        Map<String, Object> out = new LinkedHashMap<>(saved);
        out.put("widgets", order);
        return out;
    }

    @Transactional
    public Map<String, Object> saveLayout(CurrentUser user, List<String> widgets, List<String> hidden, Map<String, Object> defaultFilter) {
        UserPreferences p = preferences.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound("Preferências"));
        List<String> order = widgets == null ? WIDGETS : widgets.stream().filter(WIDGETS::contains).distinct().toList();
        List<String> off = hidden == null ? List.of() : hidden.stream().filter(WIDGETS::contains).distinct().toList();
        Map<String, Object> layout = new LinkedHashMap<>();
        layout.put("widgets", order);
        layout.put("hidden", off);
        layout.put("defaultFilter", defaultFilter == null ? Map.of("days", 30) : defaultFilter);
        p.setDashboardLayoutJson(Json.write(layout));
        preferences.save(p);
        return layout;
    }
}

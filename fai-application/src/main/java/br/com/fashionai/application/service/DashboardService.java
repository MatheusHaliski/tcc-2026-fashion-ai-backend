package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BackupRecordRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.management.ManagementFactory;
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
    public static final List<String> WIDGETS = List.of("alerts", "kpis", "growth", "content", "profiles",
            "funnel", "countries", "top_users", "heatmap",
            "categories", "brands", "hype_bands", "moderation",
            "engagement", "seal_funnel", "challenges", "points", "inventory_bands",
            "ai_cost", "ai_usage", "ai_by_country",
            "system", "jobs", "security");
    static final Set<String> METRICS = Set.of("users", "pieces", "schemes", "daily_looks", "ai_calls", "ai_cost");

    private final AnalyticsQueryPort analytics;
    private final UserPreferencesRepository preferences;
    private final SealService seals;
    private final AiEngine ai;
    private final Guard guard;
    private final BackupRecordRepository backups;

    public DashboardService(AnalyticsQueryPort analytics, UserPreferencesRepository preferences, SealService seals, AiEngine ai, Guard guard,
                            BackupRecordRepository backups) {
        this.analytics = analytics;
        this.preferences = preferences;
        this.seals = seals;
        this.ai = ai;
        this.guard = guard;
        this.backups = backups;
    }

    public record Query(LocalDate from, LocalDate to, String country, ProfileType profileType) {
    }

    static AnalyticsQueryPort.Filter filter(Query q) {
        LocalDate to = q == null || q.to() == null ? LocalDate.now(FaiPointsService.ZONE) : q.to();
        LocalDate from = q == null || q.from() == null ? to.minusDays(29) : q.from();
        if (from.isAfter(to)) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("dashboard.a_data_inicial_precisa_ser"));
        }
        if (ChronoUnit.DAYS.between(from, to) > 366) {
            throw ApiException.badRequest("PERIODO_LONGO", Msg.t("dashboard.escolha_um_periodo_de_ate"));
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
        // mesmo número de dias imediatamente antes do período: base da variação dos KPIs
        long days = ChronoUnit.DAYS.between(f.from(), f.to()) + 1;
        AnalyticsQueryPort.Filter prev = new AnalyticsQueryPort.Filter(f.from().minus(days, ChronoUnit.DAYS), f.from().minusNanos(1000), f.country(), f.profileType());
        out.put("kpisPrevious", analytics.kpis(prev));
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
        // abas Usuários / Conteúdo / Engajamento / Sistema (V23)
        out.put("funnel", analytics.activationFunnel(f));
        out.put("heatmap", analytics.activityHeatmap(f));
        out.put("topUsers", analytics.topUsers(f, 10));
        out.put("categories", analytics.categories(f));
        out.put("moderation", Map.of("byStatus", analytics.moderationByStatus(f), "pending", analytics.moderationRecent(8)));
        out.put("engagement", analytics.engagementSeries(f));
        List<Map<String, Object>> security = analytics.securitySeries(f);
        out.put("security", Map.of("series", security, "failures", analytics.auditFailures(f), "recent", analytics.auditRecent(f, 12)));
        out.put("jobs", Map.of("byStatus", analytics.jobsByStatus(f), "failed", analytics.jobsFailedRecent(6)));
        out.put("system", system());
        List<Map<String, Object>> alerts = alerts(kpis, aiUsage);
        securityAlerts(security).forEach(alerts::add);
        out.put("alerts", alerts);
        out.put("layout", layout(user));
        return out;
    }

    /** Regras que transformam números em decisão. */
    static List<Map<String, Object>> alerts(Map<String, Object> kpis, List<Map<String, Object>> aiUsage) {
        List<Map<String, Object>> out = new ArrayList<>();
        double fallback = num(kpis.get("ai_fallback_pct"));
        if (fallback >= 20) {
            out.add(alert("warning", Msg.t("dashboard.ia_em_fallback_em_das", String.format(Msg.locale(), "%.1f", fallback)), Msg.t("dashboard.verifique_chaves_cota_do_provedor")));
        }
        long moderation = (long) num(kpis.get("moderation_pending"));
        if (moderation > 20) {
            out.add(alert("warning", Msg.t("dashboard.itens_na_fila_de_moderacao", (moderation)), Msg.t("dashboard.reforce_a_revisao_manual_ou")));
        }
        long approvals = (long) num(kpis.get("approvals_pending"));
        if (approvals > 0) {
            out.add(alert("info", Msg.t("dashboard.marca_s_celebridade_s_aguardando", (approvals)), Msg.t("dashboard.abra_a_fila_de_aprovacoes")));
        }
        aiUsage.stream().filter(r -> num(r.get("cost_usd")) > 0).max((a, b) -> Double.compare(num(a.get("cost_usd")), num(b.get("cost_usd"))))
                .ifPresent(r -> out.add(alert("info", Msg.t("dashboard.maior_custo_de_ia_us", r.get("capability"), r.get("provider"), String.format(Msg.locale(), "%.2f", num(r.get("cost_usd")))),
                        Msg.t("dashboard.avalie_usar_o_modelo_leve"))));
        long bonds = (long) num(kpis.get("bonds_approved"));
        long redemptions = (long) num(kpis.get("redemptions"));
        if (bonds > 0) {
            out.add(alert("info", Msg.t("dashboard.conversao_selo_resgate", Math.round(100.0 * redemptions / bonds)), Msg.t("dashboard.campanhas_com_conversao_baixa_pedem")));
        }
        return out;
    }

    /** Pico de logins falhos ou de acessos negados num único dia vira alerta de segurança. */
    static List<Map<String, Object>> securityAlerts(List<Map<String, Object>> series) {
        List<Map<String, Object>> out = new ArrayList<>();
        double maxLogin = series.stream().mapToDouble(r -> num(r.get("login_failures"))).max().orElse(0);
        double maxDenied = series.stream().mapToDouble(r -> num(r.get("denied"))).max().orElse(0);
        if (maxLogin >= 20) {
            out.add(alert("critical", Msg.t("dashboard.pico_de_logins_falhos", (long) maxLogin), Msg.t("dashboard.verifique_ips_no_audit_log")));
        }
        if (maxDenied >= 30) {
            out.add(alert("warning", Msg.t("dashboard.pico_de_acessos_negados", (long) maxDenied), Msg.t("dashboard.revise_permissoes_e_tentativas")));
        }
        return out;
    }

    /** Saúde do processo e das dependências: latência do banco, memória, tempo no ar, provedores de IA e último backup. */
    Map<String, Object> system() {
        Map<String, Object> m = new LinkedHashMap<>();
        long db = -1;
        try {
            db = analytics.dbLatencyMs();
        } catch (RuntimeException ex) {
            m.put("dbError", ex.getClass().getSimpleName());
        }
        m.put("dbLatencyMs", db);
        Runtime rt = Runtime.getRuntime();
        long used = rt.totalMemory() - rt.freeMemory();
        m.put("heapUsedMb", used / (1024 * 1024));
        m.put("heapMaxMb", rt.maxMemory() / (1024 * 1024));
        m.put("uptimeMinutes", ManagementFactory.getRuntimeMXBean().getUptime() / 60000);
        m.put("processors", rt.availableProcessors());
        m.put("aiRemoteEnabled", ai.remoteEnabled());
        m.put("aiProviders", ai.providerAvailability());
        backups.findTop50ByOrderByStartedAtDesc().stream().findFirst().ifPresent(b -> {
            Map<String, Object> last = new LinkedHashMap<>();
            last.put("status", b.getStatus());
            last.put("startedAt", b.getStartedAt());
            last.put("sizeBytes", b.getSizeBytes());
            m.put("lastBackup", last);
        });
        return m;
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
            throw guard.deny(user, "dashboard:issuer", Msg.t("dashboard.painel_exclusivo_de_marcas_e"));
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
        UserPreferences p = preferences.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.preferencias")));
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

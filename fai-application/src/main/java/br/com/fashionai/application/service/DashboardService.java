package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BackupRecordRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.management.ManagementFactory;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Dashboard gerencial (perfil ADMIN) e painel do emissor (MARCA/CELEBRIDADE): KPIs do período, séries diárias e
 * distribuições vindas de consultas agrupadas no MySQL (stored procedures sp_admin_kpis / sp_timeseries e views),
 * com filtros (período, país, tipo de perfil) e alertas que apoiam decisões (custo/fallback de IA, fila de
 * moderação, aprovações pendentes, conversão selo → resgate). O layout de widgets é salvo por usuário.
 *
 * <p>HypeScore v2 (RF53 · Lote 7): o widget {@code hype_bands} do admin lê {@code hypeV2} (faixas v2 de peças e looks só
 * com {@code publicEligible}, cobertura AVAILABLE/INSUFFICIENT/NOT_CALCULATED, versão do algoritmo e último cálculo) e o
 * painel do emissor ganha {@code hype} (média v2 + Δ7d + top 3 dos looks vinculados, só públicos). Tudo lê o estado
 * gravado pelo job — GET nunca recalcula — e "sem dados" sai nulo, nunca 0. O {@code hypeBands} v1 continua no payload
 * só por compatibilidade (deprecado; sai em P3-16).</p>
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
    private final HypeScoreConfig hypeConfig;

    public DashboardService(AnalyticsQueryPort analytics, UserPreferencesRepository preferences, SealService seals, AiEngine ai, Guard guard,
                            BackupRecordRepository backups, HypeScoreConfig hypeConfig) {
        this.hypeConfig = hypeConfig;
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
        out.put("hypeBands", analytics.hypeBands(f));   // v1 deprecado: o widget hype_bands lê hypeV2
        out.put("hypeV2", hypeV2(f));
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
        out.put("hype", issuerHype(analytics.bondedLooksHypeV2(user.id(), hypeConfig.algorithmVersion()), hypeConfig));
        out.put("layout", layout(user));
        return out;
    }

    // ------------------------------------------------------------------ HypeScore v2 (RF53 · Lote 7)
    /** Quantos looks vinculados aparecem no "top" do painel do emissor. */
    static final int ISSUER_TOP = 3;

    /** Widget {@code hype_bands} do admin (P2-21): faixas v2 (só públicas), cobertura e estado do último cálculo. */
    Map<String, Object> hypeV2(AnalyticsQueryPort.Filter f) {
        String version = hypeConfig.algorithmVersion();
        return hypeV2Block(analytics.hypeLevelsV2(f, version), analytics.hypeCoverageV2(f, version), analytics.hypeJobV2(version),
                hypeConfig, Instant.now());
    }

    /**
     * Monta o bloco v2 do admin. {@code levels}: as 6 faixas sempre na ordem da régua (Sinal baixo → Viral), com a
     * contagem de peças e de looks em cada uma (só AVAILABLE + publicEligible: agregado de terceiros). {@code coverage}:
     * por tipo, quantas entidades ativas têm Hype disponível, dados insuficientes ou ainda não calculado. {@code job}:
     * versão do algoritmo e último cálculo gravado.
     */
    static Map<String, Object> hypeV2Block(List<Map<String, Object>> levelRows, List<Map<String, Object>> coverageRows,
                                           Map<String, Object> jobRow, HypeScoreConfig config, Instant now) {
        Map<String, long[]> byLevel = new LinkedHashMap<>();
        for (HypeLevel l : HypeLevel.values()) {
            byLevel.put(l.name(), new long[2]);
        }
        for (Map<String, Object> r : levelRows == null ? List.<Map<String, Object>>of() : levelRows) {
            long[] c = byLevel.get(String.valueOf(r.get("level")));
            if (c != null) {
                c["SCHEME".equals(String.valueOf(r.get("entity_type"))) ? 1 : 0] += (long) num(r.get("total"));
            }
        }
        List<Map<String, Object>> levels = new ArrayList<>();
        long pieces = 0, looks = 0;
        for (Map.Entry<String, long[]> e : byLevel.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("level", e.getKey());
            m.put("pieces", e.getValue()[0]);
            m.put("looks", e.getValue()[1]);
            levels.add(m);
            pieces += e.getValue()[0];
            looks += e.getValue()[1];
        }
        List<Map<String, Object>> coverage = new ArrayList<>();
        for (String type : List.of("PIECE", "SCHEME")) {
            Map<String, Object> row = (coverageRows == null ? List.<Map<String, Object>>of() : coverageRows).stream()
                    .filter(r -> type.equals(String.valueOf(r.get("entity_type")))).findFirst().orElse(Map.of());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("entityType", type);
            m.put("total", (long) num(row.get("total")));
            m.put("available", (long) num(row.get("available")));
            m.put("insufficient", (long) num(row.get("insufficient")));
            m.put("notCalculated", (long) num(row.get("not_calculated")));
            m.put("publicEligible", (long) num(row.get("public_eligible")));
            coverage.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("algorithmVersion", config.algorithmVersion());
        out.put("levels", levels);
        out.put("levelTotals", Map.of("pieces", pieces, "looks", looks));
        out.put("coverage", coverage);
        out.put("job", hypeJob(jobRow, config, now));
        return out;
    }

    /**
     * Estado do último cálculo v2 (também usado por Admin › Sistema, P3-14). {@code lastCalculatedAt} nulo = nunca
     * calculado; {@code stale} = o último cálculo passou de {@code staleAfterHours} (nulo quando nunca calculou).
     */
    public static Map<String, Object> hypeJob(Map<String, Object> row, HypeScoreConfig config, Instant now) {
        Map<String, Object> r = row == null ? Map.of() : row;
        String last = r.get("last_calculated_at") == null ? null : String.valueOf(r.get("last_calculated_at"));
        Instant at = null;
        if (last != null) {
            try {
                at = Instant.parse(last);
            } catch (DateTimeParseException ignored) {
                // formato inesperado: mostra o texto cru e não decide "desatualizado"
            }
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("algorithmVersion", config.algorithmVersion());
        m.put("lastCalculatedAt", at == null ? last : at.toString());
        m.put("lastSnapshotDate", r.get("last_snapshot_date") == null ? null : String.valueOf(r.get("last_snapshot_date")));
        m.put("rows", (long) num(r.get("rows_total")));
        m.put("staleAfterHours", config.staleAfterHours());
        m.put("stale", at == null ? null : Duration.between(at, now).toHours() >= config.staleAfterHours());
        return m;
    }

    /**
     * Painel do emissor (P2-20): Hype v2 dos looks com vínculo de selo aprovado. Só entram na média, no Δ e no top os
     * looks {@code publicEligible} com Hype disponível — o resto vira contagem ({@code insufficient}, {@code notPublic}).
     * Sem nenhum público com Hype, {@code avgScore}/{@code level} saem nulos (a interface diz "Dados insuficientes",
     * nunca 0). O Δ é a média do Δ7d dos looks que têm base de comparação; sem base, nulo (sem seta).
     */
    static Map<String, Object> issuerHype(List<Map<String, Object>> rows, HypeScoreConfig config) {
        List<Map<String, Object>> all = rows == null ? List.of() : rows;
        List<Map<String, Object>> eligible = all.stream().filter(r -> truthy(r.get("public_eligible"))).toList();
        List<Map<String, Object>> available = eligible.stream()
                .filter(r -> "AVAILABLE".equals(String.valueOf(r.get("status"))) && r.get("score") != null).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("algorithmVersion", config.algorithmVersion());
        out.put("deltaWindowDays", config.deltaWindowDays());
        out.put("bondedLooks", all.size());
        out.put("withHype", available.size());
        out.put("insufficient", eligible.stream().filter(r -> "INSUFFICIENT_DATA".equals(String.valueOf(r.get("status")))).count());
        out.put("notPublic", all.size() - eligible.size());
        Double avg = available.isEmpty() ? null : round1(available.stream().mapToDouble(r -> num(r.get("score"))).average().orElse(0));
        out.put("avgScore", avg);
        out.put("level", avg == null ? null : config.level(avg).name());
        List<Map<String, Object>> withDelta = available.stream().filter(r -> r.get("delta_points") != null).toList();
        Double delta = withDelta.isEmpty() ? null : round1(withDelta.stream().mapToDouble(r -> num(r.get("delta_points"))).average().orElse(0));
        out.put("deltaPoints", delta);
        out.put("direction", delta == null ? null : Math.abs(delta) < config.stablePoints() ? "STABLE" : delta > 0 ? "UP" : "DOWN");
        out.put("calculatedAt", available.stream().map(r -> r.get("calculated_at")).filter(java.util.Objects::nonNull).map(String::valueOf)
                .max(Comparator.naturalOrder()).orElse(null));
        out.put("top", available.stream()
                .sorted(Comparator.comparingDouble((Map<String, Object> r) -> num(r.get("score"))).reversed()
                        .thenComparing(r -> String.valueOf(r.get("title"))))
                .limit(ISSUER_TOP).map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("schemeId", String.valueOf(r.get("scheme_id")));
                    m.put("title", r.get("title"));
                    m.put("owner", r.get("owner"));
                    m.put("coverUrl", r.get("cover_url"));
                    double score = num(r.get("score"));
                    m.put("score", round1(score));
                    m.put("level", r.get("level") == null ? config.level(score).name() : String.valueOf(r.get("level")));
                    m.put("deltaPoints", r.get("delta_points") == null ? null : round1(num(r.get("delta_points"))));
                    m.put("direction", r.get("direction"));
                    return m;
                }).toList());
        return out;
    }

    static boolean truthy(Object o) {
        return o instanceof Boolean b ? b : o instanceof Number n ? n.intValue() != 0 : o != null && "true".equalsIgnoreCase(String.valueOf(o));
    }

    static double round1(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
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

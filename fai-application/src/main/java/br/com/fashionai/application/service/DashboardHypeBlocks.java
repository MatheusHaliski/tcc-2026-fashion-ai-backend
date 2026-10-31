package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.enums.HypeLevel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static br.com.fashionai.application.service.DashboardAlerts.num;

/**
 * Montagem pura dos blocos HypeScore v2 (RF53 · Lote 7) do dashboard do admin e do painel do emissor, extraída do
 * {@link DashboardService} no lote 16. Só lê linhas já gravadas pelo job (GET nunca recalcula) e "sem dados" sai nulo,
 * nunca 0. Também usada por {@link AdminService} (Admin › Sistema, P3-14) para o estado do último cálculo.
 */
final class DashboardHypeBlocks {
    /** Quantos looks vinculados aparecem no "top" do painel do emissor. */
    static final int ISSUER_TOP = 3;

    private DashboardHypeBlocks() {
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
    static Map<String, Object> hypeJob(Map<String, Object> row, HypeScoreConfig config, Instant now) {
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
        out.put("calculatedAt", available.stream().map(r -> r.get("calculated_at")).filter(Objects::nonNull).map(String::valueOf)
                .max(Comparator.naturalOrder()).orElse(null));
        out.put("top", available.stream()
                .sorted(Comparator.comparingDouble((Map<String, Object> r) -> num(r.get("score"))).reversed()
                        .thenComparing(r -> String.valueOf(r.get("title"))))
                .limit(ISSUER_TOP).map(r -> topLook(r, config)).toList());
        return out;
    }

    private static Map<String, Object> topLook(Map<String, Object> r, HypeScoreConfig config) {
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
    }

    static boolean truthy(Object o) {
        return o instanceof Boolean b ? b : o instanceof Number n ? n.intValue() != 0 : o != null && "true".equalsIgnoreCase(String.valueOf(o));
    }

    static double round1(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }
}

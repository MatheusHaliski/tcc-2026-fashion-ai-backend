package br.com.fashionai.application.insights;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.WorldRegions;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.ToDoubleFunction;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Agregações puras dos insights (sem banco): crescimento por recorte a partir dos sinais gravados pelo job do Hype
 * ({@code windowCurrent}/{@code windowPrevious} e as quatro semanas de {@code weekly}), médias por recorte e formatação
 * dos números. Mesma suavização do {@code HypeCalculator} ({@code (atual + α) ÷ (anterior + α)}): pouco volume não vira
 * "+300%".
 */
final class InsightMath {
    private InsightMath() {
    }

    /** Crescimento de um recorte (categoria, estilo, região…) entre a janela atual e a anterior. */
    record Growth(String key, int items, double current, double previous, double percent, int days) {
    }

    /** Média de uma métrica num recorte. */
    record Avg(String key, int items, double value) {
    }

    static final HypeDimensions EMPTY = new HypeDimensions();

    static HypeDimensions dims(HypeScoreCurrent c) {
        return c.getDimensions() == null ? EMPTY : c.getDimensions();
    }

    static double dim(BigDecimal v, double fallback) {
        return v == null ? fallback : v.doubleValue();
    }

    static double trend(HypeScoreCurrent c) {
        return dim(dims(c).getTrend(), 50);
    }

    static double popularity(HypeScoreCurrent c) {
        return dim(dims(c).getPopularity(), 0);
    }

    static double score(HypeScoreCurrent c) {
        return c.getScore() == null ? 0 : c.getScore().doubleValue();
    }

    /**
     * {atual, anterior, dias} da atividade ponderada: janela 30 compara as duas últimas semanas com as duas anteriores
     * (série semanal do job); as demais, a janela do Hype (7 dias) com a anterior. Nulo = sem sinais gravados.
     */
    static double[] activity(HypeScoreCurrent c, int window, int windowDays) {
        Map<String, Object> sig = Json.map(c.getSignalsJson());
        if (sig == null) {
            return null;
        }
        if (window >= 30 && sig.get("weekly") instanceof List<?> w && w.size() >= 4) {
            return new double[]{num(w.get(0)) + num(w.get(1)), num(w.get(2)) + num(w.get(3)), 2.0 * windowDays};
        }
        if (sig.get("windowCurrent") instanceof Number a && sig.get("windowPrevious") instanceof Number b) {
            return new double[]{a.doubleValue(), b.doubleValue(), windowDays};
        }
        return null;
    }

    private static double num(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0;
    }

    /**
     * Crescimento por recorte, do maior para o menor (empate: chave). Só entra recorte com {@code minItems} itens e
     * atividade atual ≥ {@code minCurrent} — um item isolado ou dois eventos não fazem "tendência".
     */
    static List<Growth> growthBy(Collection<HypeScoreCurrent> rows, Function<HypeScoreCurrent, Collection<String>> keys, int window, int windowDays,
                                 double alpha, int minItems, double minCurrent) {
        Map<String, double[]> acc = new LinkedHashMap<>();
        int days = window >= 30 ? 2 * windowDays : windowDays;
        for (HypeScoreCurrent c : rows) {
            double[] a = activity(c, window, windowDays);
            if (a == null) {
                continue;
            }
            for (String k : distinct(keys.apply(c))) {
                double[] s = acc.computeIfAbsent(k, x -> new double[3]);
                s[0] += a[0];
                s[1] += a[1];
                s[2]++;
            }
        }
        List<Growth> out = new ArrayList<>();
        acc.forEach((k, s) -> {
            if (s[2] >= minItems && s[0] >= minCurrent) {
                out.add(new Growth(k, (int) s[2], s[0], s[1], ((s[0] + alpha) / (s[1] + alpha) - 1) * 100, days));
            }
        });
        out.sort(Comparator.comparingDouble(Growth::percent).reversed().thenComparing(Growth::key));
        return out;
    }

    /** Média da métrica por recorte, da maior para a menor (empate: chave), só com {@code minItems}+ itens. */
    static List<Avg> averageBy(Collection<HypeScoreCurrent> rows, Function<HypeScoreCurrent, Collection<String>> keys, ToDoubleFunction<HypeScoreCurrent> metric,
                               int minItems) {
        Map<String, double[]> acc = new LinkedHashMap<>();
        for (HypeScoreCurrent c : rows) {
            for (String k : distinct(keys.apply(c))) {
                double[] s = acc.computeIfAbsent(k, x -> new double[2]);
                s[0] += metric.applyAsDouble(c);
                s[1]++;
            }
        }
        List<Avg> out = new ArrayList<>();
        acc.forEach((k, s) -> {
            if (s[1] >= minItems) {
                out.add(new Avg(k, (int) s[1], s[0] / s[1]));
            }
        });
        out.sort(Comparator.comparingDouble(Avg::value).reversed().thenComparing(Avg::key));
        return out;
    }

    /** Contagem por recorte, da maior para a menor (empate: chave). */
    static List<Map.Entry<String, Long>> countBy(Collection<HypeScoreCurrent> rows, Function<HypeScoreCurrent, Collection<String>> keys) {
        Map<String, Long> acc = new LinkedHashMap<>();
        rows.forEach(c -> distinct(keys.apply(c)).forEach(k -> acc.merge(k, 1L, Long::sum)));
        List<Map.Entry<String, Long>> out = new ArrayList<>(acc.entrySet());
        out.sort(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()));
        return out;
    }

    private static Set<String> distinct(Collection<String> values) {
        Set<String> out = new LinkedHashSet<>();
        if (values != null) {
            values.stream().filter(v -> v != null && !v.isBlank()).map(String::trim).forEach(out::add);   // códigos já normalizados por quem chama
        }
        return out;
    }

    // ================================================================== recortes de uma linha do hype_scores
    /** Região do mundo do dono; sem país = "OUTRAS" (mesma regra do ranking regional). */
    static String regionOf(HypeScoreCurrent c) {
        return c.getRegion() != null && !c.getRegion().isBlank() ? c.getRegion().trim().toUpperCase(Locale.ROOT) : WorldRegions.of(c.getCountry());
    }

    /** Peça: a própria categoria; look: as categorias das peças dele. */
    static List<String> categoriesOf(HypeScoreCurrent c) {
        Set<String> out = new LinkedHashSet<>();
        if (c.getCategory() != null && !c.getCategory().isBlank()) {
            out.add(c.getCategory().trim().toLowerCase(Locale.ROOT));
        }
        Json.csv(c.getCategories()).forEach(x -> out.add(x.trim().toLowerCase(Locale.ROOT)));
        return List.copyOf(out);
    }

    static List<String> subcategoriesOf(HypeScoreCurrent c) {
        return Json.csv(c.getSubcategories()).stream().map(x -> x.trim().toLowerCase(Locale.ROOT)).toList();
    }

    // ================================================================== números no texto
    static long round(double v) {
        return Math.round(v);
    }

    static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    /** Número com até uma casa decimal no idioma de quem lê (2,5 · 2.5). */
    static String fmt1(double v) {
        NumberFormat f = NumberFormat.getNumberInstance(Msg.locale());
        f.setMaximumFractionDigits(1);
        f.setMinimumFractionDigits(0);
        f.setGroupingUsed(false);
        return f.format(round1(v));
    }

    static String fmt0(double v) {
        return String.valueOf(Math.round(v));
    }

    // ================================================================== construção
    /** Título em {@code insights.<código>.title}; texto na chave pedida, com os números já formatados. */
    static Insight insight(String code, Insight.Tone tone, double relevance, String textKey, Object[] args, Insight.Metric metric,
                           Insight.Action action, String... basis) {
        String title = Msg.t("insights." + code.toLowerCase(Locale.ROOT) + ".title");
        return new Insight(code, tone, title, Msg.t(textKey, args), metric, action, List.of(basis), relevance);
    }

    static Object[] args(Object... values) {
        return values;
    }

    static Insight.Metric metric(String labelKey, Number value, String unit) {
        return new Insight.Metric(Msg.t(labelKey), value, unit);
    }

    static Insight.Action action(String labelKey, String href) {
        return new Insight.Action(Msg.t(labelKey), href);
    }

    static String enc(String v) {
        return java.net.URLEncoder.encode(v == null ? "" : v, java.nio.charset.StandardCharsets.UTF_8);
    }

    private static final Pattern NUMBER = Pattern.compile("\\d+(?:[.,]\\d+)?");

    /** Números citados num texto (vírgula decimal normalizada), para conferir que a IA não inventou nenhum. */
    static Set<String> numbers(String text) {
        Set<String> out = new LinkedHashSet<>();
        if (text == null) {
            return out;
        }
        Matcher m = NUMBER.matcher(text);
        while (m.find()) {
            out.add(m.group().replace(',', '.'));
        }
        return out;
    }
}

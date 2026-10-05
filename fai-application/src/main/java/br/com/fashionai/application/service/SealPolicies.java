package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.SealTier;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * RF25 — política padronizada do selo: regras que o sistema avalia sozinho nos criadores de peça (RF4) e de look
 * (RF5), no lugar de um texto livre separado por vírgulas.
 *
 * <pre>
 * { "match": "ALL" | "ANY",
 *   "rules": [ { "quantifier": "AT_LEAST", "count": 3, "color": "Azul", "brand": "Zara", "category": null, "subcategory": null },
 *              { "quantifier": "ALL",      "color": "Amarelo", "brand": "Adidas" },
 *              { "quantifier": "NONE",     "color": "Preto" } ],
 *   "occasions": ["party"], "styles": ["streetwear"],
 *   "hype": { "minLevel": "RELEVANT", "minScore": 60, "momentum": ["RISING", "EMERGING"] } }
 * </pre>
 *
 * Cada regra filtra peças por cor (família da taxonomia, como "Azul", ou a cor exata, como "navy"), marca, categoria,
 * subcategoria e Hype mínimo da peça ({@code hypeMin}, um HypeLevel); o quantificador diz quantas peças do look precisam
 * passar no filtro: no mínimo N, todas ou nenhuma. No selo de PEÇA a peça precisa passar em cada filtro (NONE: não pode
 * passar). Ocasiões e estilos do selo são tags: com os dois lados preenchidos, o look/peça precisa ter ao menos uma em
 * comum.
 *
 * <p>RF53 — critério de Hype ({@code hype}): vale para a ENTIDADE avaliada (selo de PEÇA → o HypeScore v2 atual da
 * peça; selo de LOOK → o do look). Nível e score juntos = os dois precisam valer; {@code momentum} = qualquer um da
 * lista. Sem Hype disponível (não calculado ou dados insuficientes) o critério NÃO é atendido. O Hype alimenta o selo;
 * o selo nunca alimenta o Hype (nenhum vínculo vira sinal do HypeCalculator).
 */
public final class SealPolicies {
    public static final List<String> QUANTIFIERS = List.of("AT_LEAST", "ALL", "NONE");
    public static final int MAX_RULES = 6;
    public static final int MAX_TAGS = 4;
    /** RF53 — no máximo 3 momentos de Hype aceitos num critério (EMERGING, RISING, STABLE, COOLING, CLASSIC). */
    public static final int MAX_HYPE_MOMENTUM = 3;

    private SealPolicies() {
    }

    /** {@code hypeMin}: a peça só passa no filtro com Hype atual ≥ esse nível (nulo = sem filtro de Hype). */
    public record Rule(String quantifier, int count, String color, String brand, String category, String subcategory, HypeLevel hypeMin) {
        public Rule(String quantifier, int count, String color, String brand, String category, String subcategory) {
            this(quantifier, count, color, brand, category, subcategory, null);
        }
    }

    /** RF53 — critério de Hype da entidade avaliada; campos nulos/vazios não restringem. */
    public record HypeCriteria(HypeLevel minLevel, Integer minScore, List<HypeMomentum> momentum) {
        public boolean isEmpty() {
            return minLevel == null && minScore == null && (momentum == null || momentum.isEmpty());
        }
    }

    public record Policy(boolean any, List<Rule> rules, List<String> occasions, List<String> styles, HypeCriteria hype) {
        public Policy(boolean any, List<Rule> rules, List<String> occasions, List<String> styles) {
            this(any, rules, occasions, styles, null);
        }

        public boolean isEmpty() {
            return rules.isEmpty() && occasions.isEmpty() && styles.isEmpty() && hype == null;
        }

        /** A política usa Hype (critério da entidade ou {@code hypeMin} em alguma regra)? */
        public boolean usesHype() {
            return hype != null || rules.stream().anyMatch(r -> r.hypeMin() != null);
        }
    }

    /**
     * RF53 — fato de Hype de uma peça ou look: score (0–100), faixa, momento e se está disponível (status AVAILABLE com
     * score). Vem sempre do HypeScore v2 atual ({@code hype_scores}, versão corrente do algoritmo).
     */
    public record HypeFact(Double score, HypeLevel level, HypeMomentum momentum, boolean available) {
        public static HypeFact of(HypeScoreCurrent c) {
            if (c == null) {
                return null;
            }
            boolean ok = c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null;
            return new HypeFact(c.getScore() == null ? null : c.getScore().doubleValue(), c.getLevel(), c.getMomentum(), ok);
        }

        /** {@code {score, level}} das sugestões (score com 1 casa); nulo quando não há Hype disponível. */
        public Map<String, Object> view() {
            if (!available) {
                return null;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("score", score == null ? null : Math.round(score * 10) / 10.0);
            m.put("level", level == null ? null : level.name());
            return m;
        }
    }

    /** RF53 — de onde a avaliação tira o Hype: de cada peça e do look avaliado. Nulo = sem Hype (critério não atendido). */
    public interface HypeLookup {
        /** Sem Hype nenhum: as assinaturas antigas de {@code evaluate} usam esta (critério de Hype nunca atendido). */
        HypeLookup NONE = new HypeLookup() {
            @Override
            public HypeFact piece(UUID pieceId) {
                return null;
            }

            @Override
            public HypeFact look() {
                return null;
            }
        };

        HypeFact piece(UUID pieceId);

        HypeFact look();

        /** Lookup a partir das linhas atuais (em lote) das peças e do look; {@code look} nulo = look ainda não salvo. */
        static HypeLookup of(Map<UUID, HypeScoreCurrent> pieces, HypeScoreCurrent look) {
            Map<UUID, HypeScoreCurrent> p = pieces == null ? Map.of() : pieces;
            HypeFact l = HypeFact.of(look);
            return new HypeLookup() {
                @Override
                public HypeFact piece(UUID pieceId) {
                    return pieceId == null ? null : HypeFact.of(p.get(pieceId));
                }

                @Override
                public HypeFact look() {
                    return l;
                }
            };
        }
    }

    /** Resultado da avaliação: atende? quais peças sustentam o selo e por quê (texto da regra que bateu). */
    public record Verdict(boolean matched, List<UUID> pieceIds, String why) {
    }

    // ------------------------------------------------------------------ validação

    /** Valida o JSON vindo da tela; devolve null quando não há política (selo sem regras). Erros viram 400 legíveis. */
    public static Map<String, Object> normalize(Map<String, Object> raw) {
        if (raw == null) {
            return null;
        }
        List<Map<String, Object>> rules = new ArrayList<>();
        Object rs = raw.get("rules");
        if (rs instanceof Collection<?> c) {
            for (Object o : c) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                String q = upper(m.get("quantifier"), "AT_LEAST");
                if (!QUANTIFIERS.contains(q)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.quantificador_invalido", q));
                }
                int count = 1;
                if (m.get("count") instanceof Number n) {
                    count = n.intValue();
                } else if (m.get("count") != null && !String.valueOf(m.get("count")).isBlank()) {
                    try {
                        count = Integer.parseInt(String.valueOf(m.get("count")).trim());
                    } catch (NumberFormatException e) {
                        throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.quantidade_invalida"));
                    }
                }
                if ("AT_LEAST".equals(q) && (count < 1 || count > 4)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.quantidade_invalida"));
                }
                String color = text(m.get("color"));
                if (color != null && !Taxonomy.COLORS.containsKey(color.toLowerCase(Locale.ROOT)) && !families().contains(color)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.cor_fora_da_taxonomia", color));
                }
                String category = text(m.get("category"));
                if (category != null && !Taxonomy.SUBCATEGORIES.containsKey(category)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.categoria_invalida", category));
                }
                String sub = text(m.get("subcategory"));
                if (sub != null && Taxonomy.SUBCATEGORIES.values().stream().noneMatch(l -> l.contains(sub))) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.categoria_invalida", sub));
                }
                String brand = text(m.get("brand"));
                if (brand != null && brand.length() > 80) {
                    brand = brand.substring(0, 80);
                }
                HypeLevel hypeMin = level(m.get("hypeMin"));   // RF53: Hype mínimo da peça também é filtro
                if (color == null && brand == null && category == null && sub == null && hypeMin == null) {
                    continue;                                   // regra sem filtro nenhum não diz nada
                }
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("quantifier", q);
                r.put("count", "AT_LEAST".equals(q) ? count : null);
                r.put("color", color == null ? null : (Taxonomy.COLORS.containsKey(color.toLowerCase(Locale.ROOT)) ? color.toLowerCase(Locale.ROOT) : color));
                r.put("brand", brand);
                r.put("category", category);
                r.put("subcategory", sub);
                if (hypeMin != null) {
                    r.put("hypeMin", hypeMin.name());           // só quando existe: política sem Hype fica igual à de antes
                }
                rules.add(r);
            }
        }
        if (rules.size() > MAX_RULES) {
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.regras_demais", MAX_RULES));
        }
        List<String> occasions = tags(raw.get("occasions"), Taxonomy.OCCASIONS);
        List<String> styles = tags(raw.get("styles"), Taxonomy.STYLES);
        Map<String, Object> hype = normalizeHype(raw.get("hype"));
        if (rules.isEmpty() && occasions.isEmpty() && styles.isEmpty() && hype == null) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("match", "ANY".equals(upper(raw.get("match"), "ALL")) ? "ANY" : "ALL");
        out.put("rules", rules);
        out.put("occasions", occasions);
        out.put("styles", styles);
        if (hype != null) {
            out.put("hype", hype);
        }
        return out;
    }

    /**
     * RF53 — critério de Hype da política: {@code minLevel} (HypeLevel), {@code minScore} (inteiro 0–100) e
     * {@code momentum} (até {@value #MAX_HYPE_MOMENTUM} HypeMomentum). Nulo quando não há critério nenhum.
     */
    static Map<String, Object> normalizeHype(Object raw) {
        if (!(raw instanceof Map<?, ?> m)) {
            return null;
        }
        HypeLevel minLevel = level(m.get("minLevel"));
        Integer minScore = null;
        Object sc = m.get("minScore");
        if (sc != null && !String.valueOf(sc).isBlank() && !"null".equals(String.valueOf(sc).trim())) {
            double v;
            if (sc instanceof Number n) {
                v = n.doubleValue();
            } else {
                try {
                    v = Double.parseDouble(String.valueOf(sc).trim().replace(',', '.'));
                } catch (NumberFormatException e) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.score_invalido"));
                }
            }
            if (Double.isNaN(v) || v < 0 || v > 100 || v != Math.rint(v)) {
                throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.score_invalido"));
            }
            minScore = (int) v;
        }
        List<String> raws = strings(m.get("momentum"));
        if (raws.size() > MAX_HYPE_MOMENTUM) {
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.momentos_demais", MAX_HYPE_MOMENTUM));
        }
        List<String> momentum = new ArrayList<>();
        for (String x : raws) {
            String k = x.toUpperCase(Locale.ROOT);
            try {
                HypeMomentum.valueOf(k);
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.momento_invalido", x));
            }
            if (!momentum.contains(k)) {
                momentum.add(k);
            }
        }
        if (minLevel == null && minScore == null && momentum.isEmpty()) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("minLevel", minLevel == null ? null : minLevel.name());
        out.put("minScore", minScore);
        out.put("momentum", momentum);
        return out;
    }

    /** Nível de Hype vindo da tela (nulo/vazio = sem filtro); fora de HypeLevel vira 400. */
    private static HypeLevel level(Object raw) {
        String s = text(raw);
        if (s == null) {
            return null;
        }
        try {
            return HypeLevel.valueOf(s.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.hype.nivel_invalido", s));
        }
    }

    public static Policy parse(Object stored) {
        if (!(stored instanceof Map<?, ?> m)) {
            return null;
        }
        List<Rule> rules = new ArrayList<>();
        if (m.get("rules") instanceof Collection<?> c) {
            for (Object o : c) {
                if (o instanceof Map<?, ?> r) {
                    int count = r.get("count") instanceof Number n ? n.intValue() : 1;
                    rules.add(new Rule(upper(r.get("quantifier"), "AT_LEAST"), Math.max(1, count), text(r.get("color")),
                            text(r.get("brand")), text(r.get("category")), text(r.get("subcategory")), parseEnum(HypeLevel.class, r.get("hypeMin"))));
                }
            }
        }
        Policy p = new Policy("ANY".equals(upper(m.get("match"), "ALL")), rules, strings(m.get("occasions")), strings(m.get("styles")),
                parseHype(m.get("hype")));
        return p.isEmpty() ? null : p;
    }

    /** Critério de Hype já gravado (valor desconhecido é ignorado: o JSON salvo nunca derruba a leitura). */
    static HypeCriteria parseHype(Object stored) {
        if (!(stored instanceof Map<?, ?> m)) {
            return null;
        }
        Integer minScore = m.get("minScore") instanceof Number n ? Math.max(0, Math.min(100, n.intValue())) : null;
        List<HypeMomentum> momentum = new ArrayList<>();
        for (String x : strings(m.get("momentum"))) {
            HypeMomentum mm = parseEnum(HypeMomentum.class, x);
            if (mm != null && !momentum.contains(mm)) {
                momentum.add(mm);
            }
        }
        HypeCriteria c = new HypeCriteria(parseEnum(HypeLevel.class, m.get("minLevel")), minScore, List.copyOf(momentum));
        return c.isEmpty() ? null : c;
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, Object raw) {
        String s = text(raw);
        if (s == null) {
            return null;
        }
        try {
            return Enum.valueOf(type, s.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    // ------------------------------------------------------------------ avaliação

    /**
     * Avalia a política contra as peças de um look (tier LOOK) ou contra uma única peça (tier PECA). Ocasiões/estilos
     * vazios de um dos lados não bloqueiam. Sem Hype à mão: critério de Hype (e {@code hypeMin}) nunca é atendido; a
     * política sem Hype se comporta exatamente como antes.
     */
    public static Verdict evaluate(Policy p, SealTier tier, List<WardrobeItem> pieces, Collection<String> occasions, Collection<String> styles) {
        return evaluate(p, tier, pieces, occasions, styles, HypeLookup.NONE);
    }

    /**
     * RF53 — avaliação com o Hype atual das peças e do look. O critério {@code hype} da política vale para a entidade
     * avaliada: no tier PECA, cada peça avaliada; no tier LOOK, o look ({@link HypeLookup#look()}, nulo para look ainda
     * não salvo). {@code hypeMin} das regras usa o Hype de cada peça.
     */
    public static Verdict evaluate(Policy p, SealTier tier, List<WardrobeItem> pieces, Collection<String> occasions, Collection<String> styles,
                                   HypeLookup hype) {
        HypeLookup h = hype == null ? HypeLookup.NONE : hype;
        if (p == null || pieces.isEmpty()) {
            return new Verdict(false, List.of(), null);
        }
        if (!overlaps(p.occasions(), occasions) || !overlaps(p.styles(), styles)) {
            return new Verdict(false, List.of(), null);
        }
        String hypeWhy = null;
        if (p.hype() != null) {
            HypeFact fact = null;
            if (tier == SealTier.PECA) {
                for (WardrobeItem w : pieces) {                // cada peça é a entidade avaliada
                    HypeFact f = h.piece(w.getId());
                    if (!meets(p.hype(), f)) {
                        return new Verdict(false, List.of(), null);
                    }
                    fact = fact == null || f.score() < fact.score() ? f : fact;   // o "porquê" mostra o menor Hype
                }
            } else {
                fact = h.look();
                if (!meets(p.hype(), fact)) {
                    return new Verdict(false, List.of(), null);
                }
            }
            hypeWhy = describeHype(p.hype(), tier) + " " + Msg.t("sealPolicy.hype.atual", Math.round(fact.score()));
        }
        if (p.rules().isEmpty()) {
            return new Verdict(true, pieces.stream().map(WardrobeItem::getId).toList(), why(null, hypeWhy, describeTags(p)));
        }
        Set<UUID> support = new LinkedHashSet<>();
        List<String> hits = new ArrayList<>();
        int ok = 0;
        for (Rule r : p.rules()) {
            List<WardrobeItem> pass = pieces.stream().filter(w -> passes(r, w, h)).toList();
            boolean holds;
            if (tier == SealTier.PECA) {
                holds = "NONE".equals(r.quantifier()) ? pass.isEmpty() : pass.size() == pieces.size();
            } else {
                holds = switch (r.quantifier()) {
                    case "ALL" -> pass.size() == pieces.size();
                    case "NONE" -> pass.isEmpty();
                    default -> pass.size() >= r.count();
                };
            }
            if (holds) {
                ok++;
                pass.forEach(w -> support.add(w.getId()));
                hits.add(describe(r, tier));
            }
        }
        boolean matched = p.any() ? ok > 0 : ok == p.rules().size();
        if (!matched) {
            return new Verdict(false, List.of(), null);
        }
        List<UUID> ids = support.isEmpty() ? pieces.stream().map(WardrobeItem::getId).toList() : List.copyOf(support);
        return new Verdict(true, ids, why(String.join("; ", hits), hypeWhy, null));
    }

    /** "Porquê" da sugestão: regras que bateram; trecho de Hype (com o valor atual); tags. */
    private static String why(String rules, String hype, String tags) {
        String base = rules == null || rules.isEmpty() ? hype : hype == null ? rules : rules + "; " + hype;
        return base == null ? tags : tags == null ? base : base + " · " + tags;
    }

    /**
     * RF53 — o fato de Hype atende ao critério? Sem Hype disponível (não calculado, dados insuficientes) → não.
     * Nível compara a faixa; score compara o número exibido (arredondado), como a faixa.
     */
    static boolean meets(HypeCriteria c, HypeFact f) {
        if (c == null) {
            return true;
        }
        if (f == null || !f.available() || f.score() == null) {
            return false;
        }
        if (c.minLevel() != null && (f.level() == null || f.level().ordinal() < c.minLevel().ordinal())) {
            return false;
        }
        if (c.minScore() != null && Math.round(f.score()) < c.minScore()) {
            return false;
        }
        return c.momentum() == null || c.momentum().isEmpty() || (f.momentum() != null && c.momentum().contains(f.momentum()));
    }

    static boolean passes(Rule r, WardrobeItem w) {
        return passes(r, w, HypeLookup.NONE);
    }

    static boolean passes(Rule r, WardrobeItem w, HypeLookup hype) {
        if (r.hypeMin() != null) {
            HypeFact f = hype == null ? null : hype.piece(w.getId());
            if (f == null || !f.available() || f.level() == null || f.level().ordinal() < r.hypeMin().ordinal()) {
                return false;
            }
        }
        if (r.color() != null && !colorMatches(r.color(), w.getColor())) {
            return false;
        }
        if (r.category() != null && !r.category().equalsIgnoreCase(String.valueOf(w.getCategory()))) {
            return false;
        }
        if (r.subcategory() != null && !r.subcategory().equalsIgnoreCase(String.valueOf(w.getSubcategory()))) {
            return false;
        }
        if (r.brand() != null) {
            String brand = w.getBrandName() != null ? w.getBrandName()
                    : w.getBrand() != null ? w.getBrand().getName()
                    : w.getBrandProfile() != null ? w.getBrandProfile().getBrandName() : null;
            if (brand == null || LocalAdvisors.jaroWinkler(LocalAdvisors.normalize(r.brand()), LocalAdvisors.normalize(brand)) < 0.92) {
                return false;
            }
        }
        return true;
    }

    /** "Azul" casa com navy/denim/cobalt…; "navy" só com navy. */
    static boolean colorMatches(String wanted, String color) {
        if (color == null) {
            return false;
        }
        String c = color.toLowerCase(Locale.ROOT).trim();
        if (wanted.equalsIgnoreCase(c)) {
            return true;
        }
        String family = Taxonomy.COLOR_FAMILY.get(c);
        return family != null && family.equalsIgnoreCase(wanted);
    }

    // ------------------------------------------------------------------ texto (cards, e-mails, explicação da sugestão)

    /** Frase da política inteira: o que o card do selo mostra no lugar do antigo texto livre. */
    public static String describe(Policy p, SealTier tier) {
        if (p == null) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        for (Rule r : p.rules()) {
            parts.add(describe(r, tier));
        }
        String rules = String.join(p.any() ? conj("sealPolicy.ou") : conj("sealPolicy.e"), parts);
        String hype = p.hype() == null ? null : describeHype(p.hype(), tier);
        return why(rules, hype, describeTags(p));
    }

    /** RF53 — "look com Hype ≥ 60 e em crescimento" / "peça com Hype ≥ Em alta". */
    static String describeHype(HypeCriteria c, SealTier tier) {
        List<String> min = new ArrayList<>();
        if (c.minLevel() != null) {
            min.add(Msg.t("sealPolicy.hype.minimo", levelLabel(c.minLevel())));
        }
        if (c.minScore() != null) {
            min.add(Msg.t("sealPolicy.hype.minimo", c.minScore()));
        }
        List<String> crit = new ArrayList<>();
        if (!min.isEmpty()) {
            crit.add(String.join(conj("sealPolicy.e"), min));
        }
        if (c.momentum() != null && !c.momentum().isEmpty()) {
            crit.add(String.join(conj("sealPolicy.ou"), c.momentum().stream().map(m -> Msg.t("sealPolicy.hype.momento." + m.name())).toList()));
        }
        String what = String.join(conj("sealPolicy.e"), crit);
        return Msg.t(tier == SealTier.PECA ? "sealPolicy.hype.peca" : "sealPolicy.hype.look", what);
    }

    /**
     * Conjunção com espaço dos dois lados (" e ", " ou "): o .properties descarta o espaço do início do valor, então
     * "sealPolicy.e= e " chega como "e " e juntava as partes sem espaço ("60e em crescimento").
     */
    private static String conj(String key) {
        return " " + Msg.t(key).trim() + " ";
    }

    /** Rótulo da faixa de Hype no idioma de quem lê ("Em alta", "Viral"…). */
    public static String levelLabel(HypeLevel level) {
        return Msg.t("sealPolicy.hype.nivel." + level.name());
    }

    static String describe(Rule r, SealTier tier) {
        String what = pieceWords(r);
        if (tier == SealTier.PECA) {
            return "NONE".equals(r.quantifier()) ? Msg.t("sealPolicy.peca_que_nao_seja", what) : Msg.t("sealPolicy.peca", what);
        }
        return switch (r.quantifier()) {
            case "ALL" -> Msg.t("sealPolicy.todas_as_pecas", what);
            case "NONE" -> Msg.t("sealPolicy.nenhuma_peca", what);
            default -> r.count() == 1 ? Msg.t("sealPolicy.ao_menos_uma_peca", what) : Msg.t("sealPolicy.no_minimo_pecas", r.count(), what);
        };
    }

    private static String pieceWords(Rule r) {
        List<String> w = new ArrayList<>();
        if (r.subcategory() != null) {
            w.add(Msg.t("taxonomy." + r.subcategory()));
        } else if (r.category() != null) {
            w.add(Msg.t("taxonomy." + r.category()));
        }
        if (r.color() != null) {
            String c = Taxonomy.COLORS.containsKey(r.color()) ? Msg.t("taxonomy." + r.color()) : Msg.t("sealPolicy.familia." + r.color().toLowerCase(Locale.ROOT));
            w.add(Msg.t("sealPolicy.cor", c.toLowerCase(Locale.ROOT)));
        }
        if (r.brand() != null) {
            w.add(Msg.t("sealPolicy.da_marca", r.brand()));
        }
        if (r.hypeMin() != null) {
            w.add(Msg.t("sealPolicy.hype.com_hype", levelLabel(r.hypeMin())));
        }
        return String.join(" ", w).trim();
    }

    private static String describeTags(Policy p) {
        List<String> t = new ArrayList<>();
        if (!p.occasions().isEmpty()) {
            t.add(Msg.t("sealPolicy.ocasioes", String.join(", ", p.occasions().stream().map(o -> Msg.t("taxonomy." + o)).toList())));
        }
        if (!p.styles().isEmpty()) {
            t.add(Msg.t("sealPolicy.estilos", String.join(", ", p.styles().stream().map(o -> Msg.t("taxonomy." + o)).toList())));
        }
        return t.isEmpty() ? null : String.join(" · ", t);
    }

    // ------------------------------------------------------------------ utilitários

    private static boolean overlaps(List<String> wanted, Collection<String> have) {
        if (wanted.isEmpty() || have == null || have.isEmpty()) {
            return true;
        }
        for (String h : have) {
            if (wanted.contains(h.toLowerCase(Locale.ROOT).trim())) {
                return true;
            }
        }
        return false;
    }

    private static Set<String> families() {
        return new LinkedHashSet<>(Taxonomy.COLOR_FAMILY.values());
    }

    private static List<String> tags(Object o, List<String> allowed) {
        List<String> out = new ArrayList<>();
        for (String s : strings(o)) {
            String k = s.toLowerCase(Locale.ROOT).trim();
            if (!allowed.contains(k)) {
                throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.tag_fora_da_taxonomia", s));
            }
            if (!out.contains(k)) {
                out.add(k);
            }
        }
        if (out.size() > MAX_TAGS) {
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.tags_demais", MAX_TAGS));
        }
        return out;
    }

    private static List<String> strings(Object o) {
        List<String> out = new ArrayList<>();
        if (o instanceof Collection<?> c) {
            for (Object x : c) {
                if (x != null && !String.valueOf(x).isBlank()) {
                    out.add(String.valueOf(x).trim());
                }
            }
        }
        return out;
    }

    private static String text(Object o) {
        if (o == null) {
            return null;
        }
        String s = String.valueOf(o).trim();
        return s.isEmpty() || "null".equals(s) ? null : s;
    }

    private static String upper(Object o, String dflt) {
        String s = text(o);
        return s == null ? dflt : s.toUpperCase(Locale.ROOT);
    }
}

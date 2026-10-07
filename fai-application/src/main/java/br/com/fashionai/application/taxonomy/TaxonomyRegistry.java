package br.com.fashionai.application.taxonomy;

import br.com.fashionai.application.catalog.CatalogNormalizer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Taxonomia de peças CATEGORY → SUBCATEGORY → VARIATION + dimensões de atributo (docs/taxonomia/AUDITORIA_TAXONOMIA_PECAS.md).
 * Lê {@code taxonomy/taxonomy.json}, gerado por scripts/taxonomy/build_taxonomy.py — o mesmo conteúdo das tabelas
 * taxonomy_* (V39–V42), que dão a integridade no banco. Também é lido pelo pipeline Python.
 *
 * <ul>
 *   <li>Subcategoria LEGACY (ex.: bermuda_shorts) continua válida nos dados; {@link #resolve} diz o equivalente novo
 *   (shorts + LENGTH=KNEE). A escrita nova sempre grava o equivalente.</li>
 *   <li>Variação: um código por peça, só os da subcategoria ({@link #isVariationOf}).</li>
 *   <li>Dimensão: escopo por categoria/subcategoria; valor LEGACY é aceito nos dados antigos e fica fora das listas.</li>
 *   <li>Texto livre (IA, busca, nome oficial do produto) vira código só por alias exato normalizado; o que não casa é
 *   descartado — nada fora do vocabulário é gravado.</li>
 * </ul>
 */
public final class TaxonomyRegistry {
    public static final String RESOURCE = "/taxonomy/taxonomy.json";
    private static volatile TaxonomyRegistry instance;

    public record Category(String code, Map<String, String> labels) {
    }

    public record VariationLink(String code, String tier, int priority) {
    }

    public record Subcategory(String code, String category, boolean legacy, Map<String, String> labels, String replacedBy,
                              Map<String, String> implies, boolean needsReview, List<VariationLink> variations) {
    }

    public record Variation(String code, Map<String, String> labels, String description, List<String> aliases) {
    }

    public record Value(String code, Map<String, String> labels, String tier, int priority, String group, String hex,
                        List<String> appliesTo, boolean legacy, List<String> aliases) {
    }

    public record Dimension(String code, Map<String, String> labels, boolean multiValued, int maxPerPiece, Integer maxPerScheme,
                            boolean attribute, List<String> appliesTo, List<Value> values) {
        public Optional<Value> value(String code) {
            return values.stream().filter(v -> v.code().equals(code)).findFirst();
        }
    }

    /**
     * Subcategoria já no padrão novo. {@code legacyCode} preenchido quando veio de um código LEGACY; {@code implied}
     * são os atributos que o legado implica (dimensão → código) e {@code variation} a variação implícita (coturno → COMBAT).
     */
    public record Resolved(String category, String subcategory, String variation, Map<String, String> implied,
                           boolean needsReview, String legacyCode) {
    }

    private final String version;
    private final List<Category> categories = new ArrayList<>();
    private final Map<String, Subcategory> subcategories = new LinkedHashMap<>();
    private final Map<String, List<String>> active = new LinkedHashMap<>();
    private final Map<String, Variation> variations = new LinkedHashMap<>();
    private final Map<String, Dimension> dimensions = new LinkedHashMap<>();
    /** subcategoria → (alias normalizado → variação) */
    private final Map<String, Map<String, String>> variationAliases = new HashMap<>();
    /** código (subcategoria, variação ou valor) → rótulos por idioma, para {@link Taxonomy#label} */
    private final Map<String, Map<String, String>> labels = new HashMap<>();

    TaxonomyRegistry(JsonNode root) {
        version = root.path("version").asString("0");
        root.path("categories").forEach(c -> {
            Category cat = new Category(c.path("code").asString(), map(c.path("labels")));
            categories.add(cat);
            active.put(cat.code(), new ArrayList<>());
            labels.putIfAbsent(cat.code(), cat.labels());
        });
        root.path("variations").properties().forEach(e -> {
            JsonNode n = e.getValue();
            List<String> aliases = new ArrayList<>();
            n.path("aliases").properties().forEach(a -> a.getValue().forEach(x -> aliases.add(x.asString())));
            variations.put(e.getKey(), new Variation(e.getKey(), map(n.path("labels")), n.path("description").asString(), List.copyOf(aliases)));
            labels.putIfAbsent(e.getKey(), map(n.path("labels")));
        });
        root.path("subcategories").forEach(s -> {
            List<VariationLink> links = new ArrayList<>();
            s.path("variations").forEach(v -> links.add(new VariationLink(v.path("code").asString(), v.path("tier").asString(),
                    v.path("priority").asInt())));
            Map<String, String> implies = new LinkedHashMap<>();
            s.path("implies").properties().forEach(e -> implies.put(e.getKey(), e.getValue().asString()));
            boolean legacy = "LEGACY".equals(s.path("status").asString());
            Subcategory sub = new Subcategory(s.path("code").asString(), s.path("category").asString(), legacy, map(s.path("labels")),
                    s.path("replacedBy").isMissingNode() ? null : s.path("replacedBy").asString(), Collections.unmodifiableMap(implies),
                    s.path("needsReview").asBoolean(false), List.copyOf(links));
            subcategories.put(sub.code(), sub);
            labels.put(sub.code(), sub.labels());
            if (!legacy) {
                active.get(sub.category()).add(sub.code());
                Map<String, String> byAlias = new HashMap<>();
                for (VariationLink l : links) {
                    Variation var = variations.get(l.code());
                    byAlias.put(CatalogNormalizer.key(l.code()), l.code());
                    var.labels().values().forEach(x -> byAlias.putIfAbsent(CatalogNormalizer.key(x), l.code()));
                    var.aliases().forEach(x -> byAlias.putIfAbsent(CatalogNormalizer.key(x), l.code()));
                }
                variationAliases.put(sub.code(), byAlias);
            }
        });
        root.path("dimensions").forEach(d -> {
            List<Value> values = new ArrayList<>();
            d.path("values").forEach(v -> {
                List<String> aliases = new ArrayList<>();
                v.path("aliases").properties().forEach(a -> a.getValue().forEach(x -> aliases.add(x.asString())));
                Value val = new Value(v.path("code").asString(), map(v.path("labels")), v.path("tier").asString(),
                        v.path("priority").asInt(), text(v.path("group")), text(v.path("hex")), strings(v.path("appliesTo")),
                        "LEGACY".equals(v.path("status").asString()), List.copyOf(aliases));
                values.add(val);
                labels.putIfAbsent(val.code(), val.labels());
            });
            labels.putIfAbsent(d.path("code").asString(), map(d.path("labels")));
            JsonNode mps = d.path("maxPerScheme");
            dimensions.put(d.path("code").asString(), new Dimension(d.path("code").asString(), map(d.path("labels")),
                    d.path("multiValued").asBoolean(), d.path("maxPerPiece").asInt(1), mps.isNumber() ? mps.asInt() : null,
                    "ATTRIBUTE".equals(d.path("storage").asString()), strings(d.path("appliesTo")), List.copyOf(values)));
        });
        active.replaceAll((k, v) -> List.copyOf(v));
    }

    private static Map<String, String> map(JsonNode n) {
        Map<String, String> out = new LinkedHashMap<>();
        n.properties().forEach(e -> out.put(e.getKey(), e.getValue().asString()));
        return Collections.unmodifiableMap(out);
    }

    private static List<String> strings(JsonNode n) {
        List<String> out = new ArrayList<>();
        n.forEach(x -> out.add(x.asString()));
        return List.copyOf(out);
    }

    private static String text(JsonNode n) {
        return n.isMissingNode() || n.isNull() ? null : n.asString();
    }

    public static TaxonomyRegistry get() {
        if (instance == null) {
            synchronized (TaxonomyRegistry.class) {
                if (instance == null) {
                    try (InputStream in = TaxonomyRegistry.class.getResourceAsStream(RESOURCE)) {
                        if (in == null) {
                            throw new IllegalStateException("Recurso ausente: " + RESOURCE);
                        }
                        instance = new TaxonomyRegistry(new ObjectMapper().readTree(in));
                    } catch (IOException e) {
                        throw new UncheckedIOException(e);
                    }
                }
            }
        }
        return instance;
    }

    public String version() {
        return version;
    }

    public List<Category> categories() {
        return Collections.unmodifiableList(categories);
    }

    /** categoria → subcategorias ATIVAS, na ordem do formulário (as LEGACY ficam de fora). */
    public Map<String, List<String>> activeSubcategories() {
        return Collections.unmodifiableMap(active);
    }

    public Optional<Subcategory> subcategory(String code) {
        return Optional.ofNullable(code == null ? null : subcategories.get(code));
    }

    public List<Subcategory> legacySubcategories() {
        return subcategories.values().stream().filter(Subcategory::legacy).toList();
    }

    /** Categoria de uma subcategoria ativa ou LEGACY (null se o código não existe). */
    public String categoryOf(String subcategory) {
        return subcategory(subcategory).map(Subcategory::category).orElse(null);
    }

    /** Subcategoria no padrão novo: LEGACY → equivalente + o que ele implica; ativa → ela mesma; desconhecida → null. */
    public Resolved resolve(String subcategory) {
        Subcategory s = subcategory(subcategory).orElse(null);
        if (s == null) {
            return null;
        }
        if (!s.legacy()) {
            return new Resolved(s.category(), s.code(), null, Map.of(), false, null);
        }
        Map<String, String> implied = new LinkedHashMap<>(s.implies());
        String variation = implied.remove("VARIATION");
        return new Resolved(s.category(), s.replacedBy(), variation, Collections.unmodifiableMap(implied), s.needsReview(), s.code());
    }

    public List<VariationLink> variationsOf(String subcategory) {
        return subcategory(subcategory).filter(s -> !s.legacy()).map(Subcategory::variations).orElse(List.of());
    }

    public boolean isVariationOf(String subcategory, String variation) {
        return variation != null && variationsOf(subcategory).stream().anyMatch(l -> l.code().equals(variation));
    }

    public Optional<Variation> variation(String code) {
        return Optional.ofNullable(code == null ? null : variations.get(code));
    }

    public Map<String, Variation> variations() {
        return Collections.unmodifiableMap(variations);
    }

    /** Variação da subcategoria pelo código, rótulo ou alias exato ("mom jeans", "boca de sino", "MOM"). */
    public Optional<String> variationByText(String subcategory, String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(variationAliases.getOrDefault(subcategory, Map.of()).get(CatalogNormalizer.key(text)));
    }

    /**
     * Variações citadas num texto livre (nome oficial do produto, busca): a frase mais longa primeiro, até 4 palavras.
     * Ex.: "Calça Jeans Mom Cintura Alta" em jeans → MOM.
     */
    public Optional<String> variationInText(String subcategory, String text) {
        Map<String, String> byAlias = variationAliases.getOrDefault(subcategory, Map.of());
        String[] w = CatalogNormalizer.key(text).split(" ");
        for (int size = Math.min(4, w.length); size >= 1; size--) {
            for (int i = 0; i + size <= w.length; i++) {
                String hit = byAlias.get(String.join(" ", java.util.Arrays.copyOfRange(w, i, i + size)));
                if (hit != null) {
                    return Optional.of(hit);
                }
            }
        }
        return Optional.empty();
    }

    public List<Dimension> dimensions() {
        return List.copyOf(dimensions.values());
    }

    public Optional<Dimension> dimension(String code) {
        return Optional.ofNullable(code == null ? null : dimensions.get(code));
    }

    /** A dimensão vale para essa categoria/subcategoria (escopo da dimensão)? */
    public boolean applies(Dimension d, String category, String subcategory) {
        return d.appliesTo().contains(category) || (subcategory != null && d.appliesTo().contains(subcategory));
    }

    private static boolean valueApplies(Value v, String category, String subcategory) {
        return v.appliesTo().isEmpty() || v.appliesTo().contains(category) || (subcategory != null && v.appliesTo().contains(subcategory));
    }

    /** Valores ATIVOS da dimensão que valem para a categoria/subcategoria (listas do formulário, filtros e prompt). */
    public List<Value> valuesFor(String dimension, String category, String subcategory) {
        Dimension d = dimensions.get(dimension);
        if (d == null || !applies(d, category, subcategory)) {
            return List.of();
        }
        return d.values().stream().filter(v -> !v.legacy() && valueApplies(v, category, subcategory)).toList();
    }

    /** O valor existe e vale para a peça (LEGACY é aceito: dado antigo continua válido). */
    public boolean isAllowed(String dimension, String code, String category, String subcategory) {
        Dimension d = dimensions.get(dimension);
        if (d == null || code == null || !applies(d, category, subcategory)) {
            return false;
        }
        return d.value(code).filter(v -> valueApplies(v, category, subcategory)).isPresent();
    }

    /** Valor da dimensão pelo código, rótulo ou alias exato, respeitando o escopo ("cintura alta" → HIGH_RISE). */
    public Optional<String> valueByText(String dimension, String category, String subcategory, String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        String k = CatalogNormalizer.key(text);
        for (Value v : valuesFor(dimension, category, subcategory)) {
            if (CatalogNormalizer.key(v.code()).equals(k) || v.labels().values().stream().anyMatch(l -> CatalogNormalizer.key(l).equals(k))
                    || v.aliases().stream().anyMatch(a -> CatalogNormalizer.key(a).equals(k))) {
                return Optional.of(v.code());
            }
        }
        return Optional.empty();
    }

    /** Rótulo de um código (subcategoria, variação ou valor) no idioma; cai para pt-BR e depois para o próprio código. */
    public Optional<String> label(String code, Locale locale) {
        Map<String, String> l = code == null ? null : labels.get(code);
        if (l == null) {
            return Optional.empty();
        }
        String lang = locale == null ? "pt-BR" : locale.getLanguage();
        String hit = "pt".equals(lang) ? l.get("pt-BR") : l.get(lang);
        if (hit == null && "es".equals(lang)) {
            hit = l.get("en");
        }
        return Optional.ofNullable(hit != null ? hit : l.get("pt-BR"));
    }
}

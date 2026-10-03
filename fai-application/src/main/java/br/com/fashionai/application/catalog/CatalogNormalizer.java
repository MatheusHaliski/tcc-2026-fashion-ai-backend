package br.com.fashionai.application.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * RF47 · Normalização do catálogo. A fonte de verdade é {@code catalog/normalization.json} (lida também pelo pipeline
 * Python em scripts/catalog): sinônimos de categoria, subcategoria, cor, material e gênero, apelidos de marca e
 * stopwords. Garante "NIKE"/"nike" → mesma marca, "tee"/"camiseta" → t_shirt, "branco" → white e a chave de
 * deduplicação por identificador forte (gtin > ean > upc > sku > código > URL canônica > marca+modelo+cor > título).
 */
public final class CatalogNormalizer {
    public static final String RESOURCE = "/catalog/normalization.json";
    private static volatile CatalogNormalizer instance;

    private final Map<String, String> categories = new HashMap<>();
    private final Map<String, String> subcategories = new HashMap<>();
    private final Map<String, String> subcategoryCategory = new HashMap<>();
    private final Map<String, String> colors = new HashMap<>();
    private final Map<String, String> materials = new HashMap<>();
    private final Map<String, String> genders = new HashMap<>();
    private final Map<String, String> brandAliases = new HashMap<>();
    private final Set<String> stopwords = new LinkedHashSet<>();
    private final Map<String, List<String>> taxonomy = new LinkedHashMap<>();
    private final String version;

    CatalogNormalizer(JsonNode root) {
        version = root.path("version").asText("0");
        root.path("taxonomy").path("subcategories").fields().forEachRemaining(e -> {
            List<String> subs = new ArrayList<>();
            e.getValue().forEach(n -> {
                subs.add(n.asText());
                subcategoryCategory.put(n.asText(), e.getKey());
                subcategories.put(key(n.asText()), n.asText());
            });
            taxonomy.put(e.getKey(), subs);
            categories.put(key(e.getKey()), e.getKey());
        });
        root.path("taxonomy").path("colors").forEach(n -> colors.put(key(n.asText()), n.asText()));
        root.path("taxonomy").path("materials").forEach(n -> materials.put(key(n.asText()), n.asText()));
        load(root.path("categorySynonyms"), categories);
        load(root.path("subcategorySynonyms"), subcategories);
        load(root.path("colorSynonyms"), colors);
        load(root.path("materialSynonyms"), materials);
        load(root.path("genderSynonyms"), genders);
        load(root.path("brandAliases"), brandAliases);
        root.path("stopwords").forEach(n -> stopwords.add(key(n.asText())));
    }

    private static void load(JsonNode node, Map<String, String> into) {
        node.fields().forEachRemaining(e -> {
            into.put(key(e.getKey()), e.getKey());
            e.getValue().forEach(v -> into.putIfAbsent(key(v.asText()), e.getKey()));
        });
    }

    public static CatalogNormalizer get() {
        if (instance == null) {
            synchronized (CatalogNormalizer.class) {
                if (instance == null) {
                    try (InputStream in = CatalogNormalizer.class.getResourceAsStream(RESOURCE)) {
                        if (in == null) {
                            throw new IllegalStateException("Recurso ausente: " + RESOURCE);
                        }
                        instance = new CatalogNormalizer(new ObjectMapper().readTree(in));
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

    public Map<String, List<String>> taxonomy() {
        return taxonomy;
    }

    /** Minúsculas, sem acento, só letras/dígitos separados por um espaço ("Levi’s 501®" → "levi s 501"). */
    public static String key(String s) {
        if (s == null) {
            return "";
        }
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT)
                .replace("&", " and ").replaceAll("[^a-z0-9]+", " ").trim();
    }

    /** Slug de marca compatível com {@code brands.slug} (V3): "Levi's" → "levis", "H&M" → "h-m". */
    public static String slug(String s) {
        String n = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replace("'", "").replace("’", "").replace(".", "");
        return n.replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
    }

    public Optional<String> category(String raw) {
        return Optional.ofNullable(categories.get(key(raw)));
    }

    public Optional<String> subcategory(String raw) {
        return Optional.ofNullable(subcategories.get(key(raw)));
    }

    public String categoryOf(String subcategory) {
        return subcategoryCategory.get(subcategory);
    }

    public Optional<String> color(String raw) {
        String k = key(raw);
        if (colors.containsKey(k)) {
            return Optional.of(colors.get(k));
        }
        // "White/Black", "Branco e preto": a primeira cor reconhecida é a dominante
        for (String part : k.split(" and |/| e | ")) {
            if (colors.containsKey(part.trim())) {
                return Optional.of(colors.get(part.trim()));
            }
        }
        return Optional.empty();
    }

    public Optional<String> material(String raw) {
        String k = key(raw);
        if (materials.containsKey(k)) {
            return Optional.of(materials.get(k));
        }
        for (String token : k.split(" ")) {
            if (materials.containsKey(token)) {
                return Optional.of(materials.get(token));
            }
        }
        return Optional.empty();
    }

    public Optional<String> gender(String raw) {
        return Optional.ofNullable(genders.get(key(raw)));
    }

    /** Slug canônico de uma marca escrita de qualquer jeito, resolvendo apelidos ("PRL" → ralph-lauren). */
    public String brandSlug(String raw) {
        String alias = brandAliases.get(key(raw));
        return alias != null ? alias : slug(raw);
    }

    /** Palavras significativas de uma consulta (sem stopwords), já normalizadas. */
    public List<String> tokens(String raw) {
        List<String> out = new ArrayList<>();
        for (String t : key(raw).split(" ")) {
            if (!t.isBlank() && !stopwords.contains(t)) {
                out.add(t);
            }
        }
        return out;
    }

    /** Título normalizado para dedup ("Nike Air Force 1 '07 White" → "nike air force 1 07 white"). */
    public String normalizedTitle(String title) {
        return String.join(" ", tokens(title));
    }

    /**
     * Chave de deduplicação pelo identificador mais forte disponível. Nunca só o nome quando há código; o título entra
     * só como último recurso (marca + título normalizado + cor).
     */
    public String dedupKey(String brandSlug, String gtin, String ean, String upc, String sku, String productCode,
                           String canonicalUrl, String modelName, String variant, String title, String color) {
        if (notBlank(gtin)) {
            return "gtin:" + digits(gtin);
        }
        if (notBlank(ean)) {
            return "ean:" + digits(ean);
        }
        if (notBlank(upc)) {
            return "upc:" + digits(upc);
        }
        if (notBlank(sku)) {
            return "sku:" + brandSlug + ":" + code(sku);
        }
        if (notBlank(productCode)) {
            return "code:" + brandSlug + ":" + code(productCode);
        }
        if (notBlank(canonicalUrl)) {
            return "url:" + canonicalUrl(canonicalUrl);
        }
        String c = color == null ? "" : color;
        if (notBlank(modelName)) {
            return "model:" + brandSlug + ":" + key(modelName).replace(' ', '-') + ":" + key(variant == null ? c : variant).replace(' ', '-');
        }
        return "title:" + brandSlug + ":" + normalizedTitle(title).replace(' ', '-') + ":" + key(c).replace(' ', '-');
    }

    /** URL canônica: sem esquema, "www.", query, fragmento e barra final; domínio minúsculo. */
    public static String canonicalUrl(String url) {
        if (url == null) {
            return null;
        }
        String u = url.trim().replaceFirst("(?i)^https?://", "").replaceFirst("(?i)^www\\.", "");
        int q = u.indexOf('?');
        if (q >= 0) {
            u = u.substring(0, q);
        }
        int f = u.indexOf('#');
        if (f >= 0) {
            u = u.substring(0, f);
        }
        u = u.replaceAll("/+$", "");
        int slash = u.indexOf('/');
        return slash < 0 ? u.toLowerCase(Locale.ROOT) : u.substring(0, slash).toLowerCase(Locale.ROOT) + u.substring(slash);
    }

    /** Domínio registrável de uma URL ("https://www.nike.com.br/p/x" → "nike.com.br"). */
    public static String domain(String url) {
        String c = canonicalUrl(url);
        if (c == null) {
            return null;
        }
        int slash = c.indexOf('/');
        return slash < 0 ? c : c.substring(0, slash);
    }

    /** O domínio pertence a uma fonte oficial (o próprio domínio ou um subdomínio dela). */
    public static boolean sameSite(String domain, String official) {
        if (domain == null || official == null) {
            return false;
        }
        String d = domain.toLowerCase(Locale.ROOT), o = official.toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
        return d.equals(o) || d.endsWith("." + o);
    }

    private static String digits(String s) {
        return s.replaceAll("[^0-9]", "");
    }

    private static String code(String s) {
        return s.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}

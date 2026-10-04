package br.com.fashionai.application.demo;

import br.com.fashionai.application.taxonomy.Taxonomy;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Fixtures do Demo/Test Data Pipeline, versionadas em {@code classpath:demo/fixtures/*.json} (revisadas com o código;
 * o endpoint não aceita fixture vinda de fora). Validadas contra a taxonomia ao carregar: fixture inválida falha cedo.
 */
@Component
@Lazy   // só carrega quando o pipeline demo é usado: fixture de QA nunca impede a API de subir em produção
public class DemoFixtures {
    /** Semente fixa: o mesmo seed gera sempre os mesmos dados. */
    public static final long SEED = 2026L;
    public static final Set<String> PROFILES = Set.of("frontend", "full");

    public record Persona(String fixtureKey, String kind, String username, String displayName, String email, String bio,
                          boolean privateAccount, boolean verified, int pieces, int publicPieces, int looks,
                          int publishedLooks, int forSale, String catalogBrand, String avatarUrl, String coverUrl) {
        public boolean brand() {
            return "BRAND".equals(kind);
        }

        public boolean celebrity() {
            return "CELEBRITY".equals(kind);
        }
    }

    public record PieceTemplate(String category, String subcategory, String label, String imageUrl, String slot) {
    }

    public record LookTemplate(String title, String style, String occasion) {
    }

    public record CatalogBrand(String fixtureKey, String name, String slug, String website) {
    }

    public record Follow(String from, String to, String status) {
    }

    public record Save(String user, String owner, int looks, int pieces) {
    }

    private final List<Persona> personas;
    private final JsonNode followers;
    private final List<PieceTemplate> pieces;
    private final List<String> colors;
    private final List<String> materials;
    private final List<String> sizes;
    private final BigDecimal priceMin;
    private final BigDecimal priceMax;
    private final List<LookTemplate> looks;
    private final List<CatalogBrand> brands;
    private final List<String> captions;
    private final List<String> comments;
    private final List<Follow> follows;
    private final JsonNode likes;
    private final JsonNode commentPlan;
    private final List<Save> saves;

    public DemoFixtures() {
        // campo numérico omitido = 0 (ex.: um "save" só de looks não traz "pieces"); o Jackson 3 recusaria por padrão
        ObjectMapper om = JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES).build();
        JsonNode users = read(om, "users.json");
        this.personas = list(om, users.get("personas"), Persona.class);
        this.followers = users.get("followers");
        JsonNode w = read(om, "wardrobes.json");
        this.pieces = list(om, w.get("pieces"), PieceTemplate.class);
        this.colors = list(om, w.get("colors"), String.class);
        this.materials = list(om, w.get("materials"), String.class);
        this.sizes = list(om, w.get("sizes"), String.class);
        this.priceMin = w.get("priceMin").decimalValue();
        this.priceMax = w.get("priceMax").decimalValue();
        this.looks = list(om, read(om, "schemes.json").get("looks"), LookTemplate.class);
        this.brands = list(om, read(om, "brands.json").get("brands"), CatalogBrand.class);
        JsonNode posts = read(om, "posts.json");
        this.captions = list(om, posts.get("captions"), String.class);
        this.comments = list(om, posts.get("comments"), String.class);
        JsonNode graph = read(om, "social_graph.json");
        this.follows = list(om, graph.get("follows"), Follow.class);
        this.likes = graph.get("likes");
        this.commentPlan = graph.get("comments");
        this.saves = list(om, graph.get("saves"), Save.class);
        validate();
    }

    private void validate() {
        List<String> errors = new ArrayList<>();
        Set<String> keys = new java.util.HashSet<>();
        for (Persona p : personas) {
            if (!keys.add(p.fixtureKey())) {
                errors.add("fixture_key repetida: " + p.fixtureKey());
            }
            if (!p.username().startsWith(br.com.fashionai.domain.model.User.DEMO_PREFIX)) {
                errors.add(p.fixtureKey() + ": username sem o prefixo demo_");
            }
            if (!p.email().endsWith("@example.test")) {
                errors.add(p.fixtureKey() + ": e-mail fora de @example.test");
            }
            if (p.publicPieces() > p.pieces() || p.publishedLooks() > p.looks() || p.forSale() > p.pieces()) {
                errors.add(p.fixtureKey() + ": contagens incoerentes");
            }
            if (p.catalogBrand() != null && brands.stream().noneMatch(b -> b.fixtureKey().equals(p.catalogBrand()))) {
                errors.add(p.fixtureKey() + ": marca de catálogo inexistente " + p.catalogBrand());
            }
        }
        for (PieceTemplate t : pieces) {
            List<String> subs = Taxonomy.SUBCATEGORIES.get(t.category());
            if (subs == null || !subs.contains(t.subcategory())) {
                errors.add("peça fora da taxonomia: " + t.category() + "/" + t.subcategory());
            }
        }
        colors.stream().filter(c -> !Taxonomy.COLORS.containsKey(c)).forEach(c -> errors.add("cor fora da taxonomia: " + c));
        materials.stream().filter(m -> !Taxonomy.MATERIALS.contains(m)).forEach(m -> errors.add("material fora da taxonomia: " + m));
        for (LookTemplate l : looks) {
            if (!Taxonomy.STYLES.contains(l.style()) || !Taxonomy.OCCASIONS.contains(l.occasion())) {
                errors.add("look fora da taxonomia: " + l.title());
            }
        }
        if (!errors.isEmpty()) {
            throw new IllegalStateException("fixtures demo inválidas: " + String.join("; ", errors));
        }
    }

    /** Personas do perfil, mais os seguidores extras no perfil "full". */
    public List<Persona> personas(String profile) {
        List<Persona> out = new ArrayList<>(personas);
        if (followers != null && "full".equals(profile)) {
            int n = followers.get("count").asInt();
            for (int i = 1; i <= n; i++) {
                out.add(new Persona(String.format(followers.get("fixtureKeyPattern").asString(), i), "USER",
                        String.format(followers.get("usernamePattern").asString(), i),
                        String.format(followers.get("displayNamePattern").asString(), i),
                        String.format(followers.get("emailPattern").asString(), i),
                        "Seguidor de demonstração.", false, false, 0, 0, 0, 0, 0, null, null, null));
            }
        }
        return out;
    }

    /** Todas as fixture_keys que o perfil deve ter (para o verify). */
    public List<String> fixtureKeys(String profile) {
        return personas(profile).stream().map(Persona::fixtureKey).toList();
    }

    public List<PieceTemplate> pieces() {
        return pieces;
    }

    public List<String> colors() {
        return colors;
    }

    public List<String> materials() {
        return materials;
    }

    public List<String> sizes() {
        return sizes;
    }

    public BigDecimal priceMin() {
        return priceMin;
    }

    public BigDecimal priceMax() {
        return priceMax;
    }

    public List<LookTemplate> looks() {
        return looks;
    }

    public List<CatalogBrand> brands() {
        return brands;
    }

    public List<String> captions() {
        return captions;
    }

    public List<String> comments() {
        return comments;
    }

    public List<Follow> follows() {
        return follows;
    }

    public List<Save> saves() {
        return saves;
    }

    /** Plano de curtidas por dono: "all", um número (as n primeiras contas) ou uma lista por post. */
    public JsonNode likes(String ownerKey) {
        return likes == null ? null : likes.get(ownerKey);
    }

    /** Plano de comentários por dono: {posts, perPost}. */
    public Map<String, int[]> commentPlan() {
        Map<String, int[]> out = new LinkedHashMap<>();
        if (commentPlan != null) {
            commentPlan.properties().forEach(e -> out.put(e.getKey(),
                    new int[]{e.getValue().get("posts").asInt(), e.getValue().get("perPost").asInt()}));
        }
        return out;
    }

    private static JsonNode read(ObjectMapper om, String file) {
        try (InputStream in = DemoFixtures.class.getResourceAsStream("/demo/fixtures/" + file)) {
            if (in == null) {
                throw new IllegalStateException("fixture ausente: demo/fixtures/" + file);
            }
            return om.readTree(in);
        } catch (IOException e) {
            throw new IllegalStateException("fixture ilegível: demo/fixtures/" + file, e);
        }
    }

    private static <T> List<T> list(ObjectMapper om, JsonNode node, Class<T> type) {
        List<T> out = new ArrayList<>();
        if (node != null) {
            for (JsonNode n : node) {
                out.add(om.convertValue(n, type));
            }
        }
        return List.copyOf(out);
    }
}

package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Semantic Region Registry (catalog/semantic-regions.json): região de foco, regiões críticas, ocupação, margem e âncora
 * por piece_type, com sobrescrita por subcategoria. Subcategoria nova = uma entrada no JSON, sem código.
 */
public final class SemanticRegionRegistry {
    public static final String RESOURCE = "/catalog/semantic-regions.json";
    private static volatile SemanticRegionRegistry instance;

    public record Region(String name, NRect rect) {
    }

    /**
     * Perfil de enquadramento (Category Scale Profile) já resolvido para piece_type + subcategoria.
     *
     * @param occupancy mín, ideal, máx da fração do quadro ocupada pelo maior lado da peça
     * @param margin    margem de segurança mínima e confortável (fração do quadro)
     * @param anchor    onde o centro do foco deve cair no quadro (x, y)
     * @param laceless  calçado sem cadarço: o foco é a região equivalente (gáspea, tiras, cano)
     */
    public record Profile(PieceType pieceType, String subcategory, Region focus, List<Region> critical, double[] occupancy,
                          double[] margin, double[] anchor, boolean laceless) {
    }

    private final String version;
    private final int[] aspect;
    private final Map<PieceType, JsonNode> types = new EnumMap<>(PieceType.class);

    SemanticRegionRegistry(JsonNode root) {
        this.version = root.path("version").asString("0");
        this.aspect = new int[]{root.path("aspect").path(0).asInt(4), root.path("aspect").path(1).asInt(5)};
        for (PieceType t : PieceType.values()) {
            JsonNode n = root.path("pieceTypes").path(t.name());
            if (n.isMissingNode()) {
                throw new IllegalStateException("semantic-regions.json sem piece_type " + t);
            }
            types.put(t, n);
        }
    }

    public static SemanticRegionRegistry get() {
        if (instance == null) {
            synchronized (SemanticRegionRegistry.class) {
                if (instance == null) {
                    try (InputStream in = SemanticRegionRegistry.class.getResourceAsStream(RESOURCE)) {
                        if (in == null) {
                            throw new IllegalStateException("Recurso ausente: " + RESOURCE);
                        }
                        instance = new SemanticRegionRegistry(new ObjectMapper().readTree(in));
                    } catch (IOException e) {
                        throw new UncheckedIOException(e);
                    }
                }
            }
        }
        return instance;
    }

    public static SemanticRegionRegistry of(JsonNode root) {
        return new SemanticRegionRegistry(root);
    }

    public String version() {
        return version;
    }

    /** largura:altura do quadro do card (4:5, o mesmo dos cards de peça do front) */
    public double aspectRatio() {
        return (double) aspect[0] / aspect[1];
    }

    public Profile profile(PieceType type, String subcategory) {
        JsonNode base = types.get(type);
        JsonNode sub = subcategory == null ? null : base.path("subcategories").get(subcategory);
        if (sub == null && subcategory != null) {
            // subcategoria antiga da taxonomia (ex.: denim_shorts → shorts): usa o enquadramento da que a substituiu, para
            // as peças já gravadas com o código antigo não caírem no enquadramento genérico do tipo
            sub = TaxonomyRegistry.get().subcategory(subcategory).filter(TaxonomyRegistry.Subcategory::legacy)
                    .map(TaxonomyRegistry.Subcategory::replacedBy).map(r -> base.path("subcategories").get(r)).orElse(null);
        }
        JsonNode focus = pick(sub, base, "focus");
        List<Region> critical = new ArrayList<>();
        pick(sub, base, "critical").forEach(c -> critical.add(region(c)));
        return new Profile(type, subcategory, region(focus), List.copyOf(critical), doubles(pick(sub, base, "occupancy")),
                doubles(pick(sub, base, "margin")), doubles(pick(sub, base, "anchor")),
                sub != null && sub.path("laceless").asBoolean(false));
    }

    private static JsonNode pick(JsonNode sub, JsonNode base, String key) {
        return sub != null && sub.has(key) ? sub.get(key) : base.path(key);
    }

    private static Region region(JsonNode n) {
        return new Region(n.path("name").asString("region"), NRect.of(doubles(n.path("rect"))));
    }

    private static double[] doubles(JsonNode arr) {
        double[] out = new double[arr.size()];
        for (int i = 0; i < out.length; i++) {
            out[i] = arr.get(i).asDouble();
        }
        return out;
    }
}

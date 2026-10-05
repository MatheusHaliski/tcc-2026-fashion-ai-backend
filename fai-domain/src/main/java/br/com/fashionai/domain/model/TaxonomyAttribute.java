package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Atributo da peça/produto numa dimensão da taxonomia (acabamento, comprimento, cano, estilo, ocasião…): uma linha por
 * (dimensão, valor) em wardrobe_item_attributes / catalog_product_attributes (V42/V43). O vocabulário e o escopo são
 * validados pela aplicação (Taxonomy.variationErrors) e pela FK para taxonomy_values.
 */
@Getter
@Setter
@NoArgsConstructor
@Embeddable
public class TaxonomyAttribute {
    @Column(name = "dimension_code", nullable = false, length = 30)
    private String dimensionCode;

    @Column(name = "value_code", nullable = false, length = 60)
    private String valueCode;

    /** USER · AI · CATALOG · RULE */
    @Column(nullable = false, length = 12)
    private String source;

    @Column(precision = 4, scale = 3)
    private BigDecimal confidence;

    @Column(nullable = false)
    private int position;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public TaxonomyAttribute(String dimensionCode, String valueCode, String source, BigDecimal confidence, int position) {
        this.dimensionCode = dimensionCode;
        this.valueCode = valueCode;
        this.source = source;
        this.confidence = confidence;
        this.position = position;
        this.createdAt = Instant.now();
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof TaxonomyAttribute a && Objects.equals(dimensionCode, a.dimensionCode) && Objects.equals(valueCode, a.valueCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(dimensionCode, valueCode);
    }

    /** dimensão → códigos na ordem gravada (sem as dimensões de {@code exclude}). */
    public static Map<String, List<String>> toMap(Collection<TaxonomyAttribute> attrs, Set<String> exclude) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        attrs.stream().filter(a -> !exclude.contains(a.getDimensionCode()))
                .sorted(Comparator.comparing(TaxonomyAttribute::getDimensionCode).thenComparingInt(TaxonomyAttribute::getPosition))
                .forEach(a -> out.computeIfAbsent(a.getDimensionCode(), k -> new ArrayList<>()).add(a.getValueCode()));
        return out;
    }

    /**
     * Troca os valores de uma dimensão mantendo os que já existiam iguais (origem e data originais). Lista vazia ou
     * nula apaga a dimensão.
     */
    public static void replace(Set<TaxonomyAttribute> attrs, String dimension, List<String> codes, String source, BigDecimal confidence) {
        List<String> wanted = codes == null ? List.of() : codes.stream().filter(Objects::nonNull).distinct().toList();
        attrs.removeIf(a -> a.getDimensionCode().equals(dimension) && !wanted.contains(a.getValueCode()));
        for (int i = 0; i < wanted.size(); i++) {
            String code = wanted.get(i);
            int pos = i;
            attrs.stream().filter(a -> a.getDimensionCode().equals(dimension) && a.getValueCode().equals(code)).findFirst()
                    .ifPresentOrElse(a -> a.setPosition(pos), () -> attrs.add(new TaxonomyAttribute(dimension, code, source, confidence, pos)));
        }
    }
}

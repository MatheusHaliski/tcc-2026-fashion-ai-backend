package br.com.fashionai.application.piece3d;

import br.com.fashionai.application.common.ApiException;

import java.util.List;
import java.util.Map;

/**
 * Documento de personalização (mesma forma de lib/atelier3d/document.ts): transformações por nó, materiais editáveis e
 * deslocamentos de vértices. Validação pura: limites de tamanho, números finitos, cor em hex. Escala é ajuste visual e
 * nunca é convertida em medida oficial ou tamanho comercial.
 */
public record CustomizationDocument(Map<String, NodeEdit> nodes, Map<String, MaterialEdit> materials, Map<String, Map<String, List<Double>>> vertices) {
    public record NodeEdit(List<Double> position, List<Double> rotation, List<Double> scale, Boolean visible) { }
    public record MaterialEdit(String color, Double roughness, Double metalness, List<Double> repeat, Double rotation) { }

    public static CustomizationDocument empty() {
        return new CustomizationDocument(Map.of(), Map.of(), Map.of());
    }

    public CustomizationDocument validated() {
        Map<String, NodeEdit> n = nodes == null ? Map.of() : nodes;
        Map<String, MaterialEdit> m = materials == null ? Map.of() : materials;
        Map<String, Map<String, List<Double>>> v = vertices == null ? Map.of() : vertices;
        if (n.size() > 2000 || m.size() > 500 || v.size() > 500) throw invalid("Documento grande demais.");
        for (var e : n.entrySet()) {
            key(e.getKey());
            NodeEdit edit = e.getValue();
            if (edit == null) throw invalid("Nó sem dados.");
            vec(edit.position(), 3); vec(edit.rotation(), 3); vec(edit.scale(), 3);
            if (edit.scale() != null && edit.scale().stream().anyMatch(s -> s <= 0 || s > 100)) throw invalid("Escala fora do intervalo.");
        }
        for (var e : m.entrySet()) {
            key(e.getKey());
            MaterialEdit edit = e.getValue();
            if (edit == null) throw invalid("Material sem dados.");
            if (edit.color() != null && !edit.color().matches("#[0-9a-fA-F]{6}")) throw invalid("Cor inválida.");
            unit(edit.roughness()); unit(edit.metalness()); vec(edit.repeat(), 2); finite(edit.rotation());
        }
        for (var e : v.entrySet()) {
            key(e.getKey());
            if (e.getValue() == null || e.getValue().size() > 20000) throw invalid("Deslocamentos demais.");
            e.getValue().values().forEach(list -> vec(list, 3));
        }
        return new CustomizationDocument(n, m, v);
    }

    public boolean touchesScale() {
        return nodes != null && nodes.values().stream().anyMatch(e -> e != null && e.scale() != null && e.scale().stream().anyMatch(s -> Math.abs(s - 1d) > 1e-6));
    }

    private static void key(String key) {
        if (key == null || key.isBlank() || key.length() > 200) throw invalid("Chave inválida.");
    }

    private static void vec(List<Double> values, int size) {
        if (values == null) return;
        if (values.size() != size) throw invalid("Vetor com tamanho errado.");
        values.forEach(CustomizationDocument::finite);
    }

    private static void unit(Double value) {
        finite(value);
        if (value != null && (value < 0 || value > 1)) throw invalid("Valor fora de 0–1.");
    }

    private static void finite(Double value) {
        if (value != null && (value.isNaN() || value.isInfinite() || Math.abs(value) > 1e6)) throw invalid("Número inválido.");
    }

    private static ApiException invalid(String message) {
        return ApiException.badRequest("CUSTOMIZATION_INVALID", message);
    }
}

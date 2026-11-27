package br.com.fashionai.application.demand;

import br.com.fashionai.domain.model.RetailDemandEvent;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Agregação pura com limiar de publicação (RF-PESQ-10 CA2/CA3): cada recorte (produto × cor × tamanho × tipo) só é
 * publicado com pelo menos {@code k} contribuintes distintos; além disso, o resto não publicado de cada produto
 * também precisa ter ≥ k contribuintes (ou zero), para que a diferença entre o total e os recortes visíveis não
 * reconstrua um grupo pequeno.
 */
public final class DemandAggregation {
    private DemandAggregation() {
    }

    public record Cell(UUID productId, String colorName, String sizeLabel, String kind, long events, long contributors) { }
    public record Result(List<Cell> cells, int suppressedCells, long sampleSize, long contributors) { }

    private record Key(UUID productId, String colorName, String sizeLabel, String kind) { }

    public static Result aggregate(List<RetailDemandEvent> events, int k) {
        Map<Key, List<RetailDemandEvent>> byCell = new LinkedHashMap<>();
        Set<String> allContributors = new HashSet<>();
        for (RetailDemandEvent e : events) {
            byCell.computeIfAbsent(new Key(e.getProductId(), e.getColorName(), e.getSizeLabel(), e.getKind()), key -> new ArrayList<>()).add(e);
            allContributors.add(e.getContributorHash());
        }
        List<Cell> published = new ArrayList<>();
        int suppressed = 0;
        for (var entry : byCell.entrySet()) {
            Set<String> contributors = new HashSet<>();
            entry.getValue().forEach(e -> contributors.add(e.getContributorHash()));
            Key key = entry.getKey();
            if (contributors.size() >= k) published.add(new Cell(key.productId(), key.colorName(), key.sizeLabel(), key.kind(), entry.getValue().size(), contributors.size()));
            else suppressed++;
        }
        // Supressão complementar por produto: o resto (total do produto − recortes publicados) nunca fica entre 1 e k−1.
        Map<UUID, Set<String>> perProduct = new LinkedHashMap<>();
        for (RetailDemandEvent e : events) perProduct.computeIfAbsent(e.getProductId(), id -> new HashSet<>()).add(e.getContributorHash());
        boolean changed = true;
        while (changed) {
            changed = false;
            for (var product : perProduct.entrySet()) {
                Set<String> visible = new HashSet<>();
                for (Cell c : published) if (c.productId().equals(product.getKey())) for (RetailDemandEvent e : byCell.get(new Key(c.productId(), c.colorName(), c.sizeLabel(), c.kind()))) visible.add(e.getContributorHash());
                Set<String> rest = new HashSet<>(product.getValue());
                rest.removeAll(visible);
                if (rest.isEmpty() || rest.size() >= k) continue;
                published.stream().filter(c -> c.productId().equals(product.getKey())).min(Comparator.comparingLong(Cell::contributors)).ifPresent(published::remove);
                suppressed++;
                changed = true;
            }
        }
        published.sort(Comparator.comparingLong(Cell::contributors).reversed());
        return new Result(List.copyOf(published), suppressed, events.size(), allContributors.size());
    }
}

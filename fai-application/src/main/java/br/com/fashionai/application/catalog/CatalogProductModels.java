package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogProductModel3d;
import br.com.fashionai.domain.model.enums.CatalogModelStatus;
import br.com.fashionai.domain.repository.CatalogProductModel3dRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Etapa 3 — URL do modelo 3D de vitrine (PUBLISHED, V86) de cada produto do catálogo, para o card, o detalhe e a peça
 * que alguém leva do catálogo para o guarda-roupa. Uma consulta por lista, nunca uma por card.
 *
 * <p>Serve o arquivo do perfil WEB (≤ 6 MB: é o que o navegador baixa); sem ele, o DESKTOP_HIGH. A chave tem de ser
 * do bucket público ({@code /media/...}, sem {@code ..}, barra inicial nem {@code restricted/}, a mesma regra do
 * GarmentAssetService). Dois PUBLISHED do mesmo produto (não deveria acontecer): vale o publicado por último.
 */
@Service
public class CatalogProductModels {
    static final List<String> PROFILES = List.of("WEB", "DESKTOP_HIGH");

    private final CatalogProductModel3dRepository models;

    public CatalogProductModels(CatalogProductModel3dRepository models) {
        this.models = models;
    }

    /** produto → URL {@code /media/...} do modelo publicado; produto sem modelo fica de fora. */
    public Map<UUID, String> urls(Collection<UUID> productIds) {
        List<UUID> ids = productIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, CatalogProductModel3d> newest = new HashMap<>();
        Comparator<CatalogProductModel3d> order = Comparator.comparing(
                m -> m.getPublishedAt() == null ? Instant.EPOCH : m.getPublishedAt());
        for (CatalogProductModel3d m : models.findByCatalogProductIdInAndStatus(ids, CatalogModelStatus.PUBLISHED)) {
            newest.merge(m.getCatalogProductId(), m, (a, b) -> order.compare(a, b) >= 0 ? a : b);
        }
        Map<UUID, String> out = new HashMap<>();
        newest.forEach((id, m) -> {
            String url = urlOf(m.getRenditionsJson());
            if (url != null) {
                out.put(id, url);
            }
        });
        return out;
    }

    public String url(UUID productId) {
        return productId == null ? null : urls(List.of(productId)).get(productId);
    }

    /** Põe {@code model3dUrl} (ou null) em cada card, pela chave {@code id}. */
    public void decorate(List<Map<String, Object>> cards) {
        Map<UUID, String> found = urls(cards.stream().map(c -> c.get("id") instanceof UUID u ? u : null).toList());
        cards.forEach(c -> c.put("model3dUrl", c.get("id") instanceof UUID u ? found.get(u) : null));
    }

    static String urlOf(String renditionsJson) {
        Map<String, Object> renditions = Json.map(renditionsJson);
        for (String profile : PROFILES) {
            if (renditions.get(profile) instanceof Map<?, ?> r && r.get("key") instanceof String key && safe(key)) {
                return "/media/" + key;
            }
        }
        return null;
    }

    static boolean safe(String key) {
        return !key.isBlank() && !key.contains("..") && !key.startsWith("/") && !key.startsWith("restricted/")
                && !key.contains("\\") && key.endsWith(".glb");
    }
}

package br.com.fashionai.application.fit;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.GarmentAsset3d;
import br.com.fashionai.domain.model.PhysicalStoreListing;
import br.com.fashionai.domain.model.PhysicalStoreVariant;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.GarmentAssetStatus;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.fit.ProductSizeChart;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.GarmentAsset3dRepository;
import br.com.fashionai.domain.repository.PhysicalStoreListingRepository;
import br.com.fashionai.domain.repository.PhysicalStoreVariantRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.fit.ProductSizeChartRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF — seleção e representação do tamanho. Distingue tamanho comercial (marca/loja), medidas cadastradas (tabela por
 * produto, com unidade, protocolo e origem) e variação visual estimada (grade do provador aplicada ao modelo 3D). A
 * disponibilidade vem da loja (RF-PESQ-01); tamanho só com variação estimada é dito como aproximação, nunca como
 * medida oficial, ajuste por molde ou caimento validado.
 */
@Service
@Transactional(readOnly = true)
public class SizeOptionsService {
    private final WardrobeItemRepository pieces;
    private final CatalogProductRepository products;
    private final ProductSizeChartRepository charts;
    private final PhysicalStoreListingRepository listings;
    private final PhysicalStoreVariantRepository variants;
    private final GarmentAsset3dRepository assets;

    public SizeOptionsService(WardrobeItemRepository pieces, CatalogProductRepository products, ProductSizeChartRepository charts,
                              PhysicalStoreListingRepository listings, PhysicalStoreVariantRepository variants, GarmentAsset3dRepository assets) {
        this.pieces = pieces; this.products = products; this.charts = charts; this.listings = listings; this.variants = variants; this.assets = assets;
    }

    public Map<String, Object> forProduct(UUID productId) {
        CatalogProduct p = products.findById(productId).orElseThrow(() -> ApiException.notFound("Produto"));
        return build(p.getCategory(), p.getSubcategory(), p, null);
    }

    public Map<String, Object> forPiece(WardrobeItem w) {
        CatalogProduct p = w.getCatalogProductId() == null ? null : products.findById(w.getCatalogProductId()).orElse(null);
        return build(w.getCategory(), w.getSubcategory(), p, w);
    }

    Map<String, Object> build(String category, String subcategory, CatalogProduct product, WardrobeItem piece) {
        String grid = SizeGrids.gridOf(category, subcategory);
        Map<String, Map<String, Object>> rows = new LinkedHashMap<>();
        Map<String, Object> representation = representation(product, piece);
        boolean approximations = !"NONE".equals(representation.get("kind"));
        for (String label : SizeGrids.labels(grid)) {
            Map<String, Object> row = row(label, "GRID", "UNKNOWN");
            row.put("representation", approximations ? "VISUAL_APPROXIMATION" : "NONE");
            rows.put(label, row);
        }
        if (product != null) {
            for (PhysicalStoreListing listing : listings.findAll().stream().filter(l -> l.isActive() && l.getProduct().getId().equals(product.getId())).toList()) {
                for (PhysicalStoreVariant v : variants.findByListingIdOrderByVariantKeyAsc(listing.getId())) {
                    if (!v.isActive()) continue;
                    Map<String, Object> row = rows.computeIfAbsent(v.getSizeLabel(), label -> row(label, "STORE", "UNKNOWN"));
                    row.put("source", "STORE");
                    String availability = v.available() > 0 ? "AVAILABLE" : "UNAVAILABLE";
                    row.put("availability", "AVAILABLE".equals(row.get("availability")) ? "AVAILABLE" : availability);
                    if (!approximations) row.put("representation", "NONE");
                }
            }
            charts.findByProductId(product.getId()).ifPresent(chart -> applyChart(chart, rows, approximations));
        }
        if (piece != null && piece.getSizeLabel() != null && !piece.getSizeLabel().isBlank()) {
            Map<String, Object> row = rows.computeIfAbsent(piece.getSizeLabel(), label -> row(label, "OWNER", "UNKNOWN"));
            row.put("ownerDeclared", true);
            if (!row.containsKey("representation")) row.put("representation", approximations ? "VISUAL_APPROXIMATION" : "NONE");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("grid", grid);
        out.put("sizes", new ArrayList<>(rows.values()));
        out.put("representation3d", representation);
        out.put("availabilityKnown", rows.values().stream().anyMatch(r -> !"UNKNOWN".equals(r.get("availability"))));
        out.put("measurementsKnown", rows.values().stream().anyMatch(r -> !((List<?>) r.get("measurements")).isEmpty()));
        out.put("visualApproximationNote", approximations ? "SIZES_ON_3D_ARE_RELATIVE_VISUAL_APPROXIMATIONS" : "NO_3D_REPRESENTATION");
        out.put("avatarMeasurementsChanged", false);
        out.put("fitClaim", "NONE");
        return out;
    }

    private static Map<String, Object> row(String label, String source, String availability) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("source", source);
        row.put("availability", availability);
        row.put("measurements", new ArrayList<Map<String, Object>>());
        row.put("ownerDeclared", false);
        return row;
    }

    /** Medidas da tabela por produto: valor, unidade, protocolo e origem (oficial autorizada ou outro método). */
    private static void applyChart(ProductSizeChart chart, Map<String, Map<String, Object>> rows, boolean approximations) {
        FitContracts.ChartData data;
        try { data = Json.read(chart.getChartJson(), FitContracts.ChartData.class); } catch (RuntimeException ex) { return; }
        if (data == null || data.options() == null) return;
        String provenance = data.sourceAuthorized() ? "OFFICIAL" : "OTHER_METHOD";
        for (FitContracts.SizeOption option : data.options()) {
            Map<String, Object> row = rows.computeIfAbsent(option.label(), label -> row(label, "CHART", "UNKNOWN"));
            if ("GRID".equals(row.get("source"))) row.put("source", "CHART");
            if (!row.containsKey("representation")) row.put("representation", approximations ? "VISUAL_APPROXIMATION" : "NONE");
            @SuppressWarnings("unchecked") List<Map<String, Object>> measurements = (List<Map<String, Object>>) row.get("measurements");
            for (FitContracts.Dimension d : option.measurements() == null ? List.<FitContracts.Dimension>of() : option.measurements()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("region", d.region()); m.put("protocol", d.protocol()); m.put("min", d.min()); m.put("max", d.max()); m.put("unit", "cm");
                m.put("provenance", provenance); m.put("sourceName", data.sourceName()); m.put("sourceUrl", data.sourceUrl()); m.put("sourceRevision", data.sourceRevision()); m.put("chartRevision", chart.getRevision());
                measurements.add(m);
            }
        }
    }

    /** Representação 3D: asset aprovado para vestir, GLB de vitrine (estimado da foto) ou nenhuma; quarentena nunca vale como aprovado. */
    private Map<String, Object> representation(CatalogProduct product, WardrobeItem piece) {
        Map<String, Object> out = new LinkedHashMap<>();
        List<GarmentAsset3d> found = new ArrayList<>();
        if (piece != null) found.addAll(assets.findByPieceIdOrderByCreatedAtDesc(piece.getId()));
        if (product != null) found.addAll(assets.findByCatalogProductIdInAndStatus(List.of(product.getId()), GarmentAssetStatus.APPROVED));
        GarmentAsset3d approved = found.stream().filter(a -> a.getStatus() == GarmentAssetStatus.APPROVED).findFirst().orElse(null);
        GarmentAsset3d pending = found.stream().filter(a -> a.getStatus() != GarmentAssetStatus.APPROVED).findFirst().orElse(null);
        boolean showcase = piece != null && piece.getModel3dStatus() == Model3dStatus.COMPLETED && piece.getModel3dUrl() != null;
        out.put("kind", approved != null ? "APPROVED_ASSET" : showcase ? "SHOWCASE_GLB" : "NONE");
        out.put("approvedForTryOn", approved != null);
        out.put("quarantine", approved == null && pending != null ? pending.getStatus().name() : null);
        out.put("origin", approved != null ? approved.getSource() : showcase ? "GENERATED_FROM_PHOTO" : null);
        out.put("reviewStatus", approved != null ? "APPROVED" : pending != null ? pending.getStatus().name() : showcase ? "UNREVIEWED_SHOWCASE" : "NONE");
        out.put("provenance", approved != null ? "VERIFIED" : showcase ? "ESTIMATED" : "NOT_INFORMED");
        out.put("sizeVariants", approved != null || showcase ? "RELATIVE_VISUAL_APPROXIMATION" : "NONE");
        return out;
    }
}

package br.com.fashionai.application.passport;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.fit.SizeOptionsService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ImageOrigin;
import br.com.fashionai.domain.model.passport.GarmentPassport;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.passport.GarmentPassportRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static br.com.fashionai.application.passport.DigitalPassportFields.*;

/**
 * RF — passaporte digital da peça: ficha agregada e somente leitura com identificação, origem, características,
 * tamanhos/medidas, modelo 3D e procedência de cada campo. Campo sem dado aparece como não informado; dado estimado
 * nunca vira certificação. Quem não edita vê só o que a visibilidade da peça permite.
 */
@Service
@Transactional(readOnly = true)
public class DigitalPassportService {
    private final WardrobeItemRepository pieces;
    private final CatalogProductRepository products;
    private final BrandRepository brands;
    private final GarmentPassportRepository passports;
    private final SizeOptionsService sizes;
    private final Guard guard;

    public DigitalPassportService(WardrobeItemRepository pieces, CatalogProductRepository products, BrandRepository brands,
                                  GarmentPassportRepository passports, SizeOptionsService sizes, Guard guard) {
        this.pieces = pieces; this.products = products; this.brands = brands; this.passports = passports; this.sizes = sizes; this.guard = guard;
    }

    public Map<String, Object> sheet(CurrentUser viewer, UUID pieceId) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound("Peça"));
        UUID ownerId = w.getUser().getId();
        boolean owner = viewer != null && viewer.id().equals(ownerId);
        if (!owner && (w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED || !guard.canView(viewer, ownerId, w.getVisibility()))) throw ApiException.notFound("Peça");
        CatalogProduct product = w.getCatalogProductId() == null ? null : products.findById(w.getCatalogProductId()).orElse(null);
        Brand brand = w.getBrand() != null ? w.getBrand() : product != null && product.getBrandId() != null ? brands.findById(product.getBrandId()).orElse(null) : null;
        GarmentPassport passport = owner ? passports.findByPieceId(pieceId).orElse(null) : null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("identifier", "FAI-PIECE-" + pieceId);
        out.put("pieceId", pieceId);
        out.put("catalogProductId", product == null ? null : product.getId());
        out.put("access", owner ? "OWNER" : "VIEWER");
        out.put("identification", identification(w, product, brand));
        out.put("images", images(w, product));
        out.put("materials", materials(w, product, passport));
        Map<String, Object> sizeOptions = sizes.forPiece(w);
        out.put("sizes", sizeOptions);
        out.put("model3d", model3d(w, sizeOptions));
        out.put("provenanceLegend", List.of(VERIFIED, SOURCE_DECLARED, OWNER_DECLARED, ESTIMATED, NOT_INFORMED));
        out.put("notices", List.of("ESTIMATED_IS_NOT_CERTIFICATION", "NO_EU_DPP_COMPLIANCE_CLAIM"));
        out.put("lastUpdated", latest(w.getUpdatedAt(), passport == null ? null : passport.getStateUpdatedAt(), product == null ? null : product.getUpdatedAt()));
        return out;
    }

    private Map<String, Object> identification(WardrobeItem w, CatalogProduct p, Brand brand) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", field(w.getName(), OWNER_DECLARED));
        String brandName = brand != null ? brand.getName() : w.getBrandName();
        out.put("brand", field(brandName, brand != null ? SOURCE_DECLARED : OWNER_DECLARED));
        out.put("category", field(w.getCategory(), OWNER_DECLARED));
        out.put("subcategory", field(w.getSubcategory(), OWNER_DECLARED));
        out.put("description", field(p == null ? null : p.getDescription(), SOURCE_DECLARED));
        out.put("productCode", field(p == null ? null : p.getProductCode() != null ? p.getProductCode() : p.getSku(), SOURCE_DECLARED));
        out.put("gtin", field(p == null ? null : p.getGtin(), SOURCE_DECLARED));
        out.put("catalogVerifiedAt", field(p == null ? null : p.getLastVerifiedAt(), VERIFIED));
        return out;
    }

    private Map<String, Object> images(WardrobeItem w, CatalogProduct p) {
        Map<String, Object> out = new LinkedHashMap<>();
        String reference = w.getStudioImageUrl() != null ? w.getStudioImageUrl() : w.getImageUrl();
        boolean generated = w.isAiGeneratedImage() || w.getImageOrigin() == ImageOrigin.DEFAULT;
        out.put("reference", field(reference, generated ? ESTIMATED : w.getImageOrigin() == ImageOrigin.CATALOG ? SOURCE_DECLARED : OWNER_DECLARED));
        String source = p == null ? null : p.getOfficialProductUrl() != null ? p.getOfficialProductUrl() : p.getCanonicalUrl();
        out.put("sourceUrl", field(source, SOURCE_DECLARED));
        out.put("sourceDomain", field(p == null ? null : p.getSourceDomain(), SOURCE_DECLARED));
        return out;
    }

    private Map<String, Object> materials(WardrobeItem w, CatalogProduct p, GarmentPassport passport) {
        Map<String, Object> out = new LinkedHashMap<>();
        String composition = passport != null && passport.getComposition() != null ? passport.getComposition() : w.getMaterial();
        out.put("composition", field(composition, passport != null && passport.getComposition() != null ? OWNER_DECLARED : p != null && p.getMaterial() != null && p.getMaterial().equalsIgnoreCase(w.getMaterial()) ? SOURCE_DECLARED : OWNER_DECLARED));
        out.put("catalogMaterial", field(p == null ? null : p.getMaterial(), SOURCE_DECLARED));
        String care = passport != null && passport.getCare() != null ? passport.getCare() : w.getCareInstructions();
        out.put("care", field(care, OWNER_DECLARED));
        out.put("washing", field(w.getTipoLavagem() == null ? null : w.getTipoLavagem().getNome(), OWNER_DECLARED));
        out.put("condition", field(w.getEstadoConservacao() != null ? w.getEstadoConservacao().getNome() : w.getCondition() == null ? null : w.getCondition().name(), OWNER_DECLARED));
        out.put("origin", field(passport == null ? null : passport.getOrigin(), OWNER_DECLARED));
        out.put("manufacturing", field(p == null ? null : p.getCollection(), SOURCE_DECLARED));
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> model3d(WardrobeItem w, Map<String, Object> sizeOptions) {
        Map<String, Object> representation = (Map<String, Object>) sizeOptions.get("representation3d");
        Map<String, Object> out = new LinkedHashMap<>(representation);
        boolean showcase = "SHOWCASE_GLB".equals(representation.get("kind"));
        out.put("viewerUrl", field(showcase ? w.getModel3dUrl() : null, ESTIMATED));
        out.put("status", w.getModel3dStatus() == null ? null : w.getModel3dStatus().name());
        out.put("displayAllowed", showcase || Boolean.TRUE.equals(representation.get("approvedForTryOn")));
        out.put("tryOnApproved", Boolean.TRUE.equals(representation.get("approvedForTryOn")));
        out.put("generatedAt", w.getModel3dGeneratedAt());
        return out;
    }
}

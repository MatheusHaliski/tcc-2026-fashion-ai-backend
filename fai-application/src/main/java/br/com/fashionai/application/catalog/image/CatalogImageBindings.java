package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.catalog.image.CatalogPhotoEvidence.photoSet;
import static br.com.fashionai.application.catalog.image.CatalogPreviewCache.currentPreview;

/**
 * Vínculos de uma foto com o banco: variante do contexto, photo set e preview ligados a ela, variante/foto pedidas
 * pelo provador (sempre do mesmo produto) e a permissão de persistência da fonte oficial (RN47.03).
 */
final class CatalogImageBindings {
    private final CatalogImageRepository images;
    private final CatalogSourceRepository sources;
    private final CatalogVariantRepository variants;

    CatalogImageBindings(CatalogImageRepository images, CatalogSourceRepository sources, CatalogVariantRepository variants) {
        this.images = images;
        this.sources = sources;
        this.variants = variants;
    }

    CatalogVariant selectedVariant(CatalogProduct product,
            List<CatalogVariant> productVariants, UUID variantId, UUID imageId) {
        var requested=variantId==null?null:productVariants.stream().filter(v->variantId.equals(v.getId())&&product.getId().equals(v.getProductId()))
                .findFirst().orElseThrow(()->ApiException.notFound("catalog variant"));
        if (imageId!=null) {
            CatalogImage image=images.findById(imageId).filter(i->product.getId().equals(i.getProductId()))
                    .orElseThrow(()->ApiException.notFound("catalog image"));
            if (!CatalogImageIdentity.matches(image,product,requested,productVariants))
                throw ApiException.badRequest("CATALOG_IMAGE_VARIANT_MISMATCH","A foto não pertence à variante selecionada.");
        }
        return requested;
    }

    List<CatalogVariant> contextVariants(CatalogImage image) {
        return image==null||image.getVariantId()==null?List.of():variants.findById(image.getVariantId()).stream().toList();
    }

    Map<String,Object> boundPhotoSet(CatalogImage image,CatalogProduct product) {
        return photoSet(image,product,contextVariants(image));
    }

    boolean currentBoundPreview(CatalogProduct product,CatalogImage image,boolean persist) {
        return currentPreview(product,image,persist,contextVariants(image));
    }

    /** Nível B só quando a fonte oficial do domínio da foto declara allows_image_persistence (RN47.03). */
    boolean allowsPersistence(CatalogProduct product, CatalogImage img) {
        String host = host(img.getImageUrl());
        for (CatalogSource s : sources.findByBrandIdAndActiveTrue(product.getBrandId())) {
            if (!s.isAllowsImagePersistence() || s.getDomain() == null) {
                continue;
            }
            String d = s.getDomain().toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "").replaceAll("\\.+$", "");
            if ((host != null && (host.equals(d) || host.endsWith("." + d)))) {
                return true;
            }
        }
        return false;
    }

    static String host(String url) {
        try {
            URI uri = URI.create(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getRawUserInfo() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)) return null;
            String h = uri.getHost();
            return h == null ? null : h.toLowerCase(Locale.ROOT).replaceAll("\\.+$", "");
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}

package br.com.fashionai.application.catalog.image;

import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/** Exact variant bindings first; legacy principal photos may represent only a proven base color. */
public final class CatalogImageIdentity {
    private CatalogImageIdentity() { }

    public static boolean matches(CatalogImage image, CatalogProduct product, CatalogVariant requested,
                                  List<CatalogVariant> productVariants) {
        if (image==null||product==null||!Objects.equals(image.getProductId(),product.getId())) return false;
        if (image.getVariantId()!=null && productVariants.stream().noneMatch(v->Objects.equals(v.getProductId(),product.getId())
                && Objects.equals(v.getId(),image.getVariantId()))) return false;
        if (requested==null) return true;
        if (!Objects.equals(requested.getProductId(),product.getId())) return false;
        if (image.getVariantId()!=null) return image.getVariantId().equals(requested.getId());
        return (image.isCanonical()||image.isPrimary())
                && Objects.equals(baseVariantId(product,productVariants),requested.getId());
    }

    public static UUID effectiveVariantId(CatalogImage image,CatalogProduct product,List<CatalogVariant> productVariants) {
        if (image==null||product==null||!Objects.equals(image.getProductId(),product.getId())) return null;
        if (image.getVariantId()!=null) return productVariants.stream()
                .filter(v->Objects.equals(v.getProductId(),product.getId())&&Objects.equals(v.getId(),image.getVariantId()))
                .map(CatalogVariant::getId).findFirst().orElse(null);
        return image.isCanonical()||image.isPrimary() ? baseVariantId(product,productVariants) : null;
    }

    private static UUID baseVariantId(CatalogProduct product,List<CatalogVariant> productVariants) {
        List<CatalogVariant> own=productVariants.stream().filter(v->Objects.equals(v.getProductId(),product.getId())).toList();
        String base=color(product.getColor());
        if (base!=null) {
            List<CatalogVariant> same=own.stream().filter(v->base.equals(color(v.getColor()))).toList();
            if (same.size()==1) return same.getFirst().getId();
        }
        if (own.size()==1 && (base==null||color(own.getFirst().getColor())==null)) return own.getFirst().getId();
        return null;
    }

    private static String color(String value) {return value==null||value.isBlank()?null:value.trim().toLowerCase(Locale.ROOT);}
}

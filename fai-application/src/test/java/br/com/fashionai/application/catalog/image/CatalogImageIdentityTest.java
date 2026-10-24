package br.com.fashionai.application.catalog.image;

import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CatalogImageIdentityTest {
    @Test void principalLegacyPhotoHasOnlyTheUnambiguousBaseColorBinding() {
        CatalogProduct product=product("blue");CatalogVariant blue=variant(product,"blue"),red=variant(product,"red");
        CatalogImage photo=photo(product);photo.setCanonical(true);
        assertThat(CatalogImageIdentity.matches(photo,product,blue,List.of(blue,red))).isTrue();
        assertThat(CatalogImageIdentity.matches(photo,product,red,List.of(blue,red))).isFalse();
        assertThat(CatalogImageIdentity.effectiveVariantId(photo,product,List.of(blue,red))).isEqualTo(blue.getId());
        photo.setCanonical(false);
        assertThat(CatalogImageIdentity.matches(photo,product,blue,List.of(blue,red))).isFalse();
        photo.setPrimary(true);
        assertThat(CatalogImageIdentity.matches(photo,product,blue,List.of(blue,red))).isTrue();
    }

    @Test void soleVariantSupportsLegacyUnknownColorButCannotOverrideContradictoryColor() {
        CatalogProduct product=product(null);CatalogVariant sole=variant(product,"blue");CatalogImage photo=photo(product);photo.setPrimary(true);
        assertThat(CatalogImageIdentity.matches(photo,product,sole,List.of(sole))).isTrue();
        product.setColor("red");
        assertThat(CatalogImageIdentity.matches(photo,product,sole,List.of(sole))).isFalse();
        assertThat(CatalogImageIdentity.effectiveVariantId(photo,product,List.of(sole))).isNull();
    }

    @Test void ambiguousColorsAndForeignProductOrVariantNeverReceiveAnInventedBinding() {
        CatalogProduct product=product("blue");CatalogVariant a=variant(product,"blue"),b=variant(product,"blue");
        CatalogImage photo=photo(product);photo.setCanonical(true);
        assertThat(CatalogImageIdentity.matches(photo,product,a,List.of(a,b))).isFalse();
        CatalogProduct other=product("blue");CatalogVariant foreign=variant(other,"blue");
        assertThat(CatalogImageIdentity.matches(photo,other,foreign,List.of(foreign))).isFalse();
        assertThat(CatalogImageIdentity.matches(photo,product,foreign,List.of(foreign))).isFalse();
        photo.setVariantId(foreign.getId());
        assertThat(CatalogImageIdentity.matches(photo,product,null,List.of(foreign))).isFalse();
        photo.setVariantId(UUID.randomUUID());
        assertThat(CatalogImageIdentity.matches(photo,product,null,List.of(a,b))).isFalse();
        photo.setVariantId(a.getId());
        assertThat(CatalogImageIdentity.matches(photo,product,null,List.of(a,b))).isTrue();
        assertThat(CatalogImageIdentity.matches(photo,product,a,List.of(a,b))).isTrue();
        assertThat(CatalogImageIdentity.matches(photo,product,b,List.of(a,b))).isFalse();
        assertThat(CatalogImageIdentity.effectiveVariantId(photo,product,List.of(a,b))).isEqualTo(a.getId());
    }

    private CatalogProduct product(String color){var p=new CatalogProduct();p.assignId(UUID.randomUUID());p.setColor(color);return p;}
    private CatalogVariant variant(CatalogProduct p,String color){var v=new CatalogVariant();v.assignId(UUID.randomUUID());v.setProductId(p.getId());v.setColor(color);return v;}
    private CatalogImage photo(CatalogProduct p){var i=new CatalogImage();i.assignId(UUID.randomUUID());i.setProductId(p.getId());return i;}
}

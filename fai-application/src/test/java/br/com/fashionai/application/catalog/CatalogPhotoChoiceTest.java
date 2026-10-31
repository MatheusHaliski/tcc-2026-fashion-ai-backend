package br.com.fashionai.application.catalog;

import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Unidade pura extraída do {@link CatalogService}: sem repositório, Spring, banco ou rede. */
class CatalogPhotoChoiceTest {
    private static CatalogProduct product() {
        CatalogProduct p = new CatalogProduct();
        p.assignId(UUID.randomUUID());
        p.setCategory("shoes_piece");
        p.setSubcategory("casual_sneakers");
        p.setColor("white");
        return p;
    }

    private static CatalogImage image(UUID productId, int id, String url) {
        CatalogImage i = new CatalogImage();
        i.assignId(UUID.fromString("00000000-0000-0000-0000-00000000000" + id));
        i.setProductId(productId);
        i.setImageUrl(url);
        i.setUsageStatus(CatalogImageUsage.PERSISTED);
        return i;
    }

    private static CatalogVariant variant(CatalogProduct p, String color, String sku) {
        CatalogVariant v = new CatalogVariant();
        v.assignId(UUID.randomUUID());
        v.setProductId(p.getId());
        v.setVariantKey(color);
        v.setColor(color);
        v.setSku(sku);
        return v;
    }

    @Test
    void usableRejectsRejectedUsageRejectedReviewAndMissingUrl() {
        UUID p = UUID.randomUUID();
        CatalogImage ok = image(p, 1, "https://x/ok.jpg");
        CatalogImage usage = image(p, 2, "https://x/u.jpg");
        usage.setUsageStatus(CatalogImageUsage.REJECTED);
        CatalogImage review = image(p, 3, "https://x/r.jpg");
        review.setReviewStatus("REJECTED");
        assertThat(CatalogPhotoChoice.usable(ok)).isTrue();
        assertThat(CatalogPhotoChoice.usable(usage)).isFalse();
        assertThat(CatalogPhotoChoice.usable(review)).isFalse();
        assertThat(CatalogPhotoChoice.usable(image(p, 4, null))).isFalse();
        assertThat(CatalogPhotoChoice.usable(image(p, 5, "  "))).isFalse();
    }

    @Test
    void layersKeepFirstPrimaryLetCanonicalOverrideAndFillOldestOnlyWhereMissing() {
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID();
        CatalogImage a1 = image(a, 1, "https://x/a1.jpg"), a2 = image(a, 2, "https://x/a2.jpg"), b1 = image(b, 3, "https://x/b1.jpg");
        CatalogImage bCanonical = image(b, 4, "https://x/b-canonical.jpg");
        Map<UUID, CatalogImage> main = CatalogPhotoChoice.primaryThenCanonical(List.of(a1, a2, b1), List.of(bCanonical));
        assertThat(main).containsEntry(a, a1).containsEntry(b, bCanonical).hasSize(2);
        assertThat(CatalogPhotoChoice.missing(List.of(c, a, b), main)).containsExactly(c);

        CatalogImage dated = image(c, 5, "https://x/a-dated.jpg");
        dated.markCreatedAt(Instant.parse("2026-05-01T00:00:00Z"));
        CatalogImage older = image(c, 6, "https://x/z-older.jpg");
        older.markCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        CatalogImage undated = image(c, 7, "https://x/0-undated.jpg");
        CatalogImage otherA = image(a, 8, "https://x/other-a.jpg");
        otherA.markCreatedAt(Instant.parse("2000-01-01T00:00:00Z"));
        CatalogPhotoChoice.fillWithOldest(main, List.of(dated, undated, older, otherA));
        assertThat(main).containsEntry(c, older).containsEntry(a, a1);
    }

    @Test
    void selectKeepsTheRequestedVariantAndAppliesCanonicalPrimaryIdPreference() {
        CatalogProduct p = product();
        CatalogVariant white = variant(p, "white", "SKU-W"), red = variant(p, "red", "SKU-R");
        List<CatalogVariant> vs = List.of(white, red);
        CatalogImage redPlain = image(p.getId(), 1, "https://x/red-plain.jpg");
        redPlain.setVariantId(red.getId());
        CatalogImage redPrimary = image(p.getId(), 2, "https://x/red-primary.jpg");
        redPrimary.setVariantId(red.getId()); redPrimary.setPrimary(true);
        CatalogImage redCanonical = image(p.getId(), 3, "https://x/red-canonical.jpg");
        redCanonical.setVariantId(red.getId()); redCanonical.setCanonical(true);
        CatalogImage whiteCanonical = image(p.getId(), 4, "https://x/white.jpg");
        whiteCanonical.setVariantId(white.getId()); whiteCanonical.setCanonical(true);
        List<CatalogImage> all = List.of(redPlain, whiteCanonical, redPrimary, redCanonical);

        assertThat(CatalogPhotoChoice.select(p, all, vs, red, null)).isSameAs(redCanonical);
        assertThat(CatalogPhotoChoice.select(p, List.of(redPlain, redPrimary, whiteCanonical), vs, red, null)).isSameAs(redPrimary);
        assertThat(CatalogPhotoChoice.select(p, all, vs, white, null)).isSameAs(whiteCanonical);
        assertThat(CatalogPhotoChoice.select(p, all, vs, red, redPlain.getId())).isSameAs(redPlain);
        // a foto pedida de outra cor nunca atende à variante pedida
        assertThat(CatalogPhotoChoice.select(p, all, vs, red, whiteCanonical.getId())).isNull();
    }

    @Test
    void dropForeignAndPreferReadyNeverMixVariantsOrReplaceAnExistingNonReadyMainWithNonReady() {
        CatalogProduct p = product();
        CatalogVariant white = variant(p, "white", "SKU-W");
        Map<UUID, List<CatalogVariant>> variantsBy = Map.of(p.getId(), List.of(white));
        CatalogPhotoChoice choice = new CatalogPhotoChoice(List.of(p), variantsBy);
        CatalogImage orphan = image(p.getId(), 1, "https://x/orphan.jpg");
        orphan.setVariantId(UUID.randomUUID());
        Map<UUID, CatalogImage> main = new HashMap<>(Map.of(p.getId(), orphan));
        choice.dropForeign(main);
        assertThat(main).isEmpty();
        assertThat(choice.notReady(List.of(p.getId()), main)).containsExactly(p.getId());

        CatalogImage plain = image(p.getId(), 2, "https://x/plain.jpg");
        CatalogImage primary = image(p.getId(), 3, "https://x/primary.jpg");
        primary.setPrimary(true);
        choice.preferReady(main, List.of(orphan, plain, primary));
        assertThat(main).containsEntry(p.getId(), primary);
        CatalogImage canonical = image(p.getId(), 4, "https://x/canonical.jpg");
        canonical.setCanonical(true);
        choice.preferReady(main, List.of(canonical));
        assertThat(main).containsEntry(p.getId(), primary);
    }
}

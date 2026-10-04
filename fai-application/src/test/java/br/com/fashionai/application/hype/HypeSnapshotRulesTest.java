package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class HypeSnapshotRulesTest {
    static WardrobeItem piece(Visibility v, Visibility profile, ModerationStatus m, boolean test) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setProfileVisibility(profile);
        u.setTestAccount(test);
        WardrobeItem w = new WardrobeItem();
        w.setUser(u);
        w.setVisibility(v);
        w.setModerationStatus(m);
        w.setCategory("TOPS");
        w.setSubcategory("tshirt");
        w.setBrandName("Lacoste ");
        w.setColor("white");
        return w;
    }

    @Test
    void privateItemsNeverEnterPublicRankingsOrBaselines() {
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PUBLIC, Visibility.PUBLIC, ModerationStatus.APPROVED, false))).isTrue();
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PRIVATE, Visibility.PUBLIC, ModerationStatus.APPROVED, false))).isFalse();
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.FOLLOWERS, Visibility.PUBLIC, ModerationStatus.APPROVED, false))).isFalse();
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PUBLIC, Visibility.PRIVATE, ModerationStatus.APPROVED, false))).isFalse();
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PUBLIC, Visibility.PUBLIC, ModerationStatus.PENDING, false))).isFalse();
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PUBLIC, Visibility.PUBLIC, ModerationStatus.APPROVED, true))).isFalse();
    }

    @Test
    void cohortIsTheCatalogProductOrCategoryPlusBrand() {
        WardrobeItem a = piece(Visibility.PUBLIC, Visibility.PUBLIC, ModerationStatus.APPROVED, false);
        WardrobeItem b = piece(Visibility.PRIVATE, Visibility.PUBLIC, ModerationStatus.APPROVED, false);
        b.setBrandName("lacoste");
        assertThat(HypeSnapshotService.cohortKey(a)).isEqualTo(HypeSnapshotService.cohortKey(b));
        UUID product = UUID.randomUUID();
        a.setCatalogProductId(product);
        assertThat(HypeSnapshotService.cohortKey(a)).isEqualTo("cat:" + product);
    }

    @Test
    void unusualAttributeCombinationsCarryMoreSurprise() {
        Map<String, Integer> freq = Map.of("common", 90, "rare", 1);
        double common = HypeSnapshotService.surprise(List.of("common"), freq, 100);
        double rare = HypeSnapshotService.surprise(List.of("rare"), freq, 100);
        assertThat(rare).isGreaterThan(common);
        assertThat(HypeSnapshotService.surprise(List.of(), freq, 100)).isNull();
    }

    @Test
    void limitedEditionTagsAreDetected() {
        assertThat(HypeSnapshotService.limitedEdition("[\"edição limitada\"]")).isTrue();
        assertThat(HypeSnapshotService.limitedEdition("Limited drop")).isTrue();
        assertThat(HypeSnapshotService.limitedEdition("basic")).isFalse();
        assertThat(HypeSnapshotService.limitedEdition(null)).isFalse();
    }
}

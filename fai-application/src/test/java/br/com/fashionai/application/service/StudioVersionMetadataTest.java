package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;

/** Characterizes the existing package contract before extracting studio metadata policy. */
class StudioVersionMetadataTest {
    @Test
    void copiesTheStudioContainerWithoutMutatingItsSource() {
        Map<String, Object> studio = new LinkedHashMap<>(Map.of("url", "/approved.png"));
        Map<String, Object> result = WardrobeService.studioMeta(Map.of("studio", studio));
        result.put("pending", Map.of("version", 2));
        assertThat(studio).containsOnlyKeys("url");
        assertThat(WardrobeService.studioMeta(Map.of("studio", "invalid"))).isNull();
        assertThat(WardrobeService.studioMeta(Map.of())).isNull();
    }

    @Test
    void keepsNumericVersionsAndLegacyFallbackWithoutInventingAnApproval() {
        WardrobeItem item = new WardrobeItem();
        assertThat(WardrobeService.studioVersion(null, item)).isZero();
        assertThat(WardrobeService.studioApproved(null, item)).isFalse();
        item.setStudioImageUrl("/legacy.png");
        assertThat(WardrobeService.studioVersion(null, item)).isEqualTo(1);
        assertThat(WardrobeService.studioVersion(Map.of("version", new BigDecimal("7")), item)).isEqualTo(7);
        assertThat(WardrobeService.studioVersion(Map.of("version", 7), null)).isEqualTo(7);
        assertThat(WardrobeService.studioVersion(Map.of("version", "7"), item)).isEqualTo(1);
        assertThat(WardrobeService.studioApproved(null, item)).isTrue();
        assertThat(WardrobeService.studioApproved(Map.of("approved", false), item)).isFalse();
        assertThat(WardrobeService.studioApproved(Map.of("approved", true), item)).isTrue();
    }

    @Test
    void projectsAllExistingDerivativesButDoesNotRetainArbitraryOrRecursiveMetadata() {
        Map<String, Object> info = new LinkedHashMap<>();
        for (String key : new String[]{"url", "thumbUrl", "feedUrl", "detailUrl", "enhancedUrl", "backdrop",
                "stages", "metrics", "framing", "feed", "logo"}) info.put(key, key + "-value");
        info.put("provider", 42);
        info.put("previous", Map.of("private", "not-for-new-version"));
        info.put("pending", Map.of("version", 99));
        Map<String, Object> result = WardrobeService.studioSummary(info, 8, false);
        assertThat(result).containsEntry("provider", "42").containsEntry("version", 8).containsEntry("approved", false);
        assertThat(result).doesNotContainKeys("previous", "pending", "approvedAt");
        info.forEach((key, value) -> {
            if (!key.equals("provider") && !key.equals("previous") && !key.equals("pending"))
                assertThat(result).containsEntry(key, value);
        });
        assertThat(info).doesNotContainKeys("createdAt", "approvedAt", "version");
        assertThat(Instant.parse((String) result.get("createdAt"))).isNotNull();
    }

    @Test
    void usesOneTimestampForApprovedSummaryAndOmitsNullDerivatives() {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("url", "/new.png"); info.put("detailUrl", null);
        Map<String, Object> result = WardrobeService.studioSummary(info, 2, true);
        assertThat(result).containsEntry("url", "/new.png").doesNotContainKey("detailUrl");
        assertThat(result.get("approvedAt")).isEqualTo(result.get("createdAt"));
    }
}

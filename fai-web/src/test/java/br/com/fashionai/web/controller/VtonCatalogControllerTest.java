package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import java.lang.reflect.Proxy;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;


class VtonCatalogControllerTest {
    private final Guard guard = new Guard(event -> {}, null);
    private final CurrentUser user = new CurrentUser(UUID.randomUUID(), "admin", "ADMIN", ProfileType.ADMIN,
            true, AccountStatus.ACTIVE, null, null);
    private List<CatalogImage> rows = List.of();
    private int calls;
    private Object[] query;
    private final CatalogImageRepository images = (CatalogImageRepository) Proxy.newProxyInstance(
            CatalogImageRepository.class.getClassLoader(), new Class<?>[]{CatalogImageRepository.class},
            (proxy, method, args) -> {
                if (!method.getName().equals("findVtonFeed")) throw new UnsupportedOperationException(method.getName());
                calls++; query = args; return rows;
            });
    private final VtonCatalogController controller = new VtonCatalogController(null, images, guard);
    private final Instant after = Instant.parse("2026-10-15T12:00:00Z");

    @Test void nonAdministratorCannotReadCatalogFeed() {
        CurrentUser ordinary = new CurrentUser(UUID.randomUUID(), "user", "USER", ProfileType.PESSOAL,
                true, AccountStatus.ACTIVE, null, null);
        assertThatThrownBy(() -> controller.feed(ordinary, after, "", 10)).isInstanceOf(ApiException.class);
        assertThat(calls).isZero();
    }

    @Test void malformedCursorIsBadRequestAndDoesNotQueryDatabase() {
        assertThatThrownBy(() -> controller.feed(user, after, "invalid-uuid", 10))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.status()).isEqualTo(400));
        assertThat(calls).isZero();
    }

    @Test void emptyPageKeepsCursorForNextPoll() {
        String id = UUID.randomUUID().toString();
        Map<String, Object> page = controller.feed(user, after, id, 100);
        assertThat(page.get("cursor")).isEqualTo(Map.of("after", after.toString(), "afterId", id));
        assertThat(page.get("items")).isEqualTo(List.of());
    }

    @Test void feedIsBoundedAndReturnsTimestampWithTieBreakerId() {
        CatalogImage image = new CatalogImage();
        UUID productId = UUID.randomUUID();
        image.assignId(UUID.randomUUID());
        image.markCreatedAt(after);
        image.setProductId(productId);
        image.setStoredUrl("/media/catalog/product.png");
        rows = List.of(image);
        Map<String, Object> page = controller.feed(user, after, "", 500_000);
        assertThat(page.get("cursor")).isEqualTo(Map.of("after", after.toString(), "afterId", image.getId().toString()));
        assertThat(page.get("items").toString()).contains(productId.toString(), "/media/catalog/product.png");
        assertThat(calls).isEqualTo(1);
        assertThat(query).containsExactly(after, "", 100);
    }

    @Test void forcedCategoryFrameCopyNeverReachesTheGpuButTheCursorMovesOn() {
        CatalogImage authorized = image("/media/catalog/authorized.png", "{\"persistenceDecision\":{\"mode\":\"SOURCE_AUTHORIZED\"}}");
        CatalogImage forced = image("/media/catalog/forced.png", "{\"persistenceDecision\":{\"mode\":\"FORCED_CATEGORY_FRAME\"}}");
        rows = List.of(authorized, forced);
        Map<String, Object> page = controller.feed(user, after, "", 100);
        assertThat(page.get("items").toString()).contains("/media/catalog/authorized.png").doesNotContain("/media/catalog/forced.png");
        assertThat(page.get("cursor")).isEqualTo(Map.of("after", after.toString(), "afterId", forced.getId().toString()));
    }

    private CatalogImage image(String storedUrl, String assetsJson) {
        CatalogImage image = new CatalogImage();
        image.assignId(UUID.randomUUID());
        image.markCreatedAt(after);
        image.setProductId(UUID.randomUUID());
        image.setStoredUrl(storedUrl);
        image.setAssetsJson(assetsJson);
        return image;
    }
}

package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.SavedCatalogProductRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SavedCatalogProductService {
    private final SavedCatalogProductRepository bookmarks;
    private final CatalogProductRepository products;
    private final CatalogService catalog;
    private final Guard guard;

    public SavedCatalogProductService(SavedCatalogProductRepository bookmarks, CatalogProductRepository products,
                                      CatalogService catalog, Guard guard) {
        this.bookmarks = bookmarks;
        this.products = products;
        this.catalog = catalog;
        this.guard = guard;
    }

    public SavedPage saved(CurrentUser user, int page) {
        guard.requireSession(user);
        var slice = bookmarks.saved(user.id().toString(), PageRequest.of(Math.max(0, page), 24));
        return new SavedPage(catalog.cards(slice.getContent()), slice.hasNext());
    }

    public List<String> ids(CurrentUser user) {
        guard.requireSession(user);
        return bookmarks.ids(user.id().toString());
    }

    @Transactional
    public void save(CurrentUser user, UUID productId) {
        guard.requireSession(user);
        if (products.findById(productId).filter(p -> p.getIngestionStatus() != CatalogIngestionStatus.REJECTED).isEmpty()) {
            throw ApiException.notFound("Produto");
        }
        catalog.product(productId);
        bookmarks.saveProduct(user.id().toString(), productId.toString());
    }

    @Transactional
    public void remove(CurrentUser user, UUID productId) {
        guard.requireSession(user);
        bookmarks.removeProduct(user.id().toString(), productId.toString());
    }

    public record SavedPage(List<Map<String, Object>> items, boolean hasMore) {}
}

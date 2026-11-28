package br.com.fashionai.web.controller;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.marketplace.MarketplaceDirectoryService;
import br.com.fashionai.application.marketplace.StorePage;
import br.com.fashionai.application.marketplace.StorePieceCreator;
import br.com.fashionai.application.marketplace.StorePieceCreator.StorePieceCreated;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.wardrobe.PieceForm;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/me/marketplace")
public class StorePieceCreationController {
    private final MarketplaceDirectoryService directory;
    private final StorePieceCreator creator;

    public StorePieceCreationController(MarketplaceDirectoryService directory, StorePieceCreator creator) {
        this.directory = directory;
        this.creator = creator;
    }

    @GetMapping("/stores")
    public StorePage mine(CurrentUser user, @RequestParam(required = false) String name,
                          @RequestParam(defaultValue = "0") int page) {
        return directory.myStores(user, name, page);
    }

    @PostMapping("/stores/{store}/pieces")
    @ResponseStatus(HttpStatus.CREATED)
    public StorePieceCreated photo(CurrentUser user, @PathVariable UUID store, @RequestBody PieceForm form) {
        return creator.fromPhoto(user, store, form);
    }

    @PostMapping("/stores/{store}/pieces/from-catalog")
    @ResponseStatus(HttpStatus.CREATED)
    public StorePieceCreated catalog(CurrentUser user, @PathVariable UUID store, @RequestBody CatalogService.AddRequest form) {
        return creator.fromCatalog(user, store, form);
    }

    @PostMapping("/listings")
    @ResponseStatus(HttpStatus.CREATED)
    public StorePieceCreated photoListing(CurrentUser user, @RequestParam(required = false) UUID storeId,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiresOn, @RequestBody PieceForm form) {
        return creator.photoListing(user, storeId, expiresOn, form);
    }

    @PostMapping("/listings/from-catalog")
    @ResponseStatus(HttpStatus.CREATED)
    public StorePieceCreated catalogListing(CurrentUser user, @RequestParam(required = false) UUID storeId,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiresOn, @RequestBody CatalogService.AddRequest form) {
        return creator.catalogListing(user, storeId, expiresOn, form);
    }
}

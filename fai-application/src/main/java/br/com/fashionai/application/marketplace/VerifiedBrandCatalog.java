package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogSaleStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Component
public class VerifiedBrandCatalog {
    private final BrandRepository brands;
    private final BrandProfileRepository profiles;
    private final CatalogProductRepository products;
    private final WardrobeItemRepository pieces;
    private final CatalogSourceRepository sources;

    public VerifiedBrandCatalog(BrandRepository brands, BrandProfileRepository profiles,
                                CatalogProductRepository products, WardrobeItemRepository pieces, CatalogSourceRepository sources) {
        this.brands = brands;
        this.profiles = profiles;
        this.products = products;
        this.pieces = pieces;
        this.sources = sources;
    }

    @EventListener
    @Transactional
    public void created(DomainEvents.PieceCreated event) {
        pieces.findById(event.pieceId()).ifPresent(this::sync);
    }

    @EventListener
    @Transactional
    public void updated(DomainEvents.PieceUpdated event) {
        pieces.findById(event.pieceId()).ifPresent(this::sync);
    }

    @EventListener
    @Transactional
    public void salesChanged(DomainEvents.PieceSaleChanged event) {
        pieces.findById(event.pieceId()).ifPresent(this::sync);
    }

    private void sync(WardrobeItem piece) {
        var owner = piece.getUser();
        if (owner.getProfileType() != ProfileType.MARCA || owner.getStatus() != AccountStatus.ACTIVE
                || !owner.isVerified()) return;
        var profile = profiles.findByOwnerId(owner.getId())
                .filter(value -> value.getApprovalStatus() == ApprovalStatus.APROVADO).orElse(null);
        if (profile == null) return;
        String key = "brand-wardrobe:" + piece.getId();
        var existing = products.findByDedupKey(key);
        if (existing.isEmpty() && !piece.isForSale()) return;
        Brand brand = existing.isPresent() ? brands.findById(existing.get().getBrandId()).orElseThrow() : resolveBrand(profile);
        CatalogProduct product = existing.orElseGet(() -> newProduct(piece, brand, key));
        if (piece.isForSale() && piece.getNegotiationStartedAt() == null) {
            piece.setNegotiationStartedAt(Instant.now());
        }
        product.setNegotiationStartedAt(piece.getNegotiationStartedAt());
        product.setExpiresAt(piece.getExpiresAt());
        product.setCategory(piece.getCategory());
        product.setSubcategory(piece.getSubcategory());
        product.setProductName(piece.getName());
        product.setColor(piece.getColor());
        product.setMaterial(piece.getMaterial());
        product.setGender(piece.getSex());
        product.setStatus(piece.isForSale() ? CatalogSaleStatus.AVAILABLE : CatalogSaleStatus.EXPIRED);
        product.setVariationCode(piece.getVariationCode());
        product.setSearchText(String.join(" ", brand.getName(), piece.getName(), piece.getCategory(), piece.getSubcategory()));
        products.save(product);
    }

    @Transactional
    public void linkApprovedBrand(UUID profileId) {
        profiles.findById(profileId).filter(value -> value.getApprovalStatus() == ApprovalStatus.APROVADO)
                .ifPresent(this::resolveBrand);
    }

    private Brand resolveBrand(BrandProfile profile) {
        return brands.findByBrandProfile_Owner_Id(profile.getOwner().getId()).orElseGet(() -> {
            String domain = host(profile.getStoreUrl());
            Brand match = brands.findBySlug(profile.getSlug())
                    .filter(brand -> brand.getBrandProfile() == null && officialDomain(brand, domain))
                    .orElse(null);
            if (match == null) {
                String slug = brands.findBySlug(profile.getSlug()).isEmpty() ? profile.getSlug() : "profile-" + profile.getId();
                match = new Brand(profile.getBrandName(), slug, BrandSource.USER_SUBMITTED);
                match.setWebsite(profile.getStoreUrl());
                match.setLogoUrl(profile.getLogoUrl());
                match.setCountry(profile.getCountry());
            }
            match.setVerifiedAt(Instant.now());
            match.setBrandProfile(profile);
            return brands.save(match);
        });
    }

    private boolean officialDomain(Brand brand, String domain) {
        return domain != null && (domain.equals(host(brand.getWebsite()))
                || sources.findByBrandIdAndActiveTrue(brand.getId()).stream()
                .filter(source -> source.getSourceType() == CatalogSourceType.OFFICIAL_BRAND
                        || source.getSourceType() == CatalogSourceType.OFFICIAL_STORE)
                .anyMatch(source -> domain.equals(source.getDomain().toLowerCase(Locale.ROOT).replaceFirst("^www\\.", ""))));
    }

    private static CatalogProduct newProduct(WardrobeItem piece, Brand brand, String key) {
        CatalogProduct product = new CatalogProduct();
        product.setBrandId(brand.getId());
        product.setManagedPiece(piece);
        product.setSourceType(CatalogSourceType.VERIFIED_BRAND_PROFILE);
        product.setSourceDomain(host(brand.getWebsite()));
        product.setSourceStatus(CatalogSourceStatus.ACTIVE);
        product.setIngestionStatus(CatalogIngestionStatus.PERSISTABLE);
        product.setDedupKey(key);
        product.setFirstSeenAt(Instant.now());
        return product;
    }

    private static String host(String url) {
        try {
            URI uri = URI.create(Objects.toString(url, ""));
            return uri.getHost() == null ? null : uri.getHost().toLowerCase(Locale.ROOT).replaceFirst("^www\\.", "");
        } catch (IllegalArgumentException invalid) {
            return null;
        }
    }
}

package br.com.fashionai.web.controller;

/**
 * Dublês dos serviços da Loja FAI Points e do catálogo da marca, fora de {@link ServiceFakes} (arquivo congelado no
 * limite de linhas). {@link Fk#fakeClasses()} junta os dois conjuntos.
 */
@SuppressWarnings({"unchecked", "rawtypes"})
final class ServiceFakesLoja {
    private ServiceFakesLoja() {
    }

    static final class FakeBrandCatalogProductsService extends br.com.fashionai.application.catalog.BrandCatalogProductsService {
        FakeBrandCatalogProductsService() {
            super((br.com.fashionai.domain.repository.CatalogProductRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogProductRepository.class), (br.com.fashionai.domain.repository.BrandRepository) Fk.arg(br.com.fashionai.domain.repository.BrandRepository.class), (br.com.fashionai.application.catalog.CatalogService) Fk.arg(br.com.fashionai.application.catalog.CatalogService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> sellerProducts(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "sellerProducts", java.util.List.class, new Object[]{a0, a1});
        }
    }

    static final class FakeFaiStoreService extends br.com.fashionai.application.faistore.FaiStoreService {
        FakeFaiStoreService() {
            super((br.com.fashionai.application.faistore.FaiStoreCatalog) Fk.arg(br.com.fashionai.application.faistore.FaiStoreCatalog.class), (br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository.class), (br.com.fashionai.domain.repository.AuraIssuerLicenseRepository) Fk.arg(br.com.fashionai.domain.repository.AuraIssuerLicenseRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> store(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "store", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "mine", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> purchase(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "purchase", java.util.Map.class, new Object[]{a0, a1});
        }
    }
}

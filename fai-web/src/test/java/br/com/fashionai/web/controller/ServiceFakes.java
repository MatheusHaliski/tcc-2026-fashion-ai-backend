package br.com.fashionai.web.controller;

/** Dublês (subclasses) dos serviços usados pelos controllers: cada método público registra a chamada em {@link Fk}. Gerado por reflexão. */
@SuppressWarnings({"unchecked", "rawtypes"})
final class ServiceFakes {
    private ServiceFakes() {
    }

    static final class FakeAiEngine extends br.com.fashionai.application.ai.AiEngine {
        FakeAiEngine() {
            super((java.util.List) Fk.arg(java.util.List.class), (br.com.fashionai.application.ports.RateLimitPort) Fk.arg(br.com.fashionai.application.ports.RateLimitPort.class), (br.com.fashionai.domain.repository.UserConsentRepository) Fk.arg(br.com.fashionai.domain.repository.UserConsentRepository.class), (br.com.fashionai.domain.repository.AiInferenceLogRepository) Fk.arg(br.com.fashionai.domain.repository.AiInferenceLogRepository.class), (br.com.fashionai.application.audit.AuditService) Fk.arg(br.com.fashionai.application.audit.AuditService.class), (br.com.fashionai.application.ai.AiBudget) Fk.arg(br.com.fashionai.application.ai.AiBudget.class), (boolean) Fk.arg(boolean.class), (boolean) Fk.arg(boolean.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Boolean> providerAvailability() {
            return (java.util.Map<java.lang.String, java.lang.Boolean>) Fk.call(this, "providerAvailability", java.util.Map.class, new Object[]{});
        }

        @Override
        public java.util.Optional<br.com.fashionai.application.ai.AiProviderPort> provider(java.lang.String a0) {
            return (java.util.Optional<br.com.fashionai.application.ai.AiProviderPort>) Fk.call(this, "provider", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public boolean remoteAllowed(java.util.UUID a0, br.com.fashionai.application.ai.AiCapability a1) {
            return (boolean) Fk.call(this, "remoteAllowed", boolean.class, new Object[]{a0, a1});
        }

        @Override
        public boolean remoteEnabled() {
            return (boolean) Fk.call(this, "remoteEnabled", boolean.class, new Object[]{});
        }
    }

    static final class FakeAssetCatalogService extends br.com.fashionai.application.assets.AssetCatalogService {
        FakeAssetCatalogService() {
            super((br.com.fashionai.domain.repository.AssetPresetRepository) Fk.arg(br.com.fashionai.domain.repository.AssetPresetRepository.class), (java.lang.String) Fk.arg(java.lang.String.class), (java.lang.String) Fk.arg(java.lang.String.class));
        }

        @Override
        public java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>> auraPreset(java.lang.String a0) {
            return (java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "auraPreset", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>> auraVariant(java.lang.String a0) {
            return (java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "auraVariant", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>> cardSkin(java.lang.String a0) {
            return (java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "cardSkin", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> chromeBackgrounds() {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "chromeBackgrounds", java.util.List.class, new Object[]{});
        }

        @Override
        public java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>> combo(java.lang.String a0, java.lang.String a1, java.lang.String a2) {
            return (java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "combo", java.util.Optional.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.lang.String defaultPieceImage(java.lang.String a0, java.lang.String a1) {
            return (java.lang.String) Fk.call(this, "defaultPieceImage", java.lang.String.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Optional<double[]> defaultPieceLogo(java.lang.String a0) {
            return (java.util.Optional<double[]>) Fk.call(this, "defaultPieceLogo", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>> gradient(java.lang.String a0) {
            return (java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "gradient", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public boolean isChromeBackground(java.lang.String a0) {
            return (boolean) Fk.call(this, "isChromeBackground", boolean.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> list(java.lang.String a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "list", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> manifest() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "manifest", java.util.Map.class, new Object[]{});
        }

        @Override
        public java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>> material(java.lang.String a0) {
            return (java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "material", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>> mosaic(java.lang.String a0, java.lang.String a1) {
            return (java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "mosaic", java.util.Optional.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> mosaics() {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "mosaics", java.util.List.class, new Object[]{});
        }

        @Override
        public java.lang.String nativeContainer(java.lang.String a0) {
            return (java.lang.String) Fk.call(this, "nativeContainer", java.lang.String.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.String[]> pieceReferenceImages() {
            return (java.util.Map<java.lang.String, java.lang.String[]>) Fk.call(this, "pieceReferenceImages", java.util.Map.class, new Object[]{});
        }

        @Override
        public java.util.Optional<java.nio.file.Path> publicFile(java.lang.String a0) {
            return (java.util.Optional<java.nio.file.Path>) Fk.call(this, "publicFile", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> resolveCombination(java.lang.String a0, java.lang.String a1, boolean a2, boolean a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "resolveCombination", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>> skin(java.lang.String a0) {
            return (java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "skin", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> skins() {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "skins", java.util.List.class, new Object[]{});
        }

        @Override
        public int syncPresets() {
            return (int) Fk.call(this, "syncPresets", int.class, new Object[]{});
        }
    }

    static final class FakeAtelierProjectService extends br.com.fashionai.application.atelierproject.AtelierProjectService {
        FakeAtelierProjectService() {
            super((br.com.fashionai.domain.repository.atelierproject.DesignProjectRepository) Fk.arg(br.com.fashionai.domain.repository.atelierproject.DesignProjectRepository.class), (br.com.fashionai.domain.repository.atelierproject.DesignProjectMemberRepository) Fk.arg(br.com.fashionai.domain.repository.atelierproject.DesignProjectMemberRepository.class), (br.com.fashionai.domain.repository.atelierproject.DesignRevisionRepository) Fk.arg(br.com.fashionai.domain.repository.atelierproject.DesignRevisionRepository.class), (br.com.fashionai.domain.repository.atelierproject.DesignCommentRepository) Fk.arg(br.com.fashionai.domain.repository.atelierproject.DesignCommentRepository.class), (br.com.fashionai.domain.repository.atelierproject.DesignReviewRepository) Fk.arg(br.com.fashionai.domain.repository.atelierproject.DesignReviewRepository.class), (br.com.fashionai.domain.repository.atelierproject.DesignVoteRepository) Fk.arg(br.com.fashionai.domain.repository.atelierproject.DesignVoteRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (tools.jackson.databind.ObjectMapper) Fk.arg(tools.jackson.databind.ObjectMapper.class), (boolean) Fk.arg(boolean.class));
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail accept(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail) Fk.call(this, "accept", br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail archive(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.atelierproject.AtelierProjectViews.Version a2) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail) Fk.call(this, "archive", br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail comment(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.atelierproject.AtelierProjectViews.Comment a2) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail) Fk.call(this, "comment", br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail create(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.atelierproject.AtelierProjectViews.Create a1) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail) Fk.call(this, "create", br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail get(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail) Fk.call(this, "get", br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<br.com.fashionai.application.atelierproject.AtelierProjectViews.Invitation> invitations(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<br.com.fashionai.application.atelierproject.AtelierProjectViews.Invitation>) Fk.call(this, "invitations", java.util.List.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail invite(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.atelierproject.AtelierProjectViews.Invite a2) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail) Fk.call(this, "invite", br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Page<br.com.fashionai.application.atelierproject.AtelierProjectViews.Summary> list(br.com.fashionai.application.security.CurrentUser a0, int a1, int a2) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Page<br.com.fashionai.application.atelierproject.AtelierProjectViews.Summary>) Fk.call(this, "list", br.com.fashionai.application.atelierproject.AtelierProjectViews.Page.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail publish(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.atelierproject.AtelierProjectViews.Publish a2) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail) Fk.call(this, "publish", br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail review(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.atelierproject.AtelierProjectViews.Review a2) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail) Fk.call(this, "review", br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Page<br.com.fashionai.application.atelierproject.AtelierProjectViews.Revision> revisions(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, int a2, int a3) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Page<br.com.fashionai.application.atelierproject.AtelierProjectViews.Revision>) Fk.call(this, "revisions", br.com.fashionai.application.atelierproject.AtelierProjectViews.Page.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail revoke(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2, br.com.fashionai.application.atelierproject.AtelierProjectViews.Version a3) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail) Fk.call(this, "revoke", br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.TechPack techPack(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.TechPack) Fk.call(this, "techPack", br.com.fashionai.application.atelierproject.AtelierProjectViews.TechPack.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail update(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.atelierproject.AtelierProjectViews.Update a2) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail) Fk.call(this, "update", br.com.fashionai.application.atelierproject.AtelierProjectViews.Detail.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.atelierproject.AtelierProjectViews.VoteResult vote(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.atelierproject.AtelierProjectViews.Vote a2) {
            return (br.com.fashionai.application.atelierproject.AtelierProjectViews.VoteResult) Fk.call(this, "vote", br.com.fashionai.application.atelierproject.AtelierProjectViews.VoteResult.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeCatalogService extends br.com.fashionai.application.catalog.CatalogService {
        FakeCatalogService() {
            super((br.com.fashionai.domain.repository.CatalogProductRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogProductRepository.class), (br.com.fashionai.domain.repository.CatalogVariantRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogVariantRepository.class), (br.com.fashionai.domain.repository.CatalogImageRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogImageRepository.class), (br.com.fashionai.domain.repository.CatalogProductAliasRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogProductAliasRepository.class), (br.com.fashionai.domain.repository.CatalogSourceRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogSourceRepository.class), (br.com.fashionai.domain.repository.BrandRepository) Fk.arg(br.com.fashionai.domain.repository.BrandRepository.class), (br.com.fashionai.domain.repository.BrandAliasRepository) Fk.arg(br.com.fashionai.domain.repository.BrandAliasRepository.class), (br.com.fashionai.application.catalog.CatalogIngestService) Fk.arg(br.com.fashionai.application.catalog.CatalogIngestService.class), (br.com.fashionai.application.catalog.OfficialCatalogDiscovery) Fk.arg(br.com.fashionai.application.catalog.OfficialCatalogDiscovery.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class));
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView addToWardrobe(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.catalog.CatalogService.AddRequest a1) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "addToWardrobe", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> brandSuggestions(java.lang.String a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "brandSuggestions", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> browse(br.com.fashionai.application.catalog.CatalogService.BrowseRequest a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "browse", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> catalogBrands() {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "catalogBrands", java.util.List.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> discover(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.catalog.CatalogService.SearchRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "discover", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> product(java.util.UUID a0, java.util.UUID a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "product", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> product(java.util.UUID a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "product", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> search(br.com.fashionai.application.catalog.CatalogService.SearchRequest a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "search", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> search(java.util.UUID a0, br.com.fashionai.application.catalog.CatalogService.SearchRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "search", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> suggestions(br.com.fashionai.application.catalog.CatalogService.SearchRequest a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "suggestions", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> summary() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "summary", java.util.Map.class, new Object[]{});
        }
    }

    static final class FakeCatalogImagePipelineService extends br.com.fashionai.application.catalog.image.CatalogImagePipelineService {
        FakeCatalogImagePipelineService() {
            super((br.com.fashionai.domain.repository.CatalogImageRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogImageRepository.class), (br.com.fashionai.domain.repository.CatalogProductRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogProductRepository.class), (br.com.fashionai.domain.repository.CatalogSourceRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogSourceRepository.class), (br.com.fashionai.domain.repository.CatalogVariantRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogVariantRepository.class), (br.com.fashionai.application.ports.WebFetchPort) Fk.arg(br.com.fashionai.application.ports.WebFetchPort.class), (br.com.fashionai.application.ports.MediaStoragePort) Fk.arg(br.com.fashionai.application.ports.MediaStoragePort.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (org.springframework.transaction.support.TransactionTemplate) Fk.arg(org.springframework.transaction.support.TransactionTemplate.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class), (boolean) Fk.arg(boolean.class), (int) Fk.arg(int.class), (int) Fk.arg(int.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> debug(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "debug", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> decide(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.catalog.image.CatalogImagePipelineService.ReviewCommand a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "decide", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> enqueueProduct(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "enqueueProduct", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public void ensurePreview(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2, java.util.UUID a3, java.util.UUID a4) {
            Fk.call(this, "ensurePreview", void.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public void ensurePreview(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            Fk.call(this, "ensurePreview", void.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void ensurePreview(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "ensurePreview", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> metrics(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "metrics", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public void process(java.util.UUID a0) {
            Fk.call(this, "process", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> reviewQueue(br.com.fashionai.application.security.CurrentUser a0, int a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "reviewQueue", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TexturePhoto texturePhoto(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2, java.util.UUID a3, java.util.UUID a4) {
            return (br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TexturePhoto) Fk.call(this, "texturePhoto", br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TexturePhoto.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TexturePhoto texturePhoto(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TexturePhoto) Fk.call(this, "texturePhoto", br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TexturePhoto.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TexturePhoto texturePhoto(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TexturePhoto) Fk.call(this, "texturePhoto", br.com.fashionai.application.catalog.image.CatalogImagePipelineService.TexturePhoto.class, new Object[]{a0, a1});
        }

        @Override
        public void tick() {
            Fk.call(this, "tick", void.class, new Object[]{});
        }

        @Override
        public void verifySelection(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2, java.util.UUID a3) {
            Fk.call(this, "verifySelection", void.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public void verifySelection(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "verifySelection", void.class, new Object[]{a0, a1});
        }
    }

    static final class FakeFitService extends br.com.fashionai.application.fit.FitService {
        FakeFitService() {
            super((br.com.fashionai.domain.repository.fit.ProductSizeChartRepository) Fk.arg(br.com.fashionai.domain.repository.fit.ProductSizeChartRepository.class), (br.com.fashionai.domain.repository.fit.FitMeasurementProfileRepository) Fk.arg(br.com.fashionai.domain.repository.fit.FitMeasurementProfileRepository.class), (br.com.fashionai.domain.repository.fit.SizeRecommendationRepository) Fk.arg(br.com.fashionai.domain.repository.fit.SizeRecommendationRepository.class), (br.com.fashionai.domain.repository.fit.FitFeedbackRepository) Fk.arg(br.com.fashionai.domain.repository.fit.FitFeedbackRepository.class), (br.com.fashionai.domain.repository.CatalogProductRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogProductRepository.class), (br.com.fashionai.domain.repository.BrandRepository) Fk.arg(br.com.fashionai.domain.repository.BrandRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (tools.jackson.databind.ObjectMapper) Fk.arg(tools.jackson.databind.ObjectMapper.class), (br.com.fashionai.application.fit.FitEngine) Fk.arg(br.com.fashionai.application.fit.FitEngine.class), (boolean) Fk.arg(boolean.class));
        }

        @Override
        public br.com.fashionai.application.fit.FitContracts.ChartView chart(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.fit.FitContracts.ChartView) Fk.call(this, "chart", br.com.fashionai.application.fit.FitContracts.ChartView.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> config(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "config", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public void deleteFeedback(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "deleteFeedback", void.class, new Object[]{a0, a1});
        }

        @Override
        public void deleteProfile(br.com.fashionai.application.security.CurrentUser a0, long a1) {
            Fk.call(this, "deleteProfile", void.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.fit.FitContracts.ProfileView profile(br.com.fashionai.application.security.CurrentUser a0) {
            return (br.com.fashionai.application.fit.FitContracts.ProfileView) Fk.call(this, "profile", br.com.fashionai.application.fit.FitContracts.ProfileView.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.fit.FitContracts.RecommendationView recommend(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.fit.FitContracts.Recommend a2) {
            return (br.com.fashionai.application.fit.FitContracts.RecommendationView) Fk.call(this, "recommend", br.com.fashionai.application.fit.FitContracts.RecommendationView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.fit.FitContracts.RecommendationView recommendation(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.fit.FitContracts.RecommendationView) Fk.call(this, "recommendation", br.com.fashionai.application.fit.FitContracts.RecommendationView.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.fit.FitContracts.ChartView saveChart(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.fit.FitContracts.ChartWrite a2) {
            return (br.com.fashionai.application.fit.FitContracts.ChartView) Fk.call(this, "saveChart", br.com.fashionai.application.fit.FitContracts.ChartView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.fit.FitContracts.FeedbackView saveFeedback(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.fit.FitContracts.FeedbackWrite a2) {
            return (br.com.fashionai.application.fit.FitContracts.FeedbackView) Fk.call(this, "saveFeedback", br.com.fashionai.application.fit.FitContracts.FeedbackView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.fit.FitContracts.ProfileView saveProfile(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.fit.FitContracts.ProfileWrite a1) {
            return (br.com.fashionai.application.fit.FitContracts.ProfileView) Fk.call(this, "saveProfile", br.com.fashionai.application.fit.FitContracts.ProfileView.class, new Object[]{a0, a1});
        }
    }

    static final class FakeAuraHypeDropService extends br.com.fashionai.application.hype.AuraHypeDropService {
        FakeAuraHypeDropService() {
            super((br.com.fashionai.domain.repository.AuraHypeDropRepository) Fk.arg(br.com.fashionai.domain.repository.AuraHypeDropRepository.class), (br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.Map<java.util.UUID, java.util.Map<java.lang.String, java.lang.Object>> classifications(br.com.fashionai.domain.model.enums.HypeEntityType a0, java.util.Collection<java.util.UUID> a1) {
            return (java.util.Map<java.util.UUID, java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "classifications", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> confirm(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.hype.AuraHypeDropService.Form a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "confirm", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> list(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "list", java.util.List.class, new Object[]{a0});
        }
    }

    static final class FakeHypeQueryService extends br.com.fashionai.application.hype.HypeQueryService {
        FakeHypeQueryService() {
            super((br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.domain.repository.HypeScoreSnapshotRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreSnapshotRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.application.hype.HypeCache) Fk.arg(br.com.fashionai.application.hype.HypeCache.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class));
        }

        @Override
        public br.com.fashionai.application.hype.HypeScoreConfig config() {
            return (br.com.fashionai.application.hype.HypeScoreConfig) Fk.call(this, "config", br.com.fashionai.application.hype.HypeScoreConfig.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.util.UUID, br.com.fashionai.domain.model.HypeScoreCurrent> currentOf(br.com.fashionai.domain.model.enums.HypeEntityType a0, java.util.Collection<java.util.UUID> a1) {
            return (java.util.Map<java.util.UUID, br.com.fashionai.domain.model.HypeScoreCurrent>) Fk.call(this, "currentOf", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> detail(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "detail", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> globe(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1, int a2, java.lang.String a3, java.lang.String a4, java.lang.String a5) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "globe", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> groups(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.hype.HypeQueryService.RankGroup a1, java.util.Collection<java.lang.String> a2, int a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "groups", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> history(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1, java.util.UUID a2, int a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "history", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> movers(br.com.fashionai.application.security.CurrentUser a0, int a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "movers", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> positions(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "positions", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> rankingFacets(br.com.fashionai.domain.model.enums.HypeEntityType a0, int a1, java.lang.String a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "rankingFacets", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> ranking(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1, int a2, java.lang.String a3, java.lang.String a4, java.lang.String a5, java.lang.String a6, int a7, int a8) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "ranking", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5, a6, a7, a8});
        }

        @Override
        public void setFashionDrops(br.com.fashionai.application.hype.AuraHypeDropService a0) {
            Fk.call(this, "setFashionDrops", void.class, new Object[]{a0});
        }

        @Override
        public void setPreferences(br.com.fashionai.domain.repository.UserPreferencesRepository a0) {
            Fk.call(this, "setPreferences", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> summaries(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1, java.util.List<java.util.UUID> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "summaries", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> trendingGroups(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.hype.HypeQueryService.RankGroup a1, int a2, java.lang.String a3, java.lang.String a4, java.lang.String a5, int a6) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "trendingGroups", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5, a6});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> trending(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1, int a2, java.lang.String a3, java.lang.String a4, java.lang.String a5, int a6) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "trending", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5, a6});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> wardrobe(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "wardrobe", java.util.Map.class, new Object[]{a0});
        }
    }

    static final class FakeHypeScoreConfig extends br.com.fashionai.application.hype.HypeScoreConfig {
        FakeHypeScoreConfig() {
            super((java.lang.String) Fk.arg(java.lang.String.class), (java.lang.String) Fk.arg(java.lang.String.class), (java.lang.String) Fk.arg(java.lang.String.class), (java.lang.String) Fk.arg(java.lang.String.class), (int) Fk.arg(int.class), (int) Fk.arg(int.class), (double) Fk.arg(double.class), (double) Fk.arg(double.class), (double) Fk.arg(double.class), (double) Fk.arg(double.class), (double) Fk.arg(double.class), (java.lang.String) Fk.arg(java.lang.String.class), (double) Fk.arg(double.class), (int) Fk.arg(int.class), (int) Fk.arg(int.class), (int) Fk.arg(int.class), (double) Fk.arg(double.class), (int) Fk.arg(int.class));
        }

        @Override
        public java.lang.String algorithmVersion() {
            return (java.lang.String) Fk.call(this, "algorithmVersion", java.lang.String.class, new Object[]{});
        }

        @Override
        public double decayLambda() {
            return (double) Fk.call(this, "decayLambda", double.class, new Object[]{});
        }

        @Override
        public int deltaWindowDays() {
            return (int) Fk.call(this, "deltaWindowDays", int.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> describe() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "describe", java.util.Map.class, new Object[]{});
        }

        @Override
        public double engagementPrior() {
            return (double) Fk.call(this, "engagementPrior", double.class, new Object[]{});
        }

        @Override
        public double growthSmoothing() {
            return (double) Fk.call(this, "growthSmoothing", double.class, new Object[]{});
        }

        @Override
        public int historyMaxDays() {
            return (int) Fk.call(this, "historyMaxDays", int.class, new Object[]{});
        }

        @Override
        public int horizonDays() {
            return (int) Fk.call(this, "horizonDays", int.class, new Object[]{});
        }

        @Override
        public int horizonWeeks() {
            return (int) Fk.call(this, "horizonWeeks", int.class, new Object[]{});
        }

        @Override
        public int[] levelThresholds() {
            return (int[]) Fk.call(this, "levelThresholds", int[].class, new Object[]{});
        }

        @Override
        public br.com.fashionai.domain.model.enums.HypeLevel level(double a0) {
            return (br.com.fashionai.domain.model.enums.HypeLevel) Fk.call(this, "level", br.com.fashionai.domain.model.enums.HypeLevel.class, new Object[]{a0});
        }

        @Override
        public double minSignalEvents() {
            return (double) Fk.call(this, "minSignalEvents", double.class, new Object[]{});
        }

        @Override
        public int newAccountDays() {
            return (int) Fk.call(this, "newAccountDays", int.class, new Object[]{});
        }

        @Override
        public double newAccountWeight() {
            return (double) Fk.call(this, "newAccountWeight", double.class, new Object[]{});
        }

        @Override
        public double noveltyHalfLifeDays() {
            return (double) Fk.call(this, "noveltyHalfLifeDays", double.class, new Object[]{});
        }

        @Override
        public double signalWeight(br.com.fashionai.domain.model.enums.HypeSignalType a0) {
            return (double) Fk.call(this, "signalWeight", double.class, new Object[]{a0});
        }

        @Override
        public double stablePoints() {
            return (double) Fk.call(this, "stablePoints", double.class, new Object[]{});
        }

        @Override
        public int staleAfterHours() {
            return (int) Fk.call(this, "staleAfterHours", int.class, new Object[]{});
        }

        @Override
        public java.util.Map<br.com.fashionai.application.hype.HypeScoreConfig.Dimension, java.lang.Double> weights(br.com.fashionai.domain.model.enums.HypeEntityType a0) {
            return (java.util.Map<br.com.fashionai.application.hype.HypeScoreConfig.Dimension, java.lang.Double>) Fk.call(this, "weights", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public int windowDays() {
            return (int) Fk.call(this, "windowDays", int.class, new Object[]{});
        }
    }

    static final class FakeHypeSnapshotService extends br.com.fashionai.application.hype.HypeSnapshotService {
        FakeHypeSnapshotService() {
            super((br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.HypeSignalDailyRepository) Fk.arg(br.com.fashionai.domain.repository.HypeSignalDailyRepository.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.domain.repository.HypeScoreSnapshotRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreSnapshotRepository.class), (br.com.fashionai.application.hype.HypeCache) Fk.arg(br.com.fashionai.application.hype.HypeCache.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> recalculate() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "recalculate", java.util.Map.class, new Object[]{});
        }
    }

    static final class FakeInsightService extends br.com.fashionai.application.insights.InsightService {
        FakeInsightService() {
            super((br.com.fashionai.application.hype.HypeQueryService) Fk.arg(br.com.fashionai.application.hype.HypeQueryService.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeCache) Fk.arg(br.com.fashionai.application.hype.HypeCache.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.application.service.LookbookService) Fk.arg(br.com.fashionai.application.service.LookbookService.class), (br.com.fashionai.application.service.ExplorerService) Fk.arg(br.com.fashionai.application.service.ExplorerService.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (br.com.fashionai.domain.repository.SealBondRepository) Fk.arg(br.com.fashionai.domain.repository.SealBondRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> insights(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.Integer a2, java.lang.String a3, java.lang.String a4, java.lang.String a5, boolean a6) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "insights", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5, a6});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> insights(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.Integer a2, java.lang.String a3, java.lang.String a4, java.lang.String a5, java.lang.String a6, java.util.List<java.util.UUID> a7, boolean a8) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "insights", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5, a6, a7, a8});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> itemsOrEmpty(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.insights.InsightContext a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "itemsOrEmpty", java.util.List.class, new Object[]{a0, a1});
        }
    }

    static final class FakeLensService extends br.com.fashionai.application.lens.LensService {
        FakeLensService() {
            super((br.com.fashionai.domain.repository.LensScanRepository) Fk.arg(br.com.fashionai.domain.repository.LensScanRepository.class), (br.com.fashionai.domain.repository.LensDetectionRepository) Fk.arg(br.com.fashionai.domain.repository.LensDetectionRepository.class), (br.com.fashionai.domain.repository.LensFeedbackRepository) Fk.arg(br.com.fashionai.domain.repository.LensFeedbackRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class), (br.com.fashionai.domain.repository.GarmentEmbeddingRepository) Fk.arg(br.com.fashionai.domain.repository.GarmentEmbeddingRepository.class), (br.com.fashionai.domain.repository.PieceImageRepository) Fk.arg(br.com.fashionai.domain.repository.PieceImageRepository.class), (br.com.fashionai.domain.repository.UserConsentRepository) Fk.arg(br.com.fashionai.domain.repository.UserConsentRepository.class), (br.com.fashionai.application.service.MultiPieceService) Fk.arg(br.com.fashionai.application.service.MultiPieceService.class), (br.com.fashionai.application.ports.MediaStoragePort) Fk.arg(br.com.fashionai.application.ports.MediaStoragePort.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.ports.RateLimitPort) Fk.arg(br.com.fashionai.application.ports.RateLimitPort.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.lens.LensConfig) Fk.arg(br.com.fashionai.application.lens.LensConfig.class));
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.DetectionView add(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.lens.LensService.AddDetectionCommand a2) {
            return (br.com.fashionai.application.lens.LensViews.DetectionView) Fk.call(this, "add", br.com.fashionai.application.lens.LensViews.DetectionView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.DetectionView correct(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2, br.com.fashionai.application.lens.LensService.CorrectionCommand a3) {
            return (br.com.fashionai.application.lens.LensViews.DetectionView) Fk.call(this, "correct", br.com.fashionai.application.lens.LensViews.DetectionView.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.ScanView create(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.lens.LensService.CreateCommand a1, byte[] a2) {
            return (br.com.fashionai.application.lens.LensViews.ScanView) Fk.call(this, "create", br.com.fashionai.application.lens.LensViews.ScanView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void deleteAllFor(java.util.UUID a0) {
            Fk.call(this, "deleteAllFor", void.class, new Object[]{a0});
        }

        @Override
        public void delete(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "delete", void.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.ScanView fromApp(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.lens.LensService.FromAppCommand a1) {
            return (br.com.fashionai.application.lens.LensViews.ScanView) Fk.call(this, "fromApp", br.com.fashionai.application.lens.LensViews.ScanView.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.ScanView get(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.lens.LensViews.ScanView) Fk.call(this, "get", br.com.fashionai.application.lens.LensViews.ScanView.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.view.Views.Page<br.com.fashionai.application.lens.LensViews.ScanCard> history(br.com.fashionai.application.security.CurrentUser a0, java.lang.Boolean a1, java.lang.Boolean a2, int a3, int a4) {
            return (br.com.fashionai.application.view.Views.Page<br.com.fashionai.application.lens.LensViews.ScanCard>) Fk.call(this, "history", br.com.fashionai.application.view.Views.Page.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public byte[] image(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (byte[]) Fk.call(this, "image", byte[].class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.Matches matches(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2, java.lang.String a3) {
            return (br.com.fashionai.application.lens.LensViews.Matches) Fk.call(this, "matches", br.com.fashionai.application.lens.LensViews.Matches.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.OwnResult own(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2, java.util.UUID a3) {
            return (br.com.fashionai.application.lens.LensViews.OwnResult) Fk.call(this, "own", br.com.fashionai.application.lens.LensViews.OwnResult.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public int purgeExpired(java.time.Instant a0) {
            return (int) Fk.call(this, "purgeExpired", int.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.ReadingView reading(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (br.com.fashionai.application.lens.LensViews.ReadingView) Fk.call(this, "reading", br.com.fashionai.application.lens.LensViews.ReadingView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.RecreatePlan recreate(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.lens.LensService.RecreateCommand a2) {
            return (br.com.fashionai.application.lens.LensViews.RecreatePlan) Fk.call(this, "recreate", br.com.fashionai.application.lens.LensViews.RecreatePlan.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.ScanView setSaved(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.Boolean a2) {
            return (br.com.fashionai.application.lens.LensViews.ScanView) Fk.call(this, "setSaved", br.com.fashionai.application.lens.LensViews.ScanView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.lens.LensViews.DetectionView want(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2, java.lang.Boolean a3) {
            return (br.com.fashionai.application.lens.LensViews.DetectionView) Fk.call(this, "want", br.com.fashionai.application.lens.LensViews.DetectionView.class, new Object[]{a0, a1, a2, a3});
        }
    }

    static final class FakeMomentService extends br.com.fashionai.application.moments.MomentService {
        FakeMomentService() {
            super((br.com.fashionai.domain.repository.MomentRepository) Fk.arg(br.com.fashionai.domain.repository.MomentRepository.class), (br.com.fashionai.domain.repository.MomentChallengeRepository) Fk.arg(br.com.fashionai.domain.repository.MomentChallengeRepository.class), (br.com.fashionai.domain.repository.MomentParticipationRepository) Fk.arg(br.com.fashionai.domain.repository.MomentParticipationRepository.class), (br.com.fashionai.domain.repository.MomentSubmissionRepository) Fk.arg(br.com.fashionai.domain.repository.MomentSubmissionRepository.class), (br.com.fashionai.domain.repository.MomentVoteRepository) Fk.arg(br.com.fashionai.domain.repository.MomentVoteRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.FlairTeamRepository) Fk.arg(br.com.fashionai.domain.repository.FlairTeamRepository.class), (br.com.fashionai.domain.repository.FlairTeamMemberRepository) Fk.arg(br.com.fashionai.domain.repository.FlairTeamMemberRepository.class), (br.com.fashionai.domain.repository.UserAchievementRepository) Fk.arg(br.com.fashionai.domain.repository.UserAchievementRepository.class), (br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository) Fk.arg(br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository.class), (br.com.fashionai.application.service.FaiPointsService) Fk.arg(br.com.fashionai.application.service.FaiPointsService.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.hype.HypeQueryService) Fk.arg(br.com.fashionai.application.hype.HypeQueryService.class));
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> activeSummary(java.util.UUID a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "activeSummary", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> adminDetail(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "adminDetail", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> adminList(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "adminList", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> adminSave(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.moments.MomentService.AdminMomentRequest a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "adminSave", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> adminTransition(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "adminTransition", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> calendar(br.com.fashionai.application.security.CurrentUser a0, int a1, java.lang.Integer a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "calendar", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public boolean canSee(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.Moment a1) {
            return (boolean) Fk.call(this, "canSee", boolean.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> candidateLooks(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "candidateLooks", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> contextFor(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "contextFor", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> createGroupMoment(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.moments.MomentService.GroupMomentRequest a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "createGroupMoment", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> detail(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "detail", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> feed(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "feed", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> groupMoments(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "groupMoments", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> home(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "home", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> join(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.moments.MomentService.JoinRequest a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "join", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> leaderboard(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "leaderboard", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> leave(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "leave", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> list(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.Integer a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "list", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "mine", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> nowBanner(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "nowBanner", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> preview(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.moments.MomentService.SubmitRequest a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "preview", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void recordCardChallenge(br.com.fashionai.domain.model.Moment a0, java.util.UUID a1) {
            Fk.call(this, "recordCardChallenge", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> replay(br.com.fashionai.application.security.CurrentUser a0, int a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "replay", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> save(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.Boolean a2, java.util.UUID a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "save", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setProfileVisibility(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setProfileVisibility", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> submit(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.moments.MomentService.SubmitRequest a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "submit", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Integer> tick() {
            return (java.util.Map<java.lang.String, java.lang.Integer>) Fk.call(this, "tick", java.util.Map.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> timeline(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "timeline", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> trending(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, int a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "trending", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> unsave(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "unsave", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public void useClock(java.time.Clock a0) {
            Fk.call(this, "useClock", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> vote(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.moments.MomentService.VoteRequest a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "vote", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeAvatarCanonicalService extends br.com.fashionai.application.multiplatform.AvatarCanonicalService {
        FakeAvatarCanonicalService() {
            super((br.com.fashionai.domain.repository.UserAvatar3dRepository) Fk.arg(br.com.fashionai.domain.repository.UserAvatar3dRepository.class), (br.com.fashionai.domain.repository.AvatarIdentityVersionRepository) Fk.arg(br.com.fashionai.domain.repository.AvatarIdentityVersionRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "mine", java.util.Map.class, new Object[]{a0});
        }
    }

    static final class FakeClientConfigService extends br.com.fashionai.application.multiplatform.ClientConfigService {
        FakeClientConfigService() {
            super((java.lang.String) Fk.arg(java.lang.String.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> config(br.com.fashionai.application.multiplatform.ClientPlatform a0, java.lang.String a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "config", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeGarmentAssetService extends br.com.fashionai.application.multiplatform.GarmentAssetService {
        FakeGarmentAssetService() {
            super((br.com.fashionai.domain.repository.GarmentAsset3dRepository) Fk.arg(br.com.fashionai.domain.repository.GarmentAsset3dRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> register(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.multiplatform.GarmentAssetService.RegisterCommand a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "register", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> review(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "review", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }
    }

    static final class FakeTryOnSessionService extends br.com.fashionai.application.multiplatform.TryOnSessionService {
        FakeTryOnSessionService() {
            super((br.com.fashionai.domain.repository.TryOnSessionRepository) Fk.arg(br.com.fashionai.domain.repository.TryOnSessionRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.GarmentAsset3dRepository) Fk.arg(br.com.fashionai.domain.repository.GarmentAsset3dRepository.class), (br.com.fashionai.domain.repository.UserAvatar3dRepository) Fk.arg(br.com.fashionai.domain.repository.UserAvatar3dRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> clear(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TryOnSlot a1, java.lang.Long a2, br.com.fashionai.application.multiplatform.ClientPlatform a3, br.com.fashionai.application.multiplatform.QualityProfile a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "clear", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> get(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.multiplatform.QualityProfile a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "get", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> put(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TryOnSlot a1, java.util.UUID a2, java.lang.Long a3, br.com.fashionai.application.multiplatform.ClientPlatform a4, br.com.fashionai.application.multiplatform.QualityProfile a5) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "put", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5});
        }
    }

    static final class FakeGarmentPassportService extends br.com.fashionai.application.passport.GarmentPassportService {
        FakeGarmentPassportService() {
            super((br.com.fashionai.domain.repository.passport.GarmentPassportRepository) Fk.arg(br.com.fashionai.domain.repository.passport.GarmentPassportRepository.class), (br.com.fashionai.domain.repository.passport.PassportHoldingRepository) Fk.arg(br.com.fashionai.domain.repository.passport.PassportHoldingRepository.class), (br.com.fashionai.domain.repository.passport.PassportEventRepository) Fk.arg(br.com.fashionai.domain.repository.passport.PassportEventRepository.class), (br.com.fashionai.domain.repository.passport.PassportShareRepository) Fk.arg(br.com.fashionai.domain.repository.passport.PassportShareRepository.class), (br.com.fashionai.domain.repository.passport.PassportEvidenceRepository) Fk.arg(br.com.fashionai.domain.repository.passport.PassportEvidenceRepository.class), (br.com.fashionai.domain.repository.passport.PassportTransferRepository) Fk.arg(br.com.fashionai.domain.repository.passport.PassportTransferRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class), (boolean) Fk.arg(boolean.class));
        }

        @Override
        public br.com.fashionai.application.passport.GarmentPassportService.TransferView accept(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.passport.GarmentPassportService.AcceptCommand a2, java.lang.String a3) {
            return (br.com.fashionai.application.passport.GarmentPassportService.TransferView) Fk.call(this, "accept", br.com.fashionai.application.passport.GarmentPassportService.TransferView.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.passport.GarmentPassportService.EventView addEvent(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.passport.GarmentPassportService.EventCommand a2, java.lang.String a3) {
            return (br.com.fashionai.application.passport.GarmentPassportService.EventView) Fk.call(this, "addEvent", br.com.fashionai.application.passport.GarmentPassportService.EventView.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.passport.GarmentPassportService.TransferView cancelTransfer(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (br.com.fashionai.application.passport.GarmentPassportService.TransferView) Fk.call(this, "cancelTransfer", br.com.fashionai.application.passport.GarmentPassportService.TransferView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.passport.GarmentPassportService.PrivateView create(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (br.com.fashionai.application.passport.GarmentPassportService.PrivateView) Fk.call(this, "create", br.com.fashionai.application.passport.GarmentPassportService.PrivateView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void deleteEvidence(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "deleteEvidence", void.class, new Object[]{a0, a1});
        }

        @Override
        public byte[] downloadEvidence(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (byte[]) Fk.call(this, "downloadEvidence", byte[].class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.passport.GarmentPassportService.PrivateView get(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.passport.GarmentPassportService.PrivateView) Fk.call(this, "get", br.com.fashionai.application.passport.GarmentPassportService.PrivateView.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<br.com.fashionai.application.passport.GarmentPassportService.TransferView> incoming(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<br.com.fashionai.application.passport.GarmentPassportService.TransferView>) Fk.call(this, "incoming", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.List<br.com.fashionai.application.passport.GarmentPassportService.EvidenceView> myEvidence(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.List<br.com.fashionai.application.passport.GarmentPassportService.EvidenceView>) Fk.call(this, "myEvidence", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.passport.GarmentPassportService.TransferCreated offerTransfer(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.passport.GarmentPassportService.TransferCommand a2, java.lang.String a3) {
            return (br.com.fashionai.application.passport.GarmentPassportService.TransferCreated) Fk.call(this, "offerTransfer", br.com.fashionai.application.passport.GarmentPassportService.TransferCreated.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public void onPieceDeleted(br.com.fashionai.application.events.DomainEvents.PieceDeleted a0) {
            Fk.call(this, "onPieceDeleted", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> publicView(java.lang.String a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "publicView", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public void purgeExpiredEvidence() {
            Fk.call(this, "purgeExpiredEvidence", void.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> resale(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "resale", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public void revoke(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            Fk.call(this, "revoke", void.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.passport.GarmentPassportService.ShareCreated share(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.passport.GarmentPassportService.ShareCommand a2) {
            return (br.com.fashionai.application.passport.GarmentPassportService.ShareCreated) Fk.call(this, "share", br.com.fashionai.application.passport.GarmentPassportService.ShareCreated.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.passport.GarmentPassportService.PrivateView update(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.passport.GarmentPassportService.Declaration a2) {
            return (br.com.fashionai.application.passport.GarmentPassportService.PrivateView) Fk.call(this, "update", br.com.fashionai.application.passport.GarmentPassportService.PrivateView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.passport.GarmentPassportService.EvidenceView uploadEvidence(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2, byte[] a3, java.lang.String a4) {
            return (br.com.fashionai.application.passport.GarmentPassportService.EvidenceView) Fk.call(this, "uploadEvidence", br.com.fashionai.application.passport.GarmentPassportService.EvidenceView.class, new Object[]{a0, a1, a2, a3, a4});
        }
    }

    static final class FakePhotoEditService extends br.com.fashionai.application.photoedit.PhotoEditService {
        FakePhotoEditService() {
            super((br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.domain.repository.PieceImageRepository) Fk.arg(br.com.fashionai.domain.repository.PieceImageRepository.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> auto(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "auto", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> preview(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.Map<java.lang.String, java.lang.Object> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "preview", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> restore(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "restore", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> save(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.Map<java.lang.String, java.lang.Object> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "save", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> session(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "session", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> versions(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "versions", java.util.List.class, new Object[]{a0, a1});
        }
    }

    static final class FakeAccountService extends br.com.fashionai.application.service.AccountService {
        FakeAccountService() {
            super((br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.domain.repository.UserConsentRepository) Fk.arg(br.com.fashionai.domain.repository.UserConsentRepository.class), (br.com.fashionai.domain.repository.VerificationCodeRepository) Fk.arg(br.com.fashionai.domain.repository.VerificationCodeRepository.class), (br.com.fashionai.domain.repository.DataExportRequestRepository) Fk.arg(br.com.fashionai.domain.repository.DataExportRequestRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.CommentRepository) Fk.arg(br.com.fashionai.domain.repository.CommentRepository.class), (br.com.fashionai.domain.repository.ReactionRepository) Fk.arg(br.com.fashionai.domain.repository.ReactionRepository.class), (br.com.fashionai.domain.repository.SavedItemRepository) Fk.arg(br.com.fashionai.domain.repository.SavedItemRepository.class), (br.com.fashionai.domain.repository.FollowRepository) Fk.arg(br.com.fashionai.domain.repository.FollowRepository.class), (br.com.fashionai.domain.repository.PhotoRepository) Fk.arg(br.com.fashionai.domain.repository.PhotoRepository.class), (br.com.fashionai.domain.repository.NotificationRepository) Fk.arg(br.com.fashionai.domain.repository.NotificationRepository.class), (br.com.fashionai.domain.repository.DnaSchemeRepository) Fk.arg(br.com.fashionai.domain.repository.DnaSchemeRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.domain.repository.AiInferenceLogRepository) Fk.arg(br.com.fashionai.domain.repository.AiInferenceLogRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (br.com.fashionai.application.service.IdentityService) Fk.arg(br.com.fashionai.application.service.IdentityService.class), (br.com.fashionai.application.ports.MediaStoragePort) Fk.arg(br.com.fashionai.application.ports.MediaStoragePort.class), (br.com.fashionai.application.ports.EmailSenderPort) Fk.arg(br.com.fashionai.application.ports.EmailSenderPort.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (br.com.fashionai.application.service.Avatar3dService) Fk.arg(br.com.fashionai.application.service.Avatar3dService.class), (br.com.fashionai.application.lens.LensService) Fk.arg(br.com.fashionai.application.lens.LensService.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.domain.repository.HypeScoreSnapshotRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreSnapshotRepository.class), (br.com.fashionai.domain.repository.HypeMilestoneRepository) Fk.arg(br.com.fashionai.domain.repository.HypeMilestoneRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> cancelDeletion(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "cancelDeletion", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.view.Views.UserCard confirmEmailChange(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (br.com.fashionai.application.view.Views.UserCard) Fk.call(this, "confirmEmailChange", br.com.fashionai.application.view.Views.UserCard.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> consents(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "consents", java.util.List.class, new Object[]{a0});
        }

        @Override
        public byte[] downloadExport(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (byte[]) Fk.call(this, "downloadExport", byte[].class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> exportsOf(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "exportsOf", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> me(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "me", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public int purgeExpiredExports() {
            return (int) Fk.call(this, "purgeExpiredExports", int.class, new Object[]{});
        }

        @Override
        public int purgeScheduledDeletions() {
            return (int) Fk.call(this, "purgeScheduledDeletions", int.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> requestDeletion(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "requestDeletion", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> requestExport(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "requestExport", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> setConsent(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.ConsentPurpose a1, boolean a2) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "setConsent", java.util.List.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updatePrivacy(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.Visibility a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updatePrivacy", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateSensitive(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.AccountService.SensitiveUpdate a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateSensitive", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeAchievementService extends br.com.fashionai.application.service.AchievementService {
        FakeAchievementService() {
            super((br.com.fashionai.domain.repository.UserAchievementRepository) Fk.arg(br.com.fashionai.domain.repository.UserAchievementRepository.class), (br.com.fashionai.application.service.FaiPointsService) Fk.arg(br.com.fashionai.application.service.FaiPointsService.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class), (br.com.fashionai.application.events.SideEffectRunner) Fk.arg(br.com.fashionai.application.events.SideEffectRunner.class));
        }

        @Override
        public boolean grant(java.util.UUID a0, java.lang.String a1) {
            return (boolean) Fk.call(this, "grant", boolean.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> list(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "list", java.util.List.class, new Object[]{a0});
        }

        @Override
        public void onDailyLook(br.com.fashionai.application.events.DomainEvents.DailyLookRegistered a0) {
            Fk.call(this, "onDailyLook", void.class, new Object[]{a0});
        }

        @Override
        public void onMirror(br.com.fashionai.application.events.DomainEvents.MirrorAction a0) {
            Fk.call(this, "onMirror", void.class, new Object[]{a0});
        }

        @Override
        public void onSchemeSaved(br.com.fashionai.application.events.DomainEvents.SchemeSaved a0) {
            Fk.call(this, "onSchemeSaved", void.class, new Object[]{a0});
        }
    }

    static final class FakeAdminCatalogService extends br.com.fashionai.application.service.AdminCatalogService {
        FakeAdminCatalogService() {
            super((br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (br.com.fashionai.domain.repository.RoomCatalogItemRepository) Fk.arg(br.com.fashionai.domain.repository.RoomCatalogItemRepository.class), (br.com.fashionai.domain.repository.RoomInventoryItemRepository) Fk.arg(br.com.fashionai.domain.repository.RoomInventoryItemRepository.class), (br.com.fashionai.domain.repository.FlairMatchRepository) Fk.arg(br.com.fashionai.domain.repository.FlairMatchRepository.class), (br.com.fashionai.domain.repository.SealRepository) Fk.arg(br.com.fashionai.domain.repository.SealRepository.class), (br.com.fashionai.domain.repository.CouponRightRepository) Fk.arg(br.com.fashionai.domain.repository.CouponRightRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> couponCatalog(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.lang.String> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "couponCatalog", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> flairGames(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.lang.String> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "flairGames", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> garmentCatalog(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.lang.String> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "garmentCatalog", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> roomItemCatalog(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.lang.String> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "roomItemCatalog", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> sealCatalog(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.lang.String> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "sealCatalog", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setStoreItemActive(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setStoreItemActive", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> storeItem(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "storeItem", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> storeItems(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.lang.String> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "storeItems", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateStoreItem(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.util.Map<java.lang.String, java.lang.Object> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateStoreItem", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeAdminService extends br.com.fashionai.application.service.AdminService {
        FakeAdminService() {
            super((br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.ModerationQueueRepository) Fk.arg(br.com.fashionai.domain.repository.ModerationQueueRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.CommentRepository) Fk.arg(br.com.fashionai.domain.repository.CommentRepository.class), (br.com.fashionai.domain.repository.AuditLogRepository) Fk.arg(br.com.fashionai.domain.repository.AuditLogRepository.class), (br.com.fashionai.domain.repository.AiInferenceLogRepository) Fk.arg(br.com.fashionai.domain.repository.AiInferenceLogRepository.class), (br.com.fashionai.domain.repository.BackupRecordRepository) Fk.arg(br.com.fashionai.domain.repository.BackupRecordRepository.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class), (br.com.fashionai.application.ports.AnalyticsQueryPort) Fk.arg(br.com.fashionai.application.ports.AnalyticsQueryPort.class), (br.com.fashionai.application.service.IdentityService) Fk.arg(br.com.fashionai.application.service.IdentityService.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.assets.AssetCatalogService) Fk.arg(br.com.fashionai.application.assets.AssetCatalogService.class), (br.com.fashionai.application.service.ChallengeService) Fk.arg(br.com.fashionai.application.service.ChallengeService.class), (br.com.fashionai.application.service.InventoryScoreService) Fk.arg(br.com.fashionai.application.service.InventoryScoreService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (br.com.fashionai.application.moderation.UploadQuarantine) Fk.arg(br.com.fashionai.application.moderation.UploadQuarantine.class), (br.com.fashionai.application.hype.HypeSnapshotService) Fk.arg(br.com.fashionai.application.hype.HypeSnapshotService.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> aiOverview(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "aiOverview", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> auditLog(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "auditLog", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> backups(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "backups", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> moderate(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "moderate", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public byte[] moderationImage(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (byte[]) Fk.call(this, "moderationImage", byte[].class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> moderationQueue(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "moderationQueue", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> promoteChallenge(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "promoteChallenge", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> runBackup(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "runBackup", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> runJob(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "runJob", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public void scheduledBackup() {
            Fk.call(this, "scheduledBackup", void.class, new Object[]{});
        }

        @Override
        public java.util.List<br.com.fashionai.application.view.Views.UserCard> searchUsers(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.List<br.com.fashionai.application.view.Views.UserCard>) Fk.call(this, "searchUsers", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public void setMoments(br.com.fashionai.application.moments.MomentService a0) {
            Fk.call(this, "setMoments", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setRole(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setRole", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setStatus(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setStatus", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }
    }

    static final class FakeAnatomicalTryOnService extends br.com.fashionai.application.service.AnatomicalTryOnService {
        FakeAnatomicalTryOnService() {
            super((br.com.fashionai.application.ports.AnatomicalTryOnPort) Fk.arg(br.com.fashionai.application.ports.AnatomicalTryOnPort.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.service.TryOnService) Fk.arg(br.com.fashionai.application.service.TryOnService.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.domain.repository.CatalogProductRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogProductRepository.class), (br.com.fashionai.domain.repository.CatalogImageRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogImageRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> probe(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.AnatomicalTryOnService.PersonRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "probe", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> renderCatalog(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "renderCatalog", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> renderLook(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.AnatomicalTryOnService.LookRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "renderLook", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> render(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.AnatomicalTryOnService.Request a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "render", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeAtelierRewardSystem extends br.com.fashionai.application.service.AtelierRewardSystem {
        FakeAtelierRewardSystem() {
            super((br.com.fashionai.domain.repository.AtelierRewardGrantRepository) Fk.arg(br.com.fashionai.domain.repository.AtelierRewardGrantRepository.class), (br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository.class), (br.com.fashionai.application.service.LevelProgressService) Fk.arg(br.com.fashionai.application.service.LevelProgressService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public br.com.fashionai.domain.model.AtelierRewardGrant grant(br.com.fashionai.application.service.AtelierRewardSystem.Grant a0) {
            return (br.com.fashionai.domain.model.AtelierRewardGrant) Fk.call(this, "grant", br.com.fashionai.domain.model.AtelierRewardGrant.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.service.AtelierRewardSystem.Snapshot mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (br.com.fashionai.application.service.AtelierRewardSystem.Snapshot) Fk.call(this, "mine", br.com.fashionai.application.service.AtelierRewardSystem.Snapshot.class, new Object[]{a0});
        }
    }

    static final class FakeAuraCommerceService extends br.com.fashionai.application.service.AuraCommerceService {
        FakeAuraCommerceService() {
            super((br.com.fashionai.domain.repository.AuraArtOfferRepository) Fk.arg(br.com.fashionai.domain.repository.AuraArtOfferRepository.class), (br.com.fashionai.domain.repository.AuraIssuerLicenseRepository) Fk.arg(br.com.fashionai.domain.repository.AuraIssuerLicenseRepository.class), (br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> adminCatalog(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "adminCatalog", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> catalog() {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "catalog", java.util.List.class, new Object[]{});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "mine", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> purchase(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "purchase", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public void requireLicense(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            Fk.call(this, "requireLicense", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> save(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.AuraCommerceService.OfferForm a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "save", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeAuraMotionService extends br.com.fashionai.application.service.AuraMotionService {
        FakeAuraMotionService() {
            super((br.com.fashionai.domain.repository.AuraMotionJobRepository) Fk.arg(br.com.fashionai.domain.repository.AuraMotionJobRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.domain.repository.CatalogProductRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogProductRepository.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.service.AuraPermissionsService) Fk.arg(br.com.fashionai.application.service.AuraPermissionsService.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.service.TryOnService) Fk.arg(br.com.fashionai.application.service.TryOnService.class), (br.com.fashionai.application.ports.AuraMotionPort) Fk.arg(br.com.fashionai.application.ports.AuraMotionPort.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public br.com.fashionai.application.service.AuraMotionService.View apply(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (br.com.fashionai.application.service.AuraMotionService.View) Fk.call(this, "apply", br.com.fashionai.application.service.AuraMotionService.View.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.service.AuraMotionService.View cancel(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.service.AuraMotionService.View) Fk.call(this, "cancel", br.com.fashionai.application.service.AuraMotionService.View.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> capabilities() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "capabilities", java.util.Map.class, new Object[]{});
        }

        @Override
        public br.com.fashionai.application.service.AuraMotionService.View create(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.AuraMotionService.Request a1) {
            return (br.com.fashionai.application.service.AuraMotionService.View) Fk.call(this, "create", br.com.fashionai.application.service.AuraMotionService.View.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.service.AuraMotionService.View get(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.service.AuraMotionService.View) Fk.call(this, "get", br.com.fashionai.application.service.AuraMotionService.View.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<br.com.fashionai.application.service.AuraMotionService.View> list(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<br.com.fashionai.application.service.AuraMotionService.View>) Fk.call(this, "list", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.UUID> pending() {
            return (java.util.List<java.util.UUID>) Fk.call(this, "pending", java.util.List.class, new Object[]{});
        }

        @Override
        public void process(java.util.UUID a0) {
            Fk.call(this, "process", void.class, new Object[]{a0});
        }

        @Override
        public byte[] readAppliedMedia(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (byte[]) Fk.call(this, "readAppliedMedia", byte[].class, new Object[]{a0, a1, a2});
        }

        @Override
        public byte[] readMedia(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (byte[]) Fk.call(this, "readMedia", byte[].class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeAuraPermissionsService extends br.com.fashionai.application.service.AuraPermissionsService {
        FakeAuraPermissionsService() {
            super((br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository.class));
        }

        @Override
        public boolean canUserEquipAura(java.util.UUID a0, br.com.fashionai.application.service.AuraPermissionsService.AuraType a1) {
            return (boolean) Fk.call(this, "canUserEquipAura", boolean.class, new Object[]{a0, a1});
        }

        @Override
        public java.lang.String getLockedAuraMessage(br.com.fashionai.application.service.AuraPermissionsService.AuraType a0) {
            return (java.lang.String) Fk.call(this, "getLockedAuraMessage", java.lang.String.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> permissions(java.util.UUID a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "permissions", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public void requireHypeFinish(java.util.UUID a0, java.lang.String a1) {
            Fk.call(this, "requireHypeFinish", void.class, new Object[]{a0, a1});
        }

        @Override
        public void require(java.util.UUID a0, br.com.fashionai.application.service.AuraPermissionsService.AuraType a1) {
            Fk.call(this, "require", void.class, new Object[]{a0, a1});
        }
    }

    static final class FakeAutopilotService extends br.com.fashionai.application.service.AutopilotService {
        FakeAutopilotService() {
            super((br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.application.service.DailyLookService) Fk.arg(br.com.fashionai.application.service.DailyLookService.class), (br.com.fashionai.domain.repository.WeekPlanRepository) Fk.arg(br.com.fashionai.domain.repository.WeekPlanRepository.class), (br.com.fashionai.domain.repository.WeekPlanDayRepository) Fk.arg(br.com.fashionai.domain.repository.WeekPlanDayRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.application.service.PreferenceModel) Fk.arg(br.com.fashionai.application.service.PreferenceModel.class), (br.com.fashionai.application.service.WeatherService) Fk.arg(br.com.fashionai.application.service.WeatherService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.application.hype.HypeQueryService) Fk.arg(br.com.fashionai.application.hype.HypeQueryService.class), (br.com.fashionai.application.insights.InsightService) Fk.arg(br.com.fashionai.application.insights.InsightService.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> confirmDaily(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1, java.lang.String a2, java.util.List<java.lang.String> a3, java.lang.String a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "confirmDaily", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> currentWeek(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "currentWeek", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> daily(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.AutopilotService.DailyRequest a1, java.util.Set<java.util.UUID> a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "daily", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> daily(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.AutopilotService.DailyRequest a1, java.util.Set<java.util.UUID> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "daily", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> daily(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.AutopilotService.DailyRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "daily", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> discardWeek(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "discardWeek", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> editDay(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.List<java.util.UUID> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "editDay", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> planWeek(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.AutopilotService.WeekRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "planWeek", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> useDay(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "useDay", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeAvatar3dService extends br.com.fashionai.application.service.Avatar3dService {
        FakeAvatar3dService() {
            super((br.com.fashionai.domain.repository.UserAvatar3dRepository) Fk.arg(br.com.fashionai.domain.repository.UserAvatar3dRepository.class), (br.com.fashionai.domain.repository.AvatarIdentityVersionRepository) Fk.arg(br.com.fashionai.domain.repository.AvatarIdentityVersionRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.ports.MediaStoragePort) Fk.arg(br.com.fashionai.application.ports.MediaStoragePort.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> approve(br.com.fashionai.application.security.CurrentUser a0, int a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "approve", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void deleteAllFor(java.util.UUID a0) {
            Fk.call(this, "deleteAllFor", void.class, new Object[]{a0});
        }

        @Override
        public void delete(br.com.fashionai.application.security.CurrentUser a0) {
            Fk.call(this, "delete", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>> forMannequin(java.util.UUID a0, java.util.UUID a1) {
            return (java.util.Optional<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "forMannequin", java.util.Optional.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> get(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "get", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> listVersions(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "listVersions", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> restore(br.com.fashionai.application.security.CurrentUser a0, int a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "restore", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> save(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.Avatar3dService.SaveCommand a1, byte[] a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "save", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public byte[] texture(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.Integer a2) {
            return (byte[]) Fk.call(this, "texture", byte[].class, new Object[]{a0, a1, a2});
        }

        @Override
        public byte[] texture(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (byte[]) Fk.call(this, "texture", byte[].class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> update(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.Avatar3dService.SettingsCommand a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "update", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeAvatarBodyScanService extends br.com.fashionai.application.service.AvatarBodyScanService {
        FakeAvatarBodyScanService() {
            super((br.com.fashionai.application.ports.BodyMeasurementPort) Fk.arg(br.com.fashionai.application.ports.BodyMeasurementPort.class), (br.com.fashionai.application.ports.RateLimitPort) Fk.arg(br.com.fashionai.application.ports.RateLimitPort.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> measure(br.com.fashionai.application.security.CurrentUser a0, byte[] a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "measure", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeAvatarPortraitService extends br.com.fashionai.application.service.AvatarPortraitService {
        FakeAvatarPortraitService() {
            super((br.com.fashionai.application.ports.StylizedPortraitPort) Fk.arg(br.com.fashionai.application.ports.StylizedPortraitPort.class), (br.com.fashionai.application.ports.RateLimitPort) Fk.arg(br.com.fashionai.application.ports.RateLimitPort.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> generate(br.com.fashionai.application.security.CurrentUser a0, byte[] a1, boolean a2, java.lang.Integer a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "generate", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }
    }

    static final class FakeBackgroundStudioService extends br.com.fashionai.application.service.BackgroundStudioService {
        FakeBackgroundStudioService() {
            super((br.com.fashionai.application.assets.AssetCatalogService) Fk.arg(br.com.fashionai.application.assets.AssetCatalogService.class), (br.com.fashionai.domain.repository.AssetPresetRepository) Fk.arg(br.com.fashionai.domain.repository.AssetPresetRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (java.util.List) Fk.arg(java.util.List.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public void applyToScheme(br.com.fashionai.domain.model.Scheme a0, java.util.Map<java.lang.String, java.lang.Object> a1, boolean a2) {
            Fk.call(this, "applyToScheme", void.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> catalog() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "catalog", java.util.Map.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> combination(java.lang.String a0, java.lang.String a1, boolean a2, boolean a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "combination", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> generateArt(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.BackgroundStudioService.ArtRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "generateArt", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> generateSkinThumbnail(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "generateSkinThumbnail", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> recommend(java.util.List<java.lang.String> a0, java.util.List<java.lang.String> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "recommend", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.imaging.SchemeCardRenderer.Background rendererBackground(br.com.fashionai.domain.model.Scheme a0) {
            return (br.com.fashionai.application.imaging.SchemeCardRenderer.Background) Fk.call(this, "rendererBackground", br.com.fashionai.application.imaging.SchemeCardRenderer.Background.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> resetScheme(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "resetScheme", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> savePiece(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.Object a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "savePiece", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> saveScheme(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.Map<java.lang.String, java.lang.Object> a2, boolean a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "saveScheme", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public void setAuraPermissions(br.com.fashionai.application.service.AuraPermissionsService a0) {
            Fk.call(this, "setAuraPermissions", void.class, new Object[]{a0});
        }

        @Override
        public void setMetamorphoseInventory(br.com.fashionai.application.service.MetamorphoseInventoryService a0) {
            Fk.call(this, "setMetamorphoseInventory", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> upload(br.com.fashionai.application.security.CurrentUser a0, byte[] a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "upload", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeBrandLogoService extends br.com.fashionai.application.service.BrandLogoService {
        FakeBrandLogoService() {
            super((br.com.fashionai.domain.repository.BrandLogoRepository) Fk.arg(br.com.fashionai.domain.repository.BrandLogoRepository.class), (br.com.fashionai.domain.repository.BrandRepository) Fk.arg(br.com.fashionai.domain.repository.BrandRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.application.ports.WebFetchPort) Fk.arg(br.com.fashionai.application.ports.WebFetchPort.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.ports.MediaStoragePort) Fk.arg(br.com.fashionai.application.ports.MediaStoragePort.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (org.springframework.transaction.support.TransactionTemplate) Fk.arg(org.springframework.transaction.support.TransactionTemplate.class));
        }

        @Override
        public void acceptWebLogo(java.lang.String a0, java.lang.String a1, java.lang.String a2, java.lang.String a3, java.lang.String a4) {
            Fk.call(this, "acceptWebLogo", void.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> all() {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "all", java.util.List.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.util.Map<java.lang.String, java.lang.Object>> batch(java.util.UUID a0, java.util.List<java.lang.String> a1, int a2) {
            return (java.util.Map<java.lang.String, java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "batch", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> cached(java.lang.String a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "cached", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> logo(java.util.UUID a0, java.lang.String a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "logo", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> manual(java.lang.String a0, byte[] a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "manual", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public int refreshPending() {
            return (int) Fk.call(this, "refreshPending", int.class, new Object[]{});
        }
    }

    static final class FakeBrandWebSearchService extends br.com.fashionai.application.service.BrandWebSearchService {
        FakeBrandWebSearchService() {
            super((br.com.fashionai.application.ports.WebFetchPort) Fk.arg(br.com.fashionai.application.ports.WebFetchPort.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.service.BrandLogoService) Fk.arg(br.com.fashionai.application.service.BrandLogoService.class), (java.lang.String) Fk.arg(java.lang.String.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> remember(java.lang.String a0, java.lang.String a1, java.lang.String a2, java.lang.String a3, java.lang.String a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "remember", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> search(java.util.UUID a0, java.lang.String a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "search", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeChallengeService extends br.com.fashionai.application.service.ChallengeService {
        FakeChallengeService() {
            super((br.com.fashionai.domain.repository.ChallengeTemplateRepository) Fk.arg(br.com.fashionai.domain.repository.ChallengeTemplateRepository.class), (br.com.fashionai.domain.repository.ChallengeInstanceRepository) Fk.arg(br.com.fashionai.domain.repository.ChallengeInstanceRepository.class), (br.com.fashionai.domain.repository.ChallengeParticipantRepository) Fk.arg(br.com.fashionai.domain.repository.ChallengeParticipantRepository.class), (br.com.fashionai.domain.repository.ChallengeEventRepository) Fk.arg(br.com.fashionai.domain.repository.ChallengeEventRepository.class), (br.com.fashionai.domain.repository.ChallengeNoteRepository) Fk.arg(br.com.fashionai.domain.repository.ChallengeNoteRepository.class), (br.com.fashionai.domain.repository.ChallengeVoteRepository) Fk.arg(br.com.fashionai.domain.repository.ChallengeVoteRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.DailyLookRepository) Fk.arg(br.com.fashionai.domain.repository.DailyLookRepository.class), (br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository) Fk.arg(br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository.class), (br.com.fashionai.domain.repository.FollowRepository) Fk.arg(br.com.fashionai.domain.repository.FollowRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.application.service.RoomService) Fk.arg(br.com.fashionai.application.service.RoomService.class), (br.com.fashionai.application.service.FaiPointsService) Fk.arg(br.com.fashionai.application.service.FaiPointsService.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (br.com.fashionai.application.events.SideEffectRunner) Fk.arg(br.com.fashionai.application.events.SideEffectRunner.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> accept(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.Boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "accept", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> activeSummary(java.util.UUID a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "activeSummary", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> cancel(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "cancel", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> catalog(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "catalog", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public void conclude(br.com.fashionai.domain.model.ChallengeInstance a0, br.com.fashionai.domain.model.ChallengeTemplate a1) {
            Fk.call(this, "conclude", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> confirmRealMirror(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2, java.time.LocalDate a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "confirmRealMirror", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> decline(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "decline", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> decorations(java.util.UUID a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "decorations", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> detail(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "detail", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> launchDraft(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.List<java.util.UUID> a2, java.util.Map<java.lang.String, java.lang.String> a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "launchDraft", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> leave(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "leave", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "mine", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public byte[] mirrorPhoto(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (byte[]) Fk.call(this, "mirrorPhoto", byte[].class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> note(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "note", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public void onDailyLook(br.com.fashionai.application.events.DomainEvents.DailyLookRegistered a0) {
            Fk.call(this, "onDailyLook", void.class, new Object[]{a0});
        }

        @Override
        public void onMirror(br.com.fashionai.application.events.DomainEvents.MirrorAction a0) {
            Fk.call(this, "onMirror", void.class, new Object[]{a0});
        }

        @Override
        public void onPieceCreated(br.com.fashionai.application.events.DomainEvents.PieceCreated a0) {
            Fk.call(this, "onPieceCreated", void.class, new Object[]{a0});
        }

        @Override
        public void onSchemeSaved(br.com.fashionai.application.events.DomainEvents.SchemeSaved a0) {
            Fk.call(this, "onSchemeSaved", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> promote(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "promote", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> propose(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.ChallengeService.ProposalRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "propose", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> react(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "react", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> realMirror(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, byte[] a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "realMirror", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Optional<br.com.fashionai.application.service.MirrorService.PieceRestrictionProvider.Restriction> restriction(java.util.UUID a0) {
            return (java.util.Optional<br.com.fashionai.application.service.MirrorService.PieceRestrictionProvider.Restriction>) Fk.call(this, "restriction", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> resultCard(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "resultCard", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> startNow(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "startNow", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> start(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.ChallengeService.StartRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "start", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> submitEntry(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "submitEntry", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Integer> tick() {
            return (java.util.Map<java.lang.String, java.lang.Integer>) Fk.call(this, "tick", java.util.Map.class, new Object[]{});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> voteFeed(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "voteFeed", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> vote(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "vote", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeCommunityTrendService extends br.com.fashionai.application.service.CommunityTrendService {
        FakeCommunityTrendService() {
            super((br.com.fashionai.domain.repository.CommunityTrendRepository) Fk.arg(br.com.fashionai.domain.repository.CommunityTrendRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.service.FaiPointsService) Fk.arg(br.com.fashionai.application.service.FaiPointsService.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> create(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.CommunityTrendService.Create a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "create", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> list(java.lang.String a0, int a1, int a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "list", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> publish(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "publish", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeCopilotService extends br.com.fashionai.application.service.CopilotService {
        FakeCopilotService() {
            super((br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.DailyLookRepository) Fk.arg(br.com.fashionai.domain.repository.DailyLookRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.application.service.RoomService) Fk.arg(br.com.fashionai.application.service.RoomService.class), (br.com.fashionai.application.service.MirrorService) Fk.arg(br.com.fashionai.application.service.MirrorService.class), (br.com.fashionai.application.service.InventoryScoreService) Fk.arg(br.com.fashionai.application.service.InventoryScoreService.class), (br.com.fashionai.application.service.ChallengeService) Fk.arg(br.com.fashionai.application.service.ChallengeService.class), (br.com.fashionai.application.service.AutopilotService) Fk.arg(br.com.fashionai.application.service.AutopilotService.class), (br.com.fashionai.application.service.DailyLookService) Fk.arg(br.com.fashionai.application.service.DailyLookService.class), (br.com.fashionai.application.service.WeatherService) Fk.arg(br.com.fashionai.application.service.WeatherService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.application.service.BackgroundStudioService) Fk.arg(br.com.fashionai.application.service.BackgroundStudioService.class), (br.com.fashionai.application.hype.HypeQueryService) Fk.arg(br.com.fashionai.application.hype.HypeQueryService.class), (br.com.fashionai.application.insights.InsightService) Fk.arg(br.com.fashionai.application.insights.InsightService.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> accept(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1, java.lang.String a2, java.util.List<java.lang.String> a3, java.util.List<java.lang.String> a4, java.lang.String a5, java.lang.String a6, java.lang.String a7, java.util.Map<java.lang.String, java.lang.Object> a8) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "accept", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5, a6, a7, a8});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> ask(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.CopilotService.AskRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "ask", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> context(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.util.List<java.util.UUID> a2, java.lang.String a3, java.lang.Double a4, java.lang.Double a5) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "context", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> orientation(java.lang.String a0, java.util.List<java.lang.String> a1, java.util.List<java.lang.String> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "orientation", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void setMoments(br.com.fashionai.application.moments.MomentService a0) {
            Fk.call(this, "setMoments", void.class, new Object[]{a0});
        }

        @Override
        public void setSealPolicyService(br.com.fashionai.application.service.SealService a0) {
            Fk.call(this, "setSealPolicyService", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> suggestions(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.Double a2, java.lang.Double a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "suggestions", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }
    }

    static final class FakeCouponService extends br.com.fashionai.application.service.CouponService {
        FakeCouponService() {
            super((br.com.fashionai.domain.repository.CouponRightRepository) Fk.arg(br.com.fashionai.domain.repository.CouponRightRepository.class), (br.com.fashionai.domain.repository.PromotionRepository) Fk.arg(br.com.fashionai.domain.repository.PromotionRepository.class), (br.com.fashionai.domain.repository.PromotionRedemptionRepository) Fk.arg(br.com.fashionai.domain.repository.PromotionRedemptionRepository.class), (br.com.fashionai.domain.repository.FlairCombinationRepository) Fk.arg(br.com.fashionai.domain.repository.FlairCombinationRepository.class), (br.com.fashionai.domain.repository.FlairRedemptionRepository) Fk.arg(br.com.fashionai.domain.repository.FlairRedemptionRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.service.SealService) Fk.arg(br.com.fashionai.application.service.SealService.class), (br.com.fashionai.application.service.FlairService) Fk.arg(br.com.fashionai.application.service.FlairService.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> admin(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "admin", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> dismiss(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "dismiss", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "mine", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public void onCheck(br.com.fashionai.application.events.DomainEvents.CouponRightsCheck a0) {
            Fk.call(this, "onCheck", void.class, new Object[]{a0});
        }

        @Override
        public void onPiece(br.com.fashionai.application.events.DomainEvents.PieceCreated a0) {
            Fk.call(this, "onPiece", void.class, new Object[]{a0});
        }

        @Override
        public void onScheme(br.com.fashionai.application.events.DomainEvents.SchemeSaved a0) {
            Fk.call(this, "onScheme", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> redeem(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "redeem", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public int scan(java.util.UUID a0) {
            return (int) Fk.call(this, "scan", int.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> validate(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "validate", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeDailyLookService extends br.com.fashionai.application.service.DailyLookService {
        FakeDailyLookService() {
            super((br.com.fashionai.domain.repository.DailyLookRepository) Fk.arg(br.com.fashionai.domain.repository.DailyLookRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> feedback(br.com.fashionai.application.security.CurrentUser a0, java.time.LocalDate a1, br.com.fashionai.domain.model.enums.DailyLookFeedback a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "feedback", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> history(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "history", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> pendingFeedback(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "pendingFeedback", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.domain.model.DailyLook register(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.Scheme a1, br.com.fashionai.domain.model.enums.DailyLookSource a2, java.time.LocalDate a3) {
            return (br.com.fashionai.domain.model.DailyLook) Fk.call(this, "register", br.com.fashionai.domain.model.DailyLook.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Optional<br.com.fashionai.domain.model.DailyLook> today(java.util.UUID a0) {
            return (java.util.Optional<br.com.fashionai.domain.model.DailyLook>) Fk.call(this, "today", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> view(br.com.fashionai.domain.model.DailyLook a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "view", java.util.Map.class, new Object[]{a0});
        }
    }

    static final class FakeDashboardService extends br.com.fashionai.application.service.DashboardService {
        FakeDashboardService() {
            super((br.com.fashionai.application.ports.AnalyticsQueryPort) Fk.arg(br.com.fashionai.application.ports.AnalyticsQueryPort.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.application.service.SealService) Fk.arg(br.com.fashionai.application.service.SealService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.domain.repository.BackupRecordRepository) Fk.arg(br.com.fashionai.domain.repository.BackupRecordRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> admin(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.DashboardService.Query a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "admin", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> issuer(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.DashboardService.Query a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "issuer", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> saveLayout(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.lang.String> a1, java.util.List<java.lang.String> a2, java.util.Map<java.lang.String, java.lang.Object> a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "saveLayout", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }
    }

    static final class FakeDnaService extends br.com.fashionai.application.service.DnaService {
        FakeDnaService() {
            super((br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.domain.repository.StyleDnaVersionRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaVersionRepository.class), (br.com.fashionai.domain.repository.DnaSchemeRepository) Fk.arg(br.com.fashionai.domain.repository.DnaSchemeRepository.class), (br.com.fashionai.domain.repository.DnaSchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.DnaSchemeItemRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.DailyLookRepository) Fk.arg(br.com.fashionai.domain.repository.DailyLookRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> builder(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "builder", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> compositions(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.DnaService.DnaComposeRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "compositions", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> createDnaScheme(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.DnaService.DnaSchemeForm a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "createDnaScheme", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public void deleteDnaScheme(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "deleteDnaScheme", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> generate(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.DnaService.LifeForm a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "generate", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> getDnaScheme(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "getDnaScheme", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> myDnaSchemes(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "myDnaSchemes", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> overview(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "overview", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> preview(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.DnaService.DnaSchemeForm a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "preview", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setColorSeason(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setColorSeason", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setPrivateFields(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.lang.String> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setPrivateFields", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> shareCard(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "shareCard", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> socialProof(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "socialProof", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateDnaScheme(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.DnaService.DnaSchemeForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateDnaScheme", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateLife(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.DnaService.LifeForm a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateLife", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeEraStudioService extends br.com.fashionai.application.service.EraStudioService {
        FakeEraStudioService() {
            super((br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> draft(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "draft", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> upload(br.com.fashionai.application.security.CurrentUser a0, byte[] a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "upload", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeExchangeRateService extends br.com.fashionai.application.service.ExchangeRateService {
        FakeExchangeRateService() {
            super((org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class));
        }

        @Override
        public java.util.Optional<java.math.BigDecimal> convert(java.math.BigDecimal a0, java.lang.String a1, java.lang.String a2) {
            return (java.util.Optional<java.math.BigDecimal>) Fk.call(this, "convert", java.util.Optional.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.service.ExchangeRateService.Rates rates() {
            return (br.com.fashionai.application.service.ExchangeRateService.Rates) Fk.call(this, "rates", br.com.fashionai.application.service.ExchangeRateService.Rates.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> view() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "view", java.util.Map.class, new Object[]{});
        }
    }

    static final class FakeExplorerService extends br.com.fashionai.application.service.ExplorerService {
        FakeExplorerService() {
            super((br.com.fashionai.application.ports.AnalyticsQueryPort) Fk.arg(br.com.fashionai.application.ports.AnalyticsQueryPort.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.SealBondRepository) Fk.arg(br.com.fashionai.domain.repository.SealBondRepository.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> brandsAndStores(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, java.lang.String a3, java.lang.String a4, java.lang.String a5, java.lang.String a6, java.lang.String a7) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "brandsAndStores", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5, a6, a7});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> brandsAndStores(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, java.lang.String a3, java.lang.String a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "brandsAndStores", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> globalPanel(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "globalPanel", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> globalPanel(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "globalPanel", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> insights(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "insights", java.util.Map.class, new Object[]{a0});
        }
    }

    static final class FakeFaiPointsService extends br.com.fashionai.application.service.FaiPointsService {
        FakeFaiPointsService() {
            super((br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository.class), (br.com.fashionai.domain.repository.FaiPointsRuleRepository) Fk.arg(br.com.fashionai.domain.repository.FaiPointsRuleRepository.class), (br.com.fashionai.domain.repository.RoomCatalogItemRepository) Fk.arg(br.com.fashionai.domain.repository.RoomCatalogItemRepository.class), (br.com.fashionai.domain.repository.RoomInventoryItemRepository) Fk.arg(br.com.fashionai.domain.repository.RoomInventoryItemRepository.class), (br.com.fashionai.application.service.FaiPointsService.RoomLayoutAccess) Fk.arg(br.com.fashionai.application.service.FaiPointsService.RoomLayoutAccess.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.service.WardrobeCreatorService) Fk.arg(br.com.fashionai.application.service.WardrobeCreatorService.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> account(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "account", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> apply(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "apply", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.service.FaiPointsService.Award awardIsolated(java.util.UUID a0, java.lang.String a1, java.lang.String a2, java.lang.String a3, java.lang.Integer a4) {
            return (br.com.fashionai.application.service.FaiPointsService.Award) Fk.call(this, "awardIsolated", br.com.fashionai.application.service.FaiPointsService.Award.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public br.com.fashionai.application.service.FaiPointsService.Award award(java.util.UUID a0, java.lang.String a1, java.lang.String a2, java.lang.String a3, java.lang.Integer a4) {
            return (br.com.fashionai.application.service.FaiPointsService.Award) Fk.call(this, "award", br.com.fashionai.application.service.FaiPointsService.Award.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public long balance(java.util.UUID a0) {
            return (long) Fk.call(this, "balance", long.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> buy(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "buy", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> buy(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "buy", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public int game(java.util.UUID a0, java.lang.String a1, java.lang.String a2, java.lang.String a3) {
            return (int) Fk.call(this, "game", int.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.service.FaiPointsService.Level level(java.util.UUID a0) {
            return (br.com.fashionai.application.service.FaiPointsService.Level) Fk.call(this, "level", br.com.fashionai.application.service.FaiPointsService.Level.class, new Object[]{a0});
        }

        @Override
        public long lifetime(java.util.UUID a0) {
            return (long) Fk.call(this, "lifetime", long.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> shop(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "shop", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> tryOn(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "tryOn", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeFlairAdventureService extends br.com.fashionai.application.service.FlairAdventureService {
        FakeFlairAdventureService() {
            super((br.com.fashionai.domain.repository.FlairAdventureSessionRepository) Fk.arg(br.com.fashionai.domain.repository.FlairAdventureSessionRepository.class), (br.com.fashionai.application.service.FlairService) Fk.arg(br.com.fashionai.application.service.FlairService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.application.hype.AuraHypeDropService) Fk.arg(br.com.fashionai.application.hype.AuraHypeDropService.class), (br.com.fashionai.application.service.FaiPointsService) Fk.arg(br.com.fashionai.application.service.FaiPointsService.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> action(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.flair.AfterpartyEngine.Action a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "action", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> active(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "active", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> start(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "start", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> state(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "state", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeFlairChallengeService extends br.com.fashionai.application.service.FlairChallengeService {
        FakeFlairChallengeService() {
            super((br.com.fashionai.domain.repository.FlairChallengeRepository) Fk.arg(br.com.fashionai.domain.repository.FlairChallengeRepository.class), (br.com.fashionai.domain.repository.FlairChallengeGroupRepository) Fk.arg(br.com.fashionai.domain.repository.FlairChallengeGroupRepository.class), (br.com.fashionai.domain.repository.FlairChallengeSubmissionRepository) Fk.arg(br.com.fashionai.domain.repository.FlairChallengeSubmissionRepository.class), (br.com.fashionai.domain.repository.FlairCardInstanceRepository) Fk.arg(br.com.fashionai.domain.repository.FlairCardInstanceRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.MomentRepository) Fk.arg(br.com.fashionai.domain.repository.MomentRepository.class), (br.com.fashionai.application.moments.MomentService) Fk.arg(br.com.fashionai.application.moments.MomentService.class), (br.com.fashionai.application.service.FaiPointsService) Fk.arg(br.com.fashionai.application.service.FaiPointsService.class), (br.com.fashionai.domain.repository.UserAchievementRepository) Fk.arg(br.com.fashionai.domain.repository.UserAchievementRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.service.FlairCollectionService) Fk.arg(br.com.fashionai.application.service.FlairCollectionService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.service.AtelierRewardSystem) Fk.arg(br.com.fashionai.application.service.AtelierRewardSystem.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> addToPrivateMoment(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.FlairChallengeService.PrivateChallengeRequest a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "addToPrivateMoment", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> adminList(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "adminList", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> adminSave(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.FlairChallengeService.AdminChallengeRequest a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "adminSave", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> check(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.service.FlairChallengeService.BuildRequest a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "check", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> detail(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "detail", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> list(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "list", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> submit(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.service.FlairChallengeService.BuildRequest a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "submit", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void useClock(java.time.Clock a0) {
            Fk.call(this, "useClock", void.class, new Object[]{a0});
        }
    }

    static final class FakeFlairCollectionService extends br.com.fashionai.application.service.FlairCollectionService {
        FakeFlairCollectionService() {
            super((br.com.fashionai.domain.repository.FlairCardInstanceRepository) Fk.arg(br.com.fashionai.domain.repository.FlairCardInstanceRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.CatalogProductRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogProductRepository.class), (br.com.fashionai.domain.repository.BrandRepository) Fk.arg(br.com.fashionai.domain.repository.BrandRepository.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.service.FlairService) Fk.arg(br.com.fashionai.application.service.FlairService.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.domain.repository.FlairChallengeRepository) Fk.arg(br.com.fashionai.domain.repository.FlairChallengeRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> convertPiece(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "convertPiece", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> mine(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "mine", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> ofUser(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "ofUser", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> previewDraft(br.com.fashionai.application.service.FlairCollectionService.Draft a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "previewDraft", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> previewPiece(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "previewPiece", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeFlairModesService extends br.com.fashionai.application.service.FlairModesService {
        FakeFlairModesService() {
            super((br.com.fashionai.application.service.FlairService) Fk.arg(br.com.fashionai.application.service.FlairService.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.FlairMatchRepository) Fk.arg(br.com.fashionai.domain.repository.FlairMatchRepository.class), (br.com.fashionai.domain.repository.FlairMatchEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FlairMatchEntryRepository.class), (br.com.fashionai.domain.repository.FlairModeStateRepository) Fk.arg(br.com.fashionai.domain.repository.FlairModeStateRepository.class), (br.com.fashionai.domain.repository.FlairTerritoryRepository) Fk.arg(br.com.fashionai.domain.repository.FlairTerritoryRepository.class), (br.com.fashionai.domain.repository.FlairTrophyRepository) Fk.arg(br.com.fashionai.domain.repository.FlairTrophyRepository.class), (br.com.fashionai.domain.repository.FlairCoinEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FlairCoinEntryRepository.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.service.FaiPointsService) Fk.arg(br.com.fashionai.application.service.FaiPointsService.class), (br.com.fashionai.application.service.AtelierRewardSystem) Fk.arg(br.com.fashionai.application.service.AtelierRewardSystem.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> attack(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, java.util.List<java.util.UUID> a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "attack", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> battle(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "battle", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> catalog() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "catalog", java.util.Map.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> chessSuggest(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "chessSuggest", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> chess(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.util.UUID> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "chess", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> combo(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "combo", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> deckPlay(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.List<java.util.UUID> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "deckPlay", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> deckStart(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "deckStart", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> deck(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "deck", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> draftFinish(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.List<java.util.List<java.util.UUID>> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "draftFinish", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> draftPick(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "draftPick", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> draftStart(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "draftStart", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> enterRunway(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "enterRunway", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> fightBoss(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.util.List<java.util.UUID> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "fightBoss", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> league(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "league", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> myLooks(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "myLooks", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> playLeague(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "playLeague", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> playUltimate(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "playUltimate", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> resolveTour(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "resolveTour", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> roll(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "roll", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> runway(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "runway", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> saveDeck(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "saveDeck", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> saveRoster(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1, java.util.List<java.util.UUID> a2, java.util.List<java.util.UUID> a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "saveRoster", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> saveUltimate(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.util.UUID> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "saveUltimate", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> squad(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "squad", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> tagTeam(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2, java.util.List<java.lang.String> a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "tagTeam", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> territories(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "territories", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> tour(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "tour", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> trophiesOf(java.util.UUID a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "trophiesOf", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> ultimate(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "ultimate", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> wardrobeWars(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "wardrobeWars", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeFlairService extends br.com.fashionai.application.service.FlairService {
        FakeFlairService() {
            super((br.com.fashionai.domain.repository.FlairProfileRepository) Fk.arg(br.com.fashionai.domain.repository.FlairProfileRepository.class), (br.com.fashionai.domain.repository.FlairCoinEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FlairCoinEntryRepository.class), (br.com.fashionai.domain.repository.FlairCombinationRepository) Fk.arg(br.com.fashionai.domain.repository.FlairCombinationRepository.class), (br.com.fashionai.domain.repository.FlairRedemptionRepository) Fk.arg(br.com.fashionai.domain.repository.FlairRedemptionRepository.class), (br.com.fashionai.domain.repository.FlairTeamRepository) Fk.arg(br.com.fashionai.domain.repository.FlairTeamRepository.class), (br.com.fashionai.domain.repository.FlairTeamMemberRepository) Fk.arg(br.com.fashionai.domain.repository.FlairTeamMemberRepository.class), (br.com.fashionai.domain.repository.FlairMatchRepository) Fk.arg(br.com.fashionai.domain.repository.FlairMatchRepository.class), (br.com.fashionai.domain.repository.FlairMatchEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FlairMatchEntryRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.ReactionRepository) Fk.arg(br.com.fashionai.domain.repository.ReactionRepository.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.application.service.InstitutionalService) Fk.arg(br.com.fashionai.application.service.InstitutionalService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class), (br.com.fashionai.application.service.FaiPointsService) Fk.arg(br.com.fashionai.application.service.FaiPointsService.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class), (br.com.fashionai.application.service.AtelierRewardSystem) Fk.arg(br.com.fashionai.application.service.AtelierRewardSystem.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> arena(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "arena", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> brandTab(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "brandTab", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> buySkin(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "buySkin", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.List<br.com.fashionai.application.flair.FlairEngine.Card> cardsOf(java.util.List<br.com.fashionai.domain.model.WardrobeItem> a0) {
            return (java.util.List<br.com.fashionai.application.flair.FlairEngine.Card>) Fk.call(this, "cardsOf", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> cards(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "cards", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> checkCombination(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "checkCombination", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> claimQuest(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "claimQuest", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> combinationsFor(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "combinationsFor", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> createTeam(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "createTeam", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.flair.FlairEngine.Deck deckOf(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.flair.FlairEngine.Deck) Fk.call(this, "deckOf", br.com.fashionai.application.flair.FlairEngine.Deck.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<br.com.fashionai.application.flair.FlairEngine.Deck> decks(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<br.com.fashionai.application.flair.FlairEngine.Deck>) Fk.call(this, "decks", java.util.List.class, new Object[]{a0});
        }

        @Override
        public void deleteCombination(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "deleteCombination", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> duel(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "duel", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> joinArena(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "joinArena", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> joinTeam(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "joinTeam", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> league(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "league", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> leaveTeam(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "leaveTeam", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> me(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "me", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.lang.Double publicLookHype(java.util.UUID a0) {
            return (java.lang.Double) Fk.call(this, "publicLookHype", java.lang.Double.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.util.UUID, java.lang.Double> publicLookHype(java.util.Collection<java.util.UUID> a0) {
            return (java.util.Map<java.util.UUID, java.lang.Double>) Fk.call(this, "publicLookHype", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> quests(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "quests", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> redeem(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "redeem", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void rightsCheck(java.util.UUID a0) {
            Fk.call(this, "rightsCheck", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> saveCombination(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.FlairService.CombinationForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "saveCombination", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> teamBattle(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "teamBattle", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> validateCode(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "validateCode", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> vouchers(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "vouchers", java.util.List.class, new Object[]{a0});
        }
    }

    static final class FakeGuideService extends br.com.fashionai.application.service.GuideService {
        FakeGuideService() {
            super((br.com.fashionai.domain.repository.UserGuideRepository) Fk.arg(br.com.fashionai.domain.repository.UserGuideRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "mine", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> record(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.service.GuideService.GuideEvent a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "record", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void useClock(java.time.Clock a0) {
            Fk.call(this, "useClock", void.class, new Object[]{a0});
        }
    }

    static final class FakeIdentityService extends br.com.fashionai.application.service.IdentityService {
        FakeIdentityService() {
            super((br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (br.com.fashionai.domain.repository.RefreshTokenRepository) Fk.arg(br.com.fashionai.domain.repository.RefreshTokenRepository.class), (br.com.fashionai.domain.repository.VerificationCodeRepository) Fk.arg(br.com.fashionai.domain.repository.VerificationCodeRepository.class), (br.com.fashionai.application.identity.PasswordHasherPort) Fk.arg(br.com.fashionai.application.identity.PasswordHasherPort.class), (br.com.fashionai.application.ports.TokenIssuerPort) Fk.arg(br.com.fashionai.application.ports.TokenIssuerPort.class), (br.com.fashionai.application.ports.RateLimitPort) Fk.arg(br.com.fashionai.application.ports.RateLimitPort.class), (br.com.fashionai.application.ports.EmailSenderPort) Fk.arg(br.com.fashionai.application.ports.EmailSenderPort.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (br.com.fashionai.application.ports.MediaStoragePort) Fk.arg(br.com.fashionai.application.ports.MediaStoragePort.class), (java.lang.String) Fk.arg(java.lang.String.class));
        }

        @Override
        public int changePassword(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2, java.lang.String a3, java.lang.String a4) {
            return (int) Fk.call(this, "changePassword", int.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public void confirmPasswordReset(java.lang.String a0, java.lang.String a1, java.lang.String a2) {
            Fk.call(this, "confirmPasswordReset", void.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Optional<br.com.fashionai.domain.model.User> findByEmail(java.lang.String a0) {
            return (java.util.Optional<br.com.fashionai.domain.model.User>) Fk.call(this, "findByEmail", java.util.Optional.class, new Object[]{a0});
        }

        @Override
        public void invalidateCodes(java.util.UUID a0, br.com.fashionai.domain.model.enums.VerificationPurpose a1) {
            Fk.call(this, "invalidateCodes", void.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.service.IdentityService.Session login(br.com.fashionai.application.service.IdentityService.LoginCommand a0, java.lang.String a1, java.lang.String a2) {
            return (br.com.fashionai.application.service.IdentityService.Session) Fk.call(this, "login", br.com.fashionai.application.service.IdentityService.Session.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void logout(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "logout", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> preRegistrationUpload(byte[] a0, java.lang.String a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "preRegistrationUpload", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public int purgeStalePendingUploads() {
            return (int) Fk.call(this, "purgeStalePendingUploads", int.class, new Object[]{});
        }

        @Override
        public void reauthenticate(java.util.UUID a0, java.lang.String a1) {
            Fk.call(this, "reauthenticate", void.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.service.IdentityService.Session refresh(java.lang.String a0, java.lang.String a1, java.lang.String a2) {
            return (br.com.fashionai.application.service.IdentityService.Session) Fk.call(this, "refresh", br.com.fashionai.application.service.IdentityService.Session.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.service.IdentityService.Session register(br.com.fashionai.application.service.IdentityService.RegisterCommand a0, java.lang.String a1, java.lang.String a2) {
            return (br.com.fashionai.application.service.IdentityService.Session) Fk.call(this, "register", br.com.fashionai.application.service.IdentityService.Session.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void requestPasswordReset(java.lang.String a0, java.lang.String a1, java.lang.String a2) {
            Fk.call(this, "requestPasswordReset", void.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void requireCodeAttemptQuota(java.util.UUID a0, br.com.fashionai.domain.model.enums.VerificationPurpose a1) {
            Fk.call(this, "requireCodeAttemptQuota", void.class, new Object[]{a0, a1});
        }

        @Override
        public void resendEmailVerification(br.com.fashionai.application.security.CurrentUser a0) {
            Fk.call(this, "resendEmailVerification", void.class, new Object[]{a0});
        }

        @Override
        public int revokeOtherSessions(java.util.UUID a0, java.util.UUID a1) {
            return (int) Fk.call(this, "revokeOtherSessions", int.class, new Object[]{a0, a1});
        }

        @Override
        public void revokeSession(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "revokeSession", void.class, new Object[]{a0, a1});
        }

        @Override
        public boolean sessionActive(java.util.UUID a0) {
            return (boolean) Fk.call(this, "sessionActive", boolean.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> sessions(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "sessions", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public void setIssuerReview(br.com.fashionai.application.service.IssuerReviewService a0) {
            Fk.call(this, "setIssuerReview", void.class, new Object[]{a0});
        }

        @Override
        public java.lang.String suggestUsername(java.lang.String a0) {
            return (java.lang.String) Fk.call(this, "suggestUsername", java.lang.String.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.lang.String> usernameSuggestions(java.lang.String a0) {
            return (java.util.List<java.lang.String>) Fk.call(this, "usernameSuggestions", java.util.List.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.view.Views.UserCard verifyEmail(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (br.com.fashionai.application.view.Views.UserCard) Fk.call(this, "verifyEmail", br.com.fashionai.application.view.Views.UserCard.class, new Object[]{a0, a1});
        }
    }

    static final class FakeInstitutionalService extends br.com.fashionai.application.service.InstitutionalService {
        FakeInstitutionalService() {
            super((br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (br.com.fashionai.domain.repository.FollowRepository) Fk.arg(br.com.fashionai.domain.repository.FollowRepository.class), (br.com.fashionai.domain.repository.SealRepository) Fk.arg(br.com.fashionai.domain.repository.SealRepository.class), (br.com.fashionai.domain.repository.SealBondRepository) Fk.arg(br.com.fashionai.domain.repository.SealBondRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SavedItemRepository) Fk.arg(br.com.fashionai.domain.repository.SavedItemRepository.class), (br.com.fashionai.domain.repository.ReactionRepository) Fk.arg(br.com.fashionai.domain.repository.ReactionRepository.class), (br.com.fashionai.domain.repository.SchemeGroupingRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeGroupingRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.application.service.SealService) Fk.arg(br.com.fashionai.application.service.SealService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.hype.HypeQueryService) Fk.arg(br.com.fashionai.application.hype.HypeQueryService.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> brandFeed(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "brandFeed", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> celebrityFeed(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "celebrityFeed", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> profile(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "profile", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public void setLevelProgress(br.com.fashionai.application.service.LevelProgressService a0) {
            Fk.call(this, "setLevelProgress", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> store(java.lang.String a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "store", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.lang.Object tab(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, java.lang.String a3, java.util.UUID a4) {
            return (java.lang.Object) Fk.call(this, "tab", java.lang.Object.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateBrand(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.lang.String> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateBrand", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateCelebrity(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.lang.Object> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateCelebrity", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeInventoryScoreService extends br.com.fashionai.application.service.InventoryScoreService {
        FakeInventoryScoreService() {
            super((br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository) Fk.arg(br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository.class), (br.com.fashionai.domain.repository.WardrobeAvailabilityChangeRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeAvailabilityChangeRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.domain.repository.InventoryScoreSnapshotRepository) Fk.arg(br.com.fashionai.domain.repository.InventoryScoreSnapshotRepository.class), (br.com.fashionai.domain.repository.RankingOptInRepository) Fk.arg(br.com.fashionai.domain.repository.RankingOptInRepository.class), (br.com.fashionai.domain.repository.RankingPositionRepository) Fk.arg(br.com.fashionai.domain.repository.RankingPositionRepository.class), (br.com.fashionai.domain.repository.ChallengeTemplateRepository) Fk.arg(br.com.fashionai.domain.repository.ChallengeTemplateRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.service.RoomService) Fk.arg(br.com.fashionai.application.service.RoomService.class), (br.com.fashionai.application.service.AchievementService) Fk.arg(br.com.fashionai.application.service.AchievementService.class), (br.com.fashionai.application.events.SideEffectRunner) Fk.arg(br.com.fashionai.application.events.SideEffectRunner.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> album(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "album", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.service.InventoryScoreService.Result computeIsolated(java.util.UUID a0, boolean a1) {
            return (br.com.fashionai.application.service.InventoryScoreService.Result) Fk.call(this, "computeIsolated", br.com.fashionai.application.service.InventoryScoreService.Result.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.service.InventoryScoreService.Result compute(java.util.UUID a0, boolean a1) {
            return (br.com.fashionai.application.service.InventoryScoreService.Result) Fk.call(this, "compute", br.com.fashionai.application.service.InventoryScoreService.Result.class, new Object[]{a0, a1});
        }

        @Override
        public int dailySnapshots() {
            return (int) Fk.call(this, "dailySnapshots", int.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> describe() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "describe", java.util.Map.class, new Object[]{});
        }

        @Override
        public br.com.fashionai.application.service.InventoryScoreService.Dimension explain(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (br.com.fashionai.application.service.InventoryScoreService.Dimension) Fk.call(this, "explain", br.com.fashionai.application.service.InventoryScoreService.Dimension.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> highlightsTab(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "highlightsTab", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> improvementHints(java.util.UUID a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "improvementHints", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public void invalidate(br.com.fashionai.application.events.DomainEvents.AvailabilityChanged a0) {
            Fk.call(this, "invalidate", void.class, new Object[]{a0});
        }

        @Override
        public void invalidate(br.com.fashionai.application.events.DomainEvents.DailyLookRegistered a0) {
            Fk.call(this, "invalidate", void.class, new Object[]{a0});
        }

        @Override
        public void invalidate(br.com.fashionai.application.events.DomainEvents.PieceCreated a0) {
            Fk.call(this, "invalidate", void.class, new Object[]{a0});
        }

        @Override
        public void invalidate(br.com.fashionai.application.events.DomainEvents.PieceDeleted a0) {
            Fk.call(this, "invalidate", void.class, new Object[]{a0});
        }

        @Override
        public void invalidate(br.com.fashionai.application.events.DomainEvents.PieceUpdated a0) {
            Fk.call(this, "invalidate", void.class, new Object[]{a0});
        }

        @Override
        public void invalidate(br.com.fashionai.application.events.DomainEvents.RoomOrganized a0) {
            Fk.call(this, "invalidate", void.class, new Object[]{a0});
        }

        @Override
        public void invalidate(br.com.fashionai.application.events.DomainEvents.SchemeSaved a0) {
            Fk.call(this, "invalidate", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> optIn(br.com.fashionai.application.security.CurrentUser a0, boolean a1, boolean a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "optIn", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> rankings(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "rankings", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public int recomputeRankings() {
            return (int) Fk.call(this, "recomputeRankings", int.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> retrospective(br.com.fashionai.application.security.CurrentUser a0, int a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "retrospective", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeIssuerReviewService extends br.com.fashionai.application.service.IssuerReviewService {
        FakeIssuerReviewService() {
            super((br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (br.com.fashionai.application.ports.EmailSenderPort) Fk.arg(br.com.fashionai.application.ports.EmailSenderPort.class), (br.com.fashionai.application.events.SideEffectRunner) Fk.arg(br.com.fashionai.application.events.SideEffectRunner.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.service.IssuerVerificationPolicy) Fk.arg(br.com.fashionai.application.service.IssuerVerificationPolicy.class), (br.com.fashionai.application.service.SealService) Fk.arg(br.com.fashionai.application.service.SealService.class), (br.com.fashionai.application.ports.MediaStoragePort) Fk.arg(br.com.fashionai.application.ports.MediaStoragePort.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (java.lang.String) Fk.arg(java.lang.String.class), (java.lang.String) Fk.arg(java.lang.String.class));
        }

        @Override
        public boolean adminsConfigured() {
            return (boolean) Fk.call(this, "adminsConfigured", boolean.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> decide(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.IssuerReviewService.DecisionCommand a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "decide", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public byte[] document(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (byte[]) Fk.call(this, "document", byte[].class, new Object[]{a0, a1, a2});
        }

        @Override
        public void emailConfirmed(br.com.fashionai.domain.model.User a0) {
            Fk.call(this, "emailConfirmed", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> queue(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "queue", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> resubmit(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.IssuerReviewService.ResubmitCommand a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "resubmit", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> status(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "status", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public void submitted(java.util.UUID a0) {
            Fk.call(this, "submitted", void.class, new Object[]{a0});
        }
    }

    static final class FakeLookPreviewService extends br.com.fashionai.application.service.LookPreviewService {
        FakeLookPreviewService() {
            super((br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.application.hype.HypeQueryService) Fk.arg(br.com.fashionai.application.hype.HypeQueryService.class));
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> compositions(br.com.fashionai.application.security.CurrentUser a0, java.util.List<br.com.fashionai.application.ai.local.LocalSchemeComposer.Composition> a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "compositions", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> scores(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.LookPreviewService.PreviewRequest a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "scores", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeLookbookService extends br.com.fashionai.application.service.LookbookService {
        FakeLookbookService() {
            super((br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SavedItemRepository) Fk.arg(br.com.fashionai.domain.repository.SavedItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.AcervoGroupRepository) Fk.arg(br.com.fashionai.domain.repository.AcervoGroupRepository.class), (br.com.fashionai.domain.repository.SchemeGroupingRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeGroupingRepository.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.application.service.SocialService) Fk.arg(br.com.fashionai.application.service.SocialService.class), (br.com.fashionai.application.service.DailyLookService) Fk.arg(br.com.fashionai.application.service.DailyLookService.class), (br.com.fashionai.application.service.HypeScoreService) Fk.arg(br.com.fashionai.application.service.HypeScoreService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.service.OwnMedia) Fk.arg(br.com.fashionai.application.service.OwnMedia.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> assignToGrouping(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.List<java.util.UUID> a2, java.util.List<java.util.UUID> a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "assignToGrouping", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> capsule(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "capsule", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> createGrouping(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.LookbookService.GroupingForm a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "createGrouping", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> dailyLookTab(br.com.fashionai.application.security.CurrentUser a0, boolean a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "dailyLookTab", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public void deleteGrouping(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "deleteGrouping", void.class, new Object[]{a0, a1});
        }

        @Override
        public void discardGroup(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "discardGroup", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> favorite(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "favorite", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> favorites(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "favorites", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<br.com.fashionai.application.view.Views.SchemeView> groupingSchemes(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.List<br.com.fashionai.application.view.Views.SchemeView>) Fk.call(this, "groupingSchemes", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> groupingsOf(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "groupingsOf", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> groups(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "groups", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> markDailyLook(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "markDailyLook", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> overview(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "overview", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.view.Views.Page<java.util.Map<java.lang.String, java.lang.Object>> publications(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, int a2, int a3) {
            return (br.com.fashionai.application.view.Views.Page<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "publications", br.com.fashionai.application.view.Views.Page.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> removeSaved(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "removeSaved", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.view.Views.Page<java.util.Map<java.lang.String, java.lang.Object>> savedLooks(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, int a3, int a4) {
            return (br.com.fashionai.application.view.Views.Page<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "savedLooks", br.com.fashionai.application.view.Views.Page.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public br.com.fashionai.application.view.Views.Page<java.util.Map<java.lang.String, java.lang.Object>> savedLooks(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, int a2, int a3) {
            return (br.com.fashionai.application.view.Views.Page<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "savedLooks", br.com.fashionai.application.view.Views.Page.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.view.Views.Page<java.util.Map<java.lang.String, java.lang.Object>> savedPieces(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, int a2, int a3) {
            return (br.com.fashionai.application.view.Views.Page<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "savedPieces", br.com.fashionai.application.view.Views.Page.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setPanelVersion(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeScorePanelVersion a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setPanelVersion", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> suggestGroups(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "suggestGroups", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateGrouping(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.LookbookService.GroupingForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateGrouping", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeMetamorphoseInventoryService extends br.com.fashionai.application.service.MetamorphoseInventoryService {
        FakeMetamorphoseInventoryService() {
            super((br.com.fashionai.domain.repository.AuraArtOfferRepository) Fk.arg(br.com.fashionai.domain.repository.AuraArtOfferRepository.class), (br.com.fashionai.domain.repository.AuraIssuerLicenseRepository) Fk.arg(br.com.fashionai.domain.repository.AuraIssuerLicenseRepository.class), (br.com.fashionai.domain.repository.AtelierRewardGrantRepository) Fk.arg(br.com.fashionai.domain.repository.AtelierRewardGrantRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.List<br.com.fashionai.application.service.MetamorphoseInventoryService.Art> mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<br.com.fashionai.application.service.MetamorphoseInventoryService.Art>) Fk.call(this, "mine", java.util.List.class, new Object[]{a0});
        }

        @Override
        public void require(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<?, ?> a1) {
            Fk.call(this, "require", void.class, new Object[]{a0, a1});
        }
    }

    static final class FakeMirrorService extends br.com.fashionai.application.service.MirrorService {
        FakeMirrorService() {
            super((br.com.fashionai.domain.repository.MirrorStateRepository) Fk.arg(br.com.fashionai.domain.repository.MirrorStateRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.service.RoomService) Fk.arg(br.com.fashionai.application.service.RoomService.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.application.service.DailyLookService) Fk.arg(br.com.fashionai.application.service.DailyLookService.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class), (br.com.fashionai.application.hype.HypeQueryService) Fk.arg(br.com.fashionai.application.hype.HypeQueryService.class), (br.com.fashionai.domain.repository.TipoLookRepository) Fk.arg(br.com.fashionai.domain.repository.TipoLookRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> another(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "another", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> bring(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "bring", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> clear(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "clear", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> draft(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "draft", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<br.com.fashionai.domain.model.WardrobeItem> eligible(java.util.UUID a0) {
            return (java.util.List<br.com.fashionai.domain.model.WardrobeItem>) Fk.call(this, "eligible", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> grwmStoryboard(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "grwmStoryboard", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> place(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "place", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> remove(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "remove", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> save(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "save", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> state(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "state", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> suggest(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "suggest", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> swap(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "swap", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> takeOneOff(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "takeOneOff", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> unbring(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "unbring", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateTipoLook(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateTipoLook", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> useLook(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "useLook", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> vistaMe(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.util.List<java.util.UUID> a2, java.util.UUID a3, boolean a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "vistaMe", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> wardrobe(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "wardrobe", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeMultiPieceService extends br.com.fashionai.application.service.MultiPieceService {
        FakeMultiPieceService() {
            super((br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.PipelineJobRepository) Fk.arg(br.com.fashionai.domain.repository.PipelineJobRepository.class), (br.com.fashionai.application.imaging.FlatLayPipeline) Fk.arg(br.com.fashionai.application.imaging.FlatLayPipeline.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (java.util.List) Fk.arg(java.util.List.class), (java.util.List) Fk.arg(java.util.List.class), (br.com.fashionai.application.imaging.BrandReader) Fk.arg(br.com.fashionai.application.imaging.BrandReader.class));
        }

        @Override
        public br.com.fashionai.application.service.MultiPieceService.PieceDraft aiPieceDraft(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (br.com.fashionai.application.service.MultiPieceService.PieceDraft) Fk.call(this, "aiPieceDraft", br.com.fashionai.application.service.MultiPieceService.PieceDraft.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.service.MultiPieceService.PieceDetection detectPieces(java.util.UUID a0, java.awt.image.BufferedImage a1) {
            return (br.com.fashionai.application.service.MultiPieceService.PieceDetection) Fk.call(this, "detectPieces", br.com.fashionai.application.service.MultiPieceService.PieceDetection.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.service.MultiPieceService.Detection detect(br.com.fashionai.application.security.CurrentUser a0, byte[] a1) {
            return (br.com.fashionai.application.service.MultiPieceService.Detection) Fk.call(this, "detect", br.com.fashionai.application.service.MultiPieceService.Detection.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.service.MultiPieceService.PieceDraft pieceDraft(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.Integer a2, byte[] a3) {
            return (br.com.fashionai.application.service.MultiPieceService.PieceDraft) Fk.call(this, "pieceDraft", br.com.fashionai.application.service.MultiPieceService.PieceDraft.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.service.MultiPieceService.AiImage recreate(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.Integer a2, byte[] a3, java.lang.String a4, java.lang.String a5, java.lang.String a6) {
            return (br.com.fashionai.application.service.MultiPieceService.AiImage) Fk.call(this, "recreate", br.com.fashionai.application.service.MultiPieceService.AiImage.class, new Object[]{a0, a1, a2, a3, a4, a5, a6});
        }
    }

    static final class FakeNotificationService extends br.com.fashionai.application.service.NotificationService {
        FakeNotificationService() {
            super((br.com.fashionai.domain.repository.NotificationRepository) Fk.arg(br.com.fashionai.domain.repository.NotificationRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.application.ports.NotificationProjectionPort) Fk.arg(br.com.fashionai.application.ports.NotificationProjectionPort.class));
        }

        @Override
        public boolean enabled(java.util.UUID a0, br.com.fashionai.domain.model.enums.NotificationType a1) {
            return (boolean) Fk.call(this, "enabled", boolean.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> inbox(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "inbox", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public int markAllRead(br.com.fashionai.application.security.CurrentUser a0) {
            return (int) Fk.call(this, "markAllRead", int.class, new Object[]{a0});
        }

        @Override
        public void markRead(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1) {
            Fk.call(this, "markRead", void.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.domain.model.Notification notify(java.util.UUID a0, java.util.UUID a1, br.com.fashionai.domain.model.enums.NotificationType a2, java.lang.String a3, java.util.UUID a4, java.lang.String a5, java.lang.String a6, java.util.Map<java.lang.String, java.lang.Object> a7) {
            return (br.com.fashionai.domain.model.Notification) Fk.call(this, "notify", br.com.fashionai.domain.model.Notification.class, new Object[]{a0, a1, a2, a3, a4, a5, a6, a7});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> preferences(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "preferences", java.util.List.class, new Object[]{a0});
        }

        @Override
        public int purgeExpired() {
            return (int) Fk.call(this, "purgeExpired", int.class, new Object[]{});
        }

        @Override
        public long unread(br.com.fashionai.application.security.CurrentUser a0) {
            return (long) Fk.call(this, "unread", long.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> updatePreferences(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.lang.Boolean> a1, java.lang.Boolean a2) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "updatePreferences", java.util.List.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakePhotoService extends br.com.fashionai.application.service.PhotoService {
        FakePhotoService() {
            super((br.com.fashionai.domain.repository.PhotoRepository) Fk.arg(br.com.fashionai.domain.repository.PhotoRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> bulkDelete(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "bulkDelete", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> curate(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "curate", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> delete(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "delete", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public byte[] download(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (byte[]) Fk.call(this, "download", byte[].class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> gallery(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.PhotoInsights.Filter a1, int a2, int a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "gallery", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> insights(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "insights", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> list(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.PhotoOrigin a1, int a2, int a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "list", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> removeBackground(br.com.fashionai.application.security.CurrentUser a0, byte[] a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "removeBackground", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> saveEdit(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, byte[] a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "saveEdit", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setKeyMoment(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setKeyMoment", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> timeline(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "timeline", java.util.Map.class, new Object[]{a0});
        }
    }

    static final class FakePhysicalStoreService extends br.com.fashionai.application.service.PhysicalStoreService {
        FakePhysicalStoreService() {
            super((br.com.fashionai.domain.repository.PhysicalStoreListingRepository) Fk.arg(br.com.fashionai.domain.repository.PhysicalStoreListingRepository.class), (br.com.fashionai.domain.repository.PhysicalStoreOrderRepository) Fk.arg(br.com.fashionai.domain.repository.PhysicalStoreOrderRepository.class), (br.com.fashionai.domain.repository.CatalogProductRepository) Fk.arg(br.com.fashionai.domain.repository.CatalogProductRepository.class), (br.com.fashionai.domain.repository.BrandRepository) Fk.arg(br.com.fashionai.domain.repository.BrandRepository.class), (br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.catalog.CatalogService) Fk.arg(br.com.fashionai.application.catalog.CatalogService.class), (br.com.fashionai.application.service.WardrobeCreatorService) Fk.arg(br.com.fashionai.application.service.WardrobeCreatorService.class));
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> adminListings(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "adminListings", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> adminOrders(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "adminOrders", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> buy(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.PhysicalStoreService.OrderForm a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "buy", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> buy(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.PhysicalStoreService.OrderForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "buy", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void delete(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "delete", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "mine", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> myOrders(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "myOrders", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> save(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.PhysicalStoreService.ListingForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "save", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> sellerProducts(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "sellerProducts", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> store(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "store", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateShipment(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.PhysicalStoreService.ShipmentForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateShipment", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateStock(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.PhysicalStoreService.StockForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateStock", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakePreferencesService extends br.com.fashionai.application.service.PreferencesService {
        FakePreferencesService() {
            super((br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.application.assets.AssetCatalogService) Fk.arg(br.com.fashionai.application.assets.AssetCatalogService.class), (br.com.fashionai.application.service.IdentityService) Fk.arg(br.com.fashionai.application.service.IdentityService.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> changeUsername(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "changeUsername", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> checkUsername(java.lang.String a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "checkUsername", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> get(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "get", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> options() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "options", java.util.Map.class, new Object[]{});
        }

        @Override
        public br.com.fashionai.application.view.Views.UserCard rotateAvatar(br.com.fashionai.application.security.CurrentUser a0, int a1) {
            return (br.com.fashionai.application.view.Views.UserCard) Fk.call(this, "rotateAvatar", br.com.fashionai.application.view.Views.UserCard.class, new Object[]{a0, a1});
        }

        @Override
        public void setAuraPermissions(br.com.fashionai.application.service.AuraPermissionsService a0) {
            Fk.call(this, "setAuraPermissions", void.class, new Object[]{a0});
        }

        @Override
        public void setHypeCache(br.com.fashionai.application.hype.HypeCache a0) {
            Fk.call(this, "setHypeCache", void.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.view.Views.UserCard updateProfile(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.PreferencesService.ProfileUpdate a1) {
            return (br.com.fashionai.application.view.Views.UserCard) Fk.call(this, "updateProfile", br.com.fashionai.application.view.Views.UserCard.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> update(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.PreferencesService.Update a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "update", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.view.Views.UserCard uploadProfileImage(br.com.fashionai.application.security.CurrentUser a0, byte[] a1, boolean a2) {
            return (br.com.fashionai.application.view.Views.UserCard) Fk.call(this, "uploadProfileImage", br.com.fashionai.application.view.Views.UserCard.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeProfileService extends br.com.fashionai.application.service.ProfileService {
        FakeProfileService() {
            super((br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.FollowRepository) Fk.arg(br.com.fashionai.domain.repository.FollowRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> block(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "block", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> connections(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "connections", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> counters(java.util.UUID a0, long a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "counters", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> follow(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "follow", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> profile(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "profile", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> profile(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "profile", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> requests(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "requests", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> respond(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "respond", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void setLevelProgress(br.com.fashionai.application.service.LevelProgressService a0) {
            Fk.call(this, "setLevelProgress", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> unfollow(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "unfollow", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeRoomAssetService extends br.com.fashionai.application.service.RoomAssetService {
        FakeRoomAssetService() {
            super((br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.PipelineJobRepository) Fk.arg(br.com.fashionai.domain.repository.PipelineJobRepository.class), (br.com.fashionai.domain.repository.RoomCatalogItemRepository) Fk.arg(br.com.fashionai.domain.repository.RoomCatalogItemRepository.class), (br.com.fashionai.application.ports.MediaStoragePort) Fk.arg(br.com.fashionai.application.ports.MediaStoragePort.class), (br.com.fashionai.application.ports.WebFetchPort) Fk.arg(br.com.fashionai.application.ports.WebFetchPort.class), (java.util.List) Fk.arg(java.util.List.class), (org.springframework.transaction.support.TransactionTemplate) Fk.arg(org.springframework.transaction.support.TransactionTemplate.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> create(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.RoomAssetService.Command a1, byte[] a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "create", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> importMeshy(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.RoomAssetService.Command a1, byte[] a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "importMeshy", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> list(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "list", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> publish(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "publish", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> review(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "review", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void tick() {
            Fk.call(this, "tick", void.class, new Object[]{});
        }
    }

    static final class FakeRoomService extends br.com.fashionai.application.service.RoomService {
        FakeRoomService() {
            super((br.com.fashionai.domain.repository.RoomLayoutRepository) Fk.arg(br.com.fashionai.domain.repository.RoomLayoutRepository.class), (br.com.fashionai.domain.repository.RoomStorageEntryRepository) Fk.arg(br.com.fashionai.domain.repository.RoomStorageEntryRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.DailyLookRepository) Fk.arg(br.com.fashionai.domain.repository.DailyLookRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository) Fk.arg(br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository.class), (br.com.fashionai.domain.repository.UserAchievementRepository) Fk.arg(br.com.fashionai.domain.repository.UserAchievementRepository.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository) Fk.arg(br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class), (br.com.fashionai.application.events.SideEffectRunner) Fk.arg(br.com.fashionai.application.events.SideEffectRunner.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class), (br.com.fashionai.domain.repository.RoomInventoryItemRepository) Fk.arg(br.com.fashionai.domain.repository.RoomInventoryItemRepository.class), (br.com.fashionai.domain.repository.RoomCatalogItemRepository) Fk.arg(br.com.fashionai.domain.repository.RoomCatalogItemRepository.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class));
        }

        @Override
        public void applyFinish(java.util.UUID a0, java.lang.String a1, br.com.fashionai.domain.model.RoomCatalogItem a2) {
            Fk.call(this, "applyFinish", void.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> applyOrganization(br.com.fashionai.application.security.CurrentUser a0, java.util.Map<java.lang.String, java.lang.String> a1, java.util.List<java.util.Map<java.lang.String, java.lang.Object>> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "applyOrganization", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.room.RoomAddress autoAssign(java.util.UUID a0, java.util.UUID a1) {
            return (br.com.fashionai.application.room.RoomAddress) Fk.call(this, "autoAssign", br.com.fashionai.application.room.RoomAddress.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.lang.String> compatibleModules(java.util.UUID a0, br.com.fashionai.domain.model.RoomCatalogItem a1) {
            return (java.util.List<java.lang.String>) Fk.call(this, "compatibleModules", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> diaryEntry(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.time.LocalDate a2, java.lang.String a3, java.lang.String a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "diaryEntry", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.List<br.com.fashionai.domain.model.RoomStorageEntry> entries(java.util.UUID a0, java.util.List<br.com.fashionai.domain.model.WardrobeItem> a1) {
            return (java.util.List<br.com.fashionai.domain.model.RoomStorageEntry>) Fk.call(this, "entries", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> giveKey(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "giveKey", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public boolean hasKey(java.util.UUID a0, java.util.UUID a1) {
            return (boolean) Fk.call(this, "hasKey", boolean.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> island(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "island", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.util.UUID, java.time.LocalDate> lastDiaryDates(java.util.UUID a0, java.time.LocalDate a1) {
            return (java.util.Map<java.util.UUID, java.time.LocalDate>) Fk.call(this, "lastDiaryDates", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.domain.model.RoomLayout layout(java.util.UUID a0) {
            return (br.com.fashionai.domain.model.RoomLayout) Fk.call(this, "layout", br.com.fashionai.domain.model.RoomLayout.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.service.FaiPointsService.Level levelOf(java.util.UUID a0) {
            return (br.com.fashionai.application.service.FaiPointsService.Level) Fk.call(this, "levelOf", br.com.fashionai.application.service.FaiPointsService.Level.class, new Object[]{a0});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> listView(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "listView", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.util.UUID, br.com.fashionai.application.service.RoomService.Location> locateAll(java.util.UUID a0) {
            return (java.util.Map<java.util.UUID, br.com.fashionai.application.service.RoomService.Location>) Fk.call(this, "locateAll", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Optional<br.com.fashionai.application.service.RoomService.Location> locate(java.util.UUID a0, java.util.UUID a1) {
            return (java.util.Optional<br.com.fashionai.application.service.RoomService.Location>) Fk.call(this, "locate", java.util.Optional.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> move(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "move", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void onPieceCreated(br.com.fashionai.application.events.DomainEvents.PieceCreated a0) {
            Fk.call(this, "onPieceCreated", void.class, new Object[]{a0});
        }

        @Override
        public void onPieceDeleted(br.com.fashionai.application.events.DomainEvents.PieceDeleted a0) {
            Fk.call(this, "onPieceDeleted", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> open(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "open", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> organizePreview(br.com.fashionai.application.security.CurrentUser a0, boolean a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "organizePreview", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Set<java.util.UUID> outOfSeason(java.util.UUID a0) {
            return (java.util.Set<java.util.UUID>) Fk.call(this, "outOfSeason", java.util.Set.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> pieceTag(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "pieceTag", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.String> renameDrawer(br.com.fashionai.application.security.CurrentUser a0, int a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.String>) Fk.call(this, "renameDrawer", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> room(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "room", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> seasonStorage(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1, boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "seasonStorage", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void setLevel(java.util.UUID a0, java.lang.String a1) {
            Fk.call(this, "setLevel", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setLight(br.com.fashionai.application.security.CurrentUser a0, java.lang.Integer a1, java.lang.Double a2, java.lang.Boolean a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setLight", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setLight(br.com.fashionai.application.security.CurrentUser a0, int a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setLight", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setMonogram(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setMonogram", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> showInRoom(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "showInRoom", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> tour(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "tour", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> undoOrganization(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "undoOrganization", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Set<java.util.UUID> usedRecently(java.util.UUID a0, java.time.LocalDate a1) {
            return (java.util.Set<java.util.UUID>) Fk.call(this, "usedRecently", java.util.Set.class, new Object[]{a0, a1});
        }
    }

    static final class FakeSchemeService extends br.com.fashionai.application.service.SchemeService {
        FakeSchemeService() {
            super((br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.ReactionRepository) Fk.arg(br.com.fashionai.domain.repository.ReactionRepository.class), (br.com.fashionai.domain.repository.SavedItemRepository) Fk.arg(br.com.fashionai.domain.repository.SavedItemRepository.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.service.BackgroundStudioService) Fk.arg(br.com.fashionai.application.service.BackgroundStudioService.class), (br.com.fashionai.application.service.SealService) Fk.arg(br.com.fashionai.application.service.SealService.class), (br.com.fashionai.application.imaging.SchemeCardRenderer) Fk.arg(br.com.fashionai.application.imaging.SchemeCardRenderer.class), (br.com.fashionai.application.service.ProjectionService) Fk.arg(br.com.fashionai.application.service.ProjectionService.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.ports.CounterStorePort) Fk.arg(br.com.fashionai.application.ports.CounterStorePort.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (br.com.fashionai.application.service.DailyLookService) Fk.arg(br.com.fashionai.application.service.DailyLookService.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> applyDiff(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.Map<java.lang.String, java.lang.Object> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "applyDiff", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> archive(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "archive", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> builder(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "builder", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public boolean canView(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.Scheme a1) {
            return (boolean) Fk.call(this, "canView", boolean.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.service.SchemeService.ComposeResult compose(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.SchemeService.ComposeRequest a1, br.com.fashionai.application.ai.AiCapability a2) {
            return (br.com.fashionai.application.service.SchemeService.ComposeResult) Fk.call(this, "compose", br.com.fashionai.application.service.SchemeService.ComposeResult.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> create(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.SchemeService.SchemeForm a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "create", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> get(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "get", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> improve(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "improve", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public byte[] layoutPreview(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.List<br.com.fashionai.application.service.SchemeService.ItemForm> a2) {
            return (byte[]) Fk.call(this, "layoutPreview", byte[].class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.view.Views.Page<br.com.fashionai.application.view.Views.SchemeView> mine(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, java.lang.String a3, java.lang.String a4, java.lang.String a5, int a6, int a7) {
            return (br.com.fashionai.application.view.Views.Page<br.com.fashionai.application.view.Views.SchemeView>) Fk.call(this, "mine", br.com.fashionai.application.view.Views.Page.class, new Object[]{a0, a1, a2, a3, a4, a5, a6, a7});
        }

        @Override
        public br.com.fashionai.application.view.Views.Page<br.com.fashionai.application.view.Views.SchemeView> mine(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, java.lang.String a3, int a4, int a5) {
            return (br.com.fashionai.application.view.Views.Page<br.com.fashionai.application.view.Views.SchemeView>) Fk.call(this, "mine", br.com.fashionai.application.view.Views.Page.class, new Object[]{a0, a1, a2, a3, a4, a5});
        }

        @Override
        public br.com.fashionai.application.view.Views.Page<br.com.fashionai.application.view.Views.SchemeView> mine(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, int a3, int a4) {
            return (br.com.fashionai.application.view.Views.Page<br.com.fashionai.application.view.Views.SchemeView>) Fk.call(this, "mine", br.com.fashionai.application.view.Views.Page.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public br.com.fashionai.domain.model.Scheme owned(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.domain.model.Scheme) Fk.call(this, "owned", br.com.fashionai.domain.model.Scheme.class, new Object[]{a0, a1});
        }

        @Override
        public byte[] preview(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.SchemeService.SchemeForm a1) {
            return (byte[]) Fk.call(this, "preview", byte[].class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> publish(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.domain.model.enums.Visibility a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "publish", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> remix(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "remix", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public byte[] renderCard(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2) {
            return (byte[]) Fk.call(this, "renderCard", byte[].class, new Object[]{a0, a1, a2});
        }

        @Override
        public void requireView(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.Scheme a1) {
            Fk.call(this, "requireView", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> suggestSealsAfterSave(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "suggestSealsAfterSave", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> toggles(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.Boolean a2, java.lang.Boolean a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "toggles", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.view.Views.SchemeView updateLayout(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.List<br.com.fashionai.application.service.SchemeService.ItemForm> a2) {
            return (br.com.fashionai.application.view.Views.SchemeView) Fk.call(this, "updateLayout", br.com.fashionai.application.view.Views.SchemeView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> update(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.SchemeService.SchemeForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "update", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> uploadLookPhoto(br.com.fashionai.application.security.CurrentUser a0, byte[] a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "uploadLookPhoto", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.view.Views.SchemeView view(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.Scheme a1, java.util.List<br.com.fashionai.domain.model.SchemeItem> a2) {
            return (br.com.fashionai.application.view.Views.SchemeView) Fk.call(this, "view", br.com.fashionai.application.view.Views.SchemeView.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeSealDesignService extends br.com.fashionai.application.service.SealDesignService {
        FakeSealDesignService() {
            super((br.com.fashionai.application.ports.MediaStoragePort) Fk.arg(br.com.fashionai.application.ports.MediaStoragePort.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> catalog() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "catalog", java.util.Map.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> uploadCore(br.com.fashionai.application.security.CurrentUser a0, byte[] a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "uploadCore", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> upload(br.com.fashionai.application.security.CurrentUser a0, byte[] a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "upload", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeSealHypeOffersService extends br.com.fashionai.application.service.SealHypeOffersService {
        FakeSealHypeOffersService() {
            super((br.com.fashionai.application.service.SealService) Fk.arg(br.com.fashionai.application.service.SealService.class), (br.com.fashionai.domain.repository.SealRepository) Fk.arg(br.com.fashionai.domain.repository.SealRepository.class), (br.com.fashionai.domain.repository.SealBondRepository) Fk.arg(br.com.fashionai.domain.repository.SealBondRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> offers(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1, java.util.UUID a2, int a3, int a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "offers", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> request(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.HypeEntityType a1, java.util.UUID a2, java.util.UUID a3, java.lang.Boolean a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "request", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }
    }

    static final class FakeSealService extends br.com.fashionai.application.service.SealService {
        FakeSealService() {
            super((br.com.fashionai.domain.repository.SealRepository) Fk.arg(br.com.fashionai.domain.repository.SealRepository.class), (br.com.fashionai.domain.repository.SealBondRepository) Fk.arg(br.com.fashionai.domain.repository.SealBondRepository.class), (br.com.fashionai.domain.repository.PromotionRepository) Fk.arg(br.com.fashionai.domain.repository.PromotionRepository.class), (br.com.fashionai.domain.repository.PromotionRedemptionRepository) Fk.arg(br.com.fashionai.domain.repository.PromotionRedemptionRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class), (br.com.fashionai.application.service.OwnMedia) Fk.arg(br.com.fashionai.application.service.OwnMedia.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> accept(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.Boolean a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "accept", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> approvedBadges(java.util.UUID a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "approvedBadges", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> createAdminPromotion(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.SealService.PromotionForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "createAdminPromotion", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> createPromotion(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.SealService.PromotionForm a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "createPromotion", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> createSeal(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.SealService.SealForm a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "createSeal", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> draft(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.SealTier a1, java.lang.String a2, java.util.Map<java.lang.String, java.lang.Object> a3, java.util.List<br.com.fashionai.application.service.SealPolicyCopilot.Message> a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "draft", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> draft(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.SealTier a1, java.lang.String a2, java.util.Map<java.lang.String, java.lang.Object> a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "draft", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> draft(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.SealTier a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "draft", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<br.com.fashionai.domain.model.Promotion> eligiblePromotions(java.util.UUID a0) {
            return (java.util.List<br.com.fashionai.domain.model.Promotion>) Fk.call(this, "eligiblePromotions", java.util.List.class, new Object[]{a0});
        }

        @Override
        public void ensureDefaultSeals(br.com.fashionai.domain.model.User a0) {
            Fk.call(this, "ensureDefaultSeals", void.class, new Object[]{a0});
        }

        @Override
        public void flagRevalidation(br.com.fashionai.domain.model.Scheme a0) {
            Fk.call(this, "flagRevalidation", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> issuerMetrics(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "issuerMetrics", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> linkManually(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2, java.lang.Boolean a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "linkManually", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> mySeals(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "mySeals", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public void onPieceDeleted(br.com.fashionai.application.events.DomainEvents.PieceDeleted a0) {
            Fk.call(this, "onPieceDeleted", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> pieceSeals(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "pieceSeals", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> previewPiece(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.SealService.PieceFields a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "previewPiece", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> previewScheme(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "previewScheme", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> preview(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1, java.util.List<java.lang.String> a2, java.util.List<java.lang.String> a3, java.util.Map<java.lang.String, java.lang.Object> a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "preview", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> preview(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1, java.util.List<java.lang.String> a2, java.util.List<java.lang.String> a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "preview", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> promotionsOf(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "promotionsOf", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> redeem(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "redeem", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public int refuseAll(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (int) Fk.call(this, "refuseAll", int.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> refuse(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "refuse", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> requestHype(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.Seal a1, br.com.fashionai.domain.model.Scheme a2, br.com.fashionai.domain.model.WardrobeItem a3, java.lang.String a4, java.util.UUID a5, java.lang.Boolean a6) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "requestHype", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5, a6});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> reviewQueue(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "reviewQueue", java.util.List.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> review(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, boolean a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "review", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public void revokeForScheme(java.util.UUID a0, java.lang.String a1) {
            Fk.call(this, "revokeForScheme", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> revoke(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "revoke", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> sealsOf(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "sealsOf", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> sealsOf(java.util.UUID a0) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "sealsOf", java.util.List.class, new Object[]{a0});
        }

        @Override
        public void setHypeCache(br.com.fashionai.application.hype.HypeCache a0) {
            Fk.call(this, "setHypeCache", void.class, new Object[]{a0});
        }

        @Override
        public void setHypeQuery(org.springframework.beans.factory.ObjectProvider<br.com.fashionai.application.hype.HypeQueryService> a0) {
            Fk.call(this, "setHypeQuery", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> setPromotionStatus(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.domain.model.enums.PromotionStatus a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "setPromotionStatus", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void setSealPolicyContext(br.com.fashionai.domain.repository.AiInferenceLogRepository a0, br.com.fashionai.domain.repository.BrandRepository a1, br.com.fashionai.application.service.BackgroundStudioService a2) {
            Fk.call(this, "setSealPolicyContext", void.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> suggest(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "suggest", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updatePromotion(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.SealService.PromotionForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updatePromotion", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> updateSeal(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.SealService.SealForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "updateSeal", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeSearchService extends br.com.fashionai.application.service.SearchService {
        FakeSearchService() {
            super((br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (br.com.fashionai.domain.repository.FollowRepository) Fk.arg(br.com.fashionai.domain.repository.FollowRepository.class), (br.com.fashionai.domain.repository.ShareRepository) Fk.arg(br.com.fashionai.domain.repository.ShareRepository.class), (br.com.fashionai.domain.repository.SealBondRepository) Fk.arg(br.com.fashionai.domain.repository.SealBondRepository.class), (br.com.fashionai.domain.repository.StyleDnaRepository) Fk.arg(br.com.fashionai.domain.repository.StyleDnaRepository.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class), (org.springframework.beans.factory.ObjectProvider) Fk.arg(org.springframework.beans.factory.ObjectProvider.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.application.service.ChallengeService) Fk.arg(br.com.fashionai.application.service.ChallengeService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.domain.repository.BrandRepository) Fk.arg(br.com.fashionai.domain.repository.BrandRepository.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> communityFeed(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, int a2, br.com.fashionai.application.service.SearchService.Filters a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "communityFeed", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> publicPieces(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.SearchService.Filters a1, java.lang.String a2, int a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "publicPieces", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> runway(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, int a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "runway", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> search(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, br.com.fashionai.application.service.SearchService.Filters a3, int a4, java.lang.String a5) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "search", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> search(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.lang.String a2, br.com.fashionai.application.service.SearchService.Filters a3, int a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "search", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }
    }

    static final class FakeShowcaseService extends br.com.fashionai.application.service.ShowcaseService {
        FakeShowcaseService() {
            super((br.com.fashionai.domain.repository.FollowRepository) Fk.arg(br.com.fashionai.domain.repository.FollowRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.SchemeGroupingRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeGroupingRepository.class), (br.com.fashionai.domain.repository.DailyLookRepository) Fk.arg(br.com.fashionai.domain.repository.DailyLookRepository.class), (br.com.fashionai.application.service.DailyLookService) Fk.arg(br.com.fashionai.application.service.DailyLookService.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.application.service.InstitutionalService) Fk.arg(br.com.fashionai.application.service.InstitutionalService.class), (br.com.fashionai.application.service.Model3dService) Fk.arg(br.com.fashionai.application.service.Model3dService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.service.Avatar3dService) Fk.arg(br.com.fashionai.application.service.Avatar3dService.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class));
        }

        @Override
        public void deleteMannequinPhoto(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.util.UUID a2) {
            Fk.call(this, "deleteMannequinPhoto", void.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> groupingCover(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, byte[] a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "groupingCover", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> insights(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.service.ShowcaseService.Kind a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "insights", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> items(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.service.ShowcaseService.Kind a2, java.util.UUID a3, java.lang.String a4, java.lang.String a5, java.lang.String a6, java.lang.Integer a7) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "items", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4, a5, a6, a7});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> list(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.service.ShowcaseService.Kind a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "list", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> look3d(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "look3d", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> piece3d(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "piece3d", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> pieceMannequinPhoto(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, byte[] a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "pieceMannequinPhoto", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> requestModels(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "requestModels", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> runway(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.ShowcaseService.RunwayFilter a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "runway", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> runway(br.com.fashionai.application.security.CurrentUser a0, java.lang.Integer a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "runway", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> schemeMannequinPhoto(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, byte[] a2, boolean a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "schemeMannequinPhoto", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> stage(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "stage", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeSocialService extends br.com.fashionai.application.service.SocialService {
        FakeSocialService() {
            super((br.com.fashionai.domain.repository.ReactionRepository) Fk.arg(br.com.fashionai.domain.repository.ReactionRepository.class), (br.com.fashionai.domain.repository.CommentRepository) Fk.arg(br.com.fashionai.domain.repository.CommentRepository.class), (br.com.fashionai.domain.repository.SavedItemRepository) Fk.arg(br.com.fashionai.domain.repository.SavedItemRepository.class), (br.com.fashionai.domain.repository.ShareRepository) Fk.arg(br.com.fashionai.domain.repository.ShareRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.DnaSchemeRepository) Fk.arg(br.com.fashionai.domain.repository.DnaSchemeRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.ports.CounterStorePort) Fk.arg(br.com.fashionai.application.ports.CounterStorePort.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> comment(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TargetType a1, java.util.UUID a2, java.lang.String a3, java.util.UUID a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "comment", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> comments(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TargetType a1, java.util.UUID a2) {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "comments", java.util.List.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> counters(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TargetType a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "counters", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void deleteComment(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "deleteComment", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> favoriteSaved(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TargetType a1, java.util.UUID a2, boolean a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "favoriteSaved", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> react(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TargetType a1, java.util.UUID a2, br.com.fashionai.domain.model.enums.ReactionType a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "react", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> remix(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TargetType a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "remix", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> returnToOrigin(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "returnToOrigin", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> share(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TargetType a1, java.util.UUID a2, br.com.fashionai.domain.model.enums.ShareChannel a3, boolean a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "share", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> share(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TargetType a1, java.util.UUID a2, br.com.fashionai.domain.model.enums.ShareChannel a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "share", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> toggleSave(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.TargetType a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "toggleSave", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeTryOnPersonPhotoService extends br.com.fashionai.application.service.TryOnPersonPhotoService {
        FakeTryOnPersonPhotoService() {
            super((br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> upload(br.com.fashionai.application.security.CurrentUser a0, byte[] a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "upload", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeTryOnService extends br.com.fashionai.application.service.TryOnService {
        FakeTryOnService() {
            super((br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.UserPreferencesRepository) Fk.arg(br.com.fashionai.domain.repository.UserPreferencesRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.application.service.WardrobeService) Fk.arg(br.com.fashionai.application.service.WardrobeService.class), (br.com.fashionai.application.service.SchemeService) Fk.arg(br.com.fashionai.application.service.SchemeService.class), (br.com.fashionai.application.imaging.TryOnCompositor) Fk.arg(br.com.fashionai.application.imaging.TryOnCompositor.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.assets.AssetCatalogService) Fk.arg(br.com.fashionai.application.assets.AssetCatalogService.class), (br.com.fashionai.application.service.Avatar3dService) Fk.arg(br.com.fashionai.application.service.Avatar3dService.class), (br.com.fashionai.application.service.OwnMedia) Fk.arg(br.com.fashionai.application.service.OwnMedia.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> render(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.MannequinSex a1, java.util.List<java.util.UUID> a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "render", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> saveAsScheme(br.com.fashionai.application.security.CurrentUser a0, java.util.List<java.util.UUID> a1, java.lang.String a2, java.lang.String a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "saveAsScheme", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> savePreferences(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.MannequinSex a1, java.lang.String a2, br.com.fashionai.domain.model.enums.BodyBuild a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "savePreferences", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> state(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.enums.MannequinSex a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "state", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeVtonBackendAnnotationService extends br.com.fashionai.application.service.VtonBackendAnnotationService {
        FakeVtonBackendAnnotationService() {
            super((br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (java.lang.String) Fk.arg(java.lang.String.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> annotate(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.VtonBackendAnnotationService.Request a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "annotate", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeWardrobeCreatorService extends br.com.fashionai.application.service.WardrobeCreatorService {
        FakeWardrobeCreatorService() {
            super((br.com.fashionai.domain.repository.RoomCatalogItemRepository) Fk.arg(br.com.fashionai.domain.repository.RoomCatalogItemRepository.class), (br.com.fashionai.domain.repository.RoomInventoryItemRepository) Fk.arg(br.com.fashionai.domain.repository.RoomInventoryItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.domain.repository.CelebrityProfileRepository) Fk.arg(br.com.fashionai.domain.repository.CelebrityProfileRepository.class), (br.com.fashionai.domain.repository.SealRepository) Fk.arg(br.com.fashionai.domain.repository.SealRepository.class), (br.com.fashionai.domain.repository.SealBondRepository) Fk.arg(br.com.fashionai.domain.repository.SealBondRepository.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class));
        }

        @Override
        public java.lang.String blocker(java.util.UUID a0, br.com.fashionai.domain.model.RoomCatalogItem a1) {
            return (java.lang.String) Fk.call(this, "blocker", java.lang.String.class, new Object[]{a0, a1});
        }

        @Override
        public void delete(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            Fk.call(this, "delete", void.class, new Object[]{a0, a1});
        }

        @Override
        public boolean hasSeal(java.util.UUID a0, br.com.fashionai.domain.model.RoomCatalogItem a1) {
            return (boolean) Fk.call(this, "hasSeal", boolean.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> identity(br.com.fashionai.domain.model.User a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "identity", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> mine(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "mine", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public void onStart(org.springframework.context.event.ContextRefreshedEvent a0) {
            Fk.call(this, "onStart", void.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> options(br.com.fashionai.application.security.CurrentUser a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "options", java.util.Map.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> save(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1, br.com.fashionai.application.service.WardrobeCreatorService.ItemForm a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "save", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public int seedFactory() {
            return (int) Fk.call(this, "seedFactory", int.class, new Object[]{});
        }

        @Override
        public boolean sellerActive(br.com.fashionai.domain.model.RoomCatalogItem a0) {
            return (boolean) Fk.call(this, "sellerActive", boolean.class, new Object[]{a0});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> uploadArt(br.com.fashionai.application.security.CurrentUser a0, byte[] a1, java.lang.String a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "uploadArt", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> view(br.com.fashionai.domain.model.RoomCatalogItem a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "view", java.util.Map.class, new Object[]{a0, a1});
        }
    }

    static final class FakeWardrobeService extends br.com.fashionai.application.service.WardrobeService {
        FakeWardrobeService() {
            super((br.com.fashionai.domain.repository.WardrobeItemRepository) Fk.arg(br.com.fashionai.domain.repository.WardrobeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.BrandRepository) Fk.arg(br.com.fashionai.domain.repository.BrandRepository.class), (br.com.fashionai.domain.repository.PipelineJobRepository) Fk.arg(br.com.fashionai.domain.repository.PipelineJobRepository.class), (br.com.fashionai.domain.repository.ProcessingJobLogRepository) Fk.arg(br.com.fashionai.domain.repository.ProcessingJobLogRepository.class), (br.com.fashionai.domain.repository.QualityScoreRepository) Fk.arg(br.com.fashionai.domain.repository.QualityScoreRepository.class), (br.com.fashionai.domain.repository.ModerationQueueRepository) Fk.arg(br.com.fashionai.domain.repository.ModerationQueueRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.SchemeRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeRepository.class), (br.com.fashionai.domain.repository.ReactionRepository) Fk.arg(br.com.fashionai.domain.repository.ReactionRepository.class), (br.com.fashionai.domain.repository.SavedItemRepository) Fk.arg(br.com.fashionai.domain.repository.SavedItemRepository.class), (br.com.fashionai.domain.repository.PhotoRepository) Fk.arg(br.com.fashionai.domain.repository.PhotoRepository.class), (br.com.fashionai.application.imaging.FlatLayPipeline) Fk.arg(br.com.fashionai.application.imaging.FlatLayPipeline.class), (br.com.fashionai.application.ai.AiEngine) Fk.arg(br.com.fashionai.application.ai.AiEngine.class), (br.com.fashionai.application.service.MediaService) Fk.arg(br.com.fashionai.application.service.MediaService.class), (br.com.fashionai.application.assets.AssetCatalogService) Fk.arg(br.com.fashionai.application.assets.AssetCatalogService.class), (br.com.fashionai.application.service.ProjectionService) Fk.arg(br.com.fashionai.application.service.ProjectionService.class), (br.com.fashionai.application.service.NotificationService) Fk.arg(br.com.fashionai.application.service.NotificationService.class), (br.com.fashionai.application.ports.JobQueuePort) Fk.arg(br.com.fashionai.application.ports.JobQueuePort.class), (br.com.fashionai.application.service.Model3dService) Fk.arg(br.com.fashionai.application.service.Model3dService.class), (br.com.fashionai.application.imaging.StudioPipeline) Fk.arg(br.com.fashionai.application.imaging.StudioPipeline.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (br.com.fashionai.application.audit.Audit) Fk.arg(br.com.fashionai.application.audit.Audit.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class), (br.com.fashionai.application.service.BrandLogoService) Fk.arg(br.com.fashionai.application.service.BrandLogoService.class), (br.com.fashionai.domain.repository.BrandProfileRepository) Fk.arg(br.com.fashionai.domain.repository.BrandProfileRepository.class), (br.com.fashionai.application.assets.PieceReferenceCatalog) Fk.arg(br.com.fashionai.application.assets.PieceReferenceCatalog.class), (br.com.fashionai.application.service.OwnMedia) Fk.arg(br.com.fashionai.application.service.OwnMedia.class), (br.com.fashionai.domain.repository.HypeScoreCurrentRepository) Fk.arg(br.com.fashionai.domain.repository.HypeScoreCurrentRepository.class), (br.com.fashionai.application.hype.HypeScoreConfig) Fk.arg(br.com.fashionai.application.hype.HypeScoreConfig.class));
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView addToWardrobe(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "addToWardrobe", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<br.com.fashionai.application.service.WardrobeService.Draft> analyzeBatch(br.com.fashionai.application.security.CurrentUser a0, java.util.List<byte[]> a1, java.lang.String a2) {
            return (java.util.List<br.com.fashionai.application.service.WardrobeService.Draft>) Fk.call(this, "analyzeBatch", java.util.List.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.List<br.com.fashionai.application.service.WardrobeService.Draft> analyzeBatch(br.com.fashionai.application.security.CurrentUser a0, java.util.List<byte[]> a1) {
            return (java.util.List<br.com.fashionai.application.service.WardrobeService.Draft>) Fk.call(this, "analyzeBatch", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.service.WardrobeService.CaptureAnalysis analyzeForCapture(br.com.fashionai.application.security.CurrentUser a0, byte[] a1, java.lang.String a2, boolean a3) {
            return (br.com.fashionai.application.service.WardrobeService.CaptureAnalysis) Fk.call(this, "analyzeForCapture", br.com.fashionai.application.service.WardrobeService.CaptureAnalysis.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.service.WardrobeService.Draft analyze(br.com.fashionai.application.security.CurrentUser a0, byte[] a1, java.lang.String a2) {
            return (br.com.fashionai.application.service.WardrobeService.Draft) Fk.call(this, "analyze", br.com.fashionai.application.service.WardrobeService.Draft.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.service.WardrobeService.Draft analyze(br.com.fashionai.application.security.CurrentUser a0, byte[] a1) {
            return (br.com.fashionai.application.service.WardrobeService.Draft) Fk.call(this, "analyze", br.com.fashionai.application.service.WardrobeService.Draft.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView approveStudio(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "approveStudio", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1});
        }

        @Override
        public void backfillDefaultStudio() {
            Fk.call(this, "backfillDefaultStudio", void.class, new Object[]{});
        }

        @Override
        public br.com.fashionai.application.view.Views.Page<br.com.fashionai.application.view.Views.PieceView> closet(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.WardrobeService.ClosetFilter a2) {
            return (br.com.fashionai.application.view.Views.Page<br.com.fashionai.application.view.Views.PieceView>) Fk.call(this, "closet", br.com.fashionai.application.view.Views.Page.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.List<br.com.fashionai.application.view.Views.PieceView> createBatch(br.com.fashionai.application.security.CurrentUser a0, java.util.List<br.com.fashionai.application.service.WardrobeService.PieceForm> a1) {
            return (java.util.List<br.com.fashionai.application.view.Views.PieceView>) Fk.call(this, "createBatch", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView createFromCatalog(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.WardrobeService.PieceForm a1, br.com.fashionai.application.service.WardrobeService.CatalogPick a2) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "createFromCatalog", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView create(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.application.service.WardrobeService.PieceForm a1) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "create", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> delete(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "delete", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> deletionImpact(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "deletionImpact", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> detail(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.util.UUID a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "detail", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView discardStudio(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "discardStudio", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<br.com.fashionai.domain.model.WardrobeItem> eligible(java.util.UUID a0) {
            return (java.util.List<br.com.fashionai.domain.model.WardrobeItem>) Fk.call(this, "eligible", java.util.List.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.ai.AiEngine.RemoteStep<br.com.fashionai.application.imaging.FlatLayPipeline.Result> flatLayStep(byte[] a0) {
            return (br.com.fashionai.application.ai.AiEngine.RemoteStep<br.com.fashionai.application.imaging.FlatLayPipeline.Result>) Fk.call(this, "flatLayStep", br.com.fashionai.application.ai.AiEngine.RemoteStep.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.imaging.FlatLayPipeline.Result governedFlatLay(java.util.UUID a0, byte[] a1) {
            return (br.com.fashionai.application.imaging.FlatLayPipeline.Result) Fk.call(this, "governedFlatLay", br.com.fashionai.application.imaging.FlatLayPipeline.Result.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView markWorn(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "markWorn", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.domain.model.WardrobeItem owned(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (br.com.fashionai.domain.model.WardrobeItem) Fk.call(this, "owned", br.com.fashionai.domain.model.WardrobeItem.class, new Object[]{a0, a1});
        }

        @Override
        public void publishForFeed(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            Fk.call(this, "publishForFeed", void.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Long> reactionCounts(br.com.fashionai.domain.model.enums.TargetType a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Long>) Fk.call(this, "reactionCounts", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> removeBackground(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "removeBackground", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView replaceImage(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, byte[] a2, java.util.UUID a3) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "replaceImage", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public int reprocessPending() {
            return (int) Fk.call(this, "reprocessPending", int.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> request3d(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "request3d", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> retryBrand(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, int a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "retryBrand", java.util.Map.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> status3d(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "status3d", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> studioAll(br.com.fashionai.application.security.CurrentUser a0, java.lang.String a1) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "studioAll", java.util.Map.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<java.util.Map<java.lang.String, java.lang.Object>> studioBackdrops() {
            return (java.util.List<java.util.Map<java.lang.String, java.lang.Object>>) Fk.call(this, "studioBackdrops", java.util.List.class, new Object[]{});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> studioDraft(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2, boolean a3) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "studioDraft", java.util.Map.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView studioPiece(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.String a2) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "studioPiece", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> taxonomy() {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "taxonomy", java.util.Map.class, new Object[]{});
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView toggles(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.Boolean a2, java.lang.Boolean a3, java.lang.Boolean a4, java.lang.Boolean a5) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "toggles", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1, a2, a3, a4, a5});
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView toggles(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, java.lang.Boolean a2, java.lang.Boolean a3, java.lang.Boolean a4) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "toggles", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public br.com.fashionai.application.view.Views.PieceView update(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.WardrobeService.PieceForm a2) {
            return (br.com.fashionai.application.view.Views.PieceView) Fk.call(this, "update", br.com.fashionai.application.view.Views.PieceView.class, new Object[]{a0, a1, a2});
        }

        @Override
        public void useDefaultImageAfterPhotoDeletion(br.com.fashionai.domain.model.WardrobeItem a0) {
            Fk.call(this, "useDefaultImageAfterPhotoDeletion", void.class, new Object[]{a0});
        }

        @Override
        public br.com.fashionai.application.view.Views.ViewerState viewerState(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.WardrobeItem a1) {
            return (br.com.fashionai.application.view.Views.ViewerState) Fk.call(this, "viewerState", br.com.fashionai.application.view.Views.ViewerState.class, new Object[]{a0, a1});
        }
    }
}

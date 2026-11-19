package br.com.fashionai.web.controller;

/**
 * Dublês dos serviços do Look do Dia (Look do Dia Vivido F1), no mesmo molde de {@link ServiceFakes}: cada método público
 * registra a chamada em {@link Fk}. Separados do arquivo gerado para ele não crescer (docs/refactoring/LINE_RULES.md);
 * {@link Fk#FAKES} e o ControllerDelegacaoTest procuram os dublês nos dois arquivos.
 */
@SuppressWarnings({"unchecked", "rawtypes"})
final class ServiceFakesLookDoDia {
    private ServiceFakesLookDoDia() {
    }

    static final class FakeDailyLookCalendarService extends br.com.fashionai.application.service.DailyLookCalendarService {
        FakeDailyLookCalendarService() {
            super((br.com.fashionai.domain.repository.DailyLookRepository) Fk.arg(br.com.fashionai.domain.repository.DailyLookRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.application.service.DailyLookService) Fk.arg(br.com.fashionai.application.service.DailyLookService.class), (br.com.fashionai.application.moments.MomentDays) Fk.arg(br.com.fashionai.application.moments.MomentDays.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> calendar(br.com.fashionai.application.security.CurrentUser a0, int a1, java.lang.Integer a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "calendar", java.util.Map.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeDailyLookContextService extends br.com.fashionai.application.service.DailyLookContextService {
        FakeDailyLookContextService() {
            super((br.com.fashionai.domain.repository.WeekPlanRepository) Fk.arg(br.com.fashionai.domain.repository.WeekPlanRepository.class), (br.com.fashionai.domain.repository.WeekPlanDayRepository) Fk.arg(br.com.fashionai.domain.repository.WeekPlanDayRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.service.WeatherService) Fk.arg(br.com.fashionai.application.service.WeatherService.class), (br.com.fashionai.application.moments.MomentDays) Fk.arg(br.com.fashionai.application.moments.MomentDays.class));
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> suggest(br.com.fashionai.application.security.CurrentUser a0, java.time.LocalDate a1, java.lang.Double a2, java.lang.Double a3, java.lang.String a4) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "suggest", java.util.Map.class, new Object[]{a0, a1, a2, a3, a4});
        }

        @Override
        public void freeze(br.com.fashionai.domain.model.DailyLook a0, br.com.fashionai.application.service.DailyLookContext a1, br.com.fashionai.application.security.CurrentUser a2, java.time.LocalDate a3) {
            Fk.call(this, "freeze", void.class, new Object[]{a0, a1, a2, a3});
        }

        @Override
        public java.util.Map<java.lang.String, java.lang.Object> view(br.com.fashionai.domain.model.DailyLook a0) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "view", java.util.Map.class, new Object[]{a0});
        }
    }

    static final class FakeMomentDays extends br.com.fashionai.application.moments.MomentDays {
        FakeMomentDays() {
            super((br.com.fashionai.domain.repository.MomentRepository) Fk.arg(br.com.fashionai.domain.repository.MomentRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.domain.repository.FlairTeamMemberRepository) Fk.arg(br.com.fashionai.domain.repository.FlairTeamMemberRepository.class));
        }

        @Override
        public java.util.List<br.com.fashionai.domain.model.Moment> on(br.com.fashionai.application.security.CurrentUser a0, java.time.LocalDate a1) {
            return (java.util.List<br.com.fashionai.domain.model.Moment>) Fk.call(this, "on", java.util.List.class, new Object[]{a0, a1});
        }

        @Override
        public java.util.List<br.com.fashionai.domain.model.Moment> visibleBetween(br.com.fashionai.application.security.CurrentUser a0, java.time.LocalDate a1, java.time.LocalDate a2) {
            return (java.util.List<br.com.fashionai.domain.model.Moment>) Fk.call(this, "visibleBetween", java.util.List.class, new Object[]{a0, a1, a2});
        }
    }

    static final class FakeDailyLookService extends br.com.fashionai.application.service.DailyLookService {
        FakeDailyLookService() {
            super((br.com.fashionai.domain.repository.DailyLookRepository) Fk.arg(br.com.fashionai.domain.repository.DailyLookRepository.class), (br.com.fashionai.domain.repository.SchemeItemRepository) Fk.arg(br.com.fashionai.domain.repository.SchemeItemRepository.class), (br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), (br.com.fashionai.application.security.Guard) Fk.arg(br.com.fashionai.application.security.Guard.class), (org.springframework.context.ApplicationEventPublisher) Fk.arg(org.springframework.context.ApplicationEventPublisher.class), (br.com.fashionai.application.service.DailyLookContextService) Fk.arg(br.com.fashionai.application.service.DailyLookContextService.class));
        }

        @Override
        public br.com.fashionai.domain.model.DailyLook register(br.com.fashionai.application.security.CurrentUser a0, br.com.fashionai.domain.model.Scheme a1, br.com.fashionai.domain.model.enums.DailyLookSource a2, java.time.LocalDate a3, br.com.fashionai.application.service.DailyLookContext a4) {
            return (br.com.fashionai.domain.model.DailyLook) Fk.call(this, "register", br.com.fashionai.domain.model.DailyLook.class, new Object[]{a0, a1, a2, a3, a4});
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
        public java.util.Map<java.lang.String, java.lang.Object> markDailyLook(br.com.fashionai.application.security.CurrentUser a0, java.util.UUID a1, br.com.fashionai.application.service.DailyLookContext a2) {
            return (java.util.Map<java.lang.String, java.lang.Object>) Fk.call(this, "markDailyLook", java.util.Map.class, new Object[]{a0, a1, a2});
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
}

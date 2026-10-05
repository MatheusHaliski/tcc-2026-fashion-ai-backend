package br.com.fashionai.application.service;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.hype.HypeCache;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF53 · Lote Final (P3-12) — a opção "Não aparecer em Criadores em alta" nas preferências: aparece no GET, troca no PUT
 * (campo aditivo {@code hypeCreatorOptOut}), invalida o cache do Hype (nova geração) só quando muda e depois do commit, e
 * vai na exportação LGPD junto das demais preferências.
 */
class CreatorOptOutPreferencesTest {
    private final UUID uid = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private UserPreferencesRepository preferences;
    private HypeCache hypeCache;
    private PreferencesService service;
    private UserPreferences prefs;
    private User user;

    static PreferencesService.Update optOut(Boolean value) {
        return new PreferencesService.Update(null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                Instant.now(), null, null, null, null, value);
    }

    @BeforeEach
    void setUp() {
        user = new User();
        user.assignId(uid);
        user.setUsername("ana");
        user.setDisplayName("Ana");
        user.setProfileType(ProfileType.PESSOAL);
        prefs = new UserPreferences(user);
        preferences = mock(UserPreferencesRepository.class);
        when(preferences.findByUserId(uid)).thenReturn(Optional.of(prefs));
        hypeCache = mock(HypeCache.class);
        service = new PreferencesService(mock(UserRepository.class), preferences, mock(AssetCatalogService.class), mock(IdentityService.class),
                mock(MediaService.class), mock(Guard.class), new Audit(e -> { }));
        service.setHypeCache(hypeCache);
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void desligadoPorPadraoEVisivelNoGet() {
        assertThat(service.get(me)).containsEntry("hypeCreatorOptOut", false);
    }

    @Test
    void ligarEDesligarTrocaAPreferenciaEInvalidaOCacheDoHype() {
        Map<String, Object> on = service.update(me, optOut(true));
        assertThat(on).containsEntry("hypeCreatorOptOut", true);
        assertThat(prefs.isHypeCreatorOptOut()).isTrue();
        verify(hypeCache, times(1)).bump();

        Map<String, Object> off = service.update(me, optOut(false));
        assertThat(off).containsEntry("hypeCreatorOptOut", false);
        verify(hypeCache, times(2)).bump();
    }

    @Test
    void semMudancaOuSemOCampoNaoMexeNoCache() {
        service.update(me, optOut(false));             // já estava desligado
        service.update(me, optOut(null));              // outra preferência qualquer: campo ausente
        assertThat(prefs.isHypeCreatorOptOut()).isFalse();
        verify(hypeCache, never()).bump();
    }

    @Test
    void comTransacaoANovaGeracaoSoVemDepoisDoCommit() {
        TransactionSynchronizationManager.initSynchronization();
        service.update(me, optOut(true));
        verify(hypeCache, never()).bump();             // antes do commit, quem lê ainda vê o estado antigo no banco e no cache
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(hypeCache, times(1)).bump();
    }

    @Test
    @SuppressWarnings("unchecked")
    void exportacaoLgpdLevaAOpcao() {
        prefs.setHypeCreatorOptOut(true);
        AccountService account = new AccountService(mock(UserRepository.class), preferences, mock(UserConsentRepository.class), mock(VerificationCodeRepository.class),
                mock(DataExportRequestRepository.class), mock(WardrobeItemRepository.class), mock(SchemeRepository.class), mock(SchemeItemRepository.class),
                mock(CommentRepository.class), mock(ReactionRepository.class), mock(SavedItemRepository.class), mock(FollowRepository.class), mock(PhotoRepository.class),
                mock(NotificationRepository.class), mock(DnaSchemeRepository.class), mock(StyleDnaRepository.class), mock(AiInferenceLogRepository.class),
                mock(BrandProfileRepository.class), mock(CelebrityProfileRepository.class), mock(IdentityService.class), null, null, null,
                new Audit(e -> { }), mock(Avatar3dService.class), null, HypeScoreConfig.defaults(), mock(HypeScoreCurrentRepository.class),
                mock(HypeScoreSnapshotRepository.class), mock(HypeMilestoneRepository.class));
        Map<String, Object> data = account.exportData(user);
        assertThat((Map<String, Object>) data.get("preferences")).containsEntry("hypeCreatorOptOut", true);
    }
}

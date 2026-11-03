package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.lens.LensService;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.privacy.AccountDataCleanup;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ConsentPurpose;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.AiInferenceLogRepository;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.CommentRepository;
import br.com.fashionai.domain.repository.DataExportRequestRepository;
import br.com.fashionai.domain.repository.DnaSchemeRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeMilestoneRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.PhotoRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserConsentRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF3 + RNF6 (LGPD): dados pessoais com reautenticação, confirmação de e-mail, transparência de finalidade,
 * exportação em JSON, exclusão com carência de 30 dias, consentimento granular por finalidade (nada
 * pré-marcado, revogação com o mesmo esforço da concessão — art. 8º §5º), visibilidade do perfil.
 * <p>
 * Fachada (Facade) sobre os casos de uso em colaboradores package-private (consentimentos, dados sensíveis,
 * exportação, exclusão e anonimização), onde fica o detalhe de cada regra; transações e agendamento ficam aqui.
 */
@Service
public class AccountService {
    public static final Duration DELETION_GRACE = Duration.ofDays(30);
    public static final Duration EXPORT_TTL = Duration.ofDays(7);

    /** Finalidades, base legal e artigo exibidos em cada controle da seção Privacidade (artefato #6). */
    public static final Map<ConsentPurpose, String[]> PURPOSES = AccountConsentPurposes.PURPOSES;

    private final AccountProfileView profile;
    private final AccountSettings settings;
    private final AccountConsents consents;
    private final AccountExports exports;
    private final AccountExportData dataPackage;
    private final AccountDeletion deletion;
    private final AccountAnonymizer anonymizer;
    @Autowired(required = false)
    private List<AccountDataCleanup> accountDataCleanup = List.of();

    public AccountService(UserRepository users, UserPreferencesRepository preferences, UserConsentRepository consents,
                          VerificationCodeRepository codes, DataExportRequestRepository exports, WardrobeItemRepository pieces,
                          SchemeRepository schemes, SchemeItemRepository schemeItems, CommentRepository comments,
                          ReactionRepository reactions, SavedItemRepository saved, FollowRepository follows,
                          PhotoRepository photos, NotificationRepository notificationRepository, DnaSchemeRepository dnaSchemes,
                          StyleDnaRepository styleDna, AiInferenceLogRepository inferences, BrandProfileRepository brands,
                          CelebrityProfileRepository celebrities, IdentityService identity, MediaStoragePort storage,
                          EmailSenderPort email, NotificationService notifications, Audit audit, Avatar3dService avatars3d) {
        this(users, preferences, consents, codes, exports, pieces, schemes, schemeItems, comments, reactions, saved, follows,
                photos, notificationRepository, dnaSchemes, styleDna, inferences, brands, celebrities, identity, storage, email,
                notifications, audit, avatars3d, null);
    }

    public AccountService(UserRepository users, UserPreferencesRepository preferences, UserConsentRepository consents,
                          VerificationCodeRepository codes, DataExportRequestRepository exports, WardrobeItemRepository pieces,
                          SchemeRepository schemes, SchemeItemRepository schemeItems, CommentRepository comments,
                          ReactionRepository reactions, SavedItemRepository saved, FollowRepository follows,
                          PhotoRepository photos, NotificationRepository notificationRepository, DnaSchemeRepository dnaSchemes,
                          StyleDnaRepository styleDna, AiInferenceLogRepository inferences, BrandProfileRepository brands,
                          CelebrityProfileRepository celebrities, IdentityService identity, MediaStoragePort storage,
                          EmailSenderPort email, NotificationService notifications, Audit audit, Avatar3dService avatars3d,
                          LensService lens) {
        this(users, preferences, consents, codes, exports, pieces, schemes, schemeItems, comments, reactions, saved, follows,
                photos, notificationRepository, dnaSchemes, styleDna, inferences, brands, celebrities, identity, storage, email,
                notifications, audit, avatars3d, lens, null, null, null, null);
    }

    @Autowired
    public AccountService(UserRepository users, UserPreferencesRepository preferences, UserConsentRepository consents,
                          VerificationCodeRepository codes, DataExportRequestRepository exports, WardrobeItemRepository pieces,
                          SchemeRepository schemes, SchemeItemRepository schemeItems, CommentRepository comments,
                          ReactionRepository reactions, SavedItemRepository saved, FollowRepository follows,
                          PhotoRepository photos, NotificationRepository notificationRepository, DnaSchemeRepository dnaSchemes,
                          StyleDnaRepository styleDna, AiInferenceLogRepository inferences, BrandProfileRepository brands,
                          CelebrityProfileRepository celebrities, IdentityService identity, MediaStoragePort storage,
                          EmailSenderPort email, NotificationService notifications, Audit audit, Avatar3dService avatars3d,
                          LensService lens, HypeScoreConfig hypeConfig, HypeScoreCurrentRepository hypeScores,
                          HypeScoreSnapshotRepository hypeSnapshots, HypeMilestoneRepository hypeMilestones) {
        AccountLookup lookup = new AccountLookup(users, preferences);
        this.consents = new AccountConsents(consents, audit, lookup);
        this.profile = new AccountProfileView(preferences, brands, celebrities, lookup, this.consents);
        this.settings = new AccountSettings(users, codes, identity, email, audit, lookup);
        this.dataPackage = new AccountExportData(preferences, consents, pieces, schemes, schemeItems, comments, saved, follows, photos,
                notificationRepository, styleDna, dnaSchemes, inferences,
                new AccountHypeExport(hypeConfig, hypeScores, hypeSnapshots, hypeMilestones));
        this.exports = new AccountExports(exports, storage, notifications, audit, lookup, dataPackage);
        this.deletion = new AccountDeletion(identity, brands, celebrities, email, audit, lookup);
        this.anonymizer = new AccountAnonymizer(users, pieces, schemes, comments, photos, storage, avatars3d, lens, hypeMilestones,
                identity, audit, () -> accountDataCleanup);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> me(CurrentUser user) {
        return profile.me(user);
    }

    /** RF5.CA03 — a visibilidade padrão do esquema/peça é herdada do perfil (RF3.CA12). */
    public static Visibility defaultVisibility(User u) {
        return u.getProfileVisibility() == null ? Visibility.PRIVATE : u.getProfileVisibility();
    }

    public record SensitiveUpdate(String password, String email, String phone, String birthDate, Boolean twoFactorEnabled) {
    }

    @Transactional
    public Map<String, Object> updateSensitive(CurrentUser user, SensitiveUpdate cmd) {
        return settings.updateSensitive(user, cmd);
    }

    /**
     * Código de 6 dígitos com tentativas contadas e gravadas (noRollbackFor): na quinta errada o pedido de troca é
     * invalidado e é preciso pedir outro código.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public Views.UserCard confirmEmailChange(CurrentUser user, String code) {
        return settings.confirmEmailChange(user, code);
    }

    /**
     * RF3.CA12 — visibilidade do perfil (público / somente seguidores / privado), aplicada imediatamente ao feed
     * (RF8) e ao perfil público (RF17). Privacy by Default: a conta nasce PRIVATE (RF3.CA19).
     */
    @Transactional
    public Map<String, Object> updatePrivacy(CurrentUser user, Visibility visibility) {
        return settings.updatePrivacy(user, visibility);
    }

    // ------------------------------------------------------------------ consentimentos
    @Transactional(readOnly = true)
    public List<Map<String, Object>> consents(CurrentUser user) {
        return consents.consents(user);
    }

    @Transactional
    public List<Map<String, Object>> setConsent(CurrentUser user, ConsentPurpose purpose, boolean granted) {
        return consents.setConsent(user, purpose, granted);
    }

    // ------------------------------------------------------------------ exportação (RF3.CA04 / CA24)
    @Transactional
    public Map<String, Object> requestExport(CurrentUser user) {
        return exports.requestExport(user);
    }

    static String exportKey(UUID userId, UUID exportId) {
        return AccountExports.exportKey(userId, exportId);
    }

    /** Job de hora em hora: apaga o arquivo das exportações vencidas (7 dias); o registro fica como EXPIRED. */
    @Scheduled(cron = "0 50 * * * *", zone = "America/Sao_Paulo")
    @Transactional
    public int purgeExpiredExports() {
        return exports.purgeExpiredExports();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> exportsOf(CurrentUser user) {
        return exports.exportsOf(user);
    }

    @Transactional(readOnly = true)
    public byte[] downloadExport(CurrentUser user, UUID exportId) {
        return exports.downloadExport(user, exportId);
    }

    Map<String, Object> exportData(User u) {
        return dataPackage.exportData(u);
    }

    // ------------------------------------------------------------------ exclusão (RF3.CA05)
    @Transactional
    public Map<String, Object> requestDeletion(CurrentUser user, String password) {
        return deletion.requestDeletion(user, password);
    }

    @Transactional
    public Map<String, Object> cancelDeletion(CurrentUser user) {
        return deletion.cancelDeletion(user);
    }

    /** Job diário: conclui exclusões vencidas por anonimização irreversível (LGPD art. 16/18). */
    @Transactional
    public int purgeScheduledDeletions() {
        return anonymizer.purgeScheduledDeletions();
    }
}

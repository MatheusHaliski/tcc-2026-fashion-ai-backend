package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.service.IdentityService.BrandData;
import br.com.fashionai.application.service.IdentityService.CelebrityData;
import br.com.fashionai.application.service.IdentityService.RegisterCommand;
import br.com.fashionai.application.service.IdentityService.Session;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.UiLanguage;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

import static br.com.fashionai.application.service.IdentityFieldRules.normalizeUsername;
import static br.com.fashionai.application.service.IdentityFormats.blank;
import static br.com.fashionai.application.service.IdentityFormats.escape;
import static br.com.fashionai.application.service.IdentityFormats.maskEmail;
import static br.com.fashionai.application.service.IdentityPreUploads.PENDING_SCOPES;
import static br.com.fashionai.application.service.IdentityService.TERMS_VERSION;

/**
 * RF1 — cadastro Pessoal, Marca e Celebridade: validação do formulário ({@link RegistrationFormChain}), arquivos do
 * formulário conferidos e copiados para a conta, e-mail e @ únicos, conta, preferências, perfil de marca/celebridade
 * (pendente de validação), avisos e a primeira sessão.
 */
final class IdentityRegistration {
    private final UserRepository users;
    private final UserPreferencesRepository preferences;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final PasswordHasherPort hasher;
    private final EmailSenderPort email;
    private final NotificationService notifications;
    private final Audit audit;
    private final MediaStoragePort storage;
    private final IdentityPreUploads preUploads;
    private final IdentityUsernames usernames;
    private final IdentityCodes codeBook;
    private final IdentitySessions sessions;
    /** Análise de emissor (opcional, definida depois da construção pelo setter do service). */
    private final Supplier<IssuerReviewService> issuerReview;

    IdentityRegistration(UserRepository users, UserPreferencesRepository preferences, BrandProfileRepository brands,
                         CelebrityProfileRepository celebrities, PasswordHasherPort hasher, EmailSenderPort email,
                         NotificationService notifications, Audit audit, MediaStoragePort storage, IdentityPreUploads preUploads,
                         IdentityUsernames usernames, IdentityCodes codeBook, IdentitySessions sessions,
                         Supplier<IssuerReviewService> issuerReview) {
        this.users = users;
        this.preferences = preferences;
        this.brands = brands;
        this.celebrities = celebrities;
        this.hasher = hasher;
        this.email = email;
        this.notifications = notifications;
        this.audit = audit;
        this.storage = storage;
        this.preUploads = preUploads;
        this.usernames = usernames;
        this.codeBook = codeBook;
        this.sessions = sessions;
        this.issuerReview = issuerReview;
    }

    Session register(RegisterCommand cmd, String ip, String userAgent) {
        ProfileType type = cmd.profileType() == null ? ProfileType.PESSOAL : cmd.profileType();
        if (type == ProfileType.ADMIN) {
            throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("identity.tipo_de_perfil_nao_permitido"));
        }
        String mail = cmd.email() == null ? "" : cmd.email().trim().toLowerCase(Locale.ROOT);
        // campos do formulário: cadeia ordenada de regras puras (a ordem das chaves em details é contrato)
        Map<String, Object> errors = RegistrationFormChain.validate(
                new RegistrationFormChain.Input(cmd, type, mail, LocalDate.now()));
        // arquivos do cadastro: lidos já aqui (confere que o envio existe) e copiados para a conta depois de criada
        Map<String, byte[]> uploads = new LinkedHashMap<>();
        for (String[] f : new String[][]{{"avatarUrl", cmd.avatarUrl(), "avatar"},
                {"brand.logoUrl", cmd.brand() == null ? null : cmd.brand().logoUrl(), "logo"},
                {"brand.activityProofUrl", cmd.brand() == null ? null : cmd.brand().activityProofUrl(), "activity-proof"},
                {"celebrity.officialPhotoUrl", cmd.celebrity() == null ? null : cmd.celebrity().officialPhotoUrl(), "official-photo"},
                {"celebrity.identityProofUrl", cmd.celebrity() == null ? null : cmd.celebrity().identityProofUrl(), "identity"}}) {
            if (blank(f[1])) {
                continue;
            }
            Optional<MediaService.OwnedMedia> upload = preUploads.pendingUpload(f[1], f[2]);
            byte[] bytes = upload.map(m -> preUploads.readQuietly(m.key())).orElse(null);
            if (bytes == null) {
                errors.put(f[0], Msg.t("identity.envie_o_arquivo_pelo_formulario"));
            } else {
                uploads.put(upload.get().key(), bytes);
            }
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
        String emailHash = Hashing.emailHash(mail);
        if (users.existsByEmailHash(emailHash)) {
            // RF1.CA02 — recusa específica, sem vazar nenhum dado da conta existente.
            throw ApiException.conflict("EMAIL_EM_USO", Msg.t("identity.este_e_mail_ja_esta"));
        }
        String username = cmd.username() == null || cmd.username().isBlank() ? usernames.suggestUsername(cmd.fullName())
                : normalizeUsername(cmd.username());
        if (users.existsByUsernameIgnoreCase(username)) {
            throw ApiException.badRequest("USERNAME_EM_USO", Msg.t("common.este_ja_esta_em_uso"),
                    Map.of("suggestions", usernames.usernameSuggestions(username)));
        }
        User u = new User();
        u.setUsername(username);
        u.setDisplayName(type == ProfileType.CELEBRIDADE && cmd.celebrity() != null ? cmd.celebrity().stageName().trim()
                : type == ProfileType.MARCA && cmd.brand() != null && !blank(cmd.brand().nomeFantasia())
                ? cmd.brand().nomeFantasia().trim() : cmd.fullName().trim());
        u.setEmail(mail);
        u.setEmailHash(emailHash);
        u.setPasswordHash(hasher.hash(cmd.password()));
        u.setProfileType(type);
        u.setBirthDate(blank(cmd.birthDate()) ? null : cmd.birthDate());
        u.setCountry(blank(cmd.country()) ? "BR" : cmd.country().trim().toUpperCase(Locale.ROOT));
        u.setPrivateAccount(true);
        u.setTermsAcceptedAt(Instant.now());
        u.setTermsVersion(TERMS_VERSION);
        u.setStatus(AccountStatus.PENDING_EMAIL_VERIFICATION);
        u.setSex(cmd.sex());
        users.save(u);
        Map<String, String> claimed = new LinkedHashMap<>();
        uploads.forEach((key, bytes) -> claimed.put(key, preUploads.claimPendingUpload(u.getId(), key, bytes)));
        java.util.function.UnaryOperator<String> own = url -> blank(url) ? null
                : MediaService.ownedMedia(storage, null, url, PENDING_SCOPES).map(m -> claimed.get(m.key())).orElse(null);
        String avatar = own.apply(cmd.avatarUrl());
        if (type == ProfileType.MARCA && cmd.brand() != null) {
            u.setAvatarUrl(own.apply(cmd.brand().logoUrl()));
        }
        if (type == ProfileType.CELEBRIDADE && cmd.celebrity() != null) {
            u.setAvatarUrl(own.apply(cmd.celebrity().officialPhotoUrl()));
        }
        if (avatar != null) {
            u.setAvatarUrl(avatar);                // a foto de perfil escolhida vence o logo/foto oficial no avatar
        }
        UserPreferences prefs = new UserPreferences();
        prefs.setUser(u);
        prefs.setLanguage(UiLanguage.valueOf(Msg.preferenceCode(Msg.locale())));   // o idioma da interface no cadastro vira a preferência (RF23)
        if (cmd.sex() != null) {
            prefs.setMannequinSex(cmd.sex());
        }
        preferences.save(prefs);
        if (type == ProfileType.MARCA) {
            BrandData b = cmd.brand();
            BrandProfile bp = new BrandProfile();
            bp.setOwner(u);
            bp.setBrandName(blank(b.nomeFantasia()) ? b.razaoSocial().trim() : b.nomeFantasia().trim());
            bp.setSlug(uniqueBrandSlug(bp.getBrandName()));
            bp.setLogoUrl(own.apply(b.logoUrl()));
            bp.setCnpj(b.cnpj().replaceAll("\\D", ""));
            bp.setRazaoSocial(b.razaoSocial().trim());
            bp.setNomeFantasia(b.nomeFantasia());
            bp.setFashionCategory(b.fashionCategory());
            bp.setStoreUrl(IssuerVerificationPolicy.normalizeUrl(b.storeUrl()));
            bp.setCommercialContact(b.commercialContact());
            bp.setOfficialHashtag(b.officialHashtag());
            bp.setActivityProofUrl(own.apply(b.activityProofUrl()));
            bp.setCountry(u.getCountry());
            bp.setApprovalStatus(ApprovalStatus.PENDENTE);
            brands.save(bp);
        }
        if (type == ProfileType.CELEBRIDADE) {
            CelebrityData c = cmd.celebrity();
            CelebrityProfile cp = new CelebrityProfile();
            cp.setOwner(u);
            cp.setStageName(c.stageName().trim());
            cp.setSlug(uniqueCelebritySlug(c.stageName()));
            cp.setAvatarUrl(own.apply(c.officialPhotoUrl()));
            cp.setRealName(c.realName());
            cp.setIdentityProofUrl(own.apply(c.identityProofUrl()));
            cp.setAreasJson(Json.write(c.areas()));
            cp.setVerifiableFollowersJson(Json.write(c.verifiableFollowers()));
            cp.setVerificationUrl(IssuerVerificationPolicy.normalizeUrl(c.verificationUrl()));
            cp.setProfessionalHistory(c.professionalHistory());
            cp.setRepresentationContact(c.representationContact());
            cp.setFashionInterestsJson(Json.write(c.fashionInterests()));
            cp.setSealConsentGranted(c.sealConsentGranted());
            cp.setVerificationStatus(ApprovalStatus.PENDENTE);
            celebrities.save(cp);
        }
        codeBook.sendEmailVerification(u);
        if (type != ProfileType.PESSOAL) {
            email.send(mail, Msg.t("identity.cadastro_recebido_pendente_de_validacao"),
                    Msg.t("identity.p_recebemos_o_cadastro_de", escape(u.getDisplayName()), (type == ProfileType.MARCA ? "marca" : "celebridade")),
                    "SECURITY");
            if (issuerReview.get() != null) {
                issuerReview.get().submitted(u.getId());          // aviso aos administradores (app + e-mail), após o commit
            }
        }
        notifications.notify(u.getId(), null, NotificationType.WELCOME, "USER", u.getId(), Msg.k("identity.boas_vindas_ao_fashion_ai"),
                Msg.k("identity.monte_seu_guarda_roupa_crie"), null);
        notifications.notify(u.getId(), null, NotificationType.EMAIL_CONFIRMATION, "USER", u.getId(),
                Msg.k("identity.confirme_seu_e_mail"), Msg.k("identity.enviamos_um_codigo_para_ate", maskEmail(mail)), null);
        audit.log(u.getId().toString(), AuditActions.CADASTRO_CONTA, "user:" + u.getId(), "SUCESSO", ip, userAgent,
                Map.of("profileType", type.name()));
        return sessions.openSession(u, true, ip, userAgent, null);
    }

    private String uniqueBrandSlug(String name) {
        String base = Hashing.slug(name);
        String s = base;
        int i = 2;
        while (brands.findBySlug(s).isPresent()) {
            s = base + "-" + i++;
        }
        return s;
    }

    private String uniqueCelebritySlug(String name) {
        String base = Hashing.slug(name);
        String s = base;
        int i = 2;
        while (celebrities.findBySlug(s).isPresent()) {
            s = base + "-" + i++;
        }
        return s;
    }
}

package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.HypeScorePanelVersion;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Conta do usuário (RF1/RF2/RF3/RF23). Dados pessoais identificadores ficam cifrados em repouso (RNF3);
 * e-mail tem hash determinístico para unicidade e login sem expor o valor.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "users")
public class User extends VersionedAuditableEntity {
    @Column(nullable = false, unique = true, length = 80)
    private String username;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "display_name_ciphertext", nullable = false, length = 1024)
    private String displayName;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "email_ciphertext", nullable = false, length = 1024)
    private String email;

    @Column(name = "email_hash", nullable = false, unique = true, length = 128)
    private String emailHash;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "phone_ciphertext", length = 512)
    private String phone;

    /** Coletada só para verificar idade mínima (Art. 6º, III) — nunca reexibida publicamente. */
    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "birth_date_ciphertext", length = 512)
    private String birthDate;

    @Column(name = "password_hash", nullable = false, length = 512)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "profile_type", nullable = false, length = 20)
    private ProfileType profileType;

    @Column(nullable = false, length = 50)
    private String role = "USER";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AccountStatus status = AccountStatus.PENDING_EMAIL_VERIFICATION;

    @Column(name = "avatar_url", length = 1024)
    private String avatarUrl;

    @Column(name = "cover_url", length = 1024)
    private String coverUrl;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "bio_ciphertext", length = 2048)
    private String bio;

    /** Privacy by Default (RF3.CA19): conta nasce privada. */
    @Column(name = "private_account", nullable = false)
    private boolean privateAccount = true;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Column(name = "two_factor_enabled", nullable = false)
    private boolean twoFactorEnabled;

    @Column(length = 2)
    private String country;

    @Column(name = "interface_background_preset_id", length = 80)
    private String interfaceBackgroundPresetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "look_do_dia_panel_version", nullable = false, length = 40)
    private HypeScorePanelVersion lookDoDiaPanelVersion = HypeScorePanelVersion.SPOTLIGHT_CLASSICO;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "terms_accepted_at")
    private Instant termsAcceptedAt;

    @Column(name = "terms_version", length = 20)
    private String termsVersion;

    @Column(name = "deletion_requested_at")
    private Instant deletionRequestedAt;

    @Column(name = "deletion_scheduled_for")
    private Instant deletionScheduledFor;

    public User(String username, String displayName, String email, String emailHash, String passwordHash, ProfileType profileType) {
        this.username = username;
        this.displayName = displayName;
        this.email = email;
        this.emailHash = emailHash;
        this.passwordHash = passwordHash;
        this.profileType = profileType;
    }

    public boolean isBrand() {
        return profileType == ProfileType.MARCA;
    }

    public boolean isCelebrity() {
        return profileType == ProfileType.CELEBRIDADE;
    }

    public boolean canWrite() {
        return status == AccountStatus.ACTIVE;
    }

    /** RF3.CA12 — visibilidade do perfil em três níveis; nasce PRIVATE (RF3.CA19 · Privacy by Default). */
    @Enumerated(EnumType.STRING)
    @Column(name = "profile_visibility", nullable = false, length = 20)
    private Visibility profileVisibility = Visibility.PRIVATE;
}

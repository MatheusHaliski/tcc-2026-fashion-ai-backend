package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.HypeScorePanelVersion;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

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

    @Column(name = "password_hash", nullable = false, length = 512)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "profile_type", nullable = false, length = 20)
    private ProfileType profileType;

    @Column(nullable = false, length = 50)
    private String role = "USER";

    @Column(name = "avatar_url", length = 1024)
    private String avatarUrl;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "bio_ciphertext", length = 2048)
    private String bio;

    @Column(name = "private_account", nullable = false)
    private boolean privateAccount;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Column(length = 2)
    private String country;

    @Column(name = "interface_background_preset_id", length = 80)
    private String interfaceBackgroundPresetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "look_do_dia_panel_version", nullable = false, length = 40)
    private HypeScorePanelVersion lookDoDiaPanelVersion = HypeScorePanelVersion.SPOTLIGHT_CLASSICO;

    protected User() {
    }

    public User(String username, String displayName, String email, String emailHash, String passwordHash, ProfileType profileType) {
        this.username = username;
        this.displayName = displayName;
        this.email = email;
        this.emailHash = emailHash;
        this.passwordHash = passwordHash;
        this.profileType = profileType;
    }

    public String getUsername() {
        return username;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getEmail() {
        return email;
    }

    public String getEmailHash() {
        return emailHash;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public ProfileType getProfileType() {
        return profileType;
    }

    public String getRole() {
        return role;
    }

    public boolean isPrivateAccount() {
        return privateAccount;
    }

    public String getInterfaceBackgroundPresetId() {
        return interfaceBackgroundPresetId;
    }

    public HypeScorePanelVersion getLookDoDiaPanelVersion() {
        return lookDoDiaPanelVersion;
    }
}

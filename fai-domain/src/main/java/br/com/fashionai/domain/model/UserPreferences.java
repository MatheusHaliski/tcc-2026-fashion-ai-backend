package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.SizeSystem;
import br.com.fashionai.domain.model.enums.ThemeMode;
import br.com.fashionai.domain.model.enums.UiDensity;
import br.com.fashionai.domain.model.enums.UiLanguage;
import br.com.fashionai.domain.model.enums.UnitSystem;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * RF23 — preferências de interface e de uso. Não são dado pessoal (doc LGPD do RNF6): salvam direto,
 * sem reautenticação, persistidas no servidor e replicadas entre dispositivos (CA16-CA18, last-write-wins
 * por {@link #clientUpdatedAt}). O fundo do chrome muda apenas o chrome — nunca a arte dos cards (CA19).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_preferences")
public class UserPreferences extends VersionedAuditableEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ThemeMode theme = ThemeMode.AUTO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private UiLanguage language = UiLanguage.PT_BR;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UiDensity density = UiDensity.COMFORTABLE;

    @Column(name = "font_scale", nullable = false)
    private int fontScale = 100;

    @Column(name = "high_contrast", nullable = false)
    private boolean highContrast;

    @Column(name = "reduce_motion", nullable = false)
    private boolean reduceMotion;

    @Column(name = "chrome_background_id", length = 80)
    private String chromeBackgroundId;

    @Enumerated(EnumType.STRING)
    @Column(name = "size_system", nullable = false, length = 4)
    private SizeSystem sizeSystem = SizeSystem.BR;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit_system", nullable = false, length = 4)
    private UnitSystem unitSystem = UnitSystem.CM;

    @Enumerated(EnumType.STRING)
    @Column(name = "mannequin_sex", length = 20)
    private MannequinSex mannequinSex;

    @Column(name = "mannequin_skin_tone", length = 20)
    private String mannequinSkinTone;

    @Enumerated(EnumType.STRING)
    @Column(name = "mannequin_build", length = 20)
    private BodyBuild mannequinBuild;

    @Column(name = "default_card_skin", length = 20)
    private String defaultCardSkin = "atelier";

    @Column(name = "notification_push_master", nullable = false)
    private boolean notificationPushMaster = true;

    /** Mapa JSON NotificationType → boolean (RF3.CA36 / RNF10). */
    @Column(name = "notification_prefs_json", columnDefinition = "json")
    private String notificationPrefsJson;

    @Column(name = "client_updated_at")
    private Instant clientUpdatedAt;

    public UserPreferences(User user) {
        this.user = user;
    }

    /** RF10 §3.3 — opt-out das sugestões de compra do Copilot. */
    @Column(name = "purchase_suggestions_enabled", nullable = false)
    private boolean purchaseSuggestionsEnabled = true;

    /** DET-D04 / ETI-06 — som desligado por padrão; háptico ligado. */
    @Column(name = "sound_enabled", nullable = false)
    private boolean soundEnabled;

    @Column(name = "haptics_enabled", nullable = false)
    private boolean hapticsEnabled = true;

    /** RF10.CA16 — uso da Identidade de Vida (Camada 2) no contexto da IA; desligado por padrão. */
    @Column(name = "life_identity_in_ai", nullable = false)
    private boolean lifeIdentityInAi;
}

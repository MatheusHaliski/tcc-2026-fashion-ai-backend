package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.BackgroundAnimation;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.StyleArchetype;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * DNAScheme (taxonomia §04, RF13) — conjunto de 2 a 6 esquemas do próprio usuário com uma narrativa
 * de exibição (11 variações). archetype é sintetizado pela IA e restrito aos 5 arquétipos de Kibbe.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "dna_schemes")
public class DnaScheme extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 180)
    private String title;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "identity_phrase_ciphertext", length = 2048)
    private String identityPhrase;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private StyleArchetype archetype;

    @Column(name = "boldness_index")
    private Integer boldnessIndex;

    @Column(name = "icon_scheme_id", length = 36)
    private UUID iconSchemeId;

    @Column(name = "color_palette_json", columnDefinition = "json")
    private String colorPaletteJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "narrative_type", length = 40)
    private NarrativeType narrativeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "seasonal_theme", length = 10)
    private Season seasonalTheme;

    @Column(length = 160)
    private String occasion;

    @Column(length = 160)
    private String style;

    @Column(name = "seal_ids_json", columnDefinition = "json")
    private String sealIdsJson;

    @Column(name = "background_color", length = 20)
    private String backgroundColor = "#F4F2EF";

    @Column(name = "background_gradient", length = 512)
    private String backgroundGradient;

    @Column(name = "background_image_url", length = 1024)
    private String backgroundImageUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "background_animation_type", nullable = false, length = 20)
    private BackgroundAnimation backgroundAnimationType = BackgroundAnimation.NONE;

    @Column(name = "studio_config_json", columnDefinition = "json")
    private String studioConfigJson;

    @Column(name = "card_image_url", length = 1024)
    private String cardImageUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "creation_mode", nullable = false, length = 20)
    private CreationMode creationMode = CreationMode.MANUAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Visibility visibility = Visibility.PRIVATE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SchemeStatus status = SchemeStatus.DRAFT;

    @Column(nullable = false)
    private boolean disponivel = true;

    @Column(name = "grouping_id", length = 36)
    private UUID groupingId;

    @Column(name = "is_remixed_from", length = 36)
    private UUID remixedFromDnaId;

    @Column(name = "like_count", nullable = false)
    private long likeCount;

    @Column(name = "comment_count", nullable = false)
    private long commentCount;

    @Column(name = "share_count", nullable = false)
    private long shareCount;

    @Column(name = "remix_count", nullable = false)
    private long remixCount;

    /** Explicação da inferência (RF24.CA12): dados usados + provedor. */
    @Column(name = "ai_explanation_json", columnDefinition = "json")
    private String aiExplanationJson;

    @Column(name = "published_at")
    private Instant publishedAt;

    /** anatomia_cards_DNA_v4 Seção A — AMPLIADO, GRADE, HORIZONTAL ou LATERAL. */
    @Column(name = "card_layout", nullable = false, length = 20)
    private String cardLayout = "AMPLIADO";

    /** Etapa 1 — DNA_COMPLETO habilita as narrativas da Seção B; ESQUEMA usa o Background Studio comum. */
    @Column(name = "target_element", nullable = false, length = 20)
    private String targetElement = "DNA_COMPLETO";

    /** RF11 §7.6 — vídeo em loop do Preset Aura + material (formato imagem única ou mosaico); o quadro estático vai para a arte de fundo. */
    @Column(name = "background_video_url", length = 1024)
    private String backgroundVideoUrl;
}

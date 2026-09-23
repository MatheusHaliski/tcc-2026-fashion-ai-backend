package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.StyleArchetype;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
 * Resumo vigente do DNA de Estilo do usuário (um por conta): arquétipo, paleta e frase de identidade
 * sintetizados a partir do DNA mais recente. Alimenta a ordenação por afinidade (RF24.CA6) e o Copilot.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "style_dna")
public class StyleDna extends VersionedAuditableEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StyleArchetype archetype = StyleArchetype.CLASSIC;

    @Column(name = "boldness_index", nullable = false)
    private int boldnessIndex;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "identity_phrase_ciphertext", length = 2048)
    private String identityPhrase;

    @Column(name = "color_palette", length = 512)
    private String colorPalette;

    @Column(name = "style_keywords", length = 512)
    private String styleKeywords;

    @Column(name = "occasion_keywords", length = 512)
    private String occasionKeywords;

    @Column(name = "icon_piece_name", length = 180)
    private String iconPieceName;

    @Column(name = "latest_dna_scheme_id", length = 36)
    private java.util.UUID latestDnaSchemeId;

    @Column(name = "synthesized_at")
    private Instant synthesizedAt;

    public StyleDna(User user) {
        this.user = user;
    }

    /** HU20 — padrão de silhueta (oversized, fitted, layering…). */
    @Column(length = 60)
    private String silhouette;

    /** RF13.CA08 — Identidade de Vida (lugares, pessoas, animais, objetos) cifrada em repouso; nunca vai ao payload de imagem. */
    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "life_identity_ciphertext", columnDefinition = "TEXT")
    private String lifeIdentityJson;

    /** RF13.CA06 / HU20.C7 — campos da Camada 2 ocultos no card exportado. */
    @Column(name = "life_private_fields_json", columnDefinition = "json")
    private String lifePrivateFieldsJson;

    @Column(name = "interactions_at_synthesis", nullable = false)
    private int interactionsAtSynthesis;

    @Column(name = "card_image_url", length = 1024)
    private String cardImageUrl;

    @Column(name = "card_expires_at")
    private java.time.Instant cardExpiresAt;

    /** STYLE_ONLY (Camada 1) ou STYLE_AND_LIFE (duas camadas). */
    @Column(name = "phrase_source", length = 20)
    private String phraseSource;
}

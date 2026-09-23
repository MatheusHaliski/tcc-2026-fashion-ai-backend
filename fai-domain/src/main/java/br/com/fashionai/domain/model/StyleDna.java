package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.Visibility;
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

@Entity
@Table(name = "style_dna")
public class StyleDna extends VersionedAuditableEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 80)
    private String archetype;

    @Column(name = "narrative_type", nullable = false, length = 80)
    private String narrativeType;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "identity_phrase_ciphertext", length = 2048)
    private String identityPhrase;

    @Column(name = "color_palette", length = 512)
    private String colorPalette;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Visibility visibility = Visibility.PRIVADO;

    @Column(name = "card_image_url", length = 1024)
    private String cardImageUrl;

    protected StyleDna() {
    }
}

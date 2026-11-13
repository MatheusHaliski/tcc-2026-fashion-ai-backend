package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

/**
 * Fotos de estúdio e de manequim da peça (colunas de wardrobe_items). Separadas do {@link WardrobeItem} só para manter a
 * entidade dentro do limite de linhas; o mapeamento e os getters/setters continuam os mesmos.
 */
@Getter
@Setter
@MappedSuperclass
public abstract class PieceStudioMedia extends VersionedAuditableEntity {
    /** RF4 · Estúdio: foto de produto (fundo de estúdio, luz e sombra) exibida na vitrine; o recorte segue em imageUrl. */
    @Column(name = "studio_image_url", length = 1024)
    private String studioImageUrl;

    @Column(name = "studio_backdrop", length = 30)
    private String studioBackdrop;

    /** RF4 · Estúdio: foto de detalhe 4:5 enquadrada no logo (null quando a peça não tem logo identificado). */
    @Column(name = "studio_detail_url", length = 1024)
    private String studioDetailUrl;

    /** Foto com meu manequim (RF4/RF5): a peça ou o look vestindo o manequim da pessoa (ou o padrão masc./fem.). */
    @Column(name = "mannequin_image_url", length = 1024)
    private String mannequinImageUrl;

    /** FOTO (rosto da foto de perfil) ou PADRAO (manequim padrão, sem foto de perfil). */
    @Column(name = "mannequin_image_face", length = 20)
    private String mannequinImageFace;
}

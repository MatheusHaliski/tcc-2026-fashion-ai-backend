package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * MP-2 — O que está no provador agora, por conta (não por aparelho): o mesmo estado aparece no celular, no computador
 * e no console. Experimentar não cria look, não pede título e não publica nada.
 * {@code revision} sobe a cada mudança e é a pré-condição (If-Match) para gravar: duas plataformas mudando ao mesmo
 * tempo nunca se sobrescrevem em silêncio — a segunda recebe 412 com o estado atual.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "try_on_sessions")
public class TryOnSession extends AuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36, unique = true)
    private UUID userId;

    @Column(name = "top_piece_id", length = 36)
    private UUID topPieceId;

    @Column(name = "bottom_piece_id", length = 36)
    private UUID bottomPieceId;

    @Column(name = "shoes_piece_id", length = 36)
    private UUID shoesPieceId;

    @Column(name = "accessory_piece_id", length = 36)
    private UUID accessoryPieceId;

    /** Identidade e versão do avatar com que a sessão foi vista por último (o cliente confere se é a mesma pessoa). */
    @Column(name = "avatar_identity_id", length = 36)
    private UUID avatarIdentityId;

    @Column(name = "avatar_version")
    private Integer avatarVersion;

    @Column(nullable = false)
    private long revision;

    @Column(name = "updated_platform", length = 20)
    private String updatedPlatform;
}

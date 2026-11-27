package br.com.fashionai.domain.model.acervo;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** ACERVO — compartimento de um móvel: cabideiro, prateleira ou gaveta, na ordem em que aparece no móvel. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "acervo_compartimentos")
public class AcervoCompartimento extends VersionedAuditableEntity {
    public static final String CABIDEIRO = "CABIDEIRO";
    public static final String PRATELEIRA = "PRATELEIRA";
    public static final String GAVETA = "GAVETA";

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "movel_id", nullable = false, length = 36)
    private UUID movelId;

    @Column(nullable = false, length = 16)
    private String tipo;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private int ordem;
}

package br.com.fashionai.domain.model.acervo;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** ACERVO — ambiente da casa (closet, quarto) que agrupa os móveis da pessoa. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "acervo_ambientes")
public class AcervoAmbiente extends VersionedAuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private int ordem;
}

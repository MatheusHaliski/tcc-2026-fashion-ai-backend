package br.com.fashionai.domain.model.acervo;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * ACERVO — o que o acervo guarda sobre uma peça do guarda-roupa: o compartimento onde ela está (nulo = sem lugar) e as
 * medidas que a pessoa anotou. Uma linha por peça.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "acervo_pecas")
public class AcervoPeca extends VersionedAuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "piece_id", nullable = false, length = 36, unique = true)
    private UUID pieceId;

    @Column(name = "compartimento_id", length = 36)
    private UUID compartimentoId;

    @Column(name = "largura_cm", precision = 6, scale = 1)
    private BigDecimal larguraCm;

    @Column(name = "comprimento_cm", precision = 6, scale = 1)
    private BigDecimal comprimentoCm;

    @Column(name = "medidas_nota", length = 160)
    private String medidasNota;
}

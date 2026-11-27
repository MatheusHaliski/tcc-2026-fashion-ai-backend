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
 * ACERVO — item da lista de desejos: peça que a pessoa ainda não tem. O preço é uma estimativa informada por ela; o
 * compartimento é onde a peça entraria na simulação de compra.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "acervo_desejos")
public class AcervoDesejo extends VersionedAuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(nullable = false, length = 120)
    private String nome;

    @Column(nullable = false, length = 80)
    private String categoria;

    @Column(length = 80)
    private String cor;

    @Column(length = 40)
    private String tamanho;

    @Column(length = 160)
    private String marca;

    @Column(name = "preco_estimado", precision = 10, scale = 2)
    private BigDecimal precoEstimado;

    @Column(nullable = false, length = 3)
    private String moeda = "BRL";

    @Column(name = "compartimento_id", length = 36)
    private UUID compartimentoId;
}

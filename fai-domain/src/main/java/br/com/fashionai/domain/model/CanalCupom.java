package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Exercício 14 — canal de utilização do cupom (loja física, e-commerce ou ambos): opções da tabela canais_cupom,
 * referenciadas pelas ofertas (promotions, flair_combinations) e copiadas para os cupons emitidos
 * (promotion_redemptions, flair_redemptions). Canal desativado sai da escolha, mas continua valendo onde já foi usado.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "canais_cupom")
public class CanalCupom extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 40)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private boolean ativo = true;
}

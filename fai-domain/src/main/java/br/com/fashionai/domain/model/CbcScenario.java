package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Exercício 16 — opção de cenário dos Desafios de Montagem (tabela cbc_scenarios). O código é o mesmo texto de
 * {@code flair_challenges.scenario}. Cenário desativado sai da escolha, mas continua valendo para quem já o preferiu.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "cbc_scenarios")
public class CbcScenario extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 40)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private boolean ativo = true;
}

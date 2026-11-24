package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Corte da peça (Regular, Slim, Oversized...): opções da tabela cortes, referenciadas por wardrobe_items. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "cortes")
public class Corte extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private boolean ativo = true;
}

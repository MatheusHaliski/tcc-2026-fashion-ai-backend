package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Coleção da peça (Verão, Inverno, Festa...): opções mantidas na tabela colecao e referenciadas por wardrobe_items. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "colecao")
public class Colecao extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;
}

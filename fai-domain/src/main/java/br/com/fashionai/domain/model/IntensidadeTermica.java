package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Intensidade térmica da peça (Leve, Moderada, Alta): opções da tabela intensidade_termica, referenciadas por wardrobe_items. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "intensidade_termica")
public class IntensidadeTermica extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;
}

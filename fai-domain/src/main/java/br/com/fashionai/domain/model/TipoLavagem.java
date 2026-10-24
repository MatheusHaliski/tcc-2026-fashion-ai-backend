package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Instrução de lavagem estruturada, independente do texto livre de cuidados já existente. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "`TipoLavagem`")
public class TipoLavagem extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;
}

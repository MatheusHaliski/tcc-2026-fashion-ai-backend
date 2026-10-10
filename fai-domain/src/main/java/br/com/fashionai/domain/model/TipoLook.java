package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Catálogo de tipos de look: as opções do Espelho vêm desta tabela, não de um enum no formulário. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "`TipoLook`")
public class TipoLook extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;
}

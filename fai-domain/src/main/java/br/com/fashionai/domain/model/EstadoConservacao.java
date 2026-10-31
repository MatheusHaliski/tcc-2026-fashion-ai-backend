package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Opções de conservação mantidas no banco; códigos e nomes não são inferidos do enum legado. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "`EstadoConservacao`")
public class EstadoConservacao extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private boolean ativo = true;
}

package br.com.fashionai.domain.model.acervo;

import br.com.fashionai.domain.model.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Tipo de iluminação do ambiente do acervo (tabela tipos_iluminacao: Luz quente, neutra, fria, natural) — exercício 07,
 * aplicado ao acervo porque o quarto 3D saiu do app. Opção desativada sai da escolha, mas continua valendo nos ambientes
 * que já a usam.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "tipos_iluminacao")
public class TipoIluminacao extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 40)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private boolean ativo = true;
}

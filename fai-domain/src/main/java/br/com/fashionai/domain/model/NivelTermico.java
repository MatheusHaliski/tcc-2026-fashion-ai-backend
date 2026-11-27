package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Nível térmico do look (Leve, Moderado, Intenso): opções da tabela niveis_termicos, referenciadas por schemes
 * (docs/banco-de-dados/solucoes/04-nivel-termico.md). Opção desativada sai da escolha, mas continua valendo nos looks que já a usam.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "niveis_termicos")
public class NivelTermico extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 40)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private boolean ativo = true;
}

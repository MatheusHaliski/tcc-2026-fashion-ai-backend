package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Categoria principal da marca (Casual, Esportiva, Luxo...): opções da tabela categorias_marca, referenciadas por
 * brand_profiles (docs/banco-de-dados/solucoes/09-categoria-marca.md). Opção desativada sai da escolha, mas continua
 * valendo nos perfis que já a usam. O texto livre antigo (fashion_category) continua no perfil, sem conversão.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "categorias_marca")
public class CategoriaMarca extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 40)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private boolean ativo = true;
}

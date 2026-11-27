package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Área artística (Música, Cinema, Moda...): opções da tabela areas_artisticas. A celebridade aponta UMA delas como
 * principal (celebrity_profiles.area_artistica_principal_id); a lista livre de áreas (areas_json) continua à parte
 * (docs/banco-de-dados/solucoes/10-area-artistica.md). Opção desativada sai da escolha, mas continua valendo nos
 * perfis que já a usam.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "areas_artisticas")
public class AreaArtistica extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 40)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private boolean ativo = true;
}

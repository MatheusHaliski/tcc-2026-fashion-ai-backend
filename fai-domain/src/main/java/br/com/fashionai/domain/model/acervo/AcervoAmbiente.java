package br.com.fashionai.domain.model.acervo;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * ACERVO — ambiente da casa (closet, quarto) que agrupa os móveis da pessoa. A luz da cena "Meu espaço" (exercício 07)
 * vem daqui: tipo de iluminação (FK opcional para tipos_iluminacao) e temperatura de cor em kelvin (2700–6500, opcional);
 * ambiente legado sem os dois usa a luz padrão da cena.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "acervo_ambientes")
public class AcervoAmbiente extends VersionedAuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private int ordem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tipo_iluminacao_id")
    private TipoIluminacao tipoIluminacao;

    @Column(name = "temperatura_kelvin")
    private Integer temperaturaKelvin;
}

package br.com.fashionai.domain.model.acervo;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * ACERVO — móvel (armário ou módulo) de um ambiente, com a configuração que a pessoa escolheu: medidas em centímetros,
 * material, cor, porta e puxador. O modo separa o guarda-roupa real (MEU_ESPACO) do projeto imaginado (DREAM_SPACE).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "acervo_moveis")
public class AcervoMovel extends VersionedAuditableEntity {
    public static final String MEU_ESPACO = "MEU_ESPACO";
    public static final String DREAM_SPACE = "DREAM_SPACE";

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "ambiente_id", nullable = false, length = 36)
    private UUID ambienteId;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private int ordem;

    @Column(nullable = false, length = 16)
    private String modo = MEU_ESPACO;

    @Column(name = "largura_cm", nullable = false)
    private int larguraCm;

    @Column(name = "altura_cm", nullable = false)
    private int alturaCm;

    @Column(name = "profundidade_cm", nullable = false)
    private int profundidadeCm;

    @Column(nullable = false, length = 16)
    private String material;

    @Column(nullable = false, length = 24)
    private String cor;

    @Column(nullable = false, length = 16)
    private String porta;

    @Column(nullable = false, length = 16)
    private String puxador;

    @Column(name = "puxador_acabamento", nullable = false, length = 16)
    private String puxadorAcabamento;
}

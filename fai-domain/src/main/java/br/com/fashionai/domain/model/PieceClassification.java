package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

/**
 * Classificação escolhida pelo dono no formulário da peça: coleção, intensidade térmica, origem e corte (FKs de
 * wardrobe_items para as tabelas de opções). Separada do {@link WardrobeItem} só para manter a entidade dentro do
 * limite de linhas; o mapeamento e os getters/setters continuam os mesmos.
 */
@Getter
@Setter
@MappedSuperclass
public abstract class PieceClassification extends PieceCaptureSource {
    @Setter(lombok.AccessLevel.NONE)
    @Column(name = "aura_metamorphose_status", insertable = false, updatable = false)
    private String auraMetamorphoseStatus;

    @Column(name = "archive_on_expiry")
    private boolean archiveOnExpiry;

    @Column(name = "physical_store_item_id")
    private UUID physicalStoreItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "negotiation_partner_id")
    private User negotiationPartner;

    /** Coleção escolhida pelo dono (FK para a tabela colecao). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "colecao_id")
    private Colecao colecao;

    /** Intensidade térmica da peça (leve, moderada, alta), escolhida pelo dono (FK para a tabela intensidade_termica). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "intensidade_termica_id")
    private IntensidadeTermica intensidadeTermica;

    /** Origem escolhida pelo dono no formulário (Adquirida, Herdada, Trocada): FK para a tabela origem. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "origem_id")
    private Origem origem;

    /** Corte da peça (Regular, Slim, Oversized...), escolhido pelo dono (FK para a tabela cortes). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "corte_id")
    private Corte corte;
}

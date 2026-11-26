package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

/**
 * De onde a peça nasceu no criador (colunas de wardrobe_items): o rascunho de análise da foto e a sessão de captura.
 * Separada do {@link WardrobeItem} para manter a entidade dentro do limite de linhas.
 */
@Getter
@Setter
@MappedSuperclass
public abstract class PieceCaptureSource extends PieceStudioMedia {
    /**
     * Rascunho (pipeline_jobs.id) que virou esta peça. ÚNICO no banco (uq_wardrobe_items_draft): um rascunho gera no
     * máximo uma peça, mesmo com dois envios simultâneos, e nunca aparece em peças de duas pessoas.
     */
    @Column(name = "draft_id", length = 36, unique = true)
    private UUID draftId;

    /** RF4 · sessão de captura adaptativa que originou a peça (fotos originais, canônicos e identificação). */
    @Column(name = "capture_session_id", length = 36)
    private UUID captureSessionId;
}

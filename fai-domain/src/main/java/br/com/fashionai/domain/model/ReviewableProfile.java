package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ApprovalStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * Perfil emissor sob a política de verificação (marca ou celebridade): o mesmo ciclo de análise — envio, decisão com
 * motivos e checklist, reenvio — sobre as duas tabelas. Os getters/setters vêm do Lombok das entidades.
 */
public interface ReviewableProfile {
    User getOwner();

    String getSlug();

    /** Nome público do perfil (nome da marca ou nome artístico). */
    String publicName();

    ApprovalStatus reviewStatus();

    void reviewStatus(ApprovalStatus status);

    String getVerificationNotes();

    void setVerificationNotes(String notes);

    UUID getApprovedBy();

    void setApprovedBy(UUID adminId);

    Instant getApprovedAt();

    void setApprovedAt(Instant at);

    boolean isIdentityVerified();

    void setIdentityVerified(boolean verified);

    int getReviewAttempts();

    void setReviewAttempts(int attempts);

    Instant getReviewSubmittedAt();

    void setReviewSubmittedAt(Instant at);

    String getReviewReasons();

    void setReviewReasons(String reasons);

    String getReviewChecklist();

    void setReviewChecklist(String checklistJson);

    String getReviewOwnerMessage();

    void setReviewOwnerMessage(String message);

    Instant getCreatedAt();
}

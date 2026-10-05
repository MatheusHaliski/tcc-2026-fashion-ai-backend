package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.LensFeedbackKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * RF54 · Correção de uma peça detectada: o que a leitura disse e o que a pessoa corrigiu. Só entra no conjunto de
 * avaliação com {@code training_consent} (consentimento AI_MODEL_TRAINING no momento da correção).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "lens_feedback")
public class LensFeedback extends AuditableEntity {
    @Column(name = "scan_id", nullable = false, length = 36)
    private UUID scanId;

    @Column(name = "detection_id", nullable = false, length = 36)
    private UUID detectionId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private LensFeedbackKind kind;

    @Column(name = "before_json", columnDefinition = "json")
    private String beforeJson;

    @Column(name = "after_json", columnDefinition = "json")
    private String afterJson;

    @Column(name = "training_consent", nullable = false)
    private boolean trainingConsent;
}

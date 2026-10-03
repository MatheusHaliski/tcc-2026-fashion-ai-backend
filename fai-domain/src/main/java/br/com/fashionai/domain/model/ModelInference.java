package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Qual modelo/versão produziu cada resultado de visão (além do ai_inference_log dos LLMs). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "model_inferences")
public class ModelInference extends VersionedAuditableEntity {
    @Column(name = "model_name", nullable = false, length = 80)
    private String modelName;

    @Column(name = "model_version", nullable = false, length = 40)
    private String modelVersion;

    @Column(name = "task", nullable = false, length = 40)
    private String task;

    @Column(name = "session_id", length = 36)
    private UUID sessionId;

    @Column(name = "image_id", length = 36)
    private UUID imageId;

    @Column(name = "latency_ms")
    private Integer latencyMs;

    @Column(name = "confidence", precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(name = "output_json", columnDefinition = "json")
    private String outputJson;

    @Column(name = "ai_inference_id", length = 36)
    private UUID aiInferenceId;
}

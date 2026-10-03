package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ModelDeploymentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Model Registry: modelo versionado com dataset, métricas e status de deploy. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "model_registry")
public class ModelRegistryEntry extends VersionedAuditableEntity {
    @Column(name = "name", nullable = false, length = 80)
    private String name;

    @Column(name = "model_version", nullable = false, length = 40)
    private String modelVersion;

    @Column(name = "task", nullable = false, length = 40)
    private String task;

    @Column(name = "provider", nullable = false, length = 80)
    private String provider;

    @Column(name = "dataset_version", length = 80)
    private String datasetVersion;

    @Column(name = "training_date")
    private LocalDate trainingDate;

    @Column(name = "evaluation_metrics_json", columnDefinition = "json")
    private String evaluationMetricsJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "deployment_status", nullable = false, length = 20)
    private ModelDeploymentStatus deploymentStatus;

    @Column(name = "artifact_uri", length = 1024)
    private String artifactUri;

    @Column(name = "notes", length = 512)
    private String notes;
}

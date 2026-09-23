package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_log")
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, length = 160)
    private String actor;

    @Column(nullable = false, length = 120)
    private String acao;

    @Column(nullable = false, length = 160)
    private String recurso;

    @Column(nullable = false, length = 80)
    private String resultado;

    @Column(length = 80)
    private String ip;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(name = "correlation_id", nullable = false, length = 120)
    private String correlationId;

    @Column(name = "metadata_json", columnDefinition = "json")
    private String metadataJson;

    protected AuditLog() {
    }

    public AuditLog(String actor, String acao, String recurso, String resultado, String ip, String userAgent,
                    Instant timestamp, String correlationId, String metadataJson) {
        this.actor = actor;
        this.acao = acao;
        this.recurso = recurso;
        this.resultado = resultado;
        this.ip = ip;
        this.userAgent = userAgent;
        this.timestamp = timestamp;
        this.correlationId = correlationId;
        this.metadataJson = metadataJson;
    }
}

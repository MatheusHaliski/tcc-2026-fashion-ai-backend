package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** RF36 §3 — instância do desafio (rascunho → aguardando → ativo → concluído/expirado). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "challenge_instances")
public class ChallengeInstance {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "template_code", nullable = false, length = 40)
    private String templateCode;

    @Column(nullable = false, length = 20)
    private String mode;

    @Column(nullable = false, length = 20)
    private String state;

    @Column(name = "params_json", columnDefinition = "json")
    private String paramsJson;

    @Column(name = "starts_at")
    private Instant startsAt;

    @Column(name = "ends_at")
    private Instant endsAt;

    @Column(name = "accept_deadline")
    private Instant acceptDeadline;

    @Column(name = "created_by", nullable = false, length = 36)
    private UUID createdBy;

    @Column(name = "result_json", columnDefinition = "json")
    private String resultJson;

    @jakarta.persistence.Version
    @Column(nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        updatedAt = Instant.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}

package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/** Base auditável (RNF5): id UUID em CHAR(36), timestamps e autor da última alteração. */
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class AuditableEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, length = 36)
    private UUID id;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(updatable = false, length = 80)
    private String createdBy;

    @LastModifiedBy
    @Column(length = 80)
    private String lastModifiedBy;

    /** Usado apenas em testes e em projeções materializadas. */
    public void assignId(UUID id) {
        this.id = id;
    }

    /** Permite que jobs de migração e testes definam a data de criação sem o listener. */
    public void markCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
        if (this.updatedAt == null) {
            this.updatedAt = createdAt;
        }
    }
}

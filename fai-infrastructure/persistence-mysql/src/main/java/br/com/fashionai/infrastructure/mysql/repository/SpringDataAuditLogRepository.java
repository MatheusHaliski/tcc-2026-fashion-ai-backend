package br.com.fashionai.infrastructure.mysql.repository;

import br.com.fashionai.domain.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SpringDataAuditLogRepository extends JpaRepository<AuditLog, UUID> {
}

package br.com.fashionai.application.ports;

import br.com.fashionai.domain.model.AuditLog;

public interface AuditLogRepositoryPort {
    AuditLog save(AuditLog auditLog);
}

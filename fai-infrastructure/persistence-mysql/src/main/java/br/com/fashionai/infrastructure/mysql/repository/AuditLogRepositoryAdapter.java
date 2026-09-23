package br.com.fashionai.infrastructure.mysql.repository;

import br.com.fashionai.application.ports.AuditLogRepositoryPort;
import br.com.fashionai.domain.model.AuditLog;
import org.springframework.stereotype.Repository;

@Repository
public class AuditLogRepositoryAdapter implements AuditLogRepositoryPort {
    private final SpringDataAuditLogRepository repository;

    public AuditLogRepositoryAdapter(SpringDataAuditLogRepository repository) {
        this.repository = repository;
    }

    @Override
    public AuditLog save(AuditLog auditLog) {
        return repository.save(auditLog);
    }
}

package br.com.fashionai.infrastructure.mysql.audit;

import br.com.fashionai.application.audit.AuditEvent;
import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.domain.model.AuditLog;
import br.com.fashionai.domain.repository.AuditLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** RNF5 — trilha de auditoria em transação própria: um 403 ou um erro do fluxo principal nunca apaga o registro. */
@Service
public class MysqlAuditService implements AuditService {
    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;

    public MysqlAuditService(AuditLogRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(AuditEvent event) {
        repository.save(new AuditLog(event.actor(), event.acao(), event.recurso(), event.resultado(), event.ip(), event.userAgent(),
                event.timestamp(), event.correlationId(), metadataAsJson(event)));
    }

    private String metadataAsJson(AuditEvent event) {
        try {
            return objectMapper.writeValueAsString(event.metadata());
        } catch (JsonProcessingException ex) {
            return "{\"auditMetadataSerialization\":\"failed\"}";
        }
    }
}

package br.com.fashionai.application.audit;

public interface AuditService {
    void record(AuditEvent event);
}

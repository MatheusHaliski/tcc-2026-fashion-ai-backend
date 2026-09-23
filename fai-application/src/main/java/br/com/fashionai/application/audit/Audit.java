package br.com.fashionai.application.audit;

import br.com.fashionai.application.security.CurrentUser;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Atalho para gravar eventos-chave com usuário, ação, recurso e timestamp (RNF5.aceite). */
@Component
public class Audit {
    private final AuditService service;

    public Audit(AuditService service) {
        this.service = service;
    }

    public void log(CurrentUser user, String action, String resource, Map<String, Object> metadata) {
        service.record(new AuditEvent(user == null ? "system" : user.id().toString(), action, resource, "SUCESSO",
                user == null ? null : user.ip(), user == null ? null : user.userAgent(), Instant.now(),
                UUID.randomUUID().toString(), metadata));
    }

    public void log(String actor, String action, String resource, String result, String ip, String userAgent,
                    Map<String, Object> metadata) {
        service.record(new AuditEvent(actor, action, resource, result, ip, userAgent, Instant.now(),
                UUID.randomUUID().toString(), metadata));
    }
}

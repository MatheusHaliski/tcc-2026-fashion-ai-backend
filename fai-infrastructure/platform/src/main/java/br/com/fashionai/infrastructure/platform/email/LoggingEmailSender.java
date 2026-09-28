package br.com.fashionai.infrastructure.platform.email;

import br.com.fashionai.application.ports.EmailSenderPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Locale;

/**
 * Sem provedor de e-mail configurado: registra no log só destinatário mascarado, assunto e categoria. O corpo traz
 * segredos (links de redefinição de senha, códigos de confirmação e de 2FA) e só vai para o log com
 * {@code EMAIL_LOG_BODIES=true} — uso local; nunca em produção (o provedor padrão é "log").
 */
@Component
@ConditionalOnProperty(name = "fashionai.email.provider", havingValue = "log", matchIfMissing = true)
public class LoggingEmailSender implements EmailSenderPort {
    private static final Logger log = LoggerFactory.getLogger(LoggingEmailSender.class);

    public record Sent(Instant at, String to, String subject, String html, String category) {
    }

    private final Deque<Sent> recent = new ArrayDeque<>();
    private final boolean logBodies;

    public LoggingEmailSender(@Value("${fashionai.email.log-bodies:false}") boolean logBodies) {
        this.logBodies = logBodies;
        if (logBodies) {
            log.warn("EMAIL_LOG_BODIES=true: o corpo dos e-mails (links de redefinição de senha, códigos de confirmação e 2FA) "
                    + "vai para o log. Use só em desenvolvimento local.");
        }
    }

    @Override
    public synchronized void send(String to, String subject, String html, String category) {
        if (logBodies) {
            log.info("[e-mail:{}] para={} assunto=\"{}\"\n{}", category, to, subject, html);
        } else {
            log.info("[e-mail:{}] para={} assunto=\"{}\" (corpo omitido; EMAIL_LOG_BODIES=true para exibir)", category, mask(to), subject);
        }
        recent.addFirst(new Sent(Instant.now(), to, subject, logBodies ? html : null, category));
        while (recent.size() > 50) {
            recent.removeLast();
        }
    }

    public synchronized List<Sent> recent() {
        return List.copyOf(recent);
    }

    /** {@code ana.souza@dominio.com.br} → {@code a***@d***.com.br}: identifica o envio no log sem expor o endereço. */
    public static String mask(String email) {
        if (email == null || email.isBlank()) {
            return "***";
        }
        String e = email.trim().toLowerCase(Locale.ROOT);
        int at = e.lastIndexOf('@');
        if (at <= 0 || at == e.length() - 1) {
            return e.charAt(0) + "***";
        }
        String domain = e.substring(at + 1);
        int dot = domain.indexOf('.');
        String host = dot < 0 ? domain : domain.substring(0, dot);
        String suffix = dot < 0 ? "" : domain.substring(dot);
        return e.charAt(0) + "***@" + (host.isEmpty() ? "" : host.charAt(0)) + "***" + suffix;
    }
}

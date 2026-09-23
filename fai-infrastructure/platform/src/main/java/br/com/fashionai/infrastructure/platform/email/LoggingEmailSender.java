package br.com.fashionai.infrastructure.platform.email;

import br.com.fashionai.application.ports.EmailSenderPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

/** Sem provedor de e-mail configurado: registra no log (códigos de confirmação aparecem no console em dev). */
@Component
@ConditionalOnProperty(name = "fashionai.email.provider", havingValue = "log", matchIfMissing = true)
public class LoggingEmailSender implements EmailSenderPort {
    private static final Logger log = LoggerFactory.getLogger(LoggingEmailSender.class);

    public record Sent(Instant at, String to, String subject, String html, String category) {
    }

    private final Deque<Sent> recent = new ArrayDeque<>();

    @Override
    public synchronized void send(String to, String subject, String html, String category) {
        log.info("[e-mail:{}] para={} assunto=\"{}\"\n{}", category, to, subject, html);
        recent.addFirst(new Sent(Instant.now(), to, subject, html, category));
        while (recent.size() > 50) {
            recent.removeLast();
        }
    }

    public synchronized List<Sent> recent() {
        return List.copyOf(recent);
    }
}

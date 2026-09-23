package br.com.fashionai.infrastructure.platform.email;

import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.infrastructure.platform.Http;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/** E-mail transacional via Resend (https://resend.com/docs/api-reference/emails/send-email). */
@Component
@ConditionalOnProperty(name = "fashionai.email.provider", havingValue = "resend")
public class ResendEmailSender implements EmailSenderPort {
    private static final Logger log = LoggerFactory.getLogger(ResendEmailSender.class);
    private final RestClient client;
    private final String apiKey;
    private final String from;

    public ResendEmailSender(@Value("${fashionai.email.resend-api-key:}") String apiKey,
                             @Value("${fashionai.email.from:nao-responda@fashionai.app}") String from) {
        this.client = Http.client("https://api.resend.com", 15);
        this.apiKey = apiKey;
        this.from = from;
    }

    @Override
    public void send(String to, String subject, String html, String category) {
        try {
            client.post().uri("/emails")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("from", "Fashion AI <" + from + ">", "to", List.of(to), "subject", subject, "html", html,
                            "tags", List.of(Map.of("name", "category", "value", category))))
                    .retrieve().toBodilessEntity();
        } catch (RuntimeException e) {
            // O fluxo do usuário não pode quebrar por causa do e-mail (RNF8): fica registrado para reenvio manual.
            log.error("Falha ao enviar e-mail '{}' para {}: {}", subject, to, e.getMessage());
        }
    }
}

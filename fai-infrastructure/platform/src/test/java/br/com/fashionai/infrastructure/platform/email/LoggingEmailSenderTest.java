package br.com.fashionai.infrastructure.platform.email;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Provedor "log" (padrão): códigos e links de senha não vão para o log, e o destinatário sai mascarado. */
class LoggingEmailSenderTest {
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private final Logger logger = (Logger) LoggerFactory.getLogger(LoggingEmailSender.class);

    @BeforeEach
    void attach() {
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void detach() {
        logger.detachAppender(appender);
    }

    private List<String> lines() {
        return appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
    }

    @Test
    void padraoNaoRegistraCorpoNemEnderecoCompleto() {
        new LoggingEmailSender(false).send("maria.silva@exemplo.com.br", "Redefinição de senha",
                "<p>Use o link https://app/reset?token=abc123segredo ou o código 482913</p>", "SECURITY");
        String all = String.join("\n", lines());
        assertThat(all).doesNotContain("abc123segredo").doesNotContain("482913").doesNotContain("maria.silva@exemplo.com.br");
        assertThat(all).contains("m***@e***.com.br").contains("Redefinição de senha").contains("SECURITY");
    }

    @Test
    void corpoSoComOptInEAvisoNaSubida() {
        LoggingEmailSender sender = new LoggingEmailSender(true);
        assertThat(appender.list).anyMatch(e -> e.getLevel() == ch.qos.logback.classic.Level.WARN);
        sender.send("ana@x.com", "Código", "<p>código 482913</p>", "SECURITY");
        assertThat(String.join("\n", lines())).contains("482913");
    }

    @Test
    void mascaraEnderecos() {
        assertThat(LoggingEmailSender.mask("a@d.com")).isEqualTo("a***@d***.com");
        assertThat(LoggingEmailSender.mask("Joao@Gmail.com")).isEqualTo("j***@g***.com");
        assertThat(LoggingEmailSender.mask("sem-arroba")).isEqualTo("s***");
        assertThat(LoggingEmailSender.mask(null)).isEqualTo("***");
    }
}

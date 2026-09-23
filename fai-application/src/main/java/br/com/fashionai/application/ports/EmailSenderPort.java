package br.com.fashionai.application.ports;

/** E-mail transacional (Resend) — só segurança/acesso, nunca engajamento social (RNF10). */
public interface EmailSenderPort {
    void send(String to, String subject, String html, String category);
}

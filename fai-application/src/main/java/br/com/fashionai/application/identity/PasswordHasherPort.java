package br.com.fashionai.application.identity;

public interface PasswordHasherPort {
    String hash(String rawPassword);

    boolean matches(String rawPassword, String encodedPassword);

    /** O hash gravado usa parâmetros mais fracos que os atuais? (refeito no próximo login certo) */
    default boolean needsRehash(String encodedPassword) {
        return false;
    }
}

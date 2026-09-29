package br.com.fashionai.web.security;

import br.com.fashionai.application.identity.PasswordHasherPort;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Senhas com Argon2id nos parâmetros mínimos da OWASP (Password Storage Cheat Sheet): 19 MiB de memória, 2 iterações,
 * paralelismo 1, sal de 16 bytes e hash de 32 bytes. Hashes antigos (16 MiB, padrão do Spring 5.8) continuam valendo e
 * são refeitos no próximo login certo ({@link #needsRehash}).
 */
@Component
public class Argon2PasswordHasher implements PasswordHasherPort {
    static final int SALT_LENGTH = 16;
    static final int HASH_LENGTH = 32;
    static final int PARALLELISM = 1;
    static final int MEMORY_KIB = 19_456;
    static final int ITERATIONS = 2;
    private final Argon2PasswordEncoder encoder = new Argon2PasswordEncoder(SALT_LENGTH, HASH_LENGTH, PARALLELISM, MEMORY_KIB, ITERATIONS);

    @Override
    public String hash(String rawPassword) {
        return encoder.encode(rawPassword);
    }

    @Override
    public boolean matches(String rawPassword, String encodedPassword) {
        return encoder.matches(rawPassword, encodedPassword);
    }

    @Override
    public boolean needsRehash(String encodedPassword) {
        try {
            return encodedPassword != null && encoder.upgradeEncoding(encodedPassword);
        } catch (RuntimeException e) {
            return false;                                   // formato desconhecido: não mexe
        }
    }
}

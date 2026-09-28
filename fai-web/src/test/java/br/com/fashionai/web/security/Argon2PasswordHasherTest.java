package br.com.fashionai.web.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Argon2id nos parâmetros da OWASP; hashes antigos continuam valendo e pedem re-hash. */
class Argon2PasswordHasherTest {
    private final Argon2PasswordHasher hasher = new Argon2PasswordHasher();

    @Test
    void hashNovoUsaOsParametrosDaOwasp() {
        String hash = hasher.hash("Senha!Forte1");
        assertTrue(hash.startsWith("$argon2id$v=19$m=19456,t=2,p=1$"), hash);
        assertTrue(hasher.matches("Senha!Forte1", hash));
        assertFalse(hasher.matches("outra", hash));
        assertFalse(hasher.needsRehash(hash));
    }

    @Test
    void hashAntigoDoSpringContinuaValendoEPedeRehash() {
        String antigo = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8().encode("Senha!Forte1");
        assertTrue(hasher.matches("Senha!Forte1", antigo));
        assertTrue(hasher.needsRehash(antigo));
        assertFalse(hasher.needsRehash("formato-desconhecido"));
        assertFalse(hasher.needsRehash(null));
    }
}

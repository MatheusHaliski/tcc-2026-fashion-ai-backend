package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** FAI_ADMIN_EMAIL não promove qualquer conta com aquele e-mail: só cria, ou promove com opt-in e conta confirmada. */
class AdminBootstrapTest {
    static final String MAIL = "admin@fashionai.app";
    final List<User> rows = new ArrayList<>();

    UserRepository users() {
        return IdentitySecurityTest.proxy(UserRepository.class, (name, a) -> switch (name) {
            case "findByEmailHash" -> rows.stream().filter(u -> a[0].equals(u.getEmailHash())).findFirst();
            case "existsByUsernameIgnoreCase" -> rows.stream().anyMatch(u -> ((String) a[0]).equalsIgnoreCase(u.getUsername()));
            case "save" -> {
                User u = (User) a[0];
                if (!rows.contains(u)) {
                    rows.add(u);
                }
                yield u;
            }
            default -> throw new UnsupportedOperationException(name);
        });
    }

    AdminBootstrap bootstrap(String password, boolean promoteExisting) {
        PasswordHasherPort hasher = new PasswordHasherPort() {
            public String hash(String raw) { return "h:" + raw; }
            public boolean matches(String raw, String encoded) { return ("h:" + raw).equals(encoded); }
        };
        UserPreferencesRepository prefs = IdentitySecurityTest.proxy(UserPreferencesRepository.class, (n, a) -> a[0]);
        return new AdminBootstrap(users(), prefs, hasher, MAIL, password, "admin", "Administração", promoteExisting);
    }

    User existing(boolean verified, AccountStatus status) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername("quem_chegou_antes");
        u.setEmail(MAIL);
        u.setEmailHash(Hashing.emailHash(MAIL));
        u.setProfileType(ProfileType.PESSOAL);
        u.setEmailVerified(verified);
        u.setStatus(status);
        rows.add(u);
        return u;
    }

    @Test
    void criaAContaQuandoNaoExiste() {
        bootstrap("senha-bem-longa-123", false).ensureAdmin();
        assertEquals(1, rows.size());
        assertEquals("ADMIN", rows.get(0).getRole());
        assertEquals(ProfileType.ADMIN, rows.get(0).getProfileType());
    }

    @Test
    void senhaCurtaNaoCria() {
        bootstrap("curta", false).ensureAdmin();
        assertTrue(rows.isEmpty());
    }

    @Test
    void contaExistenteNaoEPromovidaPorPadrao() {
        User u = existing(true, AccountStatus.ACTIVE);
        bootstrap("senha-bem-longa-123", false).ensureAdmin();
        assertEquals("USER", u.getRole());
    }

    @Test
    void comOptInSoPromoveContaConfirmadaEAtiva() {
        User pending = existing(false, AccountStatus.PENDING_EMAIL_VERIFICATION);
        bootstrap("senha-bem-longa-123", true).ensureAdmin();
        assertEquals("USER", pending.getRole());

        rows.clear();
        User suspended = existing(true, AccountStatus.SUSPENDED);
        bootstrap("senha-bem-longa-123", true).ensureAdmin();
        assertEquals("USER", suspended.getRole());

        rows.clear();
        User ok = existing(true, AccountStatus.ACTIVE);
        bootstrap("senha-bem-longa-123", true).ensureAdmin();
        assertEquals("ADMIN", ok.getRole());
        assertEquals(Optional.of(ok), rows.stream().findFirst());
    }
}

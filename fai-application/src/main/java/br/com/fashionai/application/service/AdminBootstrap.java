package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.identity.PasswordHasherPort;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

/**
 * Conta administrativa (tipo de perfil ADMIN): criada ou promovida na subida da aplicação a partir das variáveis
 * FAI_ADMIN_EMAIL, FAI_ADMIN_PASSWORD e FAI_ADMIN_USERNAME. Sem as duas primeiras nada acontece — o cadastro público
 * nunca cria ADMIN (IdentityService recusa o tipo), então este é o único caminho para a primeira conta de administração;
 * as seguintes podem ser promovidas no painel (papel ADMIN). A senha só é usada na criação: trocar a variável depois não
 * altera a senha de uma conta existente.
 */
@Component
public class AdminBootstrap {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);
    private final UserRepository users;
    private final UserPreferencesRepository preferences;
    private final PasswordHasherPort hasher;
    @Value("${fashionai.admin.email:}")
    private String email;
    @Value("${fashionai.admin.password:}")
    private String password;
    @Value("${fashionai.admin.username:admin}")
    private String username;
    @Value("${fashionai.admin.display-name:Administração Fashion AI}")
    private String displayName;

    public AdminBootstrap(UserRepository users, UserPreferencesRepository preferences, PasswordHasherPort hasher) {
        this.users = users;
        this.preferences = preferences;
        this.hasher = hasher;
    }

    @EventListener(ContextRefreshedEvent.class)
    @Transactional
    public void ensureAdmin() {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return;
        }
        String mail = email.trim().toLowerCase(Locale.ROOT);
        Optional<User> existing = users.findByEmailHash(Hashing.emailHash(mail));
        if (existing.isPresent()) {
            User u = existing.get();
            if (!"ADMIN".equals(u.getRole())) {
                u.setRole("ADMIN");
                users.save(u);
                log.info("Conta {} promovida a ADMIN (FAI_ADMIN_EMAIL)", u.getUsername());
            }
            return;
        }
        if (password.length() < 12) {
            log.warn("FAI_ADMIN_PASSWORD precisa de ao menos 12 caracteres — conta de administração não criada");
            return;
        }
        String handle = username == null || username.isBlank() ? "admin" : username.trim().toLowerCase(Locale.ROOT);
        if (users.existsByUsernameIgnoreCase(handle)) {
            handle = handle + "_" + Long.toString(System.currentTimeMillis() % 100000, 36);
        }
        User u = new User();
        u.setUsername(handle);
        u.setDisplayName(displayName == null || displayName.isBlank() ? "Administração" : displayName.trim());
        u.setEmail(mail);
        u.setEmailHash(Hashing.emailHash(mail));
        u.setPasswordHash(hasher.hash(password));
        u.setProfileType(ProfileType.ADMIN);
        u.setRole("ADMIN");
        u.setCountry("BR");
        u.setPrivateAccount(true);
        u.setEmailVerified(true);
        u.setStatus(AccountStatus.ACTIVE);
        u.setTermsAcceptedAt(Instant.now());
        u.setTermsVersion(IdentityService.TERMS_VERSION);
        users.save(u);
        UserPreferences prefs = new UserPreferences();
        prefs.setUser(u);
        preferences.save(prefs);
        log.info("Conta de administração criada: @{} (ADMIN)", handle);
    }
}

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
 * Conta administrativa (tipo de perfil ADMIN): criada na subida da aplicação a partir das variáveis FAI_ADMIN_EMAIL,
 * FAI_ADMIN_PASSWORD e FAI_ADMIN_USERNAME. Sem as duas primeiras nada acontece — o cadastro público nunca cria ADMIN
 * (IdentityService recusa o tipo), então este é o único caminho para a primeira conta de administração; as seguintes
 * podem ser promovidas no painel (papel ADMIN). A senha só é usada na criação: trocar a variável depois não altera a
 * senha de uma conta existente.
 * <p>
 * Uma conta que já existe com esse e-mail NÃO é promovida por padrão: qualquer pessoa pode se cadastrar com o e-mail de
 * administração antes da primeira subida (sem confirmá-lo). Promover exige FAI_ADMIN_PROMOTE_EXISTING=true e uma conta
 * com e-mail confirmado e ativa.
 */
@Component
public class AdminBootstrap {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);
    private final UserRepository users;
    private final UserPreferencesRepository preferences;
    private final PasswordHasherPort hasher;
    private final String email;
    private final String password;
    private final String username;
    private final String displayName;
    private final boolean promoteExisting;

    public AdminBootstrap(UserRepository users, UserPreferencesRepository preferences, PasswordHasherPort hasher,
                          @Value("${fashionai.admin.email:}") String email,
                          @Value("${fashionai.admin.password:}") String password,
                          @Value("${fashionai.admin.username:admin}") String username,
                          @Value("${fashionai.admin.display-name:Administração Fashion AI}") String displayName,
                          @Value("${fashionai.admin.promote-existing:${FAI_ADMIN_PROMOTE_EXISTING:false}}") boolean promoteExisting) {
        this.users = users;
        this.preferences = preferences;
        this.hasher = hasher;
        this.email = email;
        this.password = password;
        this.username = username;
        this.displayName = displayName;
        this.promoteExisting = promoteExisting;
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
            promote(existing.get());
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

    private void promote(User u) {
        if ("ADMIN".equals(u.getRole())) {
            return;
        }
        if (!promoteExisting) {
            log.warn("Já existe a conta @{} com o e-mail de FAI_ADMIN_EMAIL e ela não é ADMIN: nada foi feito. Para promovê-la, "
                    + "confirme que a conta é sua e suba com FAI_ADMIN_PROMOTE_EXISTING=true (ou promova pelo painel).", u.getUsername());
            return;
        }
        if (!u.isEmailVerified() || u.getStatus() != AccountStatus.ACTIVE) {
            log.warn("Conta @{} não promovida a ADMIN: o e-mail precisa estar confirmado e a conta ativa (status {}).",
                    u.getUsername(), u.getStatus());
            return;
        }
        u.setRole("ADMIN");
        users.save(u);
        log.warn("Conta @{} promovida a ADMIN (FAI_ADMIN_EMAIL + FAI_ADMIN_PROMOTE_EXISTING)", u.getUsername());
    }
}

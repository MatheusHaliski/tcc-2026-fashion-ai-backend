package br.com.fashionai.application.security;

import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;

import java.util.UUID;

/** Usuário autenticado resolvido do JWT (RNF2) e relido do banco a cada requisição (status atual). */
public record CurrentUser(UUID id, String username, String role, ProfileType profileType, boolean emailVerified,
                          AccountStatus status, String ip, String userAgent) {
    public static CurrentUser of(User user, String ip, String userAgent) {
        return new CurrentUser(user.getId(), user.getUsername(), user.getRole(), user.getProfileType(),
                user.isEmailVerified(), user.getStatus(), ip, userAgent);
    }

    public boolean admin() {
        return "ADMIN".equals(role);
    }
}

package br.com.fashionai.web.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component("fashionAuthorization")
public class FashionAuthorization {
    public boolean canAccessUser(UUID targetUserId, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        if (authentication.getAuthorities().stream().anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()))) {
            return true;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof Jwt jwt) {
            String claimUserId = jwt.getClaimAsString("user_id");
            String subject = jwt.getSubject();
            return targetUserId.toString().equals(claimUserId) || targetUserId.toString().equals(subject);
        }
        return targetUserId.toString().equals(authentication.getName());
    }
}

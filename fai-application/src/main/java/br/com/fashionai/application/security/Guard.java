package br.com.fashionai.application.security;

import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.audit.AuditEvent;
import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FollowRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Controle de acesso por recurso (RNF1): o dono manipula; os demais só leem o que a visibilidade permite.
 * Toda negação vira 403 auditado (RF3.CA14 / RF9.CA04 / RNF5). E-mail não confirmado só navega (RF1.CA05).
 */
@Component
public class Guard {
    private final AuditService audit;
    private final FollowRepository follows;

    public Guard(AuditService audit, FollowRepository follows) {
        this.audit = audit;
        this.follows = follows;
    }

    public void requireCanCreate(CurrentUser user) {
        if (user == null) {
            throw ApiException.unauthorized("Faça login para continuar.");
        }
        if (user.status() == AccountStatus.PENDING_EMAIL_VERIFICATION || !user.emailVerified()) {
            throw new ApiException(403, "EMAIL_NAO_CONFIRMADO",
                    "Confirme seu e-mail para criar ou editar conteúdo. Até lá você pode navegar e ver as telas.");
        }
        if (user.status() == AccountStatus.SUSPENDED) {
            throw new ApiException(403, "CONTA_SUSPENSA", "Sua conta está suspensa. Fale com o suporte.");
        }
        if (user.status() == AccountStatus.DELETION_SCHEDULED) {
            throw new ApiException(403, "EXCLUSAO_AGENDADA",
                    "Sua conta está com exclusão agendada. Cancele a exclusão em Configurações para voltar a criar.");
        }
    }

    public void requireApprovedProfile(CurrentUser user, ProfileType type) {
        requireCanCreate(user);
        if (user.profileType() != type) {
            throw deny(user, "perfil:" + type, "Recurso exclusivo de perfis do tipo " + type + ".");
        }
        if (user.status() == AccountStatus.PENDING_VALIDATION) {
            throw new ApiException(403, "PERFIL_EM_VALIDACAO",
                    "Seu perfil de " + type.name().toLowerCase() + " aguarda aprovação de um administrador do Fashion AI.");
        }
    }

    public void requireOwner(CurrentUser user, UUID ownerId, String resource) {
        if (user == null) {
            throw ApiException.unauthorized("Faça login para continuar.");
        }
        if (!user.id().equals(ownerId) && !user.admin()) {
            throw deny(user, resource, "Apenas o autor pode alterar este conteúdo.");
        }
    }

    public void requireAdmin(CurrentUser user) {
        if (user == null || !user.admin()) {
            throw deny(user, "admin", "Área restrita a administradores do Fashion AI.");
        }
    }

    public boolean canView(CurrentUser viewer, UUID ownerId, Visibility visibility) {
        if (viewer != null && (viewer.id().equals(ownerId) || viewer.admin())) {
            return true;
        }
        return switch (visibility == null ? Visibility.PRIVATE : visibility) {
            case PUBLIC -> true;
            case FOLLOWERS -> viewer != null && follows.findByFollowerIdAndFollowingId(viewer.id(), ownerId)
                    .map(f -> f.getStatus() == FollowStatus.ACEITO).orElse(false);
            case PRIVATE -> false;
        };
    }

    public void requireView(CurrentUser viewer, UUID ownerId, Visibility visibility, String resource) {
        if (!canView(viewer, ownerId, visibility)) {
            throw deny(viewer, resource, "Este conteúdo não está visível para você.");
        }
    }

    public ApiException deny(CurrentUser user, String resource, String message) {
        audit.record(new AuditEvent(user == null ? "anonymous" : user.id().toString(), AuditActions.ACESSO_NEGADO_403,
                resource, "NEGADO", user == null ? null : user.ip(), user == null ? null : user.userAgent(),
                Instant.now(), UUID.randomUUID().toString(), Map.of("resource", resource)));
        return ApiException.forbidden(message);
    }
}

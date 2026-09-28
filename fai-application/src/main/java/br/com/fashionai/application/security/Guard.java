package br.com.fashionai.application.security;

import br.com.fashionai.application.common.Msg;
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
 * Bloqueio (em qualquer direção) vale como conteúdo invisível: quem bloqueou ou foi bloqueado não abre nem interage
 * com o conteúdo do outro, mesmo com o id em mãos.
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
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        if (user.status() == AccountStatus.PENDING_EMAIL_VERIFICATION || !user.emailVerified()) {
            throw new ApiException(403, "EMAIL_NAO_CONFIRMADO",
                    Msg.t("guard.confirme_seu_e_mail_para"));
        }
        if (user.status() == AccountStatus.SUSPENDED) {
            throw new ApiException(403, "CONTA_SUSPENSA", Msg.t("guard.sua_conta_esta_suspensa_fale"));
        }
        if (user.status() == AccountStatus.DELETION_SCHEDULED) {
            throw new ApiException(403, "EXCLUSAO_AGENDADA",
                    Msg.t("guard.sua_conta_esta_com_exclusao"));
        }
    }

    /**
     * Comércio de marca/celebridade (cupons, combinações FLAIR, itens da loja do quarto, selos e promoções): perfil
     * institucional validado pela administração e conta ativa — perfil aguardando aprovação não vende nem emite.
     */
    public void requireApprovedInstitutional(CurrentUser user, String resource, String message) {
        requireCanCreate(user);
        if (user.profileType() != ProfileType.MARCA && user.profileType() != ProfileType.CELEBRIDADE) {
            throw deny(user, resource, message);
        }
        requireApprovedProfile(user, user.profileType());
        if (user.status() != AccountStatus.ACTIVE) {
            throw deny(user, resource, message);
        }
    }

    public void requireApprovedProfile(CurrentUser user, ProfileType type) {
        requireCanCreate(user);
        if (user.profileType() != type) {
            throw deny(user, "perfil:" + type, Msg.t("guard.recurso_exclusivo_de_perfis_do", type));
        }
        if (user.status() == AccountStatus.PENDING_VALIDATION) {
            throw new ApiException(403, "PERFIL_EM_VALIDACAO",
                    Msg.t("guard.seu_perfil_de_aguarda_aprovacao", type.name().toLowerCase()));
        }
    }

    public void requireOwner(CurrentUser user, UUID ownerId, String resource) {
        if (user == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        if (!user.id().equals(ownerId) && !user.admin()) {
            throw deny(user, resource, Msg.t("guard.apenas_o_autor_pode_alterar"));
        }
    }

    public void requireAdmin(CurrentUser user) {
        if (user == null || !user.admin()) {
            throw deny(user, "admin", Msg.t("guard.area_restrita_a_administradores_do"));
        }
    }

    public boolean canView(CurrentUser viewer, UUID ownerId, Visibility visibility) {
        if (viewer != null && (viewer.id().equals(ownerId) || viewer.admin())) {
            return true;
        }
        if (viewer != null && blocked(viewer.id(), ownerId)) {
            return false;
        }
        return switch (visibility == null ? Visibility.PRIVATE : visibility) {
            case PUBLIC -> true;
            case FOLLOWERS -> viewer != null && follows.findByFollowerIdAndFollowingId(viewer.id(), ownerId)
                    .map(f -> f.getStatus() == FollowStatus.ACEITO).orElse(false);
            case PRIVATE -> false;
        };
    }

    /** Há bloqueio entre os dois, em qualquer direção (a bloqueou b ou b bloqueou a)? */
    public boolean blocked(UUID a, UUID b) {
        if (a == null || b == null || a.equals(b)) {
            return false;
        }
        return isBlock(follows.findByFollowerIdAndFollowingId(a, b)) || isBlock(follows.findByFollowerIdAndFollowingId(b, a));
    }

    private static boolean isBlock(java.util.Optional<br.com.fashionai.domain.model.Follow> f) {
        return f != null && f.map(x -> x.getStatus() == FollowStatus.BLOQUEADO).orElse(false);
    }

    public void requireView(CurrentUser viewer, UUID ownerId, Visibility visibility, String resource) {
        if (!canView(viewer, ownerId, visibility)) {
            throw deny(viewer, resource, Msg.t("guard.este_conteudo_nao_esta_visivel"));
        }
    }

    public ApiException deny(CurrentUser user, String resource, String message) {
        audit.record(new AuditEvent(user == null ? "anonymous" : user.id().toString(), AuditActions.ACESSO_NEGADO_403,
                resource, "NEGADO", user == null ? null : user.ip(), user == null ? null : user.userAgent(),
                Instant.now(), UUID.randomUUID().toString(), Map.of("resource", resource)));
        return ApiException.forbidden(message);
    }
}

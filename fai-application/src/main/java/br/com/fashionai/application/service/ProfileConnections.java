package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * RF17.CA03/CA04 e RF19 — o grafo de seguir do perfil: relação entre duas contas, seguir (direto ou pedido em conta
 * privada), deixar de seguir, pedidos pendentes e resposta, conexões visíveis e bloqueio.
 */
final class ProfileConnections {
    private final UserRepository users;
    private final FollowRepository follows;
    private final NotificationService notifications;
    private final Guard guard;

    ProfileConnections(UserRepository users, FollowRepository follows, NotificationService notifications, Guard guard) {
        this.users = users;
        this.follows = follows;
        this.notifications = notifications;
        this.guard = guard;
    }

    FollowStatus relation(UUID viewer, UUID target) {
        return follows.findByFollowerIdAndFollowingId(viewer, target).map(Follow::getStatus).orElse(null);
    }

    Map<String, Object> follow(CurrentUser viewer, UUID targetId) {
        if (viewer.id().equals(targetId)) {
            throw ApiException.badRequest("SEGUIR_A_SI", Msg.t("profile.voce_nao_pode_seguir_a"));
        }
        User target = users.findById(targetId).orElseThrow(() -> ApiException.notFound("Perfil"));
        if (relation(targetId, viewer.id()) == FollowStatus.BLOQUEADO) {
            throw ApiException.notFound("Perfil");
        }
        Follow f = follows.findByFollowerIdAndFollowingId(viewer.id(), targetId).orElseGet(() -> {
            Follow n = new Follow();
            n.setFollower(users.findById(viewer.id()).orElseThrow());
            n.setFollowing(target);
            return n;
        });
        if (f.getStatus() == FollowStatus.ACEITO && f.getId() != null) {
            return state(viewer.id(), targetId);
        }
        boolean needsApproval = target.isPrivateAccount() && target.getProfileVisibility() != Visibility.PUBLIC
                && target.getProfileType() == ProfileType.PESSOAL;
        f.setStatus(needsApproval ? FollowStatus.PENDENTE : FollowStatus.ACEITO);
        follows.save(f);
        notifications.notify(targetId, viewer.id(), needsApproval ? NotificationType.FOLLOW_REQUEST : NotificationType.NEW_FOLLOWER, "USER", viewer.id(),
                needsApproval ? Msg.k("profile.quer_seguir_voce", viewer.username()) : Msg.k("profile.comecou_a_seguir_voce", viewer.username()), null, Map.of());
        return state(viewer.id(), targetId);
    }

    Map<String, Object> unfollow(CurrentUser viewer, UUID targetId) {
        follows.findByFollowerIdAndFollowingId(viewer.id(), targetId).filter(f -> f.getStatus() != FollowStatus.BLOQUEADO).ifPresent(follows::delete);
        return state(viewer.id(), targetId);
    }

    Map<String, Object> state(UUID viewerId, UUID targetId) {
        FollowStatus rel = relation(viewerId, targetId);
        return Map.of("relation", rel == null ? "NENHUMA" : rel.name(),
                "followers", follows.countByFollowingIdAndStatus(targetId, FollowStatus.ACEITO),
                "following", follows.countByFollowerIdAndStatus(targetId, FollowStatus.ACEITO));
    }

    List<Map<String, Object>> requests(CurrentUser user) {
        return follows.findByFollowingIdAndStatus(user.id(), FollowStatus.PENDENTE).stream()
                .map(f -> Map.<String, Object>of("id", f.getId(), "user", Views.user(f.getFollower()), "at", f.getCreatedAt())).toList();
    }

    Map<String, Object> respond(CurrentUser user, UUID followId, boolean accept) {
        Follow f = follows.findById(followId).orElseThrow(() -> ApiException.notFound("Pedido"));
        guard.requireOwner(user, f.getFollowing().getId(), "follow:" + followId);
        if (f.getStatus() != FollowStatus.PENDENTE) {
            throw new ApiException(409, "PEDIDO_RESPONDIDO", Msg.t("profile.este_pedido_ja_foi_respondido"));
        }
        if (accept) {
            f.setStatus(FollowStatus.ACEITO);
            f.setRespondedAt(Instant.now());
            follows.save(f);
            notifications.notify(f.getFollower().getId(), user.id(), NotificationType.FOLLOW_ACCEPTED, "USER", user.id(),
                    Msg.k("profile.aceitou_seu_pedido", user.username()), null, Map.of());
        } else {
            follows.delete(f);
        }
        return Map.of("accepted", accept);
    }

    Map<String, Object> connections(CurrentUser viewer, UUID userId) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("Perfil"));
        // sem login também chega aqui (perfil público): viewer nulo não pode derrubar a rota com erro 500
        if (!(viewer != null && viewer.id().equals(userId)) && !guard.canView(viewer, userId, u.getProfileVisibility())) {
            throw guard.deny(viewer, "connections:" + userId, Msg.t("profile.as_conexoes_deste_perfil_nao"));
        }
        return Map.of("followers", follows.findByFollowingIdAndStatus(userId, FollowStatus.ACEITO).stream().map(f -> Views.user(f.getFollower())).toList(),
                "following", follows.findByFollowerIdAndStatus(userId, FollowStatus.ACEITO).stream().map(f -> Views.user(f.getFollowing())).toList());
    }

    Map<String, Object> block(CurrentUser user, UUID targetId, boolean block) {
        if (user.id().equals(targetId)) {
            throw ApiException.badRequest("BLOQUEIO_INVALIDO", Msg.t("profile.voce_nao_pode_bloquear_a"));
        }
        User target = users.findById(targetId).orElseThrow(() -> ApiException.notFound("Perfil"));
        follows.findByFollowerIdAndFollowingId(targetId, user.id()).ifPresent(follows::delete);
        Optional<Follow> mine = follows.findByFollowerIdAndFollowingId(user.id(), targetId);
        if (block) {
            Follow f = mine.orElseGet(() -> {
                Follow n = new Follow();
                n.setFollower(users.findById(user.id()).orElseThrow());
                n.setFollowing(target);
                return n;
            });
            f.setStatus(FollowStatus.BLOQUEADO);
            follows.save(f);
        } else {
            mine.filter(f -> f.getStatus() == FollowStatus.BLOQUEADO).ifPresent(follows::delete);
        }
        return Map.of("blocked", block);
    }
}

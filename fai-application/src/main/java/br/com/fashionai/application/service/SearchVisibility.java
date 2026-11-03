package br.com.fashionai.application.service;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.FollowRepository;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * RF8.CA05 — nunca conteúdo privado ou bloqueado: bloqueios nos dois sentidos, conta ativa, vitrine sem contas de teste
 * e a visibilidade do look/peça para quem vê (o look ainda passa pelo {@link SchemeService}; a peça, pela guarda).
 */
final class SearchVisibility {
    private final FollowRepository follows;
    private final SchemeService schemeService;
    private final Guard guard;

    SearchVisibility(FollowRepository follows, SchemeService schemeService, Guard guard) {
        this.follows = follows;
        this.schemeService = schemeService;
        this.guard = guard;
    }

    Set<UUID> blockedFor(UUID viewerId) {
        Set<UUID> out = new HashSet<>();
        if (viewerId == null) {
            return out;
        }
        follows.findByFollowingIdAndStatus(viewerId, FollowStatus.BLOQUEADO).forEach(f -> out.add(f.getFollower().getId()));
        follows.findByFollowerIdAndStatus(viewerId, FollowStatus.BLOQUEADO).forEach(f -> out.add(f.getFollowing().getId()));
        return out;
    }

    /** Conteúdo de conta de teste só aparece para outra conta de teste (a vitrine pública fica limpa). */
    static boolean showcaseAllows(CurrentUser viewer, User owner) {
        return !owner.isTestAccount() || (viewer != null && User.isTestUsername(viewer.username()));
    }

    boolean visible(CurrentUser viewer, Scheme s, Set<UUID> blocked) {
        // o índice de busca (OpenSearch) guarda também rascunhos: busca só mostra look publicado, até para o dono
        return s.getStatus() == SchemeStatus.PUBLISHED
                && !blocked.contains(s.getUser().getId()) && s.getUser().getStatus() == AccountStatus.ACTIVE && showcaseAllows(viewer, s.getUser())
                && schemeService.canView(viewer, s);
    }

    boolean visible(CurrentUser viewer, WardrobeItem w, Set<UUID> blocked) {
        return !blocked.contains(w.getUser().getId()) && w.getUser().getStatus() == AccountStatus.ACTIVE && showcaseAllows(viewer, w.getUser())
                && w.getModerationStatus() == ModerationStatus.APPROVED
                && guard.canView(viewer, w.getUser().getId(), SchemeService.moreRestrictive(w.getVisibility(), w.getUser().getProfileVisibility()));
    }

    /** Quem compartilhou também precisa estar visível para quem lê o feed (sem bloqueio, conta ativa, vitrine). */
    boolean sharerVisible(CurrentUser viewer, User sharer, Set<UUID> blocked) {
        return sharer != null && !blocked.contains(sharer.getId()) && sharer.getStatus() == AccountStatus.ACTIVE && showcaseAllows(viewer, sharer);
    }
}

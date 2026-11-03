package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.lens.LensService;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.privacy.AccountDataCleanup;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.CommentRepository;
import br.com.fashionai.domain.repository.HypeMilestoneRepository;
import br.com.fashionai.domain.repository.PhotoRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Conclusão das exclusões vencidas por anonimização irreversível (LGPD art. 16/18): limpeza dos módulos (antes de tudo;
 * falha interrompe), acervo arquivado e privado, comentários, fotos, rosto 3D, Lens, marcos de Hype, dados da conta
 * e sessões.
 */
final class AccountAnonymizer {
    private final UserRepository users;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final CommentRepository comments;
    private final PhotoRepository photos;
    private final MediaStoragePort storage;
    private final Avatar3dService avatars3d;
    /** RF54: scans do FashionAI Lens (imagens e linhas) saem junto com a conta. */
    private final LensService lens;
    private final HypeMilestoneRepository hypeMilestones;
    private final IdentityService identity;
    private final Audit audit;
    /** Limpezas dos módulos (campo injetado do service, lido a cada execução). */
    private final Supplier<List<AccountDataCleanup>> accountDataCleanup;

    AccountAnonymizer(UserRepository users, WardrobeItemRepository pieces, SchemeRepository schemes, CommentRepository comments,
                      PhotoRepository photos, MediaStoragePort storage, Avatar3dService avatars3d, LensService lens,
                      HypeMilestoneRepository hypeMilestones, IdentityService identity, Audit audit,
                      Supplier<List<AccountDataCleanup>> accountDataCleanup) {
        this.users = users;
        this.pieces = pieces;
        this.schemes = schemes;
        this.comments = comments;
        this.photos = photos;
        this.storage = storage;
        this.avatars3d = avatars3d;
        this.lens = lens;
        this.hypeMilestones = hypeMilestones;
        this.identity = identity;
        this.audit = audit;
        this.accountDataCleanup = accountDataCleanup;
    }

    /** Job diário: conclui exclusões vencidas por anonimização irreversível (LGPD art. 16/18). */
    int purgeScheduledDeletions() {
        int count = 0;
        for (User u : users.findByStatus(AccountStatus.DELETION_SCHEDULED)) {
            if (u.getDeletionScheduledFor() == null || u.getDeletionScheduledFor().isAfter(Instant.now())) {
                continue;
            }
            for (AccountDataCleanup cleanup : accountDataCleanup.get()) {
                cleanup.purge(u.getId());
            }
            String tag = u.getId().toString().substring(0, 8);
            for (WardrobeItem p : pieces.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                p.setVisibility(Visibility.PRIVATE);
                p.setDisponivel(false);
                p.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
            }
            for (Scheme s : schemes.findByUserIdOrderByCreatedAtDesc(u.getId())) {
                s.setVisibility(Visibility.PRIVATE);
                s.setStatus(SchemeStatus.ARCHIVED);
            }
            comments.findByAuthorId(u.getId()).forEach(c -> {
                c.setContent(Msg.t("account.comentario_removido"));
                c.setActive(false);
            });
            photos.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(u.getId()).forEach(p -> {
                try {
                    storage.delete(p.getStorageKey());
                } catch (RuntimeException ignored) {
                    // objeto já ausente
                }
                p.setDeletedAt(Instant.now());
            });
            avatars3d.deleteAllFor(u.getId());                     // RF40: rosto 3D e textura (dado biométrico) saem junto
            if (lens != null) {
                lens.deleteAllFor(u.getId());                      // RF54: scans do Lens (imagens privadas e leituras)
            }
            if (hypeMilestones != null) {
                hypeMilestones.deleteByOwnerId(u.getId());         // RF53: marcos de Hype (o resto do Hype sai com as peças arquivadas)
            }
            u.setUsername("deleted_" + tag);
            u.setDisplayName(Msg.t("account.conta_excluida"));
            u.setEmail("deleted+" + tag + "@fashionai.invalid");
            u.setEmailHash(Hashing.sha256("deleted:" + u.getId() + ":" + Hashing.randomToken(8)));
            u.setPhone(null);
            u.setBirthDate(null);
            u.setBio(null);
            u.setAvatarUrl(null);
            u.setCoverUrl(null);
            u.setPasswordHash(Hashing.randomToken(32));
            u.setStatus(AccountStatus.DELETED);
            identity.revokeOtherSessions(u.getId(), null);
            audit.log("system", AuditActions.EXCLUSAO_CONTA, "user:" + u.getId(), "CONCLUIDA", null, null, Map.of());
            count++;
        }
        return count;
    }
}

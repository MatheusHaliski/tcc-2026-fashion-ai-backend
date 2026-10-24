package br.com.fashionai.application.atelierproject;

import br.com.fashionai.application.privacy.AccountDataCleanup;
import br.com.fashionai.domain.model.atelierproject.DesignProject;
import br.com.fashionai.domain.repository.atelierproject.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.UUID;

/** Account erasure runs regardless of module availability. No paid orders or production commitments exist. */
@Component
public class AtelierAccountDataCleanup implements AccountDataCleanup {
    public static final UUID ANONYMOUS_AUTHOR=UUID.fromString("00000000-0000-0000-0000-000000000000");
    private final DesignProjectRepository projects;
    private final DesignProjectMemberRepository members;
    private final DesignRevisionRepository revisions;
    private final DesignCommentRepository comments;
    private final DesignReviewRepository reviews;
    private final DesignVoteRepository votes;
    public AtelierAccountDataCleanup(DesignProjectRepository projects,DesignProjectMemberRepository members,
        DesignRevisionRepository revisions,DesignCommentRepository comments,DesignReviewRepository reviews,DesignVoteRepository votes) {
        this.projects=projects;this.members=members;this.revisions=revisions;this.comments=comments;this.reviews=reviews;this.votes=votes;
    }
    @Override @Transactional
    public void purge(UUID userId) {
        // Explicit child removal also covers databases without cascade mappings in isolated tests.
        var ids=projects.findIdsByOwnerId(userId);
        if(!ids.isEmpty()) {
            votes.purgeProjects(ids);comments.purgeProjects(ids);reviews.purgeProjects(ids);members.purgeProjects(ids);
            revisions.purgeProjects(ids);projects.purgeByOwnerId(userId);
        }
        projects.reopenForDeletedReviewer(userId,DesignProject.State.IN_REVIEW,DesignProject.State.APPROVED_FOR_SHOWCASE,Instant.now());
        comments.purgeUser(userId);reviews.purgeUser(userId);votes.purgeUser(userId);members.purgeUser(userId);
        // Published, licensed contributions in other people's projects retain their specification and lineage,
        // with the deleted account's identifier removed. Private drafts owned by that account were erased above.
        revisions.anonymizeAuthor(userId,ANONYMOUS_AUTHOR);
        projects.anonymizeLastEditor(userId.toString());
    }
}

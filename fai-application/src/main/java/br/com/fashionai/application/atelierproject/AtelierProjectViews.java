package br.com.fashionai.application.atelierproject;

import br.com.fashionai.domain.model.atelierproject.*;
import br.com.fashionai.domain.model.enums.Visibility;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** Explicit projections: no reward, verification, entitlement, or production fields are accepted. */
public final class AtelierProjectViews {
    private AtelierProjectViews() {}
    public record Measurement(@NotBlank @Size(max=80) String point, @NotBlank @Size(max=160) String protocol,
                              @NotNull @DecimalMin("0.1") @DecimalMax("1000") BigDecimal centimeters) {}
    public record Specification(@Size(max=120) String family, @Size(max=2000) String modeling,
        @Size(max=2000) String fabric, @Size(max=1000) String colors, @Size(max=1500) String pockets,
        @Size(max=1500) String collar, @Size(max=1500) String sleeves, @Size(max=1500) String fastenings,
        @Size(max=2000) String finishes, @Size(max=2000) String printPlacement,
        @Size(max=3000) String frontView, @Size(max=3000) String backView,
        @Size(max=3000) String referenceNotes, @Size(max=3000) String notes,
        @NotNull @Size(max=40) List<@NotNull @Valid Measurement> measurements) {}
    public record Create(@NotBlank @Size(max=80) String requestId, @NotBlank @Size(max=160) String title,
        @NotNull @Size(max=4000) String brief, @NotNull Visibility visibility,
        @NotNull @Valid Specification specification, @AssertTrue boolean rightsAccepted) {}
    public record Update(@PositiveOrZero long expectedVersion, @NotBlank @Size(max=160) String title,
        @NotNull @Size(max=4000) String brief, @NotNull Visibility visibility,
        @NotNull @Valid Specification specification, @AssertTrue boolean rightsAccepted) {}
    public record Publish(@PositiveOrZero long expectedVersion, UUID parentRevisionId, UUID sourceRevisionId,
        @NotBlank @Size(max=80) String requestId, @AssertTrue boolean licenseAccepted, Instant votingEndsAt) {}
    public record Invite(@PositiveOrZero long expectedVersion, @NotBlank @Size(max=80) String username,
                         @NotNull DesignProjectMember.Role role) {}
    public record Version(@PositiveOrZero long expectedVersion) {}
    public record Comment(@PositiveOrZero long expectedVersion, @NotNull UUID revisionId,
        @NotBlank @Size(max=100) String anchor, @NotBlank @Size(max=4000) String body,
        @NotBlank @Size(max=80) String requestId) {}
    public record Review(@PositiveOrZero long expectedVersion, @NotNull UUID revisionId,
        @NotNull DesignReview.Decision decision, @NotBlank @Size(max=4000) String notes,
        @NotBlank @Size(max=80) String requestId) {}
    public record Vote(@NotNull UUID revisionId, boolean interested) {}
    public record Capabilities(boolean edit, boolean manageMembers, boolean review, boolean vote) {}
    public record Summary(UUID id, UUID ownerId, String title, String brief, Visibility visibility,
        DesignProject.State state, long version, int revisionNumber, UUID latestRevisionId, Instant updatedAt) {}
    public record Member(UUID id, UUID userId, String username, DesignProjectMember.Role role,
                         DesignProjectMember.Status status, Instant expiresAt) {}
    public record Invitation(UUID id, UUID projectId, String projectTitle, DesignProjectMember.Role role, Instant expiresAt) {}
    public record Revision(UUID id, UUID parentRevisionId, UUID sourceRevisionId, UUID authorId, String authorName, int number,
        String title, String brief, Specification specification, String contributionLicense, Instant createdAt,
        Instant votingEndsAt, long interestedCount, Boolean myInterest) {}
    public record CommentView(UUID id, UUID revisionId, UUID authorId, String authorName, String anchor, String body, Instant createdAt) {}
    public record ReviewView(UUID id, UUID revisionId, UUID authorId, String authorName, DesignReview.Decision decision, String notes, Instant createdAt) {}
    public record Detail(Summary project, Specification specification, Capabilities capabilities,
        List<Member> members, List<CommentView> comments, List<ReviewView> reviews, Revision latestRevision) {}
    public record Page<T>(List<T> items, int page, int size, boolean hasMore) {}
    public record VoteResult(UUID revisionId, boolean interested, long interestedCount) {}
    public record TechPack(String format, UUID projectId, Revision revision, List<ReviewView> reviews,
        List<String> missingFields, String reviewStatus, boolean productionApproved, String notice) {}
}

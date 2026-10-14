package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Entity @Table(name = "community_trends")
public class CommunityTrend extends AuditableEntity {
    @Column(name = "author_id", nullable = false, length = 36) private UUID authorId;
    @Column(nullable = false, length = 80) private String title;
    @Column(nullable = false, length = 1000) private String description;
    @Column(nullable = false, length = 40) private String kind;
    @Column(nullable = false, length = 20) private String status = "DRAFT";
    @Column(name = "duration_days", nullable = false) private int durationDays;
    @Column(name = "published_at") private Instant publishedAt;
    @Column(name = "ends_at") private Instant endsAt;
    @Column(name = "awarded_points", nullable = false) private int awardedPoints;
}

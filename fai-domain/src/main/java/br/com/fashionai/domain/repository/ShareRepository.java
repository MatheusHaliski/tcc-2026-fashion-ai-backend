package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.Share;
import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.model.enums.TargetType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ShareRepository extends JpaRepository<Share, UUID> {
    long countByTargetTypeAndTargetId(TargetType targetType, UUID targetId);

    List<Share> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Query("select s from Share s where s.user.id in :userIds and s.channel = :channel order by s.createdAt desc")
    List<Share> findFeedShares(@Param("userIds") Collection<UUID> userIds, @Param("channel") ShareChannel channel, Pageable pageable);

    long countByCreatedAtAfter(Instant since);
}

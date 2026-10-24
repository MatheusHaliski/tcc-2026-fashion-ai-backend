package br.com.fashionai.domain.repository.atelierproject;
import br.com.fashionai.domain.model.atelierproject.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import java.util.*;
public interface DesignVoteRepository extends JpaRepository<DesignVote,UUID> {
Optional<DesignVote> findByRevisionIdAndUserId(UUID revision,UUID user);
long countByRevisionIdAndInterestedTrue(UUID revision);
@Modifying @Query("delete from DesignVote e where e.projectId in :ids") int purgeProjects(@Param("ids") Collection<UUID> ids);
@Modifying @Query("delete from DesignVote e where e.userId=:user") int purgeUser(@Param("user") UUID user);
}

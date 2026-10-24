package br.com.fashionai.domain.repository.atelierproject;
import br.com.fashionai.domain.model.atelierproject.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import java.util.*;
public interface DesignReviewRepository extends JpaRepository<DesignReview,UUID> {
Optional<DesignReview> findByProjectIdAndAuthorIdAndRequestId(UUID project,UUID author,String key);
List<DesignReview> findTop50ByProjectIdOrderByCreatedAtDesc(UUID project);
List<DesignReview> findByProjectIdAndRevisionIdOrderByCreatedAtDesc(UUID project,UUID revision);
@Modifying @Query("delete from DesignReview e where e.projectId in :ids") int purgeProjects(@Param("ids") Collection<UUID> ids);
@Modifying @Query("delete from DesignReview e where e.authorId=:user") int purgeUser(@Param("user") UUID user);
}

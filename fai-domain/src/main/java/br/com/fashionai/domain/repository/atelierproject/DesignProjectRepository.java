package br.com.fashionai.domain.repository.atelierproject;
import br.com.fashionai.domain.model.atelierproject.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import java.util.*;
public interface DesignProjectRepository extends JpaRepository<DesignProject,UUID> {
@Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE) @Query("select p from DesignProject p where p.id=:id") Optional<DesignProject> lockById(@Param("id") UUID id);
Optional<DesignProject> findByOwnerIdAndCreationKey(UUID owner,String key);
@Query("select p from DesignProject p where p.ownerId=:user or exists (select m.id from DesignProjectMember m where m.projectId=p.id and m.userId=:user and m.status=:status)") Page<DesignProject> findAccessible(@Param("user") UUID user,@Param("status") DesignProjectMember.Status status,Pageable page);
@Query("select p.id from DesignProject p where p.ownerId=:owner") List<UUID> findIdsByOwnerId(@Param("owner") UUID owner);
@Modifying @Query("delete from DesignProject p where p.ownerId=:owner") int purgeByOwnerId(@Param("owner") UUID owner);
@Modifying @Query("update DesignProject p set p.lastModifiedBy=null where p.lastModifiedBy=:actor") int anonymizeLastEditor(@Param("actor") String actor);
@Modifying @Query("update DesignProject p set p.state=:state,p.version=p.version+1,p.activityAt=:now where p.state=:prior and p.latestRevisionId in (select r.revisionId from DesignReview r where r.authorId=:user)") int reopenForDeletedReviewer(@Param("user") UUID user,@Param("state") DesignProject.State state,@Param("prior") DesignProject.State prior,@Param("now") java.time.Instant now);
}

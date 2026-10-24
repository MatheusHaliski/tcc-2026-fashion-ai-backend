package br.com.fashionai.domain.repository.atelierproject;
import br.com.fashionai.domain.model.atelierproject.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import java.util.*;
public interface DesignRevisionRepository extends JpaRepository<DesignRevision,UUID> {
Optional<DesignRevision> findByProjectIdAndRequestId(UUID project,String key);
Page<DesignRevision> findByProjectIdOrderByNumberDesc(UUID project,Pageable page);
@Modifying @Query("delete from DesignRevision e where e.projectId in :ids") int purgeProjects(@Param("ids") Collection<UUID> ids);
@Modifying @Query("update DesignRevision e set e.authorId=:anonymous,e.createdBy=null,e.lastModifiedBy=null where e.authorId=:user") int anonymizeAuthor(@Param("user") UUID user,@Param("anonymous") UUID anonymous);
}

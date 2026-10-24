package br.com.fashionai.domain.repository.atelierproject;
import br.com.fashionai.domain.model.atelierproject.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import java.util.*;
public interface DesignProjectMemberRepository extends JpaRepository<DesignProjectMember,UUID> {
Optional<DesignProjectMember> findByProjectIdAndUserId(UUID project,UUID user);
List<DesignProjectMember> findByProjectIdOrderByCreatedAtAsc(UUID project);
List<DesignProjectMember> findByUserIdAndStatusOrderByCreatedAtDesc(UUID user,DesignProjectMember.Status status);
@Modifying @Query("delete from DesignProjectMember e where e.projectId in :ids") int purgeProjects(@Param("ids") Collection<UUID> ids);
@Modifying @Query("delete from DesignProjectMember e where e.userId=:user") int purgeUser(@Param("user") UUID user);
}

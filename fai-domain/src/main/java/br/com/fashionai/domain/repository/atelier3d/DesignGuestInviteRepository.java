package br.com.fashionai.domain.repository.atelier3d;
import br.com.fashionai.domain.model.atelier3d.DesignGuestInvite;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface DesignGuestInviteRepository extends JpaRepository<DesignGuestInvite,UUID> {
    @Query("select g.projectId from DesignGuestInvite g where g.id=:id") Optional<UUID> projectIdOf(@Param("id") UUID id);
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from DesignGuestInvite g where g.id=:id") Optional<DesignGuestInvite> lockById(@Param("id") UUID id);
    List<DesignGuestInvite> findByProjectIdOrderByCreatedAtDesc(UUID project);
}
